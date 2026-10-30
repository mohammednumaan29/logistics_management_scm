
package com.disruptioniq.dto.response;

public record NotificationSummaryResponse(
        long totalNotifications,
        long unreadNotifications
) {
}
