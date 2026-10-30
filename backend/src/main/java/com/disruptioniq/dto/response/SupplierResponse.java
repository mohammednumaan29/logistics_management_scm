package com.disruptioniq.dto.response;

public record SupplierResponse(
        String id,
        String name,
        String status,
        int leadTimeDays
) {
}