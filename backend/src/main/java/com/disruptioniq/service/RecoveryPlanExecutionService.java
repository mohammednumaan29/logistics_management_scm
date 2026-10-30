package com.disruptioniq.service;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.disruptioniq.dto.request.SimulationRequest.Strategy;
import com.disruptioniq.model.RecoveryPlan;
import com.disruptioniq.repository.RecoveryPlanRepository;

@Service
public class RecoveryPlanExecutionService {

    private final RecoveryPlanRepository planRepository;
    private final Neo4jClient neo4jClient;
    private final AuditEventService auditEventService;
    private final NotificationService notificationService;

    public RecoveryPlanExecutionService(
            RecoveryPlanRepository planRepository,
            Neo4jClient neo4jClient,
            AuditEventService auditEventService,
            NotificationService notificationService
    ) {
        this.planRepository = planRepository;
        this.neo4jClient = neo4jClient;
        this.auditEventService = auditEventService;
        this.notificationService = notificationService;
    }

    @Transactional
    public RecoveryPlan execute(
            String planId,
            String authenticatedUserId
    ) {
        validateExecutionRequest(planId, authenticatedUserId);

        RecoveryPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Recovery plan not found: " + planId
                ));

        if (!"APPROVED".equalsIgnoreCase(plan.getStatus())) {
            throw new IllegalStateException(
                    "Only approved recovery plans can be executed."
            );
        }

        if (authenticatedUserId.equals(plan.getCreatedBy())) {
            throw new IllegalStateException(
                    "The recovery-plan creator cannot execute this plan."
            );
        }

        if (plan.getExecutedAt() != null
                || "COMPLETED".equalsIgnoreCase(plan.getExecutionStatus())
                || "EXECUTING".equalsIgnoreCase(plan.getExecutionStatus())) {
            throw new IllegalStateException(
                    "This recovery plan has already been executed or is currently executing."
            );
        }

        Strategy strategy;

        try {
            strategy = Strategy.valueOf(plan.getStrategy());
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(
                    "Recovery plan contains an invalid strategy."
            );
        }

        /*
         * RecoveryPlan uses @Version optimistic locking.
         * Saving the intermediate state helps prevent two requests
         * from executing the same plan concurrently.
         *
         * This method is transactional. If the operational update
         * fails, the transaction should roll back.
         */
        plan.setExecutionStatus("EXECUTING");
        plan.setExecutionMessage("Execution has started.");

        planRepository.save(plan);

        switch (strategy) {

            case DO_NOTHING ->
                    executeDoNothing(plan);

            case REALLOCATE_STOCK ->
                    executeReallocation(plan);

            case EXPEDITE_SHIPMENT ->
                    executeExpedite(plan);

            case ALTERNATIVE_SUPPLIER ->
                    executeAlternativeSupplier(plan);

            case SPLIT_ORDER ->
                    throw new IllegalStateException(
                            "Split-order execution is not enabled. "
                                    + "Child shipment creation must be implemented first."
                    );
        }

        LocalDateTime executedAt = LocalDateTime.now();

        plan.setStatus("EXECUTED");
        plan.setExecutionStatus("COMPLETED");
        plan.setExecutionMessage(
                "Recovery strategy executed successfully."
        );
        plan.setExecutedAt(executedAt);
        plan.setExecutedBy(authenticatedUserId);

        RecoveryPlan saved = planRepository.save(plan);

        auditEventService.recordEvent(
                "RECOVERY_PLAN",
                saved.getId(),
                "PLAN_EXECUTED",
                authenticatedUserId,
                "Executed approved strategy: " + saved.getStrategy()
        );

        if (saved.getCreatedBy() != null
                && !saved.getCreatedBy().isBlank()) {

            notificationService.createNotification(
                    saved.getCreatedBy(),
                    "Recovery completed",
                    "Recovery plan " + saved.getId()
                            + " was executed successfully.",
                    "SUCCESS",
                    "RECOVERY_PLAN",
                    saved.getId()
            );
        }

        return saved;
    }

    private void executeDoNothing(RecoveryPlan plan) {
        /*
         * DO_NOTHING intentionally makes no operational changes.
         * The execution status and audit record are still updated.
         */
    }

    private void executeReallocation(RecoveryPlan plan) {

        if (plan.getShipmentId() == null
                || plan.getShipmentId().isBlank()
                || plan.getSourceWarehouseId() == null
                || plan.getSourceWarehouseId().isBlank()
                || plan.getReallocationQuantity() == null
                || plan.getReallocationQuantity() <= 0) {

            throw new IllegalArgumentException(
                    "Approved plan is missing valid reallocation parameters."
            );
        }

        long quantity = plan.getReallocationQuantity();

        Map<String, Object> destination = queryOne(
                """
                MATCH (s:Shipment {id: $shipmentId})
                      -[:DELIVERS_TO]->(destination:Warehouse)
                      -[:STORES]->(destinationInventory:Inventory)
                      -[:FOR]->(product:Product)
                RETURN
                    destination.id AS warehouseId,
                    destinationInventory.id AS inventoryId,
                    destinationInventory.onHand AS onHand,
                    destination.capacity AS capacity,
                    product.id AS productId
                """,
                "shipmentId",
                plan.getShipmentId()
        );

        Map<String, Object> source = queryOne(
                """
                MATCH (source:Warehouse {id: $sourceWarehouseId})
                      -[:STORES]->(sourceInventory:Inventory)
                      -[:FOR]->(product:Product)
                RETURN
                    source.id AS warehouseId,
                    sourceInventory.id AS inventoryId,
                    sourceInventory.onHand AS onHand,
                    sourceInventory.reserved AS reserved,
                    sourceInventory.dailyDemand AS dailyDemand,
                    sourceInventory.reorderPoint AS reorderPoint,
                    product.id AS productId
                """,
                "sourceWarehouseId",
                plan.getSourceWarehouseId()
        );

        String destinationWarehouseId =
                stringValue(destination.get("warehouseId"));

        String destinationInventoryId =
                stringValue(destination.get("inventoryId"));

        String destinationProductId =
                stringValue(destination.get("productId"));

        String sourceInventoryId =
                stringValue(source.get("inventoryId"));

        String sourceProductId =
                stringValue(source.get("productId"));

        if (destinationInventoryId == null
                || sourceInventoryId == null
                || destinationProductId == null
                || !destinationProductId.equals(sourceProductId)) {

            throw new IllegalStateException(
                    "Source inventory does not match the destination product."
            );
        }

        if (plan.getSourceWarehouseId().equals(destinationWarehouseId)) {
            throw new IllegalStateException(
                    "Source and destination warehouses must be different."
            );
        }

        long sourceOnHand = requiredNumber(source, "onHand");
        long sourceReserved = requiredNumber(source, "reserved");
        long sourceDailyDemand = requiredNumber(source, "dailyDemand");
        long sourceReorderPoint = requiredNumber(source, "reorderPoint");

        validateInventory(
                sourceOnHand,
                sourceReserved,
                sourceDailyDemand,
                sourceReorderPoint
        );

        long destinationOnHand =
                requiredNumber(destination, "onHand");

        long destinationCapacity =
                requiredNumber(destination, "capacity");

        if (destinationOnHand < 0 || destinationCapacity < 0) {
            throw new IllegalStateException(
                    "Destination warehouse contains invalid capacity or inventory values."
            );
        }

        long sourceAvailable = sourceOnHand - sourceReserved;

        if (quantity > sourceAvailable) {
            throw new IllegalStateException(
                    "Insufficient available stock at the source warehouse."
            );
        }

        long remainingAvailable = sourceAvailable - quantity;

        long protectedStock = Math.max(
                sourceDailyDemand,
                sourceReorderPoint
        );

        if (remainingAvailable < protectedStock) {
            throw new IllegalStateException(
                    "Reallocation would reduce source inventory below "
                            + "its demand/reorder protection threshold."
            );
        }

        if (destinationOnHand > destinationCapacity
                || quantity > destinationCapacity - destinationOnHand) {
            throw new IllegalStateException(
                    "Destination warehouse does not have enough remaining capacity."
            );
        }

        /*
         * Revalidate stock and capacity inside the actual update query.
         * This reduces the chance of using stale inventory values.
         */
        Map<String, Object> result = neo4jClient.query(
                """
                MATCH (source:Warehouse {id: $sourceWarehouseId})
                      -[:STORES]->(si:Inventory {id: $sourceInventoryId})

                MATCH (destination:Warehouse {id: $destinationWarehouseId})
                      -[:STORES]->(di:Inventory {id: $destinationInventoryId})

                WHERE si.onHand >= si.reserved
                  AND si.onHand - si.reserved >= $quantity

                  AND si.onHand - si.reserved - $quantity
                      >= CASE
                          WHEN si.dailyDemand > si.reorderPoint
                          THEN si.dailyDemand
                          ELSE si.reorderPoint
                         END

                  AND di.onHand >= 0
                  AND destination.capacity >= 0
                  AND di.onHand <= destination.capacity
                  AND $quantity <= destination.capacity - di.onHand

                  AND di.onHand <= 9223372036854775807 - $quantity

                SET si.onHand = si.onHand - $quantity,
                    di.onHand = di.onHand + $quantity

                RETURN
                    si.id AS sourceInventoryId,
                    di.id AS destinationInventoryId
                """
        )
                .bind(plan.getSourceWarehouseId())
                .to("sourceWarehouseId")
                .bind(sourceInventoryId)
                .to("sourceInventoryId")
                .bind(destinationWarehouseId)
                .to("destinationWarehouseId")
                .bind(destinationInventoryId)
                .to("destinationInventoryId")
                .bind(quantity)
                .to("quantity")
                .fetch()
                .one()
                .orElse(null);

        if (result == null) {
            throw new IllegalStateException(
                    "Stock or capacity conditions changed, or inventory could not be updated. "
                            + "Reallocation was not completed."
            );
        }
    }

    private void executeExpedite(RecoveryPlan plan) {

        if (plan.getShipmentId() == null
                || plan.getShipmentId().isBlank()
                || plan.getExpeditedArrivalDays() == null
                || plan.getExpeditedArrivalDays() < 1) {

            throw new IllegalArgumentException(
                    "Approved plan is missing valid expedited-arrival parameters."
            );
        }

        /*
         * The approved arrival-days value is interpreted as days
         * from the execution date.
         *
         * The update is permitted only when the new expected date
         * is earlier than the shipment's current expected date.
         */
        Map<String, Object> result = neo4jClient.query(
                """
                MATCH (s:Shipment {id: $shipmentId})
                WITH s, date() + duration({days: $arrivalDays}) AS newExpectedDelivery
                WHERE s.expectedDelivery IS NOT NULL
                  AND newExpectedDelivery < s.expectedDelivery

                SET s.expectedDelivery = newExpectedDelivery,
                    s.status = 'EXPEDITED'

                RETURN
                    s.id AS shipmentId,
                    s.expectedDelivery AS expectedDelivery,
                    s.status AS status
                """
        )
                .bind(plan.getShipmentId())
                .to("shipmentId")
                .bind(plan.getExpeditedArrivalDays())
                .to("arrivalDays")
                .fetch()
                .one()
                .orElse(null);

        if (result == null) {
            throw new IllegalStateException(
                    "Shipment could not be expedited. Verify that it exists, "
                            + "has an expected delivery date, and the new date "
                            + "is earlier than its current expected delivery."
            );
        }
    }

    private void executeAlternativeSupplier(RecoveryPlan plan) {

        if (plan.getAlternativeSupplierId() == null
                || plan.getAlternativeSupplierId().isBlank()) {

            throw new IllegalArgumentException(
                    "Approved plan is missing an alternative supplier."
            );
        }

        /*
         * The current Supplier model contains status and lead time,
         * but does not contain verified product capability,
         * available quantity, or capacity.
         *
         * Do not change the shipment's supplier relationship based
         * only on the supplier's ACTIVE status.
         */
        throw new IllegalStateException(
                "Alternative-supplier execution is not enabled yet. "
                        + "Supplier product capability, available quantity, "
                        + "and capacity must be verified before reassignment."
        );
    }

    private Map<String, Object> queryOne(
            String query,
            String parameter,
            String value
    ) {
        return neo4jClient.query(query)
                .bind(value)
                .to(parameter)
                .fetch()
                .one()
                .orElseThrow(() -> new IllegalStateException(
                        "Required operational data was not found."
                ));
    }

    private void validateExecutionRequest(
            String planId,
            String authenticatedUserId
    ) {
        if (planId == null || planId.isBlank()) {
            throw new IllegalArgumentException(
                    "Recovery plan ID is required."
            );
        }

        if (authenticatedUserId == null
                || authenticatedUserId.isBlank()) {
            throw new IllegalArgumentException(
                    "Authenticated user ID is required."
            );
        }
    }

    private void validateInventory(
            long onHand,
            long reserved,
            long dailyDemand,
            long reorderPoint
    ) {
        if (onHand < 0
                || reserved < 0
                || reserved > onHand
                || dailyDemand < 0
                || reorderPoint < 0) {

            throw new IllegalStateException(
                    "Source inventory contains invalid values."
            );
        }
    }

    private long requiredNumber(
            Map<String, Object> values,
            String field
    ) {
        Object value = values.get(field);

        if (!(value instanceof Number number)) {
            throw new IllegalStateException(
                    "Required operational value is missing or invalid: "
                            + field
            );
        }

        return number.longValue();
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }
}