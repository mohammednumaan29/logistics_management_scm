package com.disruptioniq.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.disruptioniq.dto.request.AiDisruptionSummaryRequest;
import com.disruptioniq.dto.request.AiRecoveryRecommendationRequest;

import com.disruptioniq.dto.response.AiDisruptionSummaryResponse;
import com.disruptioniq.dto.response.AiRiskExplanationResponse;
import com.disruptioniq.dto.response.AiRecoveryRecommendationResponse;

import com.disruptioniq.service.AiIntegrationService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiIntegrationService aiIntegrationService;

    public AiController(
            AiIntegrationService aiIntegrationService
    ) {
        this.aiIntegrationService = aiIntegrationService;
    }

    /*
     * POST /api/ai/shipments/{shipmentId}/disruption-summary
     *
     * Generates a human-readable disruption summary.
     * Affected and critical order counts are calculated by Java.
     */
    @PostMapping("/shipments/{shipmentId}/disruption-summary")
    public ResponseEntity<AiDisruptionSummaryResponse> summarizeDisruption(
            @PathVariable String shipmentId,
            @Valid @RequestBody AiDisruptionSummaryRequest request
    ) {
        return ResponseEntity.ok(
                aiIntegrationService.summarizeDisruption(
                        shipmentId,
                        request
                )
        );
    }

    /*
     * GET /api/ai/shipments/{shipmentId}/risk-explanations
     *
     * Retrieves deterministic risk results from Java and asks
     * the AI service to explain each affected order.
     */
    @GetMapping("/shipments/{shipmentId}/risk-explanations")
    public ResponseEntity<List<AiRiskExplanationResponse>>
    explainShipmentRisks(
            @PathVariable String shipmentId
    ) {
        return ResponseEntity.ok(
                aiIntegrationService.explainShipmentRisks(shipmentId)
        );
    }

    /*
     * POST /api/ai/recovery-recommendation
     *
     * Compares supplied recovery options and returns an advisory
     * recommendation. It does not approve or execute a strategy.
     */
    @PostMapping("/recovery-recommendation")
    public ResponseEntity<AiRecoveryRecommendationResponse>
    recommendRecovery(
            @Valid @RequestBody AiRecoveryRecommendationRequest request
    ) {
        return ResponseEntity.ok(
                aiIntegrationService.recommendRecovery(request)
        );
    }

    /*
     * GET /api/ai/health
     *
     * Checks whether the separate FastAPI service is reachable.
     */
    @GetMapping("/health")
    public ResponseEntity<AiHealthResponse> health() {

        boolean available =
                aiIntegrationService.isAiServiceAvailable();

        return ResponseEntity.ok(
                new AiHealthResponse(
                        available,
                        available
                                ? "AI service is reachable."
                                : "AI service is unavailable. Deterministic backend features remain available."
                )
        );
    }

    public record AiHealthResponse(
            boolean available,
            String message
    ) {
    }
}