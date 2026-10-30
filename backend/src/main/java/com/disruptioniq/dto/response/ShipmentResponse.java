package com.disruptioniq.dto.response;

import java.time.LocalDate;

public record ShipmentResponse(
        String id,
        int quantity,
        String status,
        LocalDate expectedDelivery
) {
}
