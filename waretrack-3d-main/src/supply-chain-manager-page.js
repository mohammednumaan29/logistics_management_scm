import { requireRole } from './api/client.js';
await requireRole('SUPPLY_CHAIN_MANAGER');
import './workspaces/supply-chain-manager.css'
import './workspaces/dashboard-consistency.css'
import { inventoryItems, shipments as demoShipments } from './workspaces/operations-analyst-data.js'
import {
  authorizeExecution,
  decideRecoveryPlan,
  getCurrentActor,
  getDisruptions,
  getNotifications,
  getWorkflowState,
  savePlanForLater,
} from './workspaces/recovery-workflow.js'

const SETTINGS_KEY = 'disruptioniq.supply-chain-manager.settings.v1'
const actor = getCurrentActor()
const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
const settings = { name: actor.name, region: 'all', notifications: true, compact: false, ...savedSettings }
const dateElement = document.getElementById('manager-date')
let toastTimer
let reportRows = []
let previousPage = 'disruptions'

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function fmtNumber(value, options = {}) {
  return new Intl.NumberFormat(undefined, options).format(Number(value) || 0)
}

function fmtCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0)
}

function fmtDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, options).format(parsed)
}

function titleCase(value) {
  return String(value || 'Unknown').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getState() { return getWorkflowState() }
function getDisruption(id) { return getDisruptions().find((item) => item.id === id) }
function getPlan(id) { return getState().plans.find((item) => item.id === id) }
function getPlanDisruption(plan) { return getDisruption(plan.disruptionId) }
function getRegionalDisruptions() {
  return getDisruptions().filter((item) => settings.region === 'all' || item.region === settings.region)
}
function getVisiblePlans() {
  const disruptionIds = new Set(getRegionalDisruptions().map((item) => item.id))
  const operationalShipments = getOperationalData().shipments
  return getState().plans.filter((plan) => {
    if (disruptionIds.has(plan.disruptionId)) return true
    if (settings.region === 'all') return true
    const shipment = operationalShipments.find((item) => item.id === plan.shipmentId)
    return shipment ? regionForDestination(shipment.destination) === settings.region : false
  })
}

function regionForDestination(destination) {
  const value = String(destination || '')
  if (/chennai|coimbatore|kochi|mysuru|vijayawada|hyderabad|bengaluru/i.test(value)) return 'south'
  if (/mumbai|surat|ahmedabad|pune/i.test(value)) return 'west'
  return 'north'
}
function statusBadge(value) { return `<span class="manager-status" data-status="${esc(value)}">${esc(titleCase(value))}</span>` }
function listText(values) { return values?.length ? values.map(esc).join(', ') : '—' }

function getOperationalData() {
  return {
    shipments: demoShipments,
    inventory: inventoryItems,
  }
}

function getCounts() {
  const disruptions = getRegionalDisruptions()
  const plans = getVisiblePlans()
  const active = disruptions.filter((item) => item.status !== 'resolved')
  const successful = plans.filter((item) => item.execution_status === 'successful')
  return {
    disruptions,
    plans,
    active,
    critical: active.filter((item) => item.severity === 'critical'),
    pending: plans.filter((item) => item.approval_status === 'pending'),
    approved: plans.filter((item) => item.approval_status === 'approved'),
    rejected: plans.filter((item) => item.approval_status === 'rejected'),
    inProgress: plans.filter((item) => item.execution_status === 'in_progress'),
    successful,
    averageRecovery: successful.length
      ? successful.reduce((total, plan) => total + Number(plan.actual?.recoveryDays ?? plan.recoveryDays), 0) / successful.length
      : 0,
  }
}

function notify(message, error = false) {
  const element = document.getElementById('manager-toast')
  element.textContent = message
  element.classList.toggle('is-error', error)
  element.classList.add('is-visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => element.classList.remove('is-visible'), 4200)
}

function setNavigation(page) {
  const views = [...document.querySelectorAll('.manager-view')]
  views.forEach((view) => { view.hidden = view.dataset.page !== page })
  document.querySelectorAll('.manager-nav a').forEach((link) => {
    const active = link.hash.slice(1) === page
    link.classList.toggle('is-active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  window.scrollTo(0, 0)
}

function navigate(page, recordType = '', recordId = '') {
  const currentPage = decodeURIComponent(window.location.hash.slice(1).split('/')[0] || 'overview')
  if (page === 'detail' && currentPage !== 'detail') previousPage = currentPage
  const hash = page === 'detail'
    ? `#detail/${encodeURIComponent(recordType)}/${encodeURIComponent(recordId)}`
    : `#${page}`
  if (window.location.hash === hash) renderRoute()
  else window.location.hash = hash
}

function renderRoute() {
  const hash = decodeURIComponent(window.location.hash.slice(1) || 'overview')
  const [page, type, id] = hash.split('/')
  if (page === 'detail' && type && id) {
    setNavigation('detail')
    renderDetail(type, id)
    return
  }
  const allowed = new Set(['overview', 'tower', 'disruptions', 'risks', 'approvals', 'execution', 'performance', 'monitoring', 'audit', 'reports', 'notifications', 'settings'])
  const selected = allowed.has(page) ? page : 'overview'
  if (!allowed.has(page)) window.history.replaceState(null, '', '#overview')
  setNavigation(selected)
  renderAll()
}

function renderBars(containerId, points) {
  const element = document.getElementById(containerId)
  const max = Math.max(1, ...points.map((point) => Number(point.value) || 0))
  element.innerHTML = points.map((point) => {
    const value = Number(point.value) || 0
    const width = value ? Math.max(4, value / max * 100) : 0
    const content = `<span>${esc(point.label)}</span><b class="manager-bar-track"><i style="width:${width}%"></i></b><strong>${esc(point.display ?? fmtNumber(value))}</strong>`
    return point.page
      ? `<button class="manager-bar-row manager-chart-link" type="button" data-page="${esc(point.page)}" data-filter="${esc(point.filter || '')}">${content}</button>`
      : `<div class="manager-bar-row">${content}</div>`
  }).join('') || '<p class="manager-empty">No data available.</p>'
}

function renderOverview() {
  const data = getCounts()
  const cards = [
    ['Total Active Disruptions', data.active.length, 'disruptions', 'status:active'],
    ['Critical Disruptions', data.critical.length, 'disruptions', 'severity:critical'],
    ['Pending Recovery Approvals', data.pending.length, 'approvals', 'status:pending'],
    ['Approved Recovery Plans', data.approved.length, 'approvals', 'status:approved'],
    ['Rejected Recovery Plans', data.rejected.length, 'approvals', 'status:rejected'],
    ['Recovery Plans in Progress', data.inProgress.length, 'monitoring', 'status:in_progress'],
    ['Successful Recoveries', data.successful.length, 'monitoring', 'status:successful'],
    ['Average Recovery Time', `${data.averageRecovery.toFixed(1)} days`, 'performance', ''],
  ]
  const icons = [
    '<svg viewBox="0 0 24 24"><path d="m12 3 9 17H3z"/><path d="M12 9v4m0 3h.01"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="m12 3 9 17H3z"/><path d="M12 9v4m0 3h.01"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8.5 13l2.2 2.2 4.8-5"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M4 19V5m0 14h16"/><path d="m7 15 4-4 3 2 5-6"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M4 12h4l3-7 4 14 3-7h2"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  ]
  document.getElementById('overview-kpis').innerHTML = cards.map(([label, value, page, filter], index) =>
    `<a class="manager-kpi" href="#${page}" data-page="${page}" data-filter="${filter}"><i class="manager-kpi-icon" aria-hidden="true">${icons[index]}</i><div><span>${esc(label)}</span><strong>${esc(value)}</strong><small>Open filtered ${esc(page)} view →</small></div></a>`,
  ).join('')

  renderBars('chart-disruption-status', ['open', 'acknowledged', 'investigating', 'resolved'].map((status) => ({
    label: titleCase(status), value: data.disruptions.filter((item) => item.status === status).length, page: 'disruptions', filter: `status:${status}`,
  })))
  renderBars('chart-plan-status', ['pending', 'approved', 'rejected', 'modification_requested'].map((status) => ({
    label: titleCase(status), value: data.plans.filter((item) => item.approval_status === status).length, page: 'approvals', filter: `status:${status}`,
  })))
  const today = new Date()
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return {
      label: fmtDate(key, { weekday: 'short', day: 'numeric' }),
      value: data.disruptions.filter((item) => String(item.createdAt).slice(0, 10) === key).length,
      page: 'disruptions',
    }
  })
  renderBars('chart-disruption-trend', trend)
  renderBars('chart-recovery-performance', [
    { label: 'Successful', value: data.successful.length, page: 'monitoring', filter: 'status:successful' },
    { label: 'In progress', value: data.inProgress.length, page: 'monitoring', filter: 'status:in_progress' },
    { label: 'Blocked tasks', value: data.plans.reduce((sum, plan) => sum + plan.tasks.filter((task) => task.status === 'blocked').length, 0), page: 'monitoring', filter: 'status:blocked' },
    { label: 'Avg recovery', value: data.averageRecovery, display: `${data.averageRecovery.toFixed(1)} d`, page: 'performance' },
  ])
  const attention = [
    ...data.pending.map((plan) => ({ kind: 'pending', title: `Approval due · ${plan.id}`, text: `${getPlanDisruption(plan)?.title || plan.disruptionId} · ${plan.createdBy}`, planId: plan.id })),
    ...data.plans.filter((plan) => plan.approval_status === 'approved' && plan.execution_authorisation_status === 'not_authorized').map((plan) => ({ kind: 'pending', title: `Execution authorization · ${plan.id}`, text: `${plan.requiredApprovals.filter((item) => item.status !== 'approved').length} additional approval(s) outstanding`, planId: plan.id })),
    ...data.plans.filter((plan) => plan.execution_status === 'blocked').map((plan) => ({ kind: 'critical', title: `Recovery blocked · ${plan.id}`, text: `${plan.tasks.filter((task) => task.status === 'blocked').length} blocked execution action(s)`, planId: plan.id })),
    ...data.disruptions.filter((item) => item.severity === 'critical' && item.status !== 'resolved').map((item) => ({ kind: 'critical', title: item.title, text: `${item.id} · risk score ${item.riskScore}`, type: 'disruption', id: item.id })),
  ].slice(0, 6)
  document.getElementById('attention-list').innerHTML = attention.map((item) =>
    `<div class="manager-attention-item"><i class="manager-severity-dot" data-status="${esc(item.kind)}"></i><div><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p></div><button type="button" data-detail-type="${item.type || 'plan'}" data-detail-id="${esc(item.id || item.planId)}">Review</button></div>`,
  ).join('') || '<p class="manager-empty">No items currently need management attention.</p>'
  document.getElementById('recent-activity').innerHTML = getState().audit.slice(0, 6).map((entry) =>
    `<div class="manager-recent-item"><i class="manager-severity-dot" data-status="${esc(entry.newStatus)}"></i><div><strong>${esc(entry.action)} · ${esc(entry.planId)}</strong><p>${esc(entry.user)} · ${esc(fmtDate(entry.timestamp, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))} · ${esc(entry.comments || 'No comment')}</p></div></div>`,
  ).join('') || '<p class="manager-empty">No management activity is recorded.</p>'
}

function filterDisruptions(query, severity, status, category = 'all') {
  const search = (query || '').trim().toLowerCase()
  return getRegionalDisruptions().filter((item) => {
    const text = `${item.id} ${item.title} ${item.category} ${item.description} ${item.relatedId} ${item.orders.join(' ')} ${item.shipments.join(' ')} ${item.suppliers.join(' ')}`.toLowerCase()
    return (!search || text.includes(search)) &&
      (severity === 'all' || item.severity === severity) &&
      (status === 'all' || (status === 'active' ? item.status !== 'resolved' : item.status === status)) &&
      (category === 'all' || item.category === category)
  })
}

function renderTower() {
  const disruptions = getRegionalDisruptions()
  const shipments = getOperationalData().shipments
  const plans = getVisiblePlans()
  const delayed = shipments.filter((item) => item.status === 'delayed')
  const shortageCount = getOperationalData().inventory.filter((item) => item.quantity <= item.reorderThreshold).length
  const summaries = [
    ['Active disruptions', disruptions.filter((item) => item.status !== 'resolved').length],
    ['Affected orders', [...new Set(disruptions.flatMap((item) => item.orders))].length],
    ['Delayed shipments', delayed.length],
    ['Inventory shortages', shortageCount],
  ]
  document.getElementById('tower-summary').innerHTML = summaries.map(([label, value]) => `<div class="manager-summary-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')
  const rows = filterDisruptions(
    document.getElementById('tower-search').value,
    document.getElementById('tower-severity').value,
    document.getElementById('tower-status').value,
  )
  document.getElementById('tower-table').innerHTML = rows.map((item) => {
    const plan = plans.find((entry) => entry.disruptionId === item.id && !['rejected', 'modification_requested'].includes(entry.approval_status))
    return `<tr><td><button class="manager-link-button" data-detail-type="disruption" data-detail-id="${esc(item.id)}">${esc(item.title)}</button><small>${esc(item.id)} · risk ${item.riskScore}</small></td><td>${listText(item.orders)}<small>${listText(item.shipments)}</small></td><td>${listText(item.suppliers)}<small>${listText(item.warehouses)}</small></td><td>${item.delayedShipments} delayed<small>${item.inventoryShortages} shortage(s)</small></td><td>${plan ? statusBadge(plan.execution_status === 'not_started' ? plan.approval_status : plan.execution_status) : 'No plan submitted'}</td><td><button class="manager-row-actions" data-detail-type="disruption" data-detail-id="${esc(item.id)}">Open details</button></td></tr>`
  }).join('') || '<tr><td colspan="6" class="manager-empty">No disruption records match these filters.</td></tr>'
}

function renderDisruptions() {
  const rows = filterDisruptions(
    document.getElementById('disruption-search').value,
    document.getElementById('disruption-severity').value,
    document.getElementById('disruption-status').value,
    document.getElementById('disruption-category').value,
  )
  const sort = document.getElementById('disruption-sort').value
  const rank = { critical: 0, high: 1, medium: 2, low: 3 }
  rows.sort(sort === 'newest'
    ? (left, right) => String(right.createdAt).localeCompare(String(left.createdAt))
    : sort === 'severity'
      ? (left, right) => rank[left.severity] - rank[right.severity]
      : sort === 'title'
        ? (left, right) => left.title.localeCompare(right.title)
        : (left, right) => right.riskScore - left.riskScore)
  document.getElementById('disruption-table').innerHTML = rows.map((item) =>
    `<tr><td><button class="manager-link-button" data-detail-type="disruption" data-detail-id="${esc(item.id)}">${esc(item.title)}</button><small>${esc(item.id)} · ${esc(fmtDate(item.createdAt))}</small></td><td>${esc(item.category)}<small>${statusBadge(item.severity)}</small></td><td><strong>${item.riskScore}/100</strong><small>${item.riskScore >= 75 ? 'High risk' : item.riskScore >= 45 ? 'Moderate risk' : 'Lower risk'}</small></td><td>${listText(item.orders)}</td><td>${listText(item.shipments)}</td><td>${listText(item.suppliers)}<small>${listText(item.warehouses)}</small></td><td>${statusBadge(item.status)}</td><td><button class="manager-row-actions" data-detail-type="disruption" data-detail-id="${esc(item.id)}">Details</button></td></tr>`,
  ).join('') || '<tr><td colspan="8" class="manager-empty">No disruption records match these filters.</td></tr>'
}

function renderRisks() {
  document.getElementById('risk-table').innerHTML = getRegionalDisruptions().map((item) => {
    const assessment = `${item.severity} ${item.category.toLowerCase()} exposure; ${item.delayedShipments} delayed shipment(s); ${item.inventoryShortages} shortage(s).`
    const plan = getState().plans.find((entry) => entry.disruptionId === item.id && entry.actual)
    return `<tr><td><button class="manager-link-button" data-detail-type="disruption" data-detail-id="${esc(item.id)}">${esc(item.title)}</button><small>${esc(item.id)}</small></td><td><strong>${item.riskScore}/100</strong><small>${item.riskScore >= 75 ? 'High' : item.riskScore >= 45 ? 'Moderate' : 'Low'}</small></td><td>${esc(assessment)}<small>Inventory exposure · shipment delay · severity</small></td><td>${item.affectedOrders}</td><td>${plan ? `${fmtCurrency(plan.simulation.expectedCost)} · ${plan.simulation.expectedRecoveryDays} days` : 'Not simulated'}</td><td>${plan?.actual ? `${fmtCurrency(plan.actual.cost)} · ${plan.actual.recoveryDays} days` : 'No actual result recorded'}</td><td><button class="manager-row-actions" data-detail-type="disruption" data-detail-id="${esc(item.id)}">Inspect</button></td></tr>`
  }).join('') || '<tr><td colspan="7" class="manager-empty">No assessments are available.</td></tr>'
}

function renderApprovals() {
  const query = document.getElementById('approval-search').value.trim().toLowerCase()
  const selectedStatus = document.getElementById('approval-status').value
  const plans = getVisiblePlans().filter((plan) => {
    const disruption = getPlanDisruption(plan)
    const text = `${plan.id} ${plan.strategy} ${plan.createdBy} ${disruption?.title || ''}`.toLowerCase()
    return (!query || text.includes(query)) && (selectedStatus === 'all' || plan.approval_status === selectedStatus)
  }).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  const pending = plans.filter((plan) => plan.approval_status === 'pending').length
  document.getElementById('approval-queue-count').textContent = `${pending} awaiting decision`
  document.getElementById('approval-table').innerHTML = plans.map((plan) => {
    const self = plan.createdByUserId === actor.id
    const canDecide = actor.role === 'Supply Chain Manager' && plan.approval_status === 'pending' && !self
    return `<tr><td><button class="manager-link-button" data-detail-type="plan" data-detail-id="${esc(plan.id)}">${esc(plan.id)}</button><small>${esc(getPlanDisruption(plan)?.title || plan.disruptionId)}</small></td><td>${esc(plan.createdBy)}<small>${esc(plan.createdByUserId)}</small>${self ? '<span class="manager-plan-flag">Creator cannot decide</span>' : ''}</td><td>${esc(plan.strategy)}</td><td>${fmtCurrency(plan.cost)}<small>${plan.recoveryDays} day(s)</small></td><td>${plan.riskReduction == null ? '—' : `${plan.riskReduction}%`}<small>${plan.riskReduction == null ? 'not estimated by backend' : 'simulated reduction'}</small></td><td>${fmtCurrency(plan.simulation.expectedCost)}<small>${plan.simulation.expectedRecoveryDays} days · estimate</small></td><td>${statusBadge(plan.approval_status)}<small>Execution: ${esc(titleCase(plan.execution_authorisation_status))}</small></td><td><div class="manager-row-actions"><button data-detail-type="plan" data-detail-id="${esc(plan.id)}">Review</button>${canDecide ? `<button data-action="decide" data-decision="approved" data-id="${esc(plan.id)}">Approve</button><button data-action="decide" data-decision="rejected" data-id="${esc(plan.id)}">Reject</button>` : ''}<button data-action="save" data-id="${esc(plan.id)}">Save later</button></div></td></tr>`
  }).join('') || '<tr><td colspan="8" class="manager-empty">No recovery plans match these filters.</td></tr>'
}

function renderExecution() {
  const plans = getVisiblePlans().filter((plan) => plan.approval_status === 'approved')
  document.getElementById('execution-table').innerHTML = plans.map((plan) => {
    const outstanding = plan.requiredApprovals.filter((item) => item.status !== 'approved')
    const canAuthorize = actor.role === 'Supply Chain Manager' && plan.execution_authorisation_status === 'not_authorized' && outstanding.length === 0
    const requirementText = plan.requiredApprovals.length
      ? plan.requiredApprovals.map((item) => `${item.label}: ${titleCase(item.status)} (${item.role})`).join('; ')
      : 'None required'
    return `<tr><td><button class="manager-link-button" data-detail-type="plan" data-detail-id="${esc(plan.id)}">${esc(plan.id)}</button><small>${esc(getPlanDisruption(plan)?.title || plan.disruptionId)}</small></td><td>${esc(plan.strategy)}</td><td>${statusBadge(plan.approval_status)}</td><td>${statusBadge(plan.execution_authorisation_status)}</td><td>${esc(requirementText)}</td><td>${plan.tasks.length} task(s)<small>${esc(titleCase(plan.execution_status))}</small></td><td><div class="manager-row-actions"><button data-detail-type="plan" data-detail-id="${esc(plan.id)}">Review</button>${canAuthorize ? `<button data-action="authorize" data-id="${esc(plan.id)}">Authorize</button>` : outstanding.length ? '<button disabled title="Waiting for the required approving role">Await approvals</button>' : ''}</div></td></tr>`
  }).join('') || '<tr><td colspan="7" class="manager-empty">No approved plans are awaiting or undergoing execution.</td></tr>'
}

function filterByPeriod(plans, days) {
  if (!days) return plans
  const cutoff = Date.now() - Number(days) * 86400000
  return plans.filter((plan) => new Date(plan.createdAt).getTime() >= cutoff)
}

function renderPerformance() {
  const category = document.getElementById('performance-category').value
  const period = document.getElementById('performance-period').value
  let disruptions = getRegionalDisruptions().filter((item) => category === 'all' || item.category === category)
  let plans = filterByPeriod(getVisiblePlans(), period === 'all' ? 0 : Number(period))
  const disruptionIds = new Set(disruptions.map((item) => item.id))
  plans = plans.filter((plan) => disruptionIds.has(plan.disruptionId))
  const completed = plans.filter((plan) => ['successful', 'failed'].includes(plan.execution_status))
  const successful = completed.filter((plan) => plan.execution_status === 'successful')
  const avg = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  const actualPlans = successful.filter((plan) => plan.actual)
  const plannedCost = actualPlans.reduce((sum, plan) => sum + Number(plan.simulation.expectedCost), 0)
  const actualCost = actualPlans.reduce((sum, plan) => sum + Number(plan.actual.cost), 0)
  const decided = getState().audit.filter((entry) => entry.action === 'Plan approved' && plans.some((plan) => plan.id === entry.planId))
  const durations = decided.map((entry) => {
    const plan = plans.find((item) => item.id === entry.planId)
    return Math.max(0, (new Date(entry.timestamp) - new Date(plan.createdAt)) / 3600000)
  })
  const summary = [
    ['Recovery success rate', `${completed.length ? Math.round(successful.length / completed.length * 100) : 0}%`],
    ['Average recovery time', `${avg(successful.map((plan) => Number(plan.actual?.recoveryDays ?? plan.recoveryDays))).toFixed(1)} days`],
    ['Average approval time', `${avg(durations).toFixed(1)} hours`],
    ['Planned / actual cost', `${fmtCurrency(plannedCost)} / ${fmtCurrency(actualCost)}`],
  ]
  document.getElementById('performance-kpis').innerHTML = summary.map(([label, value]) => `<div class="manager-summary-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')
  renderBars('performance-disruptions', ['critical', 'high', 'medium', 'low'].map((severity) => ({ label: titleCase(severity), value: disruptions.filter((item) => item.severity === severity).length })))
  renderBars('performance-cost', [{ label: 'Planned · simulations', value: plannedCost, display: fmtCurrency(plannedCost) }, { label: 'Actual · recorded', value: actualCost, display: fmtCurrency(actualCost) }])
  renderBars('performance-time', [
    { label: 'Planned days', value: avg(successful.map((plan) => Number(plan.simulation.expectedRecoveryDays))), display: `${avg(successful.map((plan) => Number(plan.simulation.expectedRecoveryDays))).toFixed(1)} d` },
    { label: 'Actual days', value: avg(successful.map((plan) => Number(plan.actual?.recoveryDays ?? 0))), display: `${avg(successful.map((plan) => Number(plan.actual?.recoveryDays ?? 0))).toFixed(1)} d` },
  ])
  renderBars('performance-approval', [{ label: 'Approval avg', value: avg(durations), display: `${avg(durations).toFixed(1)} h` }])
}

function renderMonitoring() {
  const plans = getVisiblePlans().filter((plan) => plan.execution_authorisation_status === 'authorized')
  document.getElementById('monitoring-list').innerHTML = plans.map((plan) => {
    const tasks = plan.tasks || []
    const completed = tasks.filter((task) => task.status === 'completed').length
    const percent = plan.progressPercentage != null
      ? Math.max(0, Math.min(100, Math.round(Number(plan.progressPercentage) || 0)))
      : tasks.length ? Math.round(completed / tasks.length * 100) : 0
    const pending = tasks.filter((task) => task.status === 'pending').length
    const blocked = tasks.filter((task) => task.status === 'blocked').length
    const tasksHtml = tasks.map((task) => `<div class="manager-task"><strong>${esc(task.title)}<small>${esc(task.team)} · ${esc(task.assignedRole)} · Due ${esc(fmtDate(task.dueAt))}</small></strong>${statusBadge(task.status)}<small>Last update: ${esc(task.updatedBy || 'Not updated')} · ${esc(fmtDate(task.updatedAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}</small></div>`).join('')
    return `<article class="manager-monitor-card"><div class="manager-monitor-head"><div><h2><button class="manager-link-button" data-detail-type="plan" data-detail-id="${esc(plan.id)}">${esc(plan.id)} · ${esc(plan.strategy)}</button></h2><p>${esc(getPlanDisruption(plan)?.title || plan.disruptionId)} · ${esc(titleCase(plan.execution_status))}</p></div>${statusBadge(plan.execution_status)}</div><div class="manager-progress" aria-label="Task completion ${percent}%"><i style="width:${percent}%"></i></div><div class="manager-monitor-meta"><div><span>Progress</span><strong>${percent}%</strong></div><div><span>Pending actions</span><strong>${pending}</strong></div><div><span>Blocked actions</span><strong>${blocked}</strong></div><div><span>Completed tasks</span><strong>${completed} / ${tasks.length}</strong></div></div><div class="manager-task-list">${tasksHtml || '<p class="manager-muted">No execution tasks are recorded.</p>'}</div><p class="manager-footnote">Progress is updated by assigned execution users. Managers cannot mark tasks complete.</p></article>`
  }).join('') || '<article class="manager-card"><p class="manager-empty">No recovery plans have been authorized for execution.</p></article>'
}

function renderAudit() {
  const state = getState()
  const search = document.getElementById('audit-search').value.trim().toLowerCase()
  const role = document.getElementById('audit-role').value
  const rows = state.audit.filter((item) => {
    const text = `${item.user} ${item.role} ${item.planId} ${item.action} ${item.comments}`.toLowerCase()
    return (!search || text.includes(search)) && (role === 'all' || item.role === role)
  }).sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)))
  document.getElementById('audit-table').innerHTML = rows.map((item) =>
    `<tr><td>${esc(fmtDate(item.timestamp, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td><td>${esc(item.user)}<small>${esc(item.role)} · ${esc(item.userId)}</small></td><td><button class="manager-link-button" data-detail-type="plan" data-detail-id="${esc(item.planId)}">${esc(item.planId)}</button></td><td>${esc(item.action)}</td><td>${esc(titleCase(item.previousStatus))} → ${esc(titleCase(item.newStatus))}</td><td>${esc(item.comments || '—')}</td></tr>`,
  ).join('') || '<tr><td colspan="6" class="manager-empty">No audit records match these filters.</td></tr>'
}

function reportData(type) {
  const state = getState()
  const disruptions = getRegionalDisruptions()
  const plans = getVisiblePlans()
  const byType = {
    performance: plans.map((plan) => ({ timestamp: plan.createdAt, plan: plan.id, disruption: getPlanDisruption(plan)?.title || plan.disruptionId, approval: plan.approval_status, execution: plan.execution_status, estimatedCost: plan.simulation.expectedCost, actualCost: plan.actual?.cost ?? '', estimatedDays: plan.simulation.expectedRecoveryDays, actualDays: plan.actual?.recoveryDays ?? '' })),
    disruptions: disruptions.map((item) => ({ timestamp: item.createdAt, id: item.id, title: item.title, category: item.category, severity: item.severity, riskScore: item.riskScore, orders: item.affectedOrders, delayedShipments: item.delayedShipments, status: item.status })),
    risks: disruptions.map((item) => ({ timestamp: item.createdAt, id: item.id, disruption: item.title, score: item.riskScore, level: item.riskScore >= 75 ? 'High' : item.riskScore >= 45 ? 'Moderate' : 'Low', factors: item.explanation, orders: item.affectedOrders })),
    approvals: plans.map((plan) => ({ timestamp: plan.createdAt, id: plan.id, disruption: getPlanDisruption(plan)?.title || plan.disruptionId, creator: plan.createdBy, strategy: plan.strategy, cost: plan.cost, recoveryDays: plan.recoveryDays, approval: plan.approval_status, executionAuthorization: plan.execution_authorisation_status })),
    success: plans.map((plan) => ({ timestamp: plan.actual?.completedAt || plan.createdAt, id: plan.id, disruption: getPlanDisruption(plan)?.title || plan.disruptionId, outcome: plan.actual?.outcome || titleCase(plan.execution_status), plannedDays: plan.simulation.expectedRecoveryDays, actualDays: plan.actual?.recoveryDays ?? '', completedAt: plan.actual?.completedAt || '' })),
    cost: plans.map((plan) => ({ timestamp: plan.createdAt, id: plan.id, strategy: plan.strategy, estimatedCost: plan.simulation.expectedCost, actualCost: plan.actual?.cost ?? '', variance: plan.actual ? Number(plan.actual.cost) - Number(plan.simulation.expectedCost) : '', currency: 'INR' })),
    time: plans.map((plan) => ({ timestamp: plan.createdAt, id: plan.id, strategy: plan.strategy, estimatedDays: plan.simulation.expectedRecoveryDays, actualDays: plan.actual?.recoveryDays ?? '', executionStatus: plan.execution_status })),
    execution: plans.map((plan) => ({ timestamp: plan.createdAt, id: plan.id, authorization: plan.execution_authorisation_status, status: plan.execution_status, tasks: plan.tasks.length, completedTasks: plan.tasks.filter((task) => task.status === 'completed').length, blockedTasks: plan.tasks.filter((task) => task.status === 'blocked').length })),
    audit: state.audit.map((item) => ({ timestamp: item.timestamp, user: item.user, role: item.role, plan: item.planId, action: item.action, previousStatus: item.previousStatus, newStatus: item.newStatus, comments: item.comments })),
  }
  return byType[type] || []
}

function renderReport() {
  const type = document.getElementById('report-type').value
  const category = document.getElementById('report-category').value
  const from = document.getElementById('report-from').value
  const to = document.getElementById('report-to').value
  if (from && to && from > to) {
    notify('The report start date must be on or before its end date.', true)
    return
  }
  const cols = {
    performance: ['plan', 'disruption', 'approval', 'execution', 'estimatedCost', 'actualCost', 'estimatedDays', 'actualDays'],
    disruptions: ['id', 'title', 'category', 'severity', 'riskScore', 'orders', 'delayedShipments', 'status'],
    risks: ['id', 'disruption', 'score', 'level', 'factors', 'orders'],
    approvals: ['id', 'disruption', 'creator', 'strategy', 'cost', 'recoveryDays', 'approval', 'executionAuthorization'],
    success: ['id', 'disruption', 'outcome', 'plannedDays', 'actualDays', 'completedAt'],
    cost: ['id', 'strategy', 'estimatedCost', 'actualCost', 'variance', 'currency'],
    time: ['id', 'strategy', 'estimatedDays', 'actualDays', 'executionStatus'],
    execution: ['id', 'authorization', 'status', 'tasks', 'completedTasks', 'blockedTasks'],
    audit: ['timestamp', 'user', 'role', 'plan', 'action', 'previousStatus', 'newStatus', 'comments'],
  }
  const categoryDisruptionIds = new Set(getRegionalDisruptions().filter((item) => category === 'all' || item.category === category).map((item) => item.id))
  const rows = reportData(type).filter((row) => {
    if (category !== 'all') {
      if (row.category && row.category !== category) return false
      const relatedDisruption = getRegionalDisruptions().find((item) => item.id === row.id || item.title === row.disruption)
      if (relatedDisruption && !categoryDisruptionIds.has(relatedDisruption.id)) return false
    }
    const timestamp = row.timestamp || row.completedAt || ''
    return (!from || !timestamp || timestamp.slice(0, 10) >= from) && (!to || !timestamp || timestamp.slice(0, 10) <= to)
  })
  reportRows = rows.map((row) => Object.fromEntries(cols[type].map((key) => [key, row[key] ?? ''])))
  document.getElementById('report-head').innerHTML = `<tr>${cols[type].map((key) => `<th>${esc(titleCase(key))}</th>`).join('')}</tr>`
  document.getElementById('report-table').innerHTML = reportRows.map((row) => `<tr>${cols[type].map((key) => `<td>${esc(row[key])}</td>`).join('')}</tr>`).join('') || `<tr><td class="manager-empty" colspan="${cols[type].length}">No records match the selected report filters.</td></tr>`
  document.getElementById('report-summary').innerHTML = `<span>Report<strong>${esc(document.getElementById('report-type').selectedOptions[0].text)}</strong></span><span>Records<strong>${rows.length}</strong></span><span>Data status<strong>Backend records</strong></span>`
}

function renderNotifications() {
  const notifications = getNotifications()
  document.getElementById('nav-notification-count').textContent = settings.notifications ? notifications.filter((item) => !item.read).length : 0
  document.getElementById('notification-list').innerHTML = settings.notifications
    ? notifications.map((item) => `<article class="manager-notification"><i class="manager-severity-dot" data-status="${item.title.toLowerCase().includes('critical') || item.title.toLowerCase().includes('blocked') ? 'critical' : 'pending'}"></i><div><strong>${esc(item.title)}</strong><p>${esc(item.description)}</p></div><time>${esc(fmtDate(item.date, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}</time></article>`).join('') || '<article class="manager-card"><p class="manager-empty">No notifications are available.</p></article>'
    : '<article class="manager-card"><p class="manager-empty">Management notifications are disabled in your preferences.</p></article>'
}

function renderSettings() {
  document.getElementById('settings-name').value = settings.name
  document.getElementById('settings-region').value = settings.region
  document.getElementById('settings-notifications').checked = settings.notifications
  document.getElementById('settings-compact').checked = settings.compact
  document.getElementById('sidebar-name').textContent = settings.name
  document.querySelector('.manager-shell').classList.toggle('manager-compact', settings.compact)
}

function renderAll() {
  const counts = getCounts()
  document.getElementById('nav-pending-count').textContent = counts.pending.length
  document.getElementById('manager-search').value ||= ''
  renderOverview()
  renderTower()
  renderDisruptions()
  renderRisks()
  renderApprovals()
  renderExecution()
  renderPerformance()
  renderMonitoring()
  renderAudit()
  renderReport()
  renderNotifications()
  renderSettings()
}

function detailList(rows) {
  return `<dl class="manager-detail-list">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>`
}

function renderDetail(type, id) {
  const content = document.getElementById('detail-content')
  const audit = getState().audit.filter((item) => type === 'plan' && item.planId === id)
  if (type === 'disruption') {
    const item = getDisruption(id)
    if (!item) {
      document.getElementById('detail-title').textContent = 'Disruption not found'
      content.innerHTML = '<article class="manager-card"><p class="manager-empty">This disruption is no longer available.</p></article>'
      return
    }
    const plans = getState().plans.filter((plan) => plan.disruptionId === id)
    const riskFactors = `<ul><li>${esc(item.severity)} severity</li><li>${item.delayedShipments} delayed shipment(s)</li><li>${item.inventoryShortages} inventory shortage(s)</li><li>${item.affectedOrders} affected order(s)</li></ul>`
    document.getElementById('detail-title').textContent = item.title
    document.getElementById('detail-subtitle').textContent = `${item.id} · disruption impact, assessment, and recovery history`
    content.innerHTML = `<div class="manager-detail-grid"><article class="manager-card"><h2>Disruption and network impact</h2>${detailList([
      ['Category / severity', `${esc(item.category)} · ${statusBadge(item.severity)}`], ['Status', statusBadge(item.status)], ['Risk score', `${item.riskScore}/100 · illustrative score`], ['Description', esc(item.description)], ['Potential impact', esc(item.impact)], ['Affected orders', listText(item.orders)], ['Shipments', listText(item.shipments)], ['Suppliers', listText(item.suppliers)], ['Warehouses', listText(item.warehouses)], ['Related record', esc(item.relatedId)],
    ])}</article><article class="manager-card"><h2>Risk assessment review</h2>${detailList([['Risk factors', riskFactors], ['AI-generated explanation', esc(item.explanation)], ['Assessment status', 'Read-only · original assessment unchanged']])}<h2 style="margin-top:17px">Recovery history</h2><div class="manager-timeline">${plans.map((plan) => `<div class="manager-timeline-item"><strong><button class="manager-link-button" data-detail-type="plan" data-detail-id="${esc(plan.id)}">${esc(plan.id)} · ${esc(plan.strategy)}</button></strong><small>${esc(fmtDate(plan.createdAt))} · Approval ${esc(titleCase(plan.approval_status))} · Execution ${esc(titleCase(plan.execution_status))}</small></div>`).join('') || '<p class="manager-muted">No recovery plans are linked to this disruption.</p>'}</div><div class="manager-detail-actions"><button class="manager-button manager-button-secondary" data-page="tower">Back to control tower</button></div></article></div>`
    return
  }
  const plan = getPlan(id)
  if (!plan) {
    document.getElementById('detail-title').textContent = 'Recovery plan not found'
    content.innerHTML = '<article class="manager-card"><p class="manager-empty">This recovery plan is no longer available.</p></article>'
    return
  }
  const disruption = getPlanDisruption(plan)
  const self = plan.createdByUserId === actor.id
  const canDecide = actor.role === 'Supply Chain Manager' && !self && plan.approval_status === 'pending'
  const outstanding = plan.requiredApprovals.filter((item) => item.status !== 'approved')
  const canAuthorize = actor.role === 'Supply Chain Manager' && plan.approval_status === 'approved' && plan.execution_authorisation_status === 'not_authorized' && outstanding.length === 0
  document.getElementById('detail-title').textContent = `${plan.id} · ${plan.strategy}`
  document.getElementById('detail-subtitle').textContent = `${disruption?.title || plan.disruptionId} · submitted by ${plan.createdBy}`
  const actions = [
    canDecide ? `<button class="manager-button" data-action="decide" data-decision="approved" data-id="${esc(plan.id)}">Approve plan</button><button class="manager-button manager-button-secondary" data-action="decide" data-decision="rejected" data-id="${esc(plan.id)}">Reject</button><button class="manager-button manager-button-secondary" data-action="decide" data-decision="modification_requested" data-id="${esc(plan.id)}">Request modification</button>` : '',
    actor.role === 'Supply Chain Manager' ? `<button class="manager-button manager-button-secondary" data-action="save" data-id="${esc(plan.id)}">Save for later</button>` : '',
    canAuthorize ? `<button class="manager-button" data-action="authorize" data-id="${esc(plan.id)}">Authorize execution</button>` : '',
    self && plan.approval_status === 'pending' ? '<span class="manager-plan-flag">Separation of duties: your user ID created this plan, so you cannot decide it.</span>' : '',
  ].filter(Boolean).join('')
  const taskHtml = plan.tasks.map((task) => `<div class="manager-task"><strong>${esc(task.title)}<small>${esc(task.team)} · ${esc(task.assignedRole)} · Due ${esc(fmtDate(task.dueAt))}</small></strong>${statusBadge(task.status)}<small>Updated by ${esc(task.updatedBy || 'No executing user update')}</small></div>`).join('') || '<p class="manager-muted">Execution tasks are created only after required approvals and a separate authorization.</p>'
  content.innerHTML = `<div class="manager-detail-grid"><article class="manager-card"><h2>Plan and simulation</h2>${detailList([
    ['Disruption', `<button class="manager-link-button" data-detail-type="disruption" data-detail-id="${esc(plan.disruptionId)}">${esc(disruption?.title || plan.disruptionId)}</button>`],
    ['Strategy', esc(plan.strategy)], ['Created by', `${esc(plan.createdBy)} · ${esc(plan.createdByUserId)}`], ['Estimated cost', `${fmtCurrency(plan.cost)} · estimate`], ['Estimated recovery time', `${plan.recoveryDays} days · estimate`], ['Risk reduction', plan.riskReduction == null ? '—' : `${plan.riskReduction}% · simulated`], ['Approval status', statusBadge(plan.approval_status)], ['Execution authorization', statusBadge(plan.execution_authorisation_status)], ['Execution status', statusBadge(plan.execution_status)], ['Simulation outcome', `${fmtCurrency(plan.simulation.expectedCost)} · ${plan.simulation.expectedRecoveryDays} days · simulation`], ['Actual result', plan.actual ? `${fmtCurrency(plan.actual.cost)} · ${plan.actual.recoveryDays} days · ${esc(plan.actual.label)}` : 'No actual result recorded'],
  ])}<div class="manager-detail-actions">${actions}</div></article><article class="manager-card"><h2>Required additional approvals</h2><div class="manager-timeline">${plan.requiredApprovals.map((approval) => `<div class="manager-timeline-item"><strong>${esc(approval.label)} · ${esc(approval.role)}</strong><small>${esc(titleCase(approval.status))}${approval.approvedBy ? ` · ${esc(approval.approvedBy)} · ${esc(fmtDate(approval.approvedAt))}` : ''}</small></div>`).join('') || '<p class="manager-muted">No additional approvals required.</p>'}</div><h2 style="margin-top:17px">Execution tasks · read only</h2><div class="manager-task-list">${taskHtml}</div><h2 style="margin-top:17px">Comments</h2><div class="manager-timeline">${(plan.comments || []).map((comment) => `<div class="manager-timeline-item"><strong>${esc(comment.user)}</strong><small>${esc(fmtDate(comment.at))} · ${esc(comment.text)}</small></div>`).join('') || '<p class="manager-muted">No decision comments recorded.</p>'}</div></article><article class="manager-card"><h2>Audit history</h2><div class="manager-timeline">${audit.map((entry) => `<div class="manager-timeline-item"><strong>${esc(entry.action)} · ${esc(entry.user)} (${esc(entry.role)})</strong><small>${esc(fmtDate(entry.timestamp, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))} · ${esc(titleCase(entry.previousStatus))} → ${esc(titleCase(entry.newStatus))}${entry.comments ? ` · ${esc(entry.comments)}` : ''}</small></div>`).join('') || '<p class="manager-muted">No decisions are recorded for this plan yet.</p>'}</div></article></div>`
}

function ensureDialog() {
  if (document.getElementById('manager-action-dialog')) return
  const dialog = document.createElement('dialog')
  dialog.id = 'manager-action-dialog'
  dialog.className = 'manager-dialog'
  dialog.innerHTML = '<form id="manager-action-form"><div class="manager-dialog-heading"><div><h2 id="manager-dialog-title">Confirm action</h2><p id="manager-dialog-description"></p></div><button class="manager-dialog-close" type="button" aria-label="Close dialog">×</button></div><div class="manager-dialog-fields" id="manager-dialog-fields"></div><p class="manager-dialog-error" id="manager-dialog-error" aria-live="polite"></p><div class="manager-dialog-actions"><button type="button" class="manager-button manager-button-secondary" data-dialog-cancel>Cancel</button><button type="submit" class="manager-button" id="manager-dialog-submit">Confirm</button></div></form>'
  document.body.appendChild(dialog)
  dialog.querySelector('.manager-dialog-close').addEventListener('click', () => dialog.close())
  dialog.querySelector('[data-dialog-cancel]').addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close() })
}

