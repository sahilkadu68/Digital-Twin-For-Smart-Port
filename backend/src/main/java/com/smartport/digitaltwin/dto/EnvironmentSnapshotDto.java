package com.smartport.digitaltwin.dto;

/**
 * Environment snapshot DTO — structured to match the frontend
 * EnvironmentSnapshot TypeScript interface with nested sensor readings.
 */
public class EnvironmentSnapshotDto {
    private String timestamp;
    private String location;
    private SensorReadingDto aqi;
    private SensorReadingDto pm25;
    private SensorReadingDto pm10;
    private SensorReadingDto so2;
    private SensorReadingDto no2;
    private SensorReadingDto co;
    private SensorReadingDto temperature;
    private SensorReadingDto humidity;
    private SensorReadingDto windSpeed;
    private SensorReadingDto visibility;
    private SensorReadingDto noise;

    public EnvironmentSnapshotDto() {}

    // ── Getters & Setters ───────────────────────────────────────────
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String t) { this.timestamp = t; }
    public String getLocation() { return location; }
    public void setLocation(String l) { this.location = l; }
    public SensorReadingDto getAqi() { return aqi; }
    public void setAqi(SensorReadingDto v) { this.aqi = v; }
    public SensorReadingDto getPm25() { return pm25; }
    public void setPm25(SensorReadingDto v) { this.pm25 = v; }
    public SensorReadingDto getPm10() { return pm10; }
    public void setPm10(SensorReadingDto v) { this.pm10 = v; }
    public SensorReadingDto getSo2() { return so2; }
    public void setSo2(SensorReadingDto v) { this.so2 = v; }
    public SensorReadingDto getNo2() { return no2; }
    public void setNo2(SensorReadingDto v) { this.no2 = v; }
    public SensorReadingDto getCo() { return co; }
    public void setCo(SensorReadingDto v) { this.co = v; }
    public SensorReadingDto getTemperature() { return temperature; }
    public void setTemperature(SensorReadingDto v) { this.temperature = v; }
    public SensorReadingDto getHumidity() { return humidity; }
    public void setHumidity(SensorReadingDto v) { this.humidity = v; }
    public SensorReadingDto getWindSpeed() { return windSpeed; }
    public void setWindSpeed(SensorReadingDto v) { this.windSpeed = v; }
    public SensorReadingDto getVisibility() { return visibility; }
    public void setVisibility(SensorReadingDto v) { this.visibility = v; }
    public SensorReadingDto getNoise() { return noise; }
    public void setNoise(SensorReadingDto v) { this.noise = v; }

    // ── Nested sensor reading ───────────────────────────────────────
    public static class SensorReadingDto {
        private String parameter;
        private double value;
        private String unit;
        private String condition;
        private String label;

        public SensorReadingDto() {}

        public SensorReadingDto(String parameter, double value, String unit, String condition, String label) {
            this.parameter = parameter;
            this.value = value;
            this.unit = unit;
            this.condition = condition;
            this.label = label;
        }

        public String getParameter() { return parameter; }
        public void setParameter(String p) { this.parameter = p; }
        public double getValue() { return value; }
        public void setValue(double v) { this.value = v; }
        public String getUnit() { return unit; }
        public void setUnit(String u) { this.unit = u; }
        public String getCondition() { return condition; }
        public void setCondition(String c) { this.condition = c; }
        public String getLabel() { return label; }
        public void setLabel(String l) { this.label = l; }
    }
}
