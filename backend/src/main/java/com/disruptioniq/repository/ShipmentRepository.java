
package com.disruptioniq.repository;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import com.disruptioniq.model.Shipment;

public interface ShipmentRepository
        extends Neo4jRepository<Shipment, String> {
}
