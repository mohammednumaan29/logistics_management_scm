
package com.disruptioniq.service;

import com.disruptioniq.dto.response.InventoryResponse;
import com.disruptioniq.exception.ResourceNotFoundException;
import com.disruptioniq.model.Inventory;
import com.disruptioniq.repository.InventoryRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    public InventoryService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    public List<InventoryResponse> getAllInventory() {
        return inventoryRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public InventoryResponse getInventoryById(String id) {
        validateId(id);

        Inventory inventory = inventoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Inventory not found: " + id
                ));

        return toResponse(inventory);
    }

    private InventoryResponse toResponse(Inventory inventory) {
        validateInventory(inventory);

        return new InventoryResponse(
                inventory.getId(),
                inventory.getOnHand(),
                inventory.getReserved(),
                inventory.getReorderPoint(),
                inventory.getDailyDemand(),
                inventory.getAvailable()
        );
    }

    private void validateInventory(Inventory inventory) {
        if (inventory.getOnHand() < 0
                || inventory.getReserved() < 0
                || inventory.getReserved() > inventory.getOnHand()
                || inventory.getReorderPoint() < 0
                || inventory.getDailyDemand() < 0) {

            throw new IllegalStateException(
                    "Inventory contains invalid values: "
                            + inventory.getId()
            );
        }
    }

    private void validateId(String id) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException(
                    "Inventory ID is required."
            );
        }
    }
}
