import { requireRole, roleOf } from './api/client.js';
await requireRole('ADMIN');
import './workspaces/administrator.css'
import './workspaces/dashboard-consistency.css'

import {
  getDisruptions,
  getNotifications,
  getWorkflowState,
} from './workspaces/recovery-workflow.js'
import {
  backendDataState,
  inventoryItems,
  shipments as demoShipments,
  warehouseSummary,
} from './workspaces/operations-analyst-data.js'
import {
  aiHealth,
  asList,
  customers as customersApi,
  importSupplyChainFile,
  orders as ordersApi,
  products as productsApi,
  riskAssessment,
  riskExplanations,
  suppliers as suppliersApi,
  warehouses as warehousesApi,
} from './api/disruptioniq.js'

const pageNames = {
  dashboard: 'Dashboard',
  operations: 'All Operational Pages',
  shipments: 'Shipments',
  suppliers: 'Suppliers',
  warehouses: 'Warehouses',
  inventory: 'Inventory',
  orders: 'Orders',
  products: 'Products',
  customers: 'Customers',
  disruptions: 'Disruption Management',
  impact: 'Order Impact Analysis',
  risk: 'Shipment Risk Assessment',
  'ai-insights': 'AI Risk Insights',
  'recovery-planning': 'Recovery Planning',
  plans: 'Recovery Plans',
  approvals: 'Pending Approvals',
  tracking: 'Recovery Tracking',
  'data-import': 'Data Import',
  notifications: 'Notifications',
  audit: 'Audit Logs',
}
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

const adminMaster = {
  suppliers: [],
  warehouses: [],
  products: [],
  orders: [],
  customers: [],
  loaded: false,
  error: null,
}
const adminRiskState = { byShipment: new Map(), loaded: false }
const adminAiState = { health: null, loaded: false, explanations: new Map(), pending: new Set() }

function currentPage() {
  const page = location.hash.slice(1) || 'dashboard'
  return pageNames[page] ? page : 'dashboard'
}

async function hydrateMaster() {
  const results = await Promise.allSettled([
    suppliersApi(),
    warehousesApi(),
    productsApi(),
    ordersApi(),
    customersApi(),
  ])
  const [suppliers, warehouses, products, orders, customers] = results.map((result) =>
    result.status === 'fulfilled' ? asList(result.value) : [])
  const failed = results.find((result) => result.status === 'rejected')
  Object.assign(adminMaster, {
    suppliers,
    warehouses,
    products,
    orders,
    customers,
    loaded: true,
    error: failed ? failed.reason?.message || 'Backend master data is unavailable.' : null,
  })
  renderPage(currentPage())
}

async function hydrateRisk() {
  if (adminRiskState.loaded) return
  adminRiskState.loaded = true
  const ids = [...new Set(demoShipments.map((shipment) => shipment.id))]
  const results = await Promise.allSettled(ids.map((id) => riskAssessment(id)))
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) adminRiskState.byShipment.set(ids[index], result.value)
  })
  if (['dashboard', 'risk'].includes(currentPage())) renderPage(currentPage())
}

function hydrateAiInsights() {
  if (!adminAiState.loaded) {
    adminAiState.loaded = true
    aiHealth()
      .then((health) => { adminAiState.health = health })
      .catch((error) => { adminAiState.health = { available: false, message: error.message } })
      .finally(() => { if (currentPage() === 'ai-insights') renderPage('ai-insights') })
  }
  const shipmentIds = [...new Set(data().disruptions.flatMap((item) => item.shipments || []))].slice(0, 6)
  for (const shipmentId of shipmentIds) {
    if (adminAiState.explanations.has(shipmentId) || adminAiState.pending.has(shipmentId)) continue
    adminAiState.pending.add(shipmentId)
    riskExplanations(shipmentId)
      .then((payload) => adminAiState.explanations.set(shipmentId, asList(payload)))
      .catch(() => adminAiState.explanations.set(shipmentId, []))
      .finally(() => {
        adminAiState.pending.delete(shipmentId)
        if (currentPage() === 'ai-insights') renderPage('ai-insights')
      })
  }
}

function data() {
  return {
    shipments: demoShipments,
    inventory: inventoryItems,
    orders: adminMaster.orders,
    products: adminMaster.products,
    customers: adminMaster.customers,
    warehouses: adminMaster.warehouses,
    suppliers: adminMaster.suppliers,
    disruptions: getDisruptions(),
    workflow: getWorkflowState(),
  }
}

function number(value) {
  if (value === null || value === undefined || value === '') return 'Not recorded'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? new Intl.NumberFormat().format(parsed) : 'Not recorded'
}

