
package com.disruptioniq.repository;

import java.util.List;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;

import com.disruptioniq.model.AuditEvent;

public interface AuditEventRepository
        extends Neo4jRepository<AuditEvent, String> {

    // Existing methods retained for compatibility.

    List<AuditEvent> findByEntityIdOrderByTimestampDesc(
            String entityId
    );

    List<AuditEvent> findByEntityTypeAndEntityIdOrderByTimestampDesc(
            String entityType,
            String entityId
    );

    List<AuditEvent> findByPerformedByOrderByTimestampDesc(
            String performedBy
    );

    // Paginated audit history for a specific entity.

    @Query("""
        MATCH (event:AuditEvent)
        WHERE event.entityType = $entityType
          AND event.entityId = $entityId
        RETURN event
        ORDER BY event.timestamp DESC
        SKIP $offset
        LIMIT $limit
        """)
    List<AuditEvent> findEntityHistoryPage(
            String entityType,
            String entityId,
            long offset,
            long limit
    );

    // Paginated audit history for a particular user.

    @Query("""
        MATCH (event:AuditEvent)
        WHERE event.performedBy = $performedBy
        RETURN event
        ORDER BY event.timestamp DESC
        SKIP $offset
        LIMIT $limit
        """)
    List<AuditEvent> findUserHistoryPage(
            String performedBy,
            long offset,
            long limit
    );
}
