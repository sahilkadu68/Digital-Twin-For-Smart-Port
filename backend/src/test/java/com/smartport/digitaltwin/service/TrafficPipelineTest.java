package com.smartport.digitaltwin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartport.digitaltwin.controller.TrafficController;
import com.smartport.digitaltwin.repository.TrafficRepository;
import com.smartport.digitaltwin.seed.TrafficGenerator;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TrafficPipelineTest {
    private TrafficGenerator.Source source() throws Exception {
        return TrafficGenerator.read(Files.readAllBytes(Path.of("../jnpa_roads_candidate.geojson")), new ObjectMapper());
    }
    @Test void completeSourceProducesStableUniqueRecordsForAllScenarios() throws Exception {
        var source = source(); var records = TrafficGenerator.generate(source, "fixed-test-time");
        assertEquals("4f115d3293cc7dca3d702f142d8236e044d1106b56b0fef4479a8bdd7724fbcb", source.sha256());
        assertEquals(2893, source.roads().size()); assertEquals(8679, records.size());
        assertEquals(records, TrafficGenerator.generate(source, "fixed-test-time"));
        assertEquals(records.size(), records.stream().map(r -> r.id()).distinct().count());
        for (int i = 0; i < 2893; i++) {
            var n = records.get(i); var p = records.get(i + 2893); var s = records.get(i + 5786);
            assertTrue(n.score() <= p.score() && p.score() <= s.score());
            assertTrue(n.score() >= 0 && s.score() <= 100); assertTrue(n.simulated());
            assertEquals(source.roads().get(i).metadata(), n.roadMetadata());
            if (n.estimatedSpeedKmh() != null) assertTrue(n.estimatedSpeedKmh() >= p.estimatedSpeedKmh() && p.estimatedSpeedKmh() >= s.estimatedSpeedKmh());
        }
    }
    @Test void exactSharedVerticesAreUsedWithoutSnappingOrCrossLayerJoins() {
        var a = new TrafficGenerator.Road("a", Map.of("highway", "service"), List.of(List.of(new TrafficGenerator.Position(0, 0), new TrafficGenerator.Position(1, 0))));
        var b = new TrafficGenerator.Road("b", Map.of("highway", "service"), List.of(List.of(new TrafficGenerator.Position(1, 0), new TrafficGenerator.Position(1, 1))));
        var bridge = new TrafficGenerator.Road("c", Map.of("highway", "service", "layer", "1"), b.lines());
        var nearby = new TrafficGenerator.Road("d", b.metadata(), List.of(List.of(new TrafficGenerator.Position(1, .00000001), new TrafficGenerator.Position(1, 1.00000001))));
        int isolated = TrafficGenerator.generate(new TrafficGenerator.Source("test", List.of(a)), "test").get(0).score();
        assertTrue(TrafficGenerator.generate(new TrafficGenerator.Source("test", List.of(a, b)), "test").get(0).score() > isolated);
        assertEquals(isolated, TrafficGenerator.generate(new TrafficGenerator.Source("test", List.of(a, bridge, nearby)), "test").get(0).score());
    }
    @Test void malformedOrDuplicateSourceFailsBeforeSeeding() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> TrafficGenerator.read("{\"type\":\"FeatureCollection\",\"features\":[]}".getBytes(), new ObjectMapper()));
        var mapper = new ObjectMapper();
        var root = mapper.readTree(Files.readAllBytes(Path.of("../jnpa_roads_candidate.geojson")));
        ((com.fasterxml.jackson.databind.node.ArrayNode) root.get("features")).add(root.get("features").get(0));
        assertThrows(IllegalArgumentException.class, () -> TrafficGenerator.read(mapper.writeValueAsBytes(root), mapper));
    }
    @Test void apiValidatesScenarioAndHandlesEmptyAndMissingRoads() throws Exception {
        var repo = mock(TrafficRepository.class);
        when(repo.findByScenarioOrderByRoadIdAsc("normal")).thenReturn(List.of());
        when(repo.findByScenarioAndRoadId("normal", "way/missing")).thenReturn(Optional.empty());
        var mvc = MockMvcBuilders.standaloneSetup(new TrafficController(new TrafficService(repo))).build();
        mvc.perform(get("/api/v1/traffic")).andExpect(status().isOk()).andExpect(jsonPath("$.simulated").value(true)).andExpect(jsonPath("$.records").isEmpty());
        mvc.perform(get("/api/v1/traffic").param("scenario", "invalid")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/traffic/road").param("roadId", "way/missing")).andExpect(status().isNotFound());
        verify(repo, never()).deleteAll();
    }
}
