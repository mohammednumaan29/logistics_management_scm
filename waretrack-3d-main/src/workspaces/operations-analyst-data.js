export const warehouseSummary = {
  warehouseName: 'Central Distribution Warehouse',
  warehouseId: 'WH-001',
  totalPallets: 128,
  occupiedLocations: 86,
  totalLocations: 120,
  totalPallets: 128,
}

export const inventoryItems = [
  {
    id: 'PAL-A1-24-1',
    productId: 'PRD-1001',
    sku: 'BRG-1001',
    productName: 'Industrial Bearings',
    category: 'Mechanical Parts',
    quantity: 6500,
    reserved: 400,
    unit: 'pcs',
    reorderThreshold: 500,
    location: 'Aisle A1 · Level 1',
    warehouse: 'WH-001',
    supplier: 'Atlas Industrial Supply',
    status: 'in-stock',
    updatedAt: '2026-10-30T08:30:00',
    movements: [
      { date: '2026-10-30', type: 'Received', quantity: 1200, reference: 'PO-4921' },
      { date: '2026-10-29', type: 'Dispatched', quantity: -320, reference: 'SHP-2401' },
      { date: '2026-10-27', type: 'Adjusted', quantity: 20, reference: 'ADJ-018' },
    ],
  },
  {
    id: 'PAL-A2-18-1',
    productId: 'PRD-1002',
    sku: 'HYD-2004',
    productName: 'Hydraulic Pump Kits',
    category: 'Mechanical Parts',
    quantity: 5130,
    reserved: 900,
    unit: 'kits',
    reorderThreshold: 1000,
    location: 'Aisle A2 · Level 1',
    warehouse: 'WH-001',
    supplier: 'FlowTech Components',
    status: 'in-stock',
    updatedAt: '2026-10-30T07:45:00',
    movements: [
      { date: '2026-10-30', type: 'Received', quantity: 600, reference: 'PO-4928' },
      { date: '2026-10-28', type: 'Dispatched', quantity: -120, reference: 'SHP-2404' },
    ],
  },
  {
    id: 'PAL-B1-24-1',
    productId: 'PRD-1003',
    sku: 'SAF-3010',
    productName: 'Safety Components',
    category: 'Safety Equipment',
    quantity: 240,
    reserved: 40,
    unit: 'pcs',
    reorderThreshold: 300,
    location: 'Aisle B1 · Level 1',
    warehouse: 'WH-001',
    supplier: 'SafeWorks Manufacturing',
    status: 'low-stock',
    updatedAt: '2026-10-30T07:15:00',
    movements: [{ date: '2026-10-29', type: 'Dispatched', quantity: -60, reference: 'SHP-2405' }],
  },
  {
    id: 'PAL-B2-18-1',
    productId: 'PRD-1004',
    sku: 'MTR-4012',
    productName: 'Motor Assemblies',
    category: 'Electrical',
    quantity: 0,
    reserved: 0,
    unit: 'pcs',
    reorderThreshold: 50,
    location: 'Aisle B2 · Level 1',
    warehouse: 'WH-001',
    supplier: 'Northstar Motors',
    status: 'out-of-stock',
    updatedAt: '2026-10-30T06:50:00',
    movements: [{ date: '2026-10-28', type: 'Dispatched', quantity: -25, reference: 'SHP-2403' }],
  },
  {
    id: 'PAL-C1-12-2',
    productId: 'PRD-1005',
    sku: 'VAL-5015',
    productName: 'Precision Valve Sets',
    category: 'Mechanical Parts',
    quantity: 180,
    reserved: 35,
    unit: 'sets',
    reorderThreshold: 250,
    location: 'Aisle C1 · Level 2',
    warehouse: 'WH-001',
    supplier: 'Atlas Industrial Supply',
    status: 'low-stock',
    updatedAt: '2026-10-29T16:40:00',
    movements: [{ date: '2026-10-29', type: 'Adjusted', quantity: -8, reference: 'ADJ-020' }],
  },
  {
    id: 'PAL-C2-08-1',
    productId: 'PRD-1006',
    sku: 'SNS-6018',
    productName: 'Pressure Sensors',
    category: 'Electrical',
    quantity: 120,
    reserved: 20,
    unit: 'pcs',
    reorderThreshold: 200,
    location: 'Aisle C2 · Level 1',
    warehouse: 'WH-001',
    supplier: 'CircuitPath Systems',
    status: 'low-stock',
    updatedAt: '2026-10-29T14:10:00',
    movements: [{ date: '2026-10-28', type: 'Received', quantity: 30, reference: 'PO-4902' }],
  },
  {
    id: 'PAL-D1-16-1',
    productId: 'PRD-1007',
    sku: 'BLT-7022',
    productName: 'Conveyor Belt Modules',
    category: 'Warehouse Equipment',
    quantity: 100,
    reserved: 24,
    unit: 'modules',
    reorderThreshold: 150,
    location: 'Aisle D1 · Level 1',
    warehouse: 'WH-001',
    supplier: 'MotionLine Industries',
    status: 'low-stock',
    updatedAt: '2026-10-29T11:25:00',
    movements: [{ date: '2026-10-27', type: 'Dispatched', quantity: -12, reference: 'SHP-2407' }],
  },
  {
    id: 'PAL-D2-10-1',
    productId: 'PRD-1008',
    sku: 'PPE-8020',
    productName: 'Protective Gear Packs',
    category: 'Safety Equipment',
    quantity: 80,
    reserved: 12,
    unit: 'packs',
    reorderThreshold: 120,
    location: 'Aisle D2 · Level 1',
    warehouse: 'WH-001',
    supplier: 'SafeWorks Manufacturing',
    status: 'low-stock',
    updatedAt: '2026-10-28T17:05:00',
    movements: [{ date: '2026-10-28', type: 'Dispatched', quantity: -18, reference: 'SHP-2408' }],
  },
  {
    id: 'PAL-E1-06-1',
    productId: 'PRD-1009',
    sku: 'FLT-9011',
    productName: 'Filtration Cartridges',
    category: 'Mechanical Parts',
    quantity: 60,
    reserved: 15,
    unit: 'pcs',
    reorderThreshold: 100,
    location: 'Aisle E1 · Level 1',
    warehouse: 'WH-001',
    supplier: 'FlowTech Components',
    status: 'low-stock',
    updatedAt: '2026-10-28T15:50:00',
    movements: [{ date: '2026-10-27', type: 'Adjusted', quantity: -5, reference: 'ADJ-015' }],
  },
  {
    id: 'PAL-E2-04-2',
    productId: 'PRD-1010',
    sku: 'BRK-1014',
    productName: 'Brake Actuator Kits',
    category: 'Mechanical Parts',
    quantity: 40,
    reserved: 9,
    unit: 'kits',
    reorderThreshold: 75,
    location: 'Aisle E2 · Level 2',
    warehouse: 'WH-001',
    supplier: 'Northstar Motors',
    status: 'low-stock',
    updatedAt: '2026-10-28T09:30:00',
    movements: [{ date: '2026-10-26', type: 'Dispatched', quantity: -7, reference: 'SHP-2409' }],
  },
  {
    id: 'PAL-F1-02-1',
    productId: 'PRD-1011',
    sku: 'CTL-1117',
    productName: 'Control Relay Boards',
    category: 'Electrical',
    quantity: 30,
    reserved: 8,
    unit: 'boards',
    reorderThreshold: 60,
    location: 'Aisle F1 · Level 1',
    warehouse: 'WH-001',
    supplier: 'CircuitPath Systems',
    status: 'low-stock',
    updatedAt: '2026-10-27T18:25:00',
    movements: [{ date: '2026-10-27', type: 'Dispatched', quantity: -4, reference: 'SHP-2410' }],
  },
  {
    id: 'PAL-F2-00-1',
    productId: 'PRD-1012',
    sku: 'GSK-1219',
    productName: 'Seal and Gasket Kits',
    category: 'Mechanical Parts',
    quantity: 0,
    reserved: 0,
    unit: 'kits',
    reorderThreshold: 40,
    location: 'Aisle F2 · Level 1',
    warehouse: 'WH-001',
    supplier: 'FlowTech Components',
    status: 'out-of-stock',
    updatedAt: '2026-10-27T12:15:00',
    movements: [{ date: '2026-10-26', type: 'Dispatched', quantity: -10, reference: 'SHP-2411' }],
  },
]

