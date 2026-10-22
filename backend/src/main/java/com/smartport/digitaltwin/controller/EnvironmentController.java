package com.smartport.digitaltwin.controller;

import com.smartport.digitaltwin.dto.EnvironmentSnapshotDto;
import com.smartport.digitaltwin.dto.TrendPointDto;
import com.smartport.digitaltwin.service.EnvironmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/environment")
public class EnvironmentController {

    private final EnvironmentService environmentService;

    public EnvironmentController(EnvironmentService environmentService) {
        this.environmentService = environmentService;
    }

    /** GET /api/v1/environment/current — latest sensor snapshot */
    @GetMapping("/current")
    public ResponseEntity<EnvironmentSnapshotDto> getCurrentSnapshot() {
        EnvironmentSnapshotDto snapshot = environmentService.getLatestSnapshot();
        if (snapshot == null) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(snapshot);
    }

    /** GET /api/v1/environment/trend — 7-day AQI/PM trend */
    @GetMapping("/trend")
    public List<TrendPointDto> getAqiTrend() {
        return environmentService.getAqiTrend();
    }
}
