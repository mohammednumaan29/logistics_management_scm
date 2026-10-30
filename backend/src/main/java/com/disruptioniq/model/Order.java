
package com.disruptioniq.model;

import java.time.LocalDate;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

@Node("Order")
public class Order {

    @Id
    private String id;

    private String priority;
    private long quantity;
    private LocalDate promisedDelivery;
    private String status;

    @Relationship(type = "PLACED_BY",
            direction = Relationship.Direction.OUTGOING)
    private Customer customer;

    public Order() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) {
        this.priority = priority;
    }

    public long getQuantity() { return quantity; }
    public void setQuantity(long quantity) {
        this.quantity = quantity;
    }

    public LocalDate getPromisedDelivery() {
        return promisedDelivery;
    }

    public void setPromisedDelivery(LocalDate promisedDelivery) {
        this.promisedDelivery = promisedDelivery;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) {
        this.status = status;
    }

    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) {
        this.customer = customer;
    }
}
