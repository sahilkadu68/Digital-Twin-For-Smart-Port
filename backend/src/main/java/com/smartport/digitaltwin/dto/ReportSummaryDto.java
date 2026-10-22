package com.smartport.digitaltwin.dto;

import java.util.List;
import java.util.Map;

/**
 * DTO returned by the /api/v1/reports/summary endpoint.
 * All aggregations are derived from the live MongoDB container collection.
 */
public class ReportSummaryDto {

    // ── Header ─────────────────────────────────────────────────────────
    private String generatedAt;           // ISO-8601 timestamp
    private String reportPeriod;          // e.g. "2024-05-01 to 2024-07-02"
    private String terminalFilter;        // "ALL" or terminal code
    private String tradeFilter;           // "ALL", "import", "export", "transshipment"

    // ── Top-level metrics ─────────────────────────────────────────────
    private long totalContainers;
    private long totalTeus;               // 20ft=1 TEU, 40ft/40ft-HC/45ft-HC=2 TEU
    private double totalWeightTonnes;

    // ── Trade breakdown ───────────────────────────────────────────────
    private long importCount;
    private long exportCount;
    private long transshipmentCount;
    private long otherCount;

    // ── Terminal breakdown ────────────────────────────────────────────
    /** Map of terminalCode → containerCount */
    private Map<String, Long> byTerminal;

    // ── Status breakdown ──────────────────────────────────────────────
    private Map<String, Long> byStatus;

    // ── Container type breakdown ──────────────────────────────────────
    private Map<String, Long> byType;

    // ── Cargo type breakdown ──────────────────────────────────────────
    private Map<String, Long> byCargo;

    // ── Arrival-date trend ────────────────────────────────────────────
    /** List of {period, count} — grouped by arrival date */
    private List<TrendPoint> arrivalTrend;

    // ── Simulated-data flag ───────────────────────────────────────────
    private boolean containsSimulatedData;

    // ── inner record ─────────────────────────────────────────────────
    public record TrendPoint(String period, long count) {}

    // ── Constructors ─────────────────────────────────────────────────
    public ReportSummaryDto() {}

    // ── Getters & Setters ─────────────────────────────────────────────

    public String getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(String generatedAt) { this.generatedAt = generatedAt; }

    public String getReportPeriod() { return reportPeriod; }
    public void setReportPeriod(String reportPeriod) { this.reportPeriod = reportPeriod; }

    public String getTerminalFilter() { return terminalFilter; }
    public void setTerminalFilter(String terminalFilter) { this.terminalFilter = terminalFilter; }

    public String getTradeFilter() { return tradeFilter; }
    public void setTradeFilter(String tradeFilter) { this.tradeFilter = tradeFilter; }

    public long getTotalContainers() { return totalContainers; }
    public void setTotalContainers(long totalContainers) { this.totalContainers = totalContainers; }

    public long getTotalTeus() { return totalTeus; }
    public void setTotalTeus(long totalTeus) { this.totalTeus = totalTeus; }

    public double getTotalWeightTonnes() { return totalWeightTonnes; }
    public void setTotalWeightTonnes(double totalWeightTonnes) { this.totalWeightTonnes = totalWeightTonnes; }

    public long getImportCount() { return importCount; }
    public void setImportCount(long importCount) { this.importCount = importCount; }

    public long getExportCount() { return exportCount; }
    public void setExportCount(long exportCount) { this.exportCount = exportCount; }

    public long getTransshipmentCount() { return transshipmentCount; }
    public void setTransshipmentCount(long transshipmentCount) { this.transshipmentCount = transshipmentCount; }

    public long getOtherCount() { return otherCount; }
    public void setOtherCount(long otherCount) { this.otherCount = otherCount; }

    public Map<String, Long> getByTerminal() { return byTerminal; }
    public void setByTerminal(Map<String, Long> byTerminal) { this.byTerminal = byTerminal; }

    public Map<String, Long> getByStatus() { return byStatus; }
    public void setByStatus(Map<String, Long> byStatus) { this.byStatus = byStatus; }

    public Map<String, Long> getByType() { return byType; }
    public void setByType(Map<String, Long> byType) { this.byType = byType; }

    public Map<String, Long> getByCargo() { return byCargo; }
    public void setByCargo(Map<String, Long> byCargo) { this.byCargo = byCargo; }

    public List<TrendPoint> getArrivalTrend() { return arrivalTrend; }
    public void setArrivalTrend(List<TrendPoint> arrivalTrend) { this.arrivalTrend = arrivalTrend; }

    public boolean isContainsSimulatedData() { return containsSimulatedData; }
    public void setContainsSimulatedData(boolean containsSimulatedData) { this.containsSimulatedData = containsSimulatedData; }
}
