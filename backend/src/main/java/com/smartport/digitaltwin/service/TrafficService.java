package com.smartport.digitaltwin.service;

import com.smartport.digitaltwin.model.TrafficRecord;
import com.smartport.digitaltwin.repository.TrafficRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Set;

@Service
public class TrafficService {
    public static final Set<String> SCENARIOS = Set.of("normal", "peak", "severe");
    private final TrafficRepository repository;
    public TrafficService(TrafficRepository repository) { this.repository = repository; }
    public record Snapshot(String scenario, boolean simulated, List<TrafficRecord> records) {}
    private void validate(String scenario) {
        if (!SCENARIOS.contains(scenario))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scenario must be normal, peak or severe");
    }
    public Snapshot snapshot(String scenario) {
        validate(scenario);
        return new Snapshot(scenario, true, repository.findByScenarioOrderByRoadIdAsc(scenario));
    }
    public TrafficRecord road(String scenario, String roadId) {
        validate(scenario);
        return repository.findByScenarioAndRoadId(scenario, roadId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Traffic road not found"));
    }
}
