package com.smartport.digitaltwin.service;

import com.smartport.digitaltwin.dto.ReportSummaryDto;
import com.smartport.digitaltwin.dto.ReportSummaryDto.TrendPoint;
import com.smartport.digitaltwin.model.Container;
import com.smartport.digitaltwin.repository.ContainerRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ReportService {

    private final ContainerRepository containerRepo;

    public ReportService(ContainerRepository containerRepo) {
        this.containerRepo = containerRepo;
    }

    /**
     * Build a report summary from the existing container collection.
     *
     * @param terminal   "ALL" or a terminal code like "NSICT"
     * @param trade      "ALL", "import", "export", or "transshipment"
     * @param startDate  ISO date string (yyyy-MM-dd), nullable / empty = no lower bound
     * @param endDate    ISO date string (yyyy-MM-dd), nullable / empty = no upper bound
     */
    public ReportSummaryDto buildSummary(String terminal, String trade,
                                         String startDate, String endDate) {

        // ── 1. Fetch and filter containers ─────────────────────────────
        LocalDate start = InventoryRules.requestDate(startDate);
        LocalDate end = InventoryRules.requestDate(endDate);
        InventoryRules.validateRange(start, end);
        if (!InventoryRules.matches("all", trade) && !Set.of("import", "export", "transshipment", "unknown").contains(trade.trim().toLowerCase(Locale.ROOT)))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Unsupported trade category");
        List<Container> all = containerRepo.findAll();

        List<Container> filtered = all.stream()
                .filter(c -> InventoryRules.matches(c.getTerminal(), terminal))
                .filter(c -> InventoryRules.matches(InventoryRules.trade(c), trade))
                .filter(c -> InventoryRules.inRange(c, start, end))
                .collect(Collectors.toList());

        // ── 2. Compute period label ────────────────────────────────────
        String periodLabel = buildPeriodLabel(startDate, endDate, filtered);

        // ── 3. Aggregate top-level metrics ─────────────────────────────
        long totalContainers = filtered.size();
        long totalTeus = filtered.stream().mapToLong(c -> teuFactor(c.getType())).sum();
        double totalWeightTonnes = filtered.stream()
                .mapToDouble(c -> c.getWeight() / 1000.0)
                .sum();
        totalWeightTonnes = Math.round(totalWeightTonnes * 10.0) / 10.0;

        // ── 4. Trade breakdown ─────────────────────────────────────────
        long importCount       = count(filtered, "import");
        long exportCount       = count(filtered, "export");
        long transshipmentCount= count(filtered, "transshipment");
        long otherCount        = totalContainers - importCount - exportCount - transshipmentCount;

        // ── 5. Terminal breakdown ──────────────────────────────────────
        Map<String, Long> byTerminal = filtered.stream()
                .collect(Collectors.groupingBy(c -> InventoryRules.key(c.getTerminal()), Collectors.counting()));

        // ── 6. Status breakdown ────────────────────────────────────────
        Map<String, Long> byStatus = filtered.stream()
                .collect(Collectors.groupingBy(c -> InventoryRules.key(c.getStatus()), Collectors.counting()));

        // ── 7. Type breakdown ──────────────────────────────────────────
        Map<String, Long> byType = filtered.stream()
                .collect(Collectors.groupingBy(c -> InventoryRules.key(c.getType()), Collectors.counting()));

        // ── 8. Cargo type breakdown ────────────────────────────────────
        Map<String, Long> byCargo = filtered.stream()
                .collect(Collectors.groupingBy(c -> InventoryRules.key(c.getCargoType()), Collectors.counting()));

        // ── 9. Arrival-date trend (group by date, sorted ascending) ───
        Map<String, Long> byDate = filtered.stream()
                .filter(c -> InventoryRules.arrivalDate(c.getArrivalDate()).isPresent())
                .collect(Collectors.groupingBy(c -> InventoryRules.arrivalDate(c.getArrivalDate()).orElseThrow().toString(), Collectors.counting()));

        List<TrendPoint> arrivalTrend = byDate.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new TrendPoint(e.getKey(), e.getValue()))
                .collect(Collectors.toList());

        // ── 10. Assemble DTO ───────────────────────────────────────────
        ReportSummaryDto dto = new ReportSummaryDto();
        dto.setGeneratedAt(Instant.now().toString());
        dto.setReportPeriod(periodLabel);
        dto.setTerminalFilter(terminal == null || terminal.isBlank() ? "ALL" : terminal.toUpperCase());
        dto.setTradeFilter(trade == null || trade.isBlank() ? "ALL" : trade.toLowerCase());
        dto.setTotalContainers(totalContainers);
        dto.setTotalTeus(totalTeus);
        dto.setTotalWeightTonnes(totalWeightTonnes);
        dto.setImportCount(importCount);
        dto.setExportCount(exportCount);
        dto.setTransshipmentCount(transshipmentCount);
        dto.setOtherCount(otherCount);
        dto.setByTerminal(sortedByValue(byTerminal));
        dto.setByStatus(byStatus);
        dto.setByType(byType);
        dto.setByCargo(sortedByValue(byCargo));
        dto.setArrivalTrend(arrivalTrend);
        dto.setContainsSimulatedData(filtered.stream().anyMatch(Container::isSimulated));
        return dto;
    }

    // ── helpers ────────────────────────────────────────────────────────

    private long count(List<Container> list, String status) {
        return list.stream().filter(c -> InventoryRules.trade(c).equalsIgnoreCase(status)).count();
    }

    private int teuFactor(String type) {
        if (type == null) return 1;
        return type.startsWith("20") ? 1 : 2;
    }

    private String buildPeriodLabel(String startDate, String endDate, List<Container> filtered) {
        if ((startDate == null || startDate.isBlank()) && (endDate == null || endDate.isBlank())) {
            // derive range from data
            Optional<String> minDate = filtered.stream()
                    .map(c -> InventoryRules.arrivalDate(c.getArrivalDate()).map(LocalDate::toString).orElse(null))
                    .filter(d -> d != null && !d.isBlank())
                    .min(Comparator.naturalOrder());
            Optional<String> maxDate = filtered.stream()
                    .map(c -> InventoryRules.arrivalDate(c.getArrivalDate()).map(LocalDate::toString).orElse(null))
                    .filter(d -> d != null && !d.isBlank())
                    .max(Comparator.naturalOrder());
            return minDate.map(s -> s + " to " + maxDate.orElse("?")).orElse("All dates");
        }
        String s = (startDate != null && !startDate.isBlank()) ? startDate : "Beginning";
        String e = (endDate   != null && !endDate.isBlank())   ? endDate   : "Present";
        return s + " to " + e;
    }

    private <K> Map<K, Long> sortedByValue(Map<K, Long> map) {
        return map.entrySet().stream()
                .sorted(Map.Entry.<K, Long>comparingByValue().reversed())
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (a, b) -> a,
                        LinkedHashMap::new
                ));
    }
}
