package com.disruptioniq.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.disruptioniq.dto.request.RecoveryPlanDecisionRequest;
import com.disruptioniq.dto.request.RecoveryPlanRequest;
import com.disruptioniq.dto.response.RecoveryPlanResponse;
import com.disruptioniq.exception.ResourceNotFoundException;
import com.disruptioniq.model.RecoveryPlan;
import com.disruptioniq.repository.RecoveryPlanRepository;

@Service
public class RecoveryPlanService {

    private static final String PENDING_APPROVAL = "PENDING_APPROVAL";
    private static final String APPROVED = "APPROVED";
    private static final String REJECTED = "REJECTED";

    private final RecoveryPlanRepository recoveryPlanRepository;
    private final AuditEventService auditEventService;
    private final NotificationService notificationService;

    public RecoveryPlanService(
            RecoveryPlanRepository recoveryPlanRepository,
            AuditEventService auditEventService,
            NotificationService notificationService
    ) {
        this.recoveryPlanRepository = recoveryPlanRepository;
        this.auditEventService = auditEventService;
        this.notificationService = notificationService;
    }

    @Transactional
    public RecoveryPlanResponse createPlan(
            RecoveryPlanRequest request,
            String authenticatedUserId
    ) {
        validateCreateRequest(request, authenticatedUserId);

        RecoveryPlan plan = new RecoveryPlan();

        plan.setId("RP-" + UUID.randomUUID());
        plan.setShipmentId(request.shipmentId().trim());
        plan.setStrategy(request.strategy().name());
        plan.setCreatedBy(authenticatedUserId);
        plan.setStatus(PENDING_APPROVAL);

        plan.setEstimatedCost(request.estimatedCost());
        plan.setEstimatedRecoveryDays(request.estimatedRecoveryDays());
        plan.setOrdersSaved(request.ordersSaved());

        // Persist strategy-specific parameters.
        plan.setSourceWarehouseId(request.sourceWarehouseId());
        plan.setReallocationQuantity(request.reallocationQuantity());
        plan.setExpeditedArrivalDays(request.expeditedArrivalDays());
        plan.setAlternativeSupplierId(request.alternativeSupplierId());
        plan.setSplitQuantity(request.splitQuantity());

        plan.setApprovedBy(null);
        plan.setDecidedBy(null);
        plan.setDecisionReason(null);

        plan.setCreatedAt(LocalDateTime.now());
        plan.setDecidedAt(null);

        plan.setExecutionStatus("NOT_STARTED");
        plan.setExecutionMessage("Waiting for approval.");

        RecoveryPlan savedPlan =
                recoveryPlanRepository.save(plan);

        auditEventService.recordEvent(
                "RECOVERY_PLAN",
                savedPlan.getId(),
                "PLAN_CREATED",
                authenticatedUserId,
                "Recovery plan created and submitted for approval."
        );

        return toResponse(savedPlan);
    }

    @Transactional(readOnly = true)
    public RecoveryPlanResponse getPlanById(String id) {

        RecoveryPlan plan = findPlan(id);

        return toResponse(plan);
    }

