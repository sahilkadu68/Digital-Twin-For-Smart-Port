package com.smartport.digitaltwin.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Container document — represents a single shipping container
 * located within the port yard.
 *
 * Position hierarchy: terminal → yard → block → row → column → level
 */
@Document(collection = "containers")
public class Container {

    @Id
    private String id;

    @NotBlank
    private String containerNumber;

    @NotBlank
    private String status; // import, export, transshipment, gate-in, gate-out, customs-hold, inspection, empty, loaded

    @NotBlank
    private String type; // 20ft, 40ft, 40ft-HC, 45ft-HC

    @NotBlank
    private String shippingLine;

    @Min(0)
    private double weight; // kilograms

    @NotBlank
    private String cargoType; // general, refrigerated, hazardous, bulk, liquid, ro-ro

    private String origin;
    private String destination;
    private String arrivalDate; // ISO 8601
    private String tradeCategory;

    public String getTradeCategory() { return tradeCategory; }
    public void setTradeCategory(String tradeCategory) { this.tradeCategory = tradeCategory; }

    // ── Spatial position ────────────────────────────────────────────
    @NotBlank
    private String terminal; // NSICT, NSIGT, APMT, BMCT, NSFT, NSDT

    @NotBlank
    private String yard;

    @NotBlank
    private String block;

    @Min(1)
    private int row;

    @Min(1)
    private int column;

    @Min(1)
    private int level;

    /** true identifies synthetic data; false alone does not verify external provenance. */
    private boolean simulated = true;

    // ── Constructors ────────────────────────────────────────────────

    public Container() {}

    // ── Getters & Setters ───────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getContainerNumber() { return containerNumber; }
    public void setContainerNumber(String containerNumber) { this.containerNumber = containerNumber; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getShippingLine() { return shippingLine; }
    public void setShippingLine(String shippingLine) { this.shippingLine = shippingLine; }

    public double getWeight() { return weight; }
    public void setWeight(double weight) { this.weight = weight; }

    public String getCargoType() { return cargoType; }
    public void setCargoType(String cargoType) { this.cargoType = cargoType; }

    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public String getArrivalDate() { return arrivalDate; }
    public void setArrivalDate(String arrivalDate) { this.arrivalDate = arrivalDate; }

    public String getTerminal() { return terminal; }
    public void setTerminal(String terminal) { this.terminal = terminal; }

    public String getYard() { return yard; }
    public void setYard(String yard) { this.yard = yard; }

    public String getBlock() { return block; }
    public void setBlock(String block) { this.block = block; }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getColumn() { return column; }
    public void setColumn(int column) { this.column = column; }

    public int getLevel() { return level; }
    public void setLevel(int level) { this.level = level; }

    public boolean isSimulated() { return simulated; }
    public void setSimulated(boolean simulated) { this.simulated = simulated; }
}