ensureDialog()

function openDialog({ title, description, fields, submit, onSubmit }) {
  const dialog = document.getElementById('manager-action-dialog')
  const form = document.getElementById('manager-action-form')
  document.getElementById('manager-dialog-title').textContent = title
  document.getElementById('manager-dialog-description').textContent = description || ''
  document.getElementById('manager-dialog-fields').innerHTML = fields
  document.getElementById('manager-dialog-error').textContent = ''
  document.getElementById('manager-dialog-submit').textContent = submit
  form.onsubmit = async (event) => {
    event.preventDefault()
    const submitButton = document.getElementById('manager-dialog-submit')
    if (submitButton) submitButton.disabled = true
    try {
      const result = await onSubmit(new FormData(form))
      if (result) {
        document.getElementById('manager-dialog-error').textContent = result
        return
      }
      dialog.close()
      refresh()
    } finally {
      if (submitButton) submitButton.disabled = false
    }
  }
  dialog.showModal()
}

function requestDecision(planId, decision) {
  const plan = getPlan(planId)
  if (!plan) return notify('Recovery plan not found.', true)
  const isApproval = decision === 'approved'
  const title = isApproval ? 'Approve recovery plan?' : decision === 'rejected' ? 'Reject recovery plan' : 'Request plan modification'
  const commentField = isApproval
    ? '<label>Decision comment (optional)<textarea name="comment" rows="3" maxlength="500" placeholder="Add a review note"></textarea></label>'
    : '<label>Required comment<textarea name="comment" rows="4" maxlength="500" required placeholder="Explain the rejection or required changes"></textarea></label>'
  const confirmation = isApproval
    ? `<label class="manager-check"><input name="confirm" type="checkbox" required> I confirm this plan was reviewed and approval does not authorize execution.</label>`
    : ''
  openDialog({
    title,
    description: isApproval ? `${plan.id} will become approved only. A separate authorization is required before execution.` : `${plan.id} will remain unapproved. The Operations Analyst will receive the decision comment.`,
    fields: `${commentField}${confirmation}`,
    submit: isApproval ? 'Confirm approval' : decision === 'rejected' ? 'Reject plan' : 'Request changes',
    onSubmit: async (formData) => {
      try {
        await decideRecoveryPlan(planId, decision, String(formData.get('comment') || ''))
      } catch (error) {
        return error.message
      }
      notify(isApproval ? 'Plan approved. Execution is still unauthorized.' : decision === 'rejected' ? 'Plan rejected and decision recorded.' : 'Modification request recorded.')
      return ''
    },
  })
}