function date(value) {
  if (!value) return 'Not recorded'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function timestamp(value) {
  if (!value) return 'Not recorded'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(parsed)
}

function titleCase(value) {
  return String(value || 'Not recorded').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function badge(value) {
  const text = value || 'Not recorded'
  const status = String(text).toLowerCase().replaceAll(' ', '_')
  return `<span class="admin-status" data-status="${escapeHTML(status)}">${escapeHTML(titleCase(text))}</span>`
}

function shipments() {
  return data().shipments
}

function inventory() {
  return data().inventory
}

function available(item) {
  return Number(item?.quantity ?? item?.onHandQuantity ?? 0) - Number(item?.reserved ?? item?.reservedQuantity ?? 0)
}

function shipmentSupplier(shipment) {
  if (shipment?.supplierName || shipment?.supplier) return shipment.supplierName || shipment.supplier
  const productIds = shipment?.productIds || (shipment?.productId ? [shipment.productId] : [])
  const names = productIds.map((id) => inventory().find((item) => item.productId === id)?.supplier).filter(Boolean)
  return [...new Set(names)].join(', ') || shipment?.origin || 'Not recorded'
}

function getSuppliers() {
  const d = data()
  if (d.suppliers.length) return d.suppliers
  return [...new Set(d.inventory.map((item) => item.supplier).filter(Boolean))].map((name) => ({
    id: '', name, products: d.inventory.filter((item) => item.supplier === name),
    shipments: d.shipments.filter((shipment) => shipmentSupplier(shipment) === name),
    status: 'Not recorded', leadTime: null,
  }))
}

function getWarehouses() {
  const d = data()
  if (d.warehouses.length) return d.warehouses
  const names = [...new Set(d.inventory.map((item) => item.warehouse).filter(Boolean))]
  return names.map((id) => ({
    id, name: id === warehouseSummary.warehouseId ? warehouseSummary.warehouseName : id,
    inventory: d.inventory.filter((item) => item.warehouse === id),
    shipments: d.shipments.filter((item) => item.origin === id || item.destination === id || item.destinationWarehouse === id),
  }))
}

function getProducts() {
  const d = data()
  if (d.products.length) return d.products
  const seen = new Map()
  d.inventory.forEach((item) => {
    if (!seen.has(item.productId)) seen.set(item.productId, {
      id: item.productId, name: item.productName, category: item.category,
      supplier: item.supplier, inventory: d.inventory.filter((entry) => entry.productId === item.productId),
    })
  })
  return [...seen.values()]
}

function getOrders() {
  const d = data()
  return d.orders
}

function recoveryPlans() {
  return data().workflow.plans || []
}

function affectedOrders() {
  return [...new Set(data().disruptions.flatMap((item) => item.orders || []))]
}

function highRiskShipmentIds() {
  if (adminRiskState.byShipment.size) {
    return [...adminRiskState.byShipment.entries()]
      .filter(([, assessment]) => (assessment.orders || []).some((order) => Number(order.riskScore) >= 50))
      .map(([shipmentId]) => shipmentId)
  }
  const ids = data().disruptions.filter((item) => Number(item.riskScore) >= 50).flatMap((item) => item.shipments || [])
  return [...new Set(ids)]
}

function activeDisruptions() {
  return data().disruptions.filter((item) => !['resolved', 'closed'].includes(String(item.status).toLowerCase()))
}

function plansByStatus(status) {
  return recoveryPlans().filter((plan) => plan.approval_status === status)
}

function activeExecutions() {
  return recoveryPlans().filter((plan) => plan.execution_authorisation_status === 'authorized' && ['in_progress', 'blocked', 'pending'].includes(plan.execution_status))
}

function inventoryAlerts() {
  return inventory().filter((item) => available(item) <= Number(item.reorderThreshold ?? item.reorderPoint ?? 0))
}

function pageHeading(page, summary, eyebrow = 'PLATFORM OVERVIEW') {
  const title = pageNames[page] || 'Administrator'
  const note = page === 'dashboard' ? 'Monitor operational health, disruption exposure, and shared recovery workflows.' : summary
  return `<header class="admin-page-heading"><div><p class="admin-eyebrow">${escapeHTML(eyebrow)}</p><h1>${escapeHTML(title)}</h1><p>${escapeHTML(note)}</p></div><span class="admin-heading-tag">Backend records</span></header>`
}

function kpi(label, value, icon, note, link) {
  const body = `<span class="admin-kpi-icon" aria-hidden="true">${icon}</span><span><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong><em>${escapeHTML(note)}</em></span>`
  return link ? `<a class="admin-kpi" href="#${link}">${body}</a>` : `<div class="admin-kpi">${body}</div>`
}

function chart(title, subtitle, entries) {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0)
  if (!entries.length || total === 0) return `<article class="admin-card"><div class="admin-card-heading"><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(subtitle)}</p></div></div><div class="admin-empty">No supported records are available for this chart.</div></article>`
  const max = Math.max(...entries.map((entry) => entry.value), 1)
  const rows = entries.map((entry) => `<div class="admin-chart-row"><span>${escapeHTML(entry.label)}</span><div class="admin-chart-track" role="img" aria-label="${escapeHTML(entry.label)} ${entry.value}"><div class="admin-chart-bar" style="width:${Math.max(4, entry.value / max * 100)}%"></div></div><strong>${entry.value}</strong></div>`).join('')
  return `<article class="admin-card"><div class="admin-card-heading"><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(subtitle)} · ${total} records</p></div></div><div class="admin-chart-list">${rows}</div></article>`
}

function table(headers, rows, emptyMessage = 'No records are available.') {
  const head = headers.map((header, index) => `<th><button type="button" class="admin-sort-button" data-sort-column="${index}" aria-label="Sort by ${escapeHTML(header)}">${escapeHTML(header)} <span aria-hidden="true">↕</span></button></th>`).join('')
  const body = rows.length ? rows.join('') : `<tr><td class="admin-table-empty" colspan="${headers.length}">${escapeHTML(emptyMessage)}</td></tr>`
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
}

function rowLink(id, type, label = id) {
  return `<button type="button" class="admin-record-link" data-record-type="${escapeHTML(type)}" data-record-id="${escapeHTML(id)}">${escapeHTML(label || 'Not recorded')}</button>`
}

function renderDashboard() {
  const d = data()
  const plans = d.workflow.plans || []
  const shipmentsList = d.shipments
  const active = activeDisruptions()
  const high = highRiskShipmentIds()
  const pending = plans.filter((plan) => plan.approval_status === 'pending')
  const activeRecovery = activeExecutions()
  const completed = plans.filter((plan) => plan.execution_status === 'successful')
  const inventoryIssues = inventoryAlerts()
  const kpis = [
    kpi('Total shipments', number(shipmentsList.length), '⇢', 'Backend shipment records', 'shipments'),
    kpi('Active disruptions', number(active.length), '!', 'Open or investigating alerts', 'disruptions'),
    kpi('High-risk shipments', number(high.length), '⌁', 'Backend risk assessment', 'risk'),
    kpi('Orders at risk', number(affectedOrders().length), '≡', 'Linked shipment references', 'impact'),
    kpi('Pending approvals', number(pending.length), '✓', 'Backend recovery workflow', 'approvals'),
    kpi('Active recovery plans', number(activeRecovery.length), '◷', 'Authorized backend execution', 'tracking'),
    kpi('Completed recoveries', number(completed.length), '↗', 'Backend execution records', 'plans'),
    kpi('Inventory alerts', number(inventoryIssues.length), '▧', 'Available stock ≤ reorder point', 'inventory'),
  ].join('')

  const shipmentStates = [...new Set(shipmentsList.map((item) => item.status || item.shipmentStatus || 'unknown'))]
    .map((status) => ({ label: titleCase(status), value: shipmentsList.filter((item) => (item.status || item.shipmentStatus || 'unknown') === status).length }))
  const riskGroups = ['Critical', 'High', 'Medium', 'Low'].map((level) => {
    const minScore = level === 'Critical' ? 75 : level === 'High' ? 50 : level === 'Medium' ? 25 : 0
    const maxScore = level === 'Critical' ? 101 : level === 'High' ? 75 : level === 'Medium' ? 50 : 25
    return { label: level, value: d.disruptions.filter((item) => Number(item.riskScore) >= minScore && Number(item.riskScore) < maxScore).length }
  })
  const recoveryGroups = ['pending', 'approved', 'rejected', 'modification_requested'].map((status) => ({
    label: titleCase(status), value: plans.filter((plan) => plan.approval_status === status).length,
  }))
  const inventoryGroups = [
    { label: 'Needs attention', value: inventoryIssues.length },
    { label: 'Above reorder point', value: Math.max(0, d.inventory.length - inventoryIssues.length) },
  ]
  const orderStatuses = [...new Set(d.orders.map((order) => order.status || 'unknown'))]
  const orderGroups = orderStatuses.map((status) => ({
    label: titleCase(status),
    value: d.orders.filter((order) => (order.status || 'unknown') === status).length,
  }))
  const alerts = [
    ...active.filter((item) => ['critical', 'high'].includes(String(item.severity).toLowerCase())).map((item) => ({
      severity: item.severity, title: item.title, description: `${item.id} · ${item.affectedOrders || 0} linked orders`, href: '#disruptions',
    })),
    ...pending.slice(0, 3).map((plan) => ({ severity: 'medium', title: `Approval pending · ${plan.id}`, description: `${plan.strategy} · submitted ${date(plan.createdAt)}`, href: '#approvals' })),
    ...plans.filter((plan) => plan.execution_status === 'blocked').map((plan) => ({ severity: 'high', title: `Recovery blocked · ${plan.id}`, description: plan.strategy, href: '#tracking' })),
    ...inventoryIssues.slice(0, 3).map((item) => ({ severity: 'medium', title: `Inventory below reorder point · ${item.productName}`, description: `${item.productId} · ${number(available(item))} available`, href: '#inventory' })),
  ].slice(0, 7)
  const pendingRows = pending.slice(0, 5).map((plan) => {
    const disruption = d.disruptions.find((item) => item.id === plan.disruptionId)
    const shipmentId = plan.shipmentId || disruption?.shipments?.[0] || 'Not recorded'
    return `<tr><td>${rowLink(plan.id, 'plan')}</td><td>${escapeHTML(shipmentId)}</td><td>${escapeHTML(plan.strategy || 'Not recorded')}</td><td>${plan.cost == null ? 'Not recorded' : `₹${number(plan.cost)}`}</td><td>${number(plan.recoveryDays)}</td><td>${number((disruption?.orders || []).length)}</td><td>${escapeHTML(plan.createdBy || 'Not recorded')}</td><td>${rowLink(plan.id, 'plan', 'Review details')}</td></tr>`
  })
  const audit = [...(d.workflow.audit || [])].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 5)
  const activities = audit.length ? audit.map((event) => `<div class="admin-alert"><span class="admin-alert-dot"></span><span><strong>${escapeHTML(event.action || 'Activity recorded')}</strong><small>${escapeHTML(event.user || 'User unavailable')} · ${escapeHTML(event.planId || 'Recovery plan')} · ${escapeHTML(timestamp(event.timestamp))}</small></span></div>`).join('') : '<div class="admin-empty">No backend audit events are recorded.</div>'
  return `${pageHeading('dashboard', '')}<section class="admin-kpis">${kpis}</section>
    <section class="admin-grid">
      ${chart('Shipment status', 'Backend shipment records', shipmentStates)}
      ${chart('Disruption risk classification', 'Highest backend risk per linked shipment', riskGroups)}
      ${chart('Recovery plan approval status', 'Backend recovery workflow records', recoveryGroups)}
      ${chart('Inventory availability', 'Calculated from backend on-hand minus reserved stock', inventoryGroups)}
      ${chart('Order status', 'Backend order master records', orderGroups)}
      <article class="admin-card"><div class="admin-card-heading"><div><h2>Recovery overview</h2><p>Live statuses from the backend recovery workflow.</p></div><a href="#plans">All plans →</a></div><div class="admin-stat-grid">${[
        ['Total plans', plans.length], ['Pending', plans.filter((plan) => plan.approval_status === 'pending').length],
        ['Approved', plans.filter((plan) => plan.approval_status === 'approved').length], ['Rejected', plans.filter((plan) => plan.approval_status === 'rejected').length],
        ['Active execution', activeRecovery.length], ['Completed', completed.length],
        ['Blocked', plans.filter((plan) => plan.execution_status === 'blocked').length],
      ].map(([label, value]) => `<div><small>${escapeHTML(label)}</small><strong>${number(value)}</strong></div>`).join('')}</div></article>
      <article class="admin-card"><div class="admin-card-heading"><div><h2>Critical alerts</h2><p>Disruptions, recovery blockers and inventory items requiring attention.</p></div><a href="#disruptions">View disruptions →</a></div><div class="admin-alert-list">${alerts.length ? alerts.map((alert) => `<a class="admin-alert" data-severity="${escapeHTML(String(alert.severity).toLowerCase())}" href="${alert.href}"><span class="admin-alert-dot"></span><span><strong>${escapeHTML(alert.title)}</strong><small>${escapeHTML(alert.description)}</small></span></a>`).join('') : '<div class="admin-empty">No attention items in the current backend records.</div>'}</div></article>
      <article class="admin-card"><div class="admin-card-heading"><div><h2>Recent system activity</h2><p>Recovery audit events retrieved from the backend audit service.</p></div><a href="#audit">Open audit logs →</a></div><div class="admin-alert-list">${activities}</div></article>
      <article class="admin-card admin-span-2"><div class="admin-card-heading"><div><h2>Pending approval overview</h2><p>Plans awaiting a backend decision.</p></div><a href="#approvals">Review queue →</a></div>${table(['Plan ID','Shipment','Strategy','Estimated cost','Days','Orders saved*','Created by','Action'], pendingRows, 'No recovery plans are awaiting approval.') }<p class="admin-inline-note">*Linked order references are derived from the shipment impact chain. Approval and execution controls are enforced by backend authorization.</p></article>
    </section>`
}

