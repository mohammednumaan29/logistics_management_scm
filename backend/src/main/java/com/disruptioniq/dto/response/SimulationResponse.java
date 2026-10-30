
package com.disruptioniq.dto.response;

import java.util.List;

public record SimulationResponse(
    String shipmentId,
    String strategy,
    String feasibility,
    String message,
    long availableInventory,
    long projectedDemand,
    long projectedShortage,
    long unitsRecovered,
    int estimatedRecoveryDays,
    double estimatedCost,
    int ordersSaved,
    int residualRiskScore,
    String residualRiskLevel,
    List<String> warnings
) {}
