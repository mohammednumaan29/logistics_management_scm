import { requireRole } from './api/client.js';
await requireRole('WAREHOUSE_OPERATOR');
import './workspaces/inventory-manager.css'
import './workspaces/dashboard-consistency.css'
import { initialActivity, inventoryItems, shipments as shipmentItems } from './workspaces/operations-analyst-data.js'

const STORAGE_KEY = 'disruptioniq.inventory-manager.v1'
const SETTINGS_KEY = 'disruptioniq.inventory-manager.settings.v1'
const clone = (value) => JSON.parse(JSON.stringify(value))
const saved = localStorage.getItem(STORAGE_KEY)
const savedState = saved ? JSON.parse(saved) : null
const stockCaps = {
  'PRD-1001': 6000, 'PRD-1002': 6000, 'PRD-1003': 900, 'PRD-1004': 500,
  'PRD-1005': 700, 'PRD-1006': 500, 'PRD-1007': 450, 'PRD-1008': 400,
  'PRD-1009': 350, 'PRD-1010': 250, 'PRD-1011': 220, 'PRD-1012': 180,
}

function createMovements(products) {
  return products.flatMap((product) => {
    let running = product.quantity
    return [...(product.movements || [])]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((movement, index) => {
        const nextQuantity = running
        const previousQuantity = nextQuantity - movement.quantity
        running = previousQuantity
        return {
          id: `MOV-${product.productId.slice(-4)}-${String(index + 1).padStart(2, '0')}`,
          productId: product.productId,
          productName: product.productName,
          type: movement.type,
          previousQuantity,
          quantity: movement.quantity,
          newQuantity: nextQuantity,
          source: movement.quantity > 0 ? movement.reference : product.warehouse,
          destination: movement.quantity > 0 ? product.warehouse : movement.reference,
          reference: movement.reference,
          date: `${movement.date}T08:00:00`,
          performedBy: 'Inventory Operations',
          warehouse: product.warehouse,
        }
      })
  })
}

const products = clone(inventoryItems).map((product) => ({
  ...product,
  maxStock: product.maxStock || stockCaps[product.productId] || Math.max(product.reorderThreshold * 4, product.quantity * 1.2),
  damaged: product.damaged || 0,
}))

const seededReplenishments = [
  { id: 'REP-4101', productId: 'PRD-1004', quantity: 250, priority: 'critical', expectedDate: '2026-11-02', status: 'awaiting-approval', createdAt: '2026-10-30T08:15:00', purchaseOrder: '' },
  { id: 'REP-4102', productId: 'PRD-1005', quantity: 350, priority: 'high', expectedDate: '2026-11-04', status: 'approved', createdAt: '2026-10-29T15:40:00', purchaseOrder: '' },
  { id: 'REP-4103', productId: 'PRD-1003', quantity: 300, priority: 'high', expectedDate: '2026-10-31', status: 'ordered', createdAt: '2026-10-28T11:20:00', purchaseOrder: 'PO-4943' },
]
const seededReceipts = [
  { id: 'RCV-2401', purchaseOrder: 'PO-4943', supplier: 'SafeWorks Manufacturing', productId: 'PRD-1003', expectedQuantity: 300, receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, expectedDate: '2026-10-31', actualDate: '', inspection: 'pending', status: 'expected', replenishmentId: 'REP-4103' },
  { id: 'RCV-2402', purchaseOrder: 'PO-4950', supplier: 'Atlas Industrial Supply', productId: 'PRD-1001', expectedQuantity: 500, receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, expectedDate: '2026-11-01', actualDate: '', inspection: 'pending', status: 'expected', replenishmentId: '' },
  { id: 'RCV-2403', purchaseOrder: 'PO-4953', supplier: 'FlowTech Components', productId: 'PRD-1006', expectedQuantity: 240, receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, expectedDate: '2026-10-29', actualDate: '', inspection: 'pending', status: 'delayed', replenishmentId: '' },
]
const seededAdjustments = [
  { id: 'ADJ-0201', productId: 'PRD-1005', systemQuantity: 180, actualQuantity: 172, reason: 'Cycle-count discrepancy', requestedBy: 'Inventory Manager', status: 'pending-approval', createdAt: '2026-10-29T14:10:00', history: ['Adjustment submitted; awaiting authorised approval.'] },
]
const seededCounts = [
  { id: 'CNT-0301', warehouse: 'WH-001', location: 'Aisle A · mixed', productsCounted: 10, discrepancies: 1, accuracy: 90, assignedTo: 'Inventory Manager', date: '2026-10-29T10:00:00', status: 'completed' },
  { id: 'CNT-0302', warehouse: 'WH-001', location: 'Aisle B · mixed', productsCounted: 8, discrepancies: 0, accuracy: 100, assignedTo: 'Warehouse Operator', date: '2026-10-28T09:30:00', status: 'completed' },
]
const seededPurchaseOrders = [
  { id: 'PO-4943', supplier: 'SafeWorks Manufacturing', productId: 'PRD-1003', ordered: 300, received: 0, orderDate: '2026-10-28', expectedDate: '2026-10-31', status: 'in-transit' },
  { id: 'PO-4950', supplier: 'Atlas Industrial Supply', productId: 'PRD-1001', ordered: 500, received: 0, orderDate: '2026-10-29', expectedDate: '2026-11-01', status: 'confirmed' },
  { id: 'PO-4953', supplier: 'FlowTech Components', productId: 'PRD-1006', ordered: 240, received: 0, orderDate: '2026-10-22', expectedDate: '2026-10-29', status: 'delayed' },
]

const state = {
  inventory: savedState?.inventory || products,
  movements: savedState?.movements || createMovements(products),
  replenishments: savedState?.replenishments || seededReplenishments,
  receipts: savedState?.receipts || seededReceipts,
  adjustments: savedState?.adjustments || seededAdjustments,
  counts: savedState?.counts || seededCounts,
  purchaseOrders: savedState?.purchaseOrders || seededPurchaseOrders,
  alerts: savedState?.alerts || [],
  activities: savedState?.activities || initialActivity.map((item) => ({
    id: item.id, timestamp: item.timestamp, user: 'Inventory Manager', action: item.type,
    productId: item.recordId, previous: '', next: '', reference: item.recordId,
  })),
  notifications: savedState?.notifications || [],
}

