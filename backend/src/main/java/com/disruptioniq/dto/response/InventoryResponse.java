package com.disruptioniq.dto.response;

public record InventoryResponse(
        String id,
        long onHand,
        long reserved,
        long reorderPoint,
        long dailyDemand,
        long available
) {
}