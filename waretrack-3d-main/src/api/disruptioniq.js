import { get, post, patch } from './client.js';

const enc = encodeURIComponent;

// ---------------------------------------------------------------------------
// List payload normalisation
// ---------------------------------------------------------------------------
export function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export const dashboardSummary = (activityLimit = 10) =>
  get(`/api/dashboard/summary?activityLimit=${enc(activityLimit)}`);
export const recoveryActivity = (limit = 10) =>
  get(`/api/dashboard/recovery-activity?limit=${enc(limit)}`);

// ---------------------------------------------------------------------------
// Master data (read-only)
// ---------------------------------------------------------------------------
export const shipments = () => get('/api/shipments');
export const shipment = id => get(`/api/shipments/${enc(id)}`);
export const suppliers = () => get('/api/suppliers');
export const supplier = id => get(`/api/suppliers/${enc(id)}`);
export const warehouses = () => get('/api/warehouses');
export const warehouse = id => get(`/api/warehouses/${enc(id)}`);
export const inventory = () => get('/api/inventory');
export const inventoryItem = id => get(`/api/inventory/${enc(id)}`);
export const products = () => get('/api/products');
export const product = id => get(`/api/products/${enc(id)}`);
export const orders = () => get('/api/orders');
export const order = id => get(`/api/orders/${enc(id)}`);
export const customers = () => get('/api/customers');
export const customer = id => get(`/api/customers/${enc(id)}`);

// ---------------------------------------------------------------------------
// Impact + risk analysis
// ---------------------------------------------------------------------------
export const impactAnalysis = shipmentId => get(`/api/impact/shipments/${enc(shipmentId)}`);
export const riskAssessment = shipmentId => get(`/api/risk/shipments/${enc(shipmentId)}`);

// ---------------------------------------------------------------------------
// Simulation + feasibility
// ---------------------------------------------------------------------------
export const simulateRecovery = payload => post('/api/simulation', payload);
export const recoveryFeasibility = payload => post('/api/recovery/feasibility', payload);

// ---------------------------------------------------------------------------
// Recovery plans
// ---------------------------------------------------------------------------
export const listRecoveryPlans = () => get('/api/recovery-plans');
export const getRecoveryPlan = id => get(`/api/recovery-plans/${enc(id)}`);
export const recoveryPlansByShipment = shipmentId =>
  get(`/api/recovery-plans/shipment/${enc(shipmentId)}`);
export const pendingRecoveryPlans = () => get('/api/recovery-plans/pending');
export const createRecoveryPlan = payload => post('/api/recovery-plans', payload);
export const approveRecoveryPlan = (id, reason) =>
  post(`/api/recovery-plans/${enc(id)}/approve`, { reason });
export const rejectRecoveryPlan = (id, reason) =>
  post(`/api/recovery-plans/${enc(id)}/reject`, { reason });
export const executeRecoveryPlan = id => post(`/api/recovery-plans/${enc(id)}/execute`);
export const recoveryPlanAudit = id => get(`/api/recovery-plans/${enc(id)}/audit`);

// ---------------------------------------------------------------------------
// Recovery progress
// ---------------------------------------------------------------------------
export const updateRecoveryProgress = (planId, payload) =>
  post(`/api/recovery-progress/${enc(planId)}`, payload);
export const recoveryProgressByPlan = planId =>
  get(`/api/recovery-progress/plan/${enc(planId)}`);
export const recoveryProgressByShipment = shipmentId =>
  get(`/api/recovery-progress/shipment/${enc(shipmentId)}`);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notifications = ({ unreadOnly = false, offset = 0, limit = 50 } = {}) =>
  get(`/api/notifications?unreadOnly=${unreadOnly}&offset=${enc(offset)}&limit=${enc(limit)}`);
export const notificationSummary = () => get('/api/notifications/summary');
export const markNotificationRead = id =>
  patch(`/api/notifications/${enc(id)}/read`);

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
export const auditEntity = (type, id, { offset = 0, limit = 100 } = {}) =>
  get(`/api/audit/entities/${enc(type)}/${enc(id)}?offset=${enc(offset)}&limit=${enc(limit)}`);
export const auditShipment = (id, { offset = 0, limit = 100 } = {}) =>
  get(`/api/audit/shipments/${enc(id)}?offset=${enc(offset)}&limit=${enc(limit)}`);
export const auditRecoveryPlan = (id, { offset = 0, limit = 100 } = {}) =>
  get(`/api/audit/recovery-plans/${enc(id)}?offset=${enc(offset)}&limit=${enc(limit)}`);
export const auditMyActivity = ({ offset = 0, limit = 100 } = {}) =>
  get(`/api/audit/users/me?offset=${enc(offset)}&limit=${enc(limit)}`);

// ---------------------------------------------------------------------------
// AI service (backend proxy)
// ---------------------------------------------------------------------------
export const disruptionSummary = (shipmentId, payload) =>
  post(`/api/ai/shipments/${enc(shipmentId)}/disruption-summary`, payload);
export const riskExplanations = shipmentId =>
  get(`/api/ai/shipments/${enc(shipmentId)}/risk-explanations`);
export const recoveryRecommendation = payload =>
  post('/api/ai/recovery-recommendation', payload);
export const aiHealth = () => get('/api/ai/health');

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
export const IMPORT_ENTITY_TYPES = [
  'suppliers',
  'shipments',
  'warehouses',
  'inventory',
  'products',
  'customers',
  'orders',
];

export function importSupplyChainFile(entityType, file) {
  const form = new FormData();
  form.append('file', file);
  return post(`/api/import/${enc(entityType)}`, form);
}

// ---------------------------------------------------------------------------
// Display helpers shared by workspaces
// ---------------------------------------------------------------------------
export const STRATEGY_LABELS = {
  DO_NOTHING: 'Continue current operation',
  REALLOCATE_STOCK: 'Reallocate inventory between warehouses',
  EXPEDITE_SHIPMENT: 'Expedite or reroute shipment',
  ALTERNATIVE_SUPPLIER: 'Request alternative supplier replenishment',
  SPLIT_ORDER: 'Split order fulfilment',
};

export function strategyLabel(strategy) {
  return STRATEGY_LABELS[strategy] || String(strategy || 'Unknown strategy').replaceAll('_', ' ');
}

export function strategyFromLabel(label) {
  const value = String(label || '').trim().toLowerCase();
  return Object.entries(STRATEGY_LABELS)
    .find(([, name]) => name.toLowerCase() === value)?.[0]
    || Object.keys(STRATEGY_LABELS)
      .find(key => key.toLowerCase() === value.replaceAll(' ', '_'))
    || null;
}

export const PLAN_STATUS = {
  PENDING_APPROVAL: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXECUTED: 'executed',
};

export function planStatusKey(status) {
  return PLAN_STATUS[String(status || '').toUpperCase()]
    || String(status || 'unknown').toLowerCase().replaceAll('_', '-');
}

export const EXECUTION_STATUS = {
  NOT_STARTED: 'not-started',
  EXECUTING: 'in-progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
};
