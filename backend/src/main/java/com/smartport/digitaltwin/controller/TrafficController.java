package com.smartport.digitaltwin.controller;

import com.smartport.digitaltwin.model.TrafficRecord;
import com.smartport.digitaltwin.service.TrafficService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/traffic")
public class TrafficController {
    private final TrafficService service;
    public TrafficController(TrafficService service) { this.service = service; }
    @GetMapping
    public TrafficService.Snapshot snapshot(@RequestParam(defaultValue = "normal") String scenario) {
        return service.snapshot(scenario);
    }
    // Query parameter preserves OSM identifiers such as way/45096112 without path-slash ambiguity.
    @GetMapping("/road")
    public TrafficRecord road(@RequestParam String roadId, @RequestParam(defaultValue = "normal") String scenario) {
        return service.road(scenario, roadId);
    }
}
