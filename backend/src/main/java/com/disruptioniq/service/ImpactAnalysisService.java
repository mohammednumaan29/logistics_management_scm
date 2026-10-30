
package com.disruptioniq.service;

import com.disruptioniq.dto.response.ImpactAnalysisResponse;
import com.disruptioniq.dto.response.ImpactAnalysisResponse.AffectedOrder;

import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ImpactAnalysisService {

    private final Neo4jClient neo4jClient;

    public ImpactAnalysisService(Neo4jClient neo4jClient) {
        this.neo4jClient = neo4jClient;
    }

    // =====================================================
    // IMPACT ANALYSIS QUERY
    // =====================================================

    private static final String IMPACT_QUERY = """
            MATCH (sh:Shipment {id: $shipmentId})

            OPTIONAL MATCH (sup:Supplier)-[:SENDS]->(sh)

            OPTIONAL MATCH (sh)-[:DELIVERS_TO]->(w:Warehouse)

            OPTIONAL MATCH (w)-[:STORES]->(i:Inventory)

            OPTIONAL MATCH (i)-[:FOR]->(p:Product)

            OPTIONAL MATCH (p)-[:REQUIRED_BY]->(o:Order)

            OPTIONAL MATCH (o)-[:PLACED_BY]->(c:Customer)

            RETURN
                sh.id AS shipmentId,
                sh.status AS shipmentStatus,
                sh.quantity AS shipmentQuantity,

                sup.id AS supplierId,
                sup.name AS supplierName,

                w.id AS warehouseId,
                w.name AS warehouseName,

                i.id AS inventoryId,
                i.onHand AS onHand,
                i.reserved AS reserved,
                i.reorderPoint AS reorderPoint,
                i.dailyDemand AS dailyDemand,

                p.id AS productId,
                p.name AS productName,

                o.id AS orderId,
                o.priority AS orderPriority,
                o.quantity AS orderQuantity,
                o.promisedDelivery AS promisedDelivery,
                o.status AS orderStatus,

                c.id AS customerId,
                c.name AS customerName
            """;

    // =====================================================
    // ANALYZE SHIPMENT
    // =====================================================

    public ImpactAnalysisResponse analyzeShipment(
            String shipmentId) {

        if (shipmentId == null || shipmentId.isBlank()) {
            throw new IllegalArgumentException(
                    "Shipment ID is required."
            );
        }

        Collection<Map<String, Object>> rows = neo4jClient
                .query(IMPACT_QUERY)
                .bind(shipmentId.trim())
                .to("shipmentId")
                .fetch()
                .all();

        if (rows.isEmpty()) {
            throw new IllegalArgumentException(
                    "Shipment not found: " + shipmentId
            );
        }

        Map<String, Object> firstRow =
                rows.iterator().next();

        // =============================================
        // CHECK RELATIONSHIP CONSISTENCY
        // =============================================

        String supplierId = uniqueValue(
                rows, "supplierId", "supplier"
        );

        String supplierName = uniqueValue(
                rows, "supplierName", "supplier"
        );

        String warehouseId = uniqueValue(
                rows, "warehouseId", "warehouse"
        );

        String warehouseName = uniqueValue(
                rows, "warehouseName", "warehouse"
        );

        String inventoryId = uniqueValue(
                rows, "inventoryId", "inventory"
        );

        String productId = uniqueValue(
                rows, "productId", "product"
        );

        String productName = uniqueValue(
                rows, "productName", "product"
        );

        // =============================================
        // INVENTORY CALCULATIONS
        // =============================================

        long onHand = longValue(firstRow, "onHand");
        long reserved = longValue(firstRow, "reserved");

        if (reserved > onHand) {
            throw new IllegalStateException(
                    "Inventory data is inconsistent for inventory "
                            + inventoryId
                            + ": reserved quantity exceeds on-hand stock."
            );
        }

        long available = onHand - reserved;

        long reorderPoint =
                longValue(firstRow, "reorderPoint");

        long dailyDemand =
                longValue(firstRow, "dailyDemand");

        // =============================================
        // COLLECT UNIQUE AFFECTED ORDERS
        // =============================================

        Map<String, AffectedOrder> uniqueOrders =
                new LinkedHashMap<>();

        for (Map<String, Object> row : rows) {

            String orderId = stringValue(row, "orderId");

            if (orderId == null) {
                continue;
            }

            uniqueOrders.putIfAbsent(
                    orderId,
                    new AffectedOrder(
                            orderId,
                            stringValue(row, "orderPriority"),
                            longValue(row, "orderQuantity"),
                            dateValue(row.get("promisedDelivery")),
                            stringValue(row, "orderStatus"),
                            stringValue(row, "customerId"),
                            stringValue(row, "customerName")
                    )
            );
        }

        // =============================================
        // BUILD RESPONSE
        // =============================================

        return new ImpactAnalysisResponse(
                stringValue(firstRow, "shipmentId"),
                stringValue(firstRow, "shipmentStatus"),
                longValue(firstRow, "shipmentQuantity"),

                supplierId,
                supplierName,

                warehouseId,
                warehouseName,

                inventoryId,
                onHand,
                reserved,
                available,

                reorderPoint,
                dailyDemand,

                productId,
                productName,

                List.copyOf(uniqueOrders.values())
        );
    }

    // =====================================================
    // ENSURE A SINGLE LINKED VALUE
    // =====================================================

    private String uniqueValue(
            Collection<Map<String, Object>> rows,
            String field,
            String relationshipName) {

        Set<String> values = new LinkedHashSet<>();

        for (Map<String, Object> row : rows) {

            String value = stringValue(row, field);

            if (value != null && !value.isBlank()) {
                values.add(value);
            }
        }

        if (values.size() > 1) {
            throw new IllegalStateException(
                    "Shipment has multiple linked "
                            + relationshipName
                            + " records. Impact analysis requires "
                            + "an unambiguous relationship."
            );
        }

        return values.isEmpty()
                ? null
                : values.iterator().next();
    }

    // =====================================================
    // STRING CONVERSION
    // =====================================================

    private String stringValue(
            Map<String, Object> row,
            String key) {

        Object value = row.get(key);

        return value == null
                ? null
                : value.toString();
    }

    // =====================================================
    // LONG CONVERSION
    // =====================================================

    private long longValue(
            Map<String, Object> row,
            String key) {

        Object value = row.get(key);

        if (value instanceof Number number) {
            return number.longValue();
        }

        if (value == null) {
            return 0L;
        }

        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException exception) {
            throw new IllegalStateException(
                    "Invalid numeric value for " + key + "."
            );
        }
    }

    // =====================================================
    // DATE CONVERSION
    // =====================================================

    private LocalDate dateValue(Object value) {

        if (value == null) {
            return null;
        }

        if (value instanceof LocalDate date) {
            return date;
        }

        try {
            return LocalDate.parse(value.toString());
        } catch (RuntimeException exception) {
            throw new IllegalStateException(
                    "Invalid promised delivery date in the database.",
                    exception
            );
        }
    }
}
