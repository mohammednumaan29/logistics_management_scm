import { apiRequest as authenticatedRequest } from './api/client.js';
import { requireRole } from './api/client.js';
await requireRole('WAREHOUSE_OPERATOR');
import './workspaces/warehouse-operator.css'
import './workspaces/dashboard-consistency.css'

import { getCurrentActor, getDisruptions, getWorkflowState } from './workspaces/recovery-workflow.js'
import { inventoryItems, shipments, warehouseSummary } from './workspaces/operations-analyst-data.js'

const API_BASE = '/api'
const SETTINGS_KEY = 'disruptioniq.warehouse-operator.settings.v1'
const actor = getCurrentActor()
const clone = (value) => JSON.parse(JSON.stringify(value))
const progressByPlan = new Map()
const historyByPlan = new Map()
let notifications = []
let previousPage = 'overview'
let selectedPlanId = ''
let selectedShipmentId = ''
let assignmentFilter = { query: '', status: 'all' }
let overviewFilter = 'all'
let shipmentFilter = { query: '', status: 'all', warehouse: 'all' }
let inventoryFilter = { query: '', status: 'all' }
let currentPage = 'overview'

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function number(value) {
  return new Intl.NumberFormat().format(Number(value) || 0)
}

function date(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return 'Not recorded'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat(undefined, options).format(parsed)
}