function requestAuthorization(planId) {
  const plan = getPlan(planId)
  if (!plan) return notify('Recovery plan not found.', true)
  openDialog({
    title: 'Authorize recovery execution?',
    description: 'This is separate from plan approval. Tasks will only be created after all required Procurement and Warehouse approvals are recorded.',
    fields: `<p>${esc(plan.id)} · ${esc(plan.strategy)}</p><label class="manager-check"><input name="confirm" type="checkbox" required> I confirm all prerequisite approvals are complete and authorize execution.</label>`,
    submit: 'Authorize execution',
    onSubmit: async () => {
      try {
        await authorizeExecution(planId)
      } catch (error) {
        return error.message
      }
      notify('Execution authorized. The recovery plan is now marked executed in the backend.')
      return ''
    },
  })
}

function saveLater(planId) {
  try {
    savePlanForLater(planId)
    notify('Plan saved to your management review list.')
  } catch (error) {
    notify(error.message, true)
  }
}

function escapeCsv(value) { return `"${String(value ?? '').replace(/"/g, '""')}"` }

function downloadCSV(filename, rows) {
  if (!rows.length) return notify('There are no rows to export.', true)
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const csv = [columns.map(escapeCsv).join(','), ...rows.map((row) => columns.map((key) => escapeCsv(row[key])).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function applyFilter(page, value) {
  navigate(page)
  const [key, filter] = value.split(':')
  window.setTimeout(() => {
    const mappings = {
      'disruptions:severity': ['disruption-severity', filter],
      'disruptions:status': ['disruption-status', filter],
      'approvals:status': ['approval-status', filter],
    }
    const target = mappings[`${page}:${key}`]
    if (target) {
      const element = document.getElementById(target[0])
      element.value = target[1]
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }
    if (page === 'monitoring' && key === 'status') {
      document.querySelectorAll('.manager-monitor-card').forEach((card) => {
        card.hidden = !card.textContent.toLowerCase().includes(filter.replace('_', ' '))
      })
    }
  }, 0)
}

document.querySelector('.manager-page').addEventListener('click', (event) => {
  const detail = event.target.closest('[data-detail-type][data-detail-id]')
  if (detail) {
    navigate('detail', detail.dataset.detailType, detail.dataset.detailId)
    return
  }
  const decision = event.target.closest('[data-action="decide"]')
  if (decision) {
    requestDecision(decision.dataset.id, decision.dataset.decision)
    return
  }
  const action = event.target.closest('[data-action]')
  if (action?.dataset.action === 'save') {
    saveLater(action.dataset.id)
    return
  }
  if (action?.dataset.action === 'authorize') {
    requestAuthorization(action.dataset.id)
    return
  }
  const pageLink = event.target.closest('[data-page]')
  if (pageLink) {
    event.preventDefault()
    const page = pageLink.dataset.page
    if (pageLink.dataset.filter) applyFilter(page, pageLink.dataset.filter)
    else navigate(page)
  }
})

document.querySelector('.manager-nav').addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]')
  if (!link) return
  event.preventDefault()
  navigate(link.hash.slice(1))
})
document.getElementById('detail-back').addEventListener('click', () => navigate(previousPage))
;['tower-search'].forEach((id) => document.getElementById(id).addEventListener('input', renderTower))
;['tower-severity', 'tower-status'].forEach((id) => document.getElementById(id).addEventListener('change', renderTower))
;['disruption-search'].forEach((id) => document.getElementById(id).addEventListener('input', renderDisruptions))
;['disruption-category', 'disruption-severity', 'disruption-status', 'disruption-sort'].forEach((id) => document.getElementById(id).addEventListener('change', renderDisruptions))
document.getElementById('approval-search').addEventListener('input', renderApprovals)
document.getElementById('approval-status').addEventListener('change', renderApprovals)
;['performance-period', 'performance-category'].forEach((id) => document.getElementById(id).addEventListener('change', renderPerformance))
;['audit-search'].forEach((id) => document.getElementById(id).addEventListener('input', renderAudit))
document.getElementById('audit-role').addEventListener('change', renderAudit)
document.getElementById('report-apply').addEventListener('click', renderReport)
document.getElementById('report-type').addEventListener('change', renderReport)
document.getElementById('report-csv').addEventListener('click', () => downloadCSV(`disruptioniq-${document.getElementById('report-type').value}-report.csv`, reportRows))
document.getElementById('report-pdf').addEventListener('click', () => window.print())
document.getElementById('audit-export').addEventListener('click', () => downloadCSV('disruptioniq-decision-audit.csv', getState().audit))
document.getElementById('settings-save').addEventListener('click', () => {
  const name = document.getElementById('settings-name').value.trim()
  if (!name) {
    document.getElementById('settings-status').textContent = 'Enter a display name before saving.'
    return
  }
  Object.assign(settings, {
    name,
    region: document.getElementById('settings-region').value,
    notifications: document.getElementById('settings-notifications').checked,
    compact: document.getElementById('settings-compact').checked,
  })
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  document.getElementById('settings-status').textContent = 'Preferences saved in this browser.'
  populateFilters()
  renderAll()
})
document.getElementById('manager-search').addEventListener('input', (event) => {
  const query = event.target.value.trim()
  if (!query) return
  const match = getRegionalDisruptions().find((item) => `${item.id} ${item.title} ${item.relatedId}`.toLowerCase().includes(query.toLowerCase()))
  if (match) {
    navigate('disruptions')
    document.getElementById('disruption-search').value = query
    renderDisruptions()
  } else {
    const plan = getState().plans.find((item) => `${item.id} ${item.strategy}`.toLowerCase().includes(query.toLowerCase()))
    if (plan) navigate('detail', 'plan', plan.id)
  }
})

