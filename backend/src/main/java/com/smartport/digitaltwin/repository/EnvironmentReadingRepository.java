package com.smartport.digitaltwin.repository;

import com.smartport.digitaltwin.model.EnvironmentReading;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface EnvironmentReadingRepository extends MongoRepository<EnvironmentReading, String> {
    List<EnvironmentReading> findAllByOrderByTimestampDesc();
}
