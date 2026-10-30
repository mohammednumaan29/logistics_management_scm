
package com.disruptioniq.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RecoveryProgressUpdateRequest(

        @NotNull(message = "Completion percentage is required")
        @Min(value = 0, message = "Completion cannot be below 0")
        @Max(value = 100, message = "Completion cannot exceed 100")
        Integer completionPercentage,

        @NotBlank(message = "Progress status is required")
        String status,

        @Size(max = 200, message = "Milestone must not exceed 200 characters")
        String milestone,

        @Size(max = 1000, message = "Blocker must not exceed 1000 characters")
        String blocker,

        @Size(max = 2000, message = "Notes must not exceed 2000 characters")
        String notes
) {
}