export const shipments = [
  { id: 'SHP-2401', orderId: 'ORD-1201', destination: 'Chennai Distribution Hub', carrier: 'BlueLine Logistics', vehicleId: 'TRK-A01', status: 'delayed', eta: '14:30', dispatchDate: '2026-10-28', expectedDate: '2026-10-30', origin: 'Central Distribution Warehouse', productIds: ['PRD-1001'], quantity: 320, delayReason: 'Weather disruption on southern route', priority: 'critical' },
  { id: 'SHP-2402', orderId: 'ORD-1202', destination: 'Bengaluru Fulfilment Centre', carrier: 'Rapid Freight', vehicleId: 'TRK-B07', status: 'delayed', eta: '16:15', dispatchDate: '2026-10-28', expectedDate: '2026-10-29', origin: 'Central Distribution Warehouse', productIds: ['PRD-1002'], quantity: 120, delayReason: 'Carrier capacity constraints', priority: 'high' },
  { id: 'SHP-2403', orderId: 'ORD-1203', destination: 'Hyderabad Warehouse', carrier: 'BlueLine Logistics', vehicleId: 'TRK-A11', status: 'pending-dispatch', eta: '17:00', dispatchDate: '2026-10-30', expectedDate: '2026-10-31', origin: 'Central Distribution Warehouse', productIds: ['PRD-1004'], quantity: 25, priority: 'normal' },
  { id: 'SHP-2404', orderId: 'ORD-1204', destination: 'Mumbai Service Centre', carrier: 'Rapid Freight', vehicleId: 'TRK-C02', status: 'in-transit', eta: '18:20', dispatchDate: '2026-10-29', expectedDate: '2026-10-31', origin: 'Central Distribution Warehouse', productIds: ['PRD-1002'], quantity: 120, priority: 'normal' },
  { id: 'SHP-2405', orderId: 'ORD-1205', destination: 'Pune Parts Depot', carrier: 'Westway Cargo', vehicleId: 'TRK-D04', status: 'delivered', eta: '09:10', dispatchDate: '2026-10-28', expectedDate: '2026-10-30', actualDate: '2026-10-30', origin: 'Central Distribution Warehouse', productIds: ['PRD-1003'], quantity: 60, priority: 'normal' },
  { id: 'SHP-2406', orderId: 'ORD-1206', destination: 'Kochi Distribution Point', carrier: 'Coastal Express', vehicleId: 'TRK-E09', status: 'in-transit', eta: '20:45', dispatchDate: '2026-10-29', expectedDate: '2026-10-31', origin: 'Central Distribution Warehouse', productIds: ['PRD-1001'], quantity: 480, priority: 'normal' },
  { id: 'SHP-2407', orderId: 'ORD-1207', destination: 'Coimbatore Fulfilment Hub', carrier: 'Westway Cargo', vehicleId: 'TRK-D12', status: 'delayed', eta: '15:40', dispatchDate: '2026-10-29', expectedDate: '2026-10-30', origin: 'Central Distribution Warehouse', productIds: ['PRD-1007'], quantity: 12, delayReason: 'Carrier capacity constraints on route', priority: 'high' },
  { id: 'SHP-2408', orderId: 'ORD-1208', destination: 'Mysuru Service Centre', carrier: 'Rapid Freight', vehicleId: 'TRK-B14', status: 'in-transit', eta: '19:00', dispatchDate: '2026-10-30', expectedDate: '2026-11-01', origin: 'Central Distribution Warehouse', productIds: ['PRD-1008'], quantity: 18, priority: 'normal' },
  { id: 'SHP-2409', orderId: 'ORD-1209', destination: 'Visakhapatnam Parts Depot', carrier: 'BlueLine Logistics', vehicleId: 'TRK-A18', status: 'delivered', eta: '12:00', dispatchDate: '2026-10-27', expectedDate: '2026-10-30', actualDate: '2026-10-29', origin: 'Central Distribution Warehouse', productIds: ['PRD-1010'], quantity: 7, priority: 'normal' },
  { id: 'SHP-2410', orderId: 'ORD-1210', destination: 'Nagpur Warehouse', carrier: 'Northline Freight', vehicleId: 'TRK-F03', status: 'in-transit', eta: '22:10', dispatchDate: '2026-10-30', expectedDate: '2026-11-01', origin: 'Central Distribution Warehouse', productIds: ['PRD-1011'], quantity: 4, priority: 'normal' },
  { id: 'SHP-2411', orderId: 'ORD-1211', destination: 'Delhi Parts Hub', carrier: 'Northline Freight', vehicleId: 'TRK-F08', status: 'delivered', eta: '10:30', dispatchDate: '2026-10-26', expectedDate: '2026-10-29', actualDate: '2026-10-29', origin: 'Central Distribution Warehouse', productIds: ['PRD-1012'], quantity: 10, priority: 'normal' },
  { id: 'SHP-2412', orderId: 'ORD-1212', destination: 'Jaipur Distribution Centre', carrier: 'Westway Cargo', vehicleId: 'TRK-D18', status: 'in-transit', eta: '21:00', dispatchDate: '2026-10-30', expectedDate: '2026-11-01', origin: 'Central Distribution Warehouse', productIds: ['PRD-1005'], quantity: 25, priority: 'normal' },
  { id: 'SHP-2413', orderId: 'ORD-1213', destination: 'Vijayawada Depot', carrier: 'Coastal Express', vehicleId: 'TRK-E15', status: 'pending-dispatch', eta: '18:00', dispatchDate: '2026-10-30', expectedDate: '2026-11-01', origin: 'Central Distribution Warehouse', productIds: ['PRD-1006'], quantity: 20, priority: 'normal' },
  { id: 'SHP-2414', orderId: 'ORD-1214', destination: 'Central Distribution Warehouse', carrier: 'FlowTech Components', vehicleId: 'SUP-FT-04', status: 'in-transit', eta: '23:15', dispatchDate: '2026-10-30', expectedDate: '2026-11-02', origin: 'FlowTech Components', direction: 'inbound', productIds: ['PRD-1003'], quantity: 300, priority: 'high' },
  { id: 'SHP-2415', orderId: 'ORD-1215', destination: 'Surat Fulfilment Centre', carrier: 'Northline Freight', vehicleId: 'TRK-F21', status: 'in-transit', eta: '19:30', dispatchDate: '2026-10-30', expectedDate: '2026-11-02', origin: 'Central Distribution Warehouse', productIds: ['PRD-1001'], quantity: 240, priority: 'normal' },
]

