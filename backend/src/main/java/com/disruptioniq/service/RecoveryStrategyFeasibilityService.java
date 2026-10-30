package com.disruptioniq.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import com.disruptioniq.dto.request.SimulationRequest;
import com.disruptioniq.dto.response.RecoveryFeasibilityResponse;

@Service
public class RecoveryStrategyFeasibilityService {

    private final Neo4jClient neo4jClient;

    public RecoveryStrategyFeasibilityService(
            Neo4jClient neo4jClient
    ) {
        this.neo4jClient = neo4jClient;
    }

    private static final String SHIPMENT_IMPACT_QUERY = """
            MATCH (s:Shipment {id: $shipmentId})
            OPTIONAL MATCH (s)-[:DELIVERS_TO]->(w:Warehouse)
                  -[:STORES]->(i:Inventory)
                  -[:FOR]->(p:Product)
            OPTIONAL MATCH (p)-[:REQUIRED_BY]->(o:Order)
            RETURN
                s.id AS shipmentId,
                collect(DISTINCT {
                    warehouseId: w.id,
                    inventoryId: i.id,
                    onHand: i.onHand,
                    reserved: i.reserved,
                    reorderPoint: i.reorderPoint,
                    dailyDemand: i.dailyDemand,
                    productId: p.id
                }) AS inventories,
                collect(DISTINCT {
                    id: o.id,
                    quantity: o.quantity
                }) AS orders
            """;

    private static final String SOURCE_INVENTORY_QUERY = """
            MATCH (w:Warehouse {id: $warehouseId})
                  -[:STORES]->(i:Inventory)
                  -[:FOR]->(p:Product {id: $productId})
            RETURN
                w.id AS warehouseId,
                i.id AS inventoryId,
                i.onHand AS onHand,
                i.reserved AS reserved,
                i.dailyDemand AS dailyDemand,
                i.reorderPoint AS reorderPoint,
                p.id AS productId
            """;

    private static final String ALTERNATIVE_SUPPLIER_QUERY = """
            MATCH (s:Supplier {id: $supplierId})
            RETURN
                s.id AS supplierId,
                s.status AS status,
                s.leadTimeDays AS leadTimeDays
            """;

