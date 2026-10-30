
package com.disruptioniq.service;

import com.disruptioniq.dto.response.ImpactAnalysisResponse;
import com.disruptioniq.dto.response.ImpactAnalysisResponse.AffectedOrder;
import com.disruptioniq.dto.response.RiskAssessmentResponse;
import com.disruptioniq.dto.response.RiskAssessmentResponse.OrderRisk;
import com.disruptioniq.dto.response.RiskAssessmentResponse.RiskFactor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class RiskAssessmentService {

    private final ImpactAnalysisService impactAnalysisService;
    private final Clock clock;

    @Autowired
    public RiskAssessmentService(
            ImpactAnalysisService impactAnalysisService
    ) {
        this(impactAnalysisService, Clock.systemDefaultZone());
    }

    // Allows a fixed date to be supplied during future testing.
    RiskAssessmentService(
            ImpactAnalysisService impactAnalysisService,
            Clock clock
    ) {
        this.impactAnalysisService = impactAnalysisService;
        this.clock = clock;
    }

    public RiskAssessmentResponse assessShipment(String shipmentId) {

        if (shipmentId == null || shipmentId.isBlank()) {
            throw new IllegalArgumentException(
                    "Shipment ID must not be blank."
            );
        }

        ImpactAnalysisResponse impact =
                impactAnalysisService.analyzeShipment(shipmentId);

        List<OrderRisk> orderRisks = impact.affectedOrders()
                .stream()
                .map(order -> assessOrder(order, impact))
                .toList();

        return new RiskAssessmentResponse(
                impact.shipmentId(),
                impact.shipmentStatus(),
                orderRisks
        );
    }

    private OrderRisk assessOrder(
            AffectedOrder order,
            ImpactAnalysisResponse impact
    ) {
        if (order == null) {
            throw new IllegalStateException(
                    "Impact analysis returned an invalid affected order."
            );
        }

        validateInventoryValues(impact);

        List<RiskFactor> factors = new ArrayList<>();

        int deadlinePoints = calculateDeadlineRisk(
                order.promisedDelivery()
        );

        factors.add(new RiskFactor(
                "DEADLINE",
                deadlinePoints,
                deadlineExplanation(
                        order.promisedDelivery(),
                        deadlinePoints
                )
        ));

        int inventoryPoints = calculateInventoryRisk(
                impact.available(),
                impact.dailyDemand(),
                impact.reorderPoint(),
                order.quantity()
        );

        factors.add(new RiskFactor(
                "INVENTORY",
                inventoryPoints,
                inventoryExplanation(
                        impact.available(),
                        order.quantity(),
                        inventoryPoints
                )
        ));

        int disruptionPoints = calculateDisruptionRisk(
                impact.shipmentStatus()
        );

        factors.add(new RiskFactor(
                "SHIPMENT_DISRUPTION",
                disruptionPoints,
                "Shipment status: " +
                        safeText(impact.shipmentStatus(), "UNKNOWN")
        ));

        int priorityPoints = calculatePriorityRisk(
                order.priority()
        );

        factors.add(new RiskFactor(
                "ORDER_PRIORITY",
                priorityPoints,
                "Order priority: " +
                        safeText(order.priority(), "UNKNOWN")
        ));

        int dependencyPoints =
                impact.inventoryId() != null
                && impact.productId() != null
                ? 10 : 0;

        factors.add(new RiskFactor(
                "SUPPLY_DEPENDENCY",
                dependencyPoints,
                dependencyPoints > 0
                        ? "The order is connected to the affected product and inventory."
                        : "The required supply-chain dependency was not fully identified."
        ));

        int totalScore = factors.stream()
                .mapToInt(RiskFactor::points)
                .sum();

        totalScore = Math.min(100, Math.max(0, totalScore));

        return new OrderRisk(
                order.orderId(),
                order.priority(),
                totalScore,
                classifyRisk(totalScore),
                List.copyOf(factors)
        );
    }

    private void validateInventoryValues(
            ImpactAnalysisResponse impact
    ) {
        if (impact.available() < 0
                || impact.dailyDemand() < 0
                || impact.reorderPoint() < 0) {

            throw new IllegalStateException(
                    "Inventory metrics cannot contain negative values."
            );
        }
    }

    private int calculateDeadlineRisk(
            LocalDate promisedDelivery
    ) {
        if (promisedDelivery == null) {
            return 0;
        }

        long daysUntilDeadline = ChronoUnit.DAYS.between(
                LocalDate.now(clock),
                promisedDelivery
        );

        if (daysUntilDeadline < 0) {
            return 30;
        }

        if (daysUntilDeadline <= 1) {
            return 25;
        }

        if (daysUntilDeadline <= 3) {
            return 20;
        }

        if (daysUntilDeadline <= 7) {
            return 10;
        }

        return 5;
    }

    private int calculateInventoryRisk(
            long available,
            long dailyDemand,
            long reorderPoint,
            long orderQuantity
    ) {
        if (orderQuantity < 0) {
            throw new IllegalStateException(
                    "Order quantity cannot be negative."
            );
        }

        if (available < orderQuantity) {
            return 25;
        }

        long threeDayDemand = dailyDemand > Long.MAX_VALUE / 3
                ? Long.MAX_VALUE
                : dailyDemand * 3;

        if (available < threeDayDemand) {
            return 15;
        }

        if (available < reorderPoint) {
            return 10;
        }

        return 0;
    }

    private int calculateDisruptionRisk(String status) {

        if (status == null || status.isBlank()) {
            return 0;
        }

        return switch (status.toUpperCase(Locale.ROOT)) {
            case "DISRUPTED", "SUSPENDED" -> 20;
            case "DELAYED" -> 15;
            case "AT_RISK" -> 10;
            default -> 0;
        };
    }

    private int calculatePriorityRisk(String priority) {

        if (priority == null || priority.isBlank()) {
            return 0;
        }

        return switch (priority.toUpperCase(Locale.ROOT)) {
            case "CRITICAL" -> 15;
            case "HIGH" -> 12;
            case "MEDIUM" -> 8;
            case "LOW" -> 3;
            default -> 0;
        };
    }

    private String classifyRisk(int score) {

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

    private String deadlineExplanation(
            LocalDate promisedDelivery,
            int points
    ) {
        if (promisedDelivery == null) {
            return "Promised delivery date is unavailable.";
        }

        if (points == 30) {
            return "Promised delivery date has passed.";
        }

        if (points == 25) {
            return "Delivery deadline is today or within one day.";
        }

        if (points == 20) {
            return "Delivery deadline is within three days.";
        }

        if (points == 10) {
            return "Delivery deadline is within seven days.";
        }

        return "Delivery deadline is more than seven days away.";
    }

    private String inventoryExplanation(
            long available,
            long orderQuantity,
            int points
    ) {
        if (available < orderQuantity) {
            return "Available stock is below the order quantity.";
        }

        if (points == 15) {
            return "Available stock covers less than three days of estimated demand.";
        }

        if (points == 10) {
            return "Available stock is below the reorder point.";
        }

        return "Available stock meets the configured inventory thresholds.";
    }

    private String safeText(
            String value,
            String fallback
    ) {
        return value == null || value.isBlank()
                ? fallback
                : value;
    }
}
