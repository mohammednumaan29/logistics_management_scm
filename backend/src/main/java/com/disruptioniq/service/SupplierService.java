
package com.disruptioniq.service;

import com.disruptioniq.dto.response.SupplierResponse;
import com.disruptioniq.exception.ResourceNotFoundException;
import com.disruptioniq.model.Supplier;
import com.disruptioniq.repository.SupplierRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    public List<SupplierResponse> getAllSuppliers() {
        return supplierRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public SupplierResponse getSupplierById(String id) {
        validateId(id);

        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Supplier not found: " + id
                ));

        return toResponse(supplier);
    }

    private SupplierResponse toResponse(Supplier supplier) {
        return new SupplierResponse(
                supplier.getId(),
                supplier.getName(),
                supplier.getStatus(),
                supplier.getLeadTimeDays()
        );
    }

    private void validateId(String id) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException(
                    "Supplier ID is required."
            );
        }
    }
}
