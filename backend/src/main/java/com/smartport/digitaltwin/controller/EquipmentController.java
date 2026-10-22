package com.smartport.digitaltwin.controller;

import com.smartport.digitaltwin.model.Equipment;
import com.smartport.digitaltwin.repository.EquipmentRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/equipment")
public class EquipmentController {

    private final EquipmentRepository equipmentRepo;

    public EquipmentController(EquipmentRepository equipmentRepo) {
        this.equipmentRepo = equipmentRepo;
    }

    @GetMapping
    public List<Equipment> getEquipment(@RequestParam(required = false) String terminal) {
        if (terminal != null && !terminal.isEmpty()) {
            return equipmentRepo.findByTerminal(terminal);
        }
        return equipmentRepo.findAll();
    }
}
