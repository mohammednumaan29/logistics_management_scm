import { inventoryItems, shipments, warehouseAlerts } from './operations-analyst-data.js'
import { getSession, roleName } from '../api/client.js'
import {
  asList,
  approveRecoveryPlan,
  auditRecoveryPlan,
  createRecoveryPlan as createRecoveryPlanApi,
  executeRecoveryPlan,
  getRecoveryPlan,
  impactAnalysis,
  listRecoveryPlans,
  markNotificationRead as markNotificationReadApi,
  notifications as notificationsApi,
  recoveryProgressByPlan,
  rejectRecoveryPlan,
  strategyFromLabel,
  strategyLabel,
  suppliers as suppliersApi,
  updateRecoveryProgress,
  warehouses as warehousesApi,
} from '../api/disruptioniq.js'

const SAVED_KEY = 'disruptioniq.manager.saved-plans.v1'
const LOCAL_APPROVALS_KEY = 'disruptioniq.workflow.local-approvals.v1'
const LEGACY_STORAGE_KEY = 'disruptioniq.shared.recovery-workflow.v1'

const lower = value => String(value || '').toLowerCase()

export function getCurrentActor() {
  const session = getSession()
  if (session?.accessToken) {
    return {
      id: session.userId || session.username || 'unknown',
      name: session.username || roleName(session.role),
      role: roleName(session.role),
      roleCode: String(session.role || '').replace(/^ROLE_/, '').toUpperCase(),
    }
  }
  const role = sessionStorage.getItem('disruptioniq-selected-role') || ''
  return {
    id: 'ANON-001',
    name: role || 'Demo user',
    role: role || 'Unknown',
    roleCode: '',
  }
}

const cache = {
  plans: [],
  audit: [],
  notifications: [],
  loaded: false,
  connected: false,
  error: null,
}

function dispatchUpdate() {
  window.dispatchEvent(new CustomEvent('disruptioniq:recovery-workflow-updated'))
}

function shipmentForDisruption(disruption) {
  if (!disruption) return null
  if (disruption.relatedType === 'shipment') {
    return shipments.find(item => item.id === disruption.relatedId) || null
  }
  const linkedShipmentId = disruption.shipments?.[0]
  if (linkedShipmentId) return shipments.find(item => item.id === linkedShipmentId) || null
  if (disruption.relatedType === 'inventory') {
    return shipments.find(item => item.productIds?.includes(disruption.relatedId)) || null
  }
  return null
}

function disruptionIdForShipment(shipmentId) {
  const disruption = getDisruptions().find(item =>
    (item.relatedType === 'shipment' && item.relatedId === shipmentId)
    || (item.shipments || []).includes(shipmentId),
  )
  return disruption?.id || shipmentId
}

function savedPlanIds() {
  const actor = getCurrentActor()
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}')
    return Array.isArray(parsed[actor.id]) ? parsed[actor.id] : []
  } catch {
    return []
  }
}

function progressTaskStatus(value) {
  const status = String(value || '').toUpperCase()
  if (status === 'COMPLETED') return 'completed'
  if (status === 'BLOCKED') return 'blocked'
  if (status === 'IN_PROGRESS') return 'in_progress'
  return 'pending'
}

function normalizeProgressTasks(progressHistory) {
  return [...progressHistory]
    .sort((left, right) => new Date(left.updatedAt || 0) - new Date(right.updatedAt || 0))
    .map((entry) => ({
      id: entry.id,
      title: entry.milestone || 'Progress update',
      team: entry.shipmentId ? `Shipment ${entry.shipmentId}` : 'Execution team',
      assignedRole: entry.updatedBy || 'Backend',
      dueAt: null,
      status: progressTaskStatus(entry.status),
      updatedBy: entry.updatedBy,
      updatedAt: entry.updatedAt,
      blocker: entry.blocker,
      notes: entry.notes,
    }))
}

