
package com.disruptioniq.repository;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import com.disruptioniq.model.Inventory;

public interface InventoryRepository
        extends Neo4jRepository<Inventory, String> {
}
