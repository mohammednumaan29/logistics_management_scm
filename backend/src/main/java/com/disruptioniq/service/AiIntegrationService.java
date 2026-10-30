package com.disruptioniq.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;

import com.disruptioniq.client.AiServiceClient;
import com.disruptioniq.client.AiServiceClient.DisruptionSummaryPayload;
import com.disruptioniq.client.AiServiceClient.DisruptionSummaryResult;
import com.disruptioniq.client.AiServiceClient.RiskExplanationPayload;
import com.disruptioniq.client.AiServiceClient.RiskExplanationResult;
import com.disruptioniq.client.AiServiceClient.RecoveryOptionPayload;
import com.disruptioniq.client.AiServiceClient.RecoveryRecommendationPayload;
import com.disruptioniq.client.AiServiceClient.RecoveryRecommendationResult;

import com.disruptioniq.dto.request.AiDisruptionSummaryRequest;
import com.disruptioniq.dto.request.AiRecoveryOptionRequest;
import com.disruptioniq.dto.request.AiRecoveryRecommendationRequest;

import com.disruptioniq.dto.response.ImpactAnalysisResponse;
import com.disruptioniq.dto.response.RiskAssessmentResponse;
import com.disruptioniq.dto.response.RiskAssessmentResponse.OrderRisk;
import com.disruptioniq.dto.response.RiskAssessmentResponse.RiskFactor;

import com.disruptioniq.dto.response.AiDisruptionSummaryResponse;
import com.disruptioniq.dto.response.AiRiskExplanationResponse;
import com.disruptioniq.dto.response.AiRecoveryRecommendationResponse;

@Service
public class AiIntegrationService {

    private final AiServiceClient aiServiceClient;
    private final ImpactAnalysisService impactAnalysisService;
    private final RiskAssessmentService riskAssessmentService;

    public AiIntegrationService(
            AiServiceClient aiServiceClient,
            ImpactAnalysisService impactAnalysisService,
            RiskAssessmentService riskAssessmentService
    ) {
        this.aiServiceClient = aiServiceClient;
        this.impactAnalysisService = impactAnalysisService;
        this.riskAssessmentService = riskAssessmentService;
    }

    public AiDisruptionSummaryResponse summarizeDisruption(
            String shipmentId,
            AiDisruptionSummaryRequest request
    ) {
        validateShipmentId(shipmentId);

        if (request == null) {
            throw new IllegalArgumentException(
                    "Disruption summary request is required."
            );
        }

        ImpactAnalysisResponse impact =
                impactAnalysisService.analyzeShipment(shipmentId);

        RiskAssessmentResponse risk =
                riskAssessmentService.assessShipment(shipmentId);

        int affectedOrders = impact.affectedOrders() == null
                ? 0
                : impact.affectedOrders().size();

        int criticalOrders = risk.orders() == null
                ? 0
                : (int) risk.orders()
                        .stream()
                        .filter(order ->
                                "CRITICAL".equalsIgnoreCase(
                                        order.riskLevel()
                                )
                        )
                        .count();

        DisruptionSummaryPayload payload =
                new DisruptionSummaryPayload(
                        request.type().trim(),
                        impact.shipmentId(),
                        request.delayDays(),
                        trimToEmpty(request.reason()),
                        affectedOrders,
                        criticalOrders
                );

        try {
            DisruptionSummaryResult result =
                    aiServiceClient.explainDisruption(payload);

            if (result != null
                    && StringUtils.hasText(result.summary())) {

                return new AiDisruptionSummaryResponse(
                        impact.shipmentId(),
                        result.summary().trim(),
                        true
                );
            }

        } catch (RestClientException exception) {
            // AI failure must not break deterministic backend features.
        }

        return new AiDisruptionSummaryResponse(
                impact.shipmentId(),
                fallbackDisruptionSummary(
                        impact,
                        request,
                        affectedOrders,
                        criticalOrders
                ),
                false
        );
    }

    public List<AiRiskExplanationResponse> explainShipmentRisks(
            String shipmentId
    ) {
        validateShipmentId(shipmentId);

        RiskAssessmentResponse risk =
                riskAssessmentService.assessShipment(shipmentId);

        if (risk.orders() == null || risk.orders().isEmpty()) {
            return List.of();
        }

        List<AiRiskExplanationResponse> explanations =
                new ArrayList<>();

        for (OrderRisk order : risk.orders()) {

            List<String> factors = order.factors() == null
                    ? List.of()
                    : order.factors()
                            .stream()
                            .map(this::formatFactor)
                            .toList();

            RiskExplanationPayload payload =
                    new RiskExplanationPayload(
                            order.orderId(),
                            order.riskScore(),
                            order.riskLevel(),
                            factors
                    );

            try {
                RiskExplanationResult result =
                        aiServiceClient.explainRisk(payload);

                if (result != null
                        && StringUtils.hasText(result.explanation())) {

                    explanations.add(
                            new AiRiskExplanationResponse(
                                    risk.shipmentId(),
                                    order.orderId(),
                                    order.riskScore(),
                                    order.riskLevel(),
                                    result.explanation().trim(),
                                    true
                            )
                    );

                    continue;
                }

            } catch (RestClientException exception) {
                // Use deterministic explanation if AI is unavailable.
            }

            explanations.add(
                    new AiRiskExplanationResponse(
                            risk.shipmentId(),
                            order.orderId(),
                            order.riskScore(),
                            order.riskLevel(),
                            fallbackRiskExplanation(order),
                            false
                    )
            );
        }

        return List.copyOf(explanations);
    }

