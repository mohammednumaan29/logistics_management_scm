
package com.disruptioniq.controller;

import com.disruptioniq.dto.request.SimulationRequest;
import com.disruptioniq.dto.response.SimulationResponse;
import com.disruptioniq.service.RecoverySimulationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/simulation")
public class SimulationController {

    private final RecoverySimulationService recoverySimulationService;

    public SimulationController(
            RecoverySimulationService recoverySimulationService) {
        this.recoverySimulationService = recoverySimulationService;
    }

    @PostMapping
    public SimulationResponse simulate(
            @Valid @RequestBody SimulationRequest request) {
        return recoverySimulationService.simulate(request);
    }
}
