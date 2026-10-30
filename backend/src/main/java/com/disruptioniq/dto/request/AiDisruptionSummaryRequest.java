package com.disruptioniq.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiDisruptionSummaryRequest(

        @NotBlank(message = "Disruption type is required")
        @Size(max = 100)
        String type,

        @Min(value = 0, message = "Delay days cannot be negative")
        int delayDays,

        @Size(max = 1000, message = "Reason cannot exceed 1000 characters")
        String reason

) {
}