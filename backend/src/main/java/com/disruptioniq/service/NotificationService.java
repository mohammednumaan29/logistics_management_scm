package com.disruptioniq.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.disruptioniq.dto.response.NotificationResponse;
import com.disruptioniq.dto.response.NotificationSummaryResponse;
import com.disruptioniq.model.Notification;
import com.disruptioniq.repository.NotificationRepository;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(
            NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public Notification createNotification(
            String userId,
            String title,
            String message,
            String type,
            String relatedEntityType,
            String relatedEntityId) {

        requireUser(userId);

        if (!StringUtils.hasText(title)
                || !StringUtils.hasText(message)) {
            throw new IllegalArgumentException(
                    "Notification title and message are required."
            );
        }

        Notification notification = new Notification();

        notification.setId("NOT-" + UUID.randomUUID());
        notification.setUserId(userId.trim());
        notification.setTitle(title.trim());
        notification.setMessage(message.trim());
        notification.setType(
                StringUtils.hasText(type)
                        ? type.trim().toUpperCase()
                        : "INFO"
        );
        notification.setRelatedEntityType(trimToNull(relatedEntityType));
        notification.setRelatedEntityId(trimToNull(relatedEntityId));
        notification.setRead(false);
        notification.setCreatedAt(LocalDateTime.now());
        notification.setReadAt(null);

        return notificationRepository.save(notification);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getNotifications(
            String authenticatedUserId,
            boolean unreadOnly,
            long offset,
            int limit) {

        requireUser(authenticatedUserId);
        validatePagination(offset, limit);

        List<Notification> notifications = unreadOnly
                ? notificationRepository
                    .findByUserIdAndReadFalseOrderByCreatedAtDesc(
                            authenticatedUserId.trim())
                : notificationRepository
                    .findByUserIdOrderByCreatedAtDesc(
                            authenticatedUserId.trim());

        return notifications.stream()
                .skip(offset)
                .limit(limit)
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public NotificationSummaryResponse getSummary(
            String authenticatedUserId) {

        requireUser(authenticatedUserId);

        String userId = authenticatedUserId.trim();

        long total = notificationRepository.countByUserId(userId);

        long unread = notificationRepository
                .countByUserIdAndReadFalse(userId);

        return new NotificationSummaryResponse(total, unread);
    }

    @Transactional
    public NotificationResponse markAsRead(
            String notificationId,
            String authenticatedUserId) {

        requireUser(authenticatedUserId);

        if (!StringUtils.hasText(notificationId)) {
            throw new IllegalArgumentException(
                    "Notification ID is required."
            );
        }

        Notification notification = notificationRepository
                .findByIdAndUserId(
                        notificationId.trim(),
                        authenticatedUserId.trim())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Notification not found."
                ));

        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(LocalDateTime.now());

            notification = notificationRepository.save(notification);
        }

        return NotificationResponse.from(notification);
    }

    private void validatePagination(long offset, int limit) {

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

    private void requireUser(String userId) {
        if (!StringUtils.hasText(userId)) {
            throw new IllegalArgumentException(
                    "Authenticated user identity is required."
            );
        }
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}