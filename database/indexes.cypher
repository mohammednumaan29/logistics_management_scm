
// ============================================
// DISRUPTIONIQ - DATABASE INDEXES
// ============================================

// Shipment indexes
CREATE INDEX shipment_status_index IF NOT EXISTS
FOR (s:Shipment)
ON (s.status);

CREATE INDEX shipment_delivery_index IF NOT EXISTS
FOR (s:Shipment)
ON (s.expectedDelivery);

// Supplier indexes
CREATE INDEX supplier_status_index IF NOT EXISTS
FOR (s:Supplier)
ON (s.status);

// Warehouse indexes
CREATE INDEX warehouse_location_index IF NOT EXISTS
FOR (w:Warehouse)
ON (w.location);

// Inventory indexes
CREATE INDEX inventory_reorder_index IF NOT EXISTS
FOR (i:Inventory)
ON (i.reorderPoint);

// Order indexes
CREATE INDEX order_status_index IF NOT EXISTS
FOR (o:Order)
ON (o.status);

CREATE INDEX order_priority_index IF NOT EXISTS
FOR (o:Order)
ON (o.priority);

CREATE INDEX order_delivery_index IF NOT EXISTS
FOR (o:Order)
ON (o.promisedDelivery);

// Recovery plan indexes
CREATE INDEX recovery_plan_status_index IF NOT EXISTS
FOR (r:RecoveryPlan)
ON (r.status);
