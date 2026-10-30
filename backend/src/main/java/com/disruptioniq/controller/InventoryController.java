package com.disruptioniq.controller;

import com.disruptioniq.dto.response.InventoryResponse;
import com.disruptioniq.service.InventoryService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    public List<InventoryResponse> getAllInventory() {
        return inventoryService.getAllInventory();
    }

    @GetMapping("/{id}")
    public InventoryResponse getInventoryById(@PathVariable String id) {
        return inventoryService.getInventoryById(id);
    }
}