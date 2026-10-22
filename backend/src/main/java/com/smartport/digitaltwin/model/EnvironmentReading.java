package com.smartport.digitaltwin.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Environmental sensor reading snapshot for the port area.
 * All values are SIMULATED — not live CPCB/JNPA data.
 */
@Document(collection = "environment_readings")
public class EnvironmentReading {

    @Id
    private String id;

    private String timestamp; // ISO 8601
    private String location;

    private double aqi;
    private String aqiCondition; // good, moderate, poor, critical

    private double pm25;
    private String pm25Condition;

    private double pm10;
    private String pm10Condition;

    private double so2;
    private double no2;
    private double co;
    private double temperature;
    private double humidity;
    private double windSpeed;
    private double visibility;
    private double noise;

    private boolean simulated = true;

    public EnvironmentReading() {}

    // ── Getters & Setters ───────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public double getAqi() { return aqi; }
    public void setAqi(double aqi) { this.aqi = aqi; }

    public String getAqiCondition() { return aqiCondition; }
    public void setAqiCondition(String aqiCondition) { this.aqiCondition = aqiCondition; }

    public double getPm25() { return pm25; }
    public void setPm25(double pm25) { this.pm25 = pm25; }

    public String getPm25Condition() { return pm25Condition; }
    public void setPm25Condition(String pm25Condition) { this.pm25Condition = pm25Condition; }

    public double getPm10() { return pm10; }
    public void setPm10(double pm10) { this.pm10 = pm10; }

    public String getPm10Condition() { return pm10Condition; }
    public void setPm10Condition(String pm10Condition) { this.pm10Condition = pm10Condition; }

    public double getSo2() { return so2; }
    public void setSo2(double so2) { this.so2 = so2; }

    public double getNo2() { return no2; }
    public void setNo2(double no2) { this.no2 = no2; }

    public double getCo() { return co; }
    public void setCo(double co) { this.co = co; }

    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }

    public double getHumidity() { return humidity; }
    public void setHumidity(double humidity) { this.humidity = humidity; }

    public double getWindSpeed() { return windSpeed; }
    public void setWindSpeed(double windSpeed) { this.windSpeed = windSpeed; }

    public double getVisibility() { return visibility; }
    public void setVisibility(double visibility) { this.visibility = visibility; }

    public double getNoise() { return noise; }
    public void setNoise(double noise) { this.noise = noise; }

    public boolean isSimulated() { return simulated; }
    public void setSimulated(boolean simulated) { this.simulated = simulated; }
}
