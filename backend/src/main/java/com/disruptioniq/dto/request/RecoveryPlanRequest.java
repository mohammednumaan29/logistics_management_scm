
package com.disruptioniq.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

public record RecoveryPlanRequest(

        @NotBlank(message = "Shipment ID is required")
        String shipmentId,

        @NotNull(message = "Recovery strategy is required")
        SimulationRequest.Strategy strategy,

        @PositiveOrZero(message = "Estimated cost cannot be negative")
        double estimatedCost,

        @PositiveOrZero(message = "Estimated recovery days cannot be negative")
        int estimatedRecoveryDays,

        @PositiveOrZero(message = "Orders saved cannot be negative")
        int ordersSaved,

        String sourceWarehouseId,

        @Positive(message = "Reallocation quantity must be positive")
        Long reallocationQuantity,

        Integer expeditedArrivalDays,

        String alternativeSupplierId,

        @Positive(message = "Split quantity must be positive")
        Long splitQuantity
) {}
