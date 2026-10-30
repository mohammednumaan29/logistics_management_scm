
package com.disruptioniq.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.disruptioniq.dto.request.SimulationRequest;
import com.disruptioniq.dto.response.RecoveryFeasibilityResponse;
import com.disruptioniq.service.RecoveryStrategyFeasibilityService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/recovery/feasibility")
public class RecoveryStrategyFeasibilityController {

    private final RecoveryStrategyFeasibilityService feasibilityService;

    public RecoveryStrategyFeasibilityController(
            RecoveryStrategyFeasibilityService feasibilityService) {
        this.feasibilityService = feasibilityService;
    }

    @PostMapping
    public ResponseEntity<RecoveryFeasibilityResponse> evaluate(
            @Valid @RequestBody SimulationRequest request) {

        return ResponseEntity.ok(
                feasibilityService.evaluate(request)
        );
    }
}