function inventoryRows() {
  return inventory().map((item) => {
    const availableQty = available(item)
    const threshold = Number(item.reorderThreshold ?? item.reorderPoint ?? 0)
    const status = availableQty <= 0 ? 'out-of-stock' : availableQty <= threshold ? 'low-stock' : 'healthy'
    return `<tr><td>${rowLink(item.id || item.productId, 'inventory', item.id || item.productId)}</td><td>${escapeHTML(item.productName || item.productId || 'Not recorded')}</td><td>${escapeHTML(item.warehouse || 'Not recorded')}</td><td>${number(item.quantity ?? item.onHandQuantity)}</td><td>${number(item.reserved ?? item.reservedQuantity ?? 0)}</td><td>${number(availableQty)}</td><td>${number(threshold)}</td><td>${badge(status)}</td></tr>`
  })
}

function shipmentRows(list = shipments()) {
  return list.map((item) => `<tr><td>${rowLink(item.id || item.shipmentId, 'shipment', item.id || item.shipmentId)}</td><td>${number(item.quantity)}</td><td>${badge(item.status || item.shipmentStatus)}</td><td>${escapeHTML(date(item.expectedDate || item.expectedDeliveryDate))}</td><td>${escapeHTML(shipmentSupplier(item))}</td><td>${escapeHTML(item.destinationWarehouse || item.destination || 'Not recorded')}</td><td>${rowLink(item.id || item.shipmentId, 'shipment', 'Details')}</td></tr>`)
}

