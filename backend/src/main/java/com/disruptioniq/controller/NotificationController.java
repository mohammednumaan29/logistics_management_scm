package com.disruptioniq.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.disruptioniq.dto.response.NotificationResponse;
import com.disruptioniq.dto.response.NotificationSummaryResponse;
import com.disruptioniq.service.NotificationService;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(
            NotificationService notificationService) {

        this.notificationService = notificationService;
    }

    // =====================================================
    // GET NOTIFICATIONS
    // GET /api/notifications
    // =====================================================

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getNotifications(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "0") long offset,
            @RequestParam(defaultValue = "50") int limit) {

        String userId = authenticatedUserId(jwt);

        return ResponseEntity.ok(
                notificationService.getNotifications(
                        userId,
                        unreadOnly,
                        offset,
                        limit
                )
        );
    }

    // =====================================================
    // NOTIFICATION SUMMARY
    // GET /api/notifications/summary
    // =====================================================

    @GetMapping("/summary")
    public ResponseEntity<NotificationSummaryResponse> getSummary(
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(
                notificationService.getSummary(
                        authenticatedUserId(jwt)
                )
        );
    }

    // =====================================================
    // MARK NOTIFICATION AS READ
    // PATCH /api/notifications/{id}/read
    // =====================================================

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markAsRead(
            @PathVariable String id,
            @AuthenticationPrincipal Jwt jwt) {

        return ResponseEntity.ok(
                notificationService.markAsRead(
                        id,
                        authenticatedUserId(jwt)
                )
        );
    }

    // =====================================================
    // AUTHENTICATED USER
    // =====================================================

    private String authenticatedUserId(Jwt jwt) {

        if (jwt == null) {
            throw new AccessDeniedException(
                    "Authentication is required."
            );
        }

        String userId = jwt.getClaimAsString("userId");

        if (userId == null || userId.isBlank()) {
            throw new AccessDeniedException(
                    "Authenticated user identity is required."
            );
        }

        return userId;
    }
}
