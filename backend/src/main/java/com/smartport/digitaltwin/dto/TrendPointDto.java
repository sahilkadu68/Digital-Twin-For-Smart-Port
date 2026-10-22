package com.smartport.digitaltwin.dto;

/**
 * Trend point DTO for environment historical data charts.
 */
public class TrendPointDto {
    private String date;
    private double aqi;
    private double pm25;
    private double pm10;

    public TrendPointDto() {}

    public TrendPointDto(String date, double aqi, double pm25, double pm10) {
        this.date = date;
        this.aqi = aqi;
        this.pm25 = pm25;
        this.pm10 = pm10;
    }

    public String getDate() { return date; }
    public void setDate(String d) { this.date = d; }
    public double getAqi() { return aqi; }
    public void setAqi(double v) { this.aqi = v; }
    public double getPm25() { return pm25; }
    public void setPm25(double v) { this.pm25 = v; }
    public double getPm10() { return pm10; }
    public void setPm10(double v) { this.pm10 = v; }
}
