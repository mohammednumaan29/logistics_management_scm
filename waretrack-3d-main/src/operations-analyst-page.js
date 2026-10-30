import { requireRole } from './api/client.js';
await requireRole('OPERATIONS_ANALYST');
import './workspaces/operations-analyst.css'
import './workspaces/operations-analyst-theme.css'
import './workspaces/dashboard-consistency.css'

import {
  backendDataState,
  customerRecords,
  initialActivity,
  inventoryItems,
  shipments,
  warehouseAlerts,
  warehouseSummary,
} from './workspaces/operations-analyst-data.js'
import { createRecoveryPlan, getCurrentActor, getNotifications, getWorkflowState, markWorkflowNotificationRead } from './workspaces/recovery-workflow.js'
import {
  asList,
  auditMyActivity,
  customers as customersApi,
  disruptionSummary,
  impactAnalysis,
  importSupplyChainFile,
  recoveryFeasibility,
  recoveryProgressByPlan,
  recoveryRecommendation,
  riskAssessment,
  riskExplanations,
  simulateRecovery,
  suppliers as suppliersApi,
} from './api/disruptioniq.js'
import { buildImpactGraph } from './ui/impactGraph.js'
import {
  assessShipments,
  buildRiskExplanation,
  inventoryImpacts,
  shipmentDelayDays,
  simulateRecoveryOptions,
  summarizeDisruption,
} from './workspaces/operations-analyst-insights.js'

const STORAGE_KEY = 'disruptioniq.operations-analyst.v2'
const SETTINGS_KEY = 'disruptioniq.operations-analyst.settings.v1'
const SIMULATION_STORAGE_KEY = 'disruptioniq.operations-analyst.simulations.v1'
const WORKFLOW_STORAGE_KEY = 'disruptioniq.shared.recovery-workflow.v1'
const WORKFLOW_READS_KEY = 'disruptioniq.operations-analyst.workflow-reads.v1'
const clone = (value) => JSON.parse(JSON.stringify(value))
const persisted = localStorage.getItem(STORAGE_KEY)
const savedState = persisted ? JSON.parse(persisted) : null
const backendHydrated = backendDataState.connected
const state = {
  inventory: backendHydrated ? clone(inventoryItems) : savedState?.inventory || clone(inventoryItems),
  shipments: backendHydrated ? clone(shipments) : savedState?.shipments || clone(shipments),
  alerts: backendHydrated ? clone(warehouseAlerts) : savedState?.alerts || clone(warehouseAlerts),
  customers: backendHydrated ? clone(customerRecords) : Array.isArray(savedState?.customers) ? savedState.customers : [],
  activities: backendHydrated ? [] : savedState?.activities || clone(initialActivity),
  notifications: backendHydrated ? [] : savedState?.notifications || warehouseAlerts.map((alert) => ({
    id: `NOT-${alert.id}`,
    alertId: alert.id,
    relatedType: 'alert',
    relatedId: alert.id,
    title: alert.title,
    description: alert.description,
    createdAt: alert.createdAt,
    read: false,
  })),
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function setText(target, value) {
  const element = typeof target === 'string' ? document.getElementById(target) : target
  if (element) element.textContent = String(value)
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value)
}

function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, options).format(date)
}

function formatDateTime(value) {
  return formatDate(value, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function titleCase(value) {
  return String(value || 'Unknown')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function stockStatus(product) {
  if (product.quantity <= 0) return 'out-of-stock'
  if (product.quantity <= product.reorderThreshold) return 'low-stock'
  return 'in-stock'
}

function availableStock(product) {
  return Math.max(0, product.quantity - product.reserved)
}

function availableStockByUnit(products) {
  const totals = new Map()
  products.forEach((product) => totals.set(product.unit, (totals.get(product.unit) || 0) + availableStock(product)))
  return [...totals.entries()].map(([unit, quantity]) => `${formatNumber(quantity)} ${unit}`).join(' · ') || '—'
}

function recordActivity(type, description, recordId) {
  state.activities.unshift({
    id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    description,
    recordId,
  })
}

function activeAlerts() {
  return state.alerts.filter((alert) => alert.status !== 'resolved')
}

const backendRiskState = { byShipment: new Map(), loaded: false, loading: false }

async function hydrateBackendRisk() {
  if (!backendHydrated || backendRiskState.loaded || backendRiskState.loading) return
  backendRiskState.loading = true
  const shipmentIds = state.shipments.map((shipment) => shipment.id)
  const results = await Promise.allSettled(shipmentIds.map((id) => riskAssessment(id)))
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      backendRiskState.byShipment.set(shipmentIds[index], result.value)
    }
  })
  backendRiskState.loaded = true
  backendRiskState.loading = false
  refresh()
}

function shipmentAssessments() {
  return assessShipments(state.shipments, state.inventory, state.alerts).map((assessment) => {
    const backend = backendRiskState.byShipment.get(assessment.id)
    const orders = Array.isArray(backend?.orders) ? backend.orders : []
    if (!orders.length) return assessment
    const ranked = ['HIGH', 'MEDIUM', 'LOW']
    const topLevel = orders
      .map((order) => String(order.riskLevel || '').toUpperCase())
      .sort((left, right) => ranked.indexOf(left) - ranked.indexOf(right))[0]
    const factors = orders.flatMap((order) =>
      (order.factors || []).map((factor) => `${order.orderId} · ${factor.name} (+${factor.points}): ${factor.explanation}`),
    )
    return {
      ...assessment,
      riskScore: Math.max(...orders.map((order) => Number(order.riskScore) || 0)),
      riskLevel: (topLevel || assessment.riskLevel).toLowerCase(),
      factors: factors.length ? factors : assessment.factors,
      backendRisk: backend,
      backendOrders: orders,
    }
  })
}

function currentInventoryImpacts() {
  return inventoryImpacts(state.shipments, state.inventory)
}

function disruptionAssessments() {
  const assessments = shipmentAssessments()
  const impacts = currentInventoryImpacts()
  return state.alerts.map((alert) => summarizeDisruption(alert, assessments, impacts))
}

function analystPlans() {
  const actor = getCurrentActor()
  return getWorkflowState().plans.filter((plan) => plan.createdByUserId === actor.id)
}

function savedSimulations() {
  const saved = localStorage.getItem(SIMULATION_STORAGE_KEY)
  const parsed = saved ? JSON.parse(saved) : []
  return Array.isArray(parsed) ? parsed : []
}

function workflowNotifications() {
  const snapshot = getWorkflowState()
  const actor = getCurrentActor()
  const savedReads = localStorage.getItem(WORKFLOW_READS_KEY)
  const readIds = new Set(savedReads ? JSON.parse(savedReads) : [])
  const planById = new Map(snapshot.plans
    .filter((plan) => plan.createdByUserId === actor.id)
    .map((plan) => [plan.id, plan]))
  const notifications = snapshot.audit
    .filter((entry) => planById.has(entry.planId) && entry.userId !== actor.id)
    .map((entry) => ({
      id: `workflow-${entry.id}`,
      planId: entry.planId,
      title: entry.action,
      description: entry.previousStatus || entry.newStatus
        ? `${entry.user} (${entry.role || 'Backend'}): ${entry.previousStatus} → ${entry.newStatus}${entry.comments ? ` · ${entry.comments}` : ''}`
        : `${entry.user}${entry.comments ? ` · ${entry.comments}` : ''}`,
      createdAt: entry.timestamp,
      read: readIds.has(`workflow-${entry.id}`),
    }))
  const today = new Date().toISOString().slice(0, 10)
  const addStateNotification = (id, plan, title, description, createdAt = plan.createdAt) => {
    const notificationId = `workflow-state-${id}`
    notifications.push({
      id: notificationId,
      planId: plan.id,
      title,
      description,
      createdAt,
      read: readIds.has(notificationId),
    })
  }
  for (const plan of planById.values()) {
    if (plan.approval_status === 'approved' && plan.execution_authorisation_status === 'not_authorized') {
      addStateNotification(`${plan.id}-authorization`, plan, 'Execution authorization pending', `${plan.id} is approved but has no execution authorization.`)
    }
    if (plan.approval_status === 'approved') {
      for (const approval of plan.requiredApprovals || []) {
        if (approval.status !== 'approved') {
          addStateNotification(`${plan.id}-${approval.id}`, plan, 'Additional approval pending', `${plan.id} · ${approval.label} · ${approval.role}.`)
        }
      }
    }
    for (const task of plan.tasks || []) {
      if (task.status === 'blocked') {
        addStateNotification(`${plan.id}-${task.id}-blocked`, plan, 'Recovery task blocked', `${plan.id} · ${task.title}`, task.updatedAt || plan.createdAt)
      } else if (task.status === 'pending' && task.dueAt && task.dueAt < today) {
        addStateNotification(`${plan.id}-${task.id}-delayed`, plan, 'Recovery task delayed', `${plan.id} · ${task.title} was due ${formatDate(task.dueAt)}.`, task.dueAt)
      }
    }
    if (['successful', 'failed'].includes(plan.execution_status)) {
      addStateNotification(`${plan.id}-${plan.execution_status}`, plan, `Recovery ${plan.execution_status}`, `${plan.id} · ${plan.actual?.outcome || 'Execution outcome recorded.'}`, plan.actual?.completedAt || plan.createdAt)
    }
  }
  return notifications
}

const aiState = { available: null, message: '', explanations: new Map(), pending: new Set() }

function hydrateAiAvailability() {
  aiState.available = null
  aiState.message = 'AI availability is reported with each backend risk explanation.'
  renderAIInsights()
}

function hydrateAiExplanations(assessments) {
  if (!backendHydrated) return
  for (const assessment of assessments.slice(0, 6)) {
    if (aiState.explanations.has(assessment.id) || aiState.pending.has(assessment.id)) continue
    aiState.pending.add(assessment.id)
    riskExplanations(assessment.id)
      .then((payload) => {
        const explanations = asList(payload)
        aiState.explanations.set(assessment.id, explanations)
        if (explanations.length) {
          aiState.available = explanations.some((item) => item.aiAvailable)
          aiState.message = ''
        }
        renderAIInsights()
      })
      .catch(() => aiState.explanations.set(assessment.id, []))
      .finally(() => aiState.pending.delete(assessment.id))
  }
}

const backendSimulationState = { byDisruption: new Map(), pending: new Set() }

async function ensureImpact(shipmentId) {
  const cached = backendDataState.impacts.find((impact) => impact.shipmentId === shipmentId)
  if (cached) return cached
  const impact = await impactAnalysis(shipmentId)
  backendDataState.impacts.push(impact)
  return impact
}

async function hydrateSimulation(disruptionId) {
  if (!backendHydrated || !disruptionId) return
  if (backendSimulationState.byDisruption.has(disruptionId) || backendSimulationState.pending.has(disruptionId)) return
  const assessment = selectedDisruptionSummary(disruptionId)
  const shipment = assessment && [...assessment.shipments].sort((left, right) => right.riskScore - left.riskScore)[0]
  if (!shipment) return
  backendSimulationState.pending.add(disruptionId)
  try {
    const impact = await ensureImpact(shipment.id)
    const localScenarios = simulateRecoveryOptions(assessment, currentInventoryImpacts())
    const shortageUnits = Math.max(1, (shipment.shortageProducts || [])
      .reduce((sum, product) => sum + Math.max(0, shipment.quantity - product.available), 0))
    const source = state.inventory.find((item) =>
      item.productId === impact.productId && (item.warehouseId || item.warehouse) !== impact.warehouseId && availableStock(item) > 0)
    const reallocationQuantity = Math.max(1, Math.min(
      shortageUnits,
      source ? Math.max(1, availableStock(source) - Number(source.reorderThreshold || 0)) : 1,
    ))
    let alternativeSupplierId = ''
    try {
      const suppliers = asList(await suppliersApi())
        .filter((item) => String(item.status || '').toUpperCase() === 'ACTIVE' && item.id !== impact.supplierId)
        .sort((left, right) => Number(left.leadTimeDays || 0) - Number(right.leadTimeDays || 0))
      alternativeSupplierId = suppliers[0]?.id || ''
    } catch {
      alternativeSupplierId = ''
    }
    const base = {
      shipmentId: shipment.id,
      delayDays: Math.max(2, Math.round(Number(shipment.delayDays) || 0)),
      expeditedArrivalDays: 1,
      expediteCost: 0,
      sourceWarehouseId: source?.warehouseId || source?.warehouse || '',
      reallocationQuantity,
      alternativeSupplierId,
      splitQuantity: 1,
    }
    const carrier = localScenarios.find((scenario) => scenario.id === 'alternate-carrier')
    const requests = [
      { localId: 'alternate-carrier', strategy: 'EXPEDITE_SHIPMENT', payload: { ...base, expediteCost: Math.max(0, Number(carrier?.estimatedCost || 0)) } },
      { localId: 'inventory-transfer', strategy: 'REALLOCATE_STOCK', payload: base },
      { localId: 'alternative-supplier', strategy: 'ALTERNATIVE_SUPPLIER', payload: base },
    ]
    const results = await Promise.allSettled(requests.map((request) =>
      simulateRecovery({ ...request.payload, strategy: request.strategy })))
    const entry = { requests: new Map(), responses: new Map(), recommendation: null, error: null }
    results.forEach((result, index) => {
      entry.requests.set(requests[index].localId, { ...requests[index].payload, strategy: requests[index].strategy })
      if (result.status === 'fulfilled') entry.responses.set(requests[index].localId, result.value)
    })
    const localById = new Map(localScenarios.map((scenario) => [scenario.id, scenario]))
    const options = [...entry.responses.entries()].map(([localId, response]) => ({
      name: localById.get(localId)?.strategy || response.strategy,
      cost: Math.max(0, Number(localById.get(localId)?.estimatedCost || response.estimatedCost || 0)),
      ordersSaved: Math.max(0, Number(response.ordersSaved || 0)),
      recoveryDays: Math.max(0, Number(response.estimatedRecoveryDays ?? localById.get(localId)?.recoveryDays ?? 0)),
    }))
    if (options.length) {
      try {
        entry.recommendation = await recoveryRecommendation({ options })
      } catch {
        entry.recommendation = null
      }
    }
    backendSimulationState.byDisruption.set(disruptionId, entry)
  } catch (error) {
    backendSimulationState.byDisruption.set(disruptionId, {
      requests: new Map(),
      responses: new Map(),
      recommendation: null,
      error: error.message,
    })
  } finally {
    backendSimulationState.pending.delete(disruptionId)
    renderSimulation()
  }
}

function currentScenarios(disruptionId) {
  const assessment = selectedDisruptionSummary(disruptionId)
  if (!assessment) return []
  const backend = backendSimulationState.byDisruption.get(disruptionId)
  return simulateRecoveryOptions(assessment, currentInventoryImpacts()).map((scenario) => {
    const response = backend?.responses instanceof Map ? backend.responses.get(scenario.id) : null
    const request = backend?.requests instanceof Map ? backend.requests.get(scenario.id) : null
    if (!response) return { ...scenario, backend: backend?.error ? { error: backend.error } : null, request }
    return {
      ...scenario,
      feasible: String(response.feasibility || '').toUpperCase() !== 'INFEASIBLE',
      backend: response,
      request,
      estimatedCost: Number(response.estimatedCost) > 0 ? Number(response.estimatedCost) : scenario.estimatedCost,
      recoveryDays: Number(response.estimatedRecoveryDays ?? scenario.recoveryDays),
    }
  })
}

const progressState = new Map()
const progressPending = new Set()

function hydrateProgressForPlan(plan) {
  if (!backendHydrated || progressState.has(plan.id) || progressPending.has(plan.id)) return
  progressPending.add(plan.id)
  recoveryProgressByPlan(plan.id)
    .then((payload) => progressState.set(plan.id, asList(payload)))
    .catch(() => progressState.set(plan.id, []))
    .finally(() => {
      progressPending.delete(plan.id)
      renderRecoveryTracking()
    })
}

const backendActivityState = { rows: [], loaded: false, loading: false }

async function hydrateActivity() {
  if (!backendHydrated || backendActivityState.loaded || backendActivityState.loading) return
  backendActivityState.loading = true
  try {
    const payload = await auditMyActivity({ limit: 50 })
    backendActivityState.rows = asList(payload).map((entry) => ({
      timestamp: entry.timestamp,
      type: titleCase(String(entry.action || 'Audit event').replaceAll('_', ' ')),
      description: entry.reason || `${entry.entityType || 'Record'} ${entry.entityId || ''}`.trim(),
      recordId: entry.entityId || entry.id,
    }))
    backendActivityState.loaded = true
  } catch {
    backendActivityState.loaded = true
    backendActivityState.rows = []
  } finally {
    backendActivityState.loading = false
    renderActivity()
  }
}

const monitoringSearchState = { query: '' }
const customerFilters = { query: '', status: 'all', region: 'all' }
const recoveryPlanFilters = { query: '', approval: 'all', execution: 'all' }
const productDirectoryFilters = { query: '', status: 'all' }
const supplierDirectoryFilters = { query: '' }
const warehouseDirectoryFilters = { query: '' }
const orderDirectoryFilters = { query: '', status: 'all' }
let pendingCustomerImport = []
let pendingCustomerImportErrors = []

function delayedShipments() {
  return state.shipments.filter((shipment) => shipment.status === 'delayed')
}

function pendingActions() {
  return activeAlerts().length + state.shipments.filter(
    (shipment) => shipment.status === 'pending-dispatch',
  ).length
}

