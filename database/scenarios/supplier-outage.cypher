
// ============================================
// SCENARIO 2 - SUPPLIER OUTAGE
// ============================================

// Mark supplier as disrupted

MATCH (s:Supplier {id: 'SUP-002'})
SET s.status = 'DISRUPTED';

// Find shipments supplied by this supplier

MATCH (s:Supplier {id: 'SUP-002'})
      -[:SENDS]->(sh:Shipment)
OPTIONAL MATCH (sh)-[:DELIVERS_TO]->(w:Warehouse)
RETURN s, sh, w;

// Find downstream inventory and orders

MATCH (s:Supplier {id: 'SUP-002'})
      -[:SENDS]->(sh:Shipment)
      -[:DELIVERS_TO]->(w:Warehouse)
      -[:STORES]->(i:Inventory)
      -[:FOR]->(p:Product)
      -[:REQUIRED_BY]->(o:Order)
RETURN
    s.id AS supplierId,
    sh.id AS shipmentId,
    w.id AS warehouseId,
    p.id AS productId,
    o.id AS orderId,
    o.priority AS priority,
    o.status AS orderStatus;