const settings = {
  displayName: 'Inventory Manager',
  warehouse: 'WH-001',
  pageSize: 8,
  notificationsEnabled: true,
  lowStockNotifications: true,
  ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
}
const inventoryFilter = { query: '', category: 'all', status: 'all', warehouse: settings.warehouse || 'all', sort: 'name', page: 1, pageSize: Number(settings.pageSize) || 8 }
const movementFilter = { query: '', type: 'all', warehouse: 'all', from: '', to: '' }
const moduleFilters = { replenishment: 'all', receiving: 'all', adjustments: 'all', counts: 'all' }
const REPORT_LABELS = {
  summary: 'Inventory summary', 'low-stock': 'Low stock', 'out-of-stock': 'Out of stock',
  overstock: 'Overstock', movements: 'Stock movements', accuracy: 'Stock accuracy',
  replenishment: 'Replenishment', warehouse: 'Warehouse inventory', valuation: 'Stock valuation',
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}
function number(value) { return new Intl.NumberFormat().format(value || 0) }
function date(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, options).format(parsed)
}
function titleCase(value) {
  return String(value || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
function available(product) { return Math.max(0, product.quantity - product.reserved) }
function stockStatus(product) {
  if (available(product) <= 0) return 'out-of-stock'
  if (available(product) <= product.reorderThreshold) return 'low-stock'
  if (product.quantity > product.maxStock) return 'overstock'
  return 'in-stock'
}
function addActivity(action, product, previous = '', next = '', reference = '') {
  state.activities.unshift({
    id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(), user: settings.displayName, action,
    productId: product?.productId || '', previous, next, reference,
  })
}
function addNotification(title, description, page, recordId = '') {
  if (!settings.notificationsEnabled) return
  if (title === 'Inventory stock alert' && !settings.lowStockNotifications) return
  state.notifications.unshift({
    id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title, description, page, recordId, date: new Date().toISOString(), read: false,
  })
}
function getProduct(id) { return state.inventory.find((item) => item.productId === id) }
function getStatusCount(status) { return state.inventory.filter((item) => stockStatus(item) === status).length }
function pushMovement(product, type, quantity, reference, source, destination) {
  const before = product.quantity
  product.quantity = Math.max(0, before + quantity)
  product.updatedAt = new Date().toISOString()
  state.movements.unshift({
    id: `MOV-${Date.now()}`, productId: product.productId, productName: product.productName,
    type, previousQuantity: before, quantity: product.quantity - before, newQuantity: product.quantity,
    source, destination, reference, date: new Date().toISOString(),
    performedBy: settings.displayName, warehouse: product.warehouse,
  })
}

function syncStockAlerts() {
  state.inventory.forEach((product) => {
    const status = stockStatus(product)
    state.alerts.filter((alert) => alert.productId === product.productId && ['low-stock', 'out-of-stock', 'overstock'].includes(alert.type) && alert.status !== 'resolved' && alert.type !== status).forEach((alert) => {
      alert.status = 'resolved'
      alert.clearedByStock = true
      alert.notes.unshift(`${date(new Date(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · Stock condition cleared.`)
    })
    if (!['low-stock', 'out-of-stock', 'overstock'].includes(status)) return
    const existing = state.alerts.find((alert) => alert.productId === product.productId && alert.type === status && alert.status !== 'resolved')
    if (existing) {
      existing.description = `Available ${number(available(product))} ${product.unit}; reorder level ${number(product.reorderThreshold)}; maximum ${number(product.maxStock)}.`
      return
    }
    const resolvedByUser = state.alerts.some((alert) => alert.productId === product.productId && alert.type === status && alert.status === 'resolved' && !alert.clearedByStock)
    if (resolvedByUser) return
    const severity = status === 'out-of-stock' ? 'critical' : status === 'low-stock' ? (available(product) <= product.reorderThreshold / 2 ? 'high' : 'medium') : 'low'
    const alert = {
      id: `IAL-${product.productId.slice(-4)}-${status}`,
      productId: product.productId, type: status, severity,
      title: status === 'overstock' ? `${product.productName} exceeds maximum stock` : `${product.productName} ${status === 'low-stock' ? 'below reorder level' : 'out of stock'}`,
      description: `Available ${number(available(product))} ${product.unit}; reorder level ${number(product.reorderThreshold)}; maximum ${number(product.maxStock)}.`,
      status: 'open', createdAt: new Date().toISOString(), assignedTo: '', notes: [],
    }
    state.alerts.unshift(alert)
    addNotification('Inventory stock alert', alert.title, 'alerts', alert.id)
  })
}
function syncReceiptAlerts() {
  state.receipts.forEach((receipt) => {
    const existing = state.alerts.find((alert) => alert.receiptId === receipt.id)
    if (receipt.status === 'delayed' && !existing) {
      const alert = {
        id: `IAL-${receipt.id}`, receiptId: receipt.id, productId: receipt.productId,
        type: 'delayed-delivery', severity: 'high', title: `Incoming delivery ${receipt.id} is delayed`,
        description: `${receipt.supplier} · expected ${date(receipt.expectedDate)} · ${number(receipt.expectedQuantity - receipt.receivedQuantity)} units outstanding.`,
        status: 'open', createdAt: new Date().toISOString(), assignedTo: '', notes: [],
      }
      state.alerts.unshift(alert)
      addNotification('Delayed incoming delivery', alert.title, 'receiving', receipt.id)
    } else if (existing && receipt.status !== 'delayed' && existing.status !== 'resolved') {
      existing.status = 'resolved'
      existing.notes.unshift('Delivery status updated; delay condition cleared.')
    }
  })
}
syncStockAlerts()
syncReceiptAlerts()

const navLinks = [...document.querySelectorAll('.im-nav a[href^="#"]')]
const knownPages = new Set(navLinks.map((link) => link.hash.slice(1)))
function showPage(id) {
  const page = knownPages.has(id) ? id : 'overview'
  document.querySelectorAll('[data-im-page]').forEach((view) => { view.hidden = view.dataset.imPage !== page })
  navLinks.forEach((link) => {
    const active = link.hash.slice(1) === page
    link.classList.toggle('is-active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  window.scrollTo(0, 0)
}
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]')
  if (!link || !knownPages.has(link.hash.slice(1))) return
  event.preventDefault()
  const page = link.hash.slice(1)
  if (location.hash !== `#${page}`) history.pushState(null, '', `#${page}`)
  const filterKey = link.dataset.filterKey
  const filterValue = link.dataset.filterValue
  if (filterKey === 'inventoryStatus') {
    inventoryFilter.status = filterValue
    inventoryFilter.page = 1
    document.getElementById('im-inventory-status').value = filterValue
    renderInventory()
  } else if (['replenishment', 'receiving', 'adjustments', 'counts'].includes(filterKey)) {
    moduleFilters[filterKey] = filterValue
    const filterIds = {
      replenishment: 'im-replenishment-status', receiving: 'im-receiving-status',
      adjustments: 'im-adjustment-status', counts: 'im-count-filter',
    }
    document.getElementById(filterIds[filterKey]).value = filterValue
    if (filterKey === 'replenishment') renderReplenishments()
    if (filterKey === 'receiving') renderReceiving()
    if (filterKey === 'adjustments') renderAdjustments()
    if (filterKey === 'counts') renderCounts()
  }
  showPage(page)
})
window.addEventListener('popstate', () => showPage(location.hash.slice(1)))
window.addEventListener('hashchange', () => showPage(location.hash.slice(1)))

function setKpis(target, items) {
  document.getElementById(target).innerHTML = items.map((item) => `
    <a class="im-kpi" href="#${esc(item.page)}" ${item.filterKey ? `data-filter-key="${esc(item.filterKey)}" data-filter-value="${esc(item.filterValue)}"` : ''}><span class="im-kpi-icon">${esc(item.icon)}</span>
      <span><span class="im-kpi-label">${esc(item.label)}</span><strong>${esc(item.value)}</strong><small>${esc(item.note)}</small></span>
    </a>`).join('')
}
function makeChart(title, description, values, tone = 'gold') {
  const max = Math.max(1, ...values.map((item) => item.value))
  const color = tone === 'mixed' ? ['gold', 'alt', 'green', 'red'] : [tone]
  return `<article class="im-chart"><h3>${esc(title)}</h3><p>${esc(description)}</p><div class="im-bars">${values.map((item, index) => `
    <div class="im-bar-row"><span>${esc(item.label)}</span><span class="im-bar-track"><i class="im-bar-fill ${color[index % color.length] === 'gold' ? '' : color[index % color.length]}" style="width:${Math.max(1, item.value / max * 100)}%"></i></span><strong class="im-bar-value">${esc(number(item.value))}</strong></div>`).join('')}</div></article>`
}
function categoryCounts() {
  const counts = new Map()
  state.inventory.forEach((product) => counts.set(product.category, (counts.get(product.category) || 0) + product.quantity))
  return [...counts].map(([label, value]) => ({ label, value }))
}
function renderOverview() {
  const total = state.inventory.reduce((sum, product) => sum + product.quantity, 0)
  const reserved = state.inventory.reduce((sum, product) => sum + product.reserved, 0)
  const activeAlerts = state.alerts.filter((alert) => alert.status !== 'resolved')
  const pendingReceipts = state.receipts.filter((receipt) => !['received', 'closed'].includes(receipt.status)).length
  const pendingAdjustments = state.adjustments.filter((adjustment) => adjustment.status === 'pending-approval').length
  const pendingReplenishments = state.replenishments.filter((request) => request.status === 'awaiting-approval').length
  const overstock = getStatusCount('overstock')
  setKpis('im-overview-kpis', [
    { label: 'Total SKUs', value: state.inventory.length, note: 'Unique product records', icon: '▤', page: 'inventory' },
    { label: 'Total stock units', value: number(total), note: 'Physical quantity on record', icon: '▦', page: 'inventory' },
    { label: 'Available stock', value: number(total - reserved), note: `${number(reserved)} reserved`, icon: '✓', page: 'inventory' },
    { label: 'Reserved stock', value: number(reserved), note: 'Allocated to orders', icon: '⌑', page: 'inventory' },
    { label: 'Low stock items', value: getStatusCount('low-stock'), note: 'At or below reorder level', icon: '!', page: 'inventory', filterKey: 'inventoryStatus', filterValue: 'low-stock' },
    { label: 'Out of stock', value: getStatusCount('out-of-stock'), note: 'Zero available quantity', icon: '×', page: 'inventory', filterKey: 'inventoryStatus', filterValue: 'out-of-stock' },
    { label: 'Overstock items', value: overstock, note: 'Above maximum stock', icon: '↑', page: 'inventory', filterKey: 'inventoryStatus', filterValue: 'overstock' },
    { label: 'Pending replenishments', value: pendingReplenishments, note: 'Awaiting procurement', icon: '↻', page: 'replenishment', filterKey: 'replenishment', filterValue: 'awaiting-approval' },
    { label: 'Pending receipts', value: pendingReceipts, note: 'Incoming deliveries', icon: '⇣', page: 'receiving', filterKey: 'receiving', filterValue: 'pending' },
    { label: 'Stock adjustments', value: pendingAdjustments, note: 'Awaiting approval', icon: '±', page: 'adjustments', filterKey: 'adjustments', filterValue: 'pending-approval' },
  ])
  const categories = categoryCounts()
  const warehouseCounts = [...new Set(state.inventory.map((item) => item.warehouse))].map((warehouse) => ({
    label: warehouse, value: state.inventory.filter((item) => item.warehouse === warehouse).reduce((sum, item) => sum + item.quantity, 0),
  }))
  const movementCounts = ['Received', 'Dispatched', 'Adjusted', 'Transferred'].map((type) => ({
    label: type, value: state.movements.filter((item) => item.type === type).reduce((sum, item) => sum + Math.abs(item.quantity), 0),
  }))
  const replenishmentCounts = ['awaiting-approval', 'approved', 'ordered', 'received'].map((status) => ({
    label: titleCase(status), value: state.replenishments.filter((item) => item.status === status).length,
  }))
  const stockDistribution = [
    { label: 'Available', value: state.inventory.reduce((sum, product) => sum + available(product), 0) },
    { label: 'Reserved', value: reserved },
    { label: 'Damaged', value: state.inventory.reduce((sum, product) => sum + product.damaged, 0) },
    { label: 'Unavailable', value: state.inventory.reduce((sum, product) => sum + Math.max(0, product.quantity - product.reserved - product.damaged - available(product)), 0) },
  ]
  const movementDays = [...new Set(state.movements.map((item) => String(item.date).slice(0, 10)))].sort().slice(-6)
  const trends = movementDays.map((day) => ({
    label: date(day, { day: '2-digit', month: 'short' }),
    value: Math.max(0, total - state.movements.filter((item) => String(item.date).slice(0, 10) > day).reduce((sum, item) => sum + item.quantity, 0)),
  }))
  document.getElementById('im-overview-charts').innerHTML = [
    makeChart('Stock distribution', 'Available, reserved, damaged, and unavailable units', stockDistribution, 'mixed'),
    makeChart('Inventory trends', 'Estimated daily stock · partial recorded movement history', trends, 'gold'),
    makeChart('Category-wise inventory', 'Physical units by product category', categories),
    makeChart('Warehouse-wise inventory', 'Physical units by warehouse', warehouseCounts, 'alt'),
    makeChart('Stock movement', 'Movement quantities by type', movementCounts, 'mixed'),
    makeChart('Replenishment overview', 'Requests by current status', replenishmentCounts, 'mixed'),
  ].join('')

  const attention = [
    ...state.alerts.filter((alert) => alert.status !== 'resolved').map((alert) => ({
      severity: alert.severity, title: alert.title, detail: `${alert.id} · ${titleCase(alert.status)}`, page: 'alerts',
    })),
    ...state.receipts.filter((receipt) => receipt.status === 'delayed').map((receipt) => ({
      severity: 'high', title: `Delivery ${receipt.id} is delayed`, detail: `${receipt.supplier} · expected ${date(receipt.expectedDate)}`, page: 'receiving',
    })),
    ...state.replenishments.filter((request) => request.status === 'awaiting-approval').map((request) => ({
      severity: request.priority, title: `${getProduct(request.productId)?.productName || request.productId} replenishment awaiting approval`, detail: `${request.id} · ${number(request.quantity)} units`, page: 'replenishment',
    })),
  ].slice(0, 6)
  document.getElementById('im-attention-list').innerHTML = attention.map((item) => `
    <div class="im-attention-item"><i class="im-severity-dot ${esc(item.severity)}"></i><span class="im-attention-copy"><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span><button class="im-text-button" data-go-page="${esc(item.page)}">View</button></div>`).join('') || '<p class="im-empty">No inventory issues need attention.</p>'
  document.getElementById('im-recent-activity').innerHTML = state.activities.slice(0, 5).map((activity) => `
    <div class="im-recent-item"><span class="im-kpi-icon">◷</span><span class="im-recent-copy"><strong>${esc(activity.action)}${activity.productId ? ` · ${esc(activity.productId)}` : ''}</strong><small>${esc(date(activity.timestamp, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))} · ${esc(activity.user)}</small></span></div>`).join('') || '<p class="im-empty">No recent inventory activity.</p>'
  document.getElementById('im-alert-count').textContent = activeAlerts.length
  document.getElementById('im-unread-count').textContent = state.notifications.filter((item) => !item.read).length
}

function renderInventory() {
  const categories = [...new Set(state.inventory.map((product) => product.category))].sort()
  const categorySelect = document.getElementById('im-inventory-category')
  const existing = categorySelect.value
  categorySelect.innerHTML = '<option value="all">All categories</option>' + categories.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')
  categorySelect.value = categories.includes(existing) ? existing : 'all'
  const filtered = state.inventory.filter((product) => {
    const haystack = `${product.productName} ${product.productId} ${product.sku}`.toLowerCase()
    return (!inventoryFilter.query || haystack.includes(inventoryFilter.query.toLowerCase()))
      && (inventoryFilter.category === 'all' || product.category === inventoryFilter.category)
      && (inventoryFilter.status === 'all' || stockStatus(product) === inventoryFilter.status)
      && (inventoryFilter.warehouse === 'all' || product.warehouse === inventoryFilter.warehouse)
  }).sort((a, b) => {
    if (inventoryFilter.sort === 'quantity-asc') return a.quantity - b.quantity
    if (inventoryFilter.sort === 'quantity-desc') return b.quantity - a.quantity
    if (inventoryFilter.sort === 'updated-desc') return String(b.updatedAt).localeCompare(String(a.updatedAt))
    return a.productName.localeCompare(b.productName)
  })
  const pages = Math.max(1, Math.ceil(filtered.length / inventoryFilter.pageSize))
  inventoryFilter.page = Math.min(inventoryFilter.page, pages)
  const start = (inventoryFilter.page - 1) * inventoryFilter.pageSize
  document.getElementById('im-inventory-result-count').textContent = `${filtered.length} products · page ${inventoryFilter.page} of ${pages}`
  document.getElementById('im-pagination-label').textContent = filtered.length ? `Showing ${start + 1}–${Math.min(start + inventoryFilter.pageSize, filtered.length)} of ${filtered.length}` : 'No products found'
  document.getElementById('im-page-previous').disabled = inventoryFilter.page <= 1
  document.getElementById('im-page-next').disabled = inventoryFilter.page >= pages
  document.getElementById('im-inventory-body').innerHTML = filtered.slice(start, start + inventoryFilter.pageSize).map((product) => `
    <tr><td><button class="im-product-link" data-product-details="${esc(product.productId)}">${esc(product.productName)}</button><small>${esc(product.productId)}</small></td>
      <td>${esc(product.sku)}<small>${esc(product.category)}</small></td><td>${number(product.quantity)} ${esc(product.unit)}</td>
      <td>${number(product.reserved)} ${esc(product.unit)}</td><td>${number(available(product))} ${esc(product.unit)}</td>
      <td>${esc(product.warehouse)}<small>${esc(product.location)}</small></td><td>${number(product.reorderThreshold)} / ${number(product.maxStock)}</td>
      <td><span class="im-status" data-status="${stockStatus(product)}">${titleCase(stockStatus(product))}</span></td><td>${date(product.updatedAt)}</td>
      <td><div class="im-row-actions"><button data-product-details="${esc(product.productId)}">Details</button><button data-new-replenishment="${esc(product.productId)}">Replenish</button><button data-new-adjustment="${esc(product.productId)}">Adjust</button></div></td></tr>`).join('') || '<tr><td colspan="10" class="im-empty">No products match these filters.</td></tr>'
  setKpis('im-inventory-kpis', [
    { label: 'Total units', value: number(state.inventory.reduce((sum, product) => sum + product.quantity, 0)), note: 'Across all SKUs', icon: '▦', page: 'inventory' },
    { label: 'Available', value: number(state.inventory.reduce((sum, product) => sum + available(product), 0)), note: 'After reservations', icon: '✓', page: 'inventory' },
    { label: 'Low stock', value: getStatusCount('low-stock'), note: 'Below reorder level', icon: '!', page: 'inventory', filterKey: 'inventoryStatus', filterValue: 'low-stock' },
    { label: 'Out of stock', value: getStatusCount('out-of-stock'), note: 'No available quantity', icon: '×', page: 'inventory', filterKey: 'inventoryStatus', filterValue: 'out-of-stock' },
  ])
}

function renderReplenishments() {
  const counts = ['awaiting-approval', 'approved', 'ordered', 'received'].map((status) => ({
    label: titleCase(status), value: state.replenishments.filter((item) => item.status === status).length,
  }))
  setKpis('im-replenishment-kpis', counts.map((item) => ({ ...item, note: 'Requests', icon: '↻', page: 'replenishment' })))
  const filtered = state.replenishments.filter((request) => moduleFilters.replenishment === 'all' || request.status === moduleFilters.replenishment)
  document.getElementById('im-replenishment-body').innerHTML = filtered.map((request) => {
    const product = getProduct(request.productId)
    return `<tr><td><strong>${esc(request.id)}</strong><small>${date(request.createdAt)}</small></td><td>${esc(product?.productName || request.productId)}<small>${esc(request.productId)}</small></td>
      <td>${number(product ? available(product) : 0)} / ${number(product?.reorderThreshold)}</td><td>${number(request.quantity)}</td><td>${esc(product?.supplier || '—')}</td>
      <td><span class="im-status" data-status="${esc(request.priority)}">${titleCase(request.priority)}</span></td><td>${date(request.expectedDate)}</td>
      <td><span class="im-status" data-status="${esc(request.status)}">${titleCase(request.status)}</span></td>
      <td><div class="im-row-actions"><button data-product-details="${esc(request.productId)}">Product</button>${request.status === 'awaiting-approval' ? '<span class="im-note">Procurement approval required</span>' : ''}</div></td></tr>`
  }).join('') || '<tr><td colspan="9" class="im-empty">No replenishment requests have been created.</td></tr>'
}

function filteredMovements() {
  return state.movements.filter((movement) => {
    const query = `${movement.id} ${movement.productId} ${movement.productName} ${movement.reference}`.toLowerCase()
    const day = String(movement.date).slice(0, 10)
    return (!movementFilter.query || query.includes(movementFilter.query.toLowerCase()))
      && (movementFilter.type === 'all' || movement.type === movementFilter.type)
      && (movementFilter.warehouse === 'all' || movement.warehouse === movementFilter.warehouse)
      && (!movementFilter.from || day >= movementFilter.from)
      && (!movementFilter.to || day <= movementFilter.to)
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)))
}
function renderMovements() {
  document.getElementById('im-movement-body').innerHTML = filteredMovements().map((movement) => `
    <tr><td><button class="im-product-link" data-movement-details="${esc(movement.id)}">${esc(movement.id)}</button></td><td><button class="im-product-link" data-product-details="${esc(movement.productId)}">${esc(movement.productName)}</button><small>${esc(movement.productId)}</small></td>
      <td>${esc(movement.type)}</td><td>${number(movement.previousQuantity)}</td><td>${movement.quantity > 0 ? '+' : ''}${number(movement.quantity)}</td><td>${number(movement.newQuantity)}</td>
      <td>${esc(movement.source)}<small>→ ${esc(movement.destination)}</small></td><td>${esc(movement.reference)}</td><td>${date(movement.date, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}<small>${esc(movement.performedBy)}</small></td>
      <td><button class="im-product-link" data-movement-details="${esc(movement.id)}">View</button></td></tr>`).join('') || '<tr><td colspan="10" class="im-empty">No movements match these filters.</td></tr>'
}

function renderReceiving() {
  const pending = state.receipts.filter((item) => !['received', 'closed'].includes(item.status)).length
  const delayed = state.receipts.filter((item) => item.status === 'delayed').length
  const accepted = state.receipts.reduce((sum, item) => sum + item.acceptedQuantity, 0)
  setKpis('im-receiving-kpis', [
    { label: 'Pending receipts', value: pending, note: 'Awaiting inspection', icon: '⇣', page: 'receiving' },
    { label: 'Delayed deliveries', value: delayed, note: 'Past expected date', icon: '!', page: 'receiving' },
    { label: 'Accepted units', value: number(accepted), note: 'Added to inventory', icon: '✓', page: 'receiving' },
    { label: 'Expected today', value: state.receipts.filter((item) => item.expectedDate === '2026-10-30' && !['received', 'closed'].includes(item.status)).length, note: 'Scheduled deliveries', icon: '◷', page: 'receiving' },
  ])
  const filtered = state.receipts.filter((receipt) => moduleFilters.receiving === 'all'
    || (moduleFilters.receiving === 'pending' ? !['received', 'closed'].includes(receipt.status) : receipt.status === moduleFilters.receiving))
  document.getElementById('im-receiving-body').innerHTML = filtered.map((receipt) => {
    const product = getProduct(receipt.productId)
    return `<tr><td><strong>${esc(receipt.id)}</strong><small>${esc(receipt.purchaseOrder)}</small></td><td>${esc(receipt.supplier)}</td><td>${esc(product?.productName || receipt.productId)}<small>${esc(receipt.productId)}</small></td>
      <td>${number(receipt.expectedQuantity)}</td><td>${number(receipt.receivedQuantity)}</td><td>${number(receipt.acceptedQuantity)} accepted<small>${number(receipt.damagedQuantity)} damaged</small></td>
      <td>${date(receipt.expectedDate)}${receipt.actualDate ? `<small>Actual ${date(receipt.actualDate)}</small>` : ''}</td><td>${titleCase(receipt.inspection)}</td><td><span class="im-status" data-status="${esc(receipt.status)}">${titleCase(receipt.status)}</span></td>
      <td>${['received', 'closed'].includes(receipt.status) ? '—' : `<button class="im-button im-button-light" data-receive="${esc(receipt.id)}">Inspect &amp; receive</button>`}</td></tr>`
  }).join('') || '<tr><td colspan="10" class="im-empty">No incoming deliveries are recorded.</td></tr>'
}

function renderAdjustments() {
  const filtered = state.adjustments.filter((item) => moduleFilters.adjustments === 'all' || item.status === moduleFilters.adjustments)
  document.getElementById('im-adjustment-body').innerHTML = filtered.map((item) => {
    const product = getProduct(item.productId)
    return `<tr><td><strong>${esc(item.id)}</strong><small>${date(item.createdAt)}</small></td><td>${esc(product?.productName || item.productId)}<small>${esc(item.productId)}</small></td>
      <td>${number(item.systemQuantity)}</td><td>${number(item.actualQuantity)}</td><td>${item.actualQuantity - item.systemQuantity > 0 ? '+' : ''}${number(item.actualQuantity - item.systemQuantity)}</td>
      <td>${esc(item.reason)}</td><td>${esc(item.requestedBy)}</td><td><span class="im-status" data-status="${esc(item.status)}">${titleCase(item.status)}</span></td>
      <td>${item.history.map((line) => esc(line)).join('<br>')}</td></tr>`
  }).join('') || '<tr><td colspan="9" class="im-empty">No adjustment requests.</td></tr>'
}

function renderCounts() {
  const counted = state.counts.reduce((sum, count) => sum + count.productsCounted, 0)
  const matched = state.counts.reduce((sum, count) => sum + count.productsCounted - count.discrepancies, 0)
  const accuracy = counted ? (matched / counted * 100).toFixed(1) : '—'
  setKpis('im-count-kpis', [
    { label: 'Stock accuracy', value: `${accuracy}${counted ? '%' : ''}`, note: 'Matched items / counted items', icon: '✓', page: 'counts' },
    { label: 'Count sessions', value: state.counts.length, note: 'Completed and in progress', icon: '☷', page: 'counts' },
    { label: 'Products counted', value: number(counted), note: 'Across count sessions', icon: '▤', page: 'counts' },
    { label: 'Discrepancies', value: state.counts.reduce((sum, count) => sum + count.discrepancies, 0), note: 'Adjustment approval may be needed', icon: '!', page: 'counts', filterKey: 'counts', filterValue: 'discrepancies' },
  ])
  const filtered = state.counts.filter((count) => moduleFilters.counts === 'all'
    || (moduleFilters.counts === 'discrepancies' ? count.discrepancies > 0 : count.discrepancies === 0))
  document.getElementById('im-count-body').innerHTML = filtered.map((count) => `
    <tr><td><strong>${esc(count.id)}</strong></td><td>${esc(count.warehouse)}<small>${esc(count.location)}</small></td>
      <td>${count.productId ? `${esc(getProduct(count.productId)?.productName || count.productId)}<small>${esc(count.productId)}</small>` : '—'}</td>
      <td>${count.systemQuantity === undefined ? '—' : `${number(count.systemQuantity)} / ${number(count.actualQuantity)}`}</td>
      <td>${number(count.productsCounted)}</td><td>${number(count.discrepancies)}</td><td>${count.accuracy.toFixed(1)}%</td><td>${esc(count.assignedTo)}</td><td>${date(count.date)}</td><td><span class="im-status" data-status="${esc(count.status)}">${titleCase(count.status)}</span></td></tr>`).join('')
}

function renderSuppliers() {
  const suppliers = [...new Set(state.inventory.map((item) => item.supplier))].sort()
  document.getElementById('im-supplier-body').innerHTML = suppliers.map((supplier, index) => {
    const supplied = state.inventory.filter((item) => item.supplier === supplier)
    const activePOs = state.purchaseOrders.filter((po) => po.supplier === supplier && !['received', 'closed'].includes(po.status)).length
    return `<tr><td>SUP-${String(index + 1).padStart(3, '0')}</td><td><strong>${esc(supplier)}</strong><small>${esc(supplier.toLowerCase().replaceAll(' ', '.'))}@example.demo</small></td>
      <td>${supplied.length} SKUs<small>${supplied.map((item) => esc(item.sku)).join(', ')}</small></td><td>${[5, 7, 9, 6, 8][index % 5]} days</td>
      <td>${index === 2 ? '88%' : index === 1 ? '94%' : '96%'}</td><td>${activePOs}</td><td><span class="im-status" data-status="active">Active</span></td></tr>`
  }).join('')
  document.getElementById('im-po-body').innerHTML = state.purchaseOrders.map((po) => {
    const product = getProduct(po.productId)
    return `<tr><td><strong>${esc(po.id)}</strong></td><td>${esc(po.supplier)}</td><td>${esc(product?.productName || po.productId)}<small>${esc(po.productId)}</small></td>
      <td>${number(po.ordered)}</td><td>${number(po.received)}</td><td>${number(Math.max(0, po.ordered - po.received))}</td><td>${date(po.orderDate)}</td><td>${date(po.expectedDate)}</td><td><span class="im-status" data-status="${esc(po.status)}">${titleCase(po.status)}</span></td></tr>`
  }).join('')
}

function renderAlerts() {
  const severity = document.getElementById('im-alert-severity').value
  const status = document.getElementById('im-alert-status').value
  const filtered = state.alerts.filter((alert) => (severity === 'all' || alert.severity === severity) && (status === 'all' || alert.status === status))
  document.getElementById('im-alert-list').innerHTML = filtered.map((alert) => {
    const product = getProduct(alert.productId)
    return `<article class="im-alert-card" data-severity="${esc(alert.severity)}"><div class="im-alert-top"><h3>${esc(alert.title)}</h3><span class="im-status" data-status="${esc(alert.status)}">${titleCase(alert.status)}</span></div>
      <p>${esc(alert.description)}</p><div class="im-alert-meta"><span>${esc(alert.id)}</span><span>${titleCase(alert.severity)}</span><span>${date(alert.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><span>${esc(alert.assignedTo || 'Unassigned')}</span></div>
      ${product ? `<p>Product: <button class="im-product-link" data-product-details="${esc(product.productId)}">${esc(product.productName)}</button></p>` : ''}
      ${alert.notes?.length ? `<p>${alert.notes.map((note) => esc(note)).join('<br>')}</p>` : ''}
      <div class="im-row-actions">${alert.status === 'open' ? `<button data-alert-action="acknowledge" data-alert-id="${esc(alert.id)}">Acknowledge</button>` : ''}
      ${['open', 'acknowledged'].includes(alert.status) ? `<button data-alert-action="investigate" data-alert-id="${esc(alert.id)}">Start investigation</button>` : ''}
      ${alert.status !== 'resolved' ? `<button data-alert-action="resolve" data-alert-id="${esc(alert.id)}">Resolve</button>` : ''}</div></article>`
  }).join('') || '<p class="im-empty">No inventory alerts match these filters.</p>'
}

function reportProducts() {
  const warehouse = document.getElementById('im-report-warehouse').value
  const category = document.getElementById('im-report-category').value
  const supplier = document.getElementById('im-report-supplier').value
  const status = document.getElementById('im-report-status').value
  const from = document.getElementById('im-report-from').value
  const to = document.getElementById('im-report-to').value
  return state.inventory.filter((product) =>
    (warehouse === 'all' || product.warehouse === warehouse)
    && (category === 'all' || product.category === category)
    && (supplier === 'all' || product.supplier === supplier)
    && (status === 'all' || stockStatus(product) === status)
    && (!from || String(product.updatedAt).slice(0, 10) >= from)
    && (!to || String(product.updatedAt).slice(0, 10) <= to))
}
function renderReport() {
  const type = document.getElementById('im-report-type').value
  const categorySelect = document.getElementById('im-report-category')
  const supplierSelect = document.getElementById('im-report-supplier')
  const categoryValue = categorySelect.value, supplierValue = supplierSelect.value
  const categories = [...new Set(state.inventory.map((product) => product.category))].sort()
  const suppliers = [...new Set(state.inventory.map((product) => product.supplier))].sort()
  categorySelect.innerHTML = '<option value="all">All categories</option>' + categories.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('')
  supplierSelect.innerHTML = '<option value="all">All suppliers</option>' + suppliers.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('')
  categorySelect.value = categories.includes(categoryValue) ? categoryValue : 'all'
  supplierSelect.value = suppliers.includes(supplierValue) ? supplierValue : 'all'
  const selectedProducts = reportProducts()
  const currentUnits = selectedProducts.reduce((sum, product) => sum + product.quantity, 0)
  const availableUnits = selectedProducts.reduce((sum, product) => sum + available(product), 0)
  const summary = [
    ['Products', selectedProducts.length],
    ['Physical units', number(currentUnits)],
    ['Available units', number(availableUnits)],
    ['Low / out of stock', selectedProducts.filter((product) => ['low-stock', 'out-of-stock'].includes(stockStatus(product))).length],
  ]
  document.getElementById('im-report-summary').innerHTML = summary.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')
  const chartData = [
    makeChart('Stock by category', 'Physical quantity', [...new Set(selectedProducts.map((item) => item.category))].map((label) => ({ label, value: selectedProducts.filter((item) => item.category === label).reduce((sum, item) => sum + item.quantity, 0) }))),
    makeChart('Stock status', 'Product count', ['in-stock', 'low-stock', 'out-of-stock', 'overstock'].map((label) => ({ label: titleCase(label), value: selectedProducts.filter((item) => stockStatus(item) === label).length })), 'mixed'),
  ]
  document.getElementById('im-report-charts').innerHTML = chartData.join('')
  let headings = ['Product ID', 'Product', 'Category', 'Warehouse', 'Quantity', 'Available', 'Status']
  let rows = selectedProducts.map((product) => [product.productId, product.productName, product.category, product.warehouse, product.quantity, available(product), titleCase(stockStatus(product))])
  if (type === 'low-stock' || type === 'out-of-stock' || type === 'overstock') {
    rows = selectedProducts.filter((product) => stockStatus(product) === type).map((product) => [product.productId, product.productName, product.category, product.warehouse, product.quantity, available(product), titleCase(stockStatus(product))])
  } else if (type === 'movements') {
    headings = ['Movement ID', 'Product', 'Type', 'Previous', 'Change', 'New quantity', 'Reference']
    rows = state.movements.filter((item) => (!document.getElementById('im-report-from').value || String(item.date).slice(0, 10) >= document.getElementById('im-report-from').value)
      && (!document.getElementById('im-report-to').value || String(item.date).slice(0, 10) <= document.getElementById('im-report-to').value))
      .map((item) => [item.id, item.productName, item.type, item.previousQuantity, item.quantity, item.newQuantity, item.reference])
  } else if (type === 'accuracy') {
    headings = ['Count ID', 'Warehouse', 'Location', 'Products counted', 'Discrepancies', 'Accuracy', 'Count date']
    rows = state.counts.filter((item) => (!document.getElementById('im-report-from').value || String(item.date).slice(0, 10) >= document.getElementById('im-report-from').value)
      && (!document.getElementById('im-report-to').value || String(item.date).slice(0, 10) <= document.getElementById('im-report-to').value))
      .map((item) => [item.id, item.warehouse, item.location, item.productsCounted, item.discrepancies, `${item.accuracy}%`, date(item.date)])
  } else if (type === 'replenishment') {
    headings = ['Request ID', 'Product', 'Suggested quantity', 'Priority', 'Status', 'Expected']
    rows = state.replenishments.filter((item) => (!document.getElementById('im-report-from').value || String(item.createdAt).slice(0, 10) >= document.getElementById('im-report-from').value)
      && (!document.getElementById('im-report-to').value || String(item.createdAt).slice(0, 10) <= document.getElementById('im-report-to').value))
      .map((item) => [item.id, getProduct(item.productId)?.productName || item.productId, item.quantity, item.priority, item.status, date(item.expectedDate)])
  } else if (type === 'valuation') {
    headings = ['Product ID', 'Product', 'Quantity', 'Unit cost', 'Valuation']
    rows = []
  }
  document.getElementById('im-report-head').innerHTML = `<tr>${headings.map((item) => `<th>${esc(item)}</th>`).join('')}</tr>`
  document.getElementById('im-report-body').innerHTML = rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headings.length}" class="im-empty">${type === 'valuation' ? 'Unit-cost data is not available; no valuation is calculated.' : 'No records for this report.'}</td></tr>`
}