export const warehouseAlerts = [
  { id: 'ALT-001', severity: 'critical', category: 'Inventory', title: 'Safety Components below reorder threshold', description: 'Available stock requires immediate review; an incoming replenishment shipment may be relevant.', relatedId: 'PRD-1003', relatedType: 'inventory', impact: 'Potential production interruption if replenishment is not arranged.', createdAt: '2026-10-30T08:45:00', assignedTo: 'Operations Analyst', status: 'investigating', notes: ['08:45 · Alert generated from stock threshold review.'] },
  { id: 'ALT-002', severity: 'high', category: 'Shipment', title: 'Shipment SHP-2402 delayed', description: 'Carrier capacity constraints have moved the delivery outside its expected window.', relatedId: 'SHP-2402', relatedType: 'shipment', impact: 'Bengaluru replenishment delivery may miss the service window.', createdAt: '2026-10-30T08:10:00', assignedTo: 'Unassigned', status: 'acknowledged', notes: ['08:10 · Alert generated from shipment status.'] },
  { id: 'ALT-003', severity: 'medium', category: 'Operations', title: 'Loading operation awaiting confirmation', description: 'Dock 02 dispatch paperwork has not yet been confirmed.', relatedId: 'SHP-2403', relatedType: 'shipment', impact: 'Dispatch may be delayed if confirmation is not recorded.', createdAt: '2026-10-30T07:35:00', assignedTo: 'Operations Analyst', status: 'open', notes: ['07:35 · Alert generated for pending dock confirmation.'] },
  { id: 'ALT-004', severity: 'low', category: 'Inventory', title: 'Inventory review due', description: 'Two stock locations are due for a routine quantity review.', relatedId: 'PRD-1004', relatedType: 'inventory', impact: 'Count variance may remain undetected until cycle count.', createdAt: '2026-10-30T06:50:00', assignedTo: 'Unassigned', status: 'open', notes: ['06:50 · Routine review reminder generated.'] },
]

