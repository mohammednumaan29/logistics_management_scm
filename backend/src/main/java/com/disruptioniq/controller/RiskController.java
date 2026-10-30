
package com.disruptioniq.controller;

import com.disruptioniq.dto.response.RiskAssessmentResponse;
import com.disruptioniq.service.RiskAssessmentService;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/risk")
public class RiskController {

    private final RiskAssessmentService riskAssessmentService;

    public RiskController(
            RiskAssessmentService riskAssessmentService
    ) {
        this.riskAssessmentService = riskAssessmentService;
    }

    @GetMapping("/shipments/{shipmentId}")
    public RiskAssessmentResponse assessShipment(
            @PathVariable String shipmentId
    ) {
        return riskAssessmentService.assessShipment(shipmentId);
    }
}
