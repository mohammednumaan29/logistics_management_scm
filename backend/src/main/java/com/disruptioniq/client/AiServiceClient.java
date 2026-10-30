package com.disruptioniq.client;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class AiServiceClient {

    private final RestClient restClient;

    public AiServiceClient(
            RestClient.Builder builder,
            @Value("${ai.service.url:http://127.0.0.1:8000}")
            String aiServiceUrl
    ) {
        this.restClient = builder
                .baseUrl(aiServiceUrl)
                .build();
    }

    public DisruptionSummaryResult explainDisruption(
            DisruptionSummaryPayload request
    ) {
        return restClient.post()
                .uri("/api/v1/explanations/disruption")
                .body(request)
                .retrieve()
                .body(DisruptionSummaryResult.class);
    }

    public RiskExplanationResult explainRisk(
            RiskExplanationPayload request
    ) {
        return restClient.post()
                .uri("/api/v1/explanations/risk")
                .body(request)
                .retrieve()
                .body(RiskExplanationResult.class);
    }

    public RecoveryRecommendationResult recommendRecovery(
            RecoveryRecommendationPayload request
    ) {
        return restClient.post()
                .uri("/api/v1/recommendations/recovery")
                .body(request)
                .retrieve()
                .body(RecoveryRecommendationResult.class);
    }

    public boolean isAvailable() {
        try {
            return restClient.get()
                    .uri("/health")
                    .retrieve()
                    .toBodilessEntity()
                    .getStatusCode()
                    .is2xxSuccessful();

        } catch (RestClientException exception) {
            return false;
        }
    }

    /*
     * Internal request/response records.
     * Their JSON field names match the existing FastAPI schemas.
     */

    public record DisruptionSummaryPayload(
            String type,
            String shipmentId,
            int delayDays,
            String reason,
            int affectedOrders,
            int criticalOrders
    ) {
    }

    public record DisruptionSummaryResult(
            String summary
    ) {
    }

    public record RiskExplanationPayload(
            String orderId,
            int riskScore,
            String riskLevel,
            List<String> factors
    ) {
    }

    public record RiskExplanationResult(
            String explanation
    ) {
    }

    public record RecoveryOptionPayload(
            String name,
            double cost,
            int ordersSaved,
            int recoveryDays
    ) {
    }

    public record RecoveryRecommendationPayload(
            List<RecoveryOptionPayload> options
    ) {
    }

    public record RecoveryRecommendationResult(
            String recommendedOption,
            String reasoning,
            List<String> tradeoffs
    ) {
    }
}