function updateOverview() {
  const totalUnits = state.inventory.reduce((sum, product) => sum + product.quantity, 0)
  const statuses = state.inventory.reduce((counts, product) => {
    const status = stockStatus(product)
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {})
  const occupancy = warehouseSummary.occupiedLocations / warehouseSummary.totalLocations * 100
  const activeShipmentCount = state.shipments.filter(
    (shipment) => !['delivered', 'failed'].includes(shipment.status),
  ).length
  const openAlerts = activeAlerts()
  const unreadNotifications = state.notifications.filter((notification) => !notification.read).length +
    workflowNotifications().filter((notification) => !notification.read).length
  const delayedCount = delayedShipments().length
  const plans = analystPlans()
  const activeDisruptions = activeAlerts()
  const atRiskOrders = shipmentAssessments().filter((shipment) =>
    ['delayed', 'failed'].includes(shipment.status) || shipment.riskScore >= 45,
  )
  const highRiskOrders = atRiskOrders.filter((shipment) => shipment.riskLevel === 'high')
  const pendingPlans = plans.filter((plan) => plan.approval_status === 'pending')
  const recoveryInProgress = plans.filter((plan) => plan.execution_status === 'in_progress')
  const resolvedDisruptions = state.alerts.filter((alert) => alert.status === 'resolved')
  const kpis = [
    ['Active disruptions', activeDisruptions.length, 'alerts'],
    ['Affected shipments', new Set(atRiskOrders.map((shipment) => shipment.id)).size, 'shipments'],
    ['At-risk orders', new Set(atRiskOrders.map((shipment) => shipment.orderId)).size, 'order-impact'],
    ['High-risk orders', new Set(highRiskOrders.map((shipment) => shipment.orderId)).size, 'shipment-risk'],
    ['Recovery plans', plans.length, 'recovery-planning'],
    ['Pending approvals', pendingPlans.length, 'recovery-planning'],
    ['Recovery in progress', recoveryInProgress.length, 'recovery-tracking'],
    ['Resolved disruptions', resolvedDisruptions.length, 'alerts'],
  ]
  const kpiIcons = [
    '<svg viewBox="0 0 24 24"><path d="m12 3 9 17H3z"/><path d="M12 9v4m0 3h.01"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M3 7h11l3 4h4v7H3z"/><path d="M14 7v4h6"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M6 4h12v17H6zM9 8h6M9 12h6M9 16h4"/><path d="M9 4V3h6v1"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M4 19V5m0 14h16"/><path d="m7 15 4-4 3 2 5-6"/><path d="M16 7h3v3"/></svg>',
    '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8.5 13l2.2 2.2 4.8-5"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
  ]
  document.getElementById('analyst-recovery-kpis').innerHTML = kpis.map(([label, value, page], index) =>
    `<a class="analyst-metric" href="#${page}"><span class="analyst-metric-icon" aria-hidden="true">${kpiIcons[index]}</span><div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>Open ${escapeHTML(label.toLowerCase())} →</small></div></a>`,
  ).join('')

  setText('analyst-inventory-value', formatNumber(totalUnits))
  setText('analyst-inventory-note', `${state.inventory.length} SKUs · backend inventory records`)
  setText('analyst-occupancy-value', `${occupancy.toFixed(1)}%`)
  setText('analyst-occupancy-note', `${warehouseSummary.occupiedLocations} / ${warehouseSummary.totalLocations} locations`)
  setText('analyst-shipments-value', activeShipmentCount)
  setText('analyst-shipments-note', `${delayedCount} delayed · from shared shipment records`)
  setText('analyst-delayed-kpi', delayedCount)
  setText('analyst-alerts-value', openAlerts.length)
  setText('analyst-alerts-note', `${state.alerts.length - openAlerts.length} resolved · ${openAlerts.length} open`)
  setText('analyst-low-stock-kpi', statuses['low-stock'] || 0)
  setText('analyst-out-stock-kpi', statuses['out-of-stock'] || 0)
  setText('analyst-pending-actions-kpi', pendingActions())
  setText('analyst-nav-alert-count', openAlerts.length)
  setText('analyst-nav-notification-count', unreadNotifications)
  setText('analyst-warehouse-name', warehouseSummary.warehouseName)
  setText('analyst-warehouse-id', warehouseSummary.warehouseId)
  setText('analyst-utilization-value', `${occupancy.toFixed(1)}%`)
  setText('analyst-occupied-locations', warehouseSummary.occupiedLocations)
  setText('analyst-total-locations', warehouseSummary.totalLocations)
  setText('analyst-pallet-count', warehouseSummary.totalPallets)
  setText('analyst-active-shipment-count', activeShipmentCount)
  setText('analyst-delayed-shipment-count', delayedCount)
  const progress = document.querySelector('.analyst-progress')
  if (progress) progress.setAttribute('aria-valuenow', occupancy.toFixed(1))
  const utilizationBar = document.getElementById('analyst-utilization-bar')
  if (utilizationBar) utilizationBar.style.width = `${occupancy}%`
}

const detailSection = document.getElementById('analyst-detail-section')
const detailPanel = document.getElementById('analyst-object-panel')

function addDetailRow(container, label, value) {
  const row = document.createElement('div')
  const term = document.createElement('strong')
  term.textContent = label
  const detail = document.createElement('span')
  detail.textContent = String(value ?? '—')
  row.append(term, detail)
  container.appendChild(row)
}

function addRecordLink(container, label, id, type) {
  const row = document.createElement('div')
  const title = document.createElement('strong')
  title.textContent = label
  const link = document.createElement('button')
  link.type = 'button'
  link.className = 'analyst-table-link analyst-detail-record-link'
  link.dataset.openType = type
  link.dataset.openId = id
  link.textContent = id
  row.append(title, link)
  container.appendChild(row)
}

function showDetails(type, id) {
  const product = type === 'inventory'
    ? state.inventory.find((item) => item.productId === id || item.id === id)
    : null
  const shipment = type === 'shipment'
    ? state.shipments.find((item) => item.id === id)
    : null
  const alert = type === 'alert'
    ? state.alerts.find((item) => item.id === id)
    : null
  const warehouse = type === 'warehouse' && id === warehouseSummary.warehouseId
    ? warehouseSummary
    : null
  const record = product || shipment || alert || warehouse
  if (!record) return

  setText('analyst-object-title', product?.productName || shipment?.id || alert?.title || warehouse?.warehouseName)
  setText('analyst-object-type', product ? 'Inventory product' : shipment ? 'Shipment' : alert ? 'Alert / incident' : 'Warehouse')
  setText('analyst-object-id', product?.productId || shipment?.id || alert?.id || warehouse?.warehouseId)
  setText('analyst-object-product', product?.productName || shipment?.destination || alert?.description || 'Warehouse capacity and activity')
  setText('analyst-object-product-id', product?.sku || shipment?.orderId || alert?.relatedId || 'Warehouse locations')
  setText('analyst-object-quantity', product
    ? `${formatNumber(product.quantity)} ${product.unit}`
    : shipment
      ? `${shipment.quantity} units · ETA ${shipment.eta}`
      : alert
        ? alert.category
        : `${warehouseSummary.occupiedLocations} / ${warehouseSummary.totalLocations} locations`)
  setText('analyst-object-status', titleCase(product ? stockStatus(product) : shipment?.status || alert?.status || `${Math.round(warehouseSummary.occupiedLocations / warehouseSummary.totalLocations * 1000) / 10}% occupancy`))
  setText('analyst-object-location', product?.location || shipment?.destination || alert?.assignedTo || warehouseSummary.warehouseName)
  const note = document.getElementById('analyst-object-note')
  if (note) note.textContent = product
    ? `Available ${formatNumber(availableStock(product))} ${product.unit} · Reserved ${formatNumber(product.reserved)} · Reorder threshold ${formatNumber(product.reorderThreshold)}`
    : shipment
      ? shipment.delayReason || 'Shipment record and delivery timeline from the backend.'
      : alert
        ? alert.impact || ''
        : 'Illustrative warehouse location data; equipment is not live tracked.'
  const extra = document.getElementById('analyst-detail-extra')
  extra.replaceChildren()

  if (product) {
    addDetailRow(extra, 'Category', product.category)
    addDetailRow(extra, 'Supplier', product.supplier)
    addDetailRow(extra, 'Warehouse', product.warehouse)
    addDetailRow(extra, 'Related purchase orders', product.movements.filter((movement) => movement.type === 'Received').map((movement) => movement.reference).join(', ') || 'None listed')
    const linked = state.shipments.filter((item) => item.productIds.includes(product.productId))
    if (linked.length) linked.forEach((item, index) => addRecordLink(extra, index ? 'Related shipment' : 'Related shipments', item.id, 'shipment'))
    else addDetailRow(extra, 'Related shipments', 'None listed')
    const history = document.createElement('div')
    history.className = 'analyst-detail-history'
    history.innerHTML = `<h3>Stock movement history</h3>${product.movements.map((movement) => `<p><span>${escapeHTML(formatDate(movement.date))} · ${escapeHTML(movement.type)}</span><strong>${movement.quantity > 0 ? '+' : ''}${formatNumber(movement.quantity)} ${escapeHTML(product.unit)}</strong><small>${escapeHTML(movement.reference)}</small></p>`).join('') || '<p>No stock movements recorded.</p>'}`
    extra.appendChild(history)
  } else if (shipment) {
    const assessment = shipmentAssessments().find((item) => item.id === shipment.id)
    addDetailRow(extra, 'Order', shipment.orderId)
    addDetailRow(extra, 'Shipment direction', shipment.direction === 'inbound' ? 'Inbound replenishment' : 'Outbound delivery')
    shipment.productIds.forEach((productId, index) => {
      const relatedProduct = state.inventory.find((item) => item.productId === productId)
      if (relatedProduct) addRecordLink(extra, index ? 'Related product' : 'Products / quantity', relatedProduct.productId, 'inventory')
    })
    addDetailRow(extra, 'Origin', shipment.origin)
    addDetailRow(extra, 'Carrier / vehicle', `${shipment.carrier} · ${shipment.vehicleId}`)
    addDetailRow(extra, 'Dispatch / expected', `${formatDate(shipment.dispatchDate)} · ${formatDate(shipment.expectedDate)}`)
    addDetailRow(extra, 'Actual delivery', shipment.actualDate ? formatDate(shipment.actualDate) : 'Not delivered')
    addDetailRow(extra, 'Exception reason', shipment.delayReason || 'None recorded')
    if (assessment) {
      addDetailRow(extra, 'Expected delay', `${assessment.delayDays} day(s) · estimated from expected delivery date`)
      addDetailRow(extra, 'Shipment risk', `${assessment.riskScore}/100 · ${titleCase(assessment.riskLevel)} · backend rule-based score`)
      addDetailRow(extra, 'Risk factors', assessment.factors.join(' '))
    }
    const timeline = document.createElement('div')
    timeline.className = 'analyst-detail-history'
    timeline.innerHTML = `<h3>Status timeline</h3><p>${escapeHTML(formatDate(shipment.dispatchDate))} · Shipment created and assigned</p>${(shipment.timeline || [{ timestamp: shipment.updatedAt || shipment.dispatchDate, status: shipment.status, note: shipment.delayReason }]).map((entry) => `<p>${escapeHTML(formatDateTime(entry.timestamp))} · ${escapeHTML(titleCase(entry.status))}${entry.note ? ` · ${escapeHTML(entry.note)}` : ''}</p>`).join('')}${shipment.actualDate ? `<p>${escapeHTML(formatDate(shipment.actualDate))} · Delivery confirmed</p>` : ''}`
    extra.appendChild(timeline)
    const linkedAlerts = state.alerts.filter((item) => item.relatedId === shipment.id)
    addDetailRow(extra, 'Related incidents', linkedAlerts.map((item) => item.id).join(', ') || 'None listed')
  } else if (warehouse) {
    addDetailRow(extra, 'Occupied locations', warehouseSummary.occupiedLocations)
    addDetailRow(extra, 'Available locations', warehouseSummary.totalLocations - warehouseSummary.occupiedLocations)
    addDetailRow(extra, 'Total capacity', warehouseSummary.totalLocations)
    addDetailRow(extra, 'Tracked products', state.inventory.length)
  } else {
    const assessment = disruptionAssessments().find((item) => item.id === alert.id)
    addDetailRow(extra, 'Category / severity', `${alert.category} · ${titleCase(alert.severity)}`)
    addDetailRow(extra, 'Created', formatDateTime(alert.createdAt))
    addDetailRow(extra, 'Assigned analyst', alert.assignedTo)
    addDetailRow(extra, 'Potential impact', alert.impact)
    if (assessment) {
      addDetailRow(extra, 'Affected orders / shipments', `${assessment.orders.length} order(s) · ${assessment.shipments.length} shipment(s)`)
      addDetailRow(extra, 'Risk score', `${assessment.riskScore}/100 · backend rule-based score`)
      addDetailRow(extra, 'Risk factors', assessment.factors.join(' '))
      const shipment = assessment.shipments
        .slice()
        .sort((left, right) => right.riskScore - left.riskScore)[0]
      if (shipment) {
        const summaryBox = document.createElement('div')
        summaryBox.className = 'analyst-detail-history'
        summaryBox.innerHTML = '<h3>Backend disruption summary</h3><p>Loading summary…</p>'
        extra.appendChild(summaryBox)
        disruptionSummary(shipment.id, {
          type: (alert.category || 'DISRUPTION').slice(0, 100),
          delayDays: Math.max(0, Math.round(Number(shipment.delayDays) || 0)),
          reason: String(alert.description || '').slice(0, 1000),
        })
          .then((result) => {
            summaryBox.innerHTML = `<h3>Backend disruption summary</h3><p>${escapeHTML(result?.summary || 'No summary returned.')}</p><small>${result?.aiAvailable ? 'AI service explanation' : 'Deterministic backend fallback; AI explanation unavailable'}</small>`
          })
          .catch((error) => {
            summaryBox.innerHTML = `<h3>Backend disruption summary</h3><p>${escapeHTML(error.message || 'Summary unavailable.')}</p>`
          })
      }
    }
    addDetailRow(extra, 'Current workflow status', titleCase(alert.status))
    addRecordLink(extra, 'Associated record', alert.relatedId, alert.relatedType)
    const history = document.createElement('div')
    history.className = 'analyst-detail-history'
    history.innerHTML = `<h3>Incident history</h3>${alert.notes.map((item) => `<p>${escapeHTML(item)}</p>`).join('')}`
    extra.appendChild(history)
    const relatedPlans = getWorkflowState().plans.filter((plan) => plan.disruptionId === alert.id)
    if (relatedPlans.length) {
      const recoveryHistory = document.createElement('div')
      recoveryHistory.className = 'analyst-detail-history'
      recoveryHistory.innerHTML = `<h3>Shared recovery plan history</h3>${relatedPlans.map((plan) => `<p><button class="analyst-table-link" data-plan-detail-id="${escapeHTML(plan.id)}">${escapeHTML(plan.id)}</button> · ${escapeHTML(plan.strategy)} · ${escapeHTML(titleCase(plan.approval_status))} · execution ${escapeHTML(titleCase(plan.execution_status))}</p>`).join('')}`
      extra.appendChild(recoveryHistory)
    }
  }

  const actionButton = document.getElementById('analyst-object-action')
  if (actionButton) {
    actionButton.hidden = !alert || alert.status === 'resolved'
    if (alert && alert.status !== 'resolved') {
      actionButton.textContent = 'Create recovery plan'
      actionButton.dataset.disruptionId = alert.id
    } else {
      delete actionButton.dataset.disruptionId
    }
  }
  detailPanel.hidden = false
  detailSection.hidden = false
}

function closeDetails() {
  if (detailPanel) detailPanel.hidden = true
  if (detailSection) detailSection.hidden = true
}

function openRecoveryPlanDialog(disruptionId) {
  const selector = document.getElementById('recovery-disruption')
  if (selector) selector.value = disruptionId
  renderRecoveryPlanContext()
  if (window.location.hash !== '#recovery-planning') history.pushState(null, '', '#recovery-planning')
  showPage('recovery-planning')
}

document.getElementById('analyst-object-action')?.addEventListener('click', (event) => {
  const disruptionId = event.currentTarget.dataset.disruptionId
  if (disruptionId) openRecoveryPlanDialog(disruptionId)
})

document.getElementById('analyst-panel-close')?.addEventListener('click', closeDetails)
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && detailPanel && !detailPanel.hidden) closeDetails()
})

const inventoryState = { query: '', status: 'all', category: 'all', warehouse: 'all', sort: 'name' }
const inventoryTableBody = document.getElementById('inventory-table-body')

function inventoryFiltered() {
  const filtered = state.inventory.filter((product) => {
    const query = inventoryState.query.toLowerCase()
    const matchesQuery = !query || `${product.productName} ${product.productId} ${product.sku}`.toLowerCase().includes(query)
    return matchesQuery &&
      (inventoryState.status === 'all' || stockStatus(product) === inventoryState.status) &&
      (inventoryState.category === 'all' || product.category === inventoryState.category) &&
      (inventoryState.warehouse === 'all' || product.warehouse === inventoryState.warehouse)
  })
  const comparators = {
    name: (left, right) => left.productName.localeCompare(right.productName),
    'quantity-asc': (left, right) => left.quantity - right.quantity,
    'quantity-desc': (left, right) => right.quantity - left.quantity,
    'updated-desc': (left, right) => right.updatedAt.localeCompare(left.updatedAt),
    'updated-asc': (left, right) => left.updatedAt.localeCompare(right.updatedAt),
  }
  return filtered.sort(comparators[inventoryState.sort])
}

function renderInventoryTable() {
  const products = inventoryFiltered()
  setText('inventory-result-count', `${products.length} of ${state.inventory.length} products`)
  inventoryTableBody.innerHTML = products.map((product) => {
    const status = stockStatus(product)
    const linkedShipment = state.shipments.find((shipment) => shipment.productIds.includes(product.productId))
    return `<tr>
      <td><button class="analyst-table-link" data-open-type="inventory" data-open-id="${escapeHTML(product.productId)}"><strong>${escapeHTML(product.productName)}</strong><small>${escapeHTML(product.productId)}</small></button></td>
      <td>${escapeHTML(product.sku)}<small>${escapeHTML(product.category)}</small></td>
      <td>${formatNumber(product.quantity)} ${escapeHTML(product.unit)}</td>
      <td>${formatNumber(product.reserved)} ${escapeHTML(product.unit)}</td>
      <td>${formatNumber(availableStock(product))} ${escapeHTML(product.unit)}</td>
      <td>${escapeHTML(product.warehouse)}<small>${escapeHTML(product.location)}</small></td>
      <td><span class="analyst-status-badge" data-status="${status}">${titleCase(status)}</span></td>
      <td>${formatDate(product.updatedAt)}</td>
      <td><div class="analyst-row-actions"><button data-product-action="details" data-id="${escapeHTML(product.productId)}">Details</button><button data-product-action="history" data-id="${escapeHTML(product.productId)}">History</button><button data-product-action="flag" data-id="${escapeHTML(product.productId)}">Flag for review</button>${linkedShipment ? `<button data-product-action="shipment" data-id="${escapeHTML(linkedShipment.id)}">Shipment</button>` : ''}</div></td>
    </tr>`
  }).join('') || '<tr><td colspan="9" class="analyst-table-empty">No products match these filters.</td></tr>'
}

function updateInventoryKpis() {
  const totalUnits = state.inventory.reduce((sum, product) => sum + product.quantity, 0)
  const reserved = state.inventory.reduce((sum, product) => sum + product.reserved, 0)
  const counts = state.inventory.reduce((result, product) => {
    const status = stockStatus(product)
    result[status] = (result[status] || 0) + 1
    return result
  }, {})
  const pendingAdjustments = state.activities.filter((item) => item.type === 'Stock adjustment pending').length
  const values = [
    ['Total SKUs', state.inventory.length],
    ['Inventory units', formatNumber(totalUnits)],
    ['Available stock', formatNumber(totalUnits - reserved)],
    ['Reserved stock', formatNumber(reserved)],
    ['Low stock', counts['low-stock'] || 0],
    ['Out of stock', counts['out-of-stock'] || 0],
    ['Pending adjustments', pendingAdjustments],
  ]
  document.getElementById('inventory-kpis').innerHTML = values.map(([label, value]) => `<article class="analyst-module-kpi"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></article>`).join('')
}

