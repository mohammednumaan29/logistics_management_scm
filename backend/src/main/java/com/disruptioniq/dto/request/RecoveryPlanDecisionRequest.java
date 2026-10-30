
package com.disruptioniq.dto.request;

import jakarta.validation.constraints.NotBlank;

public record RecoveryPlanDecisionRequest(

        @NotBlank(message = "Decision reason is required")
        String reason

) {
}
