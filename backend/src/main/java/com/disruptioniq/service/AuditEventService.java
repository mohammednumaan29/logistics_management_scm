
package com.disruptioniq.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.disruptioniq.dto.response.AuditEventResponse;
import com.disruptioniq.model.AuditEvent;
import com.disruptioniq.repository.AuditEventRepository;

@Service
public class AuditEventService {

    private static final String RECOVERY_PLAN = "RECOVERY_PLAN";
    private static final String SHIPMENT = "SHIPMENT";

    private static final long DEFAULT_OFFSET = 0;
    private static final int DEFAULT_LIMIT = 50;

    private final AuditEventRepository auditEventRepository;

    public AuditEventService(
            AuditEventRepository auditEventRepository) {
        this.auditEventRepository = auditEventRepository;
    }

    // =========================================================
    // RECORD AUDIT EVENT
    // =========================================================

    @Transactional
    public AuditEventResponse recordEvent(
            String entityType,
            String entityId,
            String action,
            String performedBy,
            String reason) {

        validateEvent(entityType, entityId, action, performedBy);

        AuditEvent event = new AuditEvent();

        event.setId("AUD-" + UUID.randomUUID());
        event.setEntityType(entityType.trim().toUpperCase());
        event.setEntityId(entityId.trim());
        event.setAction(action.trim().toUpperCase());
        event.setPerformedBy(performedBy.trim());
        event.setReason(trimToNull(reason));
        event.setTimestamp(LocalDateTime.now());

        return AuditEventResponse.from(
                auditEventRepository.save(event)
        );
    }

    // =========================================================
    // RECOVERY PLAN HISTORY
    // =========================================================

    // Backward-compatible method used by existing controllers.
    @Transactional(readOnly = true)
    public List<AuditEventResponse> getRecoveryPlanHistory(
            String recoveryPlanId) {

        return getRecoveryPlanHistory(
                recoveryPlanId,
                DEFAULT_OFFSET,
                DEFAULT_LIMIT
        );
    }

    // Paginated method.
    @Transactional(readOnly = true)
    public List<AuditEventResponse> getRecoveryPlanHistory(
            String recoveryPlanId,
            long offset,
            int limit) {

        return getEntityHistory(
                RECOVERY_PLAN,
                recoveryPlanId,
                offset,
                limit
        );
    }

    // =========================================================
    // SHIPMENT HISTORY
    // =========================================================

    // Backward-compatible method used by existing controllers.
    @Transactional(readOnly = true)
    public List<AuditEventResponse> getShipmentHistory(
            String shipmentId) {

        return getShipmentHistory(
                shipmentId,
                DEFAULT_OFFSET,
                DEFAULT_LIMIT
        );
    }

    // Paginated method.
    @Transactional(readOnly = true)
    public List<AuditEventResponse> getShipmentHistory(
            String shipmentId,
            long offset,
            int limit) {

        return getEntityHistory(
                SHIPMENT,
                shipmentId,
                offset,
                limit
        );
    }

    // =========================================================
    // GENERAL ENTITY HISTORY
    // =========================================================

    // Backward-compatible method used by existing controllers.
    @Transactional(readOnly = true)
    public List<AuditEventResponse> getEntityHistory(
            String entityType,
            String entityId) {

        return getEntityHistory(
                entityType,
                entityId,
                DEFAULT_OFFSET,
                DEFAULT_LIMIT
        );
    }

    // Paginated method.
    @Transactional(readOnly = true)
    public List<AuditEventResponse> getEntityHistory(
            String entityType,
            String entityId,
            long offset,
            int limit) {

        validateHistoryParameters(entityType, entityId);
        validatePagination(offset, limit);

        return auditEventRepository.findEntityHistoryPage(
                        entityType.trim().toUpperCase(),
                        entityId.trim(),
                        offset,
                        limit
                )
                .stream()
                .map(AuditEventResponse::from)
                .toList();
    }

    // =========================================================
    // USER ACTIVITY HISTORY
    // =========================================================

    // Backward-compatible method used by existing controllers.
    @Transactional(readOnly = true)
    public List<AuditEventResponse> getUserActivityHistory(
            String userId) {

        return getUserActivityHistory(
                userId,
                DEFAULT_OFFSET,
                DEFAULT_LIMIT
        );
    }

    // Paginated method.
    @Transactional(readOnly = true)
    public List<AuditEventResponse> getUserActivityHistory(
            String userId,
            long offset,
            int limit) {

        if (!StringUtils.hasText(userId)) {
            throw new IllegalArgumentException(
                    "User ID is required."
            );
        }

        validatePagination(offset, limit);

        return auditEventRepository.findUserHistoryPage(
                        userId.trim(),
                        offset,
                        limit
                )
                .stream()
                .map(AuditEventResponse::from)
                .toList();
    }

    // =========================================================
    // VALIDATION
    // =========================================================

    private void validateEvent(
            String entityType,
            String entityId,
            String action,
            String performedBy) {

        if (!StringUtils.hasText(entityType)
                || !StringUtils.hasText(entityId)
                || !StringUtils.hasText(action)
                || !StringUtils.hasText(performedBy)) {

            throw new IllegalArgumentException(
                    "Required audit event information is missing."
            );
        }
    }

    private void validateHistoryParameters(
            String entityType,
            String entityId) {

        if (!StringUtils.hasText(entityType)) {
            throw new IllegalArgumentException(
                    "Entity type is required."
            );
        }

        if (!StringUtils.hasText(entityId)) {
            throw new IllegalArgumentException(
                    "Entity ID is required."
            );
        }
    }

    private void validatePagination(
            long offset,
            int limit) {

        if (offset < 0) {
            throw new IllegalArgumentException(
                    "Offset cannot be negative."
            );
        }

        if (limit < 1 || limit > 500) {
            throw new IllegalArgumentException(
                    "Limit must be between 1 and 500."
            );
        }
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value)
                ? value.trim()
                : null;
    }
}
