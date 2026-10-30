
package com.disruptioniq.model;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

@Node("Warehouse")
public class Warehouse {

    @Id
    private String id;

    private String name;
    private String location;
    private long capacity;

    @Relationship(type = "STORES",
            direction = Relationship.Direction.OUTGOING)
    private List<Inventory> inventory = new ArrayList<>();

    public Warehouse() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getLocation() { return location; }
    public void setLocation(String location) {
        this.location = location;
    }

    public long getCapacity() { return capacity; }
    public void setCapacity(long capacity) {
        this.capacity = capacity;
    }

    public List<Inventory> getInventory() { return inventory; }
    public void setInventory(List<Inventory> inventory) {
        this.inventory = inventory;
    }
}
