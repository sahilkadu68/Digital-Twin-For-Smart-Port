package com.smartport.digitaltwin.seed;

import com.smartport.digitaltwin.model.*;
import com.smartport.digitaltwin.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Centralized simulated data seeder.
 *
 * Generates a coherent, deterministic dataset and persists it to MongoDB
 * on application startup — ONLY if the database is empty.
 *
 * All generated data is SIMULATED. Not live JNPA operational data.
 *
 * Uses a deterministic pseudo-hash for repeatable generation so the
 * application shows the same data across restarts without duplication.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    @Value("${app.data.seed-on-startup:false}")
    private boolean seedOnStartup;

    private final ContainerRepository containerRepo;
    private final TerminalRepository terminalRepo;
    private final EquipmentRepository equipmentRepo;
    private final EnvironmentReadingRepository envRepo;
    private final VehicleRepository vehicleRepo;

    public DataSeeder(
            ContainerRepository containerRepo,
            TerminalRepository terminalRepo,
            EquipmentRepository equipmentRepo,
            EnvironmentReadingRepository envRepo,
            VehicleRepository vehicleRepo
    ) {
        this.containerRepo = containerRepo;
        this.terminalRepo = terminalRepo;
        this.equipmentRepo = equipmentRepo;
        this.envRepo = envRepo;
        this.vehicleRepo = vehicleRepo;
    }

    @Override
    public void run(String... args) {
        if (!seedOnStartup) {
            log.info("Data seeding disabled (app.data.seed-on-startup=false)");
            return;
        }

        log.info("Seeding simulated data into MongoDB...");
        if (terminalRepo.count() == 0) seedTerminals();
        if (containerRepo.count() == 0) seedContainers(0);
        if (equipmentRepo.count() == 0) seedEquipment();
        if (envRepo.count() == 0) seedEnvironmentReadings();
        if (vehicleRepo.count() == 0) seedVehicles();

        log.info("Seeding phase complete: {} containers, {} terminals, {} equipment, {} env readings, {} vehicles",
                containerRepo.count(), terminalRepo.count(), equipmentRepo.count(),
                envRepo.count(), vehicleRepo.count());
    }

    // ── Deterministic hash (same as frontend containers.ts) ─────────
    private static int h(int n) {
        int v = n ^ 0xdeadbeef;
        v = v ^ (v >>> 16);
        v = v * 0x45d9f3b;
        v = v ^ (v >>> 16);
        v = v * 0x45d9f3b;
        v = v ^ (v >>> 16);
        return v & 0x7fffffff; // unsigned
    }

    private static <T> T pick(T[] arr, int[] weights, int seed) {
        int total = 0;
        for (int w : weights) total += w;
        int target = h(seed) % total;
        int running = 0;
        for (int i = 0; i < arr.length; i++) {
            running += weights[i];
            if (target < running) return arr[i];
        }
        return arr[arr.length - 1];
    }

    private static <T> T pickUniform(T[] arr, int seed) {
        return arr[h(seed) % arr.length];
    }

    // ── Terminals ───────────────────────────────────────────────────
    private void seedTerminals() {
        List<Terminal> terminals = List.of(
                makeTerminal("NSIGT", "Nhava Sheva (India) Gateway Terminal", "DP World", 18925, 1, 330, 0.8, 27.0, 16, 4),
                makeTerminal("NSICT", "Nhava Sheva International Container Terminal", "DP World", 22638, 2, 600, 1.2, 25.84, 28, 8),
                makeTerminal("NSFT", "Nhava Sheva Free Port Terminal", "J. M. Baxi / CMA Terminals JV", 23433, 2, 680, 1.8, 54.74, 27, 6),
                makeTerminal("APMT", "Gateway Terminals India / APM Terminals Mumbai", "APM Terminals / CONCOR", 34354, 2, 712, 1.8, 54.57, 40, 11),
                makeTerminal("BMCT", "Bharat Mumbai Container Terminal", "PSA / BMCT", 78000, 6, 2000, 4.8, 200.0, 72, 24),
                makeTerminal("NSDT", "Nhava Sheva Distribution Terminal", "NSDT", 2310, 1, 330, null, null, null, null)
        );
        terminalRepo.saveAll(terminals);
    }

    private Terminal makeTerminal(String code, String name, String operator, int yardCap, int berths, int quay,
                                   Double capMteu, Double areaHa, Integer rtgc, Integer rmqc) {
        Terminal t = new Terminal();
        t.setCode(code);
        t.setName(name);
        t.setOperator(operator);
        t.setYardCapacity(yardCap);
        t.setBerths(berths);
        t.setQuayLength(quay);
        t.setCapacityMillionTeu(capMteu);
        t.setYardAreaHa(areaHa);
        t.setRtgcCount(rtgc);
        t.setRmqcCount(rmqc);
        return t;
    }

    // ── Containers ──────────────────────────────────────────────────
    private void seedContainers(long currentCount) {
        String[][] shippingLines = {
                {"MSCU", "MSC"}, {"MAEU", "Maersk"}, {"HLCU", "Hapag-Lloyd"},
                {"CMAU", "CMA CGM"}, {"COSU", "COSCO"}, {"EVGU", "Evergreen"},
                {"YMLU", "Yang Ming"}, {"OOLU", "OOCL"}, {"ZIMU", "ZIM"},
                {"APLU", "APL"}, {"PILU", "PIL"}, {"ONEY", "ONE"}
        };
        String[] types = {"20ft", "40ft", "40ft-HC", "45ft-HC"};
        int[] typeW = {20, 40, 30, 10};

        String[] statuses = {"import", "export", "transshipment", "loaded", "empty",
                "customs-hold", "inspection", "gate-in", "gate-out"};
        int[] statusW = {32, 28, 14, 6, 8, 4, 2, 3, 3};

        String[] cargoTypes = {"general", "refrigerated", "bulk", "hazardous", "liquid", "ro-ro"};
        int[] cargoW = {45, 15, 15, 12, 8, 5};

        String[] domestic = {"Nhava Sheva", "Mumbai Port", "Mundra Port", "Kandla",
                "Chennai Port", "Cochin Port", "Kolkata", "Vizag Port",
                "Tuticorin", "Pune ICD", "Delhi ICD", "Bengaluru ICD",
                "Ahmedabad ICD", "Hyderabad ICD"};

        String[] international = {"Rotterdam", "Hamburg", "Singapore", "Dubai (Jebel Ali)",
                "Shanghai", "Los Angeles", "Long Beach", "Felixstowe",
                "Antwerp", "Genoa", "Valencia", "Busan", "Hong Kong",
                "Colombo", "Port Klang", "Kaohsiung", "Tokyo", "Osaka",
                "Tanjung Pelepas", "Piraeus", "Barcelona", "Algeciras",
                "Ningbo", "Guangzhou", "Tianjin", "Manila"};

        String[] arrivalDates = {
                "2024-05-01", "2024-05-05", "2024-05-10", "2024-05-15", "2024-05-20",
                "2024-05-25", "2024-06-01", "2024-06-05", "2024-06-08", "2024-06-10",
                "2024-06-12", "2024-06-14", "2024-06-15", "2024-06-16", "2024-06-17",
                "2024-06-18", "2024-06-19", "2024-06-20", "2024-06-21", "2024-06-22",
                "2024-06-23", "2024-06-24", "2024-06-25", "2024-06-26", "2024-06-27",
                "2024-06-28", "2024-06-29", "2024-06-30", "2024-07-01", "2024-07-02"
        };

        // Terminal configs — mirrors the frontend containers.ts generator
        // Format: {TerminalCode, AdditionalContainersToSeed, Prefix, Blocks, YardId, Rows, Cols}
        Object[][] termConfigs = {
                {"NSFT", 1382, "FT", 12, "FT-YARD", 6, 12},
                {"NSICT", 2457, "IC", 12, "IC-YARD", 8, 16},
                {"NSIGT", 1075, "IG", 6, "IG-YARD", 8, 14},
                {"APMT", 1612, "AP", 12, "AP-YARD", 6, 14},
                {"BMCT", 4500, "BM", 48, "BM-YARD", 8, 12},
                {"NSDT", 384, "DT", 4, "DT-YARD", 6, 10}
        };

        List<Container> containers = new ArrayList<>();
        int globalId = 0;
        int seed = 100;

        for (Object[] tc : termConfigs) {
            String code = (String) tc[0];
            int count = (int) tc[1];
            String blockPrefix = (String) tc[2];
            int blockCount = (int) tc[3];
            String yardId = (String) tc[4];
            int rows = (int) tc[5];
            int cols = (int) tc[6];

            for (int i = 0; i < count; i++) {
                seed++;
                globalId++;

                String[] sl = pickUniform(shippingLines, seed);
                String status = pick(statuses, statusW, seed + 1);
                String type = pick(types, typeW, seed + 2);
                String cargoType = pick(cargoTypes, cargoW, seed + 3);
                String arrivalDate = pickUniform(arrivalDates, seed + 4);

                // Weight
                double weight = 0;
                if (!"empty".equals(status) && !"gate-out".equals(status)) {
                    int[][] bases = {{12000,28000},{8000,22000},{15000,32000},{6000,18000},{14000,30000},{10000,24000}};
                    int cIdx = java.util.Arrays.asList(cargoTypes).indexOf(cargoType);
                    int lo = bases[cIdx][0], hi = bases[cIdx][1];
                    weight = lo + (h(lo + hi) % (hi - lo));
                }

                // Origin/destination based on status
                String origin, destination;
                if ("import".equals(status) || "gate-in".equals(status) || "customs-hold".equals(status) || "inspection".equals(status)) {
                    origin = pickUniform(international, seed + 5);
                    destination = pickUniform(domestic, seed + 6);
                } else if ("export".equals(status) || "gate-out".equals(status)) {
                    origin = pickUniform(domestic, seed + 7);
                    destination = pickUniform(international, seed + 8);
                } else {
                    origin = pickUniform(international, seed + 9);
                    destination = pickUniform(international, seed + 10);
                }

                // Spatial position - randomly distribute within the block instead of sequential stacking to look more organic
                int blockNum = (h(seed + 11) % blockCount) + 1;
                String block = blockPrefix + "-" + String.format("%02d", blockNum);
                int row = (h(seed + 12) % rows) + 1;
                int column = (h(seed + 13) % cols) + 1;
                int level = (h(seed + 14) % 4) + 1;

                // Container number
                int numPart = 1000000 + (h(seed + 10) % 9000000);
                String containerNumber = sl[0] + numPart;

                Container c = new Container();
                c.setId("c" + String.format("%06d", currentCount + globalId));
                c.setContainerNumber(containerNumber);
                c.setStatus(status);
                c.setType(type);
                c.setShippingLine(sl[1]);
                c.setWeight(weight);
                c.setCargoType(cargoType);
                c.setOrigin(origin);
                c.setDestination(destination);
                c.setArrivalDate(arrivalDate);
                c.setTerminal(code);
                c.setYard(yardId);
                c.setBlock(block);
                c.setRow(row);
                c.setColumn(column);
                c.setLevel(level);
                c.setSimulated(true);

                containers.add(c);
            }
        }

        containerRepo.saveAll(containers);
        log.info("Seeded {} containers across {} terminals", containers.size(), termConfigs.length);
    }

    // ── Equipment ───────────────────────────────────────────────────
    private void seedEquipment() {
        // Generate RTGs for each terminal based on the terminal's reference rtgcCount
        List<Terminal> terminals = terminalRepo.findAll();
        List<Equipment> equipment = new ArrayList<>();
        int id = 0;

        for (Terminal t : terminals) {
            Integer rtgCount = t.getRtgcCount();
            if (rtgCount == null || rtgCount == 0) continue;

            // Seed a representative subset (up to 6 per terminal for performance)
            int toSeed = Math.min(rtgCount, 6);
            String[] eqStatuses = {"active", "active", "active", "idle", "idle", "maintenance"};

            for (int i = 0; i < toSeed; i++) {
                id++;
                Equipment e = new Equipment();
                e.setEquipmentId("RTG-" + String.format("%03d", id));
                e.setType("rtg");
                e.setTerminal(t.getCode());
                e.setBlock(t.getCode().substring(0, 2) + "-" + String.format("%02d", (i % 3) + 1));
                e.setStatus(eqStatuses[i % eqStatuses.length]);
                e.setUtilization("maintenance".equals(e.getStatus()) ? 0 : 50 + h(id) % 40);
                e.setLiftsPerHour("maintenance".equals(e.getStatus()) ? 0 : 15 + h(id + 100) % 15);
                e.setSimulated(true);
                equipment.add(e);
            }
        }

        equipmentRepo.saveAll(equipment);
    }

    // ── Environment readings ────────────────────────────────────────
    private void seedEnvironmentReadings() {
        double[][] dayData = {
                // aqi, pm25, pm10, so2, no2, co, temp, humidity, wind, vis, noise
                {118, 44.2,  89.4, 16.1, 38.4, 1.0, 29.8, 82, 12, 6.1, 65},
                {127, 51.1,  98.7, 17.3, 40.1, 1.1, 30.5, 80, 13, 5.8, 66},
                {135, 54.8, 104.2, 18.0, 41.8, 1.1, 31.0, 79, 11, 5.5, 67},
                {144, 59.3, 114.8, 19.2, 43.5, 1.3, 31.8, 77, 10, 5.0, 69},
                {138, 56.0, 108.5, 18.5, 42.0, 1.2, 31.2, 78, 14, 5.3, 68},
                {151, 62.4, 119.3, 20.1, 44.8, 1.4, 32.0, 76, 9, 4.8, 70},
                {142, 58.4, 112.6, 18.2, 42.7, 1.2, 31.4, 78, 14, 5.2, 68}
        };
        String[] dates = {"2024-06-22", "2024-06-23", "2024-06-24", "2024-06-25", "2024-06-26", "2024-06-27", "2024-06-28"};

        List<EnvironmentReading> readings = new ArrayList<>();
        for (int i = 0; i < dates.length; i++) {
            double[] d = dayData[i];
            EnvironmentReading r = new EnvironmentReading();
            r.setTimestamp(dates[i] + "T08:30:00+05:30");
            r.setLocation("Nhava Sheva, Navi Mumbai");
            r.setAqi(d[0]);
            r.setAqiCondition(d[0] <= 50 ? "good" : d[0] <= 100 ? "moderate" : d[0] <= 200 ? "poor" : "critical");
            r.setPm25(d[1]);
            r.setPm25Condition(d[1] <= 30 ? "good" : d[1] <= 60 ? "moderate" : "poor");
            r.setPm10(d[2]);
            r.setPm10Condition(d[2] <= 50 ? "good" : d[2] <= 100 ? "moderate" : "poor");
            r.setSo2(d[3]);
            r.setNo2(d[4]);
            r.setCo(d[5]);
            r.setTemperature(d[6]);
            r.setHumidity(d[7]);
            r.setWindSpeed(d[8]);
            r.setVisibility(d[9]);
            r.setNoise(d[10]);
            r.setSimulated(true);
            readings.add(r);
        }
        envRepo.saveAll(readings);
    }

    // ── Vehicles ────────────────────────────────────────────────────
    private void seedVehicles() {
        // Simulated vehicles for Port Map traffic visualization
        Object[][] vehicleData = {
                {"TRK-001", "truck", "moving", 18.9510, 72.9488, "Gate A", "Yard A"},
                {"TRK-002", "truck", "queued", 18.9512, 72.9490, "Gate A", "Yard A"},
                {"TRK-003", "truck", "moving", 18.9508, 72.9486, "Gate A", "Berth 1"},
                {"TRK-004", "truck", "idle",   18.9479, 72.9514, "Yard A", "Gate A"},
                {"TRK-005", "truck", "moving", 18.9480, 72.9516, "Yard A", "Berth 1"},
                {"TRK-006", "truck", "moving", 18.9459, 72.9544, "Yard B", "Gate A"},
                {"TRK-007", "trailer", "idle",   18.9460, 72.9546, "Yard B", "Yard A"},
                {"TRK-008", "truck", "moving", 18.9514, 72.9571, "Berth 1", "Yard A"},
                {"TRK-009", "truck", "queued", 18.9530, 72.9522, "North Access Road", "Gate A"},
                {"TRK-010", "truck", "moving", 18.9528, 72.9520, "North Access Road", "Yard B"},
                // Additional trucks to match the zone truck counts from the frontend
                {"TRK-011", "truck", "moving", 18.9511, 72.9489, "Gate A", "Yard B"},
                {"TRK-012", "truck", "queued", 18.9509, 72.9487, "Gate A", "Berth 1"},
                {"TRK-013", "truck", "moving", 18.9513, 72.9491, "Gate A", "Yard A"},
                {"TRK-014", "truck", "moving", 18.9481, 72.9515, "Yard A", "Gate A"},
                {"TRK-015", "truck", "idle",   18.9478, 72.9513, "Yard A", "Berth 1"},
                {"TRK-016", "truck", "moving", 18.9461, 72.9545, "Yard B", "Yard A"},
                {"TRK-017", "truck", "moving", 18.9515, 72.9572, "Berth 1", "Yard B"},
                {"TRK-018", "truck", "queued", 18.9529, 72.9521, "North Access Road", "Gate A"},
                {"TRK-019", "truck", "moving", 18.9531, 72.9523, "North Access Road", "Yard A"},
                {"TRK-020", "truck", "moving", 18.9527, 72.9519, "North Access Road", "Gate A"},
        };

        List<Vehicle> vehicles = new ArrayList<>();
        for (Object[] vd : vehicleData) {
            Vehicle v = new Vehicle();
            v.setVehicleId((String) vd[0]);
            v.setType((String) vd[1]);
            v.setStatus((String) vd[2]);
            v.setLatitude((double) vd[3]);
            v.setLongitude((double) vd[4]);
            v.setZone((String) vd[5]);
            v.setDestination((String) vd[6]);
            v.setLastUpdated("2024-06-28T08:30:00+05:30");
            v.setSimulated(true);
            vehicles.add(v);
        }
        vehicleRepo.saveAll(vehicles);
    }
}
