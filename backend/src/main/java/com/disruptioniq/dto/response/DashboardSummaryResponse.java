package com.disruptioniq.dto.response;

import java.util.List;
import java.util.Map;

public record DashboardSummaryResponse(
        long totalShipments,
        long activeDisruptions,
        long totalOrders,
        long atRiskOrders,
        long totalInventoryRecords,
        long totalOnHandUnits,
        long totalReservedUnits,
        long totalAvailableUnits,
        long lowStockRecords,
        long totalRecoveryPlans,
        long pendingApprovals,
        long approvedPlans,
        long executedPlans,
        Map<String, Long> shipmentStatusBreakdown,
        Map<String, Long> recoveryPlanStatusBreakdown,
        List<RecentRecoveryActivity> recentRecoveryActivity
) {

    public record RecentRecoveryActivity(
            String progressId,
            String recoveryPlanId,
            String shipmentId,
            Integer completionPercentage,
            String status,
            String milestone,
            String blocker,
            String updatedBy,
            java.time.LocalDateTime updatedAt
    ) {
    }
}