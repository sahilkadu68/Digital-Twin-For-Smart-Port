package com.smartport.digitaltwin.controller;

import com.smartport.digitaltwin.dto.DashboardSummaryDto;
import com.smartport.digitaltwin.service.DashboardService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    /** GET /api/v1/dashboard/summary — port-level KPIs */
    @GetMapping("/summary")
    public DashboardSummaryDto getSummary() {
        return dashboardService.getSummary();
    }

    /** GET /api/v1/dashboard/throughput-trend — monthly TEU trend */
    @GetMapping("/throughput-trend")
    public List<Map<String, Object>> getThroughputTrend() {
        return dashboardService.getThroughputTrend();
    }
}
