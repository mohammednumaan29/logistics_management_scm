
package com.disruptioniq.dto.response;

import java.util.List;

public record RiskAssessmentResponse(
        String shipmentId,
        String shipmentStatus,
        List<OrderRisk> orders
) {
    public record OrderRisk(
            String orderId,
            String priority,
            int riskScore,
            String riskLevel,
            List<RiskFactor> factors
    ) {
    }

    public record RiskFactor(
            String name,
            int points,
            String explanation
    ) {
    }
}