function dateTime(value) {
  return date(value, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function titleCase(value) {
  return String(value || 'Unknown').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function setStatus(id, message, kind = '') {
  const element = document.getElementById(id)
  if (!element) return
  element.textContent = message
  element.dataset.kind = kind
}

function safeJSON(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function currentAssignments() {
  const snapshot = getWorkflowState()
  const disruptions = getDisruptions()
  const alerts = new Map(disruptions.map((item) => [item.id, item]))
  const shipmentById = new Map(shipments.map((item) => [item.id, item]))
  return snapshot.plans
    .filter((plan) => plan.approval_status === 'approved' && plan.execution_authorisation_status === 'authorized')
    .flatMap((plan) => {
      const disruption = alerts.get(plan.disruptionId)
      const relatedShipments = (disruption?.shipments || []).map((id) => shipmentById.get(id)).filter(Boolean)
      const latestProgress = progressByPlan.get(plan.id)?.latest
      const tasks = plan.tasks?.length
        ? plan.tasks
        : [{
            id: `${plan.id}-execution`,
            title: 'Recovery execution',
            team: 'Execution team',
            assignedRole: actor.role,
            dueAt: null,
            status: 'pending',
            updatedAt: '',
          }]
      const completed = tasks.filter((item) => item.status === 'completed').length
      const taskProgress = latestProgress?.completionPercentage ?? plan.progressPercentage
      return tasks.map((task) => ({
        plan,
        task,
        disruption,
        relatedShipments,
        shipment: relatedShipments[0] || null,
        completionPercentage: taskProgress != null && Number.isFinite(Number(taskProgress))
          ? Number(taskProgress)
          : plan.tasks?.length ? Math.round(completed / plan.tasks.length * 100) : 0,
        status: latestProgress?.status
          ? normalizeStatus(latestProgress.status)
          : task.status,
        updatedAt: latestProgress?.updatedAt || latestProgress?.createdAt || task.updatedAt || '',
      }))
    })
    .sort((left, right) => String(right.updatedAt || right.plan.createdAt).localeCompare(String(left.updatedAt || left.plan.createdAt)))
}

function normalizeStatus(status) {
  const normalized = String(status || '').toLowerCase().replaceAll('-', '_')
  if (normalized === 'in_progress') return 'in_progress'
  if (normalized === 'completed' || normalized === 'successful') return 'completed'
  if (normalized === 'blocked') return 'blocked'
  return 'pending'
}

function available(product) {
  return Number(product.quantity || 0) - Number(product.reserved || 0)
}

function stockStatus(product) {
  const quantity = available(product)
  if (quantity <= 0) return 'critical'
  if (quantity <= Number(product.reorderThreshold || 0)) return 'low'
  return 'healthy'
}

function statusBadge(status) {
  const normalized = normalizeStatus(status)
  return `<span class="wo-status" data-status="${esc(normalized)}">${titleCase(normalized)}</span>`
}

function statusPill(status) {
  return `<span class="wo-status" data-status="${esc(status)}">${titleCase(status)}</span>`
}

function progressValue(assignment) {
  return Math.max(0, Math.min(100, Number(assignment.completionPercentage) || 0))
}

function shipmentSupplier(shipment) {
  const suppliers = [...new Set((shipment?.productIds || [])
    .map((id) => inventoryItems.find((product) => product.productId === id)?.supplier)
    .filter(Boolean))]
  if (suppliers.length) return suppliers.join(', ')
  return shipment?.direction === 'inbound' ? shipment.carrier : 'Not recorded'
}

function warehouseOptions() {
  const values = [...new Set(inventoryItems.map((product) => product.warehouse).filter(Boolean))]
  const select = document.getElementById('shipment-warehouse')
  const selected = shipmentFilter.warehouse
  select.innerHTML = `<option value="all">All warehouses</option>${values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}`
  select.value = values.includes(selected) ? selected : 'all'
  shipmentFilter.warehouse = select.value
}

function filteredShipments() {
  const query = shipmentFilter.query.toLowerCase()
  return shipments.filter((shipment) => {
    const suppliers = shipmentSupplier(shipment)
    const warehouse = shipment.destination
    return (!query || `${shipment.id} ${shipment.orderId} ${suppliers} ${shipment.destination} ${shipment.carrier}`.toLowerCase().includes(query)) &&
      (shipmentFilter.status === 'all' || shipment.status === shipmentFilter.status) &&
      (shipmentFilter.warehouse === 'all' || shipment.productIds.some((id) => {
        const product = inventoryItems.find((item) => item.productId === id)
        return product?.warehouse === shipmentFilter.warehouse
      }) || shipment.destination === shipmentFilter.warehouse)
  })
}

function shipmentRows(records, limit = Infinity) {
  return records.slice(0, limit).map((shipment) => `<tr>
    <td><button class="wo-link" data-open-shipment="${esc(shipment.id)}">${esc(shipment.id)}</button><small>${esc(shipment.orderId)}</small></td>
    <td>${esc(shipmentSupplier(shipment))}</td><td>${esc(shipment.destination)}</td>
    <td>${statusPill(shipment.status)}</td><td>${date(shipment.expectedDate)}</td>
    <td>${number(shipment.quantity)} ${esc(shipment.productIds.map((id) => inventoryItems.find((product) => product.productId === id)?.unit).filter(Boolean)[0] || 'units')}</td>
  </tr>`).join('')
}

function assignmentRows(records, includeWarehouse = false) {
  const columns = includeWarehouse ? 9 : 8
  return records.map((assignment) => {
    const plan = assignment.plan
    const task = assignment.task
    const shipmentLink = assignment.shipment
      ? `<button class="wo-link" data-open-shipment="${esc(assignment.shipment.id)}">${esc(assignment.shipment.id)}</button>`
      : 'Not linked'
    const warehouse = assignment.shipment
      ? assignment.shipment.productIds.map((id) => inventoryItems.find((product) => product.productId === id)?.warehouse).filter(Boolean)[0] || 'Not recorded'
      : 'Not recorded'
    const updated = assignment.updatedAt ? dateTime(assignment.updatedAt) : 'No update recorded'
    return `<tr>
      <td><button class="wo-link" data-open-plan="${esc(plan.id)}">${esc(plan.id)}</button><small>${esc(task.id)} · ${esc(task.title)}</small></td>
      <td>${shipmentLink}</td><td>${esc(plan.strategy)}</td>${includeWarehouse ? `<td>${esc(warehouse)}</td>` : ''}
      <td>${number(plan.recoveryDays)} day(s)</td><td>${statusBadge(assignment.status)}</td>
      <td><div class="wo-progress-cell"><div class="wo-progress"><span style="width:${progressValue(assignment)}%"></span></div><small>${progressValue(assignment)}%</small></div></td>
      <td>${updated}</td><td><button class="wo-button wo-button-small" data-report-progress="${esc(plan.id)}">Update</button></td>
    </tr>`
  }).join('') || `<tr><td colspan="${columns}" class="wo-empty">No assigned recovery tasks match this filter.</td></tr>`
}

function renderKpis(assignments) {
  const count = (status) => assignments.filter((item) => item.status === status).length
  const blockers = assignments.filter((item) => item.status === 'blocked').length
  const relatedShipmentIds = new Set(assignments.flatMap((item) => item.relatedShipments.map((shipment) => shipment.id)))
  const cards = [
    ['Assigned Recovery Tasks', assignments.length, 'Tasks assigned to this operator role'],
    ['Active Recovery Tasks', count('in_progress'), 'Currently in progress'],
    ['Pending Tasks', count('pending'), 'Awaiting work'],
    ['Completed Tasks', count('completed'), 'Reported complete'],
    ['Operational Blockers', blockers, 'Assigned tasks currently blocked'],
    ['Shipments to Monitor', relatedShipmentIds.size, 'Linked to assigned recovery work'],
  ]
  document.getElementById('wo-kpis').innerHTML = cards.map(([label, value, note], index) => `<article class="wo-kpi"><span class="wo-kpi-icon" aria-hidden="true">${['▦', '↗', '◷', '✓', '!', '⇢'][index]}</span><div><span class="wo-kpi-label">${esc(label)}</span><strong>${number(value)}</strong><small>${esc(note)}</small></div></article>`).join('')
}

function renderOverview() {
  const assignments = currentAssignments()
  renderKpis(assignments)
  const selected = assignments.filter((item) => overviewFilter === 'all' || item.status === overviewFilter)
  document.getElementById('overview-task-table').innerHTML = assignmentRows(selected)
  const shipmentIds = new Set(assignments.flatMap((item) => item.relatedShipments.map((shipment) => shipment.id)))
  const relatedShipments = shipments.filter((shipment) => shipmentIds.has(shipment.id))
  document.getElementById('overview-shipments').innerHTML = shipmentRows(relatedShipments, 6) ||
    '<tr><td colspan="6" class="wo-empty">No shipments are linked to assigned recovery tasks.</td></tr>'
  renderAlerts(assignments, relatedShipments)
  renderActivityList('overview-activity', 5)
}

function renderAlerts(assignments, relatedShipments) {
  const alerts = []
  relatedShipments.filter((shipment) => shipment.status === 'delayed').forEach((shipment) => {
    alerts.push({ type: 'warning', title: `Delayed shipment · ${shipment.id}`, detail: `${shipment.destination} · expected ${date(shipment.expectedDate)}` })
  })
  assignments.filter((item) => item.status === 'blocked').forEach((item) => {
    alerts.push({ type: 'critical', title: `Blocked task · ${item.task.id}`, detail: `${item.plan.id} · ${item.task.title}` })
  })
  assignments.filter((item) => item.status === 'pending').forEach((item) => {
    alerts.push({ type: 'neutral', title: `Pending recovery task · ${item.task.id}`, detail: `${item.plan.id} · due ${date(item.task.dueAt)}` })
  })
  const relatedProductIds = new Set(relatedShipments.flatMap((shipment) => shipment.productIds))
  inventoryItems.filter((product) => relatedProductIds.has(product.productId) && stockStatus(product) !== 'healthy').forEach((product) => {
    alerts.push({ type: stockStatus(product) === 'critical' ? 'critical' : 'warning', title: `Stock ${stockStatus(product)} · ${product.productName}`, detail: `${number(available(product))} ${product.unit} available · reorder point ${number(product.reorderThreshold)}` })
  })
  document.getElementById('wo-alert-list').innerHTML = alerts.map((alert) => `<article class="wo-alert" data-level="${alert.type}"><i></i><div><strong>${esc(alert.title)}</strong><p>${esc(alert.detail)}</p></div></article>`).join('') ||
    '<p class="wo-empty-text">No operational alerts are present in the assigned records.</p>'
}

function renderShipmentPage() {
  warehouseOptions()
  const rows = filteredShipments()
  document.getElementById('shipment-table').innerHTML = rows.map((shipment) => `<tr>
    <td><button class="wo-link" data-open-shipment="${esc(shipment.id)}">${esc(shipment.id)}</button><small>${esc(shipment.orderId)}</small></td>
    <td>${number(shipment.quantity)} ${esc(shipment.productIds.map((id) => inventoryItems.find((product) => product.productId === id)?.unit).filter(Boolean)[0] || 'units')}</td>
    <td>${statusPill(shipment.status)}</td><td>${date(shipment.expectedDate)}</td><td>${esc(shipmentSupplier(shipment))}</td>
    <td>${esc(shipment.destination)}</td><td><button class="wo-button wo-button-small wo-button-secondary" data-open-shipment="${esc(shipment.id)}">Details</button></td>
  </tr>`).join('') || '<tr><td colspan="7" class="wo-empty">No shipments match the current filters.</td></tr>'
}

function renderWarehouses() {
  const grouped = new Map()
  inventoryItems.forEach((product) => {
    if (!grouped.has(product.warehouse)) grouped.set(product.warehouse, [])
    grouped.get(product.warehouse).push(product)
  })
  document.getElementById('warehouse-cards').innerHTML = [...grouped.entries()].map(([id, products]) => {
    const known = id === warehouseSummary.warehouseId
    const availableByUnit = [...new Set(products.map((product) => product.unit))]
      .map((unit) => `${number(products.filter((product) => product.unit === unit).reduce((sum, product) => sum + available(product), 0))} ${unit}`)
      .join(' · ')
    const capacity = known
      ? `${number(warehouseSummary.occupiedLocations)} / ${number(warehouseSummary.totalLocations)} locations (${Math.round(warehouseSummary.occupiedLocations / warehouseSummary.totalLocations * 100)}%)`
      : 'Not recorded'
    const name = known ? warehouseSummary.warehouseName : 'Name not supplied'
    return `<article class="wo-card wo-warehouse-card"><p class="wo-eyebrow">WAREHOUSE</p><h2>${esc(name)}</h2><p class="wo-warehouse-id">${esc(id)}</p><dl class="wo-detail-list"><div><dt>Location</dt><dd>${known ? 'Central distribution · location not specified' : 'Not recorded'}</dd></div><div><dt>Storage capacity</dt><dd>${capacity}</dd></div><div><dt>Associated inventory</dt><dd>${products.length} product records</dd></div><div><dt>Available stock</dt><dd>${esc(availableByUnit)}</dd></div></dl><button class="wo-button wo-button-secondary" data-open-warehouse="${esc(id)}">View inventory</button></article>`
  }).join('') || '<article class="wo-card"><p class="wo-empty-text">No warehouse records are available.</p></article>'
}

function renderInventory() {
  const query = inventoryFilter.query.toLowerCase()
  const products = inventoryItems.filter((product) => {
    const classification = stockStatus(product)
    return (!query || `${product.id} ${product.productId} ${product.productName} ${product.sku} ${product.warehouse} ${product.location}`.toLowerCase().includes(query)) &&
      (inventoryFilter.status === 'all' || classification === inventoryFilter.status)
  })
  document.getElementById('inventory-table').innerHTML = products.map((product) => `<tr>
    <td><button class="wo-link" data-open-product="${esc(product.productId)}">${esc(product.productName)}</button><small>${esc(product.id)} · ${esc(product.sku)}</small></td>
    <td>${esc(product.warehouse)}<small>${esc(product.location)}</small></td>
    <td>${number(product.quantity)} ${esc(product.unit)}</td><td>${number(product.reserved)} ${esc(product.unit)}</td>
    <td>${number(available(product))} ${esc(product.unit)}</td><td>${number(product.reorderThreshold)} ${esc(product.unit)}</td>
    <td>Not recorded</td><td><span class="wo-stock" data-status="${stockStatus(product)}">${titleCase(stockStatus(product))}</span></td>
  </tr>`).join('') || '<tr><td colspan="8" class="wo-empty">No inventory records match the current filters.</td></tr>'
}

function renderAssignments() {
  const query = assignmentFilter.query.toLowerCase()
  const rows = currentAssignments().filter((item) =>
    (!query || `${item.plan.id} ${item.task.id} ${item.task.title} ${item.plan.strategy} ${item.shipment?.id || ''}`.toLowerCase().includes(query)) &&
    (assignmentFilter.status === 'all' || item.status === assignmentFilter.status),
  )
  document.getElementById('assignment-table').innerHTML = assignmentRows(rows, true)
}

function renderTracking() {
  const assignments = currentAssignments()
  document.getElementById('tracking-plans').innerHTML = assignments.map((assignment) => `<article class="wo-card wo-tracking-card">
    <div class="wo-card-heading"><div><p class="wo-eyebrow">${esc(assignment.plan.id)} · ${esc(assignment.task.id)}</p><h2>${esc(assignment.task.title)}</h2><p>${esc(assignment.plan.strategy)}</p></div>${statusBadge(assignment.status)}</div>
    <dl class="wo-detail-list"><div><dt>Shipment</dt><dd>${assignment.shipment ? esc(assignment.shipment.id) : 'Not linked'}</dd></div><div><dt>Completion</dt><dd>${progressValue(assignment)}%</dd></div><div><dt>Last updated</dt><dd>${assignment.updatedAt ? dateTime(assignment.updatedAt) : 'No update recorded'}</dd></div><div><dt>Due date</dt><dd>${date(assignment.task.dueAt)}</dd></div></dl>
    <div class="wo-progress" role="progressbar" aria-label="Recovery progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressValue(assignment)}"><span style="width:${progressValue(assignment)}%"></span></div>
    <div class="wo-card-actions"><button class="wo-button wo-button-secondary" data-load-history="${esc(assignment.plan.id)}" ${assignment.shipment ? `data-shipment-id="${esc(assignment.shipment.id)}"` : ''}>View progress history</button><button class="wo-button" data-report-progress="${esc(assignment.plan.id)}" data-task-id="${esc(assignment.task.id)}">Report progress</button></div>
  </article>`).join('') || '<article class="wo-card"><p class="wo-empty-text">No authorized recovery assignments are available to this operator role.</p></article>'
  setStatus('tracking-api-status', assignments.length
    ? 'Assignments come from authorized backend recovery plans. Progress submissions are sent to the recovery-progress API.'
    : 'No operator-assigned execution tasks are available.', assignments.length ? 'info' : 'neutral')
}

function operatorActivities() {
  const state = getWorkflowState()
  const audit = state.audit.filter((entry) => entry.userId === actor.id)
  const progress = [...historyByPlan.entries()].flatMap(([planId, records]) => records.map((entry) => ({
    id: `progress-${planId}-${entry.id || entry.updatedAt || entry.createdAt}`,
    planId,
    timestamp: entry.updatedAt || entry.createdAt || entry.timestamp,
    action: 'Recovery progress updated',
    comments: [entry.milestone, entry.blocker ? `Blocker: ${entry.blocker}` : '', entry.notes].filter(Boolean).join(' · '),
    newStatus: entry.status,
    user: entry.updatedBy || entry.userName || actor.name,
    role: actor.role,
  })))
  return [...audit, ...progress].sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)))
}

function renderActivityList(targetId, limit = Infinity) {
  const activities = operatorActivities().slice(0, limit)
  document.getElementById(targetId).innerHTML = activities.map((entry) => `<article class="wo-timeline-item"><i></i><div><strong>${esc(entry.action)}</strong><p>${esc(entry.planId)}${entry.comments ? ` · ${esc(entry.comments)}` : ''}</p><small>${dateTime(entry.timestamp)} · ${esc(entry.user)} · ${titleCase(entry.newStatus)}</small></div></article>`).join('') ||
    '<p class="wo-empty-text">No activity records for this operator are available.</p>'
}

function renderActivityPage() {
  renderActivityList('activity-list')
}

function notificationRows() {
  const list = document.getElementById('notification-list')
  list.innerHTML = notifications.map((item) => `<article class="wo-notification ${item.read ? '' : 'is-unread'}">
    <span class="wo-notification-dot"></span><div><strong>${esc(item.title || 'Notification')}</strong><p>${esc(item.message || item.description || '')}</p>
    <small>${esc(titleCase(item.type || item.notificationType || 'Operational update'))} · ${dateTime(item.createdAt || item.timestamp)}</small></div>
    ${item.read ? '<span class="wo-read-label">Read</span>' : `<button class="wo-button wo-button-small wo-button-secondary" data-mark-read="${esc(item.id)}">Mark read</button>`}
  </article>`).join('') || '<article class="wo-card"><p class="wo-empty-text">No notifications were returned for this account.</p></article>'
  const unread = notifications.filter((item) => !item.read).length
  document.getElementById('wo-notification-count').textContent = unread ? String(unread) : ''
}

async function apiRequest(path, options = {}) {
  const apiPath = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return authenticatedRequest(apiPath, options);
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.records)) return payload.records
  return []
}