function renderActivity() {
  document.getElementById('im-activity-body').innerHTML = state.activities.map((item) => `
    <tr><td>${date(item.timestamp, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td>${esc(item.user)}</td><td>${esc(item.action)}</td>
      <td>${esc(item.productId || '—')}</td><td>${esc(item.previous || '—')}</td><td>${esc(item.next || '—')}</td><td>${esc(item.reference || '—')}</td></tr>`).join('')
}
function renderNotifications() {
  const unread = state.notifications.filter((item) => !item.read).length
  document.getElementById('im-unread-count').textContent = unread
  document.getElementById('im-notification-list').innerHTML = state.notifications.map((item) => `
    <div class="im-attention-item"><i class="im-severity-dot ${item.read ? 'low' : 'high'}"></i><span class="im-attention-copy"><strong>${esc(item.title)}</strong><small>${esc(item.description)} · ${date(item.date, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span><button class="im-text-button" data-notification-page="${esc(item.page)}" data-notification-id="${esc(item.id)}">${item.read ? 'View' : 'Open'}</button></div>`).join('') || '<p class="im-empty">No inventory notifications.</p>'
}

function renderAll() {
  syncStockAlerts()
  syncReceiptAlerts()
  renderOverview()
  renderInventory()
  renderReplenishments()
  renderMovements()
  renderReceiving()
  renderAdjustments()
  renderCounts()
  renderSuppliers()
  renderAlerts()
  renderReport()
  renderActivity()
  renderNotifications()
  persist()
}

