package com.disruptioniq.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.neo4j.repository.Neo4jRepository;

import com.disruptioniq.model.Notification;

public interface NotificationRepository
        extends Neo4jRepository<Notification, String> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(
            String userId
    );

    List<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(
            String userId
    );

    Optional<Notification> findByIdAndUserId(
            String id,
            String userId
    );

    long countByUserId(String userId);

    long countByUserIdAndReadFalse(String userId);
}