const shipmentState = { query: '', status: 'all' }
function shipmentFiltered() {
  const query = shipmentState.query.toLowerCase()
  return state.shipments.filter((shipment) => {
    const text = `${shipment.id} ${shipment.orderId} ${shipment.destination} ${shipment.carrier} ${shipment.vehicleId}`.toLowerCase()
    return (!query || text.includes(query)) && (shipmentState.status === 'all' || shipment.status === shipmentState.status)
  })
}

function updateShipmentKpis() {
  const counts = state.shipments.reduce((result, shipment) => {
    result[shipment.status] = (result[shipment.status] || 0) + 1
    return result
  }, {})
  const values = [
    ['Total shipments', state.shipments.length],
    ['Pending dispatch', counts['pending-dispatch'] || 0],
    ['In transit', counts['in-transit'] || 0],
    ['Delivered', counts.delivered || 0],
    ['Delayed', counts.delayed || 0],
    ['Failed deliveries', counts.failed || 0],
  ]
  document.getElementById('shipment-kpis').innerHTML = values.map(([label, value]) => `<article class="analyst-module-kpi"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></article>`).join('')
}

function renderShipmentTable() {
  const items = shipmentFiltered()
  document.getElementById('shipment-table-body').innerHTML = items.map((shipment) => `<tr>
    <td><button class="analyst-table-link" data-open-type="shipment" data-open-id="${escapeHTML(shipment.id)}"><strong>${escapeHTML(shipment.id)}</strong><small>${escapeHTML(shipment.orderId)}</small></button></td>
    <td>${escapeHTML(shipment.origin)} → ${escapeHTML(shipment.destination)}<small>${shipment.direction === 'inbound' ? 'Inbound replenishment' : 'Outbound delivery'}</small></td>
    <td>${escapeHTML(shipment.carrier)}<small>${escapeHTML(shipment.vehicleId)}</small></td>
    <td>${formatDate(shipment.dispatchDate)}</td>
    <td>${formatDate(shipment.expectedDate)}<small>${escapeHTML(shipment.eta)}</small></td>
    <td><span class="analyst-status-badge" data-status="${escapeHTML(shipment.status)}">${titleCase(shipment.status)}</span></td>
    <td>${escapeHTML(shipment.delayReason || '—')}</td>
    <td><div class="analyst-row-actions"><button data-open-type="shipment" data-open-id="${escapeHTML(shipment.id)}">Details</button><button data-shipment-action="exception" data-id="${escapeHTML(shipment.id)}">Record investigation note</button></div></td>
  </tr>`).join('') || '<tr><td colspan="8" class="analyst-table-empty">No shipments match these filters.</td></tr>'
}

function renderIncidentList() {
  const query = (document.getElementById('alert-search')?.value || '').toLowerCase()
  const severity = document.getElementById('alert-severity-filter')?.value || 'all'
  const status = document.getElementById('alert-status-filter')?.value || 'all'
  const incidents = state.alerts.filter((alert) => {
    const text = `${alert.id} ${alert.title} ${alert.description} ${alert.relatedId} ${alert.category}`.toLowerCase()
    return (!query || text.includes(query)) &&
      (severity === 'all' || alert.severity === severity) &&
      (status === 'all' || alert.status === status)
  }).sort((left, right) => {
    const sort = document.getElementById('alert-sort')?.value || 'severity'
    if (sort === 'newest') return new Date(right.createdAt) - new Date(left.createdAt)
    if (sort === 'oldest') return new Date(left.createdAt) - new Date(right.createdAt)
    const rank = { critical: 0, high: 1, medium: 2, low: 3 }
    return rank[left.severity] - rank[right.severity] || new Date(right.createdAt) - new Date(left.createdAt)
  })
  document.getElementById('alert-list').innerHTML = incidents.map((alert) => `<article class="analyst-incident-row">
    <span class="analyst-severity-mark" data-severity="${escapeHTML(alert.severity)}"></span>
    <div class="analyst-incident-main"><div><strong>${escapeHTML(alert.title)}</strong><span class="analyst-status-badge" data-status="${escapeHTML(alert.severity)}">${titleCase(alert.severity)}</span></div><p>${escapeHTML(alert.description)}</p><small>${escapeHTML(alert.id)} · ${escapeHTML(alert.category)} · ${formatDateTime(alert.createdAt)} · Record ${escapeHTML(alert.relatedId)}</small></div>
    <span class="analyst-status-badge" data-status="${escapeHTML(alert.status)}">${titleCase(alert.status)}</span>
    <span class="analyst-incident-assignee">${escapeHTML(alert.assignedTo || 'Unassigned')}</span>
    <div class="analyst-row-actions"><button data-open-type="alert" data-open-id="${escapeHTML(alert.id)}">Details</button>${alert.status !== 'resolved' ? `<button data-recovery-plan-disruption="${escapeHTML(alert.id)}">Recovery plan</button>` : ''}${alert.status === 'open' ? `<button data-alert-action="acknowledge" data-id="${escapeHTML(alert.id)}">Acknowledge</button>` : ''}<button data-alert-action="status" data-id="${escapeHTML(alert.id)}">Update status</button><button data-alert-action="assign" data-id="${escapeHTML(alert.id)}">Assign</button><button data-alert-action="note" data-id="${escapeHTML(alert.id)}">Add note</button>${alert.status !== 'resolved' ? `<button data-alert-action="resolve" data-id="${escapeHTML(alert.id)}">Resolve</button>` : ''}</div>
  </article>`).join('') || '<p class="analyst-table-empty">No incidents match these filters.</p>'
}

function createDialog() {
  if (document.getElementById('analyst-action-dialog')) return
  const dialog = document.createElement('dialog')
  dialog.id = 'analyst-action-dialog'
  dialog.className = 'analyst-action-dialog'
  dialog.innerHTML = '<form method="dialog" id="analyst-action-form"><div class="analyst-dialog-heading"><h2 id="analyst-dialog-title">Record action</h2><button type="button" class="analyst-dialog-close" aria-label="Close dialog">×</button></div><div id="analyst-dialog-fields"></div><p id="analyst-dialog-error" class="analyst-dialog-error" aria-live="polite"></p><div class="analyst-dialog-actions"><button type="button" class="analyst-button analyst-button--quiet analyst-dialog-cancel">Cancel</button><button type="submit" class="analyst-button" id="analyst-dialog-submit">Save change</button></div></form>'
  document.body.appendChild(dialog)
  dialog.querySelector('.analyst-dialog-close').addEventListener('click', () => dialog.close())
  dialog.querySelector('.analyst-dialog-cancel').addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })
}

createDialog()

function openDialog({ title, fields, submit = 'Save change', onSubmit }) {
  const dialog = document.getElementById('analyst-action-dialog')
  const form = document.getElementById('analyst-action-form')
  setText('analyst-dialog-title', title)
  setText('analyst-dialog-submit', submit)
  document.getElementById('analyst-dialog-error').textContent = ''
  document.getElementById('analyst-dialog-fields').innerHTML = fields
  form.onsubmit = (event) => {
    event.preventDefault()
    const error = onSubmit(new FormData(form))
    if (error) {
      setText('analyst-dialog-error', error)
      return
    }
    dialog.close()
    persist()
    refresh()
  }
  dialog.showModal()
}

function addAlert({ title, description, category, severity, relatedId, relatedType, impact }) {
  const id = `ALT-${String(Date.now()).slice(-6)}`
  const timestamp = new Date().toISOString()
  const alert = {
    id, title, description, category, severity, relatedId, relatedType, impact,
    createdAt: timestamp, assignedTo: 'Unassigned', status: 'open',
    notes: [`${formatDateTime(timestamp)} · Alert generated.`],
  }
  state.alerts.unshift(alert)
  state.notifications.unshift({
    id: `NOT-${id}`, alertId: id, relatedType: 'alert', relatedId: id, title, description, createdAt: timestamp, read: false,
  })
  recordActivity('Alert generated', title, id)
  return alert
}

function upsertOperationalAlert(details) {
  const existing = activeAlerts().find((alert) =>
    alert.relatedId === details.relatedId && alert.relatedType === details.relatedType,
  )
  if (!existing) return addAlert(details)
  existing.title = details.title
  existing.description = details.description
  existing.category = details.category
  existing.severity = details.severity
  existing.impact = details.impact
  existing.notes.unshift(`${formatDateTime(new Date().toISOString())} · Alert updated: ${details.description}`)
  recordActivity('Operational alert updated', details.title, existing.id)
  return existing
}

function flagProduct(productId) {
  const product = state.inventory.find((item) => item.productId === productId)
  if (!product) return
  const duplicate = activeAlerts().find((alert) => alert.relatedId === product.productId && alert.category === 'Inventory')
  if (duplicate) {
    showDetails('alert', duplicate.id)
    return
  }
  const alert = upsertOperationalAlert({
    title: `${product.productName} shortage flagged`,
    description: `${formatNumber(availableStock(product))} ${product.unit} available; reorder threshold is ${formatNumber(product.reorderThreshold)}.`,
    category: 'Inventory',
    severity: stockStatus(product) === 'out-of-stock' ? 'critical' : 'high',
    relatedId: product.productId,
    relatedType: 'inventory',
    impact: `Supplier: ${product.supplier}. Review linked shipments and replenishment.`,
  })
  persist()
  refresh()
  showDetails('alert', alert.id)
}

function openAlertAction(action, alertId) {
  const alert = state.alerts.find((item) => item.id === alertId)
  if (!alert) return
  const update = (operation, detail) => {
    const timestamp = formatDateTime(new Date().toISOString())
    if (operation === 'acknowledge') {
      alert.status = 'acknowledged'
      alert.notes.unshift(`${timestamp} · Acknowledged by Operations Analyst.`)
      recordActivity('Incident acknowledged', alert.title, alert.id)
    } else if (operation === 'resolve') {
      alert.status = 'resolved'
      alert.notes.unshift(`${timestamp} · Resolution recorded: ${detail}`)
      recordActivity('Incident resolved', `${alert.title}: ${detail}`, alert.id)
    } else if (operation === 'assign') {
      alert.assignedTo = detail
      alert.status = alert.status === 'open' ? 'acknowledged' : alert.status
      alert.notes.unshift(`${timestamp} · Assigned to ${detail}.`)
      state.notifications.unshift({
        id: `NOT-ASSIGN-${Date.now()}`,
        alertId: alert.id,
        relatedType: 'alert',
        relatedId: alert.id,
        title: `Incident assigned: ${alert.title}`,
        description: `Assigned to ${detail}.`,
        createdAt: new Date().toISOString(),
        read: false,
      })
      recordActivity('Incident assigned', `${alert.title} assigned to ${detail}.`, alert.id)
    } else if (operation === 'note') {
      alert.status = alert.status === 'acknowledged' ? 'investigating' : alert.status
      alert.notes.unshift(`${timestamp} · ${detail}`)
      recordActivity('Investigation note added', `${alert.title}: ${detail}`, alert.id)
    } else if (operation === 'status') {
      alert.status = detail.status
      alert.notes.unshift(`${timestamp} · Status changed to ${titleCase(detail.status)}${detail.note ? `: ${detail.note}` : ''}.`)
      recordActivity('Incident status updated', `${alert.title}: ${titleCase(detail.status)}`, alert.id)
    }
  }
  if (action === 'acknowledge') {
    update('acknowledge')
    persist()
    refresh()
    showDetails('alert', alert.id)
    return
  }
  if (action === 'assign') {
    openDialog({
      title: `Assign incident · ${alert.id}`,
      fields: '<label>Assigned analyst<select name="assignee" required><option>Operations Analyst</option><option>Warehouse Supervisor</option><option>Inventory Lead</option><option>Transport Coordinator</option></select></label>',
      onSubmit: (formData) => {
        update('assign', String(formData.get('assignee')))
        return ''
      },
    })
    return
  }
  if (action === 'status') {
    openDialog({
      title: `Update incident · ${alert.id}`,
      fields: `<label>Incident status<select name="status"><option value="open" ${alert.status === 'open' ? 'selected' : ''}>Open</option><option value="acknowledged" ${alert.status === 'acknowledged' ? 'selected' : ''}>Acknowledged</option><option value="investigating" ${alert.status === 'investigating' ? 'selected' : ''}>Investigating</option><option value="resolved" ${alert.status === 'resolved' ? 'selected' : ''}>Resolved</option></select></label><label>Action note<input name="note" type="text" maxlength="240" placeholder="Optional workflow update"></label>`,
      onSubmit: (formData) => {
        const status = String(formData.get('status'))
        const note = String(formData.get('note') || '').trim()
        if (status === 'resolved' && !note) return 'Add a corrective action or resolution note before resolving.'
        if (status === 'resolved') update('resolve', note)
        else update('status', { status, note })
        return ''
      },
    })
    return
  }
  const isResolve = action === 'resolve'
  openDialog({
    title: isResolve ? `Resolve incident · ${alert.id}` : `Investigation note · ${alert.id}`,
    submit: isResolve ? 'Record resolution' : 'Add investigation note',
    fields: `<label>${isResolve ? 'Corrective action / resolution' : 'Investigation note'}<textarea name="note" rows="4" maxlength="500" required></textarea></label>`,
    onSubmit: (formData) => {
      const note = String(formData.get('note') || '').trim()
      if (!note) return 'Enter a note before saving.'
      update(isResolve ? 'resolve' : 'note', note)
      return ''
    },
  })
}

function openShipmentAction(action, shipmentId) {
  const shipment = state.shipments.find((item) => item.id === shipmentId)
  if (!shipment || action !== 'exception') return
  openDialog({
    title: `Record exception · ${shipment.id}`,
    submit: 'Save investigation note',
    fields: '<label>Exception / investigation note<textarea name="note" rows="4" maxlength="500" required></textarea></label>',
    onSubmit: (formData) => {
      const note = String(formData.get('note') || '').trim()
      if (!note) return 'Enter the exception details.'
      shipment.delayReason = note
      shipment.updatedAt = new Date().toISOString()
      shipment.timeline ||= []
      shipment.timeline.unshift({ timestamp: shipment.updatedAt, status: shipment.status, note })
      recordActivity('Shipment exception recorded', `${shipment.id}: ${note}`, shipment.id)
      upsertOperationalAlert({
        title: `${shipment.id} exception recorded`,
        description: note,
        category: 'Transportation',
        severity: 'medium',
        relatedId: shipment.id,
        relatedType: 'shipment',
        impact: `Investigate delivery impact for ${shipment.destination}.`,
      })
      return ''
    },
  })
}

function renderMonitoringViews() {
  const query = monitoringSearchState.query.toLowerCase()
  const assessments = shipmentAssessments()
  const impacts = currentInventoryImpacts()
  const disruptions = disruptionAssessments()
  const visibleDisruptions = disruptions.filter((item) =>
    `${item.id} ${item.title} ${item.category} ${item.severity} ${item.relatedId} ${item.orders.join(' ')} ${item.shipments.map((shipment) => shipment.id).join(' ')} ${item.products.map((product) => `${product.supplier} ${product.warehouse}`).join(' ')}`.toLowerCase().includes(query),
  )
  document.getElementById('monitoring-disruptions').innerHTML = visibleDisruptions.map((item) => `<tr>
    <td><button class="analyst-table-link" data-open-type="alert" data-open-id="${escapeHTML(item.id)}"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.id)} · ${escapeHTML(item.relatedId)}</small></button></td>
    <td>${escapeHTML(item.category)}<small>${titleCase(item.severity)}</small></td>
    <td><span class="analyst-status-badge" data-status="${escapeHTML(item.riskLevel)}">${item.riskScore}/100 · ${titleCase(item.riskLevel)}</span></td>
    <td>${item.orders.length} orders<small>${item.shipments.length} shipments</small></td>
    <td>${escapeHTML([...new Set(item.products.map((product) => product.supplier))].join(', ') || 'Not listed')}<small>${escapeHTML([...new Set(item.products.map((product) => product.warehouse))].join(', ') || 'Not listed')}</small></td>
    <td><span class="analyst-status-badge" data-status="${escapeHTML(item.status)}">${titleCase(item.status)}</span></td>
    <td><button data-open-type="alert" data-open-id="${escapeHTML(item.id)}">Details</button></td>
  </tr>`).join('') || '<tr><td colspan="7" class="analyst-table-empty">No disruptions match this search.</td></tr>'

  const visibleShipments = assessments.filter((shipment) =>
    `${shipment.id} ${shipment.orderId} ${shipment.destination} ${shipment.carrier} ${shipment.status}`.toLowerCase().includes(query),
  )
  document.getElementById('monitoring-shipments').innerHTML = visibleShipments.map((shipment) => `<tr>
    <td><button class="analyst-table-link" data-open-type="shipment" data-open-id="${escapeHTML(shipment.id)}">${escapeHTML(shipment.id)}<small>${escapeHTML(shipment.orderId)}</small></button></td>
    <td>${escapeHTML(shipment.carrier)}<small>${escapeHTML(shipment.origin)} → ${escapeHTML(shipment.destination)}</small></td>
    <td>${formatDate(shipment.expectedDate)}<small>${shipment.delayDays ? `${shipment.delayDays} estimated overdue day(s)` : 'No overdue days recorded'}</small></td>
    <td><span class="analyst-status-badge" data-status="${escapeHTML(shipment.status)}">${titleCase(shipment.status)}</span></td>
  </tr>`).join('') || '<tr><td colspan="4" class="analyst-table-empty">No shipments match this search.</td></tr>'

  const suppliers = new Map()
  state.inventory.forEach((product) => {
    const supplier = suppliers.get(product.supplier) || { products: 0, available: 0, belowThreshold: 0 }
    supplier.products += 1
    supplier.available += availableStock(product)
    if (availableStock(product) <= product.reorderThreshold) supplier.belowThreshold += 1
    suppliers.set(product.supplier, supplier)
  })
  document.getElementById('monitoring-suppliers').innerHTML = [...suppliers.entries()].map(([supplier, summary]) => `<tr><td>${escapeHTML(supplier)}</td><td>${summary.products}</td><td>${formatNumber(summary.available)}</td><td>${summary.belowThreshold}</td></tr>`).join('') || '<tr><td colspan="4" class="analyst-table-empty">No supplier records.</td></tr>'

  const warehouses = new Map()
  impacts.forEach((product) => {
    const warehouse = warehouses.get(product.warehouse) || { products: 0, available: 0, shortages: 0 }
    warehouse.products += 1
    warehouse.available += product.available
    if (product.shortage > 0) warehouse.shortages += 1
    warehouses.set(product.warehouse, warehouse)
  })
  document.getElementById('monitoring-warehouses').innerHTML = [...warehouses.entries()].map(([warehouse, summary]) => `<tr><td><button class="analyst-table-link" data-open-type="warehouse" data-open-id="${escapeHTML(warehouse)}">${escapeHTML(warehouse)}</button></td><td>${summary.products}</td><td>${formatNumber(summary.available)}</td><td>${summary.shortages}</td></tr>`).join('') || '<tr><td colspan="4" class="analyst-table-empty">No warehouse records.</td></tr>'
  document.getElementById('monitoring-inventory').innerHTML = impacts.map((product) => `<tr>
    <td><button class="analyst-table-link" data-open-type="inventory" data-open-id="${escapeHTML(product.productId)}">${escapeHTML(product.productName)}<small>${escapeHTML(product.sku)}</small></button></td>
    <td>${escapeHTML(product.warehouse)}</td><td>${formatNumber(product.available)} / ${formatNumber(product.required)}</td>
    <td>${product.shortage ? formatNumber(product.shortage) : '—'}</td>
  </tr>`).join('') || '<tr><td colspan="4" class="analyst-table-empty">No inventory records.</td></tr>'

  const active = activeAlerts().length
  const delayed = state.shipments.filter((shipment) => ['delayed', 'failed'].includes(shipment.status)).length
  const shortages = impacts.filter((product) => product.shortage > 0).length
  const values = [['Active disruptions', active], ['Delayed / failed shipments', delayed], ['Inventory shortages', shortages], ['Suppliers monitored', suppliers.size]]
  document.getElementById('monitoring-kpis').innerHTML = values.map(([label, value]) => `<article class="analyst-module-kpi"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></article>`).join('')
}

