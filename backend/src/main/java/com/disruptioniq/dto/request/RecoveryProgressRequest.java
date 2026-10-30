package com.disruptioniq.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RecoveryProgressRequest(

        @NotNull(message = "Progress percentage is required")
        @Min(value = 0, message = "Progress cannot be below 0")
        @Max(value = 100, message = "Progress cannot exceed 100")
        Integer percentage,

        @NotBlank(message = "Progress status is required")
        String status,

        @Size(max = 1000, message = "Blocker description cannot exceed 1000 characters")
        String blocker

) {
}