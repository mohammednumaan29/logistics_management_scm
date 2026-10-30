
// ============================================
// SCENARIO 1 - SHIPMENT DELAY
// ============================================

// Mark shipment as delayed

MATCH (s:Shipment {id: 'SH-102'})
SET s.status = 'DELAYED',
    s.expectedDelivery = date('2026-11-03');

// Display affected shipment and its supplier

MATCH (supplier:Supplier)-[:SENDS]->(s:Shipment {id: 'SH-102'})
OPTIONAL MATCH (s)-[:DELIVERS_TO]->(w:Warehouse)
RETURN supplier, s, w;

// Check available inventory

MATCH (w:Warehouse)-[:STORES]->(i:Inventory)
MATCH (i)-[:FOR]->(p:Product {id: 'PROD-100'})
RETURN
    w.id AS warehouse,
    i.onHand AS onHand,
    i.reserved AS reserved,
    i.onHand - i.reserved AS available,
    i.dailyDemand AS dailyDemand,
    (i.dailyDemand * 4) AS demandDuringDelay,
    (i.dailyDemand * 4) - (i.onHand - i.reserved) AS potentialShortage;