function renderOrderImpact() {
  const query = document.getElementById('order-impact-search').value.trim().toLowerCase()
  const risk = document.getElementById('order-impact-risk').value
  const assessments = shipmentAssessments().filter((shipment) =>
    (!query || `${shipment.orderId} ${shipment.id} ${shipment.destination}`.toLowerCase().includes(query)) &&
    (risk === 'all' || shipment.riskLevel === risk),
  )
  const risky = shipmentAssessments().filter((shipment) => shipment.riskLevel !== 'low' || shipment.delayDays > 0)
  const values = [
    ['Orders tracked', new Set(shipmentAssessments().map((shipment) => shipment.orderId)).size],
    ['Orders with exposure', new Set(risky.map((shipment) => shipment.orderId)).size],
    ['Overdue deliveries', shipmentAssessments().filter((shipment) => shipment.delayDays > 0).length],
  ]
  document.getElementById('order-impact-kpis').innerHTML = values.map(([label, value]) => `<article class="analyst-module-kpi"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></article>`).join('')
  document.getElementById('order-impact-table').innerHTML = assessments.map((shipment) => {
    const stock = shipment.shortageProducts.map((product) => `${product.productName}: ${formatNumber(Math.max(0, shipment.quantity - product.available))} short`).join(', ') || 'No linked stock shortage recorded'
    const impact = shipment.riskLevel === 'high'
      ? 'High estimated service risk'
      : shipment.riskLevel === 'medium'
        ? 'Monitor delivery and dependencies'
        : 'No material risk signal recorded'
    return `<tr>
      <td><button class="analyst-table-link" data-open-type="shipment" data-open-id="${escapeHTML(shipment.id)}">${escapeHTML(shipment.orderId)}<small>${escapeHTML(shipment.id)}</small></button></td>
      <td>${titleCase(shipment.priority)}<small><span class="analyst-status-badge" data-status="${escapeHTML(shipment.riskLevel)}">${shipment.riskScore}/100 · ${titleCase(shipment.riskLevel)}</span></small></td>
      <td>${escapeHTML(shipment.destination)}<small>${escapeHTML(shipment.carrier)}</small></td>
      <td>${formatDate(shipment.expectedDate)}<small>Recorded expected delivery</small></td>
      <td>${shipment.delayDays} day(s)<small>Estimated from expected date and current status</small></td>
      <td>${escapeHTML(stock)}<small>${escapeHTML(impact)} · qualitative estimate</small></td>
    </tr>`
  }).join('') || '<tr><td colspan="6" class="analyst-table-empty">No order records match these filters.</td></tr>'
}

const impactGraphState = { shipmentId: '', impact: null, renderedShipmentId: '', loading: '' }

function populateImpactGraphShipments() {
  const select = document.getElementById('impact-graph-shipment')
  if (!select) return
  const previous = select.value || impactGraphState.shipmentId
  const options = state.shipments.map((shipment) =>
    `<option value="${escapeHTML(shipment.id)}">${escapeHTML(shipment.id)} · ${escapeHTML(titleCase(shipment.status))} · ${escapeHTML(shipment.destination)}</option>`,
  ).join('')
  select.innerHTML = options || '<option value="">No shipments available</option>'
  select.disabled = !options
  const preferred = options && [...select.options].some((option) => option.value === previous)
    ? previous
    : state.shipments.find((shipment) => (shipment.orderIds || []).length || (shipment.orderId && shipment.orderId !== '—'))?.id
      || state.shipments[0]?.id
      || ''
  select.value = preferred
  impactGraphState.shipmentId = preferred
}

function openImpactGraphNode(kind, id, impact) {
  const openShipment = () => showDetails('shipment', impact?.shipmentId)
  if (kind === 'shipment') return showDetails('shipment', id || impact?.shipmentId)
  if (kind === 'inventory' || kind === 'product') {
    const product = state.inventory.find((item) =>
      item.productId === id || item.id === id || item.productId === impact?.productId,
    )
    if (product) return showDetails('inventory', product.productId || product.id)
  }
  if (kind === 'warehouse') {
    const product = state.inventory.find((item) =>
      item.warehouse === id || item.warehouseId === id || item.warehouseId === impact?.warehouseId,
    )
    if (product) return showDetails('inventory', product.productId || product.id)
  }
  if (kind === 'supplier') {
    const product = state.inventory.find((item) =>
      item.supplierId === id || item.supplier === id || item.supplier === impact?.supplierName,
    )
    if (product) return showDetails('inventory', product.productId || product.id)
  }
  return openShipment()
}

async function renderImpactGraph({ force = false } = {}) {
  const container = document.getElementById('impact-graph-container')
  const select = document.getElementById('impact-graph-shipment')
  if (!container || !select) return
  populateImpactGraphShipments()
  const shipmentId = select.value
  if (!shipmentId) {
    container.innerHTML = '<div class="impact-graph-empty">No backend shipments are available for impact analysis.</div>'
    return
  }
  if (!force && impactGraphState.renderedShipmentId === shipmentId && impactGraphState.impact) return
  const cached = backendDataState.impacts.find((impact) => impact.shipmentId === shipmentId)
  if (cached) {
    impactGraphState.impact = cached
    impactGraphState.renderedShipmentId = shipmentId
    buildImpactGraph(container, cached, { onSelect: openImpactGraphNode })
    return
  }
  if (impactGraphState.loading === shipmentId) return
  impactGraphState.loading = shipmentId
  container.innerHTML = '<div class="impact-graph-empty">Loading backend impact chain…</div>'
  try {
    const impact = await impactAnalysis(shipmentId)
    backendDataState.impacts.push(impact)
    impactGraphState.impact = impact
    impactGraphState.renderedShipmentId = shipmentId
    if (select.value === shipmentId) buildImpactGraph(container, impact, { onSelect: openImpactGraphNode })
  } catch (error) {
    impactGraphState.renderedShipmentId = ''
    container.innerHTML = `<div class="impact-graph-empty">${escapeHTML(error.message || 'Impact analysis is unavailable.')}</div>`
  } finally {
    if (impactGraphState.loading === shipmentId) impactGraphState.loading = ''
  }
}

function renderShipmentRisk() {
  const query = document.getElementById('shipment-risk-search').value.trim().toLowerCase()
  const risk = document.getElementById('shipment-risk-level').value
  const assessments = shipmentAssessments().filter((shipment) =>
    (!query || `${shipment.id} ${shipment.orderId} ${shipment.destination}`.toLowerCase().includes(query)) &&
    (risk === 'all' || shipment.riskLevel === risk),
  )
  document.getElementById('shipment-risk-table').innerHTML = assessments.map((shipment) => `<tr>
    <td><button class="analyst-table-link" data-open-type="shipment" data-open-id="${escapeHTML(shipment.id)}">${escapeHTML(shipment.id)}<small>${escapeHTML(shipment.orderId)} · ${escapeHTML(shipment.destination)}</small></button></td>
    <td><span class="analyst-status-badge" data-status="${escapeHTML(shipment.riskLevel)}">${shipment.riskScore}/100 · ${titleCase(shipment.riskLevel)}</span></td>
    <td>${escapeHTML(shipment.factors.join(' '))}</td>
    <td>Current rule-based estimate<small>No historical assessment record available</small></td>
    <td><button data-open-type="shipment" data-open-id="${escapeHTML(shipment.id)}">Inspect</button></td>
  </tr>`).join('') || '<tr><td colspan="5" class="analyst-table-empty">No assessments match these filters.</td></tr>'
}

function renderInventoryImpact() {
  const query = document.getElementById('inventory-impact-search').value.trim().toLowerCase()
  const filter = document.getElementById('inventory-impact-filter').value
  const impacts = currentInventoryImpacts().filter((product) =>
    (!query || `${product.productName} ${product.sku} ${product.supplier}`.toLowerCase().includes(query)) &&
    (filter === 'all' || (filter === 'shortage' ? product.shortage > 0 : product.available <= product.reorderThreshold)),
  )
  document.getElementById('inventory-impact-table').innerHTML = impacts.map((product) => `<tr>
    <td><button class="analyst-table-link" data-open-type="inventory" data-open-id="${escapeHTML(product.productId)}">${escapeHTML(product.productName)}<small>${escapeHTML(product.sku)}</small></button></td>
    <td>${formatNumber(product.quantity)} ${escapeHTML(product.unit)}</td><td>${formatNumber(product.reserved)} ${escapeHTML(product.unit)}</td>
    <td>${formatNumber(product.available)} ${escapeHTML(product.unit)}</td><td>${formatNumber(product.required)} ${escapeHTML(product.unit)}</td>
    <td>${product.shortage ? `${formatNumber(product.shortage)} ${escapeHTML(product.unit)}` : '—'}</td>
    <td>${product.otherWarehouseAvailability ? formatNumber(product.otherWarehouseAvailability) : 'None recorded'}</td><td>${escapeHTML(product.supplier)}</td>
  </tr>`).join('') || '<tr><td colspan="8" class="analyst-table-empty">No inventory impact records match these filters.</td></tr>'
}

function renderAIInsights() {
  const assessments = shipmentAssessments()
    .filter((shipment) => shipment.riskLevel !== 'low' || shipment.linkedAlerts.length)
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 8)
  hydrateAiExplanations(assessments)
  const availability = aiState.available === true
    ? `AI service reachable. ${aiState.message}`
    : aiState.available === false
      ? `AI explanations are unavailable; deterministic backend explanations are shown. ${aiState.message}`
      : aiState.message || 'Checking AI service availability…'
  const rows = assessments.map((shipment) => {
    const insight = buildRiskExplanation(shipment)
    const explanations = [...(aiState.explanations.get(shipment.id) || [])]
      .sort((left, right) => Number(right.riskScore) - Number(left.riskScore))
    const top = explanations[0]
    const label = top
      ? top.aiAvailable ? 'AI explanation' : 'Backend deterministic explanation'
      : 'Backend rule-based estimate'
    return `<article class="analyst-attention-row"><span class="analyst-severity-mark" data-severity="${shipment.riskLevel === 'high' ? 'critical' : shipment.riskLevel}"></span><div><strong>${escapeHTML(shipment.id)} · ${escapeHTML(shipment.orderId)} · ${shipment.riskScore}/100</strong><p>${escapeHTML(top?.explanation || insight.explanation)}</p><small>${escapeHTML(label)} · ${escapeHTML(shipment.factors.join(' '))}</small><p><strong>Suggested review:</strong> ${escapeHTML(insight.recommendation)}</p></div><button data-open-type="shipment" data-open-id="${escapeHTML(shipment.id)}">Inspect evidence</button></article>`
  }).join('')
  document.getElementById('analyst-ai-insights-list').innerHTML = `<p class="analyst-info-banner">${escapeHTML(availability)}</p>${rows || '<p class="analyst-table-empty">No elevated risk indicators are present in the supplied records.</p>'}`
}

function populateRecoverySelectors() {
  const options = activeAlerts().map((alert) => `<option value="${escapeHTML(alert.id)}">${escapeHTML(alert.id)} · ${escapeHTML(alert.title)}</option>`).join('')
  for (const id of ['recovery-disruption', 'simulation-disruption']) {
    const select = document.getElementById(id)
    const previous = select.value
    select.innerHTML = options || '<option value="">No active disruptions available</option>'
    select.disabled = !options
    if (options && [...select.options].some((option) => option.value === previous)) select.value = previous
  }
}

function selectedDisruptionSummary(id) {
  return disruptionAssessments().find((item) => item.id === id)
}

function renderRecoveryPlanContext() {
  populateRecoverySelectors()
  const selector = document.getElementById('recovery-disruption')
  const alert = state.alerts.find((item) => item.id === selector.value)
  const context = document.getElementById('recovery-plan-context')
  const form = document.getElementById('recovery-plan-form')
  const submit = form.querySelector('button[type="submit"]')
  if (!alert) {
    context.textContent = 'No active disruption is available for a recovery plan.'
    submit.disabled = true
    return
  }
  const assessment = selectedDisruptionSummary(alert.id)
  const existing = analystPlans().find((plan) => plan.disruptionId === alert.id && plan.approval_status === 'modification_requested')
  const activePlan = analystPlans().find((plan) => plan.disruptionId === alert.id && ['pending', 'approved'].includes(plan.approval_status))
  const scenarios = simulateRecoveryOptions(assessment, currentInventoryImpacts())
  const scenario = scenarios.find((item) => item.feasible)
  if (existing && form.dataset.loadedPlanId !== existing.id) {
    const normalizedStrategy = existing.strategy.toLowerCase().includes('supplier')
      ? 'Request alternative supplier replenishment'
      : existing.strategy.toLowerCase().includes('warehouse')
        ? 'Reallocate inventory between warehouses'
        : 'Expedite or reroute shipment'
    form.elements.strategy.value = normalizedStrategy
    form.elements.requiredActions.value = (existing.requiredActions || scenario?.requiredActions || []).join('\n')
    form.elements.resources.value = (existing.resources || scenario?.resources || []).join('\n')
    form.elements.cost.value = existing.cost
    form.elements.recoveryDays.value = existing.recoveryDays
    form.elements.riskReduction.value = existing.riskReduction
    form.elements.requiresAdditionalExpenditure.checked = Boolean(existing.requiresAdditionalExpenditure)
    form.dataset.loadedPlanId = existing.id
  } else if (!existing) {
    delete form.dataset.loadedPlanId
  }
  if (!existing && scenario && submit.dataset.prefilledFor !== alert.id) {
    applyScenarioToPlan(scenario)
  }
  const transferUnavailable = form.elements.strategy.value.toLowerCase().includes('warehouse') &&
    !scenarios.find((item) => item.id === 'inventory-transfer')?.feasible
  context.textContent = `${assessment.orders.length} affected order(s) · ${assessment.shipments.length} linked shipment(s) · ${assessment.riskScore}/100 illustrative risk. ${existing ? `Modification requested: ${existing.comments?.[0]?.text || 'review manager feedback before resubmitting'}` : activePlan ? `${activePlan.id} is already ${activePlan.approval_status}; avoid creating a duplicate.` : 'Simulation estimates are not actual results.'}`
  if (transferUnavailable) context.textContent += ' A warehouse transfer cannot be proposed: no matching alternate warehouse stock is present in the backend data.'
  submit.disabled = Boolean(activePlan || transferUnavailable)
  submit.dataset.prefilledFor = alert.id
}

function applyScenarioToPlan(scenario) {
  const form = document.getElementById('recovery-plan-form')
  const strategy = scenario.id === 'inventory-transfer'
    ? 'Reallocate inventory between warehouses'
    : scenario.id === 'alternative-supplier'
      ? 'Request alternative supplier replenishment'
      : 'Expedite or reroute shipment'
  form.elements.strategy.value = strategy
  form.elements.requiredActions.value = scenario.requiredActions.join('\n')
  form.elements.resources.value = scenario.resources.join('\n') || 'Operations team'
  form.elements.cost.value = scenario.estimatedCost
  form.elements.recoveryDays.value = scenario.recoveryDays
  form.elements.riskReduction.value = Math.round(scenario.expectedRiskReduction)
}

function renderRecoveryPlanTable() {
  document.getElementById('analyst-plan-table').innerHTML = recoveryPlanRows(analystPlans())
}

function recoveryPlanRows(plans, emptyMessage = 'No recovery plans have been submitted.') {
  return plans.map((plan) => {
    const disruption = state.alerts.find((alert) => alert.id === plan.disruptionId)
    const actual = plan.actual
      ? `${escapeHTML(plan.actual.outcome)} · ${formatNumber(plan.actual.cost)} INR · ${plan.actual.recoveryDays} day(s)`
      : 'Not recorded'
    return `<tr>
      <td><button class="analyst-table-link" data-plan-detail-id="${escapeHTML(plan.id)}">${escapeHTML(plan.id)}<small>${escapeHTML(disruption?.title || plan.disruptionId)}</small></button></td>
      <td>${escapeHTML(plan.strategy)}</td><td><span class="analyst-status-badge" data-status="${escapeHTML(plan.approval_status)}">${titleCase(plan.approval_status)}</span></td>
      <td><span class="analyst-status-badge" data-status="${escapeHTML(plan.execution_status)}">${titleCase(plan.execution_status)}</span><small>${titleCase(plan.execution_authorisation_status)}</small></td>
      <td>${formatNumber(plan.simulation?.expectedCost ?? plan.cost)} INR<small>${plan.simulation?.expectedRecoveryDays ?? plan.recoveryDays} day(s) · simulation estimate</small></td>
      <td>${actual}</td><td><button data-workflow-plan-id="${escapeHTML(plan.id)}">Audit / details</button></td>
    </tr>`
  }).join('') || `<tr><td colspan="7" class="analyst-table-empty">${escapeHTML(emptyMessage)}</td></tr>`
}

