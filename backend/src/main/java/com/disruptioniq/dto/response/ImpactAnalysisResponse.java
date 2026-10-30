package com.disruptioniq.dto.response;

import java.time.LocalDate;
import java.util.List;

public record ImpactAnalysisResponse(
        String shipmentId,
        String shipmentStatus,
        long shipmentQuantity,
        String supplierId,
        String supplierName,
        String warehouseId,
        String warehouseName,
        String inventoryId,
        long onHand,
        long reserved,
        long available,
        long reorderPoint,
        long dailyDemand,
        String productId,
        String productName,
        List<AffectedOrder> affectedOrders
) {
    public record AffectedOrder(
            String orderId,
            String priority,
            long quantity,
            LocalDate promisedDelivery,
            String status,
            String customerId,
            String customerName
    ) {
    }
}