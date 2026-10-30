
package com.disruptioniq.repository;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import com.disruptioniq.model.Warehouse;

public interface WarehouseRepository
        extends Neo4jRepository<Warehouse, String> {
}
