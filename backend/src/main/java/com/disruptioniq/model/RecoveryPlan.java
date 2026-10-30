
package com.disruptioniq.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Version;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("RecoveryPlan")
public class RecoveryPlan {

    @Id
    private String id;

    private String shipmentId;
    private String strategy;
    private String createdBy;
    private String status;

    private double estimatedCost;
    private int estimatedRecoveryDays;
    private int ordersSaved;

    private String approvedBy;
    private String decidedBy;
    private String decisionReason;

    private LocalDateTime createdAt;
    private LocalDateTime decidedAt;

    // Strategy-specific parameters saved with the approved plan
    private String sourceWarehouseId;
    private Long reallocationQuantity;
    private Integer expeditedArrivalDays;
    private String alternativeSupplierId;
    private Long splitQuantity;

    // Execution tracking
    private String executionStatus;
    private String executionMessage;
    private LocalDateTime executedAt;
    private String executedBy;

    // Optimistic locking
    @Version
    private Long version;

    public RecoveryPlan() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getShipmentId() {
        return shipmentId;
    }

    public void setShipmentId(String shipmentId) {
        this.shipmentId = shipmentId;
    }

    public String getStrategy() {
        return strategy;
    }

    public void setStrategy(String strategy) {
        this.strategy = strategy;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public double getEstimatedCost() {
        return estimatedCost;
    }

    public void setEstimatedCost(double estimatedCost) {
        this.estimatedCost = estimatedCost;
    }

    public int getEstimatedRecoveryDays() {
        return estimatedRecoveryDays;
    }

    public void setEstimatedRecoveryDays(int estimatedRecoveryDays) {
        this.estimatedRecoveryDays = estimatedRecoveryDays;
    }

    public int getOrdersSaved() {
        return ordersSaved;
    }

    public void setOrdersSaved(int ordersSaved) {
        this.ordersSaved = ordersSaved;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public String getDecidedBy() {
        return decidedBy;
    }

    public void setDecidedBy(String decidedBy) {
        this.decidedBy = decidedBy;
    }

    public String getDecisionReason() {
        return decisionReason;
    }

    public void setDecisionReason(String decisionReason) {
        this.decisionReason = decisionReason;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(LocalDateTime decidedAt) {
        this.decidedAt = decidedAt;
    }

    public String getSourceWarehouseId() {
        return sourceWarehouseId;
    }

    public void setSourceWarehouseId(String sourceWarehouseId) {
        this.sourceWarehouseId = sourceWarehouseId;
    }

    public Long getReallocationQuantity() {
        return reallocationQuantity;
    }

    public void setReallocationQuantity(Long reallocationQuantity) {
        this.reallocationQuantity = reallocationQuantity;
    }

    public Integer getExpeditedArrivalDays() {
        return expeditedArrivalDays;
    }

    public void setExpeditedArrivalDays(Integer expeditedArrivalDays) {
        this.expeditedArrivalDays = expeditedArrivalDays;
    }

    public String getAlternativeSupplierId() {
        return alternativeSupplierId;
    }

    public void setAlternativeSupplierId(String alternativeSupplierId) {
        this.alternativeSupplierId = alternativeSupplierId;
    }

    public Long getSplitQuantity() {
        return splitQuantity;
    }

    public void setSplitQuantity(Long splitQuantity) {
        this.splitQuantity = splitQuantity;
    }

    public String getExecutionStatus() {
        return executionStatus;
    }

    public void setExecutionStatus(String executionStatus) {
        this.executionStatus = executionStatus;
    }

    public String getExecutionMessage() {
        return executionMessage;
    }

    public void setExecutionMessage(String executionMessage) {
        this.executionMessage = executionMessage;
    }

    public LocalDateTime getExecutedAt() {
        return executedAt;
    }

    public void setExecutedAt(LocalDateTime executedAt) {
        this.executedAt = executedAt;
    }

    public String getExecutedBy() {
        return executedBy;
    }

    public void setExecutedBy(String executedBy) {
        this.executedBy = executedBy;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }
}