    @Transactional(readOnly = true)
    public List<RecoveryPlanResponse> getAllPlans() {

        return recoveryPlanRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RecoveryPlanResponse> getPlansByShipment(
            String shipmentId
    ) {
        if (!StringUtils.hasText(shipmentId)) {
            throw new IllegalArgumentException(
                    "Shipment ID is required."
            );
        }

        return recoveryPlanRepository
                .findByShipmentId(shipmentId.trim())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RecoveryPlanResponse> getPendingPlans() {

        return recoveryPlanRepository
                .findByStatus(PENDING_APPROVAL)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public RecoveryPlanResponse approvePlan(
            String id,
            RecoveryPlanDecisionRequest request,
            String authenticatedUserId
    ) {
        validateDecisionRequest(request, authenticatedUserId);

        RecoveryPlan plan = getPlanForDecision(
                id,
                authenticatedUserId
        );

        plan.setStatus(APPROVED);
        plan.setApprovedBy(authenticatedUserId);
        plan.setDecidedBy(authenticatedUserId);
        plan.setDecisionReason(request.reason().trim());
        plan.setDecidedAt(LocalDateTime.now());

        plan.setExecutionStatus("NOT_STARTED");
        plan.setExecutionMessage("Plan approved and waiting for execution.");

        RecoveryPlan savedPlan =
                recoveryPlanRepository.save(plan);

        auditEventService.recordEvent(
                "RECOVERY_PLAN",
                savedPlan.getId(),
                "PLAN_APPROVED",
                authenticatedUserId,
                request.reason().trim()
        );

        notifyPlanCreator(
                savedPlan,
                "Recovery plan approved",
                "Your recovery plan " + savedPlan.getId()
                        + " has been approved.",
                "SUCCESS"
        );

        return toResponse(savedPlan);
    }

    @Transactional
    public RecoveryPlanResponse rejectPlan(
            String id,
            RecoveryPlanDecisionRequest request,
            String authenticatedUserId
    ) {
        validateDecisionRequest(request, authenticatedUserId);

        RecoveryPlan plan = getPlanForDecision(
                id,
                authenticatedUserId
        );

        plan.setStatus(REJECTED);
        plan.setApprovedBy(null);
        plan.setDecidedBy(authenticatedUserId);
        plan.setDecisionReason(request.reason().trim());
        plan.setDecidedAt(LocalDateTime.now());

        plan.setExecutionStatus("NOT_STARTED");
        plan.setExecutionMessage("Recovery plan was rejected.");

        RecoveryPlan savedPlan =
                recoveryPlanRepository.save(plan);

        auditEventService.recordEvent(
                "RECOVERY_PLAN",
                savedPlan.getId(),
                "PLAN_REJECTED",
                authenticatedUserId,
                request.reason().trim()
        );

        notifyPlanCreator(
                savedPlan,
                "Recovery plan rejected",
                "Your recovery plan " + savedPlan.getId()
                        + " was rejected. Reason: "
                        + request.reason().trim(),
                "WARNING"
        );

        return toResponse(savedPlan);
    }

    private RecoveryPlan getPlanForDecision(
            String id,
            String authenticatedUserId
    ) {
        RecoveryPlan plan = findPlan(id);

        if (!PENDING_APPROVAL.equalsIgnoreCase(plan.getStatus())) {
            throw new IllegalStateException(
                    "Only pending recovery plans can be approved or rejected."
            );
        }

        if (authenticatedUserId.equals(plan.getCreatedBy())) {
            throw new IllegalStateException(
                    "The plan creator cannot approve or reject their own plan."
            );
        }

        return plan;
    }

    private RecoveryPlan findPlan(String id) {

        if (!StringUtils.hasText(id)) {
            throw new IllegalArgumentException(
                    "Recovery plan ID is required."
            );
        }

        return recoveryPlanRepository.findById(id.trim())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Recovery plan not found: " + id
                ));
    }

    private void validateCreateRequest(
            RecoveryPlanRequest request,
            String authenticatedUserId
    ) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "Recovery plan request is required."
            );
        }

        if (!StringUtils.hasText(authenticatedUserId)) {
            throw new IllegalArgumentException(
                    "Authenticated user ID is required."
            );
        }

        if (!StringUtils.hasText(request.shipmentId())) {
            throw new IllegalArgumentException(
                    "Shipment ID is required."
            );
        }

        if (request.strategy() == null) {
            throw new IllegalArgumentException(
                    "Recovery strategy is required."
            );
        }

        if (!Double.isFinite(request.estimatedCost())
                || request.estimatedCost() < 0) {
            throw new IllegalArgumentException(
                    "Estimated cost must be finite and non-negative."
            );
        }

        if (request.estimatedRecoveryDays() < 0
                || request.ordersSaved() < 0) {
            throw new IllegalArgumentException(
                    "Recovery days and saved orders cannot be negative."
            );
        }

        switch (request.strategy()) {

            case REALLOCATE_STOCK -> {
                if (!StringUtils.hasText(request.sourceWarehouseId())
                        || request.reallocationQuantity() == null
                        || request.reallocationQuantity() <= 0) {
                    throw new IllegalArgumentException(
                            "Reallocation requires a source warehouse and positive quantity."
                    );
                }
            }

            case EXPEDITE_SHIPMENT -> {
                if (request.expeditedArrivalDays() == null
                        || request.expeditedArrivalDays() < 1) {
                    throw new IllegalArgumentException(
                            "Expedited shipment requires a positive arrival time."
                    );
                }
            }

            case ALTERNATIVE_SUPPLIER -> {
                if (!StringUtils.hasText(request.alternativeSupplierId())) {
                    throw new IllegalArgumentException(
                            "Alternative supplier ID is required."
                    );
                }
            }

            case SPLIT_ORDER -> {
                if (request.splitQuantity() == null
                        || request.splitQuantity() <= 0) {
                    throw new IllegalArgumentException(
                            "Split order requires a positive split quantity."
                    );
                }
            }

            case DO_NOTHING -> {
                // No additional parameters are required.
            }
        }
    }

    private void validateDecisionRequest(
            RecoveryPlanDecisionRequest request,
            String authenticatedUserId
    ) {
        if (!StringUtils.hasText(authenticatedUserId)) {
            throw new IllegalArgumentException(
                    "Authenticated user ID is required."
            );
        }

        if (request == null || !StringUtils.hasText(request.reason())) {
            throw new IllegalArgumentException(
                    "A decision reason is required."
            );
        }
    }

    private void notifyPlanCreator(
            RecoveryPlan plan,
            String title,
            String message,
            String type
    ) {
        if (StringUtils.hasText(plan.getCreatedBy())) {
            notificationService.createNotification(
                    plan.getCreatedBy(),
                    title,
                    message,
                    type,
                    "RECOVERY_PLAN",
                    plan.getId()
            );
        }
    }

    private RecoveryPlanResponse toResponse(RecoveryPlan plan) {

        return new RecoveryPlanResponse(
                plan.getId(),
                plan.getShipmentId(),
                plan.getStrategy(),
                plan.getCreatedBy(),
                plan.getStatus(),
                plan.getEstimatedCost(),
                plan.getEstimatedRecoveryDays(),
                plan.getOrdersSaved(),
                plan.getApprovedBy(),
                plan.getDecidedBy(),
                plan.getDecisionReason(),
                plan.getCreatedAt(),
                plan.getDecidedAt()
        );
    }
}