package com.disruptioniq.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.disruptioniq.dto.response.DashboardSummaryResponse;
import com.disruptioniq.model.Inventory;
import com.disruptioniq.model.Order;
import com.disruptioniq.model.RecoveryPlan;
import com.disruptioniq.model.RecoveryProgress;
import com.disruptioniq.model.Shipment;
import com.disruptioniq.repository.InventoryRepository;
import com.disruptioniq.repository.OrderRepository;
import com.disruptioniq.repository.RecoveryPlanRepository;
import com.disruptioniq.repository.RecoveryProgressRepository;
import com.disruptioniq.repository.ShipmentRepository;

@Service
public class DashboardService {

    private final ShipmentRepository shipmentRepository;
    private final OrderRepository orderRepository;
    private final InventoryRepository inventoryRepository;
    private final RecoveryPlanRepository recoveryPlanRepository;
    private final RecoveryProgressRepository recoveryProgressRepository;

    public DashboardService(
            ShipmentRepository shipmentRepository,
            OrderRepository orderRepository,
            InventoryRepository inventoryRepository,
            RecoveryPlanRepository recoveryPlanRepository,
            RecoveryProgressRepository recoveryProgressRepository) {

        this.shipmentRepository = shipmentRepository;
        this.orderRepository = orderRepository;
        this.inventoryRepository = inventoryRepository;
        this.recoveryPlanRepository = recoveryPlanRepository;
        this.recoveryProgressRepository = recoveryProgressRepository;
    }

    public DashboardSummaryResponse getSummary(int activityLimit) {

        List<Shipment> shipments = shipmentRepository.findAll();
        List<Order> orders = orderRepository.findAll();
        List<Inventory> inventories = inventoryRepository.findAll();
        List<RecoveryPlan> plans = recoveryPlanRepository.findAll();

        List<RecoveryProgress> progressUpdates =
                recoveryProgressRepository.findAll();

        Map<String, Long> shipmentStatusBreakdown =
                countByStatus(shipments, Shipment::getStatus);

        Map<String, Long> recoveryPlanStatusBreakdown =
                countByStatus(plans, RecoveryPlan::getStatus);

        long activeDisruptions = shipments.stream()
                .filter(this::isActiveDisruption)
                .count();

        long atRiskOrders = orders.stream()
                .filter(order -> "AT_RISK".equalsIgnoreCase(
                        safe(order.getStatus())))
                .count();

        long totalOnHandUnits = inventories.stream()
                .mapToLong(Inventory::getOnHand)
                .sum();

        long totalReservedUnits = inventories.stream()
                .mapToLong(Inventory::getReserved)
                .sum();

        long totalAvailableUnits = inventories.stream()
                .mapToLong(Inventory::getAvailable)
                .sum();

        long lowStockRecords = inventories.stream()
                .filter(inventory ->
                        inventory.getAvailable() <= inventory.getReorderPoint())
                .count();

        long pendingApprovals = plans.stream()
                .filter(plan -> "PENDING_APPROVAL".equalsIgnoreCase(
                        safe(plan.getStatus())))
                .count();

        long approvedPlans = plans.stream()
                .filter(plan -> "APPROVED".equalsIgnoreCase(
                        safe(plan.getStatus())))
                .count();

        long executedPlans = plans.stream()
                .filter(plan -> "EXECUTED".equalsIgnoreCase(
                        safe(plan.getStatus())))
                .count();

        List<DashboardSummaryResponse.RecentRecoveryActivity> recentActivity =
                progressUpdates.stream()
                        .sorted(Comparator.comparing(
                                RecoveryProgress::getUpdatedAt,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                        .limit(activityLimit)
                        .map(this::toRecentActivity)
                        .toList();

        return new DashboardSummaryResponse(
                shipments.size(),
                activeDisruptions,
                orders.size(),
                atRiskOrders,
                inventories.size(),
                totalOnHandUnits,
                totalReservedUnits,
                totalAvailableUnits,
                lowStockRecords,
                plans.size(),
                pendingApprovals,
                approvedPlans,
                executedPlans,
                shipmentStatusBreakdown,
                recoveryPlanStatusBreakdown,
                recentActivity
        );
    }

    public List<DashboardSummaryResponse.RecentRecoveryActivity>
            getRecentRecoveryActivity(int limit) {

        return recoveryProgressRepository.findAll().stream()
                .sorted(Comparator.comparing(
                        RecoveryProgress::getUpdatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(limit)
                .map(this::toRecentActivity)
                .toList();
    }

    private boolean isActiveDisruption(Shipment shipment) {

        String status = safe(shipment.getStatus()).toUpperCase();

        return "DELAYED".equals(status)
                || "DISRUPTED".equals(status);
    }

    private DashboardSummaryResponse.RecentRecoveryActivity
            toRecentActivity(RecoveryProgress progress) {

        return new DashboardSummaryResponse.RecentRecoveryActivity(
                progress.getId(),
                progress.getRecoveryPlanId(),
                progress.getShipmentId(),
                progress.getCompletionPercentage(),
                progress.getStatus(),
                progress.getMilestone(),
                progress.getBlocker(),
                progress.getUpdatedBy(),
                progress.getUpdatedAt()
        );
    }

    private <T> Map<String, Long> countByStatus(
            List<T> items,
            Function<T, String> statusExtractor) {

        return items.stream()
                .collect(Collectors.groupingBy(
                        item -> {
                            String status = statusExtractor.apply(item);
                            return status == null || status.isBlank()
                                    ? "UNKNOWN"
                                    : status.toUpperCase();
                        },
                        Collectors.counting()
                ));
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}