package com.disruptioniq.service;

import com.disruptioniq.dto.request.SimulationRequest;
import com.disruptioniq.dto.request.SimulationRequest.Strategy;
import com.disruptioniq.dto.response.ImpactAnalysisResponse;
import com.disruptioniq.dto.response.RiskAssessmentResponse;
import com.disruptioniq.dto.response.SimulationResponse;

import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class RecoverySimulationService {

    private final ImpactAnalysisService impactAnalysisService;
    private final RiskAssessmentService riskAssessmentService;
    private final Neo4jClient neo4jClient;

    public RecoverySimulationService(
            ImpactAnalysisService impactAnalysisService,
            RiskAssessmentService riskAssessmentService,
            Neo4jClient neo4jClient
    ) {
        this.impactAnalysisService = impactAnalysisService;
        this.riskAssessmentService = riskAssessmentService;
        this.neo4jClient = neo4jClient;
    }

    private static final String SOURCE_INVENTORY_QUERY = """
            MATCH (w:Warehouse {id: $warehouseId})
                  -[:STORES]->(i:Inventory)
                  -[:FOR]->(p:Product {id: $productId})
            RETURN
                w.id AS warehouseId,
                i.id AS inventoryId,
                i.onHand AS onHand,
                i.reserved AS reserved,
                i.reorderPoint AS reorderPoint,
                i.dailyDemand AS dailyDemand
            """;

    private static final String ALTERNATIVE_SUPPLIER_QUERY = """
            MATCH (s:Supplier {id: $supplierId})
            RETURN
                s.id AS supplierId,
                s.name AS supplierName,
                s.status AS supplierStatus,
                s.leadTimeDays AS leadTimeDays
            """;

    public SimulationResponse simulate(SimulationRequest request) {

        validateRequest(request);

        ImpactAnalysisResponse impact =
                impactAnalysisService.analyzeShipment(request.shipmentId());

        RiskAssessmentResponse risk =
                riskAssessmentService.assessShipment(request.shipmentId());

        validateImpactData(impact);

        long available = impact.available();
        long dailyDemand = impact.dailyDemand();

        long projectedDemand;

        try {
            projectedDemand = Math.multiplyExact(
                    dailyDemand,
                    (long) request.delayDays()
            );
        } catch (ArithmeticException exception) {
            throw new IllegalArgumentException(
                    "Projected demand exceeds the supported calculation range."
            );
        }

        long originalShortage = Math.max(
                0L,
                projectedDemand - available
        );

        long projectedShortage = originalShortage;
        long unitsRecovered = 0L;

        int recoveryDays = request.delayDays();
        double cost = 0.0;

        List<String> warnings = new ArrayList<>();

        String feasibility = "FEASIBLE";
        String message;

        switch (request.strategy()) {

            case DO_NOTHING -> {
                message = originalShortage > 0
                        ? "Baseline scenario: no recovery action is taken. "
                            + "A projected inventory shortage remains."
                        : "Baseline scenario: available inventory covers projected demand.";

                warnings.add("The disruption remains unresolved.");
            }

            case REALLOCATE_STOCK -> {

                String sourceWarehouseId = request.sourceWarehouseId();
                long quantity = request.reallocationQuantity();

                if (sourceWarehouseId == null
                        || sourceWarehouseId.isBlank()) {

                    feasibility = "NEEDS_MORE_DATA";
                    message = "A source warehouse ID is required.";

                } else if (sourceWarehouseId.equals(impact.warehouseId())) {

                    feasibility = "INFEASIBLE";
                    message = "The source warehouse cannot be the destination warehouse.";

                } else if (impact.productId() == null
                        || impact.productId().isBlank()) {

                    feasibility = "NEEDS_MORE_DATA";
                    message = "The destination product could not be identified.";

                } else {

                    Map<String, Object> source = findSourceInventory(
                            sourceWarehouseId,
                            impact.productId()
                    );

                    if (source == null) {

                        feasibility = "INFEASIBLE";
                        message = "No matching product inventory was found at the source warehouse.";

                    } else {

                        Long onHand = nullableNumber(source.get("onHand"));
                        Long reserved = nullableNumber(source.get("reserved"));
                        Long reorderPoint = nullableNumber(source.get("reorderPoint"));
                        Long sourceDailyDemand = nullableNumber(source.get("dailyDemand"));

                        if (onHand == null
                                || reserved == null
                                || reorderPoint == null
                                || sourceDailyDemand == null) {

                            feasibility = "NEEDS_MORE_DATA";
                            message = "Source inventory information is incomplete.";

                        } else if (!validInventory(
                                onHand,
                                reserved,
                                reorderPoint,
                                sourceDailyDemand
                        )) {

                            feasibility = "INFEASIBLE";
                            message = "Source inventory contains invalid stock values.";

                        } else {

                            long sourceAvailable = onHand - reserved;

                            if (quantity > sourceAvailable) {

                                feasibility = "INFEASIBLE";
                                message = "The source warehouse does not have enough available inventory.";

                            } else {

                                long remainingAtSource = sourceAvailable - quantity;

                                long protectedStock = Math.max(
                                        reorderPoint,
                                        sourceDailyDemand
                                );

                                if (remainingAtSource < protectedStock) {

                                    feasibility = "INFEASIBLE";
                                    message = "The transfer would reduce source inventory below its demand/reorder protection threshold.";

                                } else {

                                    unitsRecovered = Math.min(
                                            quantity,
                                            originalShortage
                                    );

                                    projectedShortage = Math.max(
                                            0L,
                                            originalShortage - unitsRecovered
                                    );

                                    feasibility = "NEEDS_MORE_DATA";
                                    message = "Matching source inventory is available, but transfer timing and destination capacity must be verified.";

                                    warnings.add(
                                            "Transfer lead time has not been verified."
                                    );

                                    warnings.add(
                                            "Destination warehouse capacity has not been verified."
                                    );
                                }
                            }
                        }
                    }
                }

                warnings.add(
                        "This is a simulation only; no inventory has been transferred."
                );
            }

            case EXPEDITE_SHIPMENT -> {

                if (!Double.isFinite(request.expediteCost())
                        || request.expediteCost() < 0) {

                    feasibility = "INFEASIBLE";
                    message = "Expedite cost must be a valid non-negative number.";

                } else if (request.expeditedArrivalDays()
                        >= request.delayDays()) {

                    feasibility = "INFEASIBLE";
                    message = "The expedited arrival must be earlier than the delayed arrival.";

                    warnings.add(
                            "Choose an expedited arrival time shorter than the disruption delay."
                    );

                } else {

                    recoveryDays = request.expeditedArrivalDays();
                    cost = request.expediteCost();

                    unitsRecovered = Math.min(
                            impact.shipmentQuantity(),
                            originalShortage
                    );

                    projectedShortage = Math.max(
                            0L,
                            originalShortage - unitsRecovered
                    );

                    message = "Expedited arrival evaluated using the supplied time and cost estimates.";

                    warnings.add(
                            "Actual carrier availability and delivery timing have not been verified."
                    );

                    warnings.add(
                            "Shipment quantity is used as the estimated recovered inventory."
                    );
                }
            }

            case ALTERNATIVE_SUPPLIER -> {

                String supplierId = request.alternativeSupplierId();

                if (supplierId == null || supplierId.isBlank()) {

                    feasibility = "NEEDS_MORE_DATA";
                    message = "An alternative supplier ID is required.";

                } else {

                    Map<String, Object> supplier =
                            findAlternativeSupplier(supplierId);

                    if (supplier == null) {

                        feasibility = "INFEASIBLE";
                        message = "The specified supplier does not exist.";

                    } else {

                        String status = stringValue(
                                supplier.get("supplierStatus")
                        );

                        Long leadTime = nullableNumber(
                                supplier.get("leadTimeDays")
                        );

                        if (!"ACTIVE".equalsIgnoreCase(status)) {

                            feasibility = "INFEASIBLE";
                            message = "The alternative supplier is not active.";

                        } else if (leadTime == null
                                || leadTime < 0
                                || leadTime > Integer.MAX_VALUE) {

                            feasibility = "NEEDS_MORE_DATA";
                            message = "The supplier's lead time is unavailable or invalid.";

                        } else if (leadTime >= request.delayDays()) {

                            feasibility = "INFEASIBLE";
                            message = "The supplier's lead time is not shorter than the disruption delay.";

                        } else {

                            recoveryDays = leadTime.intValue();

                            feasibility = "NEEDS_MORE_DATA";
                            message = "The supplier is active and has a shorter lead time, but product compatibility and capacity are unverified.";
                        }

                        warnings.add(
                                "The current Supplier model does not contain verified product capability."
                        );

                        warnings.add(
                                "Available quantity, cost, and supplier capacity have not been verified."
                        );
                    }
                }
            }

            case SPLIT_ORDER -> {

                long splitQuantity = request.splitQuantity();
                long totalOrderQuantity = calculateTotalOrderQuantity(impact);

                if (totalOrderQuantity <= 0) {

                    feasibility = "INFEASIBLE";
                    message = "No valid linked order quantity is available.";

                } else if (splitQuantity >= totalOrderQuantity) {

                    feasibility = "INFEASIBLE";
                    message = "Immediate split quantity must be smaller than the total linked order quantity.";

                } else if (splitQuantity > available) {

                    feasibility = "INFEASIBLE";
                    message = "The requested immediate shipment exceeds available inventory.";

                    warnings.add(
                            "Reserved inventory is excluded from available inventory."
                    );

                } else {

                    unitsRecovered = Math.min(
                            splitQuantity,
                            originalShortage
                    );

                    projectedShortage = Math.max(
                            0L,
                            originalShortage - unitsRecovered
                    );

                    recoveryDays = 0;

                    long remainingQuantity =
                            totalOrderQuantity - splitQuantity;

                    message = "Split-order quantity evaluated. "
                            + "Ship now: " + splitQuantity
                            + " units; remaining: " + remainingQuantity
                            + " units.";

                    warnings.add(
                            "A delivery plan and deadline for the remaining quantity must be confirmed."
                    );

                    warnings.add(
                            "This is a simulation only; no order or inventory has been changed."
                    );
                }
            }

            default -> throw new IllegalArgumentException(
                    "Unsupported recovery strategy."
            );
        }

        int residualRiskScore = calculateResidualRisk(
                risk,
                originalShortage,
                projectedShortage
        );

        String residualRiskLevel = riskLevel(residualRiskScore);

        int ordersSaved = calculateOrdersSaved(
                impact,
                unitsRecovered
        );

        return new SimulationResponse(
                request.shipmentId(),
                request.strategy().name(),
                feasibility,
                message,
                available,
                projectedDemand,
                projectedShortage,
                unitsRecovered,
                recoveryDays,
                cost,
                ordersSaved,
                residualRiskScore,
                residualRiskLevel,
                List.copyOf(warnings)
        );
    }

    private Map<String, Object> findSourceInventory(
            String warehouseId,
            String productId
    ) {
        return neo4jClient
                .query(SOURCE_INVENTORY_QUERY)
                .bind(warehouseId).to("warehouseId")
                .bind(productId).to("productId")
                .fetch()
                .one()
                .orElse(null);
    }

    private Map<String, Object> findAlternativeSupplier(String supplierId) {
        return neo4jClient
                .query(ALTERNATIVE_SUPPLIER_QUERY)
                .bind(supplierId).to("supplierId")
                .fetch()
                .one()
                .orElse(null);
    }

    private void validateRequest(SimulationRequest request) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "Simulation request is required."
            );
        }

        if (request.shipmentId() == null
                || request.shipmentId().isBlank()) {
            throw new IllegalArgumentException(
                    "Shipment ID is required."
            );
        }

        if (request.strategy() == null) {
            throw new IllegalArgumentException(
                    "Recovery strategy is required."
            );
        }

        if (request.delayDays() < 1) {
            throw new IllegalArgumentException(
                    "Delay days must be at least 1."
            );
        }

        if (request.expeditedArrivalDays() < 1) {
            throw new IllegalArgumentException(
                    "Expedited arrival days must be at least 1."
            );
        }

        if (request.reallocationQuantity() < 1
                || request.splitQuantity() < 1) {
            throw new IllegalArgumentException(
                    "Recovery quantities must be at least 1."
            );
        }

        if (!Double.isFinite(request.expediteCost())
                || request.expediteCost() < 0) {
            throw new IllegalArgumentException(
                    "Expedite cost must be a valid non-negative number."
            );
        }
    }

    private void validateImpactData(ImpactAnalysisResponse impact) {

        if (impact == null) {
            throw new IllegalStateException(
                    "Impact analysis returned no data."
            );
        }

        if (impact.available() < 0
                || impact.dailyDemand() < 0
                || impact.shipmentQuantity() < 0
                || impact.reorderPoint() < 0) {
            throw new IllegalStateException(
                    "Impact analysis contains invalid inventory or shipment values."
            );
        }
    }

    private boolean validInventory(
            long onHand,
            long reserved,
            long reorderPoint,
            long dailyDemand
    ) {
        return onHand >= 0
                && reserved >= 0
                && reserved <= onHand
                && reorderPoint >= 0
                && dailyDemand >= 0;
    }

    private long calculateTotalOrderQuantity(
            ImpactAnalysisResponse impact
    ) {
        if (impact.affectedOrders() == null) {
            return 0L;
        }

        long total = 0L;

        for (ImpactAnalysisResponse.AffectedOrder order
                : impact.affectedOrders()) {

            if (order.quantity() < 0) {
                throw new IllegalStateException(
                        "Linked order quantity cannot be negative."
                );
            }

            try {
                total = Math.addExact(total, order.quantity());
            } catch (ArithmeticException exception) {
                throw new IllegalStateException(
                        "Total linked order quantity exceeds the supported calculation range."
                );
            }
        }

        return total;
    }

    private int calculateOrdersSaved(
            ImpactAnalysisResponse impact,
            long unitsRecovered
    ) {
        if (unitsRecovered <= 0
                || impact.affectedOrders() == null) {
            return 0;
        }

        List<ImpactAnalysisResponse.AffectedOrder> orders =
                impact.affectedOrders()
                        .stream()
                        .sorted(
                                Comparator.comparingInt(
                                        order -> priorityRank(order.priority())
                                )
                        )
                        .toList();

        long remainingUnits = unitsRecovered;
        int savedOrders = 0;

        for (ImpactAnalysisResponse.AffectedOrder order : orders) {

            if (order.quantity() <= 0) {
                continue;
            }

            if (order.quantity() <= remainingUnits) {
                remainingUnits -= order.quantity();
                savedOrders++;
            }
        }

        return savedOrders;
    }

    private int priorityRank(String priority) {

        if (priority == null) {
            return 5;
        }

        return switch (priority.toUpperCase()) {
            case "CRITICAL" -> 1;
            case "HIGH" -> 2;
            case "MEDIUM" -> 3;
            case "LOW" -> 4;
            default -> 5;
        };
    }

    private int calculateResidualRisk(
            RiskAssessmentResponse risk,
            long originalShortage,
            long remainingShortage
    ) {
        if (risk == null
                || risk.orders() == null
                || risk.orders().isEmpty()) {
            return 0;
        }

        if (originalShortage <= 0) {
            return risk.orders()
                    .stream()
                    .mapToInt(RiskAssessmentResponse.OrderRisk::riskScore)
                    .max()
                    .orElse(0);
        }

        double remainingRatio = Math.min(
                1.0,
                (double) Math.max(0L, remainingShortage)
                        / originalShortage
        );

        int highestResidualScore = 0;

        for (RiskAssessmentResponse.OrderRisk orderRisk : risk.orders()) {

            int inventoryPoints = 0;
            int nonInventoryPoints = 0;

            if (orderRisk.factors() == null) {
                highestResidualScore = Math.max(
                        highestResidualScore,
                        orderRisk.riskScore()
                );
                continue;
            }

            for (RiskAssessmentResponse.RiskFactor factor
                    : orderRisk.factors()) {

                if ("INVENTORY".equalsIgnoreCase(factor.name())) {
                    inventoryPoints += factor.points();
                } else {
                    nonInventoryPoints += factor.points();
                }
            }

            int remainingInventoryPoints = (int) Math.ceil(
                    inventoryPoints * remainingRatio
            );

            int orderResidualScore = Math.min(
                    100,
                    Math.max(
                            0,
                            nonInventoryPoints + remainingInventoryPoints
                    )
            );

            highestResidualScore = Math.max(
                    highestResidualScore,
                    orderResidualScore
            );
        }

        return highestResidualScore;
    }

    private int riskLevelScore(String level) {
        return switch (level) {
            case "LOW" -> 0;
            case "MEDIUM" -> 1;
            case "HIGH" -> 2;
            default -> 3;
        };
    }

    private String riskLevel(int score) {

        if (score <= 24) {
            return "LOW";
        }

        if (score <= 49) {
            return "MEDIUM";
        }

        if (score <= 74) {
            return "HIGH";
        }

        return "CRITICAL";
    }

    private Long nullableNumber(Object value) {

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
}