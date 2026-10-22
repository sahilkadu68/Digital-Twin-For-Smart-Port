package com.smartport.digitaltwin.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.Map;

/** Persisted synthetic snapshot, never a measured traffic observation. */
@Document(collection = "simulated_traffic")
public record TrafficRecord(
        @Id String id, String roadId, String scenario, int score, String level,
        Integer estimatedSpeedKmh, Double baselineSpeedKmh, String speedBasis,
        boolean simulated, String sourceSha256, String modelVersion,
        String generatedAt, Map<String, Object> roadMetadata) {}
