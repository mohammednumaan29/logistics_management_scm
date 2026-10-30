
package com.disruptioniq.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.disruptioniq.model.RecoveryPlan;
import com.disruptioniq.service.RecoveryPlanExecutionService;

@RestController
@RequestMapping("/api/recovery-plans")
public class RecoveryPlanExecutionController {

    private final RecoveryPlanExecutionService executionService;

    public RecoveryPlanExecutionController(
            RecoveryPlanExecutionService executionService) {
        this.executionService = executionService;
    }

    @PostMapping("/{id}/execute")
    public ResponseEntity<RecoveryPlan> execute(
            @PathVariable String id,
            @AuthenticationPrincipal Jwt jwt) {

        if (jwt == null || jwt.getClaimAsString("userId") == null) {
            throw new AccessDeniedException(
                    "Authenticated user identity is required."
            );
        }

        String userId = jwt.getClaimAsString("userId");

        return ResponseEntity.ok(
                executionService.execute(id, userId)
        );
    }
}
