package com.smartport.digitaltwin.dto;

import java.util.List;
import java.util.Map;

/** Metrics use the same filtered inventory cohort, not historical yard occupancy. */
public record ReportOperationsDto(long activeContainers, long departedContainers,
    long capacity, Double utilizationPercent, List<YardRow> yards,
    Map<String,Long> quality, EnvironmentSnapshotDto environment, Boolean environmentStale,
    List<String> notes) {
    public record YardRow(String terminal,long active,long capacity,Double utilizationPercent,String status) {}
}