function populateFilters() {
  const categories = [...new Set(getRegionalDisruptions().map((item) => item.category))].sort()
  const categorySelects = ['disruption-category', 'performance-category', 'report-category']
  categorySelects.forEach((id) => {
    const select = document.getElementById(id)
    select.innerHTML = `<option value="all">All categories</option>${categories.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join('')}`
  })
  const roles = [...new Set(getState().audit.map((item) => item.role))].sort()
  document.getElementById('audit-role').innerHTML = `<option value="all">All roles</option>${roles.map((role) => `<option value="${esc(role)}">${esc(role)}</option>`).join('')}`
}

function refresh() {
  populateFilters()
  renderAll()
  const hash = decodeURIComponent(window.location.hash.slice(1))
  if (hash.startsWith('detail/')) {
    const [, type, id] = hash.split('/')
    renderDetail(type, id)
  }
}

dateElement.textContent = fmtDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
if (actor.role !== 'Supply Chain Manager') {
  document.querySelector('.manager-page').innerHTML = '<section class="manager-card"><h1>Access unavailable</h1><p>This workspace is restricted to the Supply Chain Manager role in this workspace.</p><a href="/src/role-selection.html">Return to role selection</a></section>'
} else {
  window.addEventListener('hashchange', renderRoute)
  window.addEventListener('storage', (event) => {
    if (!event.key || event.key === 'disruptioniq.shared.recovery-workflow.v1') refresh()
  })
  window.addEventListener('disruptioniq:recovery-workflow-updated', refresh)
  renderRoute()
  window.__supplyChainManager = {
    getState,
    getDisruptions,
    getCounts,
    decideRecoveryPlan,
    authorizeExecution,
  }
}
