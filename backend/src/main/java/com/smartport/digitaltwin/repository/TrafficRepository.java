package com.smartport.digitaltwin.repository;

import com.smartport.digitaltwin.model.TrafficRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface TrafficRepository extends MongoRepository<TrafficRecord, String> {
    List<TrafficRecord> findByScenarioOrderByRoadIdAsc(String scenario);
    Optional<TrafficRecord> findByScenarioAndRoadId(String scenario, String roadId);
}