function renderEntityPage(page) {
  const d = data()
  let rows = []
  let headers = []
  let emptyMessage = 'No backend records are available.'
  let message = adminMaster.error
    ? `Backend master data could not be loaded: ${adminMaster.error}`
    : 'Records are loaded from the backend master-data API.'
  switch (page) {
    case 'shipments':
      headers = ['Shipment ID', 'Quantity', 'Status', 'Expected delivery', 'Supplier / origin', 'Destination warehouse', 'Details']
      rows = shipmentRows()
      break
    case 'suppliers':
      headers = ['Supplier', 'Status', 'Lead time', 'Related products', 'Associated shipments', 'Details']
      rows = getSuppliers().map((supplier) => `<tr><td>${rowLink(supplier.id || supplier.name, 'supplier', supplier.name || 'Supplier')}<small>${escapeHTML(supplier.id || 'ID not supplied')}</small></td><td>${badge(supplier.status || 'Not recorded')}</td><td>${supplier.leadTime == null ? 'Not recorded' : `${number(supplier.leadTime)} days`}</td><td>${number(supplier.products?.length || 0)}</td><td>${number(supplier.shipments?.length || 0)}</td><td>${rowLink(supplier.id || supplier.name, 'supplier', 'Details')}</td></tr>`)
      message = d.suppliers.length ? 'Supplier master records are loaded from the backend supplier API.' : 'No backend supplier records are available; names fall back to linked inventory and shipment fields.'
      break
    case 'warehouses':
      headers = ['Warehouse ID', 'Warehouse', 'Location', 'Storage capacity', 'Inventory records', 'Available quantity', 'Details']
      rows = getWarehouses().map((warehouse) => {
        const products = warehouse.inventory || []
        const availableQty = products.reduce((sum, item) => sum + available(item), 0)
        return `<tr><td>${rowLink(warehouse.id || warehouse.warehouseId, 'warehouse', warehouse.id || warehouse.warehouseId)}</td><td>${escapeHTML(warehouse.name || warehouse.warehouseName || warehouse.id || 'Not recorded')}</td><td>${escapeHTML(warehouse.location || 'Not recorded')}</td><td>${warehouse.capacity == null && warehouse.id !== warehouseSummary.warehouseId ? 'Not recorded' : number(warehouse.capacity ?? warehouseSummary.totalLocations)}</td><td>${number(products.length)}</td><td>${number(availableQty)}</td><td>${rowLink(warehouse.id || warehouse.warehouseId, 'warehouse', 'Details')}</td></tr>`
      })
      message = d.warehouses.length ? 'Warehouse records are loaded from the backend warehouse API.' : 'No backend warehouse records are available; totals are derived from inventory records.'
      break
    case 'inventory':
      headers = ['Inventory ID', 'Product', 'Warehouse', 'On hand', 'Reserved', 'Available', 'Reorder point', 'Status']
      rows = inventoryRows()
      message = 'Available quantity is calculated as backend on-hand minus reserved. Inventory status compares available quantity with the supplied reorder point.'
      break
    case 'orders':
      headers = ['Order ID', 'Customer', 'Product', 'Priority', 'Quantity', 'Promised delivery', 'Status']
      rows = d.orders.map((order) => `<tr><td>${rowLink(order.id || order.orderId, 'order', order.id || order.orderId)}</td><td>${escapeHTML(order.customerName || order.customer?.name || order.customerId || 'Not recorded')}</td><td>${escapeHTML(order.productName || order.productId || 'Not recorded')}</td><td>${badge(order.priority)}</td><td>${number(order.quantity)}</td><td>${escapeHTML(date(order.promisedDelivery || order.deliveryDate))}</td><td>${badge(order.status)}</td></tr>`)
      emptyMessage = 'No backend order records are available.'
      message = 'Order records are loaded from the backend order API and used by shipment risk and impact analysis.'
      break
    case 'products':
      headers = ['Product ID', 'Product', 'Category', 'Unit cost', 'Inventory records', 'Available quantity', 'Supplier']
      rows = getProducts().map((product) => `<tr><td>${rowLink(product.id || product.productId, 'product', product.id || product.productId)}</td><td>${escapeHTML(product.name || product.productName || 'Not recorded')}</td><td>${escapeHTML(product.category || 'Not recorded')}</td><td>${product.unitCost == null ? 'Not recorded' : `₹${number(product.unitCost)}`}</td><td>${number(product.inventory?.length || 0)}</td><td>${number((product.inventory || []).reduce((sum, item) => sum + available(item), 0))}</td><td>${escapeHTML(product.supplier || 'Not recorded')}</td></tr>`)
      message = d.products.length ? 'Product records are loaded from the backend product API.' : 'No backend product records are available; names fall back to linked inventory fields.'
      break
    case 'customers':
      headers = ['Customer ID', 'Customer', 'Email', 'Related orders']
      rows = d.customers.map((customer) => `<tr><td>${rowLink(customer.id || customer.customerId, 'customer', customer.id || customer.customerId)}</td><td>${escapeHTML(customer.name || customer.customerName || 'Not recorded')}</td><td>${escapeHTML(customer.email || 'Not recorded')}</td><td>${number(customer.orderIds?.length || 0)}</td></tr>`)
      emptyMessage = 'No backend customer records are available.'
      message = 'Customer records are loaded from the backend customer API.'
      break
    case 'disruptions':
      headers = ['Disruption', 'Category', 'Severity', 'Risk score', 'Affected orders', 'Shipments', 'Status', 'Details']
      rows = d.disruptions.map((item) => `<tr><td>${rowLink(item.id, 'disruption', item.title || item.id)}</td><td>${escapeHTML(item.category || 'Not recorded')}</td><td>${badge(item.severity)}</td><td>${number(item.riskScore)}<small>Backend estimate</small></td><td>${number(item.affectedOrders || item.orders?.length || 0)}</td><td>${(item.shipments || []).map((id) => escapeHTML(id)).join(', ') || 'Not recorded'}</td><td>${badge(item.status)}</td><td>${rowLink(item.id, 'disruption', 'Details')}</td></tr>`)
      message = 'Disruption rows are derived from backend shipment, inventory, and alert records. Risk values use the backend risk response when available.'
      break
    case 'impact': {
      headers = ['Shipment', 'Product', 'Supplier', 'Warehouse', 'Available / shipment', 'Affected orders', 'Shortage', 'Details']
      rows = backendDataState.impacts.map((impact) => {
        const shortage = Math.max(0, Number(impact.shipmentQuantity || 0) - Number(impact.available || 0))
        return `<tr><td>${rowLink(impact.shipmentId, 'shipment')}</td><td>${escapeHTML(impact.productName || impact.productId || 'Not recorded')}</td><td>${escapeHTML(impact.supplierName || impact.supplierId || 'Not recorded')}</td><td>${escapeHTML(impact.warehouseName || impact.warehouseId || 'Not recorded')}</td><td>${number(impact.available)} / ${number(impact.shipmentQuantity)}</td><td>${number((impact.affectedOrders || []).length)}</td><td>${number(shortage)}</td><td>${rowLink(impact.shipmentId, 'shipment', 'Details')}</td></tr>`
      })
      emptyMessage = 'No backend shipment-impact analysis is available for the current records.'
      message = 'Backend impact analysis chains supplier → shipment → warehouse → inventory → product → order → customer. Shortage is the shipment quantity in excess of available inventory.'
      break
    }
    case 'risk': {
      headers = ['Shipment', 'Risk score', 'Classification', 'Affected orders', 'Risk factors', 'Details']
      rows = [...adminRiskState.byShipment.entries()].map(([shipmentId, assessment]) => {
        const orders = Array.isArray(assessment.orders) ? assessment.orders : []
        const top = [...orders].sort((left, right) => Number(right.riskScore) - Number(left.riskScore))[0]
        const factors = [...new Set(orders.flatMap((order) => (order.factors || []).map((factor) => `${factor.name} (+${factor.points}): ${factor.explanation}`)))]
        return `<tr><td>${rowLink(shipmentId, 'shipment')}</td><td>${number(top?.riskScore)}<small>Backend score</small></td><td>${badge(top?.riskLevel || 'Not recorded')}</td><td>${number(orders.length)}</td><td>${escapeHTML(factors.slice(0, 3).join(' · ') || 'No risk factors returned')}</td><td>${rowLink(shipmentId, 'risk', 'Details')}</td></tr>`
      })
      emptyMessage = 'No backend risk assessments are available for the current shipments.'
      message = 'Backend risk assessment per shipment, using the highest linked-order score. Scores are computed deterministically by the backend risk engine.'
      break
    }
    default:
      return renderOperationsLanding()
  }
  const noRecords = rows.length ? '' : `<div class="admin-empty">${escapeHTML(emptyMessage)}</div>`
  const records = rows.length ? table(headers, rows, emptyMessage) : ''
  const filters = `<div class="admin-toolbar-row"><label class="admin-field">Status / classification<select id="admin-status-filter"><option value="all">All statuses</option></select></label></div>`
  return `${pageHeading(page, message, 'OPERATIONAL VISIBILITY')}${filters}<article class="admin-card"><div class="admin-card-heading"><div><h2>${escapeHTML(pageNames[page])} records</h2><p>${rows.length} backend records</p></div></div>${records}${noRecords}<p class="admin-inline-note">${escapeHTML(message)}</p></article>`
}

