package com.disruptioniq.dto.response;

public record AiRiskExplanationResponse(
        String shipmentId,
        String orderId,
        int riskScore,
        String riskLevel,
        String explanation,
        boolean aiAvailable
) {
}