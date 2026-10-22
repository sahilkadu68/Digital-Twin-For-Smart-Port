package com.smartport.digitaltwin.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import jakarta.validation.constraints.NotBlank;

/**
 * Terminal document — represents a JNPA terminal with
 * its reference configuration and yard capacity figures.
 */
@Document(collection = "terminals")
public class Terminal {

    @Id
    private String id;

    @NotBlank
    private String code;

    @NotBlank
    private String name;

    private String operator;
    private int yardCapacity;
    private int berths;
    private int quayLength;
    private Double capacityMillionTeu;
    private Double yardAreaHa;
    private Integer rtgcCount;
    private Integer rmqcCount;

    public Terminal() {}

    // ── Getters & Setters ───────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }

    public int getYardCapacity() { return yardCapacity; }
    public void setYardCapacity(int yardCapacity) { this.yardCapacity = yardCapacity; }

    public int getBerths() { return berths; }
    public void setBerths(int berths) { this.berths = berths; }

    public int getQuayLength() { return quayLength; }
    public void setQuayLength(int quayLength) { this.quayLength = quayLength; }

    public Double getCapacityMillionTeu() { return capacityMillionTeu; }
    public void setCapacityMillionTeu(Double capacityMillionTeu) { this.capacityMillionTeu = capacityMillionTeu; }

    public Double getYardAreaHa() { return yardAreaHa; }
    public void setYardAreaHa(Double yardAreaHa) { this.yardAreaHa = yardAreaHa; }

    public Integer getRtgcCount() { return rtgcCount; }
    public void setRtgcCount(Integer rtgcCount) { this.rtgcCount = rtgcCount; }

    public Integer getRmqcCount() { return rmqcCount; }
    public void setRmqcCount(Integer rmqcCount) { this.rmqcCount = rmqcCount; }
}
