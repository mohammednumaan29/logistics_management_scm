package com.disruptioniq.dto.response;

import java.time.LocalDateTime;

import com.disruptioniq.model.RecoveryProgress;

public record RecoveryProgressResponse(
        String id,
        String recoveryPlanId,
        String shipmentId,
        Integer completionPercentage,
        String status,
        String milestone,
        String blocker,
        String notes,
        String updatedBy,
        LocalDateTime updatedAt
) {

    public static RecoveryProgressResponse from(
            RecoveryProgress progress) {

        return new RecoveryProgressResponse(
                progress.getId(),
                progress.getRecoveryPlanId(),
                progress.getShipmentId(),
                progress.getCompletionPercentage(),
                progress.getStatus(),
                progress.getMilestone(),
                progress.getBlocker(),
                progress.getNotes(),
                progress.getUpdatedBy(),
                progress.getUpdatedAt()
        );
    }
}