    public RecoveryFeasibilityResponse evaluate(
            SimulationRequest request
    ) {
        validateRequest(request);

        Map<String, Object> shipment = neo4jClient
                .query(SHIPMENT_IMPACT_QUERY)
                .bind(request.shipmentId()).to("shipmentId")
                .fetch()
                .one()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Shipment not found: " + request.shipmentId()
                ));

        List<Map<String, Object>> inventories =
                mapList(shipment.get("inventories"));

        List<Map<String, Object>> orders =
                mapList(shipment.get("orders"));

        Map<String, Object> destinationInventory =
                resolveInventory(inventories);

        long available = 0L;
        String destinationWarehouseId = null;
        String destinationProductId = null;

        if (destinationInventory != null) {

            long onHand = requiredNumber(destinationInventory, "onHand");
            long reserved = requiredNumber(destinationInventory, "reserved");
            long dailyDemand = requiredNumber(destinationInventory, "dailyDemand");
            long reorderPoint = requiredNumber(destinationInventory, "reorderPoint");

            validateInventoryValues(
                    onHand,
                    reserved,
                    dailyDemand,
                    reorderPoint
            );

            available = onHand - reserved;

            destinationWarehouseId =
                    stringValue(destinationInventory.get("warehouseId"));

            destinationProductId =
                    stringValue(destinationInventory.get("productId"));
        }

        long totalOrderQuantity = calculateTotalOrderQuantity(orders);

        List<String> warnings = new ArrayList<>();

        if (destinationInventory == null) {
            warnings.add(
                    "No unique linked inventory record was found for this shipment."
            );
        }

        return switch (request.strategy()) {

            case DO_NOTHING -> response(
                    request,
                    true,
                    "Baseline scenario is available for comparison.",
                    available,
                    totalOrderQuantity,
                    request.delayDays(),
                    0.0,
                    warnings
            );

            case REALLOCATE_STOCK -> evaluateReallocation(
                    request,
                    available,
                    destinationWarehouseId,
                    destinationProductId,
                    warnings
            );

            case EXPEDITE_SHIPMENT -> evaluateExpedite(
                    request,
                    available,
                    totalOrderQuantity,
                    warnings
            );

            case ALTERNATIVE_SUPPLIER -> evaluateAlternativeSupplier(
                    request,
                    available,
                    totalOrderQuantity,
                    warnings
            );

            case SPLIT_ORDER -> evaluateSplit(
                    request,
                    available,
                    totalOrderQuantity,
                    warnings
            );
        };
    }

    private RecoveryFeasibilityResponse evaluateReallocation(
            SimulationRequest request,
            long destinationAvailable,
            String destinationWarehouseId,
            String destinationProductId,
            List<String> warnings
    ) {
        String sourceWarehouseId = request.sourceWarehouseId();
        long quantity = request.reallocationQuantity();

        if (sourceWarehouseId == null || sourceWarehouseId.isBlank()) {
            return response(
                    request, false,
                    "A source warehouse ID is required.",
                    0, quantity, 0, 0, warnings
            );
        }

        if (destinationWarehouseId == null || destinationProductId == null) {
            return response(
                    request, false,
                    "Destination warehouse and product must be identified before reallocation.",
                    destinationAvailable, quantity, 0, 0, warnings
            );
        }

        if (sourceWarehouseId.equals(destinationWarehouseId)) {
            return response(
                    request, false,
                    "Source and destination warehouses must be different.",
                    destinationAvailable, quantity, 0, 0, warnings
            );
        }

        Map<String, Object> source = neo4jClient
                .query(SOURCE_INVENTORY_QUERY)
                .bind(sourceWarehouseId).to("warehouseId")
                .bind(destinationProductId).to("productId")
                .fetch()
                .one()
                .orElse(null);

        if (source == null) {
            return response(
                    request, false,
                    "Source warehouse does not have inventory for the required product.",
                    0, quantity, 0, 0, warnings
            );
        }

        long onHand = requiredNumber(source, "onHand");
        long reserved = requiredNumber(source, "reserved");
        long dailyDemand = requiredNumber(source, "dailyDemand");
        long reorderPoint = requiredNumber(source, "reorderPoint");

        validateInventoryValues(
                onHand,
                reserved,
                dailyDemand,
                reorderPoint
        );

        long sourceAvailable = onHand - reserved;

        if (quantity > sourceAvailable) {
            return response(
                    request, false,
                    "Source warehouse does not have enough available stock.",
                    sourceAvailable, quantity, 0, 0, warnings
            );
        }

        long remainingSourceStock = sourceAvailable - quantity;
        long protectedStock = Math.max(dailyDemand, reorderPoint);

        if (remainingSourceStock < protectedStock) {
            return response(
                    request, false,
                    "Reallocation would reduce source inventory below its demand/reorder protection threshold.",
                    sourceAvailable, quantity, 0, 0, warnings
            );
        }

        warnings.add(
                "Transfer lead time and transfer cost must be confirmed before execution."
        );

        warnings.add(
                "Destination warehouse capacity must be confirmed before execution."
        );

        return response(
                request, true,
                "Source inventory is sufficient and product-compatible.",
                sourceAvailable, quantity, 0, 0, warnings
        );
    }

    private RecoveryFeasibilityResponse evaluateExpedite(
            SimulationRequest request,
            long available,
            long orderQuantity,
            List<String> warnings
    ) {
        int arrivalDays = request.expeditedArrivalDays();
        double cost = request.expediteCost();

        if (arrivalDays < 1) {
            return response(
                    request, false,
                    "Expedited arrival time must be at least one day.",
                    available, orderQuantity, 0, 0, warnings
            );
        }

        if (arrivalDays >= request.delayDays()) {
            return response(
                    request, false,
                    "Expedited arrival must be earlier than the delayed arrival.",
                    available, orderQuantity, arrivalDays, cost, warnings
            );
        }

        if (!Double.isFinite(cost) || cost < 0) {
            return response(
                    request, false,
                    "Expedite cost must be a finite, non-negative value.",
                    available, orderQuantity, arrivalDays, 0, warnings
            );
        }

        warnings.add(
                "Carrier availability and the quoted delivery time must be confirmed before execution."
        );

        return response(
                request, true,
                "Expedited delivery parameters are valid.",
                available, orderQuantity, arrivalDays, cost, warnings
        );
    }

    private RecoveryFeasibilityResponse evaluateAlternativeSupplier(
            SimulationRequest request,
            long available,
            long orderQuantity,
            List<String> warnings
    ) {
        String supplierId = request.alternativeSupplierId();

        if (supplierId == null || supplierId.isBlank()) {
            return response(
                    request, false,
                    "An alternative supplier ID is required.",
                    available, orderQuantity, 0, 0, warnings
            );
        }

        Map<String, Object> supplier = neo4jClient
                .query(ALTERNATIVE_SUPPLIER_QUERY)
                .bind(supplierId).to("supplierId")
                .fetch()
                .one()
                .orElse(null);

        if (supplier == null) {
            return response(
                    request, false,
                    "Alternative supplier was not found.",
                    available, orderQuantity, 0, 0, warnings
            );
        }

        String status = stringValue(supplier.get("status"));

        if (!"ACTIVE".equalsIgnoreCase(status)) {
            return response(
                    request, false,
                    "Alternative supplier is not active.",
                    available, orderQuantity, 0, 0, warnings
            );
        }

        Long leadTime = optionalNumber(supplier.get("leadTimeDays"));

        if (leadTime == null
                || leadTime < 0
                || leadTime > Integer.MAX_VALUE) {
            return response(
                    request, false,
                    "Alternative supplier lead time is missing or invalid.",
                    available, orderQuantity, 0, 0, warnings
            );
        }

        if (leadTime >= request.delayDays()) {
            return response(
                    request, false,
                    "Alternative supplier lead time is not shorter than the disruption delay.",
                    available, orderQuantity, leadTime.intValue(), 0, warnings
            );
        }

        warnings.add(
                "Supplier product capability, available capacity, stock quantity, and price are not represented in the current Supplier model."
        );

        warnings.add(
                "Confirm supplier capability and commercial terms before treating this strategy as execution-ready."
        );

        // The supplier is promising, but the current graph model cannot
        // prove that it can supply the required product and quantity.
        return response(
                request, false,
                "Supplier is active and has a shorter lead time, but supply capability is not verified.",
                available, orderQuantity, leadTime.intValue(), 0, warnings
        );
    }

    private RecoveryFeasibilityResponse evaluateSplit(
            SimulationRequest request,
            long available,
            long orderQuantity,
            List<String> warnings
    ) {
        long splitQuantity = request.splitQuantity();

        if (orderQuantity <= 0) {
            return response(
                    request, false,
                    "No valid linked order quantity is available.",
                    available, splitQuantity, 0, 0, warnings
            );
        }

        if (splitQuantity >= orderQuantity) {
            return response(
                    request, false,
                    "Immediate split quantity must be smaller than the total linked order quantity.",
                    available, splitQuantity, 0, 0, warnings
            );
        }

        if (splitQuantity > available) {
            return response(
                    request, false,
                    "The immediate shipment quantity exceeds available stock.",
                    available, splitQuantity, 0, 0, warnings
            );
        }

        long remaining = orderQuantity - splitQuantity;

        warnings.add(
                "A delivery plan and deadline for the remaining "
                        + remaining
                        + " units must be confirmed."
        );

        warnings.add(
                "Split-order execution is not enabled until child-shipment creation is implemented."
        );

        return response(
                request, true,
                "The order can be split into an immediate quantity of "
                        + splitQuantity
                        + " and a remaining quantity of "
                        + remaining
                        + ".",
                available, splitQuantity, 0, 0, warnings
        );
    }

    private Map<String, Object> resolveInventory(
            List<Map<String, Object>> inventories
    ) {
        if (inventories == null) {
            return null;
        }

        List<Map<String, Object>> validInventories =
                inventories.stream()
                        .filter(item -> item.get("inventoryId") != null)
                        .toList();

        if (validInventories.size() > 1) {
            throw new IllegalStateException(
                    "Shipment has multiple linked inventory records. "
                            + "Feasibility cannot be evaluated unambiguously."
            );
        }

        return validInventories.isEmpty()
                ? null
                : validInventories.get(0);
    }

    private long calculateTotalOrderQuantity(
            List<Map<String, Object>> orders
    ) {
        if (orders == null) {
            return 0L;
        }

        long total = 0L;

        for (Map<String, Object> order : orders) {

            if (order.get("id") == null) {
                continue;
            }

            long quantity = requiredNumber(order, "quantity");

            if (quantity < 0) {
                throw new IllegalStateException(
                        "Linked order quantity cannot be negative."
                );
            }

            try {
                total = Math.addExact(total, quantity);
            } catch (ArithmeticException exception) {
                throw new IllegalStateException(
                        "Total linked order quantity exceeds the supported calculation range."
                );
            }
        }

        return total;
    }

    private List<Map<String, Object>> mapList(Object value) {

        if (!(value instanceof List<?> list)) {
            return List.of();
        }

        List<Map<String, Object>> result = new ArrayList<>();

        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> typedMap = (Map<String, Object>) map;
                result.add(typedMap);
            }
        }

        return result;
    }

    private void validateRequest(SimulationRequest request) {

        if (request == null
                || request.shipmentId() == null
                || request.shipmentId().isBlank()
                || request.strategy() == null) {
            throw new IllegalArgumentException(
                    "Shipment ID and recovery strategy are required."
            );
        }

        if (request.delayDays() < 1) {
            throw new IllegalArgumentException(
                    "Delay days must be at least one."
            );
        }

        if (request.expeditedArrivalDays() < 1) {
            throw new IllegalArgumentException(
                    "Expedited arrival days must be at least one."
            );
        }

        if (request.reallocationQuantity() < 1
                || request.splitQuantity() < 1) {
            throw new IllegalArgumentException(
                    "Recovery quantities must be at least one."
            );
        }

        if (!Double.isFinite(request.expediteCost())
                || request.expediteCost() < 0) {
            throw new IllegalArgumentException(
                    "Expedite cost must be a finite, non-negative value."
            );
        }
    }

    private void validateInventoryValues(
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
                    "Inventory contains invalid stock, reservation, demand, or reorder-point values."
            );
        }
    }

    private long requiredNumber(
            Map<String, Object> values,
            String field
    ) {
        Long result = optionalNumber(values.get(field));

        if (result == null) {
            throw new IllegalStateException(
                    "Required inventory or order value is missing: " + field
            );
        }

        return result;
    }

    private Long optionalNumber(Object value) {

        if (value instanceof Number number) {
            return number.longValue();
        }

        if (value == null) {
            return null;
        }

        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private RecoveryFeasibilityResponse response(
            SimulationRequest request,
            boolean feasible,
            String reason,
            long available,
            long requested,
            int recoveryDays,
            double cost,
            List<String> warnings
    ) {
        return new RecoveryFeasibilityResponse(
                request.shipmentId(),
                request.strategy().name(),
                feasible,
                reason,
                Math.max(0L, available),
                Math.max(0L, requested),
                Math.max(0, recoveryDays),
                Math.max(0.0, cost),
                List.copyOf(warnings)
        );
    }
}