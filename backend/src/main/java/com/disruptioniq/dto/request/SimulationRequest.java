
package com.disruptioniq.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record SimulationRequest(

        @NotBlank(message = "Shipment ID is required")
        String shipmentId,

        @NotNull(message = "Recovery strategy is required")
        Strategy strategy,

        @Min(value = 1, message = "Delay days must be at least 1")
        int delayDays,

        @Min(value = 1, message = "Expedited arrival days must be at least 1")
        int expeditedArrivalDays,

        @PositiveOrZero(message = "Expedite cost cannot be negative")
        double expediteCost,

        String sourceWarehouseId,

        @Min(value = 1, message = "Reallocation quantity must be at least 1")
        long reallocationQuantity,

        String alternativeSupplierId,

        @Min(value = 1, message = "Split quantity must be at least 1")
        long splitQuantity

) {

    public enum Strategy {
        DO_NOTHING,
        REALLOCATE_STOCK,
        EXPEDITE_SHIPMENT,
        ALTERNATIVE_SUPPLIER,
        SPLIT_ORDER
    }
}
