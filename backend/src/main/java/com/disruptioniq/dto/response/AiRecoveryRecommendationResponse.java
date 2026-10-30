package com.disruptioniq.dto.response;

import java.util.List;

public record AiRecoveryRecommendationResponse(
        String recommendedOption,
        String reasoning,
        List<String> tradeoffs,
        boolean aiAvailable
) {
}