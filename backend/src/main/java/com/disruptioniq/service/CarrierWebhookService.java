
package com.disruptioniq.service;

import com.disruptioniq.dto.request.CarrierWebhookRequest;
import com.disruptioniq.dto.response.CarrierWebhookResponse;
import com.disruptioniq.model.AppUser;
import com.disruptioniq.model.Shipment;
import com.disruptioniq.repository.AppUserRepository;
import com.disruptioniq.repository.CarrierWebhookEventRepository;
import com.disruptioniq.repository.ShipmentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class CarrierWebhookService {

    private static final String WEBHOOK_ACTOR = "CARRIER_WEBHOOK";

    private final CarrierWebhookEventRepository eventRepository;
    private final ShipmentRepository shipmentRepository;
    private final AppUserRepository appUserRepository;
    private final NotificationService notificationService;
    private final AuditEventService auditEventService;
    private final ObjectMapper objectMapper;
    private final Validator validator;

    @Value("${app.webhook.carrier-secret:}")
    private String webhookSecret;

    public CarrierWebhookService(
            CarrierWebhookEventRepository eventRepository,
            ShipmentRepository shipmentRepository,
            AppUserRepository appUserRepository,
            NotificationService notificationService,
            AuditEventService auditEventService,
            ObjectMapper objectMapper,
            Validator validator
    ) {
        this.eventRepository = eventRepository;
        this.shipmentRepository = shipmentRepository;
        this.appUserRepository = appUserRepository;
        this.notificationService = notificationService;
        this.auditEventService = auditEventService;
        this.objectMapper = objectMapper;
        this.validator = validator;
    }

    @Transactional
    public CarrierWebhookResponse receiveEvent(
            String rawBody,
            String signatureHeader
    ) {

        if (rawBody == null || rawBody.isBlank()) {
            throw new IllegalArgumentException(
                    "Webhook body cannot be empty."
            );
        }

        verifySignature(rawBody, signatureHeader);

        CarrierWebhookRequest request;

        try {
            request = objectMapper.readValue(
                    rawBody,
                    CarrierWebhookRequest.class
            );
        } catch (Exception exception) {
            throw new IllegalArgumentException(
                    "Invalid carrier webhook JSON payload."
            );
        }

        validateRequest(request);

        String payloadHash = generatePayloadHash(request);
        String claimToken = UUID.randomUUID().toString();

        boolean claimed = eventRepository.claimEvent(
                request.eventId(),
                request.shipmentId(),
                request.eventType().name(),
                request.occurredAt().toString(),
                Instant.now().toString(),
                payloadHash,
                claimToken
        );

        if (!claimed) {
            return handleDuplicate(request, payloadHash);
        }

        var latestEvent = eventRepository
                .findLatestProcessedEventForShipment(
                        request.shipmentId()
                );

        if (latestEvent.isPresent()
                && request.occurredAt().isBefore(
                        Instant.parse(
                                latestEvent.get().getOccurredAt()
                        )
                )) {

            boolean markedStale = eventRepository.markStale(
                    request.eventId(),
                    claimToken,
                    Instant.now().toString()
            );

            if (!markedStale) {
                throw new IllegalStateException(
                        "Unable to mark stale carrier event."
                );
            }

            auditEventService.recordEvent(
                    "SHIPMENT",
                    request.shipmentId(),
                    "CARRIER_EVENT_STALE",
                    WEBHOOK_ACTOR,
                    "Older carrier event " + request.eventId()
                            + " ignored because a newer event was processed."
            );

            return new CarrierWebhookResponse(
                    request.eventId(),
                    request.shipmentId(),
                    "STALE",
                    false,
                    "Older carrier event ignored. Shipment state was not changed."
            );
        }

        Shipment shipment = shipmentRepository
                .findById(request.shipmentId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Shipment not found: " + request.shipmentId()
                ));

        String previousStatus = shipment.getStatus();

        updateShipment(shipment, request);

        shipmentRepository.save(shipment);

        boolean processed = eventRepository.markProcessed(
                request.eventId(),
                claimToken,
                Instant.now().toString()
        );

        if (!processed) {
            throw new IllegalStateException(
                    "Carrier event claim was lost before processing completed."
            );
        }

        auditEventService.recordEvent(
                "SHIPMENT",
                request.shipmentId(),
                "CARRIER_EVENT_RECEIVED",
                WEBHOOK_ACTOR,
                "Carrier event " + request.eventId()
                        + " processed. Event type: "
                        + request.eventType().name()
        );

        if (previousStatus == null
                || !previousStatus.equalsIgnoreCase(
                        shipment.getStatus()
                )) {

            auditEventService.recordEvent(
                    "SHIPMENT",
                    request.shipmentId(),
                    "SHIPMENT_STATUS_CHANGED",
                    WEBHOOK_ACTOR,
                    "Shipment status changed from "
                            + previousStatus + " to "
                            + shipment.getStatus()
                            + " due to carrier event "
                            + request.eventId()
            );
        }

        notifyOperationsTeam(request);

        return new CarrierWebhookResponse(
                request.eventId(),
                request.shipmentId(),
                "PROCESSED",
                false,
                "Carrier event processed successfully."
        );
    }

    private CarrierWebhookResponse handleDuplicate(
            CarrierWebhookRequest request,
            String payloadHash
    ) {
        var existing = eventRepository.findById(
                request.eventId()
        ).orElseThrow(() -> new IllegalStateException(
                "Carrier event claim could not be found. Retry the request."
        ));

        if (!payloadHash.equals(existing.getPayloadHash())) {
            throw new IllegalStateException(
                    "Event ID has already been used with a different payload."
            );
        }

        return new CarrierWebhookResponse(
                request.eventId(),
                request.shipmentId(),
                "DUPLICATE",
                true,
                "This carrier event has already been received."
        );
    }

    private void validateRequest(
            CarrierWebhookRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "Carrier webhook payload is required."
            );
        }

        Set<ConstraintViolation<CarrierWebhookRequest>> violations =
                validator.validate(request);

        if (!violations.isEmpty()) {
            throw new IllegalArgumentException(
                    violations.iterator().next().getMessage()
            );
        }

        if (request.occurredAt().isAfter(
                Instant.now().plusSeconds(300)
        )) {
            throw new IllegalArgumentException(
                    "Carrier event timestamp cannot be more than five minutes in the future."
            );
        }

        if (request.delayDays() != null
                && request.delayDays() > 3650) {
            throw new IllegalArgumentException(
                    "Carrier delay cannot exceed ten years."
            );
        }

        if (request.expectedDelivery() != null
                && request.expectedDelivery().isBefore(LocalDate.now())) {
            throw new IllegalArgumentException(
                    "Expected delivery date cannot be in the past."
            );
        }
    }

    private void updateShipment(
            Shipment shipment,
            CarrierWebhookRequest request
    ) {
        switch (request.eventType()) {

            case SHIPMENT_DELAYED -> {

                shipment.setStatus("DELAYED");

                if (request.expectedDelivery() != null) {
                    shipment.setExpectedDelivery(
                            request.expectedDelivery()
                    );

                } else if (request.delayDays() != null) {

                    LocalDate currentDate =
                            shipment.getExpectedDelivery();

                    if (currentDate == null) {
                        throw new IllegalArgumentException(
                                "Shipment has no expected delivery date."
                        );
                    }

                    shipment.setExpectedDelivery(
                            currentDate.plusDays(
                                    request.delayDays()
                            )
                    );
                }
            }

            case SHIPMENT_DISRUPTED ->
                    shipment.setStatus("DISRUPTED");

            case SHIPMENT_IN_TRANSIT ->
                    shipment.setStatus("IN_TRANSIT");

            case SHIPMENT_DELIVERED ->
                    shipment.setStatus("DELIVERED");

            case EXPECTED_DELIVERY_UPDATED -> {

                if (request.expectedDelivery() == null) {
                    throw new IllegalArgumentException(
                            "Expected delivery date is required."
                    );
                }

                shipment.setExpectedDelivery(
                        request.expectedDelivery()
                );
            }
        }
    }

    private void notifyOperationsTeam(
            CarrierWebhookRequest request
    ) {
        List<String> roles = List.of(
                "OPERATIONS_ANALYST",
                "SUPPLY_CHAIN_MANAGER",
                "ADMIN"
        );

        List<AppUser> recipients =
                appUserRepository.findByRoleInAndEnabledTrue(roles);

        String title;
        String message;
        String notificationType;

        switch (request.eventType()) {

            case SHIPMENT_DELAYED -> {
                title = "Shipment Delay Detected";
                message = "Shipment " + request.shipmentId()
                        + " has been delayed by the carrier.";
                notificationType = "WARNING";
            }

            case SHIPMENT_DISRUPTED -> {
                title = "Critical Shipment Disruption";
                message = "Shipment " + request.shipmentId()
                        + " has encountered a disruption.";
                notificationType = "ERROR";
            }

            case SHIPMENT_IN_TRANSIT -> {
                title = "Shipment In Transit";
                message = "Shipment " + request.shipmentId()
                        + " is now in transit.";
                notificationType = "INFO";
            }

            case SHIPMENT_DELIVERED -> {
                title = "Shipment Delivered";
                message = "Shipment " + request.shipmentId()
                        + " has been successfully delivered.";
                notificationType = "SUCCESS";
            }

            case EXPECTED_DELIVERY_UPDATED -> {
                title = "Delivery Date Updated";
                message = "The expected delivery date for shipment "
                        + request.shipmentId() + " has been updated.";
                notificationType = "INFO";
            }

            default -> {
                return;
            }
        }

        for (AppUser recipient : recipients) {
            notificationService.createNotification(
                    recipient.getId(),
                    title,
                    message,
                    notificationType,
                    "SHIPMENT",
                    request.shipmentId()
            );
        }
    }

    private void verifySignature(
            String rawBody,
            String signatureHeader
    ) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new IllegalStateException(
                    "Carrier webhook secret is not configured."
            );
        }

        if (signatureHeader == null
                || !signatureHeader.startsWith("sha256=")) {

            throw new AccessDeniedException(
                    "Missing or invalid carrier signature."
            );
        }

        String expected = calculateHmac(
                rawBody,
                webhookSecret
        );

        boolean valid = MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signatureHeader.getBytes(StandardCharsets.UTF_8)
        );

        if (!valid) {
            throw new AccessDeniedException(
                    "Invalid carrier webhook signature."
            );
        }
    }

    private String calculateHmac(
            String rawBody,
            String secret
    ) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");

            SecretKeySpec key = new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8),
                    "HmacSHA256"
            );

            mac.init(key);

            byte[] hash = mac.doFinal(
                    rawBody.getBytes(StandardCharsets.UTF_8)
            );

            return "sha256=" + HexFormat.of().formatHex(hash);

        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Unable to calculate carrier signature.",
                    exception
            );
        }
    }

    private String generatePayloadHash(
            CarrierWebhookRequest request
    ) {
        try {
            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            byte[] canonicalPayload =
                    objectMapper.writeValueAsBytes(request);

            return HexFormat.of().formatHex(
                    digest.digest(canonicalPayload)
            );

        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Unable to calculate carrier payload hash.",
                    exception
            );
        }
    }
}