function field(label, name, input, full = false) {
  return `<label class="${full ? 'full' : ''}">${esc(label)}${input}</label>`
}
const productOptions = (selected = '') => state.inventory.map((product) =>
  `<option value="${esc(product.productId)}" ${product.productId === selected ? 'selected' : ''}>${esc(product.productName)} · ${esc(product.productId)}</option>`).join('')
function openDialog(title, content, submitLabel, onSubmit) {
  const dialog = document.getElementById('im-dialog')
  const form = document.getElementById('im-dialog-form')
  document.getElementById('im-dialog-title').textContent = title
  document.getElementById('im-dialog-content').innerHTML = `<div class="im-dialog-fields">${content}</div>`
  document.getElementById('im-dialog-submit').textContent = submitLabel
  document.getElementById('im-dialog-error').textContent = ''
  form.onsubmit = (event) => {
    event.preventDefault()
    const result = onSubmit(new FormData(form))
    if (result !== false) dialog.close()
  }
  dialog.showModal()
}
document.getElementById('im-dialog-close').addEventListener('click', () => document.getElementById('im-dialog').close())
document.getElementById('im-dialog-cancel').addEventListener('click', () => document.getElementById('im-dialog').close())
document.getElementById('im-detail-close').addEventListener('click', () => document.getElementById('im-detail-dialog').close())