function extractProgress(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.records)) return payload.records
  if (payload && typeof payload === 'object' && ('completionPercentage' in payload || 'status' in payload)) return [payload]
  return []
}

function latestProgress(records) {
  return [...records].sort((left, right) =>
    String(right.updatedAt || right.createdAt || right.timestamp || '').localeCompare(String(left.updatedAt || left.createdAt || left.timestamp || '')),
  )[0] || null
}

async function loadProgressHistory(planId, shipmentId = '') {
  const planPayload = await apiRequest(`/recovery-progress/plan/${encodeURIComponent(planId)}`)
  const records = extractProgress(planPayload)
  let shipmentRecords = []
  if (shipmentId) {
    const shipmentPayload = await apiRequest(`/recovery-progress/shipment/${encodeURIComponent(shipmentId)}`)
    shipmentRecords = extractProgress(shipmentPayload)
  }
  historyByPlan.set(planId, records)
  progressByPlan.set(planId, { history: records, latest: latestProgress(records), shipmentHistory: shipmentRecords })
  renderTracking()
  renderOverview()
  renderAssignments()
  renderActivityPage()
  renderProgressHistory(planId)
  return records
}

function renderProgressHistory(planId) {
  const assignment = currentAssignments().find((item) => item.plan.id === planId)
  const plan = assignment?.plan
  document.getElementById('progress-history-heading').textContent = plan
    ? `${plan.id}${assignment.shipment ? ` · ${assignment.shipment.id}` : ''}`
    : 'Choose an assigned recovery plan to view its updates.'
  const records = historyByPlan.get(planId) || []
  document.getElementById('progress-history').innerHTML = records.map((entry) => `<article class="wo-history-item">
    <div><strong>${Number(entry.completionPercentage) || 0}% · ${titleCase(entry.status)}</strong><small>${dateTime(entry.updatedAt || entry.createdAt || entry.timestamp)} · ${esc(entry.updatedBy || entry.userName || 'Operator')}</small></div>
    ${entry.milestone ? `<p><b>Milestone:</b> ${esc(entry.milestone)}</p>` : ''}
    ${entry.blocker ? `<p class="wo-blocker-text"><b>Blocker:</b> ${esc(entry.blocker)}</p>` : ''}
    ${entry.notes ? `<p><b>Notes:</b> ${esc(entry.notes)}</p>` : ''}
  </article>`).join('') || '<p class="wo-empty-text">No progress history returned for this plan.</p>'
}

