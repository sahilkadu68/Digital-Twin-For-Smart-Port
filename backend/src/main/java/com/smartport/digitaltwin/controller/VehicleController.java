package com.smartport.digitaltwin.controller;

import com.smartport.digitaltwin.model.Vehicle;
import com.smartport.digitaltwin.repository.VehicleRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/vehicles")
public class VehicleController {

    private final VehicleRepository vehicleRepo;

    public VehicleController(VehicleRepository vehicleRepo) {
        this.vehicleRepo = vehicleRepo;
    }

    @GetMapping
    public List<Vehicle> getVehicles(@RequestParam(required = false) String zone) {
        if (zone != null && !zone.isEmpty()) {
            return vehicleRepo.findByZone(zone);
        }
        return vehicleRepo.findAll();
    }
}
