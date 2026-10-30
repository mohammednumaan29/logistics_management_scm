
package com.disruptioniq.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.disruptioniq.dto.response.ImportResponse;
import com.disruptioniq.service.SupplyChainImportService;

@RestController
@RequestMapping("/api/import")
public class SupplyChainImportController {

    private final SupplyChainImportService supplyChainImportService;

    public SupplyChainImportController(
            SupplyChainImportService supplyChainImportService) {

        this.supplyChainImportService = supplyChainImportService;
    }

    /**
     * Import supply-chain data using CSV or JSON files.
     *
     * Supported entity types:
     * suppliers, shipments, warehouses,
     * inventory, products, customers, orders.
     */
    @PostMapping(
            value = "/{entityType}",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<ImportResponse> importFile(
            @PathVariable String entityType,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) {

        if (jwt == null) {
            throw new IllegalArgumentException(
                    "Authenticated user information is required."
            );
        }

        String authenticatedUserId =
                jwt.getClaimAsString("userId");

        ImportResponse response =
                supplyChainImportService.importFile(
                        entityType,
                        file,
                        authenticatedUserId
                );

        return ResponseEntity
                .status(HttpStatus.OK)
                .body(response);
    }
}