function renderOperationsLanding() {
  const links = ['shipments', 'suppliers', 'warehouses', 'inventory', 'orders', 'products', 'customers', 'disruptions', 'impact', 'risk', 'ai-insights']
  return `${pageHeading('operations', 'Browse the shared operational datasets and analysis views.', 'OPERATIONAL VISIBILITY')}<section class="admin-grid">${links.map((page) => `<a class="admin-card admin-module-card" href="#${page}"><span class="admin-eyebrow">OPERATIONAL MODULE</span><h2>${escapeHTML(pageNames[page])}</h2><p>Open ${escapeHTML(pageNames[page].toLowerCase())} using backend records and available relationships.</p><span class="admin-text-link">Open module →</span></a>`).join('')}</section>`
}

function renderAIInsights() {
  hydrateAiInsights()
  const health = adminAiState.health
  const availability = health == null
    ? 'Checking backend AI service availability…'
    : health.available
      ? `AI service reachable. ${health.message}`
      : `AI explanations are unavailable; backend deterministic explanations are shown. ${health.message}`
  const insights = data().disruptions
  const content = insights.length ? insights.map((item) => {
    const explanations = (item.shipments || [])
      .flatMap((shipmentId) => adminAiState.explanations.get(shipmentId) || [])
      .sort((left, right) => Number(right.riskScore) - Number(left.riskScore))
    const top = explanations[0]
    return `<article class="admin-card"><div class="admin-card-heading"><div><h2>${escapeHTML(item.title || item.id)}</h2><p>${escapeHTML(item.id)} · ${escapeHTML(item.category || 'Disruption')}</p></div>${badge(item.severity)}</div><p>${escapeHTML(top?.explanation || item.explanation || item.description || 'No explanation is available.')}</p><p class="admin-inline-note">${top ? (top.aiAvailable ? 'AI service explanation for a linked order.' : 'Backend deterministic fallback explanation.') : 'No backend risk explanation is available for the linked shipments.'}</p></article>`
  }).join('') : `<div class="admin-empty">No disruption context is available.</div>`
  return `${pageHeading('ai-insights', 'Risk explanations from the backend risk engine and AI service.', 'ADVISORY INSIGHTS')}<p class="admin-inline-note">${escapeHTML(availability)}</p><section class="admin-grid">${content}</section>`
}

function renderPlans(page) {
  const plans = page === 'approvals' ? recoveryPlans().filter((plan) => plan.approval_status === 'pending') : recoveryPlans()
  const rows = plans.map((plan) => {
    const disruption = data().disruptions.find((item) => item.id === plan.disruptionId)
    const shipmentId = plan.shipmentId || disruption?.shipments?.[0] || 'Not recorded'
    return `<tr><td>${rowLink(plan.id, 'plan')}</td><td>${rowLink(shipmentId, 'shipment')}</td><td>${escapeHTML(plan.strategy || 'Not recorded')}</td><td>${badge(plan.approval_status)}</td><td>${plan.cost == null ? 'Not recorded' : `₹${number(plan.cost)}`}</td><td>${number(plan.recoveryDays)}</td><td>${number(disruption?.orders?.length || 0)}</td><td>${escapeHTML(plan.createdBy || 'Not recorded')}</td><td>${escapeHTML(date(plan.createdAt))}</td><td>${rowLink(plan.id, 'plan', 'Review')}</td></tr>`
  })
  const description = page === 'approvals'
    ? 'Read-only view of backend recovery plans awaiting a decision. Decisions are enforced by backend role authorization.'
    : 'Recovery plans are loaded from the backend recovery-plan API; no duplicate plan records are created.'
  const headers = ['Plan ID', 'Shipment', 'Strategy', 'Approval status', 'Estimated cost', 'Recovery days', 'Orders linked', 'Created by', 'Created at', 'Details']
  return `${pageHeading(page, description, 'RECOVERY WORKFLOW')}<article class="admin-card"><div class="admin-card-heading"><div><h2>${page === 'approvals' ? 'Approval queue' : 'Recovery plans'}</h2><p>${plans.length} ${page === 'approvals' ? 'pending backend plans' : 'backend plans'}</p></div></div>${plans.length ? table(headers, rows) : '<div class="admin-empty">No recovery plans match this view.</div>'}<p class="admin-inline-note">${escapeHTML(description)}</p></article>`
}

