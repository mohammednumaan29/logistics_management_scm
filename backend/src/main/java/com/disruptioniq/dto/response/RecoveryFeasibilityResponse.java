package com.disruptioniq.dto.response;

import java.util.List;

public record RecoveryFeasibilityResponse(
        String shipmentId,
        String strategy,
        boolean feasible,
        String reason,
        long availableQuantity,
        long requestedQuantity,
        int estimatedRecoveryDays,
        double estimatedCost,
        List<String> warnings
) {
}