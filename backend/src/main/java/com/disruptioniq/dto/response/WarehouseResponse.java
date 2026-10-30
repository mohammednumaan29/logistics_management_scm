package com.disruptioniq.dto.response;

public record WarehouseResponse(
        String id,
        String name,
        String location,
        long capacity
) {
}