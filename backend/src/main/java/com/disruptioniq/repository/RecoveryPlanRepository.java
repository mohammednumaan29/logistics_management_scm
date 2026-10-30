
package com.disruptioniq.repository;

import java.util.List;

import org.springframework.data.neo4j.repository.Neo4jRepository;

import com.disruptioniq.model.RecoveryPlan;

public interface RecoveryPlanRepository
        extends Neo4jRepository<RecoveryPlan, String> {

    List<RecoveryPlan> findByShipmentId(String shipmentId);

    List<RecoveryPlan> findByStatus(String status);

    List<RecoveryPlan> findByCreatedBy(String createdBy);
}
