package com.smartport.digitaltwin.repository;

import com.smartport.digitaltwin.model.Equipment;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface EquipmentRepository extends MongoRepository<Equipment, String> {
    List<Equipment> findByTerminal(String terminal);
    List<Equipment> findByStatus(String status);
}
