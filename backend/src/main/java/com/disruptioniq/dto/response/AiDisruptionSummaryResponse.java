package com.disruptioniq.dto.response;

public record AiDisruptionSummaryResponse(
        String shipmentId,
        String summary,
        boolean aiAvailable
) {
}