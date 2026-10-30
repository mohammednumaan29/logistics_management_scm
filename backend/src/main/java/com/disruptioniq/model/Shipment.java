
package com.disruptioniq.model;

import java.time.LocalDate;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

@Node("Shipment")
public class Shipment {

    @Id
    private String id;

    private int quantity;
    private String status;
    private LocalDate expectedDelivery;

    @Relationship(type = "DELIVERS_TO",
            direction = Relationship.Direction.OUTGOING)
    private Warehouse warehouse;

    public Shipment() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDate getExpectedDelivery() { return expectedDelivery; }
    public void setExpectedDelivery(LocalDate expectedDelivery) {
        this.expectedDelivery = expectedDelivery;
    }

    public Warehouse getWarehouse() { return warehouse; }
    public void setWarehouse(Warehouse warehouse) {
        this.warehouse = warehouse;
    }
}