function renderTracking() {
  const plans = recoveryPlans().filter((plan) => ['approved', 'executed'].includes(plan.approval_status))
  const rows = plans.flatMap((plan) => {
    const disruption = data().disruptions.find((item) => item.id === plan.disruptionId)
    const tasks = plan.tasks || []
    const percentage = plan.progressPercentage != null
      ? Math.max(0, Math.min(100, Math.round(Number(plan.progressPercentage) || 0)))
      : tasks.length
        ? Math.round(tasks.filter((task) => task.status === 'completed').length / tasks.length * 100)
        : (plan.execution_status === 'successful' ? 100 : 0)
    const shipmentId = plan.shipmentId || disruption?.shipments?.[0] || 'Not recorded'
    return [[`<tr><td>${rowLink(plan.id, 'plan')}</td><td>${rowLink(shipmentId, 'shipment')}</td><td>${escapeHTML(plan.strategy || 'Not recorded')}</td><td>${badge(plan.execution_authorisation_status)}</td><td>${badge(plan.execution_status)}</td><td>${percentage}%</td><td>${tasks.length ? escapeHTML(timestamp([...tasks].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0].updatedAt)) : 'Not recorded'}</td></tr>`]]
  }).flat()
  return `${pageHeading('tracking', 'Monitor backend recovery progress without changing execution status.', 'RECOVERY EXECUTION')}<article class="admin-card"><div class="admin-card-heading"><div><h2>Recovery progress</h2><p>Progress from the backend recovery-progress service; this Administrator view is read-only.</p></div></div>${rows.length ? table(['Plan ID', 'Shipment', 'Strategy', 'Execution authorization', 'Execution status', 'Task completion', 'Last update'], rows) : '<div class="admin-empty">No approved recovery plans are available for tracking.</div>'}</article><p class="admin-inline-note">Progress updates are recorded by authorized execution users through the backend. This page does not change operational tasks.</p>`
}

function renderRecoveryPlanning() {
  const options = [
    ['DO_NOTHING', 'Continue current operation', 'Review current status and known impact without changing operational state.'],
    ['REALLOCATE_STOCK', 'Reallocate stock', 'Requires verified source warehouse availability and authorized transfer.'],
    ['EXPEDITE_SHIPMENT', 'Expedite shipment', 'Requires supported arrival, cost, and recovery-time estimates.'],
    ['ALTERNATIVE_SUPPLIER', 'Alternative supplier', 'Requires supplier availability and applicable procurement approvals.'],
    ['SPLIT_ORDER', 'Split order', 'Requires supported order quantity and fulfillment rules.'],
  ]
  return `${pageHeading('recovery-planning', 'Review strategy types and the backend workflow each strategy must pass before execution.', 'RECOVERY WORKFLOW')}<p class="admin-inline-note">Recovery plans are created from the Operations Analyst workspace through the backend recovery-plan API. Administrators can review plans, decisions, and execution status here; creator and approver separation is enforced by the backend.</p><section class="admin-grid">${options.map(([code, name, description]) => `<article class="admin-card"><p class="admin-eyebrow">${escapeHTML(code)}</p><h2>${escapeHTML(name)}</h2><p>${escapeHTML(description)}</p><span class="admin-inline-note">Evaluated by the backend simulation service.</span></article>`).join('')}</section><article class="admin-card"><div class="admin-card-heading"><div><h2>Simulation and feasibility</h2><p>Simulation runs through <code>/api/simulation</code> and feasibility through <code>/api/recovery/feasibility</code>.</p></div></div><div class="admin-empty">Simulation responses are advisory and do not mutate operational records. Strategy comparison, recovery feasibility, and AI recommendations are available in the Operations Analyst workspace.</div></article>`
}

function renderDataImport() {
  const entities = ['suppliers', 'shipments', 'warehouses', 'inventory', 'products', 'customers', 'orders']
  return `${pageHeading('data-import', 'Upload a dataset to the backend import service and review the validation report.', 'DATA OPERATIONS')}<article class="admin-card"><div class="admin-card-heading"><div><h2>Import operational data</h2><p>CSV or JSON · maximum 10 MB per file.</p></div></div><div class="admin-toolbar-row"><label class="admin-field">Entity type<select id="admin-import-entity">${entities.map((entity) => `<option value="${entity}">${titleCase(entity)}</option>`).join('')}</select></label><label class="admin-field">CSV or JSON file<input id="admin-import-file" type="file" accept=".csv,.json,text/csv,application/json"></label><button class="admin-action" id="admin-import-submit" type="button" disabled>Upload dataset</button></div><p id="admin-import-file-info" class="admin-inline-note">No file selected. The backend validates extension, size, and row schema before importing.</p><div id="admin-import-status" class="admin-empty">Upload a file to receive an import response. Master data refreshes after a successful import.</div></article>`
}

function renderNotifications() {
  const notifications = getNotifications()
  const cards = notifications.map((item) => `<article class="admin-notification ${item.read ? '' : 'is-unread'}"><span class="admin-notification-dot"></span><span><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.description)}</p><small>${escapeHTML(timestamp(item.date))} · Backend notification</small></span>${badge(item.read ? 'read' : 'unread')}</article>`).join('')
  return `${pageHeading('notifications', 'Read the backend notifications issued to this account by the recovery workflow.', 'ALERT CENTRE')}<p class="admin-inline-note">Notifications are user-scoped and served by the backend notification API. Read state is stored per user.</p><section class="admin-grid">${cards || '<div class="admin-empty">No notifications are available for this account.</div>'}</section>`
}

function renderAudit() {
  const audit = [...(data().workflow.audit || [])].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
  const rows = audit.map((event) => `<tr><td>${escapeHTML(event.id || 'Not recorded')}</td><td>${escapeHTML(event.user || 'Not recorded')}<small>${escapeHTML(event.role || '')}</small></td><td>${escapeHTML(event.action || 'Not recorded')}</td><td>Recovery plan</td><td>${rowLink(event.planId, 'plan', event.planId || 'Not recorded')}</td><td>${escapeHTML(timestamp(event.timestamp))}</td><td>${escapeHTML(event.comments || 'Not recorded')}</td></tr>`)
  return `${pageHeading('audit', 'Review recovery workflow audit entries recorded by the backend audit service.', 'AUDIT HISTORY')}<p class="admin-inline-note">Entries come from the backend recovery-plan audit records for plans visible to this account. The Administrator view is read-only.</p><article class="admin-card"><div class="admin-card-heading"><div><h2>Recovery workflow events</h2><p>${audit.length} backend events</p></div></div>${audit.length ? table(['Event ID', 'User', 'Action', 'Entity type', 'Entity ID', 'Timestamp', 'Details'], rows) : '<div class="admin-empty">No backend audit entries are recorded.</div>'}</article>`
}

