
package com.disruptioniq.service;

import java.time.LocalDate;

import org.springframework.stereotype.Service;

import com.disruptioniq.model.Customer;
import com.disruptioniq.model.Inventory;
import com.disruptioniq.model.Order;
import com.disruptioniq.model.Product;
import com.disruptioniq.model.Shipment;
import com.disruptioniq.model.Supplier;
import com.disruptioniq.model.Warehouse;

@Service
public class SupplyChainValidationService {

    public void validateShipment(Shipment shipment) {
        requireObject(shipment, "Shipment");

        requireText(shipment.getId(), "Shipment ID");

        if (shipment.getQuantity() <= 0) {
            throw invalid("Shipment quantity must be greater than zero.");
        }

        requireText(shipment.getStatus(), "Shipment status");

        if (shipment.getExpectedDelivery() == null) {
            throw invalid("Expected delivery date is required.");
        }
    }

    public void validateSupplier(Supplier supplier) {
        requireObject(supplier, "Supplier");

        requireText(supplier.getId(), "Supplier ID");
        requireText(supplier.getName(), "Supplier name");
        requireText(supplier.getStatus(), "Supplier status");

        if (supplier.getLeadTimeDays() < 0) {
            throw invalid("Supplier lead time cannot be negative.");
        }
    }

    public void validateWarehouse(Warehouse warehouse) {
        requireObject(warehouse, "Warehouse");

        requireText(warehouse.getId(), "Warehouse ID");
        requireText(warehouse.getName(), "Warehouse name");
        requireText(warehouse.getLocation(), "Warehouse location");

        if (warehouse.getCapacity() <= 0) {
            throw invalid("Warehouse capacity must be greater than zero.");
        }
    }

    public void validateInventory(Inventory inventory) {
        requireObject(inventory, "Inventory");

        requireText(inventory.getId(), "Inventory ID");

        if (inventory.getOnHand() < 0) {
            throw invalid("On-hand inventory cannot be negative.");
        }

        if (inventory.getReserved() < 0) {
            throw invalid("Reserved inventory cannot be negative.");
        }

        if (inventory.getReserved() > inventory.getOnHand()) {
            throw invalid(
                    "Reserved inventory cannot exceed on-hand inventory."
            );
        }

        if (inventory.getReorderPoint() < 0) {
            throw invalid("Reorder point cannot be negative.");
        }

        if (inventory.getDailyDemand() < 0) {
            throw invalid("Daily demand cannot be negative.");
        }
    }

    public void validateProduct(Product product) {
        requireObject(product, "Product");

        requireText(product.getId(), "Product ID");
        requireText(product.getName(), "Product name");
        requireText(product.getCategory(), "Product category");

        if (!Double.isFinite(product.getUnitCost())
                || product.getUnitCost() < 0) {
            throw invalid(
                    "Product unit cost must be a finite non-negative value."
            );
        }
    }

    public void validateOrder(Order order) {
        requireObject(order, "Order");

        requireText(order.getId(), "Order ID");
        requireText(order.getPriority(), "Order priority");
        requireText(order.getStatus(), "Order status");

        if (order.getQuantity() <= 0) {
            throw invalid("Order quantity must be greater than zero.");
        }

        if (order.getPromisedDelivery() == null) {
            throw invalid("Promised delivery date is required.");
        }
    }

    public void validateCustomer(Customer customer) {
        requireObject(customer, "Customer");

        requireText(customer.getId(), "Customer ID");
        requireText(customer.getName(), "Customer name");
        requireText(customer.getEmail(), "Customer email");

        if (!customer.getEmail().matches(
                "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$"
        )) {
            throw invalid("Customer email address is invalid.");
        }
    }

    public void validateDeliveryDate(LocalDate deliveryDate) {
        if (deliveryDate == null) {
            throw invalid("Delivery date is required.");
        }
    }

    private void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw invalid(field + " is required.");
        }
    }

    private void requireObject(Object object, String field) {
        if (object == null) {
            throw invalid(field + " data is required.");
        }
    }

    private IllegalArgumentException invalid(String message) {
        return new IllegalArgumentException(message);
    }
}
