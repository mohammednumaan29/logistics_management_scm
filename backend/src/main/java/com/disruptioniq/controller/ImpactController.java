package com.disruptioniq.controller;

import com.disruptioniq.dto.response.ImpactAnalysisResponse;
import com.disruptioniq.service.ImpactAnalysisService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/impact")
public class ImpactController {

    private final ImpactAnalysisService impactAnalysisService;

    public ImpactController(
            ImpactAnalysisService impactAnalysisService
    ) {
        this.impactAnalysisService = impactAnalysisService;
    }

    @GetMapping("/shipments/{shipmentId}")
    public ImpactAnalysisResponse analyzeShipment(
            @PathVariable String shipmentId
    ) {
        return impactAnalysisService.analyzeShipment(shipmentId);
    }
}