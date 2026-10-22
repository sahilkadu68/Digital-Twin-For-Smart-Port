package com.smartport.digitaltwin.service;

import com.smartport.digitaltwin.dto.YardStatsDto;
import com.smartport.digitaltwin.model.Container;
import com.smartport.digitaltwin.model.Terminal;
import com.smartport.digitaltwin.repository.ContainerRepository;
import com.smartport.digitaltwin.repository.TerminalRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ContainerService {

    private static final List<String> ALL_STATUSES = List.of(
            "import", "export", "transshipment", "gate-in", "gate-out",
            "customs-hold", "inspection", "empty", "loaded"
    );

    private final ContainerRepository containerRepo;
    private final TerminalRepository terminalRepo;

    public ContainerService(ContainerRepository containerRepo, TerminalRepository terminalRepo) {
        this.containerRepo = containerRepo;
        this.terminalRepo = terminalRepo;
    }

    public List<Container> getAllContainers() {
        return containerRepo.findAll();
    }

    public Optional<Container> getContainerById(String id) {
        return containerRepo.findById(id);
    }

    public Optional<Container> getContainerByNumber(String number) {
        return containerRepo.findByContainerNumber(number);
    }

    public List<Container> getContainersByTerminal(String terminal) {
        return containerRepo.findByTerminal(terminal);
    }

    /**
     * Filtered container search — mirrors the frontend ContainerFilter interface.
     */
    public List<Container> getFilteredContainers(String status, String type, String terminal, String searchQuery) {
        List<Container> results = containerRepo.findAll().stream()
                .filter(c -> InventoryRules.matches(c.getTerminal(), terminal))
                .filter(c -> InventoryRules.matches(c.getStatus(), status))
                .filter(c -> InventoryRules.matches(c.getType(), type))
                .filter(c -> searchQuery == null || searchQuery.isBlank() ||
                    java.util.stream.Stream.of(c.getContainerNumber(), c.getShippingLine(), c.getDestination(), c.getOrigin(), c.getTerminal())
                        .anyMatch(v -> v != null && v.toLowerCase(Locale.ROOT).contains(searchQuery.trim().toLowerCase(Locale.ROOT))))
                .collect(Collectors.toList());

        return results;
    }

    /**
     * Compute yard statistics from the actual container collection.
     * Derived — not hardcoded.
     */
    public YardStatsDto getYardStats() {
        List<Container> allContainers = containerRepo.findAll();
        List<Terminal> terminals = terminalRepo.findAll();

        long total = allContainers.size();
        long totalCapacity = terminals.stream().mapToLong(Terminal::getYardCapacity).sum();

        // Count by status
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (String s : ALL_STATUSES) {
            byStatus.put(s, 0L);
        }
        for (Container c : allContainers) {
            byStatus.merge(InventoryRules.key(c.getStatus()).toLowerCase(Locale.ROOT), 1L, Long::sum);
        }

        long active = allContainers.stream().filter(InventoryRules::occupiesYard).count();

        double utilization = totalCapacity > 0
                ? Math.round((double) active / totalCapacity * 1000.0) / 10.0
                : 0;

        return new YardStatsDto(total, totalCapacity, utilization, byStatus);
    }
}