function detailFor(type, id) {
  const d = data()
  if (type === 'shipment') {
    const item = d.shipments.find((entry) => (entry.id || entry.shipmentId) === id)
    return item && [
      ['Shipment ID', item.id || item.shipmentId], ['Quantity', number(item.quantity)], ['Status', titleCase(item.status || item.shipmentStatus)],
      ['Expected delivery', date(item.expectedDate || item.expectedDeliveryDate)], ['Supplier / origin', shipmentSupplier(item)],
      ['Destination', item.destinationWarehouse || item.destination || 'Not recorded'], ['Related order reference', item.orderId || 'Not recorded'],
      ['Disruption', d.disruptions.find((disruption) => disruption.shipments?.includes(id))?.title || 'Not recorded'],
    ]
  }
  if (type === 'inventory') {
    const item = d.inventory.find((entry) => (entry.id || entry.productId) === id)
    return item && [['Inventory ID', item.id], ['Product', item.productName], ['Product ID', item.productId], ['Warehouse', item.warehouse], ['On hand', number(item.quantity)], ['Reserved', number(item.reserved || 0)], ['Available', number(available(item))], ['Reorder point', number(item.reorderThreshold)]]
  }
  if (type === 'risk') {
    const assessment = adminRiskState.byShipment.get(id)
    if (!assessment) return [['Shipment ID', id], ['Risk assessment', 'No backend risk assessment is available for this shipment.']]
    const orders = Array.isArray(assessment.orders) ? assessment.orders : []
    const top = [...orders].sort((left, right) => Number(right.riskScore) - Number(left.riskScore))[0]
    return [['Shipment ID', assessment.shipmentId || id], ['Shipment status', titleCase(assessment.shipmentStatus)], ['Highest risk score', top ? `${number(top.riskScore)} · ${titleCase(top.riskLevel)}` : 'Not recorded'], ['Affected orders', number(orders.length)], ['Orders at high risk', orders.filter((order) => Number(order.riskScore) >= 50).map((order) => order.orderId).join(', ') || 'None'], ['Risk factors', (top?.factors || []).map((factor) => `${factor.name} (+${factor.points}): ${factor.explanation}`).join('; ') || 'No risk factors returned']]
  }
  if (type === 'disruption') {
    const item = d.disruptions.find((entry) => entry.id === id || entry.shipments?.includes(id))
    return item && [['Disruption ID', item.id], ['Summary', item.title], ['Category', item.category], ['Severity', titleCase(item.severity)], ['Risk score', `${number(item.riskScore)} · alert estimate`], ['Status', titleCase(item.status)], ['Affected orders', number(item.affectedOrders)], ['Related shipments', (item.shipments || []).join(', ') || 'Not recorded'], ['Impact', item.impact], ['Explanation', item.explanation]]
  }
  if (type === 'plan') {
    const plan = d.workflow.plans?.find((entry) => entry.id === id)
    const disruption = d.disruptions.find((entry) => entry.id === plan?.disruptionId)
    return plan && [['Plan ID', plan.id], ['Shipment ID', plan.shipmentId || disruption?.shipments?.[0] || 'Not recorded'], ['Strategy', plan.strategy], ['Approval status', titleCase(plan.approval_status)], ['Execution authorization', titleCase(plan.execution_authorisation_status)], ['Execution status', titleCase(plan.execution_status)], ['Estimated cost', plan.cost == null ? 'Not recorded' : `₹${number(plan.cost)}`], ['Recovery days', number(plan.recoveryDays)], ['Created by', plan.createdBy], ['Created at', timestamp(plan.createdAt)], ['Task progress', (plan.tasks || []).map((task) => `${task.title}: ${titleCase(task.status)}`).join('; ') || 'No task records']]
  }
  if (type === 'supplier') {
    const supplier = getSuppliers().find((entry) => (entry.id || entry.name) === id || entry.name === id)
    return supplier && [['Supplier', supplier.name], ['Supplier ID', supplier.id || 'Not recorded'], ['Status', supplier.status || 'Not recorded'], ['Lead time', supplier.leadTime == null ? 'Not recorded' : `${number(supplier.leadTime)} days`], ['Related products', (supplier.products || []).map((item) => item.productName).join(', ') || 'Not recorded'], ['Associated shipments', (supplier.shipments || []).map((item) => item.id).join(', ') || 'Not recorded']]
  }
  if (type === 'warehouse') {
    const warehouse = getWarehouses().find((entry) => (entry.id || entry.warehouseId) === id)
    return warehouse && [['Warehouse ID', warehouse.id], ['Name', warehouse.name], ['Location', warehouse.location || 'Not recorded'], ['Storage capacity', warehouse.capacity ?? 'Not recorded'], ['Inventory records', number(warehouse.inventory?.length || 0)], ['Available quantity', number((warehouse.inventory || []).reduce((sum, item) => sum + available(item), 0))]]
  }
  if (type === 'product') {
    const product = getProducts().find((entry) => (entry.id || entry.productId) === id)
    return product && [['Product ID', product.id || product.productId], ['Name', product.name || product.productName], ['Category', product.category || 'Not recorded'], ['Unit cost', product.unitCost ?? 'Not recorded'], ['Supplier', product.supplier || 'Not recorded'], ['Inventory locations', number(product.inventory?.length || 0)]]
  }
  return null
}