async function loadNotifications() {
  setStatus('notification-api-status', 'Loading notifications from the authenticated-user API…', 'info')
  try {
    const [listPayload, summaryPayload] = await Promise.all([
      apiRequest('/notifications'),
      apiRequest('/notifications/summary'),
    ])
    notifications = extractList(listPayload)
    const summary = summaryPayload?.data || summaryPayload || {}
    const unreadCount = Number(summary.unreadCount ?? summary.unread ?? notifications.filter((item) => !item.read).length)
    document.getElementById('notification-summary').textContent = `${number(unreadCount)} unread`
    setStatus('notification-api-status', '', '')
    notificationRows()
  } catch (error) {
    notifications = []
    document.getElementById('notification-summary').textContent = ''
    setStatus('notification-api-status', `Notifications are unavailable: ${error.message}`, 'error')
    notificationRows()
  }
}

async function markNotificationRead(notificationId) {
  setStatus('notification-api-status', 'Marking notification as read…', 'info')
  try {
    await apiRequest(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH' })
    await loadNotifications()
  } catch (error) {
    setStatus('notification-api-status', `Could not update notification: ${error.message}`, 'error')
  }
}

function showPage(page) {
  const view = document.querySelector(`[data-page="${CSS.escape(page)}"]`)
  const next = view ? page : 'overview'
  document.querySelectorAll('.wo-view').forEach((element) => { element.hidden = element.dataset.page !== next })
  document.querySelectorAll('.wo-nav a').forEach((link) => {
    const active = link.hash.slice(1) === next
    link.classList.toggle('is-active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  if (next !== 'detail') previousPage = next
  currentPage = next
  if (next === 'tracking') renderTracking()
  if (next === 'activity') renderActivityPage()
  if (next === 'notifications') void loadNotifications()
  window.scrollTo(0, 0)
}

function detailsForShipment(id) {
  const shipment = shipments.find((item) => item.id === id)
  if (!shipment) return null
  const products = inventoryItems.filter((product) => shipment.productIds.includes(product.productId))
  const relatedPlans = currentAssignments().filter((item) => item.relatedShipments.some((record) => record.id === id))
  const progressHistory = relatedPlans.flatMap((item) => historyByPlan.get(item.plan.id) || [])
  return `<article class="wo-card"><h2>Shipment information</h2><dl class="wo-detail-list"><div><dt>Shipment ID</dt><dd>${esc(shipment.id)}</dd></div><div><dt>Order</dt><dd>${esc(shipment.orderId)}</dd></div><div><dt>Quantity</dt><dd>${number(shipment.quantity)} ${esc(products[0]?.unit || 'units')}</dd></div><div><dt>Status</dt><dd>${statusPill(shipment.status)}</dd></div><div><dt>Supplier</dt><dd>${esc(shipmentSupplier(shipment))}</dd></div><div><dt>Origin</dt><dd>${esc(shipment.origin)}</dd></div><div><dt>Destination warehouse / location</dt><dd>${esc(shipment.destination)}</dd></div><div><dt>Expected delivery</dt><dd>${date(shipment.expectedDate)}</dd></div><div><dt>Delay / exception</dt><dd>${esc(shipment.delayReason || 'None recorded')}</dd></div></dl></article>
    <article class="wo-card"><h2>Associated inventory</h2>${products.map((product) => `<p><button class="wo-link" data-open-product="${esc(product.productId)}">${esc(product.productName)} · ${esc(product.productId)}</button> · ${number(available(product))} ${esc(product.unit)} available</p>`).join('') || '<p class="wo-empty-text">No linked inventory records were supplied.</p>'}</article>
    <article class="wo-card"><h2>Related recovery assignments</h2>${relatedPlans.map((item) => `<p><button class="wo-link" data-open-plan="${esc(item.plan.id)}">${esc(item.plan.id)}</button> · ${esc(item.plan.strategy)} · ${titleCase(item.status)} · ${progressValue(item)}%</p>`).join('') || '<p class="wo-empty-text">No assigned recovery plans are linked to this shipment.</p>'}${progressHistory.map((entry) => `<p class="wo-muted">${dateTime(entry.updatedAt || entry.createdAt)} · ${Number(entry.completionPercentage) || 0}% · ${titleCase(entry.status)}</p>`).join('')}</article>`
}

function detailsForPlan(id) {
  const assignment = currentAssignments().find((item) => item.plan.id === id)
  if (!assignment) return null
  const plan = assignment.plan
  const products = inventoryItems.filter((product) => assignment.relatedShipments.some((shipment) => shipment.productIds.includes(product.productId)))
  return `<div class="wo-detail-grid">
    <article class="wo-card"><h2>Approved recovery plan</h2><dl class="wo-detail-list"><div><dt>Plan ID</dt><dd>${esc(plan.id)}</dd></div><div><dt>Approval</dt><dd>${titleCase(plan.approval_status)}</dd></div><div><dt>Authorization</dt><dd>${titleCase(plan.execution_authorisation_status)}</dd></div><div><dt>Approved strategy</dt><dd>${esc(plan.strategy)}</dd></div><div><dt>Estimated recovery</dt><dd>${number(plan.recoveryDays)} day(s)</dd></div><div><dt>Estimated cost</dt><dd>${number(plan.cost)} INR · estimate</dd></div><div><dt>Task</dt><dd>${esc(assignment.task.id)} · ${esc(assignment.task.title)}</dd></div><div><dt>Current status</dt><dd>${titleCase(assignment.status)}</dd></div><div><dt>Completion</dt><dd>${progressValue(assignment)}%</dd></div><div><dt>Last update</dt><dd>${assignment.updatedAt ? dateTime(assignment.updatedAt) : 'Not recorded'}</dd></div></dl><p><strong>Required actions:</strong> ${esc((plan.requiredActions || []).join('; ') || 'Not supplied')}</p><p><strong>Resources:</strong> ${esc((plan.resources || []).join('; ') || 'Not supplied')}</p></article>
    <article class="wo-card"><h2>Related shipment</h2>${assignment.relatedShipments.map((shipment) => `<p><button class="wo-link" data-open-shipment="${esc(shipment.id)}">${esc(shipment.id)}</button> · ${esc(shipment.destination)} · ${titleCase(shipment.status)}</p>`).join('') || '<p class="wo-empty-text">No shipment link was supplied.</p>'}<h2>Relevant inventory</h2>${products.map((product) => `<p>${esc(product.productName)} · ${esc(product.warehouse)} · ${number(available(product))} ${esc(product.unit)} available</p>`).join('') || '<p class="wo-empty-text">No related inventory record was supplied.</p>'}<button class="wo-button" data-report-progress="${esc(plan.id)}" data-task-id="${esc(assignment.task.id)}">Report progress</button></article>
    <article class="wo-card"><h2>Completed milestones and blockers</h2>${(historyByPlan.get(plan.id) || []).map((entry) => `<p>${dateTime(entry.updatedAt || entry.createdAt)} · ${Number(entry.completionPercentage) || 0}% · ${titleCase(entry.status)}${entry.milestone ? ` · Milestone: ${esc(entry.milestone)}` : ''}${entry.blocker ? ` · Blocker: ${esc(entry.blocker)}` : ''}${entry.notes ? ` · ${esc(entry.notes)}` : ''}</p>`).join('') || '<p class="wo-empty-text">No backend progress history loaded. Select View progress history on Recovery Tracking to load it.</p>'}</article>
  </div>`
}

function openDetail(title, subtitle, content) {
  if (!content) return
  document.getElementById('detail-title').textContent = title
  document.getElementById('detail-subtitle').textContent = subtitle
  document.getElementById('detail-content').innerHTML = content
  showPage('detail')
}

function showShipmentDetails(id) {
  const shipment = shipments.find((item) => item.id === id)
  if (!shipment) return
  selectedShipmentId = id
  openDetail(`Shipment ${id}`, `${shipment.orderId} · ${shipment.destination}`, detailsForShipment(id))
}

function showPlanDetails(id) {
  const assignment = currentAssignments().find((item) => item.plan.id === id)
  if (!assignment) return
  selectedPlanId = id
  openDetail(`Recovery assignment ${id}`, `${assignment.task.id} · ${assignment.task.title}`, detailsForPlan(id))
}

function showProductDetails(id) {
  const product = inventoryItems.find((item) => item.productId === id)
  if (!product) return
  openDetail(product.productName, `${product.productId} · ${product.sku}`, `<article class="wo-card"><h2>Inventory details</h2><dl class="wo-detail-list"><div><dt>Warehouse</dt><dd>${esc(product.warehouse)}</dd></div><div><dt>Location</dt><dd>${esc(product.location)}</dd></div><div><dt>Category</dt><dd>${esc(product.category)}</dd></div><div><dt>Supplier</dt><dd>${esc(product.supplier)}</dd></div><div><dt>On hand</dt><dd>${number(product.quantity)} ${esc(product.unit)}</dd></div><div><dt>Reserved</dt><dd>${number(product.reserved)} ${esc(product.unit)}</dd></div><div><dt>Available</dt><dd>${number(available(product))} ${esc(product.unit)}</dd></div><div><dt>Reorder point</dt><dd>${number(product.reorderThreshold)} ${esc(product.unit)}</dd></div><div><dt>Daily demand</dt><dd>Not recorded</dd></div><div><dt>Stock status</dt><dd>${titleCase(stockStatus(product))} · frontend-derived</dd></div></dl></article>`)
}

function showWarehouseDetails(id) {
  const products = inventoryItems.filter((product) => product.warehouse === id)
  if (!products.length) return
  const known = id === warehouseSummary.warehouseId
  openDetail(known ? warehouseSummary.warehouseName : `Warehouse ${id}`, id, `<article class="wo-card"><h2>Warehouse overview</h2><dl class="wo-detail-list"><div><dt>Warehouse ID</dt><dd>${esc(id)}</dd></div><div><dt>Name</dt><dd>${known ? esc(warehouseSummary.warehouseName) : 'Not supplied'}</dd></div><div><dt>Location</dt><dd>Not recorded</dd></div><div><dt>Capacity</dt><dd>${known ? `${number(warehouseSummary.occupiedLocations)} of ${number(warehouseSummary.totalLocations)} locations` : 'Not recorded'}</dd></div><div><dt>Associated inventory</dt><dd>${products.length} product record(s)</dd></div></dl></article><article class="wo-card"><h2>Products stored here</h2><div class="wo-table-wrap"><table class="wo-table"><thead><tr><th>Product</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Reorder point</th></tr></thead><tbody>${products.map((product) => `<tr><td>${esc(product.productName)}</td><td>${number(product.quantity)} ${esc(product.unit)}</td><td>${number(product.reserved)} ${esc(product.unit)}</td><td>${number(available(product))} ${esc(product.unit)}</td><td>${number(product.reorderThreshold)} ${esc(product.unit)}</td></tr>`).join('')}</tbody></table></div></article>`)
}

function openProgressDialog(planId) {
  const assignment = currentAssignments().find((item) => item.plan.id === planId)
  if (!assignment) {
    setStatus('tracking-api-status', 'This plan is not assigned to the Warehouse Operator role.', 'error')
    return
  }
  selectedPlanId = planId
  const form = document.getElementById('progress-form')
  form.reset()
  form.elements.completionPercentage.value = progressValue(assignment)
  form.elements.status.value = assignment.status.toUpperCase()
  document.getElementById('progress-dialog-title').textContent = `Report progress · ${planId}`
  document.getElementById('progress-dialog-context').textContent = `${assignment.task.id} · ${assignment.task.title} · ${assignment.plan.strategy}`
  setStatus('progress-dialog-message', 'Backend validates assignment ownership and accepted status values.', 'info')
  document.getElementById('progress-dialog').showModal()
}

async function submitProgress(event) {
  event.preventDefault()
  const form = event.currentTarget
  const values = new FormData(form)
  const completionPercentage = Number(values.get('completionPercentage'))
  const status = String(values.get('status') || '')
  const milestone = String(values.get('milestone') || '').trim()
  const blocker = String(values.get('blocker') || '').trim()
  const notes = String(values.get('notes') || '').trim()
  if (!Number.isInteger(completionPercentage) || completionPercentage < 0 || completionPercentage > 100) {
    setStatus('progress-dialog-message', 'Completion percentage must be a whole number from 0 to 100.', 'error')
    return
  }
  if (!['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'].includes(status)) {
    setStatus('progress-dialog-message', 'Select a supported recovery status.', 'error')
    return
  }
  if (status === 'BLOCKED' && !blocker) {
    setStatus('progress-dialog-message', 'Describe the blocker before reporting a blocked task.', 'error')
    return
  }
  if (status === 'COMPLETED' && completionPercentage !== 100) {
    setStatus('progress-dialog-message', 'Set completion to 100% before reporting the task as completed.', 'error')
    return
  }
  const submit = document.getElementById('progress-submit')
  submit.disabled = true
  setStatus('progress-dialog-message', 'Submitting update to the backend…', 'info')
  try {
    await apiRequest(`/recovery-progress/${encodeURIComponent(selectedPlanId)}`, {
      method: 'POST',
      body: JSON.stringify({ completionPercentage, status, milestone, blocker, notes }),
    })
    let refreshError = ''
    const assignment = currentAssignments().find((item) => item.plan.id === selectedPlanId)
    try {
      await loadProgressHistory(selectedPlanId, assignment?.shipment?.id || '')
    } catch (error) {
      refreshError = ` The update was accepted, but history could not be refreshed: ${error.message}`
    }
    document.getElementById('progress-dialog').close()
    setStatus('tracking-api-status', `Backend confirmed the recovery progress update.${refreshError}`, refreshError ? 'warning' : 'success')
    renderTracking()
    renderOverview()
    renderAssignments()
    renderActivityPage()
  } catch (error) {
    setStatus('progress-dialog-message', `Update was not saved: ${error.message}`, 'error')
  } finally {
    submit.disabled = false
  }
}

function renderAll() {
  renderOverview()
  renderShipmentPage()
  renderWarehouses()
  renderInventory()
  renderAssignments()
  renderTracking()
  renderActivityPage()
  renderNotificationBadge()
}

function renderNotificationBadge() {
  const count = notifications.filter((item) => !item.read).length
  document.getElementById('wo-notification-count').textContent = count ? String(count) : ''
}

function initializeSettings() {
  const saved = safeJSON(localStorage.getItem(SETTINGS_KEY)) || {}
  const displayName = actor.name || 'Warehouse Operator'
  document.getElementById('wo-sidebar-name').textContent = displayName
  document.getElementById('wo-sidebar-username').textContent = `${actor.id} · Backend`
  document.getElementById('wo-welcome-name').textContent = displayName
  document.getElementById('settings-name').textContent = displayName
  document.getElementById('settings-username').textContent = actor.id
  document.getElementById('settings-notifications').checked = saved.notificationsEnabled !== false
  document.getElementById('settings-compact').checked = saved.compactTables === true
  document.body.dataset.compact = saved.compactTables ? 'true' : 'false'
  document.getElementById('settings-save').addEventListener('click', () => {
    const preferences = {
      notificationsEnabled: document.getElementById('settings-notifications').checked,
      compactTables: document.getElementById('settings-compact').checked,
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences))
    document.body.dataset.compact = preferences.compactTables ? 'true' : 'false'
    setStatus('settings-message', 'Preferences saved in this browser.', 'success')
    renderNotificationBadge()
  })
}

if (actor.role !== 'Warehouse Operator') {
  document.querySelector('.wo-page').innerHTML = '<section class="wo-card wo-access"><h1>Access unavailable</h1><p>This workspace is restricted to the Warehouse Operator role in this workspace.</p><a class="wo-button" href="/src/role-selection.html">Return to role selection</a><p class="wo-muted">Access is also enforced by the backend JWT role check; this page is not a security boundary.</p></section>'
} else {
  document.getElementById('wo-date').textContent = date(new Date(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  document.getElementById('settings-auth-state').textContent = 'JWT session · backend authorization enforced'
  initializeSettings()
  renderAll()

  document.querySelector('.wo-nav').addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]')
    if (!link) return
    event.preventDefault()
    const page = link.hash.slice(1)
    if (location.hash !== `#${page}`) history.pushState(null, '', `#${page}`)
    showPage(page)
  })
  document.addEventListener('click', (event) => {
    const shipmentButton = event.target.closest('[data-open-shipment]')
    if (shipmentButton) {
      showShipmentDetails(shipmentButton.dataset.openShipment)
      return
    }
    const planButton = event.target.closest('[data-open-plan]')
    if (planButton) {
      showPlanDetails(planButton.dataset.openPlan)
      return
    }
    const productButton = event.target.closest('[data-open-product]')
    if (productButton) {
      showProductDetails(productButton.dataset.openProduct)
      return
    }
    const warehouseButton = event.target.closest('[data-open-warehouse]')
    if (warehouseButton) {
      showWarehouseDetails(warehouseButton.dataset.openWarehouse)
      return
    }
    const reportButton = event.target.closest('[data-report-progress]')
    if (reportButton) {
      openProgressDialog(reportButton.dataset.reportProgress)
      return
    }
    const historyButton = event.target.closest('[data-load-history]')
    if (historyButton) {
      setStatus('tracking-api-status', 'Loading progress history…', 'info')
      loadProgressHistory(historyButton.dataset.loadHistory, historyButton.dataset.shipmentId || '')
        .then(() => setStatus('tracking-api-status', '', ''))
        .catch((error) => setStatus('tracking-api-status', `Progress history is unavailable: ${error.message}`, 'error'))
      return
    }
    const markReadButton = event.target.closest('[data-mark-read]')
    if (markReadButton) void markNotificationRead(markReadButton.dataset.markRead)
  })
  document.getElementById('detail-back').addEventListener('click', () => {
    if (location.hash !== `#${previousPage}`) history.pushState(null, '', `#${previousPage}`)
    showPage(previousPage)
  })
  document.getElementById('progress-form').addEventListener('submit', (event) => void submitProgress(event))
  document.querySelector('.wo-dialog-close').addEventListener('click', () => document.getElementById('progress-dialog').close())
  document.getElementById('progress-cancel').addEventListener('click', () => document.getElementById('progress-dialog').close())
  document.getElementById('progress-dialog').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close()
  })

  document.getElementById('overview-task-filter').addEventListener('change', (event) => {
    overviewFilter = event.target.value
    renderOverview()
  })
  document.getElementById('shipment-search').addEventListener('input', (event) => {
    shipmentFilter.query = event.target.value.trim()
    renderShipmentPage()
  })
  document.getElementById('shipment-status').addEventListener('change', (event) => {
    shipmentFilter.status = event.target.value
    renderShipmentPage()
  })
  document.getElementById('shipment-warehouse').addEventListener('change', (event) => {
    shipmentFilter.warehouse = event.target.value
    renderShipmentPage()
  })
  document.getElementById('inventory-search').addEventListener('input', (event) => {
    inventoryFilter.query = event.target.value.trim()
    renderInventory()
  })
  document.getElementById('inventory-status').addEventListener('change', (event) => {
    inventoryFilter.status = event.target.value
    renderInventory()
  })
  document.getElementById('assignment-search').addEventListener('input', (event) => {
    assignmentFilter.query = event.target.value.trim()
    renderAssignments()
  })
  document.getElementById('assignment-status').addEventListener('change', (event) => {
    assignmentFilter.status = event.target.value
    renderAssignments()
  })
  document.getElementById('wo-global-search').addEventListener('input', (event) => {
    const query = event.target.value.trim()
    shipmentFilter.query = query
    inventoryFilter.query = query
    assignmentFilter.query = query
    document.getElementById('shipment-search').value = query
    document.getElementById('inventory-search').value = query
    document.getElementById('assignment-search').value = query
    renderShipmentPage()
    renderInventory()
    renderAssignments()
    if (location.hash !== '#assignments') history.pushState(null, '', '#assignments')
    showPage('assignments')
  })
  window.addEventListener('storage', (event) => {
    if (!event.key || event.key === 'disruptioniq.shared.recovery-workflow.v1') renderAll()
  })
  window.addEventListener('disruptioniq:recovery-workflow-updated', renderAll)
  window.addEventListener('hashchange', () => showPage(location.hash.slice(1)))
  window.addEventListener('popstate', () => showPage(location.hash.slice(1)))
  showPage(location.hash.slice(1) || 'overview')
  window.__warehouseOperator = {
    getAssignments: () => clone(currentAssignments()),
    getInventory: () => clone(inventoryItems),
    getShipments: () => clone(shipments),
  }
}
