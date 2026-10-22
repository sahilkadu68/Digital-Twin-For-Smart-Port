package com.smartport.digitaltwin.service;

import com.smartport.digitaltwin.model.EnvironmentReading;
import com.smartport.digitaltwin.repository.EnvironmentReadingRepository;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EnvironmentPipelineTest {
    @Test void emptyReadingsAreUnavailableAndWindDirectionIsNotInvented() {
        var repository = mock(EnvironmentReadingRepository.class);
        var service = new EnvironmentService(repository);
        when(repository.findAllByOrderByTimestampDesc()).thenReturn(List.of());
        assertNull(service.getLatestSnapshot()); assertTrue(service.getAqiTrend().isEmpty());
        var reading = new EnvironmentReading(); reading.setTimestamp("2024-06-28T08:30:00+05:30");
        reading.setWindSpeed(12.5);
        when(repository.findAllByOrderByTimestampDesc()).thenReturn(List.of(reading));
        assertEquals("Wind Speed", service.getLatestSnapshot().getWindSpeed().getLabel());
        assertEquals(12.5, service.getLatestSnapshot().getWindSpeed().getValue());
    }
}