function renderRecoveryPlanRegister() {
  const query = recoveryPlanFilters.query.toLowerCase()
  const allPlans = analystPlans()
  const plans = allPlans.filter((plan) => {
    const disruption = state.alerts.find((alert) => alert.id === plan.disruptionId)
    return (!query || `${plan.id} ${plan.disruptionId} ${disruption?.title || ''} ${plan.strategy}`.toLowerCase().includes(query)) &&
      (recoveryPlanFilters.approval === 'all' || plan.approval_status === recoveryPlanFilters.approval) &&
      (recoveryPlanFilters.execution === 'all' || plan.execution_status === recoveryPlanFilters.execution)
  }).sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
  document.getElementById('recovery-plans-result-count').textContent = `Showing ${plans.length} of ${allPlans.length} plans created by this analyst`
  document.getElementById('recovery-plans-table-body').innerHTML = recoveryPlanRows(plans, 'No recovery plans match these filters.')
}

function renderCustomers() {
  const query = customerFilters.query.toLowerCase()
  const regions = [...new Set(state.customers.map((customer) => customer.region).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const regionSelect = document.getElementById('customer-region-filter')
  const selectedRegion = customerFilters.region
  regionSelect.innerHTML = `<option value="all">All regions</option>${regions.map((region) => `<option value="${escapeHTML(region)}">${escapeHTML(region)}</option>`).join('')}`
  regionSelect.value = regions.includes(selectedRegion) ? selectedRegion : 'all'
  customerFilters.region = regionSelect.value

  const customers = state.customers.filter((customer) =>
    (!query || `${customer.customerId} ${customer.name} ${customer.email} ${customer.phone} ${customer.region}`.toLowerCase().includes(query)) &&
    (customerFilters.status === 'all' || customer.status === customerFilters.status) &&
    (customerFilters.region === 'all' || customer.region === customerFilters.region),
  ).sort((left, right) => left.name.localeCompare(right.name))
  const activeCount = state.customers.filter((customer) => customer.status === 'active').length
  const linkedOrders = new Set(state.customers.flatMap((customer) => customer.orderIds || []))
  document.getElementById('customer-kpis').innerHTML = [
    ['Customer records', state.customers.length],
    ['Active accounts', activeCount],
    ['Inactive accounts', state.customers.length - activeCount],
    ['Linked order references', linkedOrders.size],
  ].map(([label, value]) => `<article class="analyst-module-kpi"><span>${escapeHTML(label)}</span><strong>${formatNumber(value)}</strong></article>`).join('')
  document.getElementById('customer-result-count').textContent = state.customers.length
    ? `Showing ${customers.length} of ${state.customers.length} customer records`
    : 'No customer master records imported'
  document.getElementById('customer-table-body').innerHTML = customers.map((customer) => {
    const orderIds = customer.orderIds || []
    const orderLinks = orderIds.map((orderId) => {
      const shipment = state.shipments.find((item) => item.orderId === orderId)
      return shipment
        ? `<button class="analyst-table-link" data-open-type="shipment" data-open-id="${escapeHTML(shipment.id)}">${escapeHTML(orderId)}</button>`
        : `<span>${escapeHTML(orderId)}</span>`
    }).join(', ')
    return `<tr>
      <td><strong>${escapeHTML(customer.name)}</strong><small>${escapeHTML(customer.customerId)}</small></td>
      <td>${escapeHTML(customer.region || '—')}</td>
      <td>${customer.email ? escapeHTML(customer.email) : '—'}<small>${escapeHTML(customer.phone || 'No phone recorded')}</small></td>
      <td>${orderLinks || 'None linked'}</td>
      <td><span class="analyst-status-badge" data-status="${escapeHTML(customer.status)}">${titleCase(customer.status)}</span></td>
    </tr>`
  }).join('') || (state.customers.length
    ? '<tr><td colspan="5" class="analyst-table-empty">No customers match these filters.</td></tr>'
    : '<tr><td colspan="5" class="analyst-table-empty">No customer records are available. <a href="#data-import">Import a customer CSV to populate this directory.</a></td></tr>')
}

function renderProductDirectory() {
  const query = productDirectoryFilters.query.toLowerCase()
  const products = state.inventory.filter((product) =>
    (!query || `${product.productId} ${product.productName} ${product.sku} ${product.supplier}`.toLowerCase().includes(query)) &&
    (productDirectoryFilters.status === 'all' || stockStatus(product) === productDirectoryFilters.status),
  ).sort((left, right) => left.productName.localeCompare(right.productName))
  document.getElementById('product-directory-count').textContent = `Showing ${products.length} of ${state.inventory.length} shared inventory products`
  document.getElementById('product-directory-body').innerHTML = products.map((product) => `<tr>
    <td><strong>${escapeHTML(product.productName)}</strong><small>${escapeHTML(product.productId)} · ${escapeHTML(product.sku)}</small></td>
    <td>${escapeHTML(product.category)}</td><td>${escapeHTML(product.supplier)}</td>
    <td>${formatNumber(product.quantity)} ${escapeHTML(product.unit)}</td><td>${formatNumber(product.reserved)} ${escapeHTML(product.unit)}</td>
    <td>${formatNumber(availableStock(product))} ${escapeHTML(product.unit)}</td><td>${escapeHTML(product.warehouse)}</td>
    <td><span class="analyst-status-badge" data-status="${stockStatus(product)}">${titleCase(stockStatus(product))}</span></td>
    <td><button class="analyst-table-link" data-open-type="inventory" data-open-id="${escapeHTML(product.productId)}">Details</button></td>
  </tr>`).join('') || '<tr><td colspan="9" class="analyst-table-empty">No products match these filters.</td></tr>'
}

function renderSupplierDirectory() {
  const query = supplierDirectoryFilters.query.toLowerCase()
  const grouped = new Map()
  state.inventory.forEach((product) => {
    const supplier = product.supplier || 'Supplier not recorded'
    if (!grouped.has(supplier)) grouped.set(supplier, [])
    grouped.get(supplier).push(product)
  })
  const suppliers = [...grouped.entries()]
    .map(([name, products]) => ({
      name,
      products,
      belowThreshold: products.filter((product) => availableStock(product) <= product.reorderThreshold).length,
    }))
    .filter((supplier) => !query || `${supplier.name} ${supplier.products.map((product) => `${product.productName} ${product.sku}`).join(' ')}`.toLowerCase().includes(query))
    .sort((left, right) => left.name.localeCompare(right.name))
  document.getElementById('supplier-result-count').textContent = `Showing ${suppliers.length} of ${grouped.size} suppliers derived from product records`
  document.getElementById('supplier-table-body').innerHTML = suppliers.map((supplier) => `<tr>
    <td><strong>${escapeHTML(supplier.name)}</strong></td><td>${supplier.products.length}</td>
    <td>${escapeHTML(availableStockByUnit(supplier.products))}</td><td>${supplier.belowThreshold}</td>
    <td>${supplier.products.map((product) => `<button class="analyst-table-link" data-open-type="inventory" data-open-id="${escapeHTML(product.productId)}">${escapeHTML(product.productId)}</button>`).join(', ')}</td>
  </tr>`).join('') || '<tr><td colspan="5" class="analyst-table-empty">No suppliers match this search.</td></tr>'
}

function renderWarehouseDirectory() {
  const query = warehouseDirectoryFilters.query.toLowerCase()
  const grouped = new Map()
  state.inventory.forEach((product) => {
    const warehouse = product.warehouse || 'Warehouse not recorded'
    if (!grouped.has(warehouse)) grouped.set(warehouse, [])
    grouped.get(warehouse).push(product)
  })
  const warehouses = [...grouped.entries()]
    .map(([id, products]) => ({
      id,
      products,
    }))
    .filter((warehouse) => !query || `${warehouse.id} ${warehouse.id === warehouseSummary.warehouseId ? warehouseSummary.warehouseName : ''} ${warehouse.products.map((product) => product.location).join(' ')}`.toLowerCase().includes(query))
    .sort((left, right) => left.id.localeCompare(right.id))
  document.getElementById('warehouse-directory-count').textContent = `Showing ${warehouses.length} of ${grouped.size} warehouses represented in inventory`
  document.getElementById('warehouse-directory-body').innerHTML = warehouses.map((warehouse) => {
    const knownWarehouse = warehouse.id === warehouseSummary.warehouseId
    const capacity = knownWarehouse
      ? `${warehouseSummary.occupiedLocations} / ${warehouseSummary.totalLocations} locations · ${Math.round(warehouseSummary.occupiedLocations / warehouseSummary.totalLocations * 100)}%`
      : 'Not recorded'
    const warehouseLabel = knownWarehouse ? warehouseSummary.warehouseName : warehouse.id
    const warehouseButton = knownWarehouse
      ? `<button class="analyst-table-link" data-open-type="warehouse" data-open-id="${escapeHTML(warehouse.id)}">${escapeHTML(warehouse.id)}</button>`
      : escapeHTML(warehouse.id)
    return `<tr><td><strong>${warehouseButton}</strong><small>${escapeHTML(warehouseLabel)}</small></td><td>${warehouse.products.length}</td><td>${escapeHTML(availableStockByUnit(warehouse.products))}</td><td>${capacity}</td><td>${warehouse.products.map((product) => escapeHTML(product.location)).join(', ') || 'No locations recorded'}</td></tr>`
  }).join('') || '<tr><td colspan="5" class="analyst-table-empty">No warehouses match this search.</td></tr>'
}

function renderOrderDirectory() {
  const query = orderDirectoryFilters.query.toLowerCase()
  const grouped = new Map()
  state.shipments.forEach((shipment) => {
    if (!grouped.has(shipment.orderId)) grouped.set(shipment.orderId, [])
    grouped.get(shipment.orderId).push(shipment)
  })
  const orders = [...grouped.entries()]
    .map(([id, shipmentsForOrder]) => ({
      id,
      shipments: shipmentsForOrder,
      destination: [...new Set(shipmentsForOrder.map((shipment) => shipment.destination).filter(Boolean))].join(', ') || 'Not recorded',
      expectedDate: shipmentsForOrder.map((shipment) => shipment.expectedDate).filter(Boolean).sort().slice(-1)[0] || '',
      priority: shipmentsForOrder.some((shipment) => shipment.priority === 'critical')
        ? 'critical'
        : shipmentsForOrder.some((shipment) => shipment.priority === 'high') ? 'high' : 'normal',
      statuses: [...new Set(shipmentsForOrder.map((shipment) => shipment.status))],
    }))
    .filter((order) =>
      (!query || `${order.id} ${order.destination} ${order.shipments.map((shipment) => shipment.id).join(' ')}`.toLowerCase().includes(query)) &&
      (orderDirectoryFilters.status === 'all' || order.shipments.some((shipment) => shipment.status === orderDirectoryFilters.status)),
    )
    .sort((left, right) => left.id.localeCompare(right.id))
  document.getElementById('order-directory-count').textContent = `Showing ${orders.length} of ${grouped.size} orders derived from shipment records`
  document.getElementById('order-directory-body').innerHTML = orders.map((order) => {
    const firstShipment = order.shipments[0]
    return `<tr>
      <td><button class="analyst-table-link" data-open-type="shipment" data-open-id="${escapeHTML(firstShipment.id)}">${escapeHTML(order.id)}</button></td>
      <td>${escapeHTML(order.destination)}</td>
      <td>${order.shipments.map((shipment) => `<button class="analyst-table-link" data-open-type="shipment" data-open-id="${escapeHTML(shipment.id)}">${escapeHTML(shipment.id)}</button>`).join(', ')}</td>
      <td>${titleCase(order.priority)}</td><td>${formatDate(order.expectedDate)}</td>
      <td>${order.statuses.map((status) => `<span class="analyst-status-badge" data-status="${escapeHTML(status)}">${titleCase(status)}</span>`).join(' ')}</td>
    </tr>`
  }).join('') || '<tr><td colspan="6" class="analyst-table-empty">No orders match these filters.</td></tr>'
}

function parseCustomerCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  let afterQuote = false
  const pushField = () => {
    row.push(field)
    field = ''
    afterQuote = false
  }
  const pushRow = () => {
    pushField()
    if (row.some((value) => value.trim())) rows.push(row)
    row = []
  }
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
        afterQuote = true
      } else {
        field += character
      }
      continue
    }
    if (afterQuote) {
      if (character === ',') pushField()
      else if (character === '\n' || character === '\r') {
        pushRow()
        if (character === '\r' && text[index + 1] === '\n') index += 1
      } else if (!/\s/.test(character)) {
        throw new Error(`Unexpected character after a quoted CSV value at position ${index + 1}.`)
      }
      continue
    }
    if (character === '"' && !field.length) quoted = true
    else if (character === '"') throw new Error(`Unexpected quote in an unquoted CSV value at position ${index + 1}.`)
    else if (character === ',') pushField()
    else if (character === '\n' || character === '\r') {
      pushRow()
      if (character === '\r' && text[index + 1] === '\n') index += 1
    } else field += character
  }
  if (quoted) throw new Error('The CSV file ends inside a quoted value.')
  if (field.length || row.length || afterQuote) pushRow()
  if (!rows.length) throw new Error('The CSV file is empty.')

  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase())
  const requiredHeaders = ['customerid', 'name']
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header))
  if (missingHeaders.length) throw new Error(`Missing required column(s): ${missingHeaders.join(', ')}.`)
  const indexFor = (header) => headers.indexOf(header)
  const seenIds = new Set()
  const accepted = []
  const errors = []
  rows.forEach((values, rowIndex) => {
    const line = rowIndex + 2
    const value = (header) => {
      const column = indexFor(header)
      return column < 0 ? '' : String(values[column] || '').trim()
    }
    const customerId = value('customerid')
    const name = value('name')
    const email = value('email')
    const phone = value('phone')
    const region = value('region')
    const status = (value('status') || 'active').toLowerCase()
    const normalizedId = customerId.toLowerCase()
    let message = ''
    if (values.length > headers.length) message = 'This row contains more values than the header defines.'
    else if (!customerId || !name) message = 'Customer ID and name are required.'
    else if (customerId.length > 80 || name.length > 160) message = 'Customer ID must be at most 80 characters and name at most 160 characters.'
    else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) message = 'Email address is not valid.'
    else if (phone.length > 60 || region.length > 100) message = 'Phone must be at most 60 characters and region at most 100 characters.'
    else if (!['active', 'inactive'].includes(status)) message = 'Status must be active or inactive.'
    else if (seenIds.has(normalizedId)) message = `Duplicate customer ID "${customerId}" in this file.`
    if (message) {
      errors.push({ line, message })
      return
    }
    seenIds.add(normalizedId)
    accepted.push({
      customerId,
      name,
      email,
      phone,
      region,
      status,
      orderIds: [...new Set(value('orderids').split(';').map((orderId) => orderId.trim()).filter(Boolean))],
    })
  })
  return { accepted, errors }
}

function customerImportFile(customers) {
  const escapeField = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const content = [['id', 'name', 'email'], ...customers.map((customer) => [customer.customerId, customer.name, customer.email])]
    .map((row) => row.map(escapeField).join(','))
    .join('\r\n')
  return new File([content], 'customers-import.csv', { type: 'text/csv;charset=utf-8' })
}

function renderCustomerImportPreview() {
  const errors = pendingCustomerImportErrors
  document.getElementById('customer-import-errors').innerHTML = errors.length
    ? `<strong>${errors.length} row(s) need attention:</strong><ul>${errors.map((error) => `<li>Row ${error.line}: ${escapeHTML(error.message)}</li>`).join('')}</ul>`
    : ''
  document.getElementById('customer-import-preview').innerHTML = pendingCustomerImport.map((customer) => `<tr>
    <td>${escapeHTML(customer.customerId)}</td><td>${escapeHTML(customer.name)}</td><td>${escapeHTML(customer.email || '—')}</td>
    <td>${escapeHTML(customer.region || '—')}</td><td>${escapeHTML(customer.orderIds.join(', ') || '—')}</td><td>${titleCase(customer.status)}</td>
  </tr>`).join('') || `<tr><td colspan="6" class="analyst-table-empty">${errors.length ? 'No valid customer rows to import.' : 'Choose a CSV file to validate and preview customer records.'}</td></tr>`
  document.getElementById('customer-import-apply').disabled = pendingCustomerImport.length === 0
}

function exportCustomers() {
  const rows = [['Customer ID', 'Name', 'Email', 'Phone', 'Region', 'Status', 'Order IDs']]
  state.customers.forEach((customer) => rows.push([
    customer.customerId, customer.name, customer.email, customer.phone, customer.region,
    titleCase(customer.status), (customer.orderIds || []).join(';'),
  ]))
  downloadCSV('disruptioniq-customers.csv', rows)
  recordActivity('Customer directory exported', `${state.customers.length} customer record(s) exported.`, 'customers')
  persist()
  renderActivity()
}

function taskStatus(value) {
  const status = String(value || '').toUpperCase()
  if (status === 'COMPLETED') return 'completed'
  if (status === 'BLOCKED') return 'blocked'
  if (status === 'IN_PROGRESS') return 'in_progress'
  return 'pending'
}

function renderRecoveryTracking() {
  const stateSnapshot = getWorkflowState()
  const actor = getCurrentActor()
  const plans = stateSnapshot.plans.filter((plan) =>
    plan.createdByUserId === actor.id && ['approved', 'executed'].includes(plan.approval_status))
  const list = document.getElementById('analyst-recovery-tracking-list')
  list.innerHTML = plans.map((plan) => {
    hydrateProgressForPlan(plan)
    const history = [...(progressState.get(plan.id) || [])]
      .sort((left, right) => new Date(left.updatedAt || 0) - new Date(right.updatedAt || 0))
    const latest = history[history.length - 1]
    const tasks = history.length
      ? history.map((entry) => ({
        id: entry.id,
        title: entry.milestone || 'Progress update',
        team: entry.shipmentId ? `Shipment ${entry.shipmentId}` : 'Execution team',
        assignedRole: entry.updatedBy || 'Backend',
        dueAt: entry.updatedAt,
        status: taskStatus(entry.status),
        updatedBy: entry.updatedBy,
        updatedAt: entry.updatedAt,
        blocker: entry.blocker,
      }))
      : plan.tasks
    const completed = tasks.filter((task) => task.status === 'completed').length
    const total = tasks.length
    const progress = latest
      ? Math.max(0, Math.min(100, Number(latest.completionPercentage || 0)))
      : total ? Math.round(completed / total * 100) : 0
    const disruption = state.alerts.find((item) => item.id === plan.disruptionId)
    const taskRows = tasks.map((task) => `<li><strong>${escapeHTML(task.title)}</strong><span>${escapeHTML(task.team)} · ${escapeHTML(task.assignedRole)}${task.dueAt ? ` · due ${formatDate(task.dueAt)}` : ''}</span><span class="analyst-status-badge" data-status="${escapeHTML(task.status)}">${titleCase(task.status)}</span>${task.updatedBy ? `<small>Updated by ${escapeHTML(task.updatedBy)} · ${formatDateTime(task.updatedAt)}${task.blocker ? ` · Blocker: ${escapeHTML(task.blocker)}` : ''}</small>` : '<small>Awaiting execution-team update</small>'}</li>`).join('')
    const blockers = tasks.filter((task) => ['pending', 'blocked'].includes(task.status))
    const backendProgress = latest
      ? `Backend progress: ${titleCase(latest.status)}${latest.notes ? ` · ${escapeHTML(latest.notes)}` : ''}`
      : 'No backend progress update recorded.'
    return `<article class="analyst-attention-row analyst-tracking-card"><div><strong>${escapeHTML(plan.id)} · ${escapeHTML(disruption?.title || plan.disruptionId)}</strong><p>${escapeHTML(plan.strategy)} · approval ${titleCase(plan.approval_status)} · execution ${titleCase(plan.execution_status)} · authorization ${titleCase(plan.execution_authorisation_status)}</p><div class="analyst-progress" role="progressbar" aria-label="Execution task completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><small>${completed} of ${total} tasks completed${blockers.length ? ` · ${blockers.length} pending or blocked action(s)` : ''}</small><p>${backendProgress}</p><ul class="analyst-task-list">${taskRows || '<li>Approved; execution authorization has not been recorded and no tasks have been created.</li>'}</ul></div></article>`
  }).join('') || '<p class="analyst-table-empty">No approved recovery plans are available for tracking.</p>'
}

