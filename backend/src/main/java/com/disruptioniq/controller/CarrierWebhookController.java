package com.disruptioniq.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.disruptioniq.dto.response.CarrierWebhookResponse;
import com.disruptioniq.service.CarrierWebhookService;

@RestController
@RequestMapping("/api/webhooks")
public class CarrierWebhookController {

    private final CarrierWebhookService carrierWebhookService;

    public CarrierWebhookController(
            CarrierWebhookService carrierWebhookService) {
        this.carrierWebhookService = carrierWebhookService;
    }

    @PostMapping(
            value = "/carrier",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<CarrierWebhookResponse> receiveCarrierEvent(
            @RequestBody String rawBody,
            @RequestHeader(
                    value = "X-Carrier-Signature",
                    required = false
            ) String signature) {

        CarrierWebhookResponse response =
                carrierWebhookService.receiveEvent(rawBody, signature);

        return ResponseEntity.ok(response);
    }
}