package com.smartport.digitaltwin.controller;

import com.smartport.digitaltwin.dto.ReportSummaryDto;
import com.smartport.digitaltwin.service.ReportService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    /**
     * GET /api/v1/reports/summary
     *
     * Query params (all optional):
     *   terminal  — terminal code or "ALL"
     *   trade     — "ALL" | "import" | "export" | "transshipment"
     *   startDate — yyyy-MM-dd
     *   endDate   — yyyy-MM-dd
     */
    @GetMapping("/summary")
    public ReportSummaryDto getSummary(
            @RequestParam(defaultValue = "ALL")  String terminal,
            @RequestParam(defaultValue = "ALL")  String trade,
            @RequestParam(required = false)      String startDate,
            @RequestParam(required = false)      String endDate
    ) {
        return reportService.buildSummary(terminal, trade, startDate, endDate);
    }
}
