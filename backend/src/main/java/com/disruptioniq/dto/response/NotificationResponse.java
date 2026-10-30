
package com.disruptioniq.dto.response;

import java.time.LocalDateTime;

import com.disruptioniq.model.Notification;

public record NotificationResponse(
        String id,
        String title,
        String message,
        String type,
        String relatedEntityType,
        String relatedEntityId,
        boolean read,
        LocalDateTime createdAt,
        LocalDateTime readAt
) {

    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getType(),
                notification.getRelatedEntityType(),
                notification.getRelatedEntityId(),
                notification.isRead(),
                notification.getCreatedAt(),
                notification.getReadAt()
        );
    }
}
