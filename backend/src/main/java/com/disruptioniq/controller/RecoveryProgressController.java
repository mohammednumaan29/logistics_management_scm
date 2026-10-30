
package com.disruptioniq.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.disruptioniq.dto.request.RecoveryProgressUpdateRequest;
import com.disruptioniq.dto.response.RecoveryProgressResponse;
import com.disruptioniq.service.RecoveryProgressService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/recovery-progress")
public class RecoveryProgressController {

    private final RecoveryProgressService recoveryProgressService;

    public RecoveryProgressController(
            RecoveryProgressService recoveryProgressService) {
        this.recoveryProgressService = recoveryProgressService;
    }

    @PostMapping("/{recoveryPlanId}")
    public ResponseEntity<RecoveryProgressResponse> updateProgress(
            @PathVariable String recoveryPlanId,
            @Valid @RequestBody RecoveryProgressUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        String authenticatedUserId = jwt.getClaimAsString("userId");

        RecoveryProgressResponse response =
                recoveryProgressService.updateProgress(
                        recoveryPlanId,
                        request,
                        authenticatedUserId
                );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/plan/{recoveryPlanId}")
    public ResponseEntity<List<RecoveryProgressResponse>> getProgressHistory(
            @PathVariable String recoveryPlanId) {

        return ResponseEntity.ok(
                recoveryProgressService.getProgressHistory(recoveryPlanId)
        );
    }

    @GetMapping("/shipment/{shipmentId}")
    public ResponseEntity<List<RecoveryProgressResponse>> getShipmentProgressHistory(
            @PathVariable String shipmentId) {

        return ResponseEntity.ok(
                recoveryProgressService.getShipmentProgressHistory(shipmentId)
        );
    }
}
