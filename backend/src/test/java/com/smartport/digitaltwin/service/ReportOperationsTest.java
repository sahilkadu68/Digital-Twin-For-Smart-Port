package com.smartport.digitaltwin.service;

import com.smartport.digitaltwin.model.*;
import com.smartport.digitaltwin.dto.EnvironmentSnapshotDto;
import com.smartport.digitaltwin.repository.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReportOperationsTest {
    Container box(String id,String status,String type,double weight) {
        Container c=new Container();c.setId(id);c.setContainerNumber(id);c.setTerminal("BMCT");c.setStatus(status);c.setType(type);c.setWeight(weight);
        c.setYard("BM-YARD");c.setBlock("BM-01");c.setRow(1);c.setColumn(1);c.setLevel(1);c.setArrivalDate("2024-05-01");return c;
    }
    Terminal terminal(int capacity) { Terminal t=new Terminal();t.setCode("BMCT");t.setYardCapacity(capacity);return t; }
    @Test void activeCohortCapacityWeightTeusAndStatusStayConsistent() {
        var repo=mock(ContainerRepository.class);var terms=mock(TerminalRepository.class);var env=mock(EnvironmentService.class);
        when(repo.findAll()).thenReturn(List.of(box("a","import","20ft",1000),box("b","gate-out","45ft-HC",2000)));
        when(terms.findAll()).thenReturn(List.of(terminal(10)));
        var service=new ReportService(repo,terms,env);var all=service.buildSummary("BMCT","ALL",null,null);
        assertEquals(2,all.getTotalContainers());assertEquals(3,all.getTotalTeus());assertEquals(3,all.getTotalWeightTonnes());
        assertEquals(1,all.getOperations().activeContainers());assertEquals(10.,all.getOperations().utilizationPercent());
        var departed=service.buildSummary("BMCT","ALL",null,null,"gate-out");
        assertEquals(1,departed.getTotalContainers());assertEquals(0,departed.getOperations().activeContainers());assertEquals(0.,departed.getOperations().utilizationPercent());
        var empty=service.buildSummary("BMCT","ALL","2026-01-01","2026-01-02");assertEquals(0,empty.getTotalContainers());assertEquals(0.,empty.getOperations().utilizationPercent());
    }
    @Test void invalidFieldsZeroCapacityAndStaleEnvironmentAreExplicit() {
        var c=box("duplicate","empty",null,Double.NaN);c.setLevel(8);c.setArrivalDate(null);
        var env=new EnvironmentSnapshotDto();env.setTimestamp("2024-01-01T00:00:00Z");
        var op=ReportOperations.build(List.of(c,c),List.of(terminal(0)),"ALL",env);
        assertNull(op.utilizationPercent());assertTrue(op.environmentStale());
        assertEquals(2,op.quality().get("unknownContainerTypes"));assertEquals(2,op.quality().get("invalidWeights"));
        assertEquals(1,op.quality().get("duplicateContainerNumberGroups"));assertEquals(1,op.quality().get("conflictingSlotGroups"));
        assertEquals(0,ReportOperations.teuFactor(null));
        env.setTimestamp("invalid");assertNull(ReportOperations.build(List.of(),List.of(),"ALL",env).environmentStale());
    }
    @Test void missingTerminalCapacityAndOverCapacityAreNotHidden() {
        var c=box("a","empty","40ft",-1);
        assertNull(ReportOperations.build(List.of(c),List.of(),"ALL",null).utilizationPercent());
        var op=ReportOperations.build(List.of(c,c),List.of(terminal(1)),"ALL",null);
        assertEquals(200.,op.utilizationPercent());assertEquals("At/above capacity",op.yards().get(0).status());
    }
}
