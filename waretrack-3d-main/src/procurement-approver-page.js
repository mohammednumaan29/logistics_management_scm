import { apiRequest as authenticatedRequest } from './api/client.js';
import { requireRole } from './api/client.js';
await requireRole('PROCUREMENT_APPROVER');
import './workspaces/procurement-approver.css'
import './workspaces/dashboard-consistency.css'

import { getCurrentActor, getDisruptions, getWorkflowState } from './workspaces/recovery-workflow.js'
import { initialActivity, inventoryItems, shipments as demoShipments, warehouseAlerts, warehouseSummary } from './workspaces/operations-analyst-data.js'

const API_BASE = 'http://localhost:8080/api'
const ANALYST_STATE_KEY = 'disruptioniq.operations-analyst.v2'
const actor = getCurrentActor()
const apiData = Object.create(null)
const apiState = Object.create(null)
const pagePaths = {
  shipments: '/shipments',
  suppliers: '/suppliers',
  warehouses: '/warehouses',
  inventory: '/inventory',
  orders: '/orders',
  products: '/products',
  customers: '/customers',
  plans: '/recovery-plans',
  approvals: '/recovery-plans/pending',
}
let previousPage = 'dashboard'
let decisionPlanId = ''
let decisionType = ''
let toastTimer = 0

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function fmtNumber(value) {
  if (value === null || value === undefined || value === '') return 'Not recorded'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? new Intl.NumberFormat().format(parsed) : 'Not recorded'
}

function fmtCurrency(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return 'Not recorded'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}

function fmtDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return 'Not recorded'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat(undefined, options).format(parsed)
}