export const inventoryMovements = inventoryItems.flatMap((item) =>
  item.movements.map((movement) => ({
    ...movement,
    productId: item.productId,
    productName: item.productName,
  })),
)

export const initialActivity = [
  { id: 'ACT-001', timestamp: '2026-10-30T08:45:00', type: 'Alert generated', description: 'Industrial Bearings stock threshold needs review.', recordId: 'ALT-001' },
  { id: 'ACT-002', timestamp: '2026-10-30T08:10:00', type: 'Shipment delayed', description: 'SHP-2402 delay recorded from carrier capacity constraints.', recordId: 'SHP-2402' },
  { id: 'ACT-003', timestamp: '2026-10-30T07:35:00', type: 'Dispatch pending', description: 'SHP-2403 is waiting for loading confirmation.', recordId: 'SHP-2403' },
]

export const customerRecords = []


// Backend hydration: these workspace data collections are now populated from Spring Boot
// before importing pages consume this module (ES module top-level await).
import { fetchWorkspaceData } from '../api/client.js';
import { impactAnalysis } from '../api/disruptioniq.js';

export const backendDataState = { connected: false, impacts: [], error: null };

function unwrapRows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}
function firstDefined(record, ...keys) {
  for (const key of keys) if (record?.[key] !== undefined && record[key] !== null) return record[key];
  return undefined;
}
function statusKey(value) {
  return String(value || 'UNKNOWN').toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
}
function mapBackendShipment(row, index, impact, warehouseLookup, supplierLookup) {
  const id = firstDefined(row, 'id', 'shipmentId') || `SHIPMENT-${index + 1}`;
  const expectedDate = firstDefined(row, 'expectedDelivery', 'expectedDate') || '';
  const affectedOrders = Array.isArray(impact?.affectedOrders) ? impact.affectedOrders : [];
  const primaryOrder = affectedOrders[0] || {};
  const productId = impact?.productId || firstDefined(row, 'productId');
  return {
    ...row,
    id,
    shipmentId: id,
    orderId: primaryOrder.orderId || firstDefined(row, 'orderId', 'order_id') || '—',
    orderIds: affectedOrders.map(order => order.orderId).filter(Boolean),
    destination: impact?.warehouseName
      || warehouseLookup.get(impact?.warehouseId)?.name
      || firstDefined(row, 'destination', 'warehouseName', 'warehouseId')
      || 'Not specified',
    carrier: impact?.supplierName
      || supplierLookup.get(impact?.supplierId)?.name
      || firstDefined(row, 'carrier', 'supplierName', 'supplierId')
      || 'Not specified',
    vehicleId: firstDefined(row, 'vehicleId', 'truckId') || '—',
    status: statusKey(row.status),
    eta: expectedDate || '—',
    dispatchDate: firstDefined(row, 'dispatchDate', 'createdAt') || '',
    expectedDate,
    origin: impact?.supplierName
      || supplierLookup.get(impact?.supplierId)?.name
      || 'Not specified',
    productIds: productId ? [productId] : [],
    productId: productId || '—',
    supplierId: impact?.supplierId || '—',
    supplier: impact?.supplierName || 'Not specified',
    warehouseId: impact?.warehouseId || '—',
    quantity: Number(row.quantity || impact?.shipmentQuantity || 0),
    priority: statusKey(primaryOrder.priority || row.priority || 'normal'),
    customers: affectedOrders.map(order => order.customerName).filter(Boolean),
  };
}
function mapBackendInventory(row, index, products, warehouses) {
  const productId = firstDefined(row, 'productId') || '—';
  const product = products.find(item => firstDefined(item, 'id', 'productId') === productId) || {};
  const warehouseId = firstDefined(row, 'warehouseId') || '—';
  const warehouse = warehouses.find(item => firstDefined(item, 'id', 'warehouseId') === warehouseId) || {};
  const quantity = Number(firstDefined(row, 'onHand', 'quantity') || 0);
  const reserved = Number(row.reserved || 0);
  const threshold = Number(firstDefined(row, 'reorderPoint', 'reorderThreshold') || 0);
  const available = Math.max(0, quantity - reserved);
  return {
    ...row,
    id: firstDefined(row, 'id', 'inventoryId') || `INVENTORY-${index + 1}`,
    productId,
    sku: productId,
    productName: firstDefined(product, 'name', 'productName') || productId,
    category: product.category || 'Uncategorised',
    quantity,
    reserved,
    available,
    unit: 'units',
    reorderThreshold: threshold,
    location: warehouse.location || 'Location not specified',
    warehouse: warehouseId,
    supplier: 'Not specified',
    status: available <= 0 ? 'out-of-stock' : available <= threshold ? 'low-stock' : 'in-stock',
    updatedAt: firstDefined(row, 'updatedAt', 'createdAt') || '',
    movements: [],
  };
}
function mapImpactInventory(impact, productLookup, warehouseLookup) {
  const product = productLookup.get(impact.productId) || {};
  const warehouse = warehouseLookup.get(impact.warehouseId) || {};
  const quantity = Number(impact.onHand || 0);
  const reserved = Number(impact.reserved || 0);
  const threshold = Number(impact.reorderPoint || 0);
  const available = Number(impact.available ?? Math.max(0, quantity - reserved));
  return {
    id: impact.inventoryId || `INVENTORY-${impact.shipmentId}`,
    inventoryId: impact.inventoryId || `INVENTORY-${impact.shipmentId}`,
    productId: impact.productId || '—',
    sku: impact.productId || '—',
    productName: impact.productName || product?.name || impact.productId || 'Unknown product',
    category: product.category || 'Uncategorised',
    quantity,
    onHand: quantity,
    reserved,
    available,
    unit: 'units',
    reorderThreshold: threshold,
    reorderPoint: threshold,
    dailyDemand: Number(impact.dailyDemand || 0),
    location: warehouse.location || 'Location not specified',
    warehouse: impact.warehouseId || '—',
    warehouseId: impact.warehouseId || '—',
    warehouseName: impact.warehouseName || warehouse.name || 'Warehouse',
    supplier: impact.supplierName || 'Not specified',
    supplierId: impact.supplierId || '—',
    status: available <= 0 ? 'out-of-stock' : available <= threshold ? 'low-stock' : 'in-stock',
    shipmentId: impact.shipmentId,
    updatedAt: '',
    movements: [],
  };
}
try {
  const result = await fetchWorkspaceData();
  const rows = key => unwrapRows(result[key]?.data);
  const shipmentRows = rows('shipments');
  const inventoryRows = rows('inventory');
  const productRows = rows('products');
  const warehouseRows = rows('warehouses');
  const supplierRows = rows('suppliers');
  const customerRows = rows('customers');
  const productLookup = new Map(productRows.map(item => [firstDefined(item, 'id', 'productId'), item]));
  const warehouseLookup = new Map(warehouseRows.map(item => [firstDefined(item, 'id', 'warehouseId'), item]));
  const supplierLookup = new Map(supplierRows.map(item => [firstDefined(item, 'id', 'supplierId'), item]));

  // The impact endpoint is the only backend view that resolves the full
  // Supplier → Shipment → Warehouse → Inventory → Product → Order chain.
  const impactResults = await Promise.allSettled(
    shipmentRows.map(row => impactAnalysis(firstDefined(row, 'id', 'shipmentId'))),
  );
  const impacts = impactResults
    .filter(item => item.status === 'fulfilled' && item.value)
    .map(item => item.value);
  backendDataState.impacts = impacts;
  backendDataState.connected = Boolean(
    result.shipments?.data !== null
    || result.inventory?.data !== null
    || result.products?.data !== null
    || result.warehouses?.data !== null,
  );
  const impactByShipment = new Map(impacts.map(impact => [impact.shipmentId, impact]));

  // Only replace demo data when the corresponding live endpoint actually returned records.
  if (result.shipments?.data !== null) {
    shipments.splice(0, shipments.length, ...shipmentRows.map((row, i) => mapBackendShipment(
      row, i, impactByShipment.get(firstDefined(row, 'id', 'shipmentId')), warehouseLookup, supplierLookup,
    )));
  }
  if (result.inventory?.data !== null) {
    const enriched = [];
    const seen = new Set();
    for (const impact of impacts) {
      const item = mapImpactInventory(impact, productLookup, warehouseLookup);
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      enriched.push(item);
    }
    for (const [index, row] of inventoryRows.entries()) {
      const id = firstDefined(row, 'id', 'inventoryId') || `INVENTORY-${index + 1}`;
      if (seen.has(id)) continue;
      seen.add(id);
      enriched.push(mapBackendInventory(row, index, productRows, warehouseRows));
    }
    inventoryItems.splice(0, inventoryItems.length, ...enriched);
  }
  if (warehouseRows.length) {
    const primary = warehouseRows[0];
    const occupied = new Set(inventoryItems.map(item => item.warehouse).filter(Boolean)).size;
    warehouseSummary.warehouseName = primary.name || primary.location || 'Warehouse network';
    warehouseSummary.warehouseId = primary.id || primary.warehouseId || '—';
    warehouseSummary.totalPallets = inventoryItems.length;
    warehouseSummary.occupiedLocations = occupied || inventoryItems.length;
    warehouseSummary.totalLocations = Number(primary.capacity || Math.max(inventoryItems.length, 1));
  }
  const derivedAlerts = [
    ...shipments.filter(item => ['delayed', 'disrupted', 'cancelled', 'failed'].includes(item.status)).map(item => ({
      id: `SHIP-${item.id}`, severity: item.status === 'failed' ? 'critical' : item.priority === 'critical' ? 'critical' : 'high',
      category: 'Shipment', title: `Shipment ${item.id} ${item.status}`,
      description: `Backend shipment status is ${item.status}${item.expectedDate ? `; expected delivery ${item.expectedDate}` : ''}.`,
      relatedId: item.id, relatedType: 'shipment',
      impact: item.destination && item.destination !== 'Not specified'
        ? `Downstream delivery to ${item.destination} is exposed.`
        : 'Review downstream order and inventory impact.',
      createdAt: item.expectedDate || new Date().toISOString(), assignedTo: 'Unassigned', status: 'open', notes: [],
    })),
    ...inventoryItems.filter(item => item.status !== 'in-stock').map(item => ({
      id: `INV-${item.id}`, severity: item.status === 'out-of-stock' ? 'critical' : 'medium',
      category: 'Inventory', title: `${item.productName} requires stock review`,
      description: `Available stock ${item.available}; reorder threshold ${item.reorderThreshold}.`,
      relatedId: item.productId, relatedType: 'inventory',
      impact: 'Review replenishment and affected orders.',
      createdAt: item.updatedAt || new Date().toISOString(), assignedTo: 'Unassigned', status: 'open', notes: [],
    })),
  ];
  if (result.shipments?.data !== null || result.inventory?.data !== null) {
    warehouseAlerts.splice(0, warehouseAlerts.length, ...derivedAlerts);
  }
  if (result.customers?.data !== null) {
    customerRecords.splice(0, customerRecords.length, ...customerRows.map((row, index) => ({
      customerId: firstDefined(row, 'id', 'customerId') || `CUSTOMER-${index + 1}`,
      id: firstDefined(row, 'id', 'customerId') || `CUSTOMER-${index + 1}`,
      name: firstDefined(row, 'name', 'customerName') || 'Unnamed customer',
      email: row.email || '',
      phone: row.phone || '',
      region: row.region || '',
      status: statusKey(row.status || 'active'),
      orderIds: Array.isArray(row.orderIds) ? row.orderIds : [],
    })));
  }
} catch (error) {
  backendDataState.error = error.message;
  console.error('[DisruptionIQ] Backend data hydration failed:', error);
}
