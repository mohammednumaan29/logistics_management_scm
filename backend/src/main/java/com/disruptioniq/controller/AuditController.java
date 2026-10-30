
package com.disruptioniq.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.disruptioniq.dto.response.AuditEventResponse;
import com.disruptioniq.service.AuditEventService;

@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditEventService auditEventService;

    public AuditController(
            AuditEventService auditEventService) {

        this.auditEventService = auditEventService;
    }

    // =====================================================
    // RECOVERY PLAN HISTORY
    // GET /api/audit/recovery-plans/{id}
    // =====================================================

    @GetMapping("/recovery-plans/{id}")
    public ResponseEntity<List<AuditEventResponse>>
    getRecoveryPlanHistory(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") long offset,
            @RequestParam(defaultValue = "100") int limit) {

        return ResponseEntity.ok(
                auditEventService.getRecoveryPlanHistory(
                        id, offset, limit
                )
        );
    }

    // =====================================================
    // SHIPMENT HISTORY
    // GET /api/audit/shipments/{id}
    // =====================================================

    @GetMapping("/shipments/{id}")
    public ResponseEntity<List<AuditEventResponse>>
    getShipmentHistory(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") long offset,
            @RequestParam(defaultValue = "100") int limit) {

        return ResponseEntity.ok(
                auditEventService.getShipmentHistory(
                        id, offset, limit
                )
        );
    }

    // =====================================================
    // GENERIC ENTITY HISTORY
    // GET /api/audit/entities/{type}/{id}
    // =====================================================

    @GetMapping("/entities/{type}/{id}")
    public ResponseEntity<List<AuditEventResponse>>
    getEntityHistory(
            @PathVariable String type,
            @PathVariable String id,
            @RequestParam(defaultValue = "0") long offset,
            @RequestParam(defaultValue = "100") int limit) {

        return ResponseEntity.ok(
                auditEventService.getEntityHistory(
                        type, id, offset, limit
                )
        );
    }

    // =====================================================
    // USER ACTIVITY HISTORY
    // GET /api/audit/users/me
    // =====================================================

    @GetMapping("/users/me")
    public ResponseEntity<List<AuditEventResponse>>
    getMyActivityHistory(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") long offset,
            @RequestParam(defaultValue = "100") int limit) {

        if (jwt == null) {
            throw new AccessDeniedException(
                    "Authentication is required."
            );
        }

        String userId = jwt.getClaimAsString("userId");

        if (userId == null || userId.isBlank()) {
            throw new AccessDeniedException(
                    "Authenticated user ID not found."
            );
        }

        return ResponseEntity.ok(
                auditEventService.getUserActivityHistory(
                        userId, offset, limit
                )
        );
    }
}
