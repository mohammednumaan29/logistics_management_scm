package com.disruptioniq.dto.request;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record AiRecoveryRecommendationRequest(

        @NotNull(message = "Recovery options are required")
        @NotEmpty(message = "At least one recovery option is required")
        List<@Valid AiRecoveryOptionRequest> options

) {
}