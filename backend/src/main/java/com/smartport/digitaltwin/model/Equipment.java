package com.smartport.digitaltwin.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import jakarta.validation.constraints.NotBlank;

/**
 * Equipment document — represents a piece of port equipment (RTG crane, etc.)
 */
@Document(collection = "equipment")
public class Equipment {

    @Id
    private String id;

    @NotBlank
    private String equipmentId; // e.g. RTG-01

    @NotBlank
    private String type; // rtg, rmqc, reach-stacker

    @NotBlank
    private String terminal;

    private String block;

    @NotBlank
    private String status; // active, idle, maintenance

    private double utilization; // 0-100
    private int liftsPerHour;

    private boolean simulated = true;

    public Equipment() {}

    // ── Getters & Setters ───────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEquipmentId() { return equipmentId; }
    public void setEquipmentId(String equipmentId) { this.equipmentId = equipmentId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getTerminal() { return terminal; }
    public void setTerminal(String terminal) { this.terminal = terminal; }

    public String getBlock() { return block; }
    public void setBlock(String block) { this.block = block; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public double getUtilization() { return utilization; }
    public void setUtilization(double utilization) { this.utilization = utilization; }

    public int getLiftsPerHour() { return liftsPerHour; }
    public void setLiftsPerHour(int liftsPerHour) { this.liftsPerHour = liftsPerHour; }

    public boolean isSimulated() { return simulated; }
    public void setSimulated(boolean simulated) { this.simulated = simulated; }
}
