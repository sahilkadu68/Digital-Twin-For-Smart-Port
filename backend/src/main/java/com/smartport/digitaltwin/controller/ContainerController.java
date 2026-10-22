package com.smartport.digitaltwin.controller;

import com.smartport.digitaltwin.dto.YardStatsDto;
import com.smartport.digitaltwin.model.Container;
import com.smartport.digitaltwin.service.ContainerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/containers")
public class ContainerController {

    private final ContainerService containerService;

    public ContainerController(ContainerService containerService) {
        this.containerService = containerService;
    }

    /** GET /api/v1/containers — filtered list */
    @GetMapping
    public List<Container> getContainers(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String terminal,
            @RequestParam(required = false) String search
    ) {
        return containerService.getFilteredContainers(status, type, terminal, search);
    }

    /** GET /api/v1/containers/{id} — single container by ID */
    @GetMapping("/{id}")
    public ResponseEntity<Container> getContainerById(@PathVariable String id) {
        return containerService.getContainerById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** GET /api/v1/containers/stats — yard-wide statistics */
    @GetMapping("/stats")
    public YardStatsDto getYardStats() {
        return containerService.getYardStats();
    }
}
