
package com.disruptioniq.model;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

@Node("Supplier")
public class Supplier {

    @Id
    private String id;

    private String name;
    private String status;
    private int leadTimeDays;

    @Relationship(type = "SENDS", direction = Relationship.Direction.OUTGOING)
    private List<Shipment> shipments = new ArrayList<>();

    public Supplier() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getLeadTimeDays() { return leadTimeDays; }
    public void setLeadTimeDays(int leadTimeDays) {
        this.leadTimeDays = leadTimeDays;
    }

    public List<Shipment> getShipments() { return shipments; }
    public void setShipments(List<Shipment> shipments) {
        this.shipments = shipments;
    }
}
