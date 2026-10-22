package com.smartport.digitaltwin.dto;

import java.util.Map;

/**
 * Yard statistics DTO — matches the frontend YardStats interface.
 */
public class YardStatsDto {
    private long totalContainers;
    private long totalCapacity;
    private double utilizationPercent;
    private Map<String, Long> byStatus;

    public YardStatsDto() {}

    public YardStatsDto(long totalContainers, long totalCapacity, double utilizationPercent, Map<String, Long> byStatus) {
        this.totalContainers = totalContainers;
        this.totalCapacity = totalCapacity;
        this.utilizationPercent = utilizationPercent;
        this.byStatus = byStatus;
    }

    public long getTotalContainers() { return totalContainers; }
    public void setTotalContainers(long totalContainers) { this.totalContainers = totalContainers; }

    public long getTotalCapacity() { return totalCapacity; }
    public void setTotalCapacity(long totalCapacity) { this.totalCapacity = totalCapacity; }

    public double getUtilizationPercent() { return utilizationPercent; }
    public void setUtilizationPercent(double utilizationPercent) { this.utilizationPercent = utilizationPercent; }

    public Map<String, Long> getByStatus() { return byStatus; }
    public void setByStatus(Map<String, Long> byStatus) { this.byStatus = byStatus; }
}
