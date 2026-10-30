
package com.disruptioniq.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

@Node("Inventory")
public class Inventory {

    @Id
    private String id;

    private long onHand;
    private long reserved;
    private long reorderPoint;
    private long dailyDemand;

    @Relationship(type = "FOR",
            direction = Relationship.Direction.OUTGOING)
    private Product product;

    public Inventory() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public long getOnHand() { return onHand; }
    public void setOnHand(long onHand) { this.onHand = onHand; }

    public long getReserved() { return reserved; }
    public void setReserved(long reserved) { this.reserved = reserved; }

    public long getReorderPoint() { return reorderPoint; }
    public void setReorderPoint(long reorderPoint) {
        this.reorderPoint = reorderPoint;
    }

    public long getDailyDemand() { return dailyDemand; }
    public void setDailyDemand(long dailyDemand) {
        this.dailyDemand = dailyDemand;
    }

    public long getAvailable() {
        return onHand - reserved;
    }

    public Product getProduct() { return product; }
    public void setProduct(Product product) {
        this.product = product;
    }
}