function showDetail(type, id) {
  const details = detailFor(type, id)
  const dialog = document.getElementById('admin-detail-dialog')
  const content = document.getElementById('admin-detail-content')
  if (!details) {
    document.getElementById('admin-detail-title').textContent = 'Record details unavailable'
    content.innerHTML = `<p>No detailed ${escapeHTML(type)} record is available for ${escapeHTML(id)} in the backend records.</p>`
  } else {
    const title = details.find(([label]) => ['Shipment ID', 'Plan ID', 'Disruption ID', 'Inventory ID', 'Supplier', 'Warehouse ID', 'Product ID'].includes(label))?.[1] || `${titleCase(type)} details`
    document.getElementById('admin-detail-title').textContent = String(title)
    content.innerHTML = `<dl class="admin-detail-list">${details.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value ?? 'Not recorded')}</dd></div>`).join('')}</dl>`
  }
  dialog.showModal()
}

function renderPage(page) {
  const container = document.getElementById('admin-page')
  document.getElementById('admin-current-title').textContent = pageNames[page] || pageNames.dashboard
  document.querySelectorAll('.admin-nav [data-page]').forEach((link) => link.classList.toggle('is-active', link.dataset.page === page))
  document.getElementById('admin-search').value = ''
  if (page === 'dashboard') container.innerHTML = renderDashboard()
  else if (['operations'].includes(page)) container.innerHTML = renderOperationsLanding()
  else if (['shipments', 'suppliers', 'warehouses', 'inventory', 'orders', 'products', 'customers', 'disruptions', 'impact', 'risk'].includes(page)) container.innerHTML = renderEntityPage(page)
  else if (page === 'ai-insights') container.innerHTML = renderAIInsights()
  else if (page === 'recovery-planning') container.innerHTML = renderRecoveryPlanning()
  else if (page === 'plans' || page === 'approvals') container.innerHTML = renderPlans(page)
  else if (page === 'tracking') container.innerHTML = renderTracking()
  else if (page === 'data-import') container.innerHTML = renderDataImport()
  else if (page === 'notifications') container.innerHTML = renderNotifications()
  else if (page === 'audit') container.innerHTML = renderAudit()
  else container.innerHTML = renderDashboard()
  const statusFilter = document.getElementById('admin-status-filter')
  if (statusFilter) {
    const statuses = [...new Set([...container.querySelectorAll('.admin-table tbody .admin-status')].map((item) => item.dataset.status).filter(Boolean))]
    statusFilter.innerHTML = `<option value="all">All statuses</option>${statuses.map((status) => `<option value="${escapeHTML(status)}">${escapeHTML(titleCase(status))}</option>`).join('')}`
  }
  document.getElementById('admin-pending-count').textContent = String(plansByStatus('pending').length || '')
  document.getElementById('admin-notification-count').textContent = String(getNotifications().filter((item) => !item.read).length || '')
}

function searchCurrentPage() {
  const query = document.getElementById('admin-search').value.trim().toLowerCase()
  const status = document.getElementById('admin-status-filter')?.value || 'all'
  document.querySelectorAll('#admin-page .admin-table tbody tr').forEach((row) => {
    const matchesText = !query || row.innerText.toLowerCase().includes(query)
    const rowStatuses = [...row.querySelectorAll('.admin-status')].map((item) => item.dataset.status)
    const matchesStatus = status === 'all' || rowStatuses.includes(status)
    row.hidden = !matchesText || !matchesStatus
  })
  document.querySelectorAll('#admin-page .admin-alert, #admin-page .admin-notification, #admin-page .admin-module-card, #admin-page > .admin-grid > .admin-card').forEach((card) => {
    if (!query) {
      card.hidden = false
      return
    }
    card.hidden = !card.innerText.toLowerCase().includes(query)
  })
}

function validImportFile(file) {
  return Boolean(file) && /\.(csv|json)$/i.test(file.name) && file.size <= 10 * 1024 * 1024
}

function updateImportFileInfo(file) {
  const info = document.getElementById('admin-import-file-info')
  const submit = document.getElementById('admin-import-submit')
  if (!info) return
  if (!file) {
    info.textContent = 'No file selected. The backend validates extension, size, and row schema before importing.'
    if (submit) submit.disabled = true
    return
  }
  const sizeMB = file.size / (1024 * 1024)
  const valid = validImportFile(file)
  info.textContent = `${file.name} · ${sizeMB.toFixed(2)} MB · ${valid ? 'Ready to upload to the backend import service.' : 'File must be CSV or JSON and no larger than 10 MB.'}`
  if (submit) submit.disabled = !valid
}

async function submitImport() {
  const file = document.getElementById('admin-import-file')?.files?.[0]
  const entity = document.getElementById('admin-import-entity')?.value
  const status = document.getElementById('admin-import-status')
  const submit = document.getElementById('admin-import-submit')
  if (!file || !entity || !validImportFile(file)) return
  if (submit) {
    submit.disabled = true
    submit.textContent = 'Uploading…'
  }
  if (status) status.textContent = `Uploading ${file.name} to the backend ${titleCase(entity)} import service…`
  let message
  let failed = false
  try {
    const response = await importSupplyChainFile(entity, file)
    const errors = Array.isArray(response?.errors) ? response.errors : []
    message = `<strong>${escapeHTML(titleCase(response?.entityType || entity))} import complete.</strong> ${number(response?.importedRows)} imported · ${number(response?.rejectedRows)} rejected · ${number(response?.totalRows)} total rows.${errors.length ? `<br>${escapeHTML(errors.slice(0, 5).join(' · '))}` : ''}`
  } catch (error) {
    failed = true
    message = `Import failed: ${error.message || 'The backend rejected the request.'}`
  }
  if (failed) {
    if (status) status.textContent = message
  } else {
    await hydrateMaster()
    const freshStatus = document.getElementById('admin-import-status')
    if (freshStatus) freshStatus.innerHTML = message
    const freshSubmit = document.getElementById('admin-import-submit')
    if (freshSubmit) freshSubmit.textContent = 'Upload dataset'
    return
  }
  if (submit) {
    submit.disabled = false
    submit.textContent = 'Upload dataset'
  }
}

function init() {
  document.getElementById('admin-date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())
  document.querySelector('.admin-nav').addEventListener('click', (event) => {
    const link = event.target.closest('a[data-page]')
    if (!link) return
    event.preventDefault()
    if (location.hash !== link.getAttribute('href')) location.hash = link.getAttribute('href')
    renderPage(link.dataset.page)
  })
  window.addEventListener('hashchange', () => renderPage(location.hash.slice(1) || 'dashboard'))
  document.getElementById('admin-search').addEventListener('input', searchCurrentPage)
  document.getElementById('admin-page').addEventListener('change', (event) => {
    if (event.target.id === 'admin-import-file') {
      updateImportFileInfo(event.target.files?.[0])
      return
    }
    if (event.target.id !== 'admin-status-filter') return
    searchCurrentPage()
  })
  document.getElementById('admin-page').addEventListener('click', (event) => {
    if (event.target.closest('#admin-import-submit')) {
      submitImport()
      return
    }
    const button = event.target.closest('[data-record-type][data-record-id]')
    if (button) showDetail(button.dataset.recordType, button.dataset.recordId)
    const sortButton = event.target.closest('[data-sort-column]')
    if (sortButton) {
      const tableElement = sortButton.closest('table')
      const body = tableElement?.tBodies[0]
      const column = Number(sortButton.dataset.sortColumn)
      if (!body || !Number.isInteger(column)) return
      const direction = sortButton.dataset.direction === 'asc' ? 'desc' : 'asc'
      tableElement.querySelectorAll('[data-sort-column]').forEach((item) => {
        item.dataset.direction = ''
        item.closest('th')?.removeAttribute('aria-sort')
      })
      sortButton.dataset.direction = direction
      sortButton.closest('th')?.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending')
      const rows = [...body.rows]
      rows.sort((left, right) => {
        const a = left.cells[column]?.innerText.trim() || ''
        const b = right.cells[column]?.innerText.trim() || ''
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) * (direction === 'asc' ? 1 : -1)
      })
      rows.forEach((row) => body.append(row))
    }
  })
  document.querySelector('[data-close-dialog]').addEventListener('click', () => document.getElementById('admin-detail-dialog').close())
  renderPage(pageNames[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard')
  hydrateMaster()
  hydrateRisk()
}

const selectedRole = roleOf()
if (selectedRole !== 'ADMIN') {
  document.querySelector('.admin-content').innerHTML = `<main class="admin-main"><section class="admin-card"><p class="admin-eyebrow">ACCESS CONTROL</p><h1>Access unavailable</h1><p>This workspace is restricted to the Administrator role in this workspace.</p><a class="admin-action" href="/src/role-selection.html">Return to role selection</a><p class="admin-inline-note">The backend JWT role check enforces this restriction; this page is not a security boundary.</p></section></main>`
} else {
  init()
}
