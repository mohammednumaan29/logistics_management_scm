package com.disruptioniq.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.disruptioniq.dto.request.RecoveryProgressUpdateRequest;
import com.disruptioniq.dto.response.RecoveryProgressResponse;
import com.disruptioniq.model.RecoveryPlan;
import com.disruptioniq.model.RecoveryProgress;
import com.disruptioniq.repository.RecoveryPlanRepository;
import com.disruptioniq.repository.RecoveryProgressRepository;

@Service
public class RecoveryProgressService {

    private static final String IN_PROGRESS = "IN_PROGRESS";
    private static final String BLOCKED = "BLOCKED";
    private static final String COMPLETED = "COMPLETED";

    private final RecoveryPlanRepository recoveryPlanRepository;
    private final RecoveryProgressRepository recoveryProgressRepository;
    private final AuditEventService auditEventService;
    private final NotificationService notificationService;

    public RecoveryProgressService(
            RecoveryPlanRepository recoveryPlanRepository,
            RecoveryProgressRepository recoveryProgressRepository,
            AuditEventService auditEventService,
            NotificationService notificationService
    ) {
        this.recoveryPlanRepository = recoveryPlanRepository;
        this.recoveryProgressRepository = recoveryProgressRepository;
        this.auditEventService = auditEventService;
        this.notificationService = notificationService;
    }

    @Transactional
    public RecoveryProgressResponse updateProgress(
            String recoveryPlanId,
            RecoveryProgressUpdateRequest request,
            String authenticatedUserId
    ) {
        if (!StringUtils.hasText(authenticatedUserId)) {
            throw new IllegalArgumentException(
                    "Authenticated user ID is required."
            );
        }

        if (!StringUtils.hasText(recoveryPlanId)) {
            throw new IllegalArgumentException(
                    "Recovery plan ID is required."
            );
        }

        if (request == null) {
            throw new IllegalArgumentException(
                    "Recovery progress request is required."
            );
        }

        RecoveryPlan plan = recoveryPlanRepository
                .findById(recoveryPlanId.trim())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Recovery plan not found: " + recoveryPlanId
                ));

        if (!"EXECUTED".equalsIgnoreCase(plan.getStatus())) {
            throw new IllegalStateException(
                    "Progress can only be updated for executed recovery plans."
            );
        }

        int percentage = request.completionPercentage();

        if (percentage < 0 || percentage > 100) {
            throw new IllegalArgumentException(
                    "Completion percentage must be between 0 and 100."
            );
        }

        String status = normalizeStatus(request.status());

        validateProgressState(
                percentage,
                status,
                request.blocker()
        );

        RecoveryProgress progress = new RecoveryProgress();

        progress.setId("PRG-" + UUID.randomUUID());
        progress.setRecoveryPlanId(plan.getId());
        progress.setShipmentId(plan.getShipmentId());
        progress.setCompletionPercentage(percentage);
        progress.setStatus(status);
        progress.setMilestone(trimToNull(request.milestone()));
        progress.setBlocker(trimToNull(request.blocker()));
        progress.setNotes(trimToNull(request.notes()));
        progress.setUpdatedBy(authenticatedUserId);
        progress.setUpdatedAt(LocalDateTime.now());

        RecoveryProgress saved =
                recoveryProgressRepository.save(progress);

        auditEventService.recordEvent(
                "RECOVERY_PROGRESS",
                saved.getId(),
                "PROGRESS_UPDATED",
                authenticatedUserId,
                "Recovery plan " + plan.getId()
                        + " progress set to " + percentage
                        + "% with status " + status
        );

        if (StringUtils.hasText(plan.getCreatedBy())
                && !plan.getCreatedBy().equals(authenticatedUserId)) {

            notificationService.createNotification(
                    plan.getCreatedBy(),
                    "Recovery progress updated",
                    "Recovery plan " + plan.getId()
                            + " is now " + percentage
                            + "% complete. Status: " + status + ".",
                    BLOCKED.equals(status) ? "WARNING" : "INFO",
                    "RECOVERY_PLAN",
                    plan.getId()
            );
        }

        return RecoveryProgressResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<RecoveryProgressResponse> getProgressHistory(
            String recoveryPlanId
    ) {
        if (!StringUtils.hasText(recoveryPlanId)) {
            throw new IllegalArgumentException(
                    "Recovery plan ID is required."
            );
        }

        if (!recoveryPlanRepository.existsById(recoveryPlanId.trim())) {
            throw new IllegalArgumentException(
                    "Recovery plan not found: " + recoveryPlanId
            );
        }

        return recoveryProgressRepository
                .findByRecoveryPlanIdOrderByUpdatedAtDesc(
                        recoveryPlanId.trim()
                )
                .stream()
                .map(RecoveryProgressResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RecoveryProgressResponse> getShipmentProgressHistory(
            String shipmentId
    ) {
        if (!StringUtils.hasText(shipmentId)) {
            throw new IllegalArgumentException(
                    "Shipment ID is required."
            );
        }

        return recoveryProgressRepository
                .findByShipmentIdOrderByUpdatedAtDesc(
                        shipmentId.trim()
                )
                .stream()
                .map(RecoveryProgressResponse::from)
                .toList();
    }

    private void validateProgressState(
            int percentage,
            String status,
            String blocker
    ) {
        if (COMPLETED.equals(status) && percentage != 100) {
            throw new IllegalArgumentException(
                    "Completed progress must have a percentage of 100."
            );
        }

        if (COMPLETED.equals(status) && StringUtils.hasText(blocker)) {
            throw new IllegalArgumentException(
                    "A completed progress update cannot contain an active blocker."
            );
        }

        if (BLOCKED.equals(status) && !StringUtils.hasText(blocker)) {
            throw new IllegalArgumentException(
                    "A blocker description is required when progress is blocked."
            );
        }

        if (IN_PROGRESS.equals(status) && percentage == 100) {
            throw new IllegalArgumentException(
                    "Progress with 100 percent must have COMPLETED status."
            );
        }
    }

    private String normalizeStatus(String status) {

        if (!StringUtils.hasText(status)) {
            throw new IllegalArgumentException(
                    "Recovery progress status is required."
            );
        }

        String normalized = status.trim().toUpperCase();

        return switch (normalized) {
            case IN_PROGRESS -> IN_PROGRESS;
            case BLOCKED -> BLOCKED;
            case COMPLETED -> COMPLETED;
            default -> throw new IllegalArgumentException(
                    "Invalid recovery progress status: " + status
            );
        };
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}