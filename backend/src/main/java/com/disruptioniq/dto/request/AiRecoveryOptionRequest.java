package com.disruptioniq.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record AiRecoveryOptionRequest(

        @NotBlank(message = "Recovery option name is required")
        @Size(max = 100)
        String name,

        @PositiveOrZero(message = "Cost cannot be negative")
        double cost,

        @PositiveOrZero(message = "Orders saved cannot be negative")
        int ordersSaved,

        @PositiveOrZero(message = "Recovery days cannot be negative")
        int recoveryDays

) {
}