function normalizePlan(plan, progressHistory = []) {
  const status = String(plan.status || '').toUpperCase()
  const executed = status === 'EXECUTED'
  const approvalStatus = status === 'PENDING_APPROVAL'
    ? 'pending'
    : status === 'APPROVED'
      ? 'approved'
      : status === 'REJECTED'
        ? 'rejected'
        : executed
          ? 'executed'
          : lower(status)
  const history = [...progressHistory]
    .sort((left, right) => new Date(left.updatedAt || 0) - new Date(right.updatedAt || 0))
  const latestProgress = history[history.length - 1]
  const latestStatus = String(latestProgress?.status || '').toUpperCase()
  const executionStatus = executed
    ? latestStatus === 'BLOCKED'
      ? 'blocked'
      : latestStatus === 'IN_PROGRESS'
        ? 'in_progress'
        : 'successful'
    : 'not_started'
  const strategyCode = plan.strategy || ''
  return {
    ...plan,
    shipmentId: plan.shipmentId,
    disruptionId: disruptionIdForShipment(plan.shipmentId),
    createdByUserId: plan.createdBy || '',
    createdBy: plan.createdBy || 'Unknown user',
    cost: Number(plan.estimatedCost || 0),
    recoveryDays: Number(plan.estimatedRecoveryDays || 0),
    ordersSaved: Number(plan.ordersSaved || 0),
    riskReduction: null,
    riskScore: 0,
    strategyCode,
    strategy: strategyLabel(strategyCode),
    approval_status: approvalStatus,
    backend_status: status,
    execution_authorisation_status: executed ? 'authorized' : 'not_authorized',
    execution_status: executionStatus,
    progressPercentage: latestProgress ? Number(latestProgress.completionPercentage || 0) : null,
    simulation: {
      expectedCost: Number(plan.estimatedCost || 0),
      expectedRecoveryDays: Number(plan.estimatedRecoveryDays || 0),
      expectedRiskReduction: null,
      label: 'Backend plan estimate',
    },
    actual: null,
    requiredApprovals: [],
    tasks: normalizeProgressTasks(history),
    savedBy: savedPlanIds(),
    comments: plan.decisionReason
      ? [{ user: plan.decidedBy || 'Decision maker', text: plan.decisionReason, at: plan.decidedAt }]
      : [],
  }
}

function normalizeAudit(entry) {
  return {
    id: entry.id,
    planId: entry.entityId,
    user: entry.performedBy || 'System',
    userId: entry.performedBy || '',
    role: '',
    timestamp: entry.timestamp,
    action: String(entry.action || 'Audit event').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()),
    previousStatus: '',
    newStatus: '',
    comments: entry.reason || '',
    entityType: entry.entityType,
  }
}

function normalizeNotification(notification) {
  return {
    ...notification,
    description: notification.message || notification.description || '',
    date: notification.createdAt,
    planId: notification.relatedEntityType === 'RECOVERY_PLAN' ? notification.relatedEntityId : null,
  }
}

function persistSavedPlan(planId, actor) {
  let parsed = {}
  try { parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}') } catch { parsed = {} }
  const list = new Set(Array.isArray(parsed[actor.id]) ? parsed[actor.id] : [])
  list.add(planId)
  parsed[actor.id] = [...list]
  localStorage.setItem(SAVED_KEY, JSON.stringify(parsed))
}

