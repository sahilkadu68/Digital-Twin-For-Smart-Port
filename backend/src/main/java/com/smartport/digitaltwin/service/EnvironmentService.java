package com.smartport.digitaltwin.service;

import com.smartport.digitaltwin.dto.EnvironmentSnapshotDto;
import com.smartport.digitaltwin.dto.EnvironmentSnapshotDto.SensorReadingDto;
import com.smartport.digitaltwin.dto.TrendPointDto;
import com.smartport.digitaltwin.model.EnvironmentReading;
import com.smartport.digitaltwin.repository.EnvironmentReadingRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class EnvironmentService {

    private final EnvironmentReadingRepository envRepo;

    public EnvironmentService(EnvironmentReadingRepository envRepo) {
        this.envRepo = envRepo;
    }

    /**
     * Get the latest environment snapshot, formatted to match
     * the frontend EnvironmentSnapshot TypeScript interface.
     */
    public EnvironmentSnapshotDto getLatestSnapshot() {
        List<EnvironmentReading> readings = envRepo.findAllByOrderByTimestampDesc();
        if (readings.isEmpty()) return null;

        EnvironmentReading latest = readings.get(0);
        EnvironmentSnapshotDto dto = new EnvironmentSnapshotDto();
        dto.setTimestamp(latest.getTimestamp());
        dto.setLocation(latest.getLocation());
        dto.setAqi(new SensorReadingDto("AQI", latest.getAqi(), "index", latest.getAqiCondition(), "Air Quality Index"));
        dto.setPm25(new SensorReadingDto("PM2.5", latest.getPm25(), "µg/m³", latest.getPm25Condition(), "Fine Particulate Matter"));
        dto.setPm10(new SensorReadingDto("PM10", latest.getPm10(), "µg/m³", latest.getPm10Condition(), "Coarse Particulate Matter"));
        dto.setSo2(new SensorReadingDto("SO₂", latest.getSo2(), "µg/m³", conditionForValue(latest.getSo2(), 20, 80), "Sulphur Dioxide"));
        dto.setNo2(new SensorReadingDto("NO₂", latest.getNo2(), "µg/m³", conditionForValue(latest.getNo2(), 40, 80), "Nitrogen Dioxide"));
        dto.setCo(new SensorReadingDto("CO", latest.getCo(), "mg/m³", conditionForValue(latest.getCo(), 2, 4), "Carbon Monoxide"));
        dto.setTemperature(new SensorReadingDto("Temp", latest.getTemperature(), "°C", conditionForValue(latest.getTemperature(), 30, 40), "Temperature"));
        dto.setHumidity(new SensorReadingDto("RH", latest.getHumidity(), "%", conditionForValue(latest.getHumidity(), 60, 85), "Relative Humidity"));
        dto.setWindSpeed(new SensorReadingDto("Wind", latest.getWindSpeed(), "km/h", "good", "Wind Speed"));
        dto.setVisibility(new SensorReadingDto("Vis", latest.getVisibility(), "km", latest.getVisibility() >= 5 ? "good" : "moderate", "Visibility"));
        dto.setNoise(new SensorReadingDto("Noise", latest.getNoise(), "dB", conditionForValue(latest.getNoise(), 65, 85), "Noise Level"));
        return dto;
    }

    /**
     * Get 7-day AQI/PM trend points.
     */
    public List<TrendPointDto> getAqiTrend() {
        List<EnvironmentReading> readings = envRepo.findAllByOrderByTimestampDesc();
        // Take up to 7 readings, reverse to chronological order
        List<EnvironmentReading> recent = readings.stream().limit(7).collect(Collectors.toList());
        java.util.Collections.reverse(recent);
        return recent.stream()
                .map(r -> new TrendPointDto(r.getTimestamp().substring(0, 10), r.getAqi(), r.getPm25(), r.getPm10()))
                .collect(Collectors.toList());
    }

    private String conditionForValue(double value, double moderateThreshold, double poorThreshold) {
        if (value <= moderateThreshold) return "good";
        if (value <= poorThreshold) return "moderate";
        return "poor";
    }
}
