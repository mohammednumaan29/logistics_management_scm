
package com.disruptioniq.dto.response;

import java.time.LocalDateTime;

import com.disruptioniq.model.AuditEvent;

public record AuditEventResponse(
        String id,
        String entityType,
        String entityId,
        String action,
        String performedBy,
        String reason,
        LocalDateTime timestamp
) {

    public static AuditEventResponse from(AuditEvent event) {

        return new AuditEventResponse(
                event.getId(),
                event.getEntityType(),
                event.getEntityId(),
                event.getAction(),
                event.getPerformedBy(),
                event.getReason(),
                event.getTimestamp()
        );
    }
}
