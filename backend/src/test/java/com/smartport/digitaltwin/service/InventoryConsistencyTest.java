package com.smartport.digitaltwin.service;

import com.smartport.digitaltwin.model.*;
import com.smartport.digitaltwin.repository.*;
import com.smartport.digitaltwin.controller.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class InventoryConsistencyTest {
    private Container container(String id, String status, String terminal, String date) {
        Container c = new Container(); c.setId(id); c.setStatus(status); c.setTerminal(terminal);
        c.setArrivalDate(date); c.setType("40ft"); c.setCargoType("general"); return c;
    }
    @Test void unfilteredAndBroadRangeAgreeAndPreserveInclusiveDays() {
        var repo = mock(ContainerRepository.class);
        when(repo.findAll()).thenReturn(List.of(container("a", "import", "NSICT", "2024-05-01"),
                container("b", "export", "BMCT", "2024-07-02")));
        var reports = new ReportService(repo, mock(TerminalRepository.class), mock(EnvironmentService.class));
        assertEquals(2, reports.buildSummary("ALL", "ALL", null, null).getTotalContainers());
        assertEquals(2, reports.buildSummary("ALL", "ALL", "2000-01-01", "2030-12-31").getTotalContainers());
        assertEquals(1, reports.buildSummary(" nsict ", "IMPORT", "2024-05-01", "2024-05-01").getTotalContainers());
        assertEquals(0, reports.buildSummary("ALL", "ALL", "2026-10-01", "2026-10-31").getTotalContainers());
    }
    @Test void timezoneBoundariesAndUnknownDatesAreHandledExplicitly() {
        var repo = mock(ContainerRepository.class);
        when(repo.findAll()).thenReturn(List.of(container("a", "empty", "NSICT", "2024-05-01T20:00:00Z"),
                container("b", "loaded", "NSICT", null), container("c", "loaded", "NSICT", "broken")));
        var reports = new ReportService(repo, mock(TerminalRepository.class), mock(EnvironmentService.class));
        assertEquals(3, reports.buildSummary("ALL", "ALL", null, null).getTotalContainers());
        var summary = reports.buildSummary("ALL", "ALL", "2024-05-02", "2024-05-02");
        assertEquals(1, summary.getTotalContainers());
        assertEquals("2024-05-02", summary.getArrivalTrend().get(0).period());
    }
    @Test void independentTradeDoesNotInventTradeForLegacyOperationalStatus() {
        var repo = mock(ContainerRepository.class);
        var explicit = container("a", "customs-hold", "NSICT", "2024-05-01"); explicit.setTradeCategory("import");
        when(repo.findAll()).thenReturn(List.of(explicit, container("b", "empty", "NSICT", "2024-05-01")));
        var summary = new ReportService(repo, mock(TerminalRepository.class), mock(EnvironmentService.class)).buildSummary("ALL", "import", null, null);
        assertEquals(1, summary.getTotalContainers()); assertEquals(1, summary.getImportCount());
    }
    @Test void emptyContainersOccupySlotsAndHistoryIsUnavailable() {
        var repo = mock(ContainerRepository.class); var terminals = mock(TerminalRepository.class);
        var t = new Terminal(); t.setYardCapacity(10);
        when(terminals.findAll()).thenReturn(List.of(t));
        when(repo.findAll()).thenReturn(List.of(container("a", "empty", "NSICT", null), container("b", "gate-out", "NSICT", null)));
        assertEquals(10.0, new ContainerService(repo, terminals).getYardStats().getUtilizationPercent());
        var dashboard = new DashboardService(repo);
        assertNull(dashboard.getSummary().getGateIn24h()); assertNull(dashboard.getSummary().getVesselsAtBerth());
        assertNull(dashboard.getSummary().getThroughputMtd()); assertTrue(dashboard.getThroughputTrend().isEmpty());
        verify(repo, never()).deleteAll();
    }
    @Test void invalidFiltersReturn400AndReseedIsGone() throws Exception {
        var repo = mock(ContainerRepository.class);
        var mvc = MockMvcBuilders.standaloneSetup(new ReportController(new ReportService(repo, mock(TerminalRepository.class), mock(EnvironmentService.class))), new AdminController()).build();
        mvc.perform(get("/api/v1/reports/summary").param("startDate", "bad")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/reports/summary").param("startDate", "2025-01-01").param("endDate", "2024-01-01")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/reports/summary").param("trade", "made-up")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/admin/reseed")).andExpect(status().isGone());
        verifyNoInteractions(repo);
    }
}
