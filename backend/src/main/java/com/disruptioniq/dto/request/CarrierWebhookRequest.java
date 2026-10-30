package com.disruptioniq.dto.request;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record CarrierWebhookRequest(

        @NotBlank(message = "Event ID is required")
        String eventId,

        @NotBlank(message = "Shipment ID is required")
        String shipmentId,

        @NotNull(message = "Event type is required")
        EventType eventType,

        @NotNull(message = "Event timestamp is required")
        Instant occurredAt,

        @PositiveOrZero(message = "Delay days cannot be negative")
        Integer delayDays,

        LocalDate expectedDelivery
) {

    public enum EventType {
        SHIPMENT_DELAYED,
        SHIPMENT_DISRUPTED,
        SHIPMENT_IN_TRANSIT,
        SHIPMENT_DELIVERED,
        EXPECTED_DELIVERY_UPDATED
    }
}