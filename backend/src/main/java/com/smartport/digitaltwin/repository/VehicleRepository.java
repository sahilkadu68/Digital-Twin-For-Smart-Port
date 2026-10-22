package com.smartport.digitaltwin.repository;

import com.smartport.digitaltwin.model.Vehicle;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface VehicleRepository extends MongoRepository<Vehicle, String> {
    List<Vehicle> findByZone(String zone);
    List<Vehicle> findByStatus(String status);
}
