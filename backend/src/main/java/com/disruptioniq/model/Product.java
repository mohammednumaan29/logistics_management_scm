
package com.disruptioniq.model;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

@Node("Product")
public class Product {

    @Id
    private String id;

    private String name;
    private String category;
    private double unitCost;

    @Relationship(type = "REQUIRED_BY",
            direction = Relationship.Direction.OUTGOING)
    private List<Order> orders = new ArrayList<>();

    public Product() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) {
        this.category = category;
    }

    public double getUnitCost() { return unitCost; }
    public void setUnitCost(double unitCost) {
        this.unitCost = unitCost;
    }

    public List<Order> getOrders() { return orders; }
    public void setOrders(List<Order> orders) {
        this.orders = orders;
    }
}
