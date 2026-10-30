
package com.disruptioniq.repository;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import com.disruptioniq.model.Product;

public interface ProductRepository
        extends Neo4jRepository<Product, String> {
}
