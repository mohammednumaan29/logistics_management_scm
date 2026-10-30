package com.disruptioniq.dto.response;

public record CarrierWebhookResponse(
        String eventId,
        String shipmentId,
        String status,
        boolean duplicate,
        String message
) {
}