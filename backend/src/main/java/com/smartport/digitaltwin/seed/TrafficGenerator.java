package com.smartport.digitaltwin.seed;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartport.digitaltwin.model.TrafficRecord;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.regex.Pattern;

/** Versioned deterministic model. No randomness, fabricated joins or operational writes. */
public final class TrafficGenerator {
    public static final String MODEL_VERSION = "shared-vertex-v1";
    private static final Map<String, Double> LOAD = Map.of("motorway", .65, "trunk", .9, "primary", .8,
            "secondary", .65, "tertiary", .5, "residential", .25, "service", .35, "unclassified", .3);
    private static final Map<String, Double> SPEED = Map.of("motorway", 80., "trunk", 60., "primary", 50.,
            "secondary", 40., "tertiary", 35., "residential", 25., "service", 15., "unclassified", 25.);
    private static final Pattern MAX_SPEED = Pattern.compile("^(\\d+(?:\\.\\d+)?)\\s*(mph|km/h|kmh|kph)?$", Pattern.CASE_INSENSITIVE);
    public record Position(double lon, double lat) {}
    public record Road(String id, Map<String, Object> metadata, List<List<Position>> lines) {}
    public record Source(String sha256, List<Road> roads) {}
    private TrafficGenerator() {}

    public static Source read(byte[] bytes, ObjectMapper mapper) throws IOException {
        JsonNode root = mapper.readTree(bytes);
        if (!"FeatureCollection".equals(root.path("type").asText()) || !root.path("features").isArray())
            throw new IllegalArgumentException("Traffic source must be a GeoJSON FeatureCollection");
        List<Road> roads = new ArrayList<>(); Set<String> ids = new HashSet<>();
        for (JsonNode feature : root.path("features")) {
            String id = feature.path("properties").path("@id").asText("");
            if (id.isBlank() || !ids.add(id)) throw new IllegalArgumentException("Missing or duplicate OSM road ID: " + id);
            if (!"Feature".equals(feature.path("type").asText()) || !feature.path("properties").isObject())
                throw new IllegalArgumentException("Invalid feature: " + id);
            JsonNode geometry = feature.path("geometry"); List<List<Position>> lines = new ArrayList<>();
            switch (geometry.path("type").asText()) {
                case "LineString" -> lines.add(line(geometry.path("coordinates")));
                case "MultiLineString" -> {
                    if (!geometry.path("coordinates").isArray() || geometry.path("coordinates").isEmpty())
                        throw new IllegalArgumentException("Empty multi-line road: " + id);
                    for (JsonNode coordinates : geometry.path("coordinates")) lines.add(line(coordinates));
                }
                default -> throw new IllegalArgumentException("Unsupported road geometry: " + id);
            }
            roads.add(new Road(id, mapper.convertValue(feature.path("properties"), new TypeReference<>() {}), lines));
        }
        if (roads.isEmpty()) throw new IllegalArgumentException("Empty traffic source");
        try { return new Source(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)), roads); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private static List<Position> line(JsonNode coordinates) {
        if (!coordinates.isArray() || coordinates.size() < 2) throw new IllegalArgumentException("Invalid road line");
        List<Position> line = new ArrayList<>();
        for (JsonNode p : coordinates) {
            if (!p.isArray() || p.size() < 2 || !p.get(0).isNumber() || !p.get(1).isNumber())
                throw new IllegalArgumentException("Invalid longitude/latitude");
            double lon = p.get(0).asDouble(), lat = p.get(1).asDouble();
            if (!Double.isFinite(lon) || !Double.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90)
                throw new IllegalArgumentException("Invalid longitude/latitude range");
            line.add(new Position(lon, lat));
        }
        if (line.stream().allMatch(line.get(0)::equals)) throw new IllegalArgumentException("Zero-length road");
        return line;
    }
    private static String roadClass(Road road) { return String.valueOf(road.metadata().getOrDefault("highway", "")).replaceFirst("_link$", ""); }

    public static List<TrafficRecord> generate(Source source, String generatedAt) {
        List<Road> roads = source.roads(); Map<String, Set<Integer>> nodes = new LinkedHashMap<>();
        List<Set<Integer>> neighbours = new ArrayList<>();
        for (int i = 0; i < roads.size(); i++) {
            neighbours.add(new LinkedHashSet<>()); Road road = roads.get(i);
            String layer = String.valueOf(road.metadata().getOrDefault("layer", "0"));
            for (List<Position> line : road.lines()) for (Position p : line)
                nodes.computeIfAbsent(p.lon() + "," + p.lat() + "|" + layer, ignored -> new LinkedHashSet<>()).add(i);
        }
        for (Set<Integer> members : nodes.values()) for (int a : members) for (int b : members)
            if (a != b) neighbours.get(a).add(b);
        double[] initial = new double[roads.size()];
        for (int i = 0; i < roads.size(); i++)
            initial[i] = .65 * LOAD.getOrDefault(roadClass(roads.get(i)), .3) + .35 * Math.min(neighbours.get(i).size() / 6., 1.);
        double[] pressure = initial.clone();
        for (int iteration = 0; iteration < 8; iteration++) {
            double[] next = new double[roads.size()];
            for (int i = 0; i < roads.size(); i++) {
                Set<Integer> adjacent = neighbours.get(i); double sum = 0;
                for (int j : adjacent) sum += pressure[j];
                next[i] = adjacent.isEmpty() ? initial[i] : .45 * initial[i] + .55 * sum / adjacent.size();
            }
            pressure = next;
        }
        List<TrafficRecord> records = new ArrayList<>();
        for (String scenario : List.of("normal", "peak", "severe")) for (int i = 0; i < roads.size(); i++) {
            Road road = roads.get(i);
            double base = scenario.equals("normal") ? 4 : scenario.equals("peak") ? 18 : 44;
            double gain = scenario.equals("normal") ? 38 : scenario.equals("peak") ? 72 : 76;
            int score = (int) Math.max(0, Math.min(100, Math.round(base + gain * pressure[i])));
            String level = score <= 24 ? "Low" : score <= 49 ? "Moderate" : score <= 74 ? "High" : "Severe";
            Double baseline = SPEED.get(roadClass(road));
            if (baseline != null && String.valueOf(road.metadata().get("highway")).endsWith("_link")) baseline = Math.min(40, baseline);
            String basis = "assumed road-class baseline";
            var match = MAX_SPEED.matcher(String.valueOf(road.metadata().getOrDefault("maxspeed", "")).trim());
            if (match.matches()) {
                double tagged = Double.parseDouble(match.group(1)) * ("mph".equalsIgnoreCase(match.group(2)) ? 1.609344 : 1);
                if (tagged > 0 && tagged <= 160) { baseline = tagged; basis = "OSM maxspeed tag"; }
            }
            Integer speed = baseline == null ? null : (int) Math.round(baseline * Math.max(.05, 1 - score / 105.));
            records.add(new TrafficRecord(scenario + ":" + road.id(), road.id(), scenario, score, level, speed, baseline,
                    basis, true, source.sha256(), MODEL_VERSION, generatedAt, road.metadata()));
        }
        return records;
    }
}