function openProductDetails(id) {
  const product = getProduct(id)
  if (!product) return
  const history = state.movements.filter((item) => item.productId === id).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8)
  const linkedOrders = state.purchaseOrders.filter((item) => item.productId === id)
  const relatedAlerts = state.alerts.filter((item) => item.productId === id)
  document.getElementById('im-detail-eyebrow').textContent = 'PRODUCT DETAILS'
  document.getElementById('im-detail-title').textContent = product.productName
  document.getElementById('im-detail-content').innerHTML = `
    <div class="im-detail-grid">
      <div><span>Product ID</span><strong>${esc(product.productId)}</strong></div><div><span>SKU / Category</span><strong>${esc(product.sku)} · ${esc(product.category)}</strong></div>
      <div><span>Stock status</span><strong>${titleCase(stockStatus(product))}</strong></div><div><span>Total quantity</span><strong>${number(product.quantity)} ${esc(product.unit)}</strong></div>
      <div><span>Reserved / Available</span><strong>${number(product.reserved)} / ${number(available(product))}</strong></div><div><span>Reorder / Maximum</span><strong>${number(product.reorderThreshold)} / ${number(product.maxStock)}</strong></div>
      <div><span>Warehouse / Location</span><strong>${esc(product.warehouse)} · ${esc(product.location)}</strong></div><div><span>Supplier</span><strong>${esc(product.supplier)}</strong></div>
    </div>
    <h3>Incoming purchase orders</h3>${linkedOrders.length ? linkedOrders.map((po) => `<div class="im-detail-movement"><span>${esc(po.id)} · ${titleCase(po.status)}</span><strong>${number(po.ordered - po.received)} outstanding</strong></div>`).join('') : '<p class="im-empty">No incoming purchase orders.</p>'}
    <h3>Related shipments</h3>${shipmentItems.filter((shipment) => shipment.productIds.includes(id)).map((shipment) => `<div class="im-detail-movement"><span>${esc(shipment.id)} · ${esc(shipment.destination)}</span><strong>${titleCase(shipment.status)}</strong></div>`).join('') || '<p class="im-empty">No related shipments.</p>'}
    <h3>Inventory alerts</h3>${relatedAlerts.length ? relatedAlerts.map((alert) => `<div class="im-detail-movement"><span>${esc(alert.title)} · ${titleCase(alert.status)}</span><strong>${titleCase(alert.severity)}</strong></div>`).join('') : '<p class="im-empty">No product alerts.</p>'}
    <h3>Stock movement history</h3><div class="im-detail-history">${history.map((item) => `<div class="im-detail-movement"><span>${date(item.date)} · ${esc(item.type)} · ${esc(item.reference)}</span><strong>${item.quantity > 0 ? '+' : ''}${number(item.quantity)}</strong></div>`).join('') || '<p class="im-empty">No stock movements.</p>'}</div>
    <div class="im-button-row"><button type="button" class="im-button" data-new-replenishment="${esc(id)}">Request replenishment</button><button type="button" class="im-button im-button-light" data-new-adjustment="${esc(id)}">Record adjustment</button><button type="button" class="im-button im-button-light" data-edit-product="${esc(id)}">Edit product</button></div>`
  const dialog = document.getElementById('im-detail-dialog')
  if (!dialog.open) dialog.showModal()
}

function openMovementDetails(id) {
  const movement = state.movements.find((item) => item.id === id)
  if (!movement) return
  document.getElementById('im-detail-eyebrow').textContent = 'MOVEMENT DETAILS'
  document.getElementById('im-detail-title').textContent = movement.id
  document.getElementById('im-detail-content').innerHTML = `
    <div class="im-detail-grid">
      <div><span>Product</span><strong>${esc(movement.productName)} · ${esc(movement.productId)}</strong></div>
      <div><span>Movement type</span><strong>${esc(movement.type)}</strong></div>
      <div><span>Quantity change</span><strong>${movement.quantity > 0 ? '+' : ''}${number(movement.quantity)}</strong></div>
      <div><span>Previous / new on-hand</span><strong>${number(movement.previousQuantity)} / ${number(movement.newQuantity)}</strong></div>
      <div><span>Source</span><strong>${esc(movement.source)}</strong></div><div><span>Destination</span><strong>${esc(movement.destination)}</strong></div>
      <div><span>Reference</span><strong>${esc(movement.reference)}</strong></div><div><span>Date &amp; time</span><strong>${date(movement.date, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></div>
      <div><span>Performed by</span><strong>${esc(movement.performedBy)}</strong></div>
    </div><button type="button" class="im-product-link" data-product-details="${esc(movement.productId)}">Open product record →</button>`
  const dialog = document.getElementById('im-detail-dialog')
  if (!dialog.open) dialog.showModal()
}

