package com.disruptioniq.repository;

import java.util.List;

import org.springframework.data.neo4j.repository.Neo4jRepository;

import com.disruptioniq.model.RecoveryProgress;

public interface RecoveryProgressRepository
        extends Neo4jRepository<RecoveryProgress, String> {

    List<RecoveryProgress> findByRecoveryPlanIdOrderByUpdatedAtDesc(
            String recoveryPlanId);

    List<RecoveryProgress> findByShipmentIdOrderByUpdatedAtDesc(
            String shipmentId);
}