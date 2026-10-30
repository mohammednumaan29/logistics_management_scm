
package com.disruptioniq.dto.response;

import java.time.LocalDateTime;

public record RecoveryPlanResponse(
        String id,
        String shipmentId,
        String strategy,
        String createdBy,
        String status,
        double estimatedCost,
        int estimatedRecoveryDays,
        int ordersSaved,
        String approvedBy,
        String decidedBy,
        String decisionReason,
        LocalDateTime createdAt,
        LocalDateTime decidedAt
) {
}