function openNotificationRecord(recordId) {
  const product = getProduct(recordId)
  if (product) { openProductDetails(recordId); return }
  const receipt = state.receipts.find((item) => item.id === recordId)
  const alert = state.alerts.find((item) => item.id === recordId)
  const adjustment = state.adjustments.find((item) => item.id === recordId)
  const request = state.replenishments.find((item) => item.id === recordId)
  const count = state.counts.find((item) => item.id === recordId)
  let title = ''
  let eyebrow = 'RELATED INVENTORY RECORD'
  let content = ''
  if (receipt) {
    const item = getProduct(receipt.productId)
    title = receipt.id
    eyebrow = 'RECEIVING RECORD'
    content = `<div class="im-detail-grid"><div><span>Purchase order</span><strong>${esc(receipt.purchaseOrder)}</strong></div><div><span>Supplier</span><strong>${esc(receipt.supplier)}</strong></div><div><span>Product</span><strong>${esc(item?.productName || receipt.productId)}</strong></div><div><span>Expected</span><strong>${number(receipt.expectedQuantity)}</strong></div><div><span>Accepted / damaged</span><strong>${number(receipt.acceptedQuantity)} / ${number(receipt.damagedQuantity)}</strong></div><div><span>Status</span><strong>${titleCase(receipt.status)}</strong></div></div>${!['received', 'closed'].includes(receipt.status) ? `<button type="button" class="im-button" data-receive="${esc(receipt.id)}">Inspect &amp; receive</button>` : ''}`
  } else if (alert) {
    title = alert.title
    eyebrow = 'INVENTORY ALERT'
    content = `<div class="im-detail-grid"><div><span>Alert ID</span><strong>${esc(alert.id)}</strong></div><div><span>Severity</span><strong>${titleCase(alert.severity)}</strong></div><div><span>Status</span><strong>${titleCase(alert.status)}</strong></div><div><span>Created</span><strong>${date(alert.createdAt)}</strong></div><div><span>Assigned to</span><strong>${esc(alert.assignedTo || 'Unassigned')}</strong></div></div><p>${esc(alert.description)}</p>${alert.notes?.map((note) => `<p class="im-note">${esc(note)}</p>`).join('') || ''}<div class="im-row-actions">${alert.status === 'open' ? `<button data-alert-action="acknowledge" data-alert-id="${esc(alert.id)}">Acknowledge</button>` : ''}${['open', 'acknowledged'].includes(alert.status) ? `<button data-alert-action="investigate" data-alert-id="${esc(alert.id)}">Investigate</button>` : ''}${alert.status !== 'resolved' ? `<button data-alert-action="resolve" data-alert-id="${esc(alert.id)}">Resolve</button>` : ''}</div>`
  } else if (adjustment) {
    const item = getProduct(adjustment.productId)
    title = adjustment.id
    eyebrow = 'STOCK ADJUSTMENT'
    content = `<div class="im-detail-grid"><div><span>Product</span><strong>${esc(item?.productName || adjustment.productId)}</strong></div><div><span>System / actual</span><strong>${number(adjustment.systemQuantity)} / ${number(adjustment.actualQuantity)}</strong></div><div><span>Difference</span><strong>${adjustment.actualQuantity - adjustment.systemQuantity}</strong></div><div><span>Reason</span><strong>${esc(adjustment.reason)}</strong></div><div><span>Status</span><strong>${titleCase(adjustment.status)}</strong></div><div><span>Requested by</span><strong>${esc(adjustment.requestedBy)}</strong></div></div><p class="im-note">${adjustment.history.map(esc).join('<br>')}</p>`
  } else if (request) {
    const item = getProduct(request.productId)
    title = request.id
    eyebrow = 'REPLENISHMENT REQUEST'
    content = `<div class="im-detail-grid"><div><span>Product</span><strong>${esc(item?.productName || request.productId)}</strong></div><div><span>Suggested supplier</span><strong>${esc(item?.supplier || '—')}</strong></div><div><span>Quantity</span><strong>${number(request.quantity)}</strong></div><div><span>Priority</span><strong>${titleCase(request.priority)}</strong></div><div><span>Status</span><strong>${titleCase(request.status)}</strong></div><div><span>Expected delivery</span><strong>${date(request.expectedDate)}</strong></div></div><p class="im-permission-note">Procurement approval is required before a purchase order can be created.</p>`
  } else if (count) {
    const item = getProduct(count.productId)
    title = count.id
    eyebrow = 'CYCLE COUNT'
    content = `<div class="im-detail-grid"><div><span>Warehouse / location</span><strong>${esc(count.warehouse)} · ${esc(count.location)}</strong></div><div><span>Product</span><strong>${esc(item?.productName || count.productId || 'Multiple items')}</strong></div><div><span>System / actual</span><strong>${count.systemQuantity === undefined ? '—' : `${number(count.systemQuantity)} / ${number(count.actualQuantity)}`}</strong></div><div><span>Discrepancies</span><strong>${number(count.discrepancies)}</strong></div><div><span>Accuracy</span><strong>${count.accuracy.toFixed(1)}%</strong></div><div><span>Count date</span><strong>${date(count.date)}</strong></div></div>`
  } else return
  document.getElementById('im-detail-eyebrow').textContent = eyebrow
  document.getElementById('im-detail-title').textContent = title
  document.getElementById('im-detail-content').innerHTML = content
  const dialog = document.getElementById('im-detail-dialog')
  if (!dialog.open) dialog.showModal()
}

function recordMovement() {
  openDialog('Record stock movement', `
    ${field('Product', 'productId', `<select name="productId" required>${productOptions()}</select>`, true)}
    ${field('Movement type', 'type', '<select name="type"><option>Dispatched</option><option>Reserved</option><option>Released</option><option>Returned</option><option>Damaged</option><option>Transferred</option></select>')}
    ${field('Quantity', 'quantity', '<input name="quantity" type="number" min="1" required>')}
    ${field('Source location', 'source', '<input name="source" placeholder="Warehouse / aisle / bin" required>')}
    ${field('Destination location', 'destination', '<input name="destination" placeholder="Warehouse / aisle / bin" required>')}
    ${field('Related reference', 'reference', '<input name="reference" placeholder="Order, receipt, or transfer reference">')}
    <p class="im-permission-note full">Reserved and released movements adjust reserved stock without changing physical units. Transfers are recorded within the current demo inventory location; a destination warehouse balance is not modelled.</p>`,
  'Record movement', (data) => {
    const product = getProduct(String(data.get('productId')))
    const type = String(data.get('type'))
    const quantity = Number(data.get('quantity'))
    if (!product || !Number.isInteger(quantity) || quantity <= 0) {
      document.getElementById('im-dialog-error').textContent = 'Select a product and enter a positive whole-number quantity.'
      return false
    }
    if (['Dispatched', 'Reserved', 'Damaged', 'Transferred'].includes(type) && quantity > available(product)) {
      document.getElementById('im-dialog-error').textContent = `Only ${number(available(product))} units are available for this movement.`
      return false
    }
    if (type === 'Released' && quantity > product.reserved) {
      document.getElementById('im-dialog-error').textContent = `Only ${number(product.reserved)} units are currently reserved.`
      return false
    }
    const source = String(data.get('source')).trim()
    const destination = String(data.get('destination')).trim()
    const reference = String(data.get('reference')).trim() || `MOV-${Date.now().toString().slice(-6)}`
    const before = product.quantity
    const movementReservedBefore = product.reserved
    let delta = 0
    if (type === 'Dispatched' || type === 'Damaged') delta = -quantity
    if (type === 'Returned') delta = quantity
    if (type === 'Reserved') product.reserved += quantity
    if (type === 'Released') product.reserved -= quantity
    if (delta) pushMovement(product, type, delta, reference, source, destination)
    else {
      state.movements.unshift({
        id: `MOV-${Date.now()}`, productId: product.productId, productName: product.productName,
        type, previousQuantity: before, quantity: type === 'Reserved' ? quantity : type === 'Released' ? -quantity : quantity,
        newQuantity: product.quantity, source, destination, reference, date: new Date().toISOString(),
        performedBy: settings.displayName, warehouse: product.warehouse,
      })
      product.updatedAt = new Date().toISOString()
    }
    if (type === 'Damaged') product.damaged += quantity
    const previous = ['Reserved', 'Released'].includes(type) ? movementReservedBefore : before
    const next = ['Reserved', 'Released'].includes(type) ? product.reserved : product.quantity
    addActivity(`Stock ${type.toLowerCase()}`, product, previous, next, reference)
    if (type === 'Damaged') {
      state.alerts.unshift({
        id: `IAL-DAMAGE-${Date.now()}`, productId: product.productId, type: 'damaged',
        severity: 'medium', title: `Damaged inventory recorded for ${product.productName}`,
        description: `${number(quantity)} units recorded as damaged. Reference ${reference}.`,
        status: 'open', createdAt: new Date().toISOString(), assignedTo: settings.displayName, notes: [],
      })
      addNotification('Damaged inventory recorded', `${product.productName} · ${number(quantity)} units`, 'alerts', product.productId)
    }
    renderAll()
  })
}

function editProduct(productId) {
  const product = getProduct(productId)
  if (!product) return
  document.getElementById('im-detail-dialog').close()
  openDialog(`Edit ${product.productName}`, `
    ${field('Product name', 'productName', `<input name="productName" value="${esc(product.productName)}" required>`, true)}
    ${field('SKU', 'sku', `<input name="sku" value="${esc(product.sku)}" required>`)}
    ${field('Category', 'category', `<input name="category" value="${esc(product.category)}" required>`)}
    ${field('Storage location', 'location', `<input name="location" value="${esc(product.location)}" required>`)}
    ${field('Reorder level', 'reorderThreshold', `<input name="reorderThreshold" type="number" min="0" value="${product.reorderThreshold}" required>`)}
    ${field('Maximum stock', 'maxStock', `<input name="maxStock" type="number" min="1" value="${product.maxStock}" required>`)}
    <p class="im-permission-note full">Quantity and reserved stock are not editable here. Submit an adjustment request for physical count corrections.</p>`,
  'Save product', (data) => {
    const reorder = Number(data.get('reorderThreshold'))
    const max = Number(data.get('maxStock'))
    const name = String(data.get('productName')).trim()
    const sku = String(data.get('sku')).trim()
    if (!name || !sku || !Number.isInteger(reorder) || reorder < 0 || !Number.isInteger(max) || max <= 0 || max < reorder) {
      document.getElementById('im-dialog-error').textContent = 'Enter a name and SKU; maximum stock must be a positive whole number at least as large as the reorder level.'
      return false
    }
    product.productName = name
    product.sku = sku
    product.category = String(data.get('category')).trim()
    product.location = String(data.get('location')).trim()
    product.reorderThreshold = reorder
    product.maxStock = max
    product.updatedAt = new Date().toISOString()
    addActivity('Product information updated', product, '', '', product.productId)
    renderAll()
  })
}

