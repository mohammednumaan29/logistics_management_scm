
package com.disruptioniq.service;

import com.disruptioniq.dto.response.ShipmentResponse;
import com.disruptioniq.exception.ResourceNotFoundException;
import com.disruptioniq.model.Shipment;
import com.disruptioniq.repository.ShipmentRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class ShipmentService {

    private final ShipmentRepository shipmentRepository;

    public ShipmentService(ShipmentRepository shipmentRepository) {
        this.shipmentRepository = shipmentRepository;
    }

    public List<ShipmentResponse> getAllShipments() {
        return shipmentRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ShipmentResponse getShipmentById(String id) {
        validateId(id);

        Shipment shipment = shipmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Shipment not found: " + id
                ));

        return toResponse(shipment);
    }

    private ShipmentResponse toResponse(Shipment shipment) {
        return new ShipmentResponse(
                shipment.getId(),
                shipment.getQuantity(),
                shipment.getStatus(),
                shipment.getExpectedDelivery()
        );
    }

    private void validateId(String id) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException(
                    "Shipment ID is required."
            );
        }
    }
}