function fmtDateTime(value) {
  return fmtDate(value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function titleCase(value) {
  return String(value || 'Not recorded').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusBadge(value) {
  const status = String(value || 'unknown').toLowerCase().replaceAll(' ', '_')
  return `<span class="proc-status-badge" data-status="${esc(status)}">${esc(titleCase(value))}</span>`
}

function emptyRow(columns, message = 'No matching records.') {
  return `<tr><td class="proc-empty" colspan="${columns}">${esc(message)}</td></tr>`
}

function safeJSON(value) {
  try { return JSON.parse(value) } catch { return null }
}

function getAnalystState() {
  return safeJSON(localStorage.getItem(ANALYST_STATE_KEY)) || {}
}

function operationalData() {
  const saved = getAnalystState()
  return {
    inventory: Array.isArray(apiData.inventory)
      ? apiData.inventory.map(normalizeInventory)
      : Array.isArray(saved.inventory) ? saved.inventory : inventoryItems,
    shipments: Array.isArray(apiData.shipments)
      ? apiData.shipments.map(normalizeShipment)
      : Array.isArray(saved.shipments) ? saved.shipments : demoShipments,
    customers: Array.isArray(saved.customers) ? saved.customers : [],
    orders: Array.isArray(saved.orders) ? saved.orders : null,
    products: Array.isArray(saved.products) ? saved.products : null,
    warehouses: Array.isArray(saved.warehouses) ? saved.warehouses : null,
    suppliers: Array.isArray(saved.suppliers) ? saved.suppliers : null,
  }
}

function normalizeShipment(record) {
  const supplier = record.supplier
  const destination = record.destinationWarehouse || record.destination || record.destinationLocation
  const status = record.status || record.shipmentStatus
  return {
    ...record,
    id: record.id || record.shipmentId,
    supplierName: record.supplierName || (typeof supplier === 'object' ? supplier.name || supplier.supplierName : supplier),
    destination,
    expectedDate: record.expectedDate || record.expectedDeliveryDate,
    productIds: record.productIds || (record.productId ? [record.productId] : []),
    status: typeof status === 'string' ? status.toLowerCase().replaceAll('_', '-') : status,
  }
}

function normalizeInventory(record) {
  const product = record.product
  const warehouse = record.warehouse
  return {
    ...record,
    id: record.id || record.inventoryId,
    productId: record.productId || product?.productId || product?.id,
    productName: record.productName || product?.name || product?.productName,
    category: record.category || product?.category,
    quantity: record.quantity ?? record.onHandQuantity,
    reserved: record.reserved ?? record.reservedQuantity,
    reorderThreshold: record.reorderThreshold ?? record.reorderPoint,
    warehouse: typeof warehouse === 'object' ? warehouse.id || warehouse.warehouseId : warehouse || record.warehouseId,
    location: record.location || record.storageLocation,
    supplier: record.supplier || product?.supplierName || product?.supplier?.name,
  }
}

function normalizeOrder(record) {
  const customer = record.customer
  const product = record.product
  return {
    ...record,
    id: record.id || record.orderId,
    orderId: record.orderId || record.id,
    customer: typeof customer === 'object' ? customer : record.customerName ? { name: record.customerName } : null,
    customerName: record.customerName || (typeof customer === 'object' ? customer.name || customer.customerName : customer),
    product: typeof product === 'object' ? product : null,
    productId: record.productId || product?.productId || product?.id,
    productName: record.productName || product?.name || product?.productName,
    priority: record.priority || record.priorityLevel,
    quantity: record.quantity ?? record.orderQuantity,
    promisedDeliveryDate: record.promisedDeliveryDate || record.deliveryDate || record.expectedDeliveryDate,
    status: record.status || record.orderStatus,
  }
}

function normalizeProduct(record) {
  const supplier = record.supplier
  return {
    ...record,
    id: record.id || record.productId,
    productId: record.productId || record.id,
    productName: record.productName || record.name,
    unitCost: record.unitCost ?? record.costPerUnit,
    supplier: record.supplierName || (typeof supplier === 'object' ? supplier.name || supplier.supplierName : supplier),
  }
}

function normalizeSupplier(record) {
  return {
    ...record,
    id: record.id || record.supplierId,
    name: record.name || record.supplierName,
    products: Array.isArray(record.products) && record.products.every((item) => typeof item === 'object') ? record.products : undefined,
    shipments: Array.isArray(record.shipments) && record.shipments.every((item) => typeof item === 'object') ? record.shipments : undefined,
  }
}

function normalizeWarehouse(record) {
  return {
    ...record,
    id: record.id || record.warehouseId,
    name: record.name || record.warehouseName,
    products: Array.isArray(record.products) && record.products.every((item) => typeof item === 'object') ? record.products : undefined,
  }
}

function normalizeCustomer(record) {
  return {
    ...record,
    id: record.id || record.customerId,
    customerId: record.customerId || record.id,
    name: record.name || record.customerName,
  }
}

function records(key, demoValue) {
  return Array.isArray(apiData[key]) ? apiData[key] : demoValue
}

function plans() {
  return records('plans', getWorkflowState().plans || [])
}

function pendingPlans() {
  return Array.isArray(apiData.approvals) ? apiData.approvals : plans().filter((plan) => plan.approval_status === 'pending')
}

function findPlan(id) {
  return plans().find((plan) => plan.id === id) || pendingPlans().find((plan) => plan.id === id)
}

function disruptions() {
  return getDisruptions()
}

function shipmentById(id) {
  const detail = apiData[`detail:shipment:${id}`]
  if (detail) return normalizeShipment(detail)
  return operationalData().shipments.find((shipment) => shipment.id === id || shipment.shipmentId === id)
}

function disruptionForShipment(shipment) {
  const list = disruptions()
  return list.find((item) => item.shipments?.includes(shipment?.id)) ||
    list.find((item) => item.relatedId === shipment?.id) ||
    list.find((item) => shipment?.productIds?.includes(item.relatedId))
}

function planShipment(plan) {
  const disruption = disruptions().find((item) => item.id === plan.disruptionId)
  const shipmentId = plan.shipmentId || plan.shipment?.shipmentId || plan.shipment?.id || disruption?.shipments?.[0]
  return shipmentById(shipmentId)
}

function linkedPlans(shipmentId) {
  if (Array.isArray(apiData[`plansByShipment:${shipmentId}`])) return apiData[`plansByShipment:${shipmentId}`].map(normalizePlan)
  return plans().filter((plan) => {
    const disruption = disruptions().find((item) => item.id === plan.disruptionId)
    return (plan.shipmentId || disruption?.shipments?.[0]) === shipmentId ||
      disruption?.shipments?.includes(shipmentId)
  })
}

function supplierName(shipment) {
  if (shipment?.supplierName || shipment?.supplier) return shipment.supplierName || shipment.supplier
  const productIds = shipment?.productIds || []
  const names = productIds.map((id) => operationalData().inventory.find((product) => product.productId === id)?.supplier).filter(Boolean)
  return [...new Set(names)].join(', ') || shipment?.origin || 'Not recorded'
}

function productForShipment(shipment) {
  return operationalData().inventory.find((product) => shipment?.productIds?.includes(product.productId))
}

function availableQuantity(item) {
  return Number(item?.quantity ?? item?.onHandQuantity ?? 0) - Number(item?.reserved ?? item?.reservedQuantity ?? 0)
}

function stockLevel(item) {
  const provided = String(item?.stockStatus || item?.stockClassification || '').toLowerCase()
  if (['critical', 'critical-stock', 'out-of-stock'].includes(provided)) return 'critical'
  if (['low', 'low-stock'].includes(provided)) return 'low'
  const available = availableQuantity(item)
  if (available <= 0) return 'critical'
  if (available <= Number(item?.reorderThreshold ?? item?.reorderPoint ?? 0)) return 'low'
  return 'healthy'
}

function riskLevel(score) {
  const value = Number(score)
  if (!Number.isFinite(value)) return 'unknown'
  if (value >= 75) return 'critical'
  if (value >= 50) return 'high'
  if (value >= 25) return 'medium'
  return 'low'
}

function shipmentRisk(shipment) {
  const risk = apiData[`risk:${shipment.id}`]
  if (risk) {
    const level = risk.riskClassification ?? risk.riskLevel ?? riskLevel(risk.riskScore ?? risk.score)
    return { ...risk, score: risk.riskScore ?? risk.score, level: String(level).toLowerCase() }
  }
  const disruption = disruptionForShipment(shipment)
  return disruption ? {
    score: disruption.riskScore,
    level: riskLevel(disruption.riskScore),
    disruption,
    demo: true,
  } : null
}

function orderRecords() {
  const data = operationalData()
  if (Array.isArray(apiData.orders)) return apiData.orders
  if (data.orders) return data.orders
  return data.shipments.map((shipment) => {
    const product = productForShipment(shipment)
    const customer = data.customers.find((entry) => (entry.orderIds || []).includes(shipment.orderId))
    return {
      id: shipment.orderId,
      orderId: shipment.orderId,
      customer,
      product,
      quantity: shipment.quantity,
      priority: shipment.priority,
      promisedDeliveryDate: shipment.expectedDate,
      status: shipment.status,
      shipment,
      derivedFromShipment: true,
    }
  })
}

function productRecords() {
  if (Array.isArray(apiData.products)) return apiData.products
  const data = operationalData()
  return data.products || data.inventory
}

function supplierRecords() {
  if (Array.isArray(apiData.suppliers)) return apiData.suppliers
  const data = operationalData()
  if (data.suppliers) return data.suppliers
  const grouped = new Map()
  data.inventory.forEach((product) => {
    const name = product.supplier
    if (!name) return
    if (!grouped.has(name)) grouped.set(name, { id: null, name, products: [], shipments: [] })
    grouped.get(name).products.push(product)
  })
  data.shipments.forEach((shipment) => {
    const supplier = supplierName(shipment)
    for (const name of supplier.split(', ')) {
      if (grouped.has(name)) grouped.get(name).shipments.push(shipment)
    }
  })
  return [...grouped.values()]
}

function warehouseRecords() {
  if (Array.isArray(apiData.warehouses)) return apiData.warehouses
  const data = operationalData()
  if (data.warehouses) return data.warehouses
  const grouped = new Map()
  data.inventory.forEach((item) => {
    const id = item.warehouse || 'Not recorded'
    if (!grouped.has(id)) grouped.set(id, { id, name: id === warehouseSummary.warehouseId ? warehouseSummary.warehouseName : null, products: [] })
    grouped.get(id).products.push(item)
  })
  return [...grouped.values()]
}

function customerRecords() {
  return Array.isArray(apiData.customers) ? apiData.customers : operationalData().customers
}

function relatedOrders(productId) {
  return orderRecords().filter((order) => order.productId === productId || order.product?.productId === productId || order.shipment?.productIds?.includes(productId))
}

function relatedShipments(productId) {
  return operationalData().shipments.filter((shipment) => shipment.productIds?.includes(productId))
}

function getCurrentPage() {
  return decodeURIComponent(location.hash.slice(1).split('/')[0] || 'dashboard')
}

function setStatus(id, message, kind = '') {
  const target = document.getElementById(id)
  if (!target) return
  target.textContent = message
  target.dataset.kind = kind
}

function showToast(message, error = false) {
  const toast = document.getElementById('proc-toast')
  toast.textContent = message
  toast.classList.toggle('is-error', error)
  toast.classList.add('is-visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4500)
}

function renderKpis() {
  const currentPlans = plans()
  const pending = pendingPlans()
  const active = currentPlans.filter((plan) => ['in_progress', 'pending', 'blocked'].includes(plan.execution_status))
  const highRisk = operationalData().shipments.filter((shipment) => ['high', 'critical'].includes(shipmentRisk(shipment)?.level))
  const summary = apiData.dashboardSummary || {}
  const approvedByMe = summary.approvedByMe ?? summary.approvedPlansByCurrentUser
  const rejectedByMe = summary.rejectedByMe ?? summary.rejectedPlansByCurrentUser
  const activeCount = summary.activeRecoveryPlans ?? summary.activePlans ?? active.length
  const highRiskCount = summary.highRiskShipments ?? highRisk.length
  const exposure = summary.procurementExposure ?? summary.estimatedProcurementExposure
  const counts = [
    { label: 'Pending approvals', value: fmtNumber(pending.length), note: 'Open eligible decision queue', href: '#approvals', icon: '✓' },
    { label: 'Approved by me', value: approvedByMe === undefined ? 'Not recorded' : fmtNumber(approvedByMe), note: 'Current-user backend metric', href: '#activity', icon: '↑' },
    { label: 'Rejected by me', value: rejectedByMe === undefined ? 'Not recorded' : fmtNumber(rejectedByMe), note: 'Current-user backend metric', href: '#activity', icon: '×' },
    { label: 'Active recovery plans', value: fmtNumber(activeCount), note: apiData.dashboardSummary ? 'Backend summary' : 'Available workflow records', href: '#plans', icon: '◷' },
    { label: 'High-risk shipments', value: fmtNumber(highRiskCount), note: apiData.dashboardSummary ? 'Backend summary' : 'Alert-based estimates', href: '#risk', icon: '!' },
    { label: 'Procurement exposure', value: exposure === undefined ? 'Unavailable' : fmtCurrency(exposure), note: exposure === undefined ? 'No consistent backend calculation' : 'Backend-reported metric', href: '#plans', icon: '₹' },
  ]
  document.getElementById('dashboard-kpis').innerHTML = counts.map((item) => `<a class="proc-kpi" href="${item.href}"><span class="proc-kpi-icon" aria-hidden="true">${item.icon}</span><span class="proc-kpi-body"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong><small>${esc(item.note)}</small></span><span class="proc-kpi-arrow" aria-hidden="true">↗</span></a>`).join('')
}

function approvalRows(source = plans(), tableId = 'approvals-table', empty = 'No plans are waiting for approval.') {
  const pending = tableId === 'dashboard-pending' || tableId === 'approvals-table'
    ? pendingPlans()
    : source.filter((plan) => plan.approval_status === 'pending')
  const query = (document.getElementById(tableId === 'dashboard-pending' ? 'dashboard-pending-search' : 'approval-search')?.value || '').trim().toLowerCase()
  const strategyFilter = document.getElementById('approval-strategy')?.value || 'all'
  const riskFilter = document.getElementById('approval-risk')?.value || 'all'
  const sort = document.getElementById('approval-sort')?.value || 'createdAt'
  const filtered = pending.filter((plan) => {
    const shipment = planShipment(plan)
    const risk = shipment ? shipmentRisk(shipment) : null
    return (!query || `${plan.id} ${shipment?.id || plan.shipmentId || ''}`.toLowerCase().includes(query)) &&
      (strategyFilter === 'all' || plan.strategy === strategyFilter) &&
      (riskFilter === 'all' || risk?.level === riskFilter)
  }).sort((left, right) => sort === 'cost'
    ? Number(right.simulation?.expectedCost ?? right.cost ?? 0) - Number(left.simulation?.expectedCost ?? left.cost ?? 0)
    : String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
  if (tableId === 'dashboard-pending') return filtered.slice(0, 5).map((plan) => planRow(plan, true)).join('') || emptyRow(9, empty)
  return filtered.map((plan) => planRow(plan, false)).join('') || emptyRow(9, empty)
}

function planRow(plan, compact) {
  const shipment = planShipment(plan)
  const shipmentId = shipment?.id || plan.shipmentId || 'Not linked'
  const cost = plan.simulation?.expectedCost ?? plan.cost
  const days = plan.simulation?.expectedRecoveryDays ?? plan.recoveryDays
  const ordersSaved = plan.ordersSaved ?? plan.expectedOrdersSaved
  const action = `<button class="proc-button proc-button-small" data-review-plan="${esc(plan.id)}">Review</button>`
  const creator = plan.createdBy || plan.createdByName || plan.createdByUserId || 'Not recorded'
  return `<tr><td><button class="proc-link" data-detail-type="plan" data-detail-id="${esc(plan.id)}">${esc(plan.id)}</button></td>
    <td>${shipment ? `<button class="proc-link" data-detail-type="shipment" data-detail-id="${esc(shipmentId)}">${esc(shipmentId)}</button>` : esc(shipmentId)}</td>
    <td>${esc(plan.strategy || 'Not recorded')}</td><td>${fmtCurrency(cost)}${plan.simulation ? '<small>Simulation estimate</small>' : ''}</td>
    <td>${days === undefined ? 'Not recorded' : `${fmtNumber(days)} days`}</td><td>${fmtNumber(ordersSaved)}</td>
    ${compact ? `<td>${esc(creator)}</td><td>${fmtDate(plan.createdAt)}</td><td>${action}</td>` : `<td>${esc(creator)}</td><td>${fmtDate(plan.createdAt)}</td><td>${action}</td>`}
  </tr>`
}

function populateRiskFilters() {
  const shipments = operationalData().shipments.filter((shipment) => shipmentRisk(shipment))
  const filters = [
    { id: 'risk-supplier-filter', label: 'All suppliers', values: shipments.map(supplierName) },
    { id: 'risk-warehouse-filter', label: 'All destinations', values: shipments.map((shipment) => shipment.destinationWarehouse || shipment.destination) },
  ]
  filters.forEach(({ id, label, values }) => {
    const select = document.getElementById(id)
    if (!select) return
    const selected = select.value
    const options = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
    select.innerHTML = `<option value="all">${label}</option>${options.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}`
    if (options.includes(selected)) select.value = selected
  })
}

function renderRiskRows(targetId, { highOnly = false } = {}) {
  const isRiskPage = targetId === 'risk-table'
  const riskFilter = isRiskPage ? document.getElementById('risk-filter')?.value || 'all' : 'all'
  const statusFilter = isRiskPage ? document.getElementById('risk-status-filter')?.value || 'all' : 'all'
  const supplierFilter = isRiskPage ? document.getElementById('risk-supplier-filter')?.value || 'all' : 'all'
  const warehouseFilter = isRiskPage ? document.getElementById('risk-warehouse-filter')?.value || 'all' : 'all'
  const rows = operationalData().shipments.filter((shipment) => {
    const risk = shipmentRisk(shipment)
    if (!risk) return false
    return (!highOnly || ['high', 'critical'].includes(risk.level)) &&
      (riskFilter === 'all' || risk.level === riskFilter) &&
      (statusFilter === 'all' || shipment.status === statusFilter) &&
      (supplierFilter === 'all' || supplierName(shipment) === supplierFilter) &&
      (warehouseFilter === 'all' || (shipment.destinationWarehouse || shipment.destination) === warehouseFilter)
  }).map((shipment) => {
    const risk = shipmentRisk(shipment)
    const disruption = risk?.disruption || disruptionForShipment(shipment)
    return `<tr><td><button class="proc-link" data-detail-type="shipment" data-detail-id="${esc(shipment.id)}">${esc(shipment.id)}</button></td>
      <td>${risk?.score === undefined ? 'Not recorded' : fmtNumber(risk.score)}${risk?.demo ? '<small>Alert estimate</small>' : ''}</td>
      <td>${risk ? statusBadge(risk.level) : 'Not recorded'}</td><td>${esc(disruption?.title || 'Not recorded')}</td>
      <td>${esc(shipment.delayReason || 'No delay recorded')}</td><td>${esc(supplierName(shipment))}</td>
      <td>${esc(shipment.destination || 'Not recorded')}</td><td><button class="proc-button proc-button-small proc-button-muted" data-detail-type="risk" data-detail-id="${esc(shipment.id)}">Details</button></td></tr>`
  })
  document.getElementById(targetId).innerHTML = rows.join('') || emptyRow(8, highOnly ? 'No high-risk shipment records are available.' : 'No shipment risk records match these filters.')
}

function renderShipmentRows() {
  const query = (document.getElementById('shipment-search')?.value || '').toLowerCase().trim()
  const filter = document.getElementById('shipment-filter')?.value || 'all'
  const list = operationalData().shipments.filter((shipment) => {
    const risk = shipmentRisk(shipment)
    const matchFilter = filter === 'all' || shipment.status === filter ||
      (filter === 'disrupted' && Boolean(disruptionForShipment(shipment))) ||
      (filter === 'high-risk' && ['high', 'critical'].includes(risk?.level))
    return matchFilter && (!query || `${shipment.id} ${shipment.orderId} ${supplierName(shipment)} ${shipment.destination}`.toLowerCase().includes(query))
  })
  document.getElementById('shipments-table').innerHTML = list.map((shipment) => `<tr><td><button class="proc-link" data-detail-type="shipment" data-detail-id="${esc(shipment.id)}">${esc(shipment.id)}</button></td><td>${fmtNumber(shipment.quantity)}</td><td>${statusBadge(shipment.status)}</td><td>${fmtDate(shipment.expectedDate || shipment.expectedDeliveryDate)}</td><td>${esc(supplierName(shipment))}</td><td>${esc(shipment.destinationWarehouse || shipment.destination || 'Not recorded')}</td><td><button class="proc-button proc-button-small proc-button-muted" data-detail-type="shipment" data-detail-id="${esc(shipment.id)}">Details</button></td></tr>`).join('') || emptyRow(7, 'No shipments match the selected filters.')
}

function renderSupplierRows() {
  const query = (document.getElementById('supplier-search')?.value || '').toLowerCase().trim()
  const list = supplierRecords().filter((supplier) => `${supplier.name || supplier.supplierName || ''} ${supplier.id || supplier.supplierId || ''} ${(supplier.products || []).map((product) => product.productName).join(' ')}`.toLowerCase().includes(query))
  document.getElementById('suppliers-table').innerHTML = list.map((supplier) => {
    const name = supplier.name || supplier.supplierName || 'Not recorded'
    const products = supplier.products || []
    const shipments = supplier.shipments || operationalData().shipments.filter((item) => supplierName(item).includes(name))
    return `<tr><td><button class="proc-link" data-detail-type="supplier" data-detail-id="${esc(supplier.id || supplier.supplierId || name)}">${esc(name)}</button><small>${esc(supplier.id || supplier.supplierId || 'Supplier ID not supplied')}</small></td><td>${supplier.status ? statusBadge(supplier.status) : 'Not recorded'}</td><td>${supplier.leadTimeDays === undefined && supplier.leadTime === undefined ? 'Not recorded' : `${fmtNumber(supplier.leadTimeDays ?? supplier.leadTime)} days`}</td><td>${fmtNumber(supplier.productCount ?? products.length)}</td><td>${fmtNumber(supplier.shipmentCount ?? shipments.length)}</td><td><button class="proc-button proc-button-small proc-button-muted" data-detail-type="supplier" data-detail-id="${esc(supplier.id || supplier.supplierId || name)}">Details</button></td></tr>`
  }).join('') || emptyRow(6, 'No supplier records match this search.')
}

function renderWarehouseRows() {
  const query = (document.getElementById('warehouse-search')?.value || '').toLowerCase().trim()
  const list = warehouseRecords().filter((warehouse) => `${warehouse.id || warehouse.warehouseId} ${warehouse.name || warehouse.warehouseName || ''} ${warehouse.location || ''}`.toLowerCase().includes(query))
  document.getElementById('warehouses-table').innerHTML = list.map((warehouse) => {
    const id = warehouse.id || warehouse.warehouseId || 'Not recorded'
    const products = warehouse.products || operationalData().inventory.filter((item) => item.warehouse === id || item.warehouseId === id)
    const stockText = [...new Set(products.map((item) => item.unit).filter(Boolean))].map((unit) => `${fmtNumber(products.filter((item) => item.unit === unit).reduce((sum, item) => sum + availableQuantity(item), 0))} ${unit}`).join(' · ')
    const capacity = warehouse.capacity ?? warehouse.totalLocations ?? (id === warehouseSummary.warehouseId ? `${warehouseSummary.occupiedLocations} / ${warehouseSummary.totalLocations} locations` : null)
    return `<tr><td><button class="proc-link" data-detail-type="warehouse" data-detail-id="${esc(id)}">${esc(id)}</button></td><td>${esc(warehouse.name || warehouse.warehouseName || (id === warehouseSummary.warehouseId ? warehouseSummary.warehouseName : 'Not recorded'))}</td><td>${esc(warehouse.location || 'Not recorded')}</td><td>${capacity === null || capacity === undefined ? 'Not recorded' : esc(capacity)}</td><td>${fmtNumber(warehouse.inventoryCount ?? products.length)}</td><td>${stockText || 'Not recorded'}</td><td><button class="proc-button proc-button-small proc-button-muted" data-detail-type="warehouse" data-detail-id="${esc(id)}">Details</button></td></tr>`
  }).join('') || emptyRow(7, 'No warehouse records match this search.')
}

function renderInventoryRows() {
  const query = (document.getElementById('inventory-search')?.value || '').toLowerCase().trim()
  const filter = document.getElementById('inventory-filter')?.value || 'all'
  const list = operationalData().inventory.filter((item) => {
    const level = stockLevel(item)
    return (filter === 'all' || level === filter) &&
      `${item.id} ${item.productId} ${item.productName} ${item.sku} ${item.warehouse} ${item.location}`.toLowerCase().includes(query)
  })
  document.getElementById('inventory-table').innerHTML = list.map((item) => `<tr><td><button class="proc-link" data-detail-type="inventory" data-detail-id="${esc(item.id || item.inventoryId)}">${esc(item.id || item.inventoryId || 'Not recorded')}</button></td><td><button class="proc-link" data-detail-type="product" data-detail-id="${esc(item.productId)}">${esc(item.productName || item.productId || 'Not recorded')}</button><small>${esc(item.productId || '')}</small></td><td>${esc(item.warehouse || item.warehouseId || 'Not recorded')}<small>${esc(item.location || 'Location not recorded')}</small></td><td>${fmtNumber(item.quantity ?? item.onHandQuantity)} ${esc(item.unit || '')}</td><td>${fmtNumber(item.reserved ?? item.reservedQuantity)} ${esc(item.unit || '')}</td><td>${fmtNumber(availableQuantity(item))} ${esc(item.unit || '')}</td><td>${fmtNumber(item.reorderThreshold ?? item.reorderPoint)} ${esc(item.unit || '')}</td><td>${fmtNumber(item.dailyDemand)}</td><td>${statusBadge(stockLevel(item))}<small>Stock-derived</small></td></tr>`).join('') || emptyRow(9, 'No inventory records match the selected filters.')
}

function renderOrderRows() {
  const query = (document.getElementById('order-search')?.value || '').toLowerCase().trim()
  const filter = document.getElementById('order-filter')?.value || 'all'
  const list = orderRecords().filter((order) => {
    const priority = String(order.priority || order.priorityLevel || 'not recorded').toLowerCase()
    const atRisk = ['delayed', 'disrupted', 'failed'].includes(String(order.status || '').toLowerCase())
    return (filter === 'all' || priority === filter || (filter === 'at-risk' && atRisk) || (filter === 'confirmed' && order.status === 'confirmed')) &&
      `${order.id || order.orderId} ${order.customer?.name || order.customerName || ''} ${order.product?.productName || order.productName || ''}`.toLowerCase().includes(query)
  })
  document.getElementById('orders-table').innerHTML = list.map((order) => {
    const id = order.id || order.orderId || 'Not recorded'
    const product = order.product || operationalData().inventory.find((item) => item.productId === order.productId) || order.shipment && productForShipment(order.shipment)
    return `<tr><td><button class="proc-link" data-detail-type="order" data-detail-id="${esc(id)}">${esc(id)}</button>${order.derivedFromShipment ? '<small>Shipment-linked reference</small>' : ''}</td><td>${esc(order.customer?.name || order.customerName || 'Not recorded')}</td><td>${esc(product?.productName || order.productName || 'Not recorded')}</td><td>${statusBadge(order.priority || order.priorityLevel)}</td><td>${fmtNumber(order.quantity)}</td><td>${fmtDate(order.promisedDeliveryDate || order.deliveryDate || order.expectedDate)}</td><td>${statusBadge(order.status)}</td><td><button class="proc-button proc-button-small proc-button-muted" data-detail-type="order" data-detail-id="${esc(id)}">Details</button></td></tr>`
  }).join('') || emptyRow(8, 'No order records match this filter. No customer/order master feed is currently available.')
}

function renderProductRows() {
  const query = (document.getElementById('product-search')?.value || '').toLowerCase().trim()
  const list = productRecords().filter((product) => `${product.productId} ${product.id} ${product.productName} ${product.name} ${product.category} ${product.supplier}`.toLowerCase().includes(query))
  document.getElementById('products-table').innerHTML = list.map((product) => {
    const id = product.productId || product.id
    return `<tr><td><button class="proc-link" data-detail-type="product" data-detail-id="${esc(id)}">${esc(product.productName || product.name || id)}</button><small>${esc(id || 'Not recorded')}</small></td><td>${esc(product.category || 'Not recorded')}</td><td>${fmtCurrency(product.unitCost ?? product.costPerUnit)}</td><td>${fmtNumber(product.inventoryCount ?? operationalData().inventory.filter((item) => item.productId === id).length)}</td><td>${fmtNumber(product.orderCount ?? relatedOrders(id).length)}</td><td>${fmtNumber(product.shipmentCount ?? relatedShipments(id).length)}</td><td><button class="proc-button proc-button-small proc-button-muted" data-detail-type="product" data-detail-id="${esc(id)}">Details</button></td></tr>`
  }).join('') || emptyRow(7, 'No product records match this search.')
}

function renderCustomerRows() {
  const query = (document.getElementById('customer-search')?.value || '').toLowerCase().trim()
  const customers = customerRecords().filter((customer) => `${customer.customerId} ${customer.id} ${customer.name} ${customer.email}`.toLowerCase().includes(query))
  document.getElementById('customers-table').innerHTML = customers.map((customer) => {
    const orderIds = customer.orderIds || []
    const related = orderRecords().filter((order) => orderIds.includes(order.orderId || order.id) || order.customerId === (customer.customerId || customer.id))
    return `<tr><td><button class="proc-link" data-detail-type="customer" data-detail-id="${esc(customer.customerId || customer.id)}">${esc(customer.name || customer.customerName || 'Not recorded')}</button><small>${esc(customer.customerId || customer.id || '')}</small></td><td>${esc(customer.email || 'Not recorded')}</td><td>${fmtNumber(customer.orderCount ?? related.length)}</td><td>${related.map((order) => esc(titleCase(order.priority || order.priorityLevel))).join(', ') || 'Not recorded'}</td><td><button class="proc-button proc-button-small proc-button-muted" data-detail-type="customer" data-detail-id="${esc(customer.customerId || customer.id)}">Details</button></td></tr>`
  }).join('') || emptyRow(5, 'No customer master records are available from the backend.')
}

function renderPlanRows() {
  const query = (document.getElementById('plan-search')?.value || '').toLowerCase().trim()
  const filter = document.getElementById('plan-filter')?.value || 'all'
  const list = plans().filter((plan) => {
    const shipment = planShipment(plan)
    const execution = String(plan.execution_status || '')
    const statusMatch = filter === 'all' ||
      (filter === 'in_progress' ? execution === 'in_progress' : filter === 'successful' ? execution === 'successful' : plan.approval_status === filter)
    return statusMatch && `${plan.id} ${shipment?.id || ''} ${plan.shipmentId || ''} ${plan.strategy} ${plan.createdBy}`.toLowerCase().includes(query)
  }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  document.getElementById('plans-table').innerHTML = list.map((plan) => {
    const shipment = planShipment(plan)
    return `<tr><td><button class="proc-link" data-detail-type="plan" data-detail-id="${esc(plan.id)}">${esc(plan.id)}</button></td><td>${esc(shipment?.id || plan.shipmentId || 'Not linked')}</td><td>${esc(plan.strategy || 'Not recorded')}</td><td>${statusBadge(plan.approval_status)}</td><td>${statusBadge(plan.execution_status)}</td><td>${fmtCurrency(plan.simulation?.expectedCost ?? plan.cost)}${plan.simulation ? '<small>Simulation estimate</small>' : ''}</td><td>${fmtNumber(plan.simulation?.expectedRecoveryDays ?? plan.recoveryDays)}</td><td>${fmtNumber(plan.ordersSaved ?? plan.expectedOrdersSaved)}</td><td>${esc(plan.createdBy || plan.createdByName || plan.createdByUserId || 'Not recorded')}</td><td>${fmtDate(plan.createdAt)}</td><td><button class="proc-button proc-button-small proc-button-muted" data-detail-type="plan" data-detail-id="${esc(plan.id)}">Details</button></td></tr>`
  }).join('') || emptyRow(11, 'No recovery plans match this filter.')
}

function renderAlerts() {
  const pending = plans().filter((plan) => plan.approval_status === 'pending')
  const critical = disruptions().filter((item) => item.severity === 'critical' && item.status !== 'resolved')
  const shortages = operationalData().inventory.filter((item) => stockLevel(item) !== 'healthy')
  const alerts = [
    ...pending.map((plan) => ({ level: 'warning', title: `Approval pending · ${plan.id}`, message: `${plan.strategy} · ${fmtCurrency(plan.simulation?.expectedCost ?? plan.cost)} estimate`, page: 'approvals' })),
    ...critical.map((item) => ({ level: 'critical', title: `Critical disruption · ${item.id}`, message: item.title, page: 'risk' })),
    ...shortages.slice(0, 3).map((item) => ({ level: stockLevel(item) === 'critical' ? 'critical' : 'warning', title: `Inventory ${stockLevel(item)} · ${item.productName}`, message: `${fmtNumber(availableQuantity(item))} ${item.unit} available · reorder ${fmtNumber(item.reorderThreshold)}`, page: 'inventory' })),
  ]
  document.getElementById('dashboard-alerts').innerHTML = alerts.slice(0, 8).map((item) => `<button class="proc-alert" data-navigate="${item.page}" data-level="${item.level}"><i></i><span><b>${esc(item.title)}</b><small>${esc(item.message)}</small></span><span aria-hidden="true">→</span></button>`).join('') || '<p class="proc-empty-copy">No procurement alerts in the current backend records.</p>'
}

function renderDashboard() {
  renderKpis()
  document.getElementById('dashboard-pending').innerHTML = approvalRows(pendingPlans(), 'dashboard-pending')
  renderRiskRows('dashboard-risk', { highOnly: true })
  renderAlerts()
  const activity = Array.isArray(apiData.dashboardActivity) ? apiData.dashboardActivity : []
  document.getElementById('dashboard-activity').innerHTML = activity.slice(0, 5).map((item) => `<article class="proc-timeline-item"><i></i><div><b>${esc(item.action || item.title || 'Activity')}</b><p>${esc(item.description || item.message || item.planId || '')}</p><small>${fmtDateTime(item.timestamp || item.createdAt)} · ${esc(item.userName || item.user || '')}</small></div></article>`).join('') || '<p class="proc-empty-copy">No backend activity events are available. Fallback audit records are not presented as authenticated activity.</p>'
  document.getElementById('nav-pending').textContent = String(pendingPlans().length || '')
  setStatus('dashboard-activity-status', apiState.dashboardActivity === 'error' ? 'Audit activity API is unavailable.' : '', 'error')
}

function renderPage(page) {
  switch (page) {
    case 'dashboard': renderDashboard(); break
    case 'shipments': renderShipmentRows(); break
    case 'suppliers': renderSupplierRows(); break
    case 'warehouses': renderWarehouseRows(); break
    case 'inventory': renderInventoryRows(); break
    case 'orders': renderOrderRows(); break
    case 'products': renderProductRows(); break
    case 'customers': renderCustomerRows(); break
    case 'risk': populateRiskFilters(); renderRiskRows('risk-table'); break
    case 'plans': renderPlanRows(); break
    case 'approvals':
      renderApprovalStrategyOptions()
      document.getElementById('approvals-table').innerHTML = approvalRows(pendingPlans())
      document.getElementById('nav-pending').textContent = String(pendingPlans().length || '')
      break
  }
}

function renderApprovalStrategyOptions() {
  const select = document.getElementById('approval-strategy')
  const current = select.value
  const strategies = [...new Set(pendingPlans().map((plan) => plan.strategy).filter(Boolean))]
  select.innerHTML = '<option value="all">All strategies</option>' + strategies.map((strategy) => `<option value="${esc(strategy)}">${esc(strategy)}</option>`).join('')
  select.value = strategies.includes(current) ? current : 'all'
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload
  for (const key of ['data', 'items', 'records', 'content', 'results']) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  if (payload?.data && typeof payload.data === 'object') return extractList(payload.data)
  if (payload === null || payload === undefined) return []
  throw new Error('Backend response did not contain a recognized record list.')
}

function unwrap(payload) {
  return payload?.data ?? payload?.plan ?? payload?.shipment ?? payload
}

function normalizePlan(record) {
  if (!record || typeof record !== 'object') return record
  const creator = record.createdBy
  const creatorId = creator && typeof creator === 'object' ? creator.id || creator.userId : null
  const creatorName = creator && typeof creator === 'object' ? creator.name || creator.username : creator
  const approvalStatus = record.approval_status || record.approvalStatus
  const executionStatus = record.execution_status || record.executionStatus
  return {
    ...record,
    id: record.id || record.recoveryPlanId,
    shipmentId: record.shipmentId || record.shipment?.shipmentId || record.shipment?.id,
    strategy: record.strategy || record.recoveryStrategy,
    approval_status: typeof approvalStatus === 'string' ? approvalStatus.toLowerCase() : approvalStatus,
    execution_status: typeof executionStatus === 'string' ? executionStatus.toLowerCase() : executionStatus,
    execution_authorisation_status: record.execution_authorisation_status || record.executionAuthorizationStatus,
    createdByUserId: record.createdByUserId || creatorId,
    createdBy: record.createdByName || creatorName || record.createdByUserId || 'Not recorded',
    cost: record.cost ?? record.estimatedCost,
    recoveryDays: record.recoveryDays ?? record.estimatedRecoveryDays,
    ordersSaved: record.ordersSaved ?? record.expectedOrdersSaved,
  }
}

async function apiRequest(path, options = {}) {
  const apiPath = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return authenticatedRequest(apiPath, options);
}

function errorText(error) {
  if (error.status === 401) return 'Authentication is required. Sign in again to obtain a JWT.'
  if (error.status === 403) return 'The backend denied this action for the current role.'
  if (error.status === 404) return 'The requested record or backend route was not found.'
  if (error.status === 409) return 'The plan has already changed. Refresh the queue before deciding again.'
  if (error.details) return `${error.message} ${JSON.stringify(error.details)}`
  return error.message
}

function statusElementId(page) {
  if (page === 'notifications') return 'notifications-status'
  if (page === 'activity') return 'activity-status'
  return `${page}-api-status`
}

async function syncPage(page, force = false) {
  if (page === 'detail' || page === 'review') return
  const jobs = []
  if (page === 'dashboard') {
    jobs.push(['dashboardSummary', '/dashboard/summary', 'object'])
    jobs.push(['dashboardActivity', '/dashboard/recovery-activity', 'list'])
    jobs.push(['approvals', '/recovery-plans/pending', 'plans'])
  } else if (page === 'risk') {
    operationalData().shipments.forEach((shipment) => {
      jobs.push([`risk:${shipment.id}`, `/risk/shipments/${encodeURIComponent(shipment.id)}`, 'object'])
    })
  } else if (page === 'notifications') {
    jobs.push(['notifications', '/notifications', 'list'])
    jobs.push(['notificationSummary', '/notifications/summary', 'object'])
  } else if (page === 'activity') {
    jobs.push(['activity', '/audit/users/me', 'list'])
  } else if (pagePaths[page]) {
    jobs.push([page, pagePaths[page], 'list'])
  }
  if (!jobs.length) return
  const statusTarget = document.getElementById(statusElementId(page))
  if (statusTarget) setStatus(statusTarget.id, 'Checking the backend; fallback values remain available while it loads…', 'info')
  await Promise.all(jobs.map(async ([key, path, shape]) => {
    if (!force && apiState[key] === 'loaded') return
    apiState[key] = 'loading'
    try {
      const payload = await apiRequest(path)
      const value = shape === 'list' || shape === 'plans' ? extractList(payload) : unwrap(payload)
      const normalizers = {
        shipments: normalizeShipment,
        suppliers: normalizeSupplier,
        warehouses: normalizeWarehouse,
        inventory: normalizeInventory,
        orders: normalizeOrder,
        products: normalizeProduct,
        customers: normalizeCustomer,
        plans: normalizePlan,
        approvals: normalizePlan,
      }
      apiData[key] = normalizers[key] ? value.map(normalizers[key]) : value
      apiState[key] = 'loaded'
    } catch (error) {
      apiState[key] = 'error'
      apiState[`${key}Error`] = errorText(error)
    }
  }))
  if (page === 'notifications') renderNotifications()
  else if (page === 'activity') renderActivity()
  else if (page === 'dashboard') renderDashboard()
  else renderPage(page)
  updateApiStatus(page, jobs.map(([key]) => key))
}

function objectEntriesCard(title, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  const entries = Object.entries(value).filter(([, item]) => item !== null && item !== undefined)
  if (!entries.length) return ''
  return `<article class="proc-card"><h2>${esc(title)}</h2><dl class="proc-dl">${entries.map(([key, item]) => {
    const display = typeof item === 'object' ? JSON.stringify(item) : item
    return `<div><dt>${esc(titleCase(key))}</dt><dd>${esc(display)}</dd></div>`
  }).join('')}</dl></article>`
}

async function syncDetail(type, id, force = false) {
  const cacheKey = `detail:${type}:${id}`
  if (!force && apiState[cacheKey] === 'loaded') return
  if (!force && apiState[cacheKey] === 'loading') return
  const encoded = encodeURIComponent(id)
  let requests = []
  if (type === 'plan') {
    requests = [['record', `/recovery-plans/${encoded}`], ['audit', `/recovery-plans/${encoded}/audit`]]
  } else if (type === 'shipment' || type === 'risk') {
    requests = [
      ['record', `/shipments/${encoded}`],
      ['impact', `/impact/shipments/${encoded}`],
      ['risk', `/risk/shipments/${encoded}`],
      ['ai', `/ai/shipments/${encoded}/risk-explanations`],
      ['plans', `/recovery-plans/shipment/${encoded}`],
      ['audit', `/audit/shipments/${encoded}`],
    ]
  } else {
    const endpoint = {
      supplier: 'suppliers',
      warehouse: 'warehouses',
      inventory: 'inventory',
      product: 'products',
      order: 'orders',
      customer: 'customers',
    }[type]
    if (endpoint) requests = [['record', `/${endpoint}/${encoded}`]]
  }
  if (!requests.length) return
  apiState[cacheKey] = 'loading'
  setStatus('detail-api-status', 'Loading record details from backend…', 'info')
  const results = await Promise.all(requests.map(async ([key, path]) => {
    try { return [key, await apiRequest(path), null] } catch (error) { return [key, null, errorText(error)] }
  }))
  const errors = []
  for (const [key, payload, error] of results) {
    if (error) {
      errors.push(`${key}: ${error}`)
      continue
    }
    const value = unwrap(payload)
    if (key === 'record') {
      apiData[cacheKey] = value
      if (type === 'plan' && value && typeof value === 'object') {
        const plan = normalizePlan(value)
        const known = plans().some((item) => item.id === plan.id)
        apiData.plans = known ? plans().map((item) => item.id === plan.id ? { ...item, ...plan } : item) : [...plans(), plan]
      }
    } else if (key === 'audit' || key === 'plans') {
      try {
        const list = extractList(payload)
        if (key === 'audit') apiData[type === 'plan' ? `audit:${id}` : `shipmentAudit:${id}`] = list
        else apiData[`plansByShipment:${id}`] = list
      } catch (error) {
        errors.push(`${key}: ${errorText(error)}`)
      }
    }
    else {
      apiData[`${key}:${id}`] = value
      if (key === 'record' && type === 'risk') apiData[`detail:shipment:${id}`] = value
    }
  }
  apiState[cacheKey] = errors.length ? 'error' : 'loaded'
  if (getCurrentPage() === 'detail' && decodeURIComponent(location.hash.split('/').slice(2).join('/')) === id) {
    renderDetail(type, id)
    setStatus('detail-api-status', errors.length
      ? `Backend details unavailable: ${errors.join(' · ')} Fallback details remain visible where available.`
      : 'Backend record, impact, risk, and related history loaded.', errors.length ? 'warning' : 'success')
  }
}

function updateApiStatus(page, keys) {
  const errors = keys.filter((key) => apiState[key] === 'error')
  const targetId = statusElementId(page)
  if (!document.getElementById(targetId)) return
  if (page === 'risk' && errors.length) {
    setStatus(targetId, `Risk API unavailable for ${errors.length} shipment record(s). Labeled alert estimates are shown where available.`, 'warning')
    return
  }
  if (errors.length) setStatus(targetId, `Backend data is unavailable: ${errors.map((key) => apiState[`${key}Error`]).join(' · ')} ${page === 'notifications' || page === 'activity' ? '' : 'Fallback records are shown where available.'}`, 'error')
  else setStatus(targetId, keys.some((key) => apiState[key] === 'loaded') ? 'Backend data loaded successfully.' : '', 'success')
}

function renderNotifications() {
  const list = Array.isArray(apiData.notifications) ? apiData.notifications : []
  const summary = apiData.notificationSummary || {}
  const unread = summary.unreadCount ?? summary.unread ?? list.filter((item) => !item.read && !item.isRead).length
  document.getElementById('notification-summary').textContent = `${fmtNumber(unread)} unread`
  document.getElementById('nav-notifications').textContent = Number(unread) ? String(unread) : ''
  document.getElementById('notifications-list').innerHTML = list.map((item) => {
    const id = item.id || item.notificationId
    const action = item.read || item.isRead
      ? '<span>Read</span>'
      : id
        ? `<button class="proc-button proc-button-small proc-button-muted" data-mark-read="${esc(id)}">Mark read</button>`
        : '<span>Read state cannot be updated: notification ID not supplied.</span>'
    return `<article class="proc-notification ${item.read || item.isRead ? '' : 'is-unread'}"><span class="proc-notification-dot"></span><div><b>${esc(item.title || 'Notification')}</b><p>${esc(item.message || item.description || '')}</p><small>${esc(titleCase(item.type || item.notificationType || 'Update'))} · ${fmtDateTime(item.createdAt || item.timestamp)}</small></div>${action}</article>`
  }).join('') || '<div class="proc-empty-state">No authenticated-user notifications were returned.</div>'
  updateApiStatus('notifications', ['notifications', 'notificationSummary'])
}

function renderActivity() {
  const list = Array.isArray(apiData.activity) ? apiData.activity : []
  document.getElementById('activity-list').innerHTML = list.map((item) => `<article class="proc-timeline-item"><i></i><div><b>${esc(item.action || item.activityType || item.eventType || 'Activity')}</b><p>${esc(item.description || item.message || item.comments || '')}</p><small>${fmtDateTime(item.timestamp || item.createdAt)}${item.planId ? ` · ${esc(item.planId)}` : ''}${item.shipmentId ? ` · ${esc(item.shipmentId)}` : ''}</small></div></article>`).join('') || '<p class="proc-empty-copy">No personal audit events were returned for this account.</p>'
  updateApiStatus('activity', ['activity'])
}

function setRoute(page, type = '', id = '') {
  const route = type && id ? `#${page}/${encodeURIComponent(type)}/${encodeURIComponent(id)}` : `#${page}`
  if (location.hash === route) renderRoute()
  else location.hash = route
}

function renderRoute() {
  const parts = decodeURIComponent(location.hash.slice(1) || 'dashboard').split('/')
  const [page, type, id] = parts
  const allowed = new Set(['dashboard', ...Object.keys(pagePaths), 'risk', 'notifications', 'activity', 'review', 'detail'])
  const selected = allowed.has(page) ? page : 'dashboard'
  if (!allowed.has(page)) history.replaceState(null, '', '#dashboard')
  document.querySelectorAll('.proc-page').forEach((view) => { view.hidden = view.dataset.page !== selected })
  document.querySelectorAll('.proc-nav a').forEach((link) => {
    const active = link.hash.slice(1) === selected
    link.classList.toggle('is-active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  if (selected !== 'detail' && selected !== 'review') previousPage = selected
  window.scrollTo(0, 0)
  if (selected === 'review' && id) {
    renderReview(id)
    return
  }
  if (selected === 'detail' && type && id) {
    renderDetail(type, id)
    void syncDetail(type, id)
    return
  }
  renderPage(selected)
  void syncPage(selected)
}

function currentCreatorIsActor(plan) {
  return Boolean(plan.createdByUserId && plan.createdByUserId === actor.id)
}

function decisionAllowed(plan) {
  return actor.role === 'Procurement Approver' && plan?.approval_status === 'pending' && !currentCreatorIsActor(plan)
}

function strategyDescription(strategy) {
  const value = String(strategy || '').toLowerCase()
  if (value.includes('alternative supplier')) return 'Source the required goods from an alternative supplier.'
  if (value.includes('reallocat') || value.includes('warehouse stock transfer')) return 'Reallocate available inventory between locations.'
  if (value.includes('expedite')) return 'Accelerate the existing or replacement shipment.'
  if (value.includes('split order')) return 'Fulfil the order in separate shipments or quantities.'
  if (value === 'do_nothing') return 'Maintain the current operating plan.'
  return 'Strategy description is not supplied by the backend.'
}

function renderReview(planId) {
  const plan = findPlan(planId)
  document.getElementById('review-backend-context').innerHTML = ''
  if (!plan) {
    document.getElementById('review-title').textContent = 'Recovery plan unavailable'
    document.getElementById('review-content').innerHTML = '<div class="proc-empty-state">This plan is not present in the accessible backend records. The backend detail request may still provide it.</div>'
    document.getElementById('review-approve').disabled = true
    document.getElementById('review-reject').disabled = true
    setStatus('review-api-status', 'Review is disabled until an accessible pending plan is loaded.', 'warning')
    return
  }
  const shipment = planShipment(plan)
  const disruption = shipment ? disruptionForShipment(shipment) : disruptions().find((item) => item.id === plan.disruptionId)
  const product = productForShipment(shipment)
  const orders = orderRecords().filter((order) => order.orderId === shipment?.orderId || order.id === shipment?.orderId)
  const inventory = shipment?.productIds?.map((productId) => operationalData().inventory.find((item) => item.productId === productId)).filter(Boolean) || []
  document.getElementById('review-title').textContent = `Review ${plan.id}`
  document.getElementById('review-subtitle').textContent = `${shipment?.id || plan.shipmentId || 'Shipment not linked'} · ${plan.strategy || 'Strategy not recorded'}`
  document.getElementById('review-content').innerHTML = `<div class="proc-review-grid">
    <article class="proc-card"><p class="proc-eyebrow">01 · DISRUPTION CONTEXT</p><h2>Shipment and supplier</h2><dl class="proc-dl"><div><dt>Shipment</dt><dd>${esc(shipment?.id || plan.shipmentId || 'Not recorded')}</dd></div><div><dt>Status</dt><dd>${statusBadge(shipment?.status)}</dd></div><div><dt>Supplier</dt><dd>${esc(supplierName(shipment))}</dd></div><div><dt>Destination</dt><dd>${esc(shipment?.destination || 'Not recorded')}</dd></div><div><dt>Expected delivery</dt><dd>${fmtDate(shipment?.expectedDate)}</dd></div><div><dt>Delay information</dt><dd>${esc(shipment?.delayReason || 'No delay recorded')}</dd></div><div><dt>Disruption</dt><dd>${esc(disruption?.title || 'Not recorded')}</dd></div></dl></article>
    <article class="proc-card"><p class="proc-eyebrow">02 · BUSINESS IMPACT</p><h2>Orders and inventory</h2><p>${disruption ? esc(disruption.impact || disruption.description) : 'Detailed impact analysis is not available in the backend records.'}</p><div class="proc-review-list"><b>Orders linked</b>${orders.map((order) => `<span>${esc(order.orderId || order.id)} · ${titleCase(order.priority || 'priority not recorded')} · ${fmtDate(order.promisedDeliveryDate || order.expectedDate)}</span>`).join('') || '<span>Order master impact not recorded.</span>'}<b>Available stock</b>${inventory.map((item) => `<span>${esc(item.productName)} · ${fmtNumber(availableQuantity(item))} ${esc(item.unit)} available · reorder ${fmtNumber(item.reorderThreshold)}</span>`).join('') || '<span>Inventory impact not recorded.</span>'}</div><small>Backend impact analysis enriches this context when available.</small><div id="review-impact-detail" class="proc-muted" hidden></div></article>
    <article class="proc-card"><p class="proc-eyebrow">03 · PROPOSED STRATEGY</p><h2>${esc(plan.strategy || 'Not recorded')}</h2><p>${esc(strategyDescription(plan.strategy))}</p><dl class="proc-dl"><div><dt>Source warehouse</dt><dd>${esc(plan.sourceWarehouse || 'Not recorded')}</dd></div><div><dt>Reallocation quantity</dt><dd>${fmtNumber(plan.reallocationQuantity)}</dd></div><div><dt>Alternative supplier</dt><dd>${esc(plan.alternativeSupplier || 'Not recorded')}</dd></div><div><dt>Expedited arrival</dt><dd>${fmtNumber(plan.expeditedArrivalDays)}</dd></div><div><dt>Split quantity</dt><dd>${fmtNumber(plan.splitQuantity)}</dd></div></dl></article>
    <article class="proc-card"><p class="proc-eyebrow">04 · COST AND BENEFIT</p><h2>Estimate review</h2><div class="proc-review-metrics"><span><small>Estimated cost</small><b>${fmtCurrency(plan.simulation?.expectedCost ?? plan.cost)}</b></span><span><small>Recovery days</small><b>${fmtNumber(plan.simulation?.expectedRecoveryDays ?? plan.recoveryDays)}</b></span><span><small>Orders saved</small><b>${fmtNumber(plan.ordersSaved ?? plan.expectedOrdersSaved)}</b></span></div><p>Costs and recovery duration are simulation estimates where indicated. No savings, ROI, or cost-benefit ratio is calculated.</p></article>
    <article class="proc-card"><p class="proc-eyebrow">05 · RISK CONSIDERATIONS</p><h2>Risk review</h2><dl class="proc-dl"><div><dt>Risk score</dt><dd>${fmtNumber(disruption?.riskScore ?? plan.riskScore)}${disruption?.riskScore !== undefined || plan.riskScore !== undefined ? ' · alert estimate' : ''}</dd></div><div><dt>Classification</dt><dd>${statusBadge(disruption ? riskLevel(disruption.riskScore) : plan.riskScore !== undefined ? riskLevel(plan.riskScore) : '')}</dd></div><div><dt>Risk factors</dt><dd>${esc(disruption?.explanation || 'No risk factors supplied.')}</dd></div><div><dt>Operational constraints</dt><dd>${esc(shipment?.delayReason || 'Not recorded')}</dd></div><div><dt>AI explanation</dt><dd id="review-ai-explanation">Loading backend AI explanation…</dd></div></dl><div id="review-risk-detail" class="proc-muted" hidden></div></article>
    <article class="proc-card"><p class="proc-eyebrow">06 · APPROVAL DECISION</p><h2>Eligibility and history</h2><dl class="proc-dl"><div><dt>Approval status</dt><dd>${statusBadge(plan.approval_status)}</dd></div><div><dt>Execution status</dt><dd>${statusBadge(plan.execution_status)}</dd></div><div><dt>Created by</dt><dd>${esc(plan.createdBy || plan.createdByName || plan.createdByUserId || 'Not recorded')}</dd></div><div><dt>Decision by</dt><dd>${esc(plan.decidedBy || plan.approvedBy || plan.rejectedBy || 'Not recorded')}</dd></div><div><dt>Decision reason</dt><dd>${esc(plan.decisionReason || plan.rejectionReason || plan.comments?.[0]?.text || 'Not recorded')}</dd></div><div><dt>Decision time</dt><dd>${fmtDateTime(plan.decidedAt || plan.approvedAt || plan.rejectedAt)}</dd></div></dl><div id="review-audit" class="proc-mini-timeline"><p class="proc-empty-copy">Loading plan audit from backend…</p></div></article>
    </div>`
  const allowed = decisionAllowed(plan)
  document.getElementById('review-approve').disabled = !allowed
  document.getElementById('review-reject').disabled = !allowed
  setStatus('review-api-status', allowed ? 'Backend context shown. The backend validates role, plan status, and separation of duties.' : currentCreatorIsActor(plan) ? 'You cannot approve or reject a plan you created.' : 'This plan is not pending or is not eligible for a decision.', allowed ? 'info' : 'warning')
  void loadReviewBackend(plan, shipment)
}

async function loadReviewBackend(plan, shipment) {
  const requests = [
    ['plan', `/recovery-plans/${encodeURIComponent(plan.id)}`],
    ['audit', `/recovery-plans/${encodeURIComponent(plan.id)}/audit`],
  ]
  if (shipment) {
    requests.push(['impact', `/impact/shipments/${encodeURIComponent(shipment.id)}`])
    requests.push(['risk', `/risk/shipments/${encodeURIComponent(shipment.id)}`])
    requests.push(['ai', `/ai/shipments/${encodeURIComponent(shipment.id)}/risk-explanations`])
  }
  const results = await Promise.all(requests.map(async ([key, path]) => {
    try { return [key, await apiRequest(path), null] } catch (error) { return [key, null, errorText(error)] }
  }))
  const failures = []
  for (const [key, payload, error] of results) {
    if (error) failures.push(`${key}: ${error}`)
    else if (key === 'plan') {
      const rawData = unwrap(payload)
      const data = normalizePlan(rawData)
      apiData[`planDetail:${plan.id}`] = rawData
      const index = plans().findIndex((item) => item.id === plan.id)
      if (data && typeof data === 'object' && data.id) {
        const merged = index >= 0
          ? plans().map((item) => item.id === plan.id ? { ...item, ...data } : item)
          : [...plans(), data]
        apiData.plans = merged
        if (Array.isArray(apiData.approvals)) {
          apiData.approvals = apiData.approvals.map((item) => item.id === plan.id ? { ...item, ...data } : item)
        }
      }
    } else if (key === 'audit') {
      try {
        const entries = extractList(payload)
        apiData[`audit:${plan.id}`] = entries
        document.getElementById('review-audit').innerHTML = entries.map((entry) => `<article class="proc-timeline-item"><i></i><div><b>${esc(entry.action || entry.event || 'Plan event')}</b><p>${esc(entry.reason || entry.comments || '')}</p><small>${fmtDateTime(entry.timestamp || entry.createdAt)} · ${esc(entry.userName || entry.user || '')}</small></div></article>`).join('') || '<p class="proc-empty-copy">No plan audit events were returned.</p>'
      } catch (error) {
        failures.push(`audit: ${errorText(error)}`)
      }
    } else if (key === 'ai') {
      let explanations = []
      try { explanations = extractList(payload) } catch { explanations = [] }
      const top = [...explanations].sort((left, right) => Number(right.riskScore) - Number(left.riskScore))[0]
      apiData[`ai:${shipment.id}`] = top || unwrap(payload)
      const target = document.getElementById('review-ai-explanation')
      if (target) target.textContent = top
        ? `${top.explanation}${top.aiAvailable === false ? ' · backend deterministic fallback' : ''}`
        : 'No AI risk explanation was returned.'
    } else if (key === 'risk') {
      const risk = unwrap(payload)
      apiData[`risk:${shipment.id}`] = risk
      const target = document.getElementById('review-risk-detail')
      if (target) {
        const orders = Array.isArray(risk?.orders) ? risk.orders : []
        const top = [...orders].sort((left, right) => Number(right.riskScore) - Number(left.riskScore))[0]
        target.hidden = false
        target.innerHTML = top
          ? `<b>Backend risk assessment</b><span>${fmtNumber(top.riskScore)} · ${esc(titleCase(top.riskLevel))} · ${esc((top.factors || []).map((factor) => `${factor.name} (+${factor.points})`).join(' · ') || 'No risk factors returned')}</span>`
          : '<b>Backend risk assessment</b><span>No linked-order risk was returned for this shipment.</span>'
      }
    } else if (key === 'impact') {
      const impact = unwrap(payload)
      apiData[`impact:${shipment.id}`] = impact
      const target = document.getElementById('review-impact-detail')
      if (target && impact && typeof impact === 'object') {
        const shortage = Math.max(0, Number(impact.shipmentQuantity || 0) - Number(impact.available || 0))
        target.hidden = false
        target.innerHTML = `<b>Backend impact analysis</b><span>${fmtNumber(impact.shipmentQuantity)} units shipped · ${fmtNumber(impact.available)} available · projected shortage ${fmtNumber(shortage)} · ${fmtNumber((impact.affectedOrders || []).length)} affected orders</span><span>${esc(impact.supplierName || 'Supplier')} → ${esc(impact.warehouseName || 'Warehouse')} → ${esc(impact.productName || 'Product')}</span>`
      }
    }
  }
  if (failures.length) setStatus('review-api-status', `Backend context unavailable: ${failures.join(' · ')} Fallback records remain visible; no decision status was changed.`, 'warning')
  else setStatus('review-api-status', 'Backend returned plan, audit, impact, risk, and explanation data.', 'success')
  if (getCurrentPage() === 'review' && decodeURIComponent(location.hash.split('/').slice(2).join('/')) === plan.id) {
    const cards = []
    if (apiData[`planDetail:${plan.id}`]) cards.push(objectEntriesCard('Backend recovery plan details', apiData[`planDetail:${plan.id}`]))
    if (apiData[`impact:${shipment?.id}`]) cards.push(objectEntriesCard('Backend impact analysis', apiData[`impact:${shipment.id}`]))
    if (apiData[`risk:${shipment?.id}`]) cards.push(objectEntriesCard('Backend risk assessment', apiData[`risk:${shipment.id}`]))
    if (apiData[`ai:${shipment?.id}`]) cards.push(objectEntriesCard('Backend AI risk explanation', apiData[`ai:${shipment.id}`]))
    const audit = apiData[`audit:${plan.id}`] || []
    if (audit.length) cards.push(`<article class="proc-card"><h2>Backend decision and plan audit</h2>${audit.map((entry) => `<p>${esc(entry.action || entry.event || 'Plan event')} · ${fmtDateTime(entry.timestamp || entry.createdAt)} · ${esc(entry.reason || entry.comments || '')}</p>`).join('')}</article>`)
    document.getElementById('review-backend-context').innerHTML = cards.join('')
  }
}

function confirmDecision(planId, type) {
  const plan = findPlan(planId)
  if (!decisionAllowed(plan)) {
    setStatus('review-api-status', currentCreatorIsActor(plan || {}) ? 'You cannot decide on a plan you created.' : 'This plan is not eligible for a decision.', 'error')
    return
  }
  decisionPlanId = planId
  decisionType = type
  const dialog = document.getElementById('decision-dialog')
  document.getElementById('decision-title').textContent = type === 'approve' ? `Approve ${planId}?` : `Reject ${planId}?`
  document.getElementById('decision-context').textContent = `${plan.strategy || 'Strategy not recorded'} · ${fmtCurrency(plan.simulation?.expectedCost ?? plan.cost)} estimated`
  document.getElementById('decision-reason').value = ''
  document.getElementById('decision-reason').required = type === 'reject'
  document.getElementById('decision-reason').placeholder = type === 'reject' ? 'A rejection reason is required' : 'Optional procurement rationale'
  document.getElementById('decision-confirm').textContent = type === 'approve' ? 'Confirm approval' : 'Confirm rejection'
  document.getElementById('decision-confirm').classList.toggle('proc-button-danger', type === 'reject')
  setStatus('decision-message', 'The backend is authoritative. The UI will not change plan status until the backend confirms.', 'info')
  dialog.showModal()
}

async function submitDecision(event) {
  event.preventDefault()
  const reason = document.getElementById('decision-reason').value.trim()
  if (decisionType === 'reject' && !reason) {
    setStatus('decision-message', 'A reason is required when rejecting a recovery plan.', 'error')
    return
  }
  const plan = findPlan(decisionPlanId)
  if (!decisionAllowed(plan)) {
    setStatus('decision-message', 'This recovery plan is no longer eligible. Refresh the queue.', 'error')
    return
  }
  const submit = document.getElementById('decision-confirm')
  submit.disabled = true
  setStatus('decision-message', 'Submitting the decision to the backend…', 'info')
  try {
    const payload = await apiRequest(`/recovery-plans/${encodeURIComponent(decisionPlanId)}/${decisionType}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    const returnedPlan = normalizePlan(unwrap(payload))
    const decidedStatus = decisionType === 'approve' ? 'approved' : 'rejected'
    const confirmedPlan = {
      ...plan,
      ...(returnedPlan?.id ? returnedPlan : {}),
      approval_status: returnedPlan?.approval_status || decidedStatus,
    }
    apiData.plans = [...plans().filter((item) => item.id !== decisionPlanId), confirmedPlan]
    if (Array.isArray(apiData.approvals)) {
      apiData.approvals = apiData.approvals.filter((item) => item.id !== decisionPlanId)
    }
    document.getElementById('decision-dialog').close()
    showToast(`Backend confirmed ${decisionType === 'approve' ? 'approval' : 'rejection'} for ${decisionPlanId}.`)
    apiState.approvals = 'idle'
    apiState.plans = 'idle'
    await Promise.all([
      syncPage('approvals', true),
      syncPage('dashboard', true),
      syncPage('notifications', true),
    ])
    setRoute('approvals')
  } catch (error) {
    setStatus('decision-message', `Decision was not recorded: ${errorText(error)}`, 'error')
  } finally {
    submit.disabled = false
  }
}

async function markNotificationRead(id) {
  try {
    await apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
    apiState.notifications = 'idle'
    await syncPage('notifications', true)
    showToast('Notification marked as read.')
  } catch (error) {
    setStatus('notifications-status', `Could not mark notification as read: ${errorText(error)}`, 'error')
  }
}

function infoCard(title, entries, extra = '') {
  return `<article class="proc-card"><h2>${esc(title)}</h2><dl class="proc-dl">${entries.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value === null || value === undefined || value === '' ? 'Not recorded' : value}</dd></div>`).join('')}</dl>${extra}</article>`
}

function renderDetail(type, id) {
  const content = document.getElementById('detail-content')
  const detailStatus = document.getElementById('detail-api-status')
  if (!content) return
  if (type === 'plan') {
    const plan = findPlan(id) || (apiData[`detail:plan:${id}`] ? normalizePlan(apiData[`detail:plan:${id}`]) : null)
    if (!plan) {
      document.getElementById('detail-title').textContent = `Recovery plan ${id}`
      content.innerHTML = '<article class="proc-card"><p>Plan details are not present in the accessible backend records yet.</p></article>'
      return
    }
    const shipment = planShipment(plan)
    const audit = Array.isArray(apiData[`audit:${id}`]) ? apiData[`audit:${id}`] : []
    const taskHistory = plan.tasks || []
    document.getElementById('detail-title').textContent = `Recovery plan ${id}`
    document.getElementById('detail-subtitle').textContent = `${shipment?.id || plan.shipmentId || 'Shipment not linked'} · ${plan.strategy || 'Strategy not recorded'}`
    content.innerHTML = `<div class="proc-detail-grid">${infoCard('Plan information', [['Plan ID', esc(plan.id)], ['Shipment', esc(shipment?.id || plan.shipmentId || 'Not recorded')], ['Strategy', esc(plan.strategy || 'Not recorded')], ['Created by', esc(plan.createdBy || plan.createdByName || plan.createdByUserId || 'Not recorded')], ['Created at', fmtDateTime(plan.createdAt)]])}${infoCard('Financial and operational estimates', [['Estimated cost', fmtCurrency(plan.simulation?.expectedCost ?? plan.cost)], ['Recovery days', fmtNumber(plan.simulation?.expectedRecoveryDays ?? plan.recoveryDays)], ['Orders saved', fmtNumber(plan.ordersSaved ?? plan.expectedOrdersSaved)], ['Alternative supplier', esc(plan.alternativeSupplier || 'Not recorded')], ['Source warehouse', esc(plan.sourceWarehouse || 'Not recorded')]])}${infoCard('Approval and execution', [['Approval status', statusBadge(plan.approval_status)], ['Execution status', statusBadge(plan.execution_status)], ['Approved or rejected by', esc(plan.decidedBy || plan.approvedBy || plan.rejectedBy || 'Not recorded')], ['Decision reason', esc(plan.decisionReason || plan.rejectionReason || plan.comments?.[0]?.text || 'Not recorded')], ['Decision timestamp', fmtDateTime(plan.decidedAt || plan.approvedAt || plan.rejectedAt)]])}<article class="proc-card"><h2>Recovery progress and audit</h2>${taskHistory.map((task) => `<p>${esc(task.id)} · ${esc(task.title)} · ${statusBadge(task.status)} · ${fmtDateTime(task.updatedAt)}</p>`).join('') || '<p class="proc-empty-copy">No execution tasks are recorded.</p>'}${audit.map((entry) => `<p>${esc(entry.action || 'Plan event')} · ${fmtDateTime(entry.timestamp || entry.createdAt)} · ${esc(entry.reason || entry.comments || '')}</p>`).join('')}</article></div>`
    detailStatus.textContent = 'Showing available workflow data. Plan audit is loaded when opening Review.'
    detailStatus.dataset.kind = 'info'
    return
  }
  if (type === 'shipment' || type === 'risk') {
    const shipment = shipmentById(id)
    if (!shipment) {
      document.getElementById('detail-title').textContent = `Shipment ${id}`
      content.innerHTML = '<article class="proc-card"><p>Shipment details are not available in the shared dataset.</p></article>'
      return
    }
    const product = productForShipment(shipment)
    const disruption = disruptionForShipment(shipment)
    const linked = linkedPlans(shipment.id)
    const shipmentAudit = apiData[`shipmentAudit:${id}`] || []
    const risk = shipmentRisk(shipment)
    const impact = apiData[`impact:${id}`]
    const riskDetails = apiData[`risk:${id}`]
    const ai = apiData[`ai:${id}`]
    document.getElementById('detail-title').textContent = type === 'risk' ? `Risk · ${id}` : `Shipment ${id}`
    document.getElementById('detail-subtitle').textContent = `${shipment.orderId || 'Order not recorded'} · ${shipment.destination || 'Destination not recorded'}`
    content.innerHTML = `<div class="proc-detail-grid">${infoCard('Shipment information', [['Shipment ID', esc(shipment.id)], ['Quantity', fmtNumber(shipment.quantity)], ['Status', statusBadge(shipment.status)], ['Expected delivery', fmtDate(shipment.expectedDate)], ['Supplier', esc(supplierName(shipment))], ['Destination', esc(shipment.destination || 'Not recorded')]])}${infoCard('Risk and disruption', [['Risk score', risk?.score === undefined ? 'Not recorded' : `${fmtNumber(risk.score)}${risk.demo ? ' · alert estimate' : ''}`], ['Risk classification', risk ? statusBadge(risk.level) : 'Not recorded'], ['Disruption', esc(disruption?.title || 'Not recorded')], ['Delay information', esc(shipment.delayReason || 'No delay recorded')], ['Impact', esc(disruption?.impact || disruption?.description || 'Not recorded')]])}${infoCard('Associated inventory and customer orders', [['Product', esc(product?.productName || 'Not recorded')], ['Available inventory', product ? `${fmtNumber(availableQuantity(product))} ${product.unit || ''}` : 'Not recorded'], ['Order reference', esc(shipment.orderId || 'Not recorded')], ['Customer', esc(orderRecords().find((order) => order.orderId === shipment.orderId)?.customer?.name || 'Not recorded')]])}${infoCard('Related recovery plans', [['Plans', linked.map((plan) => `${esc(plan.id)} · ${esc(plan.strategy)} · ${esc(titleCase(plan.approval_status))}`).join('<br>') || 'No related recovery plans']])}${objectEntriesCard('Backend impact analysis', impact)}${objectEntriesCard('Backend risk assessment', riskDetails)}${objectEntriesCard('AI risk explanation', ai)}${shipmentAudit.length ? `<article class="proc-card"><h2>Shipment activity history</h2>${shipmentAudit.map((entry) => `<p>${esc(entry.action || entry.event || 'Shipment event')} · ${fmtDateTime(entry.timestamp || entry.createdAt)} · ${esc(entry.description || entry.comments || '')}</p>`).join('')}</article>` : ''}</div>`
    detailStatus.textContent = 'Shipment record and risk associations are from backend records.'
    detailStatus.dataset.kind = 'info'
    return
  }
  if (type === 'supplier') {
    const detail = apiData[`detail:supplier:${id}`]
    const supplier = detail || supplierRecords().find((item) => (item.id || item.supplierId || item.name || item.supplierName) === id || (item.name || item.supplierName) === id)
    if (!supplier) return
    const name = supplier.name || supplier.supplierName || id
    const prods = supplier.products || operationalData().inventory.filter((item) => item.supplier === name)
    const shipments = supplier.shipments || operationalData().shipments.filter((item) => supplierName(item).includes(name))
    document.getElementById('detail-title').textContent = name
    document.getElementById('detail-subtitle').textContent = supplier.id || supplier.supplierId || 'Supplier ID not recorded'
    content.innerHTML = `<div class="proc-detail-grid">${infoCard('Supplier information', [['Supplier ID', esc(supplier.id || supplier.supplierId || 'Not recorded')], ['Status', supplier.status ? statusBadge(supplier.status) : 'Not recorded'], ['Lead time', supplier.leadTimeDays === undefined ? 'Not recorded' : `${fmtNumber(supplier.leadTimeDays)} days`], ['Performance score', 'Not provided']])}${infoCard('Related products', [['Products', prods.map((item) => esc(item.productName)).join(', ') || 'Not recorded']])}${infoCard('Related shipments and recovery plans', [['Shipments', shipments.map((item) => esc(item.id)).join(', ') || 'Not recorded'], ['Recovery plans', plans().filter((plan) => (plan.alternativeSupplier || '').includes(name)).map((plan) => esc(plan.id)).join(', ') || 'Not recorded']])}</div>`
    return
  }
  if (type === 'warehouse') {
    const warehouse = apiData[`detail:warehouse:${id}`] || warehouseRecords().find((item) => (item.id || item.warehouseId) === id)
    const stock = operationalData().inventory.filter((item) => (item.warehouse || item.warehouseId) === id)
    document.getElementById('detail-title').textContent = warehouse?.name || warehouse?.warehouseName || (id === warehouseSummary.warehouseId ? warehouseSummary.warehouseName : `Warehouse ${id}`)
    document.getElementById('detail-subtitle').textContent = id
    content.innerHTML = `<div class="proc-detail-grid">${infoCard('Warehouse', [['ID', esc(id)], ['Location', esc(warehouse?.location || 'Not recorded')], ['Capacity', esc(warehouse?.capacity || (id === warehouseSummary.warehouseId ? `${warehouseSummary.occupiedLocations} / ${warehouseSummary.totalLocations} locations` : 'Not recorded'))], ['Inventory records', fmtNumber(stock.length)]])}${infoCard('Products and stock', [['Products', stock.map((item) => `${esc(item.productName)} · ${fmtNumber(availableQuantity(item))} ${esc(item.unit)} available`).join('<br>') || 'No inventory records']])}</div>`
    return
  }
  if (type === 'inventory') {
    const item = apiData[`detail:inventory:${id}`] || operationalData().inventory.find((record) => record.id === id || record.inventoryId === id)
    if (!item) {
      document.getElementById('detail-title').textContent = `Inventory ${id}`
      content.innerHTML = '<article class="proc-card"><p>Inventory record is not available in the backend records.</p></article>'
      return
    }
    const normalized = normalizeInventory(item)
    document.getElementById('detail-title').textContent = normalized.productName || `Inventory ${id}`
    document.getElementById('detail-subtitle').textContent = `${id} · ${normalized.productId || 'Product not recorded'}`
    content.innerHTML = `<div class="proc-detail-grid">${infoCard('Inventory information', [['Product', esc(normalized.productName || 'Not recorded')], ['Warehouse', esc(normalized.warehouse || 'Not recorded')], ['Storage location', esc(normalized.location || 'Not recorded')], ['On hand', `${fmtNumber(normalized.quantity)} ${esc(normalized.unit || '')}`], ['Reserved', `${fmtNumber(normalized.reserved)} ${esc(normalized.unit || '')}`], ['Available', `${fmtNumber(availableQuantity(normalized))} ${esc(normalized.unit || '')}`], ['Reorder point', `${fmtNumber(normalized.reorderThreshold)} ${esc(normalized.unit || '')}`], ['Daily demand', fmtNumber(normalized.dailyDemand)], ['Stock classification', `${titleCase(stockLevel(normalized))} · from stock levels`]])}${infoCard('Procurement context', [['Supplier', esc(normalized.supplier || 'Not recorded')], ['Related shipments', relatedShipments(normalized.productId).map((shipment) => esc(shipment.id)).join(', ') || 'Not recorded'], ['Related orders', fmtNumber(relatedOrders(normalized.productId).length)]])}</div>`
    return
  }
  if (type === 'product') {
    const product = apiData[`detail:product:${id}`] || apiData[`detail:inventory:${id}`] || productRecords().find((item) => (item.productId || item.id) === id)
    if (!product) return
    const stock = operationalData().inventory.filter((item) => item.productId === id)
    document.getElementById('detail-title').textContent = product.productName || product.name || id
    document.getElementById('detail-subtitle').textContent = id
    content.innerHTML = `<div class="proc-detail-grid">${infoCard('Product information', [['Category', esc(product.category || 'Not recorded')], ['Unit cost', fmtCurrency(product.unitCost ?? product.costPerUnit)], ['Supplier', esc(product.supplier || stock[0]?.supplier || 'Not recorded')]])}${infoCard('Inventory by warehouse', [['Stock', stock.map((item) => `${esc(item.warehouse)} · ${fmtNumber(availableQuantity(item))} ${esc(item.unit)} available`).join('<br>') || 'Not recorded']])}${infoCard('Related demand', [['Orders', fmtNumber(relatedOrders(id).length)], ['Shipments', relatedShipments(id).map((item) => esc(item.id)).join(', ') || 'Not recorded']])}</div>`
    return
  }
  if (type === 'order') {
    const order = apiData[`detail:order:${id}`] || orderRecords().find((item) => (item.orderId || item.id) === id)
    if (!order) return
    const shipment = order.shipment || operationalData().shipments.find((item) => item.orderId === id)
    const product = order.product || productForShipment(shipment)
    document.getElementById('detail-title').textContent = `Order ${id}`
    document.getElementById('detail-subtitle').textContent = 'Order impact detail'
    content.innerHTML = `<div class="proc-detail-grid">${infoCard('Order information', [['Customer', esc(order.customer?.name || order.customerName || 'Not recorded')], ['Product', esc(product?.productName || order.productName || 'Not recorded')], ['Quantity', fmtNumber(order.quantity)], ['Priority', statusBadge(order.priority)], ['Promised delivery', fmtDate(order.promisedDeliveryDate || order.expectedDate)], ['Status', statusBadge(order.status)]])}${infoCard('Supply-chain impact', [['Shipment', esc(shipment?.id || 'Not linked')], ['Destination', esc(shipment?.destination || 'Not recorded')], ['Disruption', esc(shipment ? disruptionForShipment(shipment)?.title || 'Not recorded' : 'Not recorded')], ['Inventory availability', product ? `${fmtNumber(availableQuantity(product))} ${product.unit} at ${esc(product.warehouse)}` : 'Not recorded']])}</div>`
    return
  }
  if (type === 'customer') {
    const customer = apiData[`detail:customer:${id}`] || customerRecords().find((item) => (item.customerId || item.id) === id)
    if (!customer) return
    const related = orderRecords().filter((order) => (customer.orderIds || []).includes(order.orderId || order.id) || order.customerId === id)
    document.getElementById('detail-title').textContent = customer.name || customer.customerName || id
    document.getElementById('detail-subtitle').textContent = id
    content.innerHTML = `<div class="proc-detail-grid">${infoCard('Customer information', [['Name', esc(customer.name || customer.customerName || 'Not recorded')], ['Email', esc(customer.email || 'Not recorded')]])}${infoCard('Associated orders', [['Orders', related.map((order) => `${esc(order.orderId || order.id)} · ${esc(titleCase(order.priority || 'Priority not recorded'))} · ${fmtDate(order.promisedDeliveryDate || order.expectedDate)} · ${esc(titleCase(order.status))}`).join('<br>') || 'No related order details are available']])}</div>`
  }
}

function bindFilters() {
  const filters = [
    ['shipment-search', renderShipmentRows], ['shipment-filter', renderShipmentRows],
    ['supplier-search', renderSupplierRows], ['warehouse-search', renderWarehouseRows],
    ['inventory-search', renderInventoryRows], ['inventory-filter', renderInventoryRows],
    ['order-search', renderOrderRows], ['order-filter', renderOrderRows],
    ['product-search', renderProductRows], ['customer-search', renderCustomerRows],
    ['risk-filter', () => renderRiskRows('risk-table')], ['risk-status-filter', () => renderRiskRows('risk-table')],
    ['risk-supplier-filter', () => renderRiskRows('risk-table')], ['risk-warehouse-filter', () => renderRiskRows('risk-table')],
    ['plan-search', renderPlanRows], ['plan-filter', renderPlanRows],
    ['approval-search', () => { document.getElementById('approvals-table').innerHTML = approvalRows() }],
    ['approval-strategy', () => { document.getElementById('approvals-table').innerHTML = approvalRows() }],
    ['approval-sort', () => { document.getElementById('approvals-table').innerHTML = approvalRows() }],
    ['approval-risk', () => { document.getElementById('approvals-table').innerHTML = approvalRows() }],
  ]
  filters.forEach(([id, render]) => {
    const element = document.getElementById(id)
    element.addEventListener(element.tagName === 'SELECT' ? 'change' : 'input', render)
  })
}

if (actor.role !== 'Procurement Approver') {
  document.querySelector('.proc-main').innerHTML = '<section class="proc-card proc-access"><h1>Access unavailable</h1><p>This workspace is restricted to the Procurement Approver role for this workspace.</p><a class="proc-button" href="/src/role-selection.html">Return to role selection</a><p class="proc-muted">This front-end role check is not a security boundary. Production access must be enforced by the backend.</p></section>'
} else {
  document.getElementById('current-date').textContent = fmtDate(new Date(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  bindFilters()
  renderDashboard()
  renderRoute()
  document.querySelector('.proc-nav').addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]')
    if (!link) return
    event.preventDefault()
    setRoute(link.hash.slice(1))
  })
  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-navigate]')
    if (nav) {
      setRoute(nav.dataset.navigate)
      return
    }
    const review = event.target.closest('[data-review-plan]')
    if (review) {
      setRoute('review', 'plan', review.dataset.reviewPlan)
      return
    }
    const detail = event.target.closest('[data-detail-type]')
    if (detail) {
      setRoute('detail', detail.dataset.detailType, detail.dataset.detailId)
      return
    }
    const markRead = event.target.closest('[data-mark-read]')
    if (markRead) void markNotificationRead(markRead.dataset.markRead)
  })
  document.getElementById('review-approve').addEventListener('click', () => confirmDecision(decodeURIComponent(location.hash.split('/')[2] || ''), 'approve'))
  document.getElementById('review-reject').addEventListener('click', () => confirmDecision(decodeURIComponent(location.hash.split('/')[2] || ''), 'reject'))
  document.getElementById('decision-form').addEventListener('submit', (event) => void submitDecision(event))
  document.querySelector('.proc-dialog-close').addEventListener('click', () => document.getElementById('decision-dialog').close())
  document.getElementById('decision-cancel').addEventListener('click', () => document.getElementById('decision-dialog').close())
  document.getElementById('decision-dialog').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close()
  })
  document.getElementById('detail-back').addEventListener('click', () => setRoute(previousPage))
  document.getElementById('global-search').addEventListener('input', (event) => {
    const visible = document.querySelector('.proc-page:not([hidden])')
    if (!visible) return
    const query = event.target.value.trim().toLowerCase()
    visible.querySelectorAll('tbody tr').forEach((row) => { row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query) })
  })
  window.addEventListener('hashchange', renderRoute)
  window.addEventListener('storage', (event) => {
    if (!event.key || [ANALYST_STATE_KEY, 'disruptioniq.shared.recovery-workflow.v1'].includes(event.key)) {
      renderPage(getCurrentPage())
    }
  })
  window.addEventListener('disruptioniq:recovery-workflow-updated', () => renderPage(getCurrentPage()))
}