    public AiRecoveryRecommendationResponse recommendRecovery(
            AiRecoveryRecommendationRequest request
    ) {
        if (request == null
                || request.options() == null
                || request.options().isEmpty()) {

            throw new IllegalArgumentException(
                    "At least one recovery option is required."
            );
        }

        List<RecoveryOptionPayload> options =
                request.options()
                        .stream()
                        .map(option -> new RecoveryOptionPayload(
                                option.name().trim(),
                                option.cost(),
                                option.ordersSaved(),
                                option.recoveryDays()
                        ))
                        .toList();

        RecoveryRecommendationPayload payload =
                new RecoveryRecommendationPayload(options);

        try {
            RecoveryRecommendationResult result =
                    aiServiceClient.recommendRecovery(payload);

            if (isValidRecommendation(result, options)) {

                return new AiRecoveryRecommendationResponse(
                        result.recommendedOption().trim(),
                        result.reasoning().trim(),
                        result.tradeoffs() == null
                                ? List.of()
                                : List.copyOf(result.tradeoffs()),
                        true
                );
            }

        } catch (RestClientException exception) {
            // Use deterministic fallback if AI is unavailable.
        }

        return fallbackRecommendation(options);
    }

    public boolean isAiServiceAvailable() {
        return aiServiceClient.isAvailable();
    }

    private boolean isValidRecommendation(
            RecoveryRecommendationResult result,
            List<RecoveryOptionPayload> options
    ) {
        if (result == null
                || !StringUtils.hasText(result.recommendedOption())
                || !StringUtils.hasText(result.reasoning())) {
            return false;
        }

        boolean optionExists = options.stream()
                .anyMatch(option ->
                        option.name().equalsIgnoreCase(
                                result.recommendedOption().trim()
                        )
                );

        return optionExists;
    }

    private AiRecoveryRecommendationResponse fallbackRecommendation(
            List<RecoveryOptionPayload> options
    ) {
        /*
         * This fallback is deterministic and transparent.
         * It ranks the supplied options by:
         * 1. More orders saved.
         * 2. Fewer recovery days.
         * 3. Lower cost.
         *
         * It is not an AI-generated recommendation.
         */

        RecoveryOptionPayload best = options.stream()
                .max(
                        java.util.Comparator
                                .comparingInt(
                                        RecoveryOptionPayload::ordersSaved
                                )
                                .thenComparing(
                                        option -> -option.recoveryDays()
                                )
                                .thenComparing(
                                        option -> -option.cost()
                                )
                )
                .orElseThrow();

        return new AiRecoveryRecommendationResponse(
                best.name(),
                "AI service is unavailable. This fallback selected the "
                        + "option that saves the most orders, then prefers "
                        + "faster recovery and lower cost.",
                List.of(
                        "This is a deterministic fallback, not an AI recommendation.",
                        "Review operational feasibility before approval.",
                        "The backend must independently validate the selected strategy."
                ),
                false
        );
    }

    private String fallbackDisruptionSummary(
            ImpactAnalysisResponse impact,
            AiDisruptionSummaryRequest request,
            int affectedOrders,
            int criticalOrders
    ) {
        return "Shipment " + impact.shipmentId()
                + " has a " + request.type().replace('_', ' ').toLowerCase()
                + " disruption"
                + " with a reported delay of " + request.delayDays()
                + " days. It affects " + affectedOrders
                + " linked orders, including " + criticalOrders
                + " critical-risk orders. Available inventory is "
                + impact.available()
                + " units. "
                + (StringUtils.hasText(request.reason())
                    ? "Reported reason: " + request.reason().trim() + "."
                    : "No disruption reason was provided.");
    }

    private String fallbackRiskExplanation(OrderRisk order) {

        if (order.factors() == null || order.factors().isEmpty()) {
            return "Order " + order.orderId()
                    + " has a risk score of " + order.riskScore()
                    + " and risk level " + order.riskLevel()
                    + ". No risk factors were supplied.";
        }

        String reasons = order.factors()
                .stream()
                .filter(factor -> factor.points() > 0)
                .map(RiskFactor::explanation)
                .filter(StringUtils::hasText)
                .distinct()
                .reduce((first, second) -> first + "; " + second)
                .orElse("No positive risk factors were identified.");

        return "Order " + order.orderId()
                + " is classified as " + order.riskLevel()
                + " with a risk score of " + order.riskScore()
                + ". Contributing factors: " + reasons;
    }

    private String formatFactor(RiskFactor factor) {
        return factor.name()
                + ": "
                + factor.explanation()
                + " ("
                + factor.points()
                + " points)";
    }

    private void validateShipmentId(String shipmentId) {
        if (!StringUtils.hasText(shipmentId)) {
            throw new IllegalArgumentException(
                    "Shipment ID is required."
            );
        }
    }

    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}