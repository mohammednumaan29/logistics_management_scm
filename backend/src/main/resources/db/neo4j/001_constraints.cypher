
CREATE CONSTRAINT supplier_id_unique IF NOT EXISTS
FOR (n:Supplier)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT shipment_id_unique IF NOT EXISTS
FOR (n:Shipment)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT warehouse_id_unique IF NOT EXISTS
FOR (n:Warehouse)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT inventory_id_unique IF NOT EXISTS
FOR (n:Inventory)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT product_id_unique IF NOT EXISTS
FOR (n:Product)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT customer_id_unique IF NOT EXISTS
FOR (n:Customer)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT order_id_unique IF NOT EXISTS
FOR (n:Order)
REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT carrier_webhook_event_id_unique IF NOT EXISTS
FOR (n:CarrierWebhookEvent)
REQUIRE n.eventId IS UNIQUE;
