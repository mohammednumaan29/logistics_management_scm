
package com.disruptioniq.controller;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.disruptioniq.dto.request.RecoveryPlanDecisionRequest;
import com.disruptioniq.dto.request.RecoveryPlanRequest;
import com.disruptioniq.dto.response.AuditEventResponse;
import com.disruptioniq.dto.response.RecoveryPlanResponse;
import com.disruptioniq.service.AuditEventService;
import com.disruptioniq.service.RecoveryPlanService;

@RestController
@RequestMapping("/api/recovery-plans")
public class RecoveryPlanController {

    private final RecoveryPlanService recoveryPlanService;
    private final AuditEventService auditEventService;

    public RecoveryPlanController(
            RecoveryPlanService recoveryPlanService,
            AuditEventService auditEventService) {

        this.recoveryPlanService = recoveryPlanService;
        this.auditEventService = auditEventService;
    }

    // Create a plan using the authenticated user's identity.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecoveryPlanResponse createPlan(
            @Valid @RequestBody RecoveryPlanRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        String userId = getAuthenticatedUserId(jwt);

        return recoveryPlanService.createPlan(request, userId);
    }

    @GetMapping
    public List<RecoveryPlanResponse> getAllPlans() {
        return recoveryPlanService.getAllPlans();
    }

    @GetMapping("/{id}")
    public RecoveryPlanResponse getPlanById(
            @PathVariable String id) {

        return recoveryPlanService.getPlanById(id);
    }

    @GetMapping("/shipment/{shipmentId}")
    public List<RecoveryPlanResponse> getPlansByShipment(
            @PathVariable String shipmentId) {

        return recoveryPlanService.getPlansByShipment(shipmentId);
    }

    @GetMapping("/pending")
    public List<RecoveryPlanResponse> getPendingPlans() {
        return recoveryPlanService.getPendingPlans();
    }

    // The decision-maker comes from the authenticated JWT.
    @PostMapping("/{id}/approve")
    public RecoveryPlanResponse approvePlan(
            @PathVariable String id,
            @Valid @RequestBody RecoveryPlanDecisionRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        String userId = getAuthenticatedUserId(jwt);

        return recoveryPlanService.approvePlan(id, request, userId);
    }

    @PostMapping("/{id}/reject")
    public RecoveryPlanResponse rejectPlan(
            @PathVariable String id,
            @Valid @RequestBody RecoveryPlanDecisionRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        String userId = getAuthenticatedUserId(jwt);

        return recoveryPlanService.rejectPlan(id, request, userId);
    }

    @GetMapping("/{id}/audit")
    public List<AuditEventResponse> getRecoveryPlanAuditHistory(
            @PathVariable String id) {

        // Ensure the recovery plan exists before retrieving its history.
        recoveryPlanService.getPlanById(id);

        return auditEventService.getRecoveryPlanHistory(id);
    }

    private String getAuthenticatedUserId(Jwt jwt) {

        if (jwt == null) {
            throw new AccessDeniedException(
                    "An authenticated user is required.");
        }

        String userId = jwt.getClaimAsString("userId");

        if (!StringUtils.hasText(userId)) {
            throw new AccessDeniedException(
                    "The authenticated token does not contain a valid user ID.");
        }

        return userId;
    }
}
