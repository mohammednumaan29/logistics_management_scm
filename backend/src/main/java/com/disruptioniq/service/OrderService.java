
package com.disruptioniq.service;

import com.disruptioniq.dto.response.OrderResponse;
import com.disruptioniq.exception.ResourceNotFoundException;
import com.disruptioniq.model.Order;
import com.disruptioniq.repository.OrderRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public List<OrderResponse> getAllOrders() {
        return orderRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public OrderResponse getOrderById(String id) {
        validateId(id);

        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Order not found: " + id
                ));

        return toResponse(order);
    }

    private OrderResponse toResponse(Order order) {
        if (order.getQuantity() <= 0) {
            throw new IllegalStateException(
                    "Order contains an invalid quantity: "
                            + order.getId()
            );
        }

        return new OrderResponse(
                order.getId(),
                order.getPriority(),
                order.getQuantity(),
                order.getPromisedDelivery(),
                order.getStatus()
        );
    }

    private void validateId(String id) {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException(
                    "Order ID is required."
            );
        }
    }
}
