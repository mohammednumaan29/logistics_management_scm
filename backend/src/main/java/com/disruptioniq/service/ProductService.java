package com.disruptioniq.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.disruptioniq.dto.response.ProductResponse;
import com.disruptioniq.exception.ResourceNotFoundException;
import com.disruptioniq.model.Product;
import com.disruptioniq.repository.ProductRepository;

@Service
public class ProductService {

    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<ProductResponse> getAllProducts() {
        return productRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ProductResponse getProductById(String id) {

        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException(
                    "Product ID is required."
            );
        }

        Product product = productRepository.findById(id.trim())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Product not found: " + id
                ));

        return toResponse(product);
    }

    private ProductResponse toResponse(Product product) {
        return new ProductResponse(
                product.getId(),
                product.getName(),
                product.getCategory(),
                product.getUnitCost()
        );
    }
}