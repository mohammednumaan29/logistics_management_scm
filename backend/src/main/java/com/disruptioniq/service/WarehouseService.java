
package com.disruptioniq.service;

import com.disruptioniq.dto.response.WarehouseResponse;
import com.disruptioniq.exception.ResourceNotFoundException;
import com.disruptioniq.model.Warehouse;
import com.disruptioniq.repository.WarehouseRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;

    public WarehouseService(WarehouseRepository warehouseRepository) {
        this.warehouseRepository = warehouseRepository;
    }

    public List<WarehouseResponse> getAllWarehouses() {
        return warehouseRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public WarehouseResponse getWarehouseById(String id) {
        validateId(id);

        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Warehouse not found: " + id
                ));

        return toResponse(warehouse);
    }

    private WarehouseResponse toResponse(Warehouse warehouse) {
        return new WarehouseResponse(
                warehouse.getId(),
                warehouse.getName(),
                warehouse.getLocation(),
                warehouse.getCapacity()
        );
    }

    private void validateId(String id) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException(
                    "Warehouse ID is required."
            );
        }
    }
}
