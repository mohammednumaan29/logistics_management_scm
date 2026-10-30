
package com.disruptioniq.repository;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import com.disruptioniq.model.Customer;

public interface CustomerRepository
        extends Neo4jRepository<Customer, String> {
}
