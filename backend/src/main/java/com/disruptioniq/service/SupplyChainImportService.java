
package com.disruptioniq.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.disruptioniq.dto.response.ImportResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class SupplyChainImportService {

    private static final int MAX_ROWS = 10_000;
    private static final int MAX_ERRORS = 100;
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;

    private final Neo4jClient neo4jClient;
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;
    private final AuditEventService auditEventService;

    public SupplyChainImportService(
            Neo4jClient neo4jClient,
            ObjectMapper objectMapper,
            NotificationService notificationService,
            AuditEventService auditEventService) {

        this.neo4jClient = neo4jClient;
        this.objectMapper = objectMapper;
        this.notificationService = notificationService;
        this.auditEventService = auditEventService;
    }

    // =========================================================
    // IMPORT FILE
    // =========================================================

    public ImportResponse importFile(
            String entityType,
            MultipartFile file,
            String authenticatedUserId) {

        if (authenticatedUserId == null
                || authenticatedUserId.isBlank()) {

            throw new IllegalArgumentException(
                    "Authenticated user ID is required."
            );
        }

        if (file == null || file.isEmpty()) {

            throw new IllegalArgumentException(
                    "Please upload a non-empty CSV or JSON file."
            );
        }

        if (file.getSize() > MAX_FILE_SIZE) {

            throw new IllegalArgumentException(
                    "The maximum import file size is 10 MB."
            );
        }

        String normalizedType = normalizeEntityType(entityType);

        String filename = file.getOriginalFilename();

        if (filename == null || filename.isBlank()) {

            throw new IllegalArgumentException(
                    "The uploaded file must have a filename."
            );
        }

        String lowerFilename =
                filename.toLowerCase(Locale.ROOT);

        List<Map<String, String>> rows;

        try {

            String content = new String(
                    file.getBytes(),
                    StandardCharsets.UTF_8
            );

            if (lowerFilename.endsWith(".json")) {

                rows = parseJson(content);

            } else if (lowerFilename.endsWith(".csv")) {

                rows = parseCsv(content);

            } else {

                throw new IllegalArgumentException(
                        "Only .csv and .json files are supported."
                );
            }

        } catch (IOException exception) {

            throw new IllegalArgumentException(
                    "Unable to read the uploaded file."
            );
        }

        if (rows.isEmpty()) {

            throw new IllegalArgumentException(
                    "The uploaded file contains no data rows."
            );
        }

        if (rows.size() > MAX_ROWS) {

            throw new IllegalArgumentException(
                    "An import cannot contain more than "
                            + MAX_ROWS + " rows."
            );
        }

        ImportResponse response = importRows(
                normalizedType,
                rows
        );

        // Record the import operation in audit history.

        String entityId =
                normalizedType.toUpperCase(Locale.ROOT);

        String auditReason =
                "Import type: " + response.entityType()
                + ". Total rows: " + response.totalRows()
                + ", imported: " + response.importedRows()
                + ", rejected: " + response.rejectedRows() + ".";

        auditEventService.recordEvent(
                "IMPORT",
                entityId,
                "DATA_IMPORTED",
                authenticatedUserId,
                auditReason
        );

        // Notify the user who initiated the import.

        createImportNotification(
                authenticatedUserId,
                response
        );

        return response;
    }

    // =========================================================
    // IMPORT NOTIFICATION
    // =========================================================

    private void createImportNotification(
            String authenticatedUserId,
            ImportResponse response) {

        String notificationType =
                response.rejectedRows() == 0
                        ? "SUCCESS"
                        : "WARNING";

        String title =
                response.rejectedRows() == 0
                        ? "Data Import Completed"
                        : "Data Import Completed with Errors";

        String message =
                "Import type: " + response.entityType()
                + ". Total rows: " + response.totalRows()
                + ", imported: " + response.importedRows()
                + ", rejected: " + response.rejectedRows() + ".";

        notificationService.createNotification(
                authenticatedUserId,
                title,
                message,
                notificationType,
                "IMPORT",
                response.entityType().toUpperCase(Locale.ROOT)
        );
    }

    // =========================================================
    // ENTITY TYPE NORMALIZATION
    // =========================================================

    private String normalizeEntityType(String entityType) {

        if (entityType == null || entityType.isBlank()) {

            throw new IllegalArgumentException(
                    "Entity type is required."
            );
        }

        return switch (
                entityType.trim().toLowerCase(Locale.ROOT)
        ) {

            case "supplier", "suppliers" -> "suppliers";

            case "shipment", "shipments" -> "shipments";

            case "warehouse", "warehouses" -> "warehouses";

            case "inventory" -> "inventory";

            case "product", "products" -> "products";

            case "customer", "customers" -> "customers";

            case "order", "orders" -> "orders";

            default -> throw new IllegalArgumentException(
                    "Unsupported entity type: " + entityType
            );
        };
    }

    // =========================================================
    // JSON PARSING
    // =========================================================

    private List<Map<String, String>> parseJson(
            String content) {

        try {

            JsonNode root = objectMapper.readTree(content);

            JsonNode records = root;

            if (root != null
                    && root.isObject()
                    && root.has("records")) {

                records = root.get("records");
            }

            if (records == null || !records.isArray()) {

                throw new IllegalArgumentException(
                        "JSON must be an array of objects or an object "
                                + "containing a records array."
                );
            }

            if (records.size() > MAX_ROWS) {

                throw new IllegalArgumentException(
                        "An import cannot contain more than "
                                + MAX_ROWS + " rows."
                );
            }

            List<Map<String, String>> result =
                    new ArrayList<>();

            for (JsonNode record : records) {

                if (!record.isObject()) {

                    throw new IllegalArgumentException(
                            "Each JSON record must be an object."
                    );
                }

                Map<String, String> row =
                        new LinkedHashMap<>();

                record.properties().forEach(entry -> {

                    String key = entry.getKey();

                    JsonNode value = entry.getValue();

                    if (value == null || value.isNull()) {

                        row.put(key, null);

                    } else if (value.isValueNode()) {

                        row.put(key, value.asText());

                    } else {

                        throw new IllegalArgumentException(
                                "Nested JSON values are not supported "
                                        + "for field: " + key
                        );
                    }
                });

                result.add(row);
            }

            return result;

        } catch (IOException exception) {

            throw new IllegalArgumentException(
                    "The uploaded JSON file is invalid."
            );
        }
    }

    // =========================================================
    // CSV PARSING
    // =========================================================

    private List<Map<String, String>> parseCsv(
            String content) {

        List<List<String>> records = new ArrayList<>();

        try (BufferedReader reader =
                     new BufferedReader(
                             new StringReader(content))) {

            List<String> row = new ArrayList<>();

            StringBuilder field = new StringBuilder();

            boolean insideQuotes = false;

            int character;

            while ((character = reader.read()) != -1) {

                char current = (char) character;

                if (insideQuotes) {

                    if (current == '"') {

                        reader.mark(1);

                        int next = reader.read();

                        if (next == '"') {

                            field.append('"');

                        } else {

                            insideQuotes = false;

                            if (next != -1) {
                                reader.reset();
                            }
                        }

                    } else {

                        field.append(current);
                    }

                } else if (current == '"') {

                    if (field.length() != 0) {

                        throw new IllegalArgumentException(
                                "Invalid CSV quoting."
                        );
                    }

                    insideQuotes = true;

                } else if (current == ',') {

                    row.add(field.toString());

                    field.setLength(0);

                } else if (current == '\n'
                        || current == '\r') {

                    if (current == '\r') {

                        reader.mark(1);

                        int next = reader.read();

                        if (next != '\n' && next != -1) {
                            reader.reset();
                        }
                    }

                    row.add(field.toString());

                    field.setLength(0);

                    if (!(row.size() == 1
                            && row.get(0).isBlank())) {

                        records.add(row);
                    }

                    row = new ArrayList<>();

                } else {

                    field.append(current);
                }
            }

            if (insideQuotes) {

                throw new IllegalArgumentException(
                        "CSV contains an unclosed quoted field."
                );
            }

            if (field.length() > 0 || !row.isEmpty()) {

                row.add(field.toString());

                records.add(row);
            }

        } catch (IOException exception) {

            throw new IllegalArgumentException(
                    "Unable to parse the CSV file."
            );
        }

        if (records.isEmpty()) {
            return List.of();
        }

        List<String> headers = records.get(0)
                .stream()
                .map(String::trim)
                .toList();

        if (headers.stream().anyMatch(String::isBlank)
                || headers.stream().distinct().count()
                        != headers.size()) {

            throw new IllegalArgumentException(
                    "CSV headers must be non-empty and unique."
            );
        }

        List<Map<String, String>> result =
                new ArrayList<>();

        for (int index = 1;
                index < records.size();
                index++) {

            List<String> values = records.get(index);

            if (values.size() != headers.size()) {

                throw new IllegalArgumentException(
                        "CSV row " + (index + 1)
                                + " has a different number of columns "
                                + "than the header."
                );
            }

            Map<String, String> row =
                    new LinkedHashMap<>();

            for (int column = 0;
                    column < headers.size();
                    column++) {

                row.put(
                        headers.get(column),
                        values.get(column)
                );
            }

            result.add(row);
        }

        return result;
    }

    // =========================================================
    // IMPORT ROWS
    // =========================================================

    private ImportResponse importRows(
            String entityType,
            List<Map<String, String>> rows) {

        int imported = 0;

        List<String> errors = new ArrayList<>();

        for (int index = 0;
                index < rows.size();
                index++) {

            try {

                Map<String, String> row =
                        normalizeRow(rows.get(index));

                validateRow(entityType, row);

                validateReferences(entityType, row);

                upsert(entityType, row);

                imported++;

            } catch (RuntimeException exception) {

                if (errors.size() < MAX_ERRORS) {

                    errors.add(
                            "Row " + (index + 1) + ": "
                                    + safeMessage(exception)
                    );
                }
            }
        }

        return new ImportResponse(
                entityType,
                rows.size(),
                imported,
                rows.size() - imported,
                List.copyOf(errors)
        );
    }

    // =========================================================
    // ROW NORMALIZATION
    // =========================================================

    private Map<String, String> normalizeRow(
            Map<String, String> original) {

        Map<String, String> normalized =
                new LinkedHashMap<>();

        original.forEach((key, value) -> {

            if (key == null || key.isBlank()) {

                throw new IllegalArgumentException(
                        "Field names cannot be empty."
                );
            }

            String normalizedKey = key.trim();

            if (normalizedKey.contains(".")
                    || normalizedKey.contains(" ")
                    || normalizedKey.contains("`")) {

                throw new IllegalArgumentException(
                        "Invalid field name: " + normalizedKey
                );
            }

            String normalizedValue =
                    value == null ? null : value.trim();

            if (normalized.containsKey(normalizedKey)) {

                throw new IllegalArgumentException(
                        "Duplicate field: " + normalizedKey
                );
            }

            normalized.put(
                    normalizedKey,
                    normalizedValue
            );
        });

        return normalized;
    }

    // =========================================================
    // ROW VALIDATION
    // =========================================================

    private void validateRow(
            String entityType,
            Map<String, String> row) {

        Set<String> allowedFields = switch (entityType) {

            case "suppliers" -> Set.of(
                    "id",
                    "name",
                    "status",
                    "leadTimeDays"
            );

            case "shipments" -> Set.of(
                    "id",
                    "quantity",
                    "status",
                    "expectedDelivery",
                    "supplierId",
                    "warehouseId"
            );

            case "warehouses" -> Set.of(
                    "id",
                    "name",
                    "location",
                    "capacity"
            );

            case "inventory" -> Set.of(
                    "id",
                    "onHand",
                    "reserved",
                    "reorderPoint",
                    "dailyDemand",
                    "productId",
                    "warehouseId"
            );

            case "products" -> Set.of(
                    "id",
                    "name",
                    "category",
                    "unitCost"
            );

            case "customers" -> Set.of(
                    "id",
                    "name",
                    "email"
            );

            case "orders" -> Set.of(
                    "id",
                    "priority",
                    "quantity",
                    "promisedDelivery",
                    "status",
                    "customerId",
                    "productId"
            );

            default -> throw new IllegalArgumentException(
                    "Unsupported entity type."
            );
        };

        for (String field : row.keySet()) {

            if (!allowedFields.contains(field)) {

                throw new IllegalArgumentException(
                        "Unsupported field: " + field
                );
            }
        }

        require(row, "id");

        switch (entityType) {

            case "suppliers" -> {

                require(row, "name");
                require(row, "status");

                nonNegativeInteger(row, "leadTimeDays");
            }

            case "shipments" -> {

                nonNegativeInteger(row, "quantity");

                require(row, "status");

                optionalDate(row, "expectedDelivery");
            }

            case "warehouses" -> {

                require(row, "name");
                require(row, "location");

                nonNegativeInteger(row, "capacity");
            }

            case "inventory" -> {

                nonNegativeInteger(row, "onHand");
                nonNegativeInteger(row, "reserved");
                nonNegativeInteger(row, "reorderPoint");
                nonNegativeInteger(row, "dailyDemand");

                long onHand = Long.parseLong(
                        row.get("onHand")
                );

                long reserved = Long.parseLong(
                        row.get("reserved")
                );

                if (reserved > onHand) {

                    throw new IllegalArgumentException(
                            "Reserved inventory cannot exceed on-hand inventory."
                    );
                }
            }

            case "products" -> {

                require(row, "name");
                require(row, "category");

                nonNegativeDecimal(row, "unitCost");
            }

            case "customers" -> {

                require(row, "name");
                require(row, "email");
            }

            case "orders" -> {

                require(row, "priority");

                nonNegativeInteger(row, "quantity");

                optionalDate(row, "promisedDelivery");

                require(row, "status");
            }

            default -> throw new IllegalArgumentException(
                    "Unsupported entity type."
            );
        }
    }

    // =========================================================
    // REFERENCE VALIDATION
    // =========================================================

    private void validateReferences(
            String entityType,
            Map<String, String> row) {

        switch (entityType) {

            case "shipments" -> {

                validateReferenceIfProvided(
                        row,
                        "supplierId",
                        "Supplier"
                );

                validateReferenceIfProvided(
                        row,
                        "warehouseId",
                        "Warehouse"
                );
            }

            case "inventory" -> {

                validateReferenceIfProvided(
                        row,
                        "productId",
                        "Product"
                );

                validateReferenceIfProvided(
                        row,
                        "warehouseId",
                        "Warehouse"
                );
            }

            case "orders" -> {

                validateReferenceIfProvided(
                        row,
                        "customerId",
                        "Customer"
                );

                validateReferenceIfProvided(
                        row,
                        "productId",
                        "Product"
                );
            }

            default -> {
                // These entity types have no imported relationships.
            }
        }
    }

    private void validateReferenceIfProvided(
            Map<String, String> row,
            String referenceField,
            String nodeLabel) {

        // If the field is omitted or blank, no relationship
        // is requested for this record.

        if (!row.containsKey(referenceField)) {
            return;
        }

        String referenceId = row.get(referenceField);

        if (referenceId == null || referenceId.isBlank()) {
            return;
        }

        // Node labels are selected only from the fixed
        // internal mappings above, never from user input.

        String query = switch (nodeLabel) {

            case "Supplier" -> """
                MATCH (n:Supplier {id: $referenceId})
                RETURN count(n) > 0 AS exists
                """;

            case "Warehouse" -> """
                MATCH (n:Warehouse {id: $referenceId})
                RETURN count(n) > 0 AS exists
                """;

            case "Product" -> """
                MATCH (n:Product {id: $referenceId})
                RETURN count(n) > 0 AS exists
                """;

            case "Customer" -> """
                MATCH (n:Customer {id: $referenceId})
                RETURN count(n) > 0 AS exists
                """;

            default -> throw new IllegalArgumentException(
                    "Unsupported reference type."
            );
        };

        boolean exists = neo4jClient.query(query)
                .bind(referenceId)
                .to("referenceId")
                .fetch()
                .one()
                .map(result ->
                        Boolean.TRUE.equals(result.get("exists"))
                )
                .orElse(false);

        if (!exists) {

            throw new IllegalArgumentException(
                    referenceField
                            + " references a non-existent "
                            + nodeLabel
                            + ": "
                            + referenceId
            );
        }
    }

    // =========================================================
    // NEO4J UPSERT
    // =========================================================

    private void upsert(
            String entityType,
            Map<String, String> row) {

        Map<String, Object> params =
                new LinkedHashMap<>(row);

        params.putIfAbsent("expectedDelivery", null);
        params.putIfAbsent("promisedDelivery", null);

        String query = switch (entityType) {

            case "suppliers" -> """
                MERGE (n:Supplier {id: $id})
                SET n.name = $name,
                    n.status = $status,
                    n.leadTimeDays = $leadTimeDays
                RETURN n.id AS id
                """;

            case "shipments" -> """
                MERGE (n:Shipment {id: $id})
                SET n.quantity = $quantity,
                    n.status = $status,
                    n.expectedDelivery =
                        CASE
                            WHEN $expectedDelivery IS NULL
                              OR $expectedDelivery = ''
                            THEN null
                            ELSE date($expectedDelivery)
                        END
                RETURN n.id AS id
                """;

            case "warehouses" -> """
                MERGE (n:Warehouse {id: $id})
                SET n.name = $name,
                    n.location = $location,
                    n.capacity = $capacity
                RETURN n.id AS id
                """;

            case "inventory" -> """
                MERGE (n:Inventory {id: $id})
                SET n.onHand = $onHand,
                    n.reserved = $reserved,
                    n.reorderPoint = $reorderPoint,
                    n.dailyDemand = $dailyDemand
                RETURN n.id AS id
                """;

            case "products" -> """
                MERGE (n:Product {id: $id})
                SET n.name = $name,
                    n.category = $category,
                    n.unitCost = $unitCost
                RETURN n.id AS id
                """;

            case "customers" -> """
                MERGE (n:Customer {id: $id})
                SET n.name = $name,
                    n.email = $email
                RETURN n.id AS id
                """;

            case "orders" -> """
                MERGE (n:Order {id: $id})
                SET n.priority = $priority,
                    n.quantity = $quantity,
                    n.promisedDelivery =
                        CASE
                            WHEN $promisedDelivery IS NULL
                              OR $promisedDelivery = ''
                            THEN null
                            ELSE date($promisedDelivery)
                        END,
                    n.status = $status
                RETURN n.id AS id
                """;

            default -> throw new IllegalArgumentException(
                    "Unsupported entity type."
            );
        };

        convertParameters(entityType, params);

        neo4jClient.query(query)
                .bindAll(params)
                .fetch()
                .one()
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Neo4j did not return the imported record."
                        )
                );

        createRelationships(entityType, row);
    }

    // =========================================================
    // PARAMETER CONVERSION
    // =========================================================

    private void convertParameters(
            String entityType,
            Map<String, Object> params) {

        switch (entityType) {

            case "suppliers" -> params.put(
                    "leadTimeDays",
                    integer(params, "leadTimeDays")
            );

            case "shipments" -> params.put(
                    "quantity",
                    integer(params, "quantity")
            );

            case "warehouses" -> params.put(
                    "capacity",
                    integer(params, "capacity")
            );

            case "inventory" -> {

                params.put(
                        "onHand",
                        integer(params, "onHand")
                );

                params.put(
                        "reserved",
                        integer(params, "reserved")
                );

                params.put(
                        "reorderPoint",
                        integer(params, "reorderPoint")
                );

                params.put(
                        "dailyDemand",
                        integer(params, "dailyDemand")
                );
            }

            case "products" -> params.put(
                    "unitCost",
                    decimal(params, "unitCost")
            );

            case "orders" -> params.put(
                    "quantity",
                    integer(params, "quantity")
            );

            default -> {
            }
        }
    }

    // =========================================================
    // NEO4J RELATIONSHIP CREATION / UPDATE
    // =========================================================

    private void createRelationships(
            String entityType,
            Map<String, String> row) {

        switch (entityType) {

            case "shipments" -> {

                updateRelationship(
                        row,
                        "supplierId",
                        """
                        OPTIONAL MATCH
                            (a:Supplier)-[r:SENDS]->(b:Shipment {id: $id})
                        DELETE r
                        """,
                        """
                        MATCH (a:Supplier {id: $referenceId}),
                              (b:Shipment {id: $id})
                        MERGE (a)-[:SENDS]->(b)
                        """
                );

                updateRelationship(
                        row,
                        "warehouseId",
                        """
                        OPTIONAL MATCH
                            (a:Shipment {id: $id})-[r:DELIVERS_TO]->(b:Warehouse)
                        DELETE r
                        """,
                        """
                        MATCH (a:Shipment {id: $id}),
                              (b:Warehouse {id: $referenceId})
                        MERGE (a)-[:DELIVERS_TO]->(b)
                        """
                );
            }

            case "inventory" -> {

                updateRelationship(
                        row,
                        "productId",
                        """
                        OPTIONAL MATCH
                            (a:Inventory {id: $id})-[r:FOR]->(b:Product)
                        DELETE r
                        """,
                        """
                        MATCH (a:Inventory {id: $id}),
                              (b:Product {id: $referenceId})
                        MERGE (a)-[:FOR]->(b)
                        """
                );

                updateRelationship(
                        row,
                        "warehouseId",
                        """
                        OPTIONAL MATCH
                            (a:Warehouse)-[r:STORES]->(b:Inventory {id: $id})
                        DELETE r
                        """,
                        """
                        MATCH (a:Warehouse {id: $referenceId}),
                              (b:Inventory {id: $id})
                        MERGE (a)-[:STORES]->(b)
                        """
                );
            }

            case "orders" -> {

                updateRelationship(
                        row,
                        "customerId",
                        """
                        OPTIONAL MATCH
                            (a:Order {id: $id})-[r:PLACED_BY]->(b:Customer)
                        DELETE r
                        """,
                        """
                        MATCH (a:Order {id: $id}),
                              (b:Customer {id: $referenceId})
                        MERGE (a)-[:PLACED_BY]->(b)
                        """
                );

                updateRelationship(
                        row,
                        "productId",
                        """
                        OPTIONAL MATCH
                            (a:Product)-[r:REQUIRED_BY]->(b:Order {id: $id})
                        DELETE r
                        """,
                        """
                        MATCH (a:Product {id: $referenceId}),
                              (b:Order {id: $id})
                        MERGE (a)-[:REQUIRED_BY]->(b)
                        """
                );
            }

            default -> {
            }
        }
    }

    // =========================================================
    // UPDATE ONE RELATIONSHIP
    // =========================================================

    private void updateRelationship(
            Map<String, String> row,
            String referenceField,
            String deleteQuery,
            String createQuery) {

        // Omitted field means preserve the existing relationship.
        if (!row.containsKey(referenceField)) {
            return;
        }

        String referenceId = row.get(referenceField);

        // First remove the old relationship.
        neo4jClient.query(deleteQuery)
                .bind(row.get("id"))
                .to("id")
                .run();

        // Blank or null means explicitly remove the relationship.
        if (referenceId == null || referenceId.isBlank()) {
            return;
        }

        // Reference was already checked before upsert.
        neo4jClient.query(createQuery)
                .bind(row.get("id"))
                .to("id")
                .bind(referenceId)
                .to("referenceId")
                .run();
    }

    // =========================================================
    // REQUIRED FIELD VALIDATION
    // =========================================================

    private void require(
            Map<String, String> row,
            String field) {

        String value = row.get(field);

        if (value == null || value.isBlank()) {

            throw new IllegalArgumentException(
                    "Required field is missing: " + field
            );
        }
    }

    // =========================================================
    // DATE VALIDATION
    // =========================================================

    private void optionalDate(
            Map<String, String> row,
            String field) {

        String value = row.get(field);

        if (value != null && !value.isBlank()) {

            try {

                LocalDate.parse(value);

            } catch (RuntimeException exception) {

                throw new IllegalArgumentException(
                        field + " must use YYYY-MM-DD format."
                );
            }
        }
    }

    // =========================================================
    // NON-NEGATIVE INTEGER VALIDATION
    // =========================================================

    private void nonNegativeInteger(
            Map<String, String> row,
            String field) {

        require(row, field);

        try {

            long value = Long.parseLong(row.get(field));

            if (value < 0) {

                throw new IllegalArgumentException(
                        field + " cannot be negative."
                );
            }

        } catch (NumberFormatException exception) {

            throw new IllegalArgumentException(
                    field + " must be a whole number."
            );
        }
    }

    // =========================================================
    // NON-NEGATIVE DECIMAL VALIDATION
    // =========================================================

    private void nonNegativeDecimal(
            Map<String, String> row,
            String field) {

        require(row, field);

        try {

            double value = Double.parseDouble(row.get(field));

            if (!Double.isFinite(value) || value < 0) {

                throw new IllegalArgumentException(
                        field + " must be a non-negative finite number."
                );
            }

        } catch (NumberFormatException exception) {

            throw new IllegalArgumentException(
                    field + " must be a valid number."
            );
        }
    }

    // =========================================================
    // NUMBER CONVERSION
    // =========================================================

    private long integer(
            Map<String, Object> params,
            String field) {

        return Long.parseLong(
                String.valueOf(params.get(field))
        );
    }

    private double decimal(
            Map<String, Object> params,
            String field) {

        return Double.parseDouble(
                String.valueOf(params.get(field))
        );
    }

    // =========================================================
    // SAFE ERROR MESSAGE
    // =========================================================

    private String safeMessage(
            RuntimeException exception) {

        String message = exception.getMessage();

        if (message == null || message.isBlank()) {
            return "Invalid record.";
        }

        return message.length() > 250
                ? message.substring(0, 250)
                : message;
    }
}