function createReplenishment(productId = '') {
  document.getElementById('im-detail-dialog').close()
  const product = getProduct(productId) || state.inventory.find((item) => ['low-stock', 'out-of-stock'].includes(stockStatus(item))) || state.inventory[0]
  const suggested = product ? Math.max(0, product.maxStock - product.quantity) : 0
  openDialog('Request stock replenishment', `
    ${field('Product', 'productId', `<select name="productId" required>${productOptions(product.productId)}</select>`, true)}
    ${field('Requested quantity', 'quantity', `<input name="quantity" type="number" min="1" value="${suggested}" required>`)}
    ${field('Priority', 'priority', '<select name="priority"><option value="critical">Critical</option><option value="high" selected>High</option><option value="medium">Medium</option><option value="low">Low</option></select>')}
    ${field('Expected delivery', 'expectedDate', '<input name="expectedDate" type="date" required>')}
    ${field('Notes for Procurement', 'notes', '<textarea name="notes" placeholder="Reason or delivery context"></textarea>', true)}
    <p class="im-permission-note full">This request is submitted for Procurement approval. It does not create a purchase order.</p>`,
  'Submit request', (data) => {
    const selected = getProduct(String(data.get('productId')))
    const quantity = Number(data.get('quantity'))
    if (!selected || !Number.isInteger(quantity) || quantity <= 0) {
      document.getElementById('im-dialog-error').textContent = 'Select a product and enter a positive whole-number quantity.'
      return false
    }
    const request = {
      id: `REP-${Date.now().toString().slice(-6)}`, productId: selected.productId, quantity,
      priority: String(data.get('priority')), expectedDate: String(data.get('expectedDate')) || '',
      status: 'awaiting-approval', createdAt: new Date().toISOString(), purchaseOrder: '',
    }
    state.replenishments.unshift(request)
    addActivity('Replenishment request submitted', selected, '', quantity, request.id)
    addNotification('Replenishment submitted', `${selected.productName} · waiting for Procurement approval.`, 'replenishment', request.id)
    renderAll()
  })
}

function createAdjustment(productId = '') {
  document.getElementById('im-detail-dialog').close()
  const product = getProduct(productId) || state.inventory[0]
  openDialog('Submit stock adjustment', `
    ${field('Product', 'productId', `<select name="productId" required>${productOptions(product.productId)}</select>`, true)}
    ${field('Verified physical quantity', 'actualQuantity', `<input name="actualQuantity" type="number" min="0" value="${product.quantity}" required>`)}
    ${field('Reason', 'reason', '<select name="reason" required><option>Damaged products</option><option>Missing products</option><option>Cycle-count discrepancy</option><option>Incorrect recorded quantity</option><option>Expired goods</option><option>Data-entry correction</option></select>')}
    ${field('Investigation notes', 'notes', '<textarea name="notes" placeholder="Describe the verification"></textarea>', true)}
    <p class="im-permission-note full">Stock will remain unchanged until an authorised approver approves this request.</p>`,
  'Submit for approval', (data) => {
    const selected = getProduct(String(data.get('productId')))
    const actual = Number(data.get('actualQuantity'))
    if (!selected || !Number.isInteger(actual) || actual < 0) {
      document.getElementById('im-dialog-error').textContent = 'Enter a valid non-negative whole-number physical quantity.'
      return false
    }
    const adjustment = {
      id: `ADJ-${Date.now().toString().slice(-6)}`, productId: selected.productId, systemQuantity: selected.quantity,
      actualQuantity: actual, reason: String(data.get('reason')), requestedBy: settings.displayName,
      status: 'pending-approval', createdAt: new Date().toISOString(), history: ['Adjustment submitted; awaiting authorised approval.'],
    }
    state.adjustments.unshift(adjustment)
    addActivity('Stock adjustment submitted', selected, selected.quantity, actual, adjustment.id)
    addNotification('Adjustment submitted for approval', `${selected.productName} · ${adjustment.id}`, 'adjustments', adjustment.id)
    renderAll()
  })
}

function receiveDelivery(id) {
  const receipt = state.receipts.find((item) => item.id === id)
  if (!receipt) return
  document.getElementById('im-detail-dialog').close()
  const remaining = Math.max(0, receipt.expectedQuantity - receipt.receivedQuantity)
  openDialog(`Inspect delivery ${id}`, `
    ${field('Purchase order', 'purchaseOrder', `<input name="purchaseOrder" value="${esc(receipt.purchaseOrder)}" readonly>`)}
    ${field('Supplier', 'supplier', `<input name="supplier" value="${esc(receipt.supplier)}" readonly>`)}
    ${field('Expected quantity', 'expected', `<input name="expected" value="${remaining}" readonly>`)}
    ${field('Quantity physically received', 'received', `<input name="received" type="number" min="0" max="${remaining}" value="${remaining}" required>`)}
    ${field('Damaged / rejected quantity', 'damaged', '<input name="damaged" type="number" min="0" value="0" required>')}
    ${field('Inspection', 'inspection', '<select name="inspection" required><option value="passed">Passed</option><option value="partial">Partial / discrepancy</option><option value="failed">Failed</option></select>')}
    <p class="im-permission-note full">Accepted stock is calculated as received minus damaged/rejected quantity. Only accepted units update inventory.</p>`,
  'Confirm receipt', (data) => {
    const received = Number(data.get('received'))
    const damaged = Number(data.get('damaged'))
    const inspection = String(data.get('inspection'))
    const expectedRemaining = receipt.expectedQuantity - receipt.receivedQuantity
    if (!Number.isInteger(received) || !Number.isInteger(damaged) || received < 0 || received > expectedRemaining || damaged < 0 || damaged > received) {
      document.getElementById('im-dialog-error').textContent = 'Received must be within the remaining expected quantity, and damaged quantity cannot exceed received.'
      return false
    }
    if (inspection === 'failed' && received > damaged) {
      document.getElementById('im-dialog-error').textContent = 'A failed inspection cannot accept stock. Mark all received units as damaged/rejected or record a partial inspection.'
      return false
    }
    if (received === 0) {
      document.getElementById('im-dialog-error').textContent = 'Enter a positive received quantity to record an inspection.'
      return false
    }
    const product = getProduct(receipt.productId)
    const accepted = received - damaged
    const before = product.quantity
    receipt.receivedQuantity += received
    receipt.acceptedQuantity += accepted
    receipt.damagedQuantity += damaged
    receipt.inspection = inspection
    receipt.actualDate = new Date().toISOString()
    receipt.status = receipt.receivedQuantity >= receipt.expectedQuantity ? 'received' : 'partial'
    if (accepted > 0) pushMovement(product, 'Received', accepted, receipt.purchaseOrder, receipt.supplier, product.warehouse)
    if (damaged > 0) product.damaged += damaged
    if (damaged > 0) {
      const damageAlert = {
        id: `IAL-DAMAGE-${receipt.id}`, productId: product.productId, type: 'damaged',
        severity: 'medium', title: `Damaged units reported for ${product.productName}`,
        description: `${number(damaged)} units rejected during receipt ${receipt.id}.`,
        status: 'open', createdAt: new Date().toISOString(), assignedTo: settings.displayName, notes: [],
      }
      state.alerts.unshift(damageAlert)
      addNotification('Damaged delivery units', damageAlert.title, 'alerts', damageAlert.id)
    }
    const po = state.purchaseOrders.find((item) => item.id === receipt.purchaseOrder)
    if (po) {
      po.received += received
      po.status = po.received >= po.ordered ? 'received' : 'partially-received'
    }
    if (receipt.replenishmentId) {
      const request = state.replenishments.find((item) => item.id === receipt.replenishmentId)
      if (request && receipt.status === 'received') request.status = 'received'
    }
    addActivity('Delivery received', product, before, product.quantity, receipt.id)
    addNotification('Delivery inspected', `${receipt.id}: ${number(accepted)} units accepted.`, 'receiving', receipt.id)
    renderAll()
  })
}

function startCycleCount() {
  const product = state.inventory[0]
  openDialog('Start cycle count', `
    ${field('Warehouse', 'warehouse', '<select name="warehouse"><option value="WH-001">WH-001 · Central</option></select>')}
    ${field('Storage location', 'location', '<input name="location" value="Aisle A1" required>')}
    ${field('Product to count', 'productId', `<select name="productId" required>${productOptions(product.productId)}</select>`, true)}
    ${field('Physical quantity', 'actualQuantity', `<input name="actualQuantity" type="number" min="0" value="${product.quantity}" required>`)}
    ${field('Assigned user', 'assignedTo', `<input name="assignedTo" value="${esc(settings.displayName)}" required>`)}
    <p id="im-count-system-quantity" class="im-permission-note full">System quantity for selected product: ${number(product.quantity)}</p>`,
  'Complete count', (data) => {
    const selected = getProduct(String(data.get('productId')))
    const actual = Number(data.get('actualQuantity'))
    if (!selected || !Number.isInteger(actual) || actual < 0) {
      document.getElementById('im-dialog-error').textContent = 'Enter a valid non-negative whole-number count.'
      return false
    }
    const discrepancy = actual === selected.quantity ? 0 : 1
    const count = {
      id: `CNT-${Date.now().toString().slice(-6)}`, warehouse: String(data.get('warehouse')),
      location: String(data.get('location')), productId: selected.productId,
      systemQuantity: selected.quantity, actualQuantity: actual,
      productsCounted: 1, discrepancies: discrepancy,
      accuracy: discrepancy ? 0 : 100, assignedTo: String(data.get('assignedTo')),
      date: new Date().toISOString(), status: 'completed',
    }
    state.counts.unshift(count)
    if (discrepancy) {
      const adjustment = {
        id: `ADJ-${Date.now().toString().slice(-6)}`, productId: selected.productId,
        systemQuantity: selected.quantity, actualQuantity: actual, reason: 'Cycle-count discrepancy',
        requestedBy: settings.displayName, status: 'pending-approval', createdAt: new Date().toISOString(),
        history: [`Created from ${count.id}; awaiting authorised approval.`],
      }
      state.adjustments.unshift(adjustment)
      const alert = {
        id: `IAL-${count.id}`, productId: selected.productId, type: 'discrepancy',
        severity: 'high', title: `Cycle-count discrepancy for ${selected.productName}`,
        description: `System quantity ${number(selected.quantity)}; physical count ${number(actual)}. Adjustment is awaiting approval.`,
        status: 'open', createdAt: new Date().toISOString(), assignedTo: settings.displayName, notes: [],
      }
      state.alerts.unshift(alert)
      addNotification('Cycle-count discrepancy', alert.title, 'counts', count.id)
      addNotification('Cycle count discrepancy found', `${selected.productName} · ${count.id}`, 'adjustments', adjustment.id)
    }
    addActivity('Cycle count completed', selected, selected.quantity, actual, count.id)
    renderAll()
  })
  const select = document.querySelector('#im-dialog-content select[name="productId"]')
  select.addEventListener('change', () => {
    const selected = getProduct(select.value)
    document.getElementById('im-count-system-quantity').textContent = `System quantity for selected product: ${number(selected?.quantity)}`
    document.querySelector('#im-dialog-content input[name="actualQuantity"]').value = String(selected?.quantity || 0)
  })
}

