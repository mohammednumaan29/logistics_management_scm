
package com.disruptioniq.repository;

import java.util.Optional;

import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;

import com.disruptioniq.model.CarrierWebhookEvent;

public interface CarrierWebhookEventRepository
        extends Neo4jRepository<CarrierWebhookEvent, String> {

    /**
     * Atomically claims a carrier event.
     *
     * Only the request that creates the event receives true.
     * Existing event IDs cannot be claimed again.
     */
    @Query("""
        MERGE (e:CarrierWebhookEvent {eventId: $eventId})
        ON CREATE SET
            e.shipmentId = $shipmentId,
            e.eventType = $eventType,
            e.occurredAt = $occurredAt,
            e.receivedAt = $receivedAt,
            e.payloadHash = $payloadHash,
            e.status = 'RECEIVED',
            e.claimToken = $claimToken

        RETURN e.claimToken = $claimToken AS created
        """)
    Boolean claimEvent(
            @Param("eventId") String eventId,
            @Param("shipmentId") String shipmentId,
            @Param("eventType") String eventType,
            @Param("occurredAt") String occurredAt,
            @Param("receivedAt") String receivedAt,
            @Param("payloadHash") String payloadHash,
            @Param("claimToken") String claimToken
    );

    /**
     * Marks a successfully processed event.
     */
    @Query("""
        MATCH (e:CarrierWebhookEvent {eventId: $eventId})
        WHERE e.status = 'RECEIVED'
          AND e.claimToken = $claimToken

        SET e.status = 'PROCESSED',
            e.processedAt = $processedAt

        REMOVE e.claimToken

        RETURN count(e) > 0
        """)
    Boolean markProcessed(
            @Param("eventId") String eventId,
            @Param("claimToken") String claimToken,
            @Param("processedAt") String processedAt
    );

    /**
     * Marks an out-of-order event as stale.
     */
    @Query("""
        MATCH (e:CarrierWebhookEvent {eventId: $eventId})
        WHERE e.status = 'RECEIVED'
          AND e.claimToken = $claimToken

        SET e.status = 'STALE',
            e.processedAt = $processedAt

        REMOVE e.claimToken

        RETURN count(e) > 0
        """)
    Boolean markStale(
            @Param("eventId") String eventId,
            @Param("claimToken") String claimToken,
            @Param("processedAt") String processedAt
    );

    /**
     * Retrieves the latest processed event for a shipment.
     */
    @Query("""
        MATCH (e:CarrierWebhookEvent)
        WHERE e.shipmentId = $shipmentId
          AND e.status = 'PROCESSED'

        RETURN e
        ORDER BY datetime(e.occurredAt) DESC
        LIMIT 1
        """)
    Optional<CarrierWebhookEvent> findLatestProcessedEventForShipment(
            @Param("shipmentId") String shipmentId
    );

    /**
     * Returns the latest processed event timestamp.
     */
    @Query("""
        MATCH (e:CarrierWebhookEvent)
        WHERE e.shipmentId = $shipmentId
          AND e.status = 'PROCESSED'

        RETURN e.occurredAt AS occurredAt
        ORDER BY datetime(e.occurredAt) DESC
        LIMIT 1
        """)
    Optional<String> findLatestProcessedTimestamp(
            @Param("shipmentId") String shipmentId
    );
}