function simulationTag(scenario) {
  if (scenario.backend?.error) return 'Backend simulation unavailable'
  if (!scenario.backend) return scenario.feasible ? 'Feasible to review' : 'Not feasible from current records'
  const feasibility = String(scenario.backend.feasibility || '').toUpperCase()
  if (feasibility === 'FEASIBLE') return 'Backend: feasible'
  if (feasibility === 'INFEASIBLE') return 'Backend: infeasible'
  return 'Backend: needs more data'
}

function renderSimulation() {
  populateRecoverySelectors()
  const disruptionId = document.getElementById('simulation-disruption').value
  const assessment = selectedDisruptionSummary(disruptionId)
  const results = document.getElementById('simulation-results')
  if (assessment) hydrateSimulation(disruptionId)
  const scenarios = currentScenarios(disruptionId)
  const backend = backendSimulationState.byDisruption.get(disruptionId)
  const recommendation = backend?.recommendation
  const recommendationCard = recommendation
    ? `<article class="analyst-simulation-card"><div><span class="analyst-report-tag">${recommendation.aiAvailable ? 'AI advisory' : 'Deterministic advisory'}</span><h3>Backend recommendation</h3></div><p><strong>${escapeHTML(recommendation.recommendedOption || 'No option recommended')}</strong></p><p>${escapeHTML(recommendation.reasoning || '')}</p>${(recommendation.tradeoffs || []).length ? `<p><strong>Tradeoffs:</strong> ${escapeHTML(recommendation.tradeoffs.join('; '))}</p>` : ''}<small>Advisory only; a manager still approves and authorizes the recovery plan.</small></article>`
    : ''
  const statusNote = backendSimulationState.pending.has(disruptionId)
    ? '<p class="analyst-table-empty">Running backend simulation and advisory recommendation…</p>'
    : backend?.error
      ? `<p class="analyst-table-empty">Backend simulation is unavailable: ${escapeHTML(backend.error)}</p>`
      : ''
  const scenarioCards = scenarios.map((scenario) => {
    const response = scenario.backend && !scenario.backend.error ? scenario.backend : null
    const warnings = response?.warnings || []
    return `<article class="analyst-simulation-card">
    <div><span class="analyst-report-tag">${escapeHTML(simulationTag(scenario))}</span><h3>${escapeHTML(scenario.strategy)}</h3></div>
    <p>${escapeHTML(scenario.basis)}</p><p>${escapeHTML(scenario.costBasis)}</p>
    ${response ? `<p><strong>Backend result:</strong> ${escapeHTML(response.message || '')}</p>` : ''}
    <dl><div><dt>Estimated cost</dt><dd>${formatNumber(scenario.estimatedCost)} INR</dd></div><div><dt>Recovery time</dt><dd>${scenario.recoveryDays} day(s)</dd></div><div><dt>Risk reduction</dt><dd>${Math.round(scenario.expectedRiskReduction)}% estimated</dd></div><div><dt>Affected orders</dt><dd>${scenario.affectedOrders}</dd></div>${response ? `<div><dt>Residual risk</dt><dd>${response.residualRiskScore}/100 · ${titleCase(response.residualRiskLevel)}</dd></div><div><dt>Units recovered</dt><dd>${formatNumber(response.unitsRecovered)}</dd></div><div><dt>Projected shortage</dt><dd>${formatNumber(response.projectedShortage)}</dd></div>` : ''}</dl>
    <p><strong>Required actions:</strong> ${escapeHTML(scenario.requiredActions.join('; '))}</p><p><strong>Resources:</strong> ${escapeHTML(scenario.resources.join(', ') || 'Not listed')}</p>
    ${warnings.length ? `<p><strong>Backend warnings:</strong> ${escapeHTML(warnings.join('; '))}</p>` : ''}
    <div class="analyst-row-actions"><button data-save-simulation="${escapeHTML(scenario.id)}">Save scenario</button>${scenario.feasible ? `<button data-use-simulation="${escapeHTML(scenario.id)}">Use in recovery plan</button>` : ''}</div>
  </article>`
  }).join('') || '<p class="analyst-table-empty">Select an active disruption to compare scenarios.</p>'
  results.innerHTML = `${recommendationCard}${statusNote}${scenarioCards}`
  const saved = savedSimulations()
  document.getElementById('simulation-saved-table').innerHTML = saved.map((scenario) => `<tr><td>${formatDateTime(scenario.savedAt)}</td><td>${escapeHTML(scenario.disruptionId)}</td><td>${escapeHTML(scenario.strategy)}</td><td>${formatNumber(scenario.estimatedCost)} INR</td><td>${scenario.recoveryDays} day(s)</td><td>${Math.round(scenario.expectedRiskReduction)}% · estimated</td></tr>`).join('') || '<tr><td colspan="6" class="analyst-table-empty">No saved scenarios.</td></tr>'
}

function showPlanDetails(planId) {
  const snapshot = getWorkflowState()
  const plan = snapshot.plans.find((item) => item.id === planId)
  if (!plan) return
  const audit = snapshot.audit.filter((item) => item.planId === planId)
  const disruption = state.alerts.find((item) => item.id === plan.disruptionId)
  const extra = document.getElementById('analyst-detail-extra')
  setText('analyst-object-title', `Recovery plan ${plan.id}`)
  setText('analyst-object-type', 'Shared recovery plan · read-only')
  setText('analyst-object-id', plan.id)
  setText('analyst-object-product', disruption?.title || plan.disruptionId)
  setText('analyst-object-product-id', plan.strategy)
  setText('analyst-object-quantity', `${formatNumber(plan.cost)} INR · ${plan.recoveryDays} estimated day(s)`)
  setText('analyst-object-status', `${titleCase(plan.approval_status)} · ${titleCase(plan.execution_status)}`)
  setText('analyst-object-location', 'Shared workflow')
  setText('analyst-object-note', 'Simulation estimates and actual execution results are displayed separately. This analyst view cannot change approvals or execution progress.')
  extra.innerHTML = `<h3>Actions and resources</h3><p>${escapeHTML((plan.requiredActions || []).join('; ') || 'Not provided')}</p><p>${escapeHTML((plan.resources || []).join('; ') || 'Not provided')}</p><h3>Required approvals</h3><p>${escapeHTML((plan.requiredApprovals || []).map((approval) => `${approval.label}: ${approval.status} (${approval.role})`).join('; ') || 'None recorded')}</p><h3>Plan audit</h3>${audit.map((entry) => `<p>${escapeHTML(formatDateTime(entry.timestamp))} · ${escapeHTML(entry.user)} (${escapeHTML(entry.role)}) · ${escapeHTML(entry.action)} · ${escapeHTML(entry.previousStatus)} → ${escapeHTML(entry.newStatus)}${entry.comments ? ` · ${escapeHTML(entry.comments)}` : ''}</p>`).join('') || '<p>No audit events recorded.</p>'}`
  const actionButton = document.getElementById('analyst-object-action')
  actionButton.hidden = true
  detailPanel.hidden = false
  detailSection.hidden = false
}

function renderAttentionList() {
  const urgent = [...activeAlerts()].sort((left, right) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 }
    return rank[left.severity] - rank[right.severity]
  }).slice(0, 4)
  const container = document.getElementById('analyst-attention-list')
  container.innerHTML = urgent.map((alert) => `<article class="analyst-attention-row"><span class="analyst-severity-mark" data-severity="${escapeHTML(alert.severity)}"></span><div><strong>${escapeHTML(alert.title)}</strong><p>${escapeHTML(alert.description)}</p><small>${formatDateTime(alert.createdAt)} · ${escapeHTML(alert.relatedId)}</small></div><button data-open-type="alert" data-open-id="${escapeHTML(alert.id)}">View details</button></article>`).join('') || '<p class="analyst-table-empty">No open operational issues.</p>'
}

function renderChart(containerId, points, { valueKey = 'value', labelKey = 'label', type, idKey, max } = {}) {
  const container = document.getElementById(containerId)
  if (!container) return
  const highest = max ?? Math.max(1, ...points.map((point) => Number(point[valueKey]) || 0))
  container.innerHTML = points.map((point) => {
    const value = Number(point[valueKey]) || 0
    const width = Math.max(value > 0 ? 4 : 0, value / highest * 100)
    const recordId = point.id || (idKey ? point[idKey] : '')
    const recordLink = (point.type || type) === 'recovery'
      ? `data-plan-detail-id="${escapeHTML(recordId)}"`
      : `data-open-type="${escapeHTML(point.type || type || '')}" data-open-id="${escapeHTML(recordId)}"`
    return `<button class="analyst-chart-point" type="button" ${recordLink} aria-label="${escapeHTML(point[labelKey])}: ${formatNumber(value)}"><span>${escapeHTML(point[labelKey])}</span><b><i style="width:${width}%"></i></b><strong>${formatNumber(value)}</strong></button>`
  }).join('') || '<p class="analyst-table-empty">No data for this period.</p>'
}

function renderOverviewCharts() {
  const inventoryInRange = state.inventory.filter((product) =>
    isInRange(product.updatedAt, overviewState.period, overviewState.from, overviewState.to),
  )
  const shipmentsInRange = state.shipments.filter((shipment) =>
    isInRange(shipment.dispatchDate, overviewState.period, overviewState.from, overviewState.to),
  )
  const inventoryStatuses = ['in-stock', 'low-stock', 'out-of-stock'].map((status) => ({
    label: titleCase(status),
    value: inventoryInRange.filter((product) => stockStatus(product) === status).length,
    type: 'inventory',
    id: inventoryInRange.find((product) => stockStatus(product) === status)?.productId || '',
  }))
  const shipmentStatuses = ['in-transit', 'delayed', 'delivered'].map((status) => ({
    label: titleCase(status),
    value: shipmentsInRange.filter((shipment) => shipment.status === status).length,
    type: 'shipment',
    id: shipmentsInRange.find((shipment) => shipment.status === status)?.id || '',
  }))
  renderChart('overview-inventory-chart', inventoryStatuses)
  renderChart('overview-shipment-chart', shipmentStatuses)
}

const reportState = { type: 'overview', period: 'week', category: 'all', warehouse: 'all', from: '', to: '' }
const overviewState = { period: 'week', from: '', to: '' }

function dateBounds(period, from, to) {
  if (period === 'custom') return { from: from || '', to: to || '' }
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  if (period === 'day') start.setHours(0, 0, 0, 0)
  else if (period === 'week') {
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  }
  return { from: localDateKey(start), to: localDateKey(end) }
}

function isInRange(value, period, fromValue, toValue) {
  const { from, to } = dateBounds(period, fromValue, toValue)
  const date = String(value || '').slice(0, 10)
  return (!from || date >= from) && (!to || date <= to)
}

function inReportRange(value) {
  return isInRange(value, reportState.period, reportState.from, reportState.to)
}

function previousDateRange() {
  const { from, to } = dateBounds(reportState.period, reportState.from, reportState.to)
  if (!from || !to) return null
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  const duration = Math.max(1, Math.round((end - start) / 86400000) + 1)
  const previousEnd = new Date(start - 86400000).toISOString().slice(0, 10)
  const previousStart = new Date(start - duration * 86400000).toISOString().slice(0, 10)
  return { from: previousStart, to: previousEnd }
}