function updateAlert(id, action) {
  const alert = state.alerts.find((item) => item.id === id)
  if (!alert) return
  const nextStatus = { acknowledge: 'acknowledged', investigate: 'in-progress' }[action]
  if (action === 'resolve') {
    alert.status = 'resolved'
    alert.notes.unshift(`${date(new Date(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · Resolved by ${settings.displayName}.`)
  } else {
    alert.status = nextStatus
    alert.assignedTo = settings.displayName
    alert.notes.unshift(`${date(new Date(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${titleCase(nextStatus)} by ${settings.displayName}.`)
  }
  addActivity(`Inventory alert ${alert.status}`, getProduct(alert.productId), '', '', alert.id)
  renderAll()
}

function exportCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
function exportInventory() {
  const rows = state.inventory.map((product) => [product.productId, product.productName, product.sku, product.category, product.quantity, product.reserved, available(product), product.warehouse, product.location, product.reorderThreshold, product.maxStock, stockStatus(product)])
  exportCsv('inventory-records.csv', ['Product ID', 'Product', 'SKU', 'Category', 'Total', 'Reserved', 'Available', 'Warehouse', 'Location', 'Reorder level', 'Maximum stock', 'Status'], rows)
}
function exportMovements() {
  const rows = filteredMovements().map((item) => [item.id, item.productId, item.productName, item.type, item.previousQuantity, item.quantity, item.newQuantity, item.source, item.destination, item.reference, item.date, item.performedBy])
  exportCsv('stock-movements.csv', ['Movement ID', 'Product ID', 'Product', 'Type', 'Previous', 'Change', 'New', 'Source', 'Destination', 'Reference', 'Date', 'User'], rows)
}
function exportReport() {
  const headers = [...document.querySelectorAll('#im-report-head th')].map((item) => item.textContent)
  const rows = [...document.querySelectorAll('#im-report-body tr')].map((row) => [...row.cells].map((cell) => cell.textContent))
  exportCsv(`${document.getElementById('im-report-type').value}-report.csv`, headers, rows)
}

document.addEventListener('click', (event) => {
  const pageButton = event.target.closest('[data-go-page]')
  if (pageButton) {
    const page = pageButton.dataset.goPage
    history.pushState(null, '', `#${page}`)
    showPage(page)
    return
  }
  const detail = event.target.closest('[data-product-details]')
  if (detail) { openProductDetails(detail.dataset.productDetails); return }
  const replenish = event.target.closest('[data-new-replenishment]')
  if (replenish) { createReplenishment(replenish.dataset.newReplenishment); return }
  const adjust = event.target.closest('[data-new-adjustment]')
  if (adjust) { createAdjustment(adjust.dataset.newAdjustment); return }
  const edit = event.target.closest('[data-edit-product]')
  if (edit) { editProduct(edit.dataset.editProduct); return }
  const movement = event.target.closest('[data-movement-details]')
  if (movement) { openMovementDetails(movement.dataset.movementDetails); return }
  const receive = event.target.closest('[data-receive]')
  if (receive) { receiveDelivery(receive.dataset.receive); return }
  const alertAction = event.target.closest('[data-alert-action]')
  if (alertAction) updateAlert(alertAction.dataset.alertId, alertAction.dataset.alertAction)
  const notification = event.target.closest('[data-notification-page]')
  if (notification) {
    const item = state.notifications.find((entry) => entry.id === notification.dataset.notificationId)
    if (item) item.read = true
    const page = notification.dataset.notificationPage
    document.getElementById('im-notification-dialog').close()
    if (location.hash !== `#${page}`) history.pushState(null, '', `#${page}`)
    showPage(page)
    renderAll()
    if (item?.recordId) openNotificationRecord(item.recordId)
  }
})

document.getElementById('im-inventory-search').addEventListener('input', (event) => { inventoryFilter.query = event.target.value.trim(); inventoryFilter.page = 1; document.getElementById('im-global-search').value = event.target.value; renderInventory() })
document.getElementById('im-global-search').addEventListener('input', (event) => {
  inventoryFilter.query = event.target.value.trim()
  inventoryFilter.page = 1
  document.getElementById('im-inventory-search').value = event.target.value
  renderInventory()
  if (location.hash !== '#inventory') history.pushState(null, '', '#inventory')
  showPage('inventory')
})
;[['im-inventory-category', 'category'], ['im-inventory-status', 'status'], ['im-inventory-warehouse', 'warehouse'], ['im-inventory-sort', 'sort']].forEach(([id, key]) => {
  document.getElementById(id).addEventListener('change', (event) => { inventoryFilter[key] = event.target.value; inventoryFilter.page = 1; renderInventory() })
})
document.getElementById('im-inventory-clear').addEventListener('click', () => {
  Object.assign(inventoryFilter, { query: '', category: 'all', status: 'all', warehouse: 'all', sort: 'name', page: 1 })
  document.getElementById('im-inventory-search').value = ''
  document.getElementById('im-global-search').value = ''
  document.getElementById('im-inventory-category').value = 'all'
  document.getElementById('im-inventory-status').value = 'all'
  document.getElementById('im-inventory-warehouse').value = 'all'
  document.getElementById('im-inventory-sort').value = 'name'
  renderInventory()
})
document.getElementById('im-page-previous').addEventListener('click', () => { inventoryFilter.page--; renderInventory() })
document.getElementById('im-page-next').addEventListener('click', () => { inventoryFilter.page++; renderInventory() })
document.getElementById('im-new-replenishment').addEventListener('click', () => createReplenishment())
document.getElementById('im-new-adjustment').addEventListener('click', () => createAdjustment())
document.getElementById('im-new-count').addEventListener('click', startCycleCount)
document.getElementById('im-new-movement').addEventListener('click', recordMovement)
document.getElementById('im-inventory-export').addEventListener('click', exportInventory)
document.getElementById('im-movement-export').addEventListener('click', exportMovements)
document.getElementById('im-alert-severity').addEventListener('change', renderAlerts)
document.getElementById('im-alert-status').addEventListener('change', renderAlerts)
;[['im-replenishment-status', 'replenishment'], ['im-receiving-status', 'receiving'], ['im-adjustment-status', 'adjustments'], ['im-count-filter', 'counts']].forEach(([id, key]) => {
  document.getElementById(id).addEventListener('change', (event) => {
    moduleFilters[key] = event.target.value
    if (key === 'replenishment') renderReplenishments()
    if (key === 'receiving') renderReceiving()
    if (key === 'adjustments') renderAdjustments()
    if (key === 'counts') renderCounts()
  })
})
document.getElementById('im-notifications-button').addEventListener('click', () => {
  renderNotifications()
  document.getElementById('im-notification-dialog').showModal()
})
document.getElementById('im-notification-close').addEventListener('click', () => document.getElementById('im-notification-dialog').close())
document.getElementById('im-mark-notifications-read').addEventListener('click', () => {
  state.notifications.forEach((item) => { item.read = true })
  renderNotifications()
  persist()
})
;[['im-movement-search', 'query'], ['im-movement-type', 'type'], ['im-movement-warehouse', 'warehouse'], ['im-movement-from', 'from'], ['im-movement-to', 'to']].forEach(([id, key]) => {
  document.getElementById(id).addEventListener(id.includes('search') ? 'input' : 'change', (event) => { movementFilter[key] = event.target.value; renderMovements() })
})
;['im-report-type', 'im-report-warehouse', 'im-report-category', 'im-report-supplier', 'im-report-status', 'im-report-from', 'im-report-to'].forEach((id) => document.getElementById(id).addEventListener('change', renderReport))
document.getElementById('im-report-export').addEventListener('click', exportReport)
document.getElementById('im-report-print').addEventListener('click', () => window.print())
document.getElementById('im-activity-export').addEventListener('click', () => exportCsv('inventory-activity.csv',
  ['Date', 'User', 'Action', 'Product / record', 'Previous', 'New', 'Reference'],
  state.activities.map((item) => [item.timestamp, item.user, item.action, item.productId, item.previous, item.next, item.reference])))
document.getElementById('im-settings-name').value = settings.displayName
document.getElementById('im-settings-warehouse').value = settings.warehouse
document.getElementById('im-settings-page-size').value = String(settings.pageSize)
document.getElementById('im-settings-notifications').checked = settings.notificationsEnabled
document.getElementById('im-settings-low-stock').checked = settings.lowStockNotifications
document.getElementById('im-warehouse-select').value = settings.warehouse
document.getElementById('im-inventory-warehouse').value = settings.warehouse
document.getElementById('im-user-name').textContent = settings.displayName
document.getElementById('im-settings-save').addEventListener('click', () => {
  const name = document.getElementById('im-settings-name').value.trim()
  if (!name) {
    document.getElementById('im-settings-status').textContent = 'Enter a display name before saving.'
    return
  }
  Object.assign(settings, {
    displayName: name,
    warehouse: document.getElementById('im-settings-warehouse').value,
    pageSize: Number(document.getElementById('im-settings-page-size').value),
    notificationsEnabled: document.getElementById('im-settings-notifications').checked,
    lowStockNotifications: document.getElementById('im-settings-low-stock').checked,
  })
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  document.getElementById('im-warehouse-select').value = settings.warehouse
  document.getElementById('im-inventory-warehouse').value = settings.warehouse
  inventoryFilter.warehouse = settings.warehouse
  document.getElementById('im-user-name').textContent = settings.displayName
  addActivity('Workspace settings updated', null, '', '', 'settings')
  document.getElementById('im-settings-status').textContent = 'Preferences saved in this browser.'
  renderAll()
})
document.getElementById('im-report-type').addEventListener('change', (event) => {
  document.getElementById('im-report-summary').setAttribute('aria-label', REPORT_LABELS[event.target.value])
})
document.getElementById('im-warehouse-select').addEventListener('change', (event) => {
  document.getElementById('im-inventory-warehouse').value = event.target.value
  inventoryFilter.warehouse = event.target.value
  renderInventory()
})

renderAll()
showPage(location.hash.slice(1) || 'overview')
window.__inventoryManager = {
  getState: () => clone(state),
  getMetrics: () => ({
    totalSkus: state.inventory.length,
    totalUnits: state.inventory.reduce((sum, product) => sum + product.quantity, 0),
    availableUnits: state.inventory.reduce((sum, product) => sum + available(product), 0),
    lowStock: getStatusCount('low-stock'),
    outOfStock: getStatusCount('out-of-stock'),
    overstock: getStatusCount('overstock'),
    pendingReplenishments: state.replenishments.filter((item) => item.status === 'awaiting-approval').length,
    pendingReceipts: state.receipts.filter((item) => !['received', 'closed'].includes(item.status)).length,
    pendingAdjustments: state.adjustments.filter((item) => item.status === 'pending-approval').length,
  }),
}
