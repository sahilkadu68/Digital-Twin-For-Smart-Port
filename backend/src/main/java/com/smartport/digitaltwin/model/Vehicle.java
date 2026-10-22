package com.smartport.digitaltwin.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Vehicle document — represents a truck or trailer within the port zone.
 * Used by the Port Map page for traffic visualization.
 */
@Document(collection = "vehicles")
public class Vehicle {

    @Id
    private String id;

    private String vehicleId;   // e.g. TRK-001
    private String type;        // truck, trailer, chassis
    private String status;      // moving, idle, queued, exited
    private double latitude;
    private double longitude;
    private String zone;        // Gate A, Yard A, Berth 1, etc.
    private String destination;
    private String lastUpdated; // ISO 8601
    private boolean simulated = true;

    public Vehicle() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }

    public String getZone() { return zone; }
    public void setZone(String zone) { this.zone = zone; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public String getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(String lastUpdated) { this.lastUpdated = lastUpdated; }

    public boolean isSimulated() { return simulated; }
    public void setSimulated(boolean simulated) { this.simulated = simulated; }
}