export async function hydrateWorkflow() {
  const actor = getCurrentActor()
  if (!actor.roleCode) return cache
  try {
    const [planPayload, notificationPayload] = await Promise.all([
      listRecoveryPlans(),
      notificationsApi({ limit: 100 }),
    ])
    const rawPlans = asList(planPayload)
    const progressResults = await Promise.allSettled(
      rawPlans.map(plan => recoveryProgressByPlan(plan.id)),
    )
    const progressById = new Map()
    progressResults.forEach((result, index) => {
      progressById.set(rawPlans[index].id, result.status === 'fulfilled' ? asList(result.value) : [])
    })
    cache.plans = rawPlans.map(plan => normalizePlan(plan, progressById.get(plan.id) || []))
    cache.notifications = asList(notificationPayload).map(normalizeNotification)
    const auditResults = await Promise.allSettled(
      rawPlans.map(plan => auditRecoveryPlan(plan.id)),
    )
    cache.audit = auditResults
      .flatMap(result => result.status === 'fulfilled' ? asList(result.value) : [])
      .map(normalizeAudit)
    cache.loaded = true
    cache.connected = true
    cache.error = null
    // Retire the legacy browser-local workflow snapshot.
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch (error) {
    cache.error = error.message
    cache.loaded = true
    console.error('[DisruptionIQ] Recovery workflow hydration failed:', error)
  }
  return cache
}

export async function refreshWorkflow() {
  await hydrateWorkflow()
  dispatchUpdate()
  return cache
}

export function getWorkflowState() {
  return {
    plans: cache.plans,
    audit: cache.audit,
    notifications: cache.notifications,
    connected: cache.connected,
    error: cache.error,
  }
}

export function getDisruptions() {
  const currentShipments = shipments
  const currentInventory = inventoryItems
  return warehouseAlerts.map((alert, index) => {
    const linkedShipments = currentShipments.filter(shipment =>
      (alert.relatedType === 'shipment' && shipment.id === alert.relatedId)
      || (alert.relatedType === 'inventory' && shipment.productIds?.includes(alert.relatedId)),
    )
    const linkedProducts = currentInventory.filter(product =>
      linkedShipments.some(shipment => shipment.productIds?.includes(product.productId))
      || (alert.relatedType === 'inventory' && product.productId === alert.relatedId),
    )
    const destination = linkedShipments[0]?.destination || alert.description
    const region = /chennai|coimbatore|kochi|mysuru|vijayawada|hyderabad|bengaluru/i.test(destination)
      ? 'south'
      : /mumbai|surat|ahmedabad|pune/i.test(destination)
        ? 'west'
        : 'north'
    const score = Math.min(98, Math.max(12,
      (alert.severity === 'critical' ? 82 : alert.severity === 'high' ? 70 : alert.severity === 'medium' ? 48 : 26)
      + Math.min(12, linkedShipments.length * 3) + (alert.status === 'open' ? 4 : 0),
    ))
    const relatedPlans = cache.plans.filter(plan =>
      plan.shipmentId === alert.relatedId
      || linkedShipments.some(shipment => shipment.id === plan.shipmentId),
    )
    return {
      id: alert.id,
      title: alert.title,
      category: alert.category,
      severity: alert.severity,
      riskScore: score,
      status: alert.status,
      description: alert.description,
      impact: alert.impact,
      createdAt: alert.createdAt,
      relatedId: alert.relatedId,
      relatedType: alert.relatedType,
      orders: [...new Set(linkedShipments.flatMap(shipment => (
        shipment.orderIds?.length ? shipment.orderIds : [shipment.orderId]
      )).filter(id => id && id !== '—'))],
      shipments: linkedShipments.map(shipment => shipment.id),
      suppliers: [...new Set([
        ...linkedShipments.map(shipment => shipment.supplier),
        ...linkedProducts.map(product => product.supplier),
      ].filter(name => name && name !== 'Not specified'))],
      warehouses: [...new Set([
        ...linkedShipments.map(shipment => shipment.warehouseId),
        ...linkedProducts.map(product => product.warehouse),
      ].filter(id => id && id !== '—'))],
      plans: relatedPlans.map(plan => plan.id),
      region,
      affectedOrders: linkedShipments.length,
      delayedShipments: linkedShipments.filter(shipment => shipment.status === 'delayed').length,
      inventoryShortages: linkedProducts.filter(product => product.quantity <= product.reorderThreshold).length,
      explanation: `${alert.severity} ${lower(alert.category)} exposure; ${linkedShipments.length} linked shipment(s), ${linkedProducts.filter(product => product.quantity <= product.reorderThreshold).length} below-threshold inventory item(s). Risk score is an illustrative estimate.`,
      index,
    }
  })
}

function strategyCodeFor(details) {
  const explicit = details.strategyCode || strategyFromLabel(details.strategy)
  if (explicit) return explicit
  const value = lower(details.strategy)
  if (value.includes('expedite') || value.includes('reroute') || value.includes('carrier')) return 'EXPEDITE_SHIPMENT'
  if (value.includes('reallocat') || value.includes('transfer') || value.includes('rebalance') || value.includes('inventory between')) return 'REALLOCATE_STOCK'
  if (value.includes('supplier')) return 'ALTERNATIVE_SUPPLIER'
  if (value.includes('split')) return 'SPLIT_ORDER'
  return 'DO_NOTHING'
}

async function strategyParameters(strategy, details, shipmentId) {
  if (strategy === 'REALLOCATE_STOCK') {
    let sourceWarehouseId = details.sourceWarehouseId
    let quantity = Number(details.reallocationQuantity || details.quantity || 0)
    if (!sourceWarehouseId || quantity < 1) {
      try {
        const [warehousePayload, impact] = await Promise.all([warehousesApi(), impactAnalysis(shipmentId)])
        const options = asList(warehousePayload).filter(item => item.id !== impact?.warehouseId)
        sourceWarehouseId = sourceWarehouseId || options[0]?.id
        quantity = quantity || Math.max(1, Math.min(Number(impact?.available || 1), Number(impact?.shipmentQuantity || 1)))
      } catch {
        // Validation below produces a readable message.
      }
    }
    if (!sourceWarehouseId || quantity < 1) {
      throw new Error('Reallocation requires a source warehouse and a positive quantity. Select another warehouse than the delivery destination.')
    }
    return { sourceWarehouseId, reallocationQuantity: Math.round(quantity) }
  }
  if (strategy === 'EXPEDITE_SHIPMENT') {
    return { expeditedArrivalDays: Math.max(1, Math.round(Number(details.expeditedArrivalDays || details.recoveryDays || 1))) }
  }
  if (strategy === 'ALTERNATIVE_SUPPLIER') {
    let alternativeSupplierId = details.alternativeSupplierId
    if (!alternativeSupplierId) {
      try {
        const [supplierPayload, impact] = await Promise.all([suppliersApi(), impactAnalysis(shipmentId)])
        const active = asList(supplierPayload)
          .filter(item => String(item.status || '').toUpperCase() === 'ACTIVE' && item.id !== impact?.supplierId)
          .sort((left, right) => Number(left.leadTimeDays || 0) - Number(right.leadTimeDays || 0))
        alternativeSupplierId = active[0]?.id || asList(supplierPayload)[0]?.id
      } catch {
        // Validation below produces a readable message.
      }
    }
    if (!alternativeSupplierId) {
      throw new Error('Alternative supplier replenishment requires an active alternative supplier ID.')
    }
    return { alternativeSupplierId }
  }
  if (strategy === 'SPLIT_ORDER') {
    const splitQuantity = Number(details.splitQuantity || details.quantity || 1)
    if (splitQuantity < 1) throw new Error('Split order requires a positive split quantity.')
    return { splitQuantity: Math.round(splitQuantity) }
  }
  return {}
}

export async function createRecoveryPlan(disruptionId, details, actor = getCurrentActor()) {
  if (!['Operations Analyst', 'Supply Chain Manager', 'Administrator'].includes(actor.role)) {
    throw new Error('Only an Operations Analyst, Supply Chain Manager, or Administrator can submit a recovery plan.')
  }
  const disruption = getDisruptions().find(item => item.id === disruptionId)
  if (!disruption) throw new Error('The selected disruption no longer exists.')
  const shipment = shipmentForDisruption(disruption)
  const shipmentId = details.shipmentId || shipment?.id
  if (!shipmentId) throw new Error('This disruption is not linked to a shipment, so a shipment recovery plan cannot be submitted.')
  const strategy = strategyCodeFor(details)
  const cost = Number(details.cost)
  const recoveryDays = Number(details.recoveryDays)
  if (!Number.isFinite(cost) || cost < 0 || !Number.isInteger(recoveryDays) || recoveryDays < 0) {
    throw new Error('Provide a non-negative estimated cost and whole recovery days.')
  }
  const requiredActions = (Array.isArray(details.requiredActions) ? details.requiredActions : String(details.requiredActions || '').split('\n'))
    .map(action => String(action).trim()).filter(Boolean)
  const resources = (Array.isArray(details.resources) ? details.resources : String(details.resources || '').split('\n'))
    .map(resource => String(resource).trim()).filter(Boolean)
  if (!requiredActions.length || !resources.length) {
    throw new Error('Provide at least one required action and one resource or responsible team.')
  }
  const params = await strategyParameters(strategy, details, shipmentId)
  const created = await createRecoveryPlanApi({
    shipmentId,
    strategy,
    estimatedCost: cost,
    estimatedRecoveryDays: recoveryDays,
    ordersSaved: Math.max(0, Math.round(Number(details.ordersSaved ?? disruption.affectedOrders ?? 1))),
    ...params,
  })
  await refreshWorkflow()
  const plan = cache.plans.find(item => item.id === created?.id)
  return plan || normalizePlan(created)
}

export async function decideRecoveryPlan(planId, decision, comments = '', actor = getCurrentActor()) {
  if (!['Supply Chain Manager', 'Procurement Approver', 'Administrator'].includes(actor.role)) {
    throw new Error('Only a Supply Chain Manager, Procurement Approver, or Administrator can decide a recovery plan.')
  }
  if (!['approved', 'rejected', 'modification_requested'].includes(decision)) throw new Error('Unsupported approval decision.')
  const reason = String(comments || '').trim()
  if (decision === 'approved') {
    await approveRecoveryPlan(planId, reason || 'Approved after review.')
  } else {
    if (!reason) throw new Error('A comment is required for rejection or modification requests.')
    const message = decision === 'modification_requested' ? `Modification requested: ${reason}` : reason
    await rejectRecoveryPlan(planId, message)
  }
  await refreshWorkflow()
  return cache.plans.find(item => item.id === planId) || null
}

export function savePlanForLater(planId, actor = getCurrentActor()) {
  if (actor.role !== 'Supply Chain Manager' && actor.role !== 'Administrator') {
    throw new Error('Only a Supply Chain Manager can save a plan for later.')
  }
  const plan = cache.plans.find(item => item.id === planId)
  if (!plan) throw new Error('Recovery plan not found.')
  persistSavedPlan(planId, actor)
  plan.savedBy = savedPlanIds()
  dispatchUpdate()
  return plan
}

export function recordAdditionalApproval(planId, approvalId, actor = getCurrentActor()) {
  const plan = cache.plans.find(item => item.id === planId)
  if (!plan) throw new Error('Recovery plan not found.')
  if (plan.approval_status !== 'approved') throw new Error('Additional approvals can only be recorded for an approved plan.')
  let parsed = {}
  try { parsed = JSON.parse(localStorage.getItem(LOCAL_APPROVALS_KEY) || '{}') } catch { parsed = {} }
  const approved = new Set(Array.isArray(parsed[planId]) ? parsed[planId] : [])
  if (approved.has(approvalId)) throw new Error('This additional approval has already been recorded.')
  approved.add(approvalId)
  parsed[planId] = [...approved]
  localStorage.setItem(LOCAL_APPROVALS_KEY, JSON.stringify(parsed))
  dispatchUpdate()
  return plan
}

export async function authorizeExecution(planId, actor = getCurrentActor()) {
  if (actor.role !== 'Supply Chain Manager' && actor.role !== 'Administrator') {
    throw new Error('Only a Supply Chain Manager can authorize and execute a recovery plan.')
  }
  const plan = cache.plans.find(item => item.id === planId)
  if (!plan) throw new Error('Recovery plan not found.')
  if (plan.approval_status !== 'approved' && plan.approval_status !== 'executed') {
    throw new Error('Only an approved recovery plan can be authorized for execution.')
  }
  if (plan.createdByUserId === actor.id) {
    throw new Error('The recovery-plan creator cannot execute this plan.')
  }
  const result = await executeRecoveryPlan(planId)
  await refreshWorkflow()
  return cache.plans.find(item => item.id === planId) || normalizePlan(result)
}

export async function recordExecutionUpdate(planId, taskId, status, comments = '', actor = getCurrentActor()) {
  if (!['Warehouse Operator', 'Supply Chain Manager', 'Administrator'].includes(actor.role)) {
    throw new Error('Progress updates require a Warehouse Operator, Supply Chain Manager, or Administrator.')
  }
  if (!['pending', 'in_progress', 'blocked', 'completed'].includes(status)) throw new Error('Unsupported task status.')
  const progressStatus = status === 'completed' ? 'COMPLETED' : status === 'blocked' ? 'BLOCKED' : 'IN_PROGRESS'
  const completionPercentage = status === 'completed' ? 100 : status === 'blocked' ? 50 : status === 'in_progress' ? 50 : 0
  if (status === 'blocked' && !String(comments || '').trim()) {
    throw new Error('A blocker description is required when recording a blocked task.')
  }
  await updateRecoveryProgress(planId, {
    completionPercentage,
    status: progressStatus,
    milestone: taskId || '',
    blocker: status === 'blocked' ? String(comments).trim() : '',
    notes: String(comments || '').trim(),
  })
  await refreshWorkflow()
  return cache.plans.find(item => item.id === planId) || null
}

export function getNotifications() {
  return cache.notifications
}

export async function markWorkflowNotificationRead(id) {
  const notification = cache.notifications.find(item => item.id === id)
  if (!notification || notification.read) return notification
  const updated = await markNotificationReadApi(id)
  Object.assign(notification, normalizeNotification(updated))
  notification.read = true
  dispatchUpdate()
  return notification
}

export async function getPlanAudit(planId) {
  const payload = await auditRecoveryPlan(planId)
  return asList(payload).map(normalizeAudit)
}

export async function loadRecoveryPlan(planId) {
  const payload = await getRecoveryPlan(planId)
  return normalizePlan(payload)
}

try {
  await hydrateWorkflow()
} catch (error) {
  console.error('[DisruptionIQ] Initial workflow hydration failed:', error)
}
