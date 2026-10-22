package com.smartport.digitaltwin.service;
import com.smartport.digitaltwin.dto.DashboardSummaryDto;
import com.smartport.digitaltwin.repository.ContainerRepository;
import org.springframework.stereotype.Service;
import java.util.*;
@Service
public class DashboardService {
    private final ContainerRepository containers;
    public DashboardService(ContainerRepository containers) { this.containers = containers; }
    public DashboardSummaryDto getSummary() {
        var all = containers.findAll();
        DashboardSummaryDto dto = new DashboardSummaryDto();
        dto.setImportPercent(percent(all.stream().filter(c -> "import".equals(InventoryRules.trade(c))).count(), all.size()));
        dto.setExportPercent(percent(all.stream().filter(c -> "export".equals(InventoryRules.trade(c))).count(), all.size()));
        dto.setTransshipmentPercent(percent(all.stream().filter(c -> "transshipment".equals(InventoryRules.trade(c))).count(), all.size()));
        return dto;
    }
    private double percent(long count, long total) { return total == 0 ? 0 : Math.round(count * 1000.0 / total) / 10.0; }
    /** No recorded events exist; inventory arrival dates cannot establish throughput. */
    public List<Map<String, Object>> getThroughputTrend() { return List.of(); }
}
