package com.smartport.digitaltwin.dto;

/**
 * Dashboard summary DTO — port-level operational metrics.
 * Computed from the underlying container and terminal datasets.
 */
public class DashboardSummaryDto {
    private Integer vesselsAtBerth;
    private Long gateIn24h;
    private Long gateOut24h;
    private Long throughputMtd;
    private double importPercent;
    private double exportPercent;
    private double transshipmentPercent;

    public DashboardSummaryDto() {}

    public Integer getVesselsAtBerth() { return vesselsAtBerth; }
    public void setVesselsAtBerth(Integer v) { this.vesselsAtBerth = v; }

    public Long getGateIn24h() { return gateIn24h; }
    public void setGateIn24h(Long v) { this.gateIn24h = v; }

    public Long getGateOut24h() { return gateOut24h; }
    public void setGateOut24h(Long v) { this.gateOut24h = v; }

    public Long getThroughputMtd() { return throughputMtd; }
    public void setThroughputMtd(Long v) { this.throughputMtd = v; }

    public double getImportPercent() { return importPercent; }
    public void setImportPercent(double v) { this.importPercent = v; }

    public double getExportPercent() { return exportPercent; }
    public void setExportPercent(double v) { this.exportPercent = v; }

    public double getTransshipmentPercent() { return transshipmentPercent; }
    public void setTransshipmentPercent(double v) { this.transshipmentPercent = v; }
}