function renderReports() {
  const inventory = state.inventory.filter((product) =>
    (reportState.category === 'all' || product.category === reportState.category) &&
    (reportState.warehouse === 'all' || product.warehouse === reportState.warehouse) &&
    inReportRange(product.updatedAt),
  )
  const shipmentsInRange = state.shipments.filter((shipment) => inReportRange(shipment.dispatchDate))
  const alertsInRange = state.alerts.filter((alert) => inReportRange(alert.createdAt))
  const movementRecords = state.inventory.flatMap((product) => product.movements.map((movement) => ({ ...movement, productId: product.productId, productName: product.productName }))).filter((movement) => inReportRange(movement.date))
  const inventoryCounts = ['in-stock', 'low-stock', 'out-of-stock'].map((status) => ({
    label: titleCase(status), value: inventory.filter((product) => stockStatus(product) === status).length,
    type: 'inventory', id: inventory.find((product) => stockStatus(product) === status)?.productId || '',
  }))
  const shipmentCounts = ['pending-dispatch', 'in-transit', 'delayed', 'delivered', 'failed'].map((status) => ({
    label: titleCase(status), value: shipmentsInRange.filter((shipment) => shipment.status === status).length,
    type: 'shipment', id: shipmentsInRange.find((shipment) => shipment.status === status)?.id || '',
  }))
  const shipmentPerformance = [
    { label: 'On time / in transit', value: shipmentsInRange.filter((shipment) => ['pending-dispatch', 'in-transit'].includes(shipment.status)).length, type: 'shipment', id: shipmentsInRange.find((shipment) => ['pending-dispatch', 'in-transit'].includes(shipment.status))?.id || '' },
    { label: 'Delayed', value: shipmentsInRange.filter((shipment) => shipment.status === 'delayed').length, type: 'shipment', id: shipmentsInRange.find((shipment) => shipment.status === 'delayed')?.id || '' },
    { label: 'Delivered', value: shipmentsInRange.filter((shipment) => shipment.status === 'delivered').length, type: 'shipment', id: shipmentsInRange.find((shipment) => shipment.status === 'delivered')?.id || '' },
  ]
  const movementCounts = ['Received', 'Dispatched', 'Adjusted'].map((type) => ({
    label: type,
    value: movementRecords.filter((movement) => movement.type === type).reduce((sum, movement) => sum + Math.abs(movement.quantity), 0),
    type: 'inventory',
    id: movementRecords.find((movement) => movement.type === type)?.productId || '',
  }))
  const alertCounts = ['critical', 'high', 'medium', 'low'].map((severity) => ({
    label: titleCase(severity),
    value: alertsInRange.filter((alert) => alert.severity === severity && alert.status !== 'resolved').length,
    type: 'alert',
    id: alertsInRange.find((alert) => alert.severity === severity)?.id || '',
  }))
  const occupancy = warehouseSummary.occupiedLocations / warehouseSummary.totalLocations * 100
  const availableLocations = warehouseSummary.totalLocations - warehouseSummary.occupiedLocations
  const warehouseCounts = [
    { label: 'Occupied', value: warehouseSummary.occupiedLocations, type: 'warehouse', id: warehouseSummary.warehouseId },
    { label: 'Available', value: availableLocations, type: 'warehouse', id: warehouseSummary.warehouseId },
  ]
  const riskAssessments = shipmentAssessments().filter((shipment) => inReportRange(shipment.dispatchDate))
  const inventoryExposure = currentInventoryImpacts().filter((product) =>
    (reportState.category === 'all' || product.category === reportState.category) &&
    (reportState.warehouse === 'all' || product.warehouse === reportState.warehouse),
  )
  const recoveryPlans = analystPlans().filter((plan) => inReportRange(plan.createdAt))
  const riskCounts = ['high', 'medium', 'low'].map((level) => ({
    label: titleCase(level),
    value: riskAssessments.filter((shipment) => shipment.riskLevel === level).length,
    type: 'shipment',
    id: riskAssessments.find((shipment) => shipment.riskLevel === level)?.id || '',
  }))
  const approvalCounts = ['pending', 'approved', 'rejected', 'modification_requested'].map((status) => ({
    label: titleCase(status),
    value: recoveryPlans.filter((plan) => plan.approval_status === status).length,
    type: 'recovery',
    id: recoveryPlans.find((plan) => plan.approval_status === status)?.id || '',
  }))
  const executionCounts = ['not_started', 'in_progress', 'blocked', 'successful'].map((status) => ({
    label: titleCase(status),
    value: recoveryPlans.filter((plan) => plan.execution_status === status).length,
    type: 'recovery',
    id: recoveryPlans.find((plan) => plan.execution_status === status)?.id || '',
  }))
  const impactCounts = [
    { label: 'Shortage products', value: inventoryExposure.filter((product) => product.shortage > 0).length, type: 'inventory', id: inventoryExposure.find((product) => product.shortage > 0)?.productId || '' },
    { label: 'Below threshold', value: inventoryExposure.filter((product) => product.available <= product.reorderThreshold).length, type: 'inventory', id: inventoryExposure.find((product) => product.available <= product.reorderThreshold)?.productId || '' },
    { label: 'No shortage', value: inventoryExposure.filter((product) => product.shortage === 0).length, type: 'inventory', id: inventoryExposure.find((product) => product.shortage === 0)?.productId || '' },
  ]
  const reportCharts = {
    overview: [
      ['Inventory distribution', inventoryCounts],
      ['Warehouse utilisation', warehouseCounts],
      ['Shipment performance', shipmentPerformance],
      ['Inventory trends', movementCounts],
      ['Alert distribution', alertCounts],
    ],
    inventory: [
      ['Inventory distribution', inventoryCounts],
      ['Warehouse locations', warehouseCounts],
      ['Stock movement quantities', movementCounts],
      ['Low stock and shortages', inventoryCounts.slice(1)],
      ['Alert severity', alertCounts],
    ],
    warehouse: [
      ['Warehouse utilization', warehouseCounts],
      ['Inventory units by status', inventoryCounts],
      ['Warehouse shipments', shipmentPerformance],
      ['Warehouse alerts', alertCounts],
      ['Inventory trends', movementCounts],
    ],
    shipments: [
      ['Shipment performance', shipmentPerformance],
      ['Warehouse occupancy', warehouseCounts],
      ['Shipment outcomes', shipmentCounts.slice(2)],
      ['Products moved', movementCounts],
      ['Shipment incidents', alertCounts],
    ],
    alerts: [
      ['Alert distribution', alertCounts],
      ['Warehouse utilization', warehouseCounts],
      ['Incident workflow', ['open', 'acknowledged', 'investigating', 'resolved'].map((status) => ({ label: titleCase(status), value: state.alerts.filter((alert) => alert.status === status).length, type: 'alert', id: state.alerts.find((alert) => alert.status === status)?.id || '' }))],
      ['Related shipments', shipmentCounts],
      ['Inventory impact', inventoryCounts],
    ],
    orders: [
      ['Order risk levels', riskCounts],
      ['Shipment delivery status', shipmentPerformance],
      ['Recorded priorities', ['critical', 'high', 'normal'].map((priority) => ({ label: titleCase(priority), value: riskAssessments.filter((shipment) => shipment.priority === priority).length, type: 'shipment', id: riskAssessments.find((shipment) => shipment.priority === priority)?.id || '' }))],
      ['Estimated overdue days', ['1–2 days', '3+ days'].map((label, index) => ({ label, value: riskAssessments.filter((shipment) => shipment.delayDays >= (index ? 3 : 1) && shipment.delayDays <= (index ? Number.MAX_SAFE_INTEGER : 2)).length, type: 'shipment', id: riskAssessments.find((shipment) => shipment.delayDays >= (index ? 3 : 1))?.id || '' }))],
      ['Linked inventory risk', impactCounts],
    ],
    'inventory-impact': [
      ['Inventory exposure', impactCounts],
      ['Open-shipment required units', inventoryExposure.map((product) => ({ label: product.productName, value: product.required, type: 'inventory', id: product.productId }))],
      ['Available units', inventoryExposure.map((product) => ({ label: product.productName, value: product.available, type: 'inventory', id: product.productId }))],
      ['Calculated shortages', inventoryExposure.map((product) => ({ label: product.productName, value: product.shortage, type: 'inventory', id: product.productId }))],
      ['Warehouse availability', inventoryExposure.map((product) => ({ label: product.productName, value: product.otherWarehouseAvailability, type: 'inventory', id: product.productId }))],
    ],
    recovery: [
      ['Plan approval status', approvalCounts],
      ['Execution status', executionCounts],
      ['Simulation estimated cost (INR)', recoveryPlans.map((plan) => ({ label: plan.id, value: plan.simulation?.expectedCost ?? plan.cost, type: 'recovery', id: plan.id }))],
      ['Actual cost (INR) · recorded outcomes', recoveryPlans.filter((plan) => plan.actual).map((plan) => ({ label: plan.id, value: plan.actual.cost, type: 'recovery', id: plan.id }))],
      ['Execution task completion', recoveryPlans.map((plan) => ({ label: plan.id, value: plan.tasks.filter((task) => task.status === 'completed').length, type: 'recovery', id: plan.id }))],
    ],
  }[reportState.type]

  const titles = [
    ['report-chart-one-title', reportCharts[0][0]],
    ['report-chart-two-title', reportCharts[1][0]],
    ['report-chart-three-title', reportCharts[2][0]],
    ['report-chart-four-title', reportCharts[3][0]],
    ['report-chart-five-title', reportCharts[4][0]],
  ]
  titles.forEach(([id, title]) => setText(id, title))
  reportCharts.forEach(([, points], index) => renderChart(`report-chart-${['one', 'two', 'three', 'four', 'five'][index]}`, points))

  const currentUnits = inventory.reduce((sum, product) => sum + product.quantity, 0)
  const dispatchedUnits = movementRecords
    .filter((movement) => movement.type === 'Dispatched')
    .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0)
  const netMovement = movementRecords.reduce((sum, movement) => sum + movement.quantity, 0)
  const averageUnits = (currentUnits + Math.max(0, currentUnits - netMovement)) / 2
  const estimatedTurnover = averageUnits ? (dispatchedUnits / averageUnits).toFixed(2) : '0.00'
  const values = [
    ['Inventory units', formatNumber(inventory.reduce((sum, product) => sum + product.quantity, 0))],
    ['Warehouse occupancy', `${occupancy.toFixed(1)}%`],
    ['Shipments in period', shipmentsInRange.length],
    ['Open incidents', alertsInRange.filter((alert) => alert.status !== 'resolved').length],
    ['Est. inventory turnover', `${estimatedTurnover}×`],
  ]
  const summaryByType = {
    orders: [
      ['Orders tracked', new Set(riskAssessments.map((shipment) => shipment.orderId)).size],
      ['High-risk orders', new Set(riskAssessments.filter((shipment) => shipment.riskLevel === 'high').map((shipment) => shipment.orderId)).size],
      ['Overdue deliveries', riskAssessments.filter((shipment) => shipment.delayDays > 0).length],
      ['Shipments assessed', riskAssessments.length],
      ['Assessment basis', 'Rule-based estimate'],
    ],
    'inventory-impact': [
      ['Products assessed', inventoryExposure.length],
      ['Shortage products', inventoryExposure.filter((product) => product.shortage > 0).length],
      ['Estimated demand', formatNumber(inventoryExposure.reduce((sum, product) => sum + product.required, 0))],
      ['Available units', formatNumber(inventoryExposure.reduce((sum, product) => sum + product.available, 0))],
      ['Alternate stock', formatNumber(inventoryExposure.reduce((sum, product) => sum + product.otherWarehouseAvailability, 0))],
    ],
    recovery: [
      ['Plans submitted', recoveryPlans.length],
      ['Pending approval', recoveryPlans.filter((plan) => plan.approval_status === 'pending').length],
      ['Approved plans', recoveryPlans.filter((plan) => plan.approval_status === 'approved').length],
      ['Successful recovery', recoveryPlans.filter((plan) => plan.execution_status === 'successful').length],
      ['Actual results recorded', recoveryPlans.filter((plan) => Boolean(plan.actual)).length],
    ],
    alerts: [
      ['Disruptions in period', alertsInRange.length],
      ['Critical active', alertsInRange.filter((alert) => alert.severity === 'critical' && alert.status !== 'resolved').length],
      ['Resolved', alertsInRange.filter((alert) => alert.status === 'resolved').length],
      ['Affected orders', new Set(disruptionAssessments().filter((alert) => inReportRange(alert.createdAt)).flatMap((alert) => alert.orders)).size],
      ['Risk score basis', 'Rule-based estimate'],
    ],
  }
  const summary = summaryByType[reportState.type] || values
  const reportNames = {
    overview: 'Operational performance',
    inventory: 'Inventory performance',
    warehouse: 'Warehouse performance',
    shipments: 'Shipment performance',
    alerts: 'Disruption analysis',
    orders: 'Order risk analysis',
    'inventory-impact': 'Inventory impact analysis',
    recovery: 'Recovery plan performance',
  }
  document.getElementById('report-summary').innerHTML = summary.map(([label, value]) => `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join('')
  setText('report-table-title', `${reportNames[reportState.type]} · records`)
  const previousRange = previousDateRange()
  const comparison = previousRange
    ? `Previous period (${formatDate(previousRange.from)}–${formatDate(previousRange.to)}): ${state.shipments.filter((shipment) => shipment.dispatchDate >= previousRange.from && shipment.dispatchDate <= previousRange.to).length} shipments · ${state.alerts.filter((alert) => alert.createdAt.slice(0, 10) >= previousRange.from && alert.createdAt.slice(0, 10) <= previousRange.to).length} alerts.`
    : 'Select a bounded date range to compare with the previous period.'
  setText('report-period-comparison', comparison)

  const records = reportState.type === 'inventory'
    ? inventory.map((product) => ({ date: product.updatedAt, id: product.productId, category: product.category, status: stockStatus(product), value: `${product.quantity} ${product.unit}`, type: 'inventory' }))
    : reportState.type === 'shipments'
      ? shipmentsInRange.map((shipment) => ({ date: shipment.dispatchDate, id: shipment.id, category: shipment.carrier, status: shipment.status, value: shipment.destination, type: 'shipment' }))
      : reportState.type === 'orders'
        ? riskAssessments.map((shipment) => ({ date: shipment.dispatchDate, id: shipment.id, category: 'Order risk', status: shipment.riskLevel, value: `${shipment.orderId} · ${shipment.riskScore}/100 · ${shipment.delayDays} estimated overdue day(s)`, type: 'shipment' }))
        : reportState.type === 'inventory-impact'
          ? inventoryExposure.map((product) => ({ date: product.updatedAt, id: product.productId, category: product.category, status: product.shortage > 0 ? 'shortage' : stockStatus(product), value: `${product.available} available · ${product.required} required · ${product.shortage} shortage`, type: 'inventory' }))
          : reportState.type === 'recovery'
            ? recoveryPlans.map((plan) => ({ date: plan.createdAt, id: plan.id, category: plan.strategy, status: plan.approval_status, value: `${plan.simulation?.expectedCost ?? plan.cost} INR estimated · ${plan.actual ? `${plan.actual.cost} INR actual` : 'actual not recorded'}`, type: 'recovery' }))
            : reportState.type === 'alerts'
        ? alertsInRange.map((alert) => ({ date: alert.createdAt, id: alert.id, category: alert.category, status: alert.severity, value: alert.title, type: 'alert' }))
        : reportState.type === 'warehouse'
          ? [{ date: new Date().toISOString(), id: warehouseSummary.warehouseId, category: 'Capacity', status: 'occupied', value: `${warehouseSummary.occupiedLocations} / ${warehouseSummary.totalLocations} locations`, type: 'warehouse' }]
          : [
            ...inventory.map((product) => ({ date: product.updatedAt, id: product.productId, category: product.category, status: stockStatus(product), value: `${product.quantity} ${product.unit}`, type: 'inventory' })),
            ...shipmentsInRange.map((shipment) => ({ date: shipment.dispatchDate, id: shipment.id, category: 'Shipment', status: shipment.status, value: shipment.destination, type: 'shipment' })),
            ...alertsInRange.map((alert) => ({ date: alert.createdAt, id: alert.id, category: alert.category, status: alert.severity, value: alert.title, type: 'alert' })),
          ]
  document.getElementById('report-table-body').innerHTML = records.map((record) => `<tr><td>${formatDate(record.date)}</td><td>${record.type === 'recovery' ? `<button class="analyst-table-link" data-plan-detail-id="${escapeHTML(record.id)}">${escapeHTML(record.id)}</button>` : `<button class="analyst-table-link" data-open-type="${record.type}" data-open-id="${escapeHTML(record.id)}">${escapeHTML(record.id)}</button>`}</td><td>${escapeHTML(record.category)}</td><td>${escapeHTML(titleCase(record.status))}</td><td>${escapeHTML(record.value)}</td></tr>`).join('') || '<tr><td colspan="5" class="analyst-table-empty">No report data available for this period.</td></tr>'
}

function renderActivity() {
  const planIds = new Set(analystPlans().map((plan) => plan.id))
  const workflowActivity = getWorkflowState().audit
    .filter((entry) => planIds.has(entry.planId))
    .map((entry) => ({
      timestamp: entry.timestamp,
      type: entry.action,
      description: `${entry.user} (${entry.role}): ${entry.previousStatus} → ${entry.newStatus}${entry.comments ? ` · ${entry.comments}` : ''}`,
      recordId: entry.planId,
    }))
  const seen = new Set()
  const rows = [...backendActivityState.rows, ...workflowActivity, ...state.activities]
    .filter((activity) => {
      const key = `${activity.timestamp}|${activity.recordId}|${activity.type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
  document.getElementById('activity-table-body').innerHTML = rows.map((activity) => `<tr><td>${formatDateTime(activity.timestamp)}</td><td>${escapeHTML(activity.type)}</td><td>${escapeHTML(activity.description)}</td><td><button class="analyst-table-link" data-open-record-id="${escapeHTML(activity.recordId)}">${escapeHTML(activity.recordId)}</button></td></tr>`).join('')
}

function renderNotifications() {
  const list = document.getElementById('notification-list')
  const enabled = document.getElementById('settings-notifications-enabled')?.checked !== false
  const backendNotifications = getNotifications().map((notification) => ({
    id: notification.id,
    planId: notification.planId,
    title: notification.title,
    description: notification.description,
    createdAt: notification.createdAt,
    read: Boolean(notification.read),
  }))
  const notifications = [...backendNotifications, ...state.notifications, ...workflowNotifications()]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
  list.innerHTML = enabled ? notifications.map((notification) => {
    if (notification.planId) {
      return `<article class="analyst-notification-row ${notification.read ? '' : 'is-unread'}"><span class="analyst-notification-dot"></span><div><strong>${escapeHTML(notification.title)}</strong><p>${escapeHTML(notification.description)}</p><small>${formatDateTime(notification.createdAt)}</small></div><button data-workflow-plan-id="${escapeHTML(notification.planId)}" data-workflow-notification-id="${escapeHTML(notification.id)}">View recovery plan</button></article>`
    }
    const type = notification.relatedType || 'alert'
    const id = notification.relatedId || notification.alertId
    return `<article class="analyst-notification-row ${notification.read ? '' : 'is-unread'}"><span class="analyst-notification-dot"></span><div><strong>${escapeHTML(notification.title)}</strong><p>${escapeHTML(notification.description)}</p><small>${formatDateTime(notification.createdAt)}</small></div><button data-notification-id="${escapeHTML(notification.id)}" data-related-type="${escapeHTML(type)}" data-related-id="${escapeHTML(id)}">View ${type === 'alert' ? 'incident' : 'record'}</button></article>`
  }).join('') || '<p class="analyst-table-empty">No notifications.</p>' : '<p class="analyst-table-empty">Notifications are disabled in workspace settings.</p>'
}

function renderAttention() {
  renderAttentionList()
}

function refresh() {
  updateOverview()
  updateInventoryKpis()
  renderInventoryTable()
  renderCustomers()
  renderProductDirectory()
  renderSupplierDirectory()
  renderWarehouseDirectory()
  renderOrderDirectory()
  updateShipmentKpis()
  renderShipmentTable()
  renderIncidentList()
  renderAttention()
  renderMonitoringViews()
  renderOrderImpact()
  renderImpactGraph()
  renderShipmentRisk()
  renderInventoryImpact()
  renderAIInsights()
  renderRecoveryPlanContext()
  renderRecoveryPlanTable()
  renderRecoveryPlanRegister()
  renderSimulation()
  renderRecoveryTracking()
  renderOverviewCharts()
  renderReports()
  renderActivity()
  renderNotifications()
}

window.addEventListener('disruptioniq:recovery-workflow-updated', refresh)
window.addEventListener('storage', (event) => {
  if (!event.key || [STORAGE_KEY, WORKFLOW_STORAGE_KEY, SETTINGS_KEY, SIMULATION_STORAGE_KEY, WORKFLOW_READS_KEY].includes(event.key)) refresh()
})

function downloadCSV(filename, rows) {
  const content = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportInventory() {
  const rows = [['Product ID', 'Product name', 'SKU', 'Category', 'Quantity', 'Reserved', 'Available', 'Warehouse', 'Location', 'Status', 'Last updated']]
  inventoryFiltered().forEach((product) => rows.push([
    product.productId, product.productName, product.sku, product.category, product.quantity,
    product.reserved, availableStock(product), product.warehouse, product.location, titleCase(stockStatus(product)), product.updatedAt,
  ]))
  downloadCSV('disruptioniq-inventory.csv', rows)
  recordActivity('Report generated', 'Filtered inventory CSV exported.', 'inventory')
  persist()
  renderActivity()
}

function exportShipments() {
  const rows = [['Shipment ID', 'Order ID', 'Destination', 'Carrier', 'Vehicle ID', 'Dispatch date', 'Expected delivery', 'Status', 'Exception']]
  shipmentFiltered().forEach((shipment) => rows.push([
    shipment.id, shipment.orderId, shipment.destination, shipment.carrier, shipment.vehicleId,
    shipment.dispatchDate, shipment.expectedDate, titleCase(shipment.status), shipment.delayReason || '',
  ]))
  downloadCSV('disruptioniq-shipments.csv', rows)
  recordActivity('Report generated', 'Filtered shipment CSV exported.', 'shipments')
  persist()
  renderActivity()
}

function exportReport() {
  const rows = [['Date', 'Record', 'Category', 'Status', 'Value'], ...[...document.querySelectorAll('#report-table-body tr')].map((row) => [...row.cells].map((cell) => cell.textContent.trim()))]
  downloadCSV('disruptioniq-operational-report.csv', rows)
  recordActivity('Report generated', `${titleCase(reportState.type)} analytics CSV exported.`, 'reports')
  persist()
  renderActivity()
}

function setOptions(select, values, firstLabel) {
  select.innerHTML = `<option value="all">${escapeHTML(firstLabel)}</option>${values.map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('')}`
}

setOptions(document.getElementById('inventory-category-filter'), [...new Set(inventoryItems.map((item) => item.category))].sort(), 'All categories')
setOptions(document.getElementById('report-category'), [...new Set(inventoryItems.map((item) => item.category))].sort(), 'All categories')
setText('analyst-current-date', formatDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))

document.getElementById('inventory-search').addEventListener('input', (event) => { inventoryState.query = event.target.value.trim(); renderInventoryTable() })
document.getElementById('inventory-status-filter').addEventListener('change', (event) => { inventoryState.status = event.target.value; renderInventoryTable() })
document.getElementById('inventory-category-filter').addEventListener('change', (event) => { inventoryState.category = event.target.value; renderInventoryTable() })
document.getElementById('inventory-warehouse-filter').addEventListener('change', (event) => { inventoryState.warehouse = event.target.value; renderInventoryTable() })
document.getElementById('inventory-sort').addEventListener('change', (event) => { inventoryState.sort = event.target.value; renderInventoryTable() })
document.getElementById('customer-search').addEventListener('input', (event) => { customerFilters.query = event.target.value.trim(); renderCustomers() })
document.getElementById('customer-status-filter').addEventListener('change', (event) => { customerFilters.status = event.target.value; renderCustomers() })
document.getElementById('customer-region-filter').addEventListener('change', (event) => { customerFilters.region = event.target.value; renderCustomers() })
document.getElementById('product-directory-search').addEventListener('input', (event) => {
  productDirectoryFilters.query = event.target.value.trim()
  renderProductDirectory()
})
document.getElementById('product-directory-status').addEventListener('change', (event) => {
  productDirectoryFilters.status = event.target.value
  renderProductDirectory()
})
document.getElementById('supplier-search').addEventListener('input', (event) => {
  supplierDirectoryFilters.query = event.target.value.trim()
  renderSupplierDirectory()
})
document.getElementById('warehouse-directory-search').addEventListener('input', (event) => {
  warehouseDirectoryFilters.query = event.target.value.trim()
  renderWarehouseDirectory()
})
document.getElementById('order-directory-search').addEventListener('input', (event) => {
  orderDirectoryFilters.query = event.target.value.trim()
  renderOrderDirectory()
})
document.getElementById('order-directory-status').addEventListener('change', (event) => {
  orderDirectoryFilters.status = event.target.value
  renderOrderDirectory()
})
document.getElementById('customer-export').addEventListener('click', exportCustomers)
document.getElementById('customer-template-download').addEventListener('click', () => {
  downloadCSV('disruptioniq-customer-import-template.csv', [
    ['customerId', 'name', 'email', 'phone', 'region', 'status', 'orderIds'],
    ['CUST-1001', 'Example customer', 'customer@example.com', '+1 555 0100', 'North', 'active', 'ORD-1201;ORD-1202'],
  ])
})
document.getElementById('customer-import-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]
  pendingCustomerImport = []
  pendingCustomerImportErrors = []
  if (!file) {
    setText('customer-import-status', 'Choose a CSV file to begin.')
    renderCustomerImportPreview()
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    setText('customer-import-status', 'The selected file is larger than the 2 MB limit.')
    renderCustomerImportPreview()
    event.target.value = ''
    return
  }
  try {
    const result = parseCustomerCSV(await file.text())
    pendingCustomerImport = result.accepted
    pendingCustomerImportErrors = result.errors
    setText('customer-import-status', result.accepted.length
      ? `${result.accepted.length} valid row(s) ready to import; ${result.errors.length} invalid row(s) will be skipped. Existing customer IDs will be updated.`
      : `No valid customer rows found; ${result.errors.length} row(s) need attention.`)
  } catch (error) {
    setText('customer-import-status', `Could not validate this CSV: ${error.message}`)
    event.target.value = ''
  }
  renderCustomerImportPreview()
})
document.getElementById('customer-import-apply').addEventListener('click', async () => {
  if (!pendingCustomerImport.length) {
    setText('customer-import-status', 'There are no valid customer rows to import.')
    return
  }
  const button = document.getElementById('customer-import-apply')
  button.disabled = true
  setText('customer-import-status', 'Uploading validated customer rows to the backend…')
  try {
    const result = await importSupplyChainFile('customers', customerImportFile(pendingCustomerImport))
    const rows = asList(await customersApi()).map((row, index) => {
      const id = row.id || `CUSTOMER-${index + 1}`
      return {
        customerId: id,
        id,
        name: row.name || 'Unnamed customer',
        email: row.email || '',
        phone: '',
        region: '',
        status: 'active',
        orderIds: [],
      }
    })
    state.customers = rows
    const imported = Number(result?.importedRows ?? pendingCustomerImport.length)
    const rejected = Number(result?.rejectedRows || 0)
    recordActivity('Customer CSV imported', `${imported} row(s) imported by the backend${rejected ? `; ${rejected} rejected` : ''}.`, 'customers')
    persist()
    pendingCustomerImport = []
    pendingCustomerImportErrors = []
    document.getElementById('customer-import-file').value = ''
    setText('customer-import-status', `Backend import complete: ${imported} imported${rejected ? `, ${rejected} rejected` : ''}${(result?.errors || []).length ? ` · ${result.errors.slice(0, 2).join('; ')}` : ''}.`)
  } catch (error) {
    setText('customer-import-status', `Backend import failed: ${error.message}`)
  } finally {
    renderCustomerImportPreview()
    refresh()
  }
})
document.getElementById('recovery-plans-search').addEventListener('input', (event) => {
  recoveryPlanFilters.query = event.target.value.trim()
  renderRecoveryPlanRegister()
})
document.getElementById('recovery-plans-approval').addEventListener('change', (event) => {
  recoveryPlanFilters.approval = event.target.value
  renderRecoveryPlanRegister()
})
document.getElementById('recovery-plans-execution').addEventListener('change', (event) => {
  recoveryPlanFilters.execution = event.target.value
  renderRecoveryPlanRegister()
})
document.getElementById('recovery-plans-clear').addEventListener('click', () => {
  recoveryPlanFilters.query = ''
  recoveryPlanFilters.approval = 'all'
  recoveryPlanFilters.execution = 'all'
  document.getElementById('recovery-plans-search').value = ''
  document.getElementById('recovery-plans-approval').value = 'all'
  document.getElementById('recovery-plans-execution').value = 'all'
  renderRecoveryPlanRegister()
})
document.getElementById('inventory-clear-filters').addEventListener('click', () => {
  inventoryState.query = ''
  inventoryState.status = 'all'
  inventoryState.category = 'all'
  inventoryState.warehouse = 'all'
  inventoryState.sort = 'name'
  document.getElementById('inventory-search').value = ''
  document.getElementById('analyst-global-search').value = ''
  document.getElementById('inventory-status-filter').value = 'all'
  document.getElementById('inventory-category-filter').value = 'all'
  document.getElementById('inventory-warehouse-filter').value = 'all'
  document.getElementById('inventory-sort').value = 'name'
  renderInventoryTable()
})
document.getElementById('analyst-global-search').addEventListener('input', (event) => {
  monitoringSearchState.query = event.target.value.trim()
  document.getElementById('monitoring-disruption-search').value = event.target.value
  renderMonitoringViews()
  if (window.location.hash !== '#monitoring') history.pushState(null, '', '#monitoring')
  showPage('monitoring')
})
document.getElementById('inventory-search').addEventListener('input', (event) => {
  document.getElementById('analyst-global-search').value = event.target.value
})
document.getElementById('shipment-search').addEventListener('input', (event) => { shipmentState.query = event.target.value.trim(); renderShipmentTable() })
document.getElementById('shipment-status-filter').addEventListener('change', (event) => { shipmentState.status = event.target.value; renderShipmentTable() })
;['alert-search', 'alert-severity-filter', 'alert-status-filter'].forEach((id) => {
  document.getElementById(id).addEventListener(id.endsWith('search') ? 'input' : 'change', renderIncidentList)
})
document.getElementById('alert-sort').addEventListener('change', renderIncidentList)
document.getElementById('monitoring-disruption-search').addEventListener('input', (event) => {
  monitoringSearchState.query = event.target.value.trim()
  document.getElementById('analyst-global-search').value = event.target.value
  renderMonitoringViews()
})
document.getElementById('order-impact-search').addEventListener('input', renderOrderImpact)
document.getElementById('order-impact-risk').addEventListener('change', renderOrderImpact)
document.getElementById('impact-graph-shipment').addEventListener('change', () => {
  impactGraphState.impact = null
  impactGraphState.renderedShipmentId = ''
  renderImpactGraph({ force: true })
})
document.getElementById('shipment-risk-search').addEventListener('input', renderShipmentRisk)
document.getElementById('shipment-risk-level').addEventListener('change', renderShipmentRisk)
document.getElementById('inventory-impact-search').addEventListener('input', renderInventoryImpact)
document.getElementById('inventory-impact-filter').addEventListener('change', renderInventoryImpact)
document.getElementById('recovery-disruption').addEventListener('change', renderRecoveryPlanContext)
document.getElementById('recovery-strategy').addEventListener('change', renderRecoveryPlanContext)
document.getElementById('simulation-disruption').addEventListener('change', renderSimulation)
document.getElementById('simulation-run').addEventListener('click', renderSimulation)
document.getElementById('recovery-plan-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const formData = new FormData(form)
  const disruptionId = String(formData.get('disruptionId') || '')
  const submit = form.querySelector('button[type="submit"]')
  if (submit) submit.disabled = true
  try {
    const plan = await createRecoveryPlan(disruptionId, {
      strategy: String(formData.get('strategy') || ''),
      requiredActions: String(formData.get('requiredActions') || '').split('\n'),
      resources: String(formData.get('resources') || '').split('\n'),
      cost: Number(formData.get('cost')),
      recoveryDays: Number(formData.get('recoveryDays')),
      riskReduction: Number(formData.get('riskReduction')),
      requiresAdditionalExpenditure: formData.get('requiresAdditionalExpenditure') === 'on',
    })
    recordActivity('Recovery plan submitted', `${plan.id} submitted for manager review.`, plan.id)
    persist()
    setText('recovery-plan-status', `${plan.id} submitted. Manager approval and execution authorization are separate steps.`)
    refresh()
  } catch (error) {
    setText('recovery-plan-status', error.message)
  } finally {
    if (submit) submit.disabled = false
  }
})
document.getElementById('inventory-export').addEventListener('click', exportInventory)
document.getElementById('shipment-export').addEventListener('click', exportShipments)
document.getElementById('report-export').addEventListener('click', exportReport)
document.getElementById('report-print').addEventListener('click', () => window.print())

