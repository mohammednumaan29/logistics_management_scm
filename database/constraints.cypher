
// ============================================
// DISRUPTIONIQ - DATABASE CONSTRAINTS
// ============================================

// Supplier
CREATE CONSTRAINT supplier_id_unique IF NOT EXISTS
FOR (s:Supplier)
REQUIRE s.id IS UNIQUE;

// Shipment
CREATE CONSTRAINT shipment_id_unique IF NOT EXISTS
FOR (s:Shipment)
REQUIRE s.id IS UNIQUE;

// Warehouse
CREATE CONSTRAINT warehouse_id_unique IF NOT EXISTS
FOR (w:Warehouse)
REQUIRE w.id IS UNIQUE;

// Inventory
CREATE CONSTRAINT inventory_id_unique IF NOT EXISTS
FOR (i:Inventory)
REQUIRE i.id IS UNIQUE;

// Product
CREATE CONSTRAINT product_id_unique IF NOT EXISTS
FOR (p:Product)
REQUIRE p.id IS UNIQUE;

// Order
CREATE CONSTRAINT order_id_unique IF NOT EXISTS
FOR (o:Order)
REQUIRE o.id IS UNIQUE;

// Customer
CREATE CONSTRAINT customer_id_unique IF NOT EXISTS
FOR (c:Customer)
REQUIRE c.id IS UNIQUE;

// Recovery Plan
CREATE CONSTRAINT recovery_plan_id_unique IF NOT EXISTS
FOR (r:RecoveryPlan)
REQUIRE r.id IS UNIQUE;

// Recovery Progress
CREATE CONSTRAINT recovery_progress_id_unique IF NOT EXISTS
FOR (r:RecoveryProgress)
REQUIRE r.id IS UNIQUE;

// Carrier Webhook Event
CREATE CONSTRAINT carrier_event_id_unique IF NOT EXISTS
FOR (e:CarrierWebhookEvent)
REQUIRE e.eventId IS UNIQUE;