document.querySelector('.analyst-page').addEventListener('click', (event) => {
  const saveSimulationButton = event.target.closest('[data-save-simulation]')
  if (saveSimulationButton) {
    const disruptionId = document.getElementById('simulation-disruption').value
    const assessment = selectedDisruptionSummary(disruptionId)
    const scenario = currentScenarios(disruptionId)
      .find((item) => item.id === saveSimulationButton.dataset.saveSimulation)
    if (!scenario || !assessment) return
    const saved = savedSimulations()
    saved.unshift({
      ...scenario,
      disruptionId: assessment.id,
      savedAt: new Date().toISOString(),
    })
    localStorage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify(saved))
    recordActivity('Simulation saved', `${scenario.strategy} for ${assessment.id} saved as an estimate.`, assessment.id)
    persist()
    refresh()
    return
  }
  const useSimulationButton = event.target.closest('[data-use-simulation]')
  if (useSimulationButton) {
    const disruptionId = document.getElementById('simulation-disruption').value
    const assessment = selectedDisruptionSummary(disruptionId)
    const scenario = currentScenarios(disruptionId)
      .find((item) => item.id === useSimulationButton.dataset.useSimulation)
    if (!scenario?.feasible || !assessment) return
    document.getElementById('recovery-disruption').value = assessment.id
    applyScenarioToPlan(scenario)
    openRecoveryPlanDialog(assessment.id)
    if (scenario.request) {
      recoveryFeasibility(scenario.request)
        .then((result) => {
          setText('recovery-plan-status', result?.feasible
            ? `Backend feasibility check passed: ${result.reason || 'strategy can proceed for review.'}`
            : `Backend feasibility check: ${result?.reason || 'this strategy needs more data before approval.'}`)
        })
        .catch((error) => setText('recovery-plan-status', `Backend feasibility check failed: ${error.message}`))
    }
    return
  }
  const planDetailsButton = event.target.closest('[data-plan-detail-id], [data-workflow-plan-id]')
  if (planDetailsButton) {
    showPlanDetails(planDetailsButton.dataset.planDetailId || planDetailsButton.dataset.workflowPlanId)
    return
  }
  const recoveryPlanButton = event.target.closest('[data-recovery-plan-disruption]')
  if (recoveryPlanButton) {
    openRecoveryPlanDialog(recoveryPlanButton.dataset.recoveryPlanDisruption)
    return
  }
  const openButton = event.target.closest('[data-open-type][data-open-id]')
  if (openButton) {
    showDetails(openButton.dataset.openType, openButton.dataset.openId)
    return
  }
  const productAction = event.target.closest('[data-product-action]')
  if (productAction) {
    const { id, productAction: action } = productAction.dataset
    if (action === 'details' || action === 'history') showDetails('inventory', id)
    else if (action === 'flag') flagProduct(id)
    else if (action === 'shipment') showDetails('shipment', id)
    return
  }
  const shipmentAction = event.target.closest('[data-shipment-action]')
  if (shipmentAction) {
    openShipmentAction(shipmentAction.dataset.shipmentAction, shipmentAction.dataset.id)
    return
  }
  const alertAction = event.target.closest('[data-alert-action]')
  if (alertAction) openAlertAction(alertAction.dataset.alertAction, alertAction.dataset.id)
})

document.getElementById('activity-table-body').addEventListener('click', (event) => {
  const button = event.target.closest('[data-open-record-id]')
  if (!button) return
  const recordId = button.dataset.openRecordId
  if (recordId.startsWith('SHP-')) showDetails('shipment', recordId)
  else if (recordId.startsWith('ALT-')) showDetails('alert', recordId)
  else if (recordId.startsWith('RCP-')) showPlanDetails(recordId)
  else if (recordId === warehouseSummary.warehouseId) showDetails('warehouse', recordId)
  else showDetails('inventory', recordId)
})
document.getElementById('notification-list').addEventListener('click', (event) => {
  const workflowButton = event.target.closest('[data-workflow-plan-id]')
  if (workflowButton) {
    const notificationId = workflowButton.dataset.workflowNotificationId
    if (getNotifications().some((notification) => notification.id === notificationId)) {
      markWorkflowNotificationRead(notificationId).catch((error) => console.error('[DisruptionIQ] Notification read failed:', error))
    } else {
      const savedReads = localStorage.getItem(WORKFLOW_READS_KEY)
      const readIds = new Set(savedReads ? JSON.parse(savedReads) : [])
      readIds.add(notificationId)
      localStorage.setItem(WORKFLOW_READS_KEY, JSON.stringify([...readIds]))
    }
    refresh()
    showPlanDetails(workflowButton.dataset.workflowPlanId)
    return
  }
  const button = event.target.closest('[data-notification-id]')
  if (!button) return
  const notification = state.notifications.find((item) => item.id === button.dataset.notificationId)
  if (notification) notification.read = true
  persist()
  refresh()
  showDetails(button.dataset.relatedType, button.dataset.relatedId)
})
document.getElementById('notifications-read-all').addEventListener('click', () => {
  state.notifications.forEach((notification) => { notification.read = true })
  getNotifications()
    .filter((notification) => !notification.read)
    .forEach((notification) => {
      markWorkflowNotificationRead(notification.id).catch((error) => console.error('[DisruptionIQ] Notification read failed:', error))
    })
  const readIds = new Set(workflowNotifications().map((notification) => notification.id))
  const savedReads = localStorage.getItem(WORKFLOW_READS_KEY)
  if (savedReads) JSON.parse(savedReads).forEach((id) => readIds.add(id))
  localStorage.setItem(WORKFLOW_READS_KEY, JSON.stringify([...readIds]))
  recordActivity('Notifications read', 'All notifications marked as read.', 'notifications')
  persist()
  refresh()
})

function applyReportInputs() {
  reportState.type = document.getElementById('report-type').value
  reportState.period = document.getElementById('report-period').value
  reportState.category = document.getElementById('report-category').value
  reportState.warehouse = document.getElementById('report-warehouse').value
  reportState.from = document.getElementById('report-date-from').value
  reportState.to = document.getElementById('report-date-to').value
  if (reportState.period === 'custom' && reportState.from && reportState.to && reportState.from > reportState.to) {
    setText('report-table-title', 'Invalid date range · start must be before end')
    return
  }
  renderReports()
}

;['report-type', 'report-period', 'report-category', 'report-warehouse', 'report-date-from', 'report-date-to'].forEach((id) => {
  document.getElementById(id).addEventListener('change', applyReportInputs)
})
document.getElementById('report-period').addEventListener('change', (event) => {
  document.getElementById('report-custom-range').hidden = event.target.value !== 'custom'
})

document.getElementById('overview-date-range').addEventListener('change', (event) => {
  document.getElementById('overview-custom-range').hidden = event.target.value !== 'custom'
  overviewState.period = event.target.value
  overviewState.from = ''
  overviewState.to = ''
  renderOverviewCharts()
  const period = event.target.value
  setText('overview-period-label', period === 'custom' ? 'Custom period' : titleCase(period === 'day' ? 'today' : period === 'week' ? 'this week' : 'this month'))
  if (period === 'custom') return
})
document.getElementById('overview-apply-range').addEventListener('click', () => {
  const from = document.getElementById('overview-date-from').value
  const to = document.getElementById('overview-date-to').value
  if (from && to && from > to) {
    setText('overview-period-label', 'Invalid date range · start must be before end')
    return
  }
  overviewState.period = 'custom'
  overviewState.from = from
  overviewState.to = to
  renderOverviewCharts()
  setText('overview-period-label', `Custom · ${from || 'any'} to ${to || 'today'}`)
})

const savedSettingsValue = localStorage.getItem(SETTINGS_KEY)
const settings = savedSettingsValue ? JSON.parse(savedSettingsValue) : {
  displayName: 'Operations Analyst',
  warehouse: 'WH-001',
  notificationsEnabled: true,
}
document.getElementById('settings-display-name').value = settings.displayName
document.getElementById('settings-default-warehouse').value = settings.warehouse
document.getElementById('settings-notifications-enabled').checked = settings.notificationsEnabled
setText('analyst-sidebar-display-name', settings.displayName)
document.getElementById('settings-notifications-enabled').addEventListener('change', renderNotifications)
document.getElementById('settings-save').addEventListener('click', () => {
  const displayName = document.getElementById('settings-display-name').value.trim()
  if (!displayName) {
    setText('settings-save-status', 'Enter a display name before saving.')
    return
  }
  const nextSettings = {
    displayName,
    warehouse: document.getElementById('settings-default-warehouse').value,
    notificationsEnabled: document.getElementById('settings-notifications-enabled').checked,
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings))
  setText('analyst-sidebar-display-name', displayName)
  setText('settings-save-status', 'Preferences saved in this browser.')
  recordActivity('Workspace settings updated', `Display name set to ${displayName}.`, 'settings')
  persist()
  renderActivity()
})

const analystPageIds = new Set(
  [...document.querySelectorAll('[data-analyst-page]')].map((page) => page.dataset.analystPage),
)

function showPage(pageId) {
  const page = analystPageIds.has(pageId) ? pageId : 'overview'
  document.querySelectorAll('[data-analyst-page]').forEach((element) => {
    element.hidden = element.dataset.analystPage !== page
  })
  document.querySelectorAll('.analyst-nav-link').forEach((link) => {
    const active = link.hash.slice(1) === page
    link.classList.toggle('is-active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  closeDetails()
  window.scrollTo(0, 0)
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]')
  if (!link) return
  const pageId = link.hash.slice(1)
  if (!analystPageIds.has(pageId)) return
  event.preventDefault()
  if (window.location.hash !== `#${pageId}`) history.pushState(null, '', `#${pageId}`)
  showPage(pageId)
})

window.addEventListener('hashchange', () => showPage(window.location.hash.slice(1)))
window.addEventListener('popstate', () => showPage(window.location.hash.slice(1)))
showPage(window.location.hash.slice(1) || 'overview')

refresh()
persist()
hydrateAiAvailability()
hydrateBackendRisk()
hydrateActivity()
window.__operationsAnalyst = {
  getState: () => clone(state),
  getMetrics: () => ({
    inventoryUnits: state.inventory.reduce((sum, item) => sum + item.quantity, 0),
    lowStock: state.inventory.filter((item) => stockStatus(item) === 'low-stock').length,
    outOfStock: state.inventory.filter((item) => stockStatus(item) === 'out-of-stock').length,
    activeShipments: state.shipments.filter((item) => !['delivered', 'failed'].includes(item.status)).length,
    delayedShipments: delayedShipments().length,
    activeAlerts: activeAlerts().length,
    pendingActions: pendingActions(),
  }),
}
