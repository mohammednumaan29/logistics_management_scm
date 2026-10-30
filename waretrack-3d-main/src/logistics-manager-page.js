import { requireRole } from './api/client.js';
await requireRole('SUPPLY_CHAIN_MANAGER');
import './workspaces/logistics-manager.css'
import './workspaces/dashboard-consistency.css'
import { shipments as demoShipments } from './workspaces/operations-analyst-data.js'

const STATE_KEY = 'disruptioniq.logistics-manager.v1'
const SETTINGS_KEY = 'disruptioniq.logistics-manager.settings.v1'
const clone = (value) => JSON.parse(JSON.stringify(value))
const savedValue = localStorage.getItem(STATE_KEY)
const savedState = savedValue ? JSON.parse(savedValue) : null
const seededShipments = clone(demoShipments).map((shipment) => ({
  ...shipment,
  status: shipment.status === 'pending-dispatch' ? 'pending-dispatch' : shipment.status,
  actualDate: shipment.actualDate || '',
  notes: [],
  tracking: [],
}))
const seededVehicles = [
  ...[...new Set(seededShipments.map((item) => item.vehicleId).filter((id) => id.startsWith('TRK-')))].map((id, index) => ({
    id,
    registration: `TN-${String(10 + index).padStart(2, '0')}-AB-${String(1100 + index * 137).slice(-4)}`,
    type: index % 4 === 0 ? 'Heavy truck' : index % 3 === 0 ? 'Container truck' : 'Truck',
    capacity: index % 3 === 0 ? 12000 : 8000,
    location: 'En route · latest update simulated',
    driver: ['Ravi Kumar', 'Arun Patel', 'Suresh Nair', 'Kiran Das'][index % 4],
    status: 'active',
    maintenance: [],
  })),
  { id: 'TRK-G02', registration: 'TN-09-GH-3102', type: 'Heavy truck', capacity: 15000, location: 'Central Distribution Warehouse', driver: 'Meena Iyer', status: 'active', maintenance: [] },
  { id: 'VAN-H04', registration: 'TN-10-HJ-4204', type: 'Delivery van', capacity: 2500, location: 'Central Distribution Warehouse', driver: 'Vikram Shah', status: 'active', maintenance: [] },
  { id: 'TRK-M01', registration: 'TN-11-MN-1001', type: 'Truck', capacity: 10000, location: 'Fleet service center', driver: 'Unassigned', status: 'maintenance', maintenance: ['Preventive service · 30 Oct 2026'] },
]
const destinations = [...new Set(seededShipments.map((item) => item.destination))]
const initialExceptionItems = seededShipments.filter((item) => item.status === 'delayed').map((shipment, index) => ({
  id: `DSP-${String(5101 + index)}`,
  shipmentId: shipment.id,
  type: shipment.delayReason?.toLowerCase().includes('weather') ? 'Weather disruption' : 'Carrier failure',
  location: shipment.destination,
  severity: shipment.priority === 'critical' ? 'critical' : 'high',
  estimatedDelay: index === 1 ? 180 : 120,
  reportedAt: `2026-10-${String(30 - index).padStart(2, '0')}T08:${String(10 + index * 13).padStart(2, '0')}:00`,
  status: 'open',
  assignedTo: '',
  description: shipment.delayReason || 'Delivery is behind its expected schedule.',
  notes: ['Exception created from delayed shipment status.'],
  resolutionHistory: [],
}))
const seededRoutes = destinations.filter((destination) => destination !== 'Central Distribution Warehouse').map((destination, index) => {
  const first = seededShipments.find((shipment) => shipment.destination === destination)
  return {
    id: `RTE-${String(7101 + index)}`,
    origin: first?.origin || 'Central Distribution Warehouse',
    destination,
    vehicleId: first?.vehicleId || '',
    carrier: first?.carrier || '',
    shipmentIds: seededShipments.filter((shipment) => shipment.destination === destination).map((shipment) => shipment.id),
    departure: first?.dispatchDate || '2026-10-30',
    arrival: first?.expectedDate || '2026-10-31',
    status: first?.status === 'delivered' ? 'completed' : first?.status === 'delayed' ? 'disrupted' : first?.status === 'pending-dispatch' ? 'planned' : 'active',
  }
})

const state = {
  shipments: savedState?.shipments || seededShipments,
  vehicles: savedState?.vehicles || seededVehicles,
  exceptions: savedState?.exceptions || initialExceptionItems,
  routes: savedState?.routes || seededRoutes,
  activities: savedState?.activities || [
    { id: 'LMA-001', timestamp: '2026-10-30T08:45:00', user: 'Logistics Manager', action: 'Delivery exception reviewed', shipmentId: 'SHP-2401', reference: 'DSP-5101', details: 'Weather disruption on southern route.' },
    { id: 'LMA-002', timestamp: '2026-10-30T08:10:00', user: 'Transport Coordinator', action: 'Carrier delay recorded', shipmentId: 'SHP-2402', reference: 'DSP-5102', details: 'Carrier capacity constraints.' },
    { id: 'LMA-003', timestamp: '2026-10-30T07:35:00', user: 'Dispatch Team', action: 'Shipment pending dispatch', shipmentId: 'SHP-2403', reference: 'ORD-1203', details: 'Awaiting loading confirmation.' },
  ],
  notifications: savedState?.notifications || [],
}
const settings = {
  displayName: 'Logistics Manager',
  region: 'all',
  notificationsEnabled: true,
  ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
}
const filters = {
  shipments: { query: '', status: 'all', carrier: 'all', destination: '', region: 'all' },
  vehicles: { query: '', status: 'all' },
  tracking: { query: '', status: 'all' },
  exceptions: { severity: 'all', status: 'all', type: 'all' },
}
function persist() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state))
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}
function number(value) { return new Intl.NumberFormat().format(Number(value) || 0) }
function parseDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
function fmtDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  const parsed = parseDate(value)
  return parsed ? new Intl.DateTimeFormat(undefined, options).format(parsed) : '—'
}
function titleCase(value) {
  return String(value || 'Unknown').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
function getShipment(id) { return state.shipments.find((shipment) => shipment.id === id) }
function getVehicle(id) { return state.vehicles.find((vehicle) => vehicle.id === id) }
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function destinationRegion(destination) {
  const value = destination.toLowerCase()
  if (/chennai|coimbatore|kochi|mysuru|vijayawada|hyderabad|bengaluru/.test(value)) return 'South'
  if (/mumbai|surat|ahmedabad|pune/.test(value)) return 'West'
  return 'North'
}
function activeShipment(shipment) {
  return !['delivered', 'failed', 'cancelled'].includes(shipment.status)
}
function isLate(shipment) {
  if (shipment.status === 'delivered' && shipment.actualDate && shipment.expectedDate) return shipment.actualDate > shipment.expectedDate
  if (shipment.status === 'delayed') return true
  return false
}
function onTimeRate(shipments = state.shipments) {
  const completed = shipments.filter((shipment) => shipment.status === 'delivered' && shipment.actualDate)
  return completed.length ? completed.filter((shipment) => shipment.actualDate <= shipment.expectedDate).length / completed.length * 100 : 0
}
function vehicleAvailability(vehicle) {
  if (vehicle.status === 'maintenance') return 'maintenance'
  if (vehicle.status === 'unavailable') return 'unavailable'
  const assigned = state.shipments.find((shipment) => shipment.vehicleId === vehicle.id && activeShipment(shipment))
  return assigned ? 'assigned' : 'available'
}
function addActivity(action, shipmentId, reference, details) {
  state.activities.unshift({
    id: `LMA-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString(),
    user: settings.displayName,
    action,
    shipmentId: shipmentId || '',
    reference: reference || shipmentId || '',
    details: details || '',
  })
}
function addNotification(title, description, page, recordId, recordType = 'shipment') {
  if (!settings.notificationsEnabled) return
  state.notifications.unshift({
    id: `LMN-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title, description, page, recordId, recordType, date: new Date().toISOString(), read: false,
  })
}
function makeTrackingEvent(shipment) {
  const last = shipment.tracking[shipment.tracking.length - 1]
  shipment.tracking.push({
    id: `TRK-EVT-${Date.now()}`,
    status: shipment.status,
    timestamp: new Date().toISOString(),
    location: shipment.status === 'delivered' ? shipment.destination : shipment.origin,
    note: shipment.notes?.[0] || `Shipment status updated to ${titleCase(shipment.status)}.`,
  })
  if (last && shipment.tracking.length > 12) shipment.tracking.shift()
}
function ensureInitialTracking() {
  state.shipments.forEach((shipment) => {
    if (shipment.tracking?.length) return
    const dispatched = shipment.dispatchDate ? `${shipment.dispatchDate}T08:30:00` : '2026-10-30T08:30:00'
    const events = [
      { status: 'created', timestamp: `${shipment.dispatchDate || '2026-10-30'}T07:30:00`, location: shipment.origin, note: 'Shipment registered in the demo system.' },
    ]
    if (shipment.status !== 'pending-dispatch') {
      events.push({ status: 'in-transit', timestamp: dispatched, location: shipment.origin, note: 'Carrier pickup and departure simulated.' })
    }
    if (shipment.status === 'delayed') events.push({ status: 'delayed', timestamp: `${shipment.dispatchDate || '2026-10-30'}T14:15:00`, location: shipment.destination, note: shipment.delayReason || 'Delivery is behind schedule.' })
    if (shipment.status === 'delivered') events.push({ status: 'delivered', timestamp: `${shipment.actualDate || shipment.expectedDate}T09:10:00`, location: shipment.destination, note: 'Delivery confirmation recorded in demo data.' })
    shipment.tracking = events.map((item, index) => ({ id: `TRK-SEED-${shipment.id}-${index}`, ...item }))
  })
}
function ensureShipmentExceptions() {
  state.shipments.filter((shipment) => shipment.status === 'delayed').forEach((shipment, index) => {
    if (state.exceptions.some((exception) => exception.shipmentId === shipment.id && exception.status !== 'resolved')) return
    state.exceptions.push({
      id: `DSP-${shipment.id.slice(-4)}`,
      shipmentId: shipment.id,
      type: shipment.delayReason?.toLowerCase().includes('weather') ? 'Weather disruption' : 'Carrier failure',
      location: shipment.destination,
      severity: shipment.priority === 'critical' ? 'critical' : 'high',
      estimatedDelay: shipment.id === 'SHP-2402' ? 180 : 120,
      reportedAt: shipment.dispatchDate ? `${shipment.dispatchDate}T08:${String(10 + index * 13).padStart(2, '0')}:00` : new Date().toISOString(),
      status: 'open',
      assignedTo: '',
      description: shipment.delayReason || 'Shipment has missed its expected progress.',
      notes: ['Exception created from delayed shipment status.'],
      resolutionHistory: [],
    })
  })
}
ensureInitialTracking()
ensureShipmentExceptions()

const navLinks = [...document.querySelectorAll('.lm-nav a[href^="#"]')]
const pageIds = new Set(navLinks.map((link) => link.hash.slice(1)))
function showPage(id) {
  const page = pageIds.has(id) ? id : 'overview'
  document.querySelectorAll('[data-lm-page]').forEach((section) => { section.hidden = section.dataset.lmPage !== page })
  navLinks.forEach((link) => {
    const selected = link.hash.slice(1) === page
    link.classList.toggle('is-active', selected)
    if (selected) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  window.scrollTo(0, 0)
}
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]')
  if (!link || !pageIds.has(link.hash.slice(1))) return
  event.preventDefault()
  const page = link.hash.slice(1)
  if (location.hash !== `#${page}`) history.pushState(null, '', `#${page}`)
  showPage(page)
})
window.addEventListener('popstate', () => showPage(location.hash.slice(1)))
window.addEventListener('hashchange', () => showPage(location.hash.slice(1)))

function setKpis(target, items) {
  document.getElementById(target).innerHTML = items.map((item) => `
    <a class="lm-kpi" href="#${esc(item.page)}" ${item.filterKey ? `data-filter-key="${esc(item.filterKey)}" data-filter-value="${esc(item.filterValue)}"` : ''}>
      <span class="lm-kpi-icon">${esc(item.icon)}</span><span><span class="lm-kpi-label">${esc(item.label)}</span><strong>${esc(item.value)}</strong><small>${esc(item.note)}</small></span>
    </a>`).join('')
}
function makeChart(title, description, values, tone = 'gold') {
  const max = Math.max(1, ...values.map((entry) => entry.value))
  const colors = tone === 'mixed' ? ['gold', 'alt', 'green', 'red'] : [tone]
  return `<article class="lm-chart"><h3>${esc(title)}</h3><p>${esc(description)}</p><div class="lm-bars">${values.map((entry, index) => {
    const color = colors[index % colors.length]
    return `<div class="lm-bar-row"><span>${esc(entry.label)}</span><span class="lm-bar-track"><i class="lm-bar-fill ${color === 'gold' ? '' : color}" style="width:${Math.max(1, entry.value / max * 100)}%"></i></span><strong class="lm-bar-value">${esc(number(entry.value))}${entry.suffix || ''}</strong></div>`
  }).join('')}</div></article>`
}
function statusBadge(status) {
  return `<span class="lm-status" data-status="${esc(status)}">${esc(titleCase(status))}</span>`
}
function shipmentRegionFilter(shipment, region) {
  return region === 'all' || destinationRegion(shipment.destination) === region
}
function renderOverview() {
  const today = localDateKey()
  const delayed = state.shipments.filter((shipment) => shipment.status === 'delayed')
  const pendingDispatch = state.shipments.filter((shipment) => ['pending-dispatch', 'ready-for-dispatch'].includes(shipment.status))
  const deliveredToday = state.shipments.filter((shipment) => shipment.status === 'delivered' && shipment.actualDate === today)
  const activeVehicleCount = state.vehicles.filter((vehicle) => vehicleAvailability(vehicle) === 'assigned').length
  const availableVehicleCount = state.vehicles.filter((vehicle) => vehicleAvailability(vehicle) === 'available').length
  const carriers = [...new Set(state.shipments.filter(activeShipment).map((shipment) => shipment.carrier).filter(Boolean))]
  const openExceptions = state.exceptions.filter((exception) => exception.status !== 'resolved')
  const rate = onTimeRate()
  setKpis('lm-overview-kpis', [
    { label: 'Total shipments', value: state.shipments.length, note: 'All managed shipment records', icon: '⇢', page: 'shipments' },
    { label: 'Active shipments', value: state.shipments.filter((shipment) => ['in-transit', 'delayed', 'out-for-delivery'].includes(shipment.status)).length, note: 'Currently moving', icon: '↗', page: 'tracking' },
    { label: 'Pending dispatch', value: pendingDispatch.length, note: 'Awaiting carrier pickup', icon: '◷', page: 'planning', filterKey: 'planning', filterValue: 'pending' },
    { label: 'Delivered today', value: deliveredToday.length, note: `As of ${fmtDate(new Date(), { hour: '2-digit', minute: '2-digit' })}`, icon: '✓', page: 'shipments', filterKey: 'shipmentStatus', filterValue: 'delivered-today' },
    { label: 'Delayed shipments', value: delayed.length, note: 'Behind expected schedule', icon: '!', page: 'shipments', filterKey: 'shipmentStatus', filterValue: 'delayed' },
    { label: 'On-time delivery', value: `${rate.toFixed(0)}%`, note: 'Of completed demo deliveries', icon: '%', page: 'reports', filterKey: 'report', filterValue: 'on-time' },
    { label: 'Active vehicles', value: activeVehicleCount, note: 'Assigned to active shipments', icon: '▰', page: 'vehicles', filterKey: 'vehicleStatus', filterValue: 'assigned' },
    { label: 'Available vehicles', value: availableVehicleCount, note: 'Ready for assignment', icon: '□', page: 'vehicles', filterKey: 'vehicleStatus', filterValue: 'available' },
    { label: 'Active carriers', value: carriers.length, note: 'Handling active shipments', icon: '♧', page: 'carriers' },
    { label: 'Open exceptions', value: openExceptions.length, note: 'Require investigation or closure', icon: '△', page: 'exceptions', filterKey: 'exceptionStatus', filterValue: 'open' },
  ])
  const statusCounts = ['pending-dispatch', 'in-transit', 'delayed', 'out-for-delivery', 'delivered', 'failed'].map((status) => ({
    label: titleCase(status), value: state.shipments.filter((shipment) => shipment.status === status).length,
  }))
  const completionCounts = [
    { label: 'On time', value: state.shipments.filter((shipment) => shipment.status === 'delivered' && !isLate(shipment)).length },
    { label: 'Late', value: state.shipments.filter((shipment) => isLate(shipment)).length },
  ]
  const dateCounts = [...new Set(state.shipments.map((shipment) => shipment.dispatchDate).filter(Boolean))].sort().slice(-5).map((day) => ({
    label: fmtDate(day, { day: '2-digit', month: 'short' }),
    value: state.shipments.filter((shipment) => shipment.dispatchDate === day).length,
  }))
  const carrierCounts = [...new Set(state.shipments.map((shipment) => shipment.carrier).filter(Boolean))].map((carrier) => {
    const completed = state.shipments.filter((shipment) => shipment.carrier === carrier && shipment.status === 'delivered')
    const rateForCarrier = completed.length ? Math.round(completed.filter((shipment) => !isLate(shipment)).length / completed.length * 100) : 0
    return { label: carrier, value: rateForCarrier, suffix: '%' }
  }).sort((a, b) => b.value - a.value).slice(0, 5)
  document.getElementById('lm-overview-charts').innerHTML = [
    makeChart('Shipment status distribution', 'Current status across all shipment records', statusCounts, 'mixed'),
    makeChart('On-time vs delayed deliveries', 'Completed deliveries and active delay exceptions', completionCounts, 'mixed'),
    makeChart('Daily shipment volume', 'Shipments by dispatch date', dateCounts, 'alt'),
    makeChart('Carrier performance comparison', 'On-time share of completed shipments · sample sizes vary', carrierCounts, 'green'),
  ].join('')
  const attention = [
    ...delayed.map((shipment) => ({
      severity: shipment.priority === 'critical' ? 'critical' : 'high',
      title: `${shipment.id} delayed · ${shipment.destination}`,
      detail: `${shipment.carrier} · ${shipment.delayReason || 'Behind schedule'}`,
      id: shipment.id,
      type: 'shipment',
    })),
    ...openExceptions.filter((exception) => !delayed.some((shipment) => shipment.id === exception.shipmentId)).map((exception) => ({
      severity: exception.severity, title: exception.title || `${exception.type} · ${exception.shipmentId}`,
      detail: `${exception.id} · ${titleCase(exception.status)}`, id: exception.id, type: 'exception',
    })),
    ...pendingDispatch.slice(0, 2).map((shipment) => ({
      severity: 'medium', title: `${shipment.id} awaiting dispatch`, detail: `${shipment.destination} · due ${fmtDate(shipment.expectedDate)}`,
      id: shipment.id, type: 'shipment',
    })),
  ].slice(0, 6)
  document.getElementById('lm-attention-list').innerHTML = attention.map((item) => `
    <div class="lm-attention-item"><i class="lm-severity ${esc(item.severity)}"></i><span class="lm-item-copy"><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span><button class="lm-text-button" data-open-record="${esc(item.type)}:${esc(item.id)}">View details</button></div>`).join('') || '<p class="lm-empty">No urgent transport issues.</p>'
  document.getElementById('lm-recent-activity').innerHTML = state.activities.slice(0, 5).map((activity) => `
    <div class="lm-recent-item"><span class="lm-kpi-icon">◷</span><span class="lm-item-copy"><strong>${esc(activity.action)}${activity.shipmentId ? ` · ${esc(activity.shipmentId)}` : ''}</strong><small>${fmtDate(activity.timestamp, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${esc(activity.user)}</small></span></div>`).join('') || '<p class="lm-empty">No transportation activity recorded.</p>'
  document.getElementById('lm-exception-count').textContent = openExceptions.length
  const unread = state.notifications.filter((notification) => !notification.read).length
  document.getElementById('lm-notification-count').textContent = unread
  document.getElementById('lm-notification-badge').textContent = unread
}

function renderShipmentFilters() {
  const select = document.getElementById('lm-shipment-carrier')
  const previous = select.value
  const carriers = [...new Set(state.shipments.map((shipment) => shipment.carrier).filter(Boolean))].sort()
  select.innerHTML = '<option value="all">All carriers</option>' + carriers.map((carrier) => `<option value="${esc(carrier)}">${esc(carrier)}</option>`).join('')
  select.value = carriers.includes(previous) ? previous : 'all'
}
function renderShipments() {
  renderShipmentFilters()
  const filtered = state.shipments.filter((shipment) => {
    const q = `${shipment.id} ${shipment.orderId} ${shipment.origin} ${shipment.destination} ${shipment.carrier} ${shipment.vehicleId}`.toLowerCase()
    const statusMatch = filters.shipments.status === 'all'
      || (filters.shipments.status === 'delivered-today' ? shipment.status === 'delivered' && shipment.actualDate === localDateKey() : shipment.status === filters.shipments.status)
    return (!filters.shipments.query || q.includes(filters.shipments.query.toLowerCase()))
      && statusMatch
      && (filters.shipments.carrier === 'all' || shipment.carrier === filters.shipments.carrier)
      && (!filters.shipments.destination || shipment.destination.toLowerCase().includes(filters.shipments.destination.toLowerCase()))
      && shipmentRegionFilter(shipment, filters.shipments.region)
  })
  document.getElementById('lm-shipment-body').innerHTML = filtered.map((shipment) => {
    const delay = shipment.status === 'delayed' ? `${state.exceptions.find((item) => item.shipmentId === shipment.id && item.status !== 'resolved')?.estimatedDelay || 0} min` : '—'
    return `<tr><td><button class="lm-link-button" data-shipment-details="${esc(shipment.id)}">${esc(shipment.id)}</button><small>${esc(shipment.orderId)}</small></td>
      <td>${esc(shipment.origin)}<small>→ ${esc(shipment.destination)}</small></td><td>${esc(shipment.carrier)}<small>${esc(shipment.vehicleId || 'Unassigned')}</small></td>
      <td>${fmtDate(shipment.dispatchDate)}</td><td>${fmtDate(shipment.expectedDate)}${shipment.actualDate ? `<small>Actual ${fmtDate(shipment.actualDate)}</small>` : ''}</td>
      <td>${statusBadge(shipment.status)}</td><td>${delay}${shipment.delayReason ? `<small>${esc(shipment.delayReason)}</small>` : ''}</td>
      <td><div class="lm-row-actions"><button data-shipment-details="${esc(shipment.id)}">Details</button>${activeShipment(shipment) ? `<button data-shipment-update="${esc(shipment.id)}">Update</button>` : ''}</div></td></tr>`
  }).join('') || '<tr><td colspan="8" class="lm-empty">No shipments match the selected filters.</td></tr>'
}

function renderPlanning() {
  const pending = state.shipments.filter((shipment) => ['pending-dispatch', 'ready-for-dispatch'].includes(shipment.status))
  const available = state.vehicles.filter((vehicle) => vehicleAvailability(vehicle) === 'available')
  setKpis('lm-planning-kpis', [
    { label: 'Awaiting dispatch', value: pending.length, note: 'Pending transportation plan', icon: '◷', page: 'planning' },
    { label: 'Available vehicles', value: available.length, note: 'No active shipment assignment', icon: '▰', page: 'vehicles', filterKey: 'vehicleStatus', filterValue: 'available' },
    { label: 'Active carriers', value: new Set(state.shipments.filter(activeShipment).map((shipment) => shipment.carrier)).size, note: 'Assigned to active loads', icon: '♧', page: 'carriers' },
    { label: 'Urgent dispatches', value: pending.filter((shipment) => ['high', 'critical', 'urgent'].includes(shipment.priority)).length, note: 'High or critical priority', icon: '!', page: 'planning' },
  ])
  document.getElementById('lm-planning-body').innerHTML = pending.map((shipment) => `
    <tr><td><strong>PLN-${shipment.id.slice(-4)}</strong><small>${esc(shipment.id)} · ${esc(shipment.orderId)}</small></td>
      <td>${esc(shipment.origin)}<small>→ ${esc(shipment.destination)}</small></td><td>${fmtDate(shipment.dispatchDate)}<small>Due ${fmtDate(shipment.expectedDate)}</small></td>
      <td>${esc(shipment.carrier || 'Not assigned')}</td><td>${esc(shipment.vehicleId || 'Not assigned')}</td>
      <td>${statusBadge(shipment.priority || 'normal')}</td><td>${statusBadge(shipment.status)}</td>
      <td><div class="lm-row-actions"><button data-plan-shipment="${esc(shipment.id)}">Plan transport</button>${shipment.status === 'ready-for-dispatch' ? `<button data-dispatch="${esc(shipment.id)}">Dispatch</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="8" class="lm-empty">No shipments are waiting for dispatch.</td></tr>'
  document.getElementById('lm-resource-strip').innerHTML = state.vehicles.map((vehicle) => `
    <div class="lm-resource"><strong>${esc(vehicle.id)} · ${number(vehicle.capacity)} kg</strong><span>${titleCase(vehicleAvailability(vehicle))} · ${esc(vehicle.driver)}</span></div>`).join('')
}

function renderVehicles() {
  const query = filters.vehicles.query.toLowerCase()
  const list = state.vehicles.filter((vehicle) => {
    const assigned = state.shipments.find((shipment) => shipment.vehicleId === vehicle.id && activeShipment(shipment))
    const status = vehicleAvailability(vehicle)
    return (!query || `${vehicle.id} ${vehicle.registration} ${vehicle.driver} ${assigned?.id || ''}`.toLowerCase().includes(query))
      && (filters.vehicles.status === 'all' || status === filters.vehicles.status)
  })
  const counts = ['available', 'assigned', 'maintenance', 'unavailable'].map((status) => state.vehicles.filter((vehicle) => vehicleAvailability(vehicle) === status).length)
  setKpis('lm-vehicle-kpis', [
    { label: 'Total vehicles', value: state.vehicles.length, note: 'Registered fleet', icon: '▰', page: 'vehicles' },
    { label: 'Available', value: counts[0], note: 'Ready for assignment', icon: '✓', page: 'vehicles', filterKey: 'vehicleStatus', filterValue: 'available' },
    { label: 'Assigned / in transit', value: counts[1], note: 'On active shipments', icon: '↗', page: 'vehicles', filterKey: 'vehicleStatus', filterValue: 'assigned' },
    { label: 'Maintenance / unavailable', value: counts[2] + counts[3], note: 'Not assignable', icon: '!', page: 'vehicles', filterKey: 'vehicleStatus', filterValue: 'maintenance' },
  ])
  document.getElementById('lm-vehicle-body').innerHTML = list.map((vehicle) => {
    const shipment = state.shipments.find((item) => item.vehicleId === vehicle.id && activeShipment(item))
    const availability = vehicleAvailability(vehicle)
    return `<tr><td><button class="lm-link-button" data-vehicle-details="${esc(vehicle.id)}">${esc(vehicle.id)}</button><small>${esc(vehicle.registration)}</small></td>
      <td>${esc(vehicle.type)}<small>${number(vehicle.capacity)} kg</small></td><td>${esc(vehicle.location)}</td><td>${esc(vehicle.driver)}</td>
      <td>${shipment ? `<button class="lm-link-button" data-shipment-details="${esc(shipment.id)}">${esc(shipment.id)}</button><small>${esc(shipment.destination)}</small>` : '—'}</td>
      <td>${statusBadge(availability)}</td><td>${statusBadge(vehicle.status)}</td><td><div class="lm-row-actions"><button data-vehicle-details="${esc(vehicle.id)}">Details</button>${availability === 'available' ? `<button data-vehicle-maintenance="${esc(vehicle.id)}">Maintenance</button>` : ''}${availability === 'maintenance' ? `<button data-vehicle-activate="${esc(vehicle.id)}">Mark active</button>` : ''}</div></td></tr>`
  }).join('') || '<tr><td colspan="8" class="lm-empty">No vehicles match these filters.</td></tr>'
}

function carrierMetrics(carrier) {
  const handled = state.shipments.filter((shipment) => shipment.carrier === carrier)
  const completed = handled.filter((shipment) => shipment.status === 'delivered')
  const lateCount = completed.filter(isLate).length + handled.filter((shipment) => shipment.status === 'delayed').length
  const successful = completed.length
  const rate = completed.length ? (completed.filter((shipment) => !isLate(shipment)).length / completed.length * 100) : 0
  return { handled, completed, active: handled.filter(activeShipment).length, failed: handled.filter((shipment) => shipment.status === 'failed').length, lateCount, rate }
}
function renderCarriers() {
  const carriers = [...new Set(state.shipments.map((shipment) => shipment.carrier).filter(Boolean))].sort()
  const active = carriers.filter((carrier) => carrierMetrics(carrier).active > 0).length
  setKpis('lm-carrier-kpis', [
    { label: 'Active carriers', value: active, note: 'Handling current shipments', icon: '♧', page: 'carriers' },
    { label: 'Carrier partners', value: carriers.length, note: 'In demo records', icon: '▤', page: 'carriers' },
    { label: 'Completed deliveries', value: state.shipments.filter((shipment) => shipment.status === 'delivered').length, note: 'Historical demo shipments', icon: '✓', page: 'carriers' },
    { label: 'Open carrier issues', value: state.exceptions.filter((exception) => exception.status !== 'resolved').length, note: 'Unresolved exceptions', icon: '!', page: 'exceptions', filterKey: 'exceptionStatus', filterValue: 'open' },
  ])
  document.getElementById('lm-carrier-body').innerHTML = carriers.map((carrier, index) => {
    const metric = carrierMetrics(carrier)
    const delay = metric.handled.filter((shipment) => shipment.status === 'delayed')
    const avgDelay = delay.length ? Math.round(delay.reduce((sum, shipment) => sum + (state.exceptions.find((item) => item.shipmentId === shipment.id)?.estimatedDelay || 0), 0) / delay.length) : 0
    const regions = [...new Set(metric.handled.map((shipment) => destinationRegion(shipment.destination)))].join(', ')
    return `<tr><td><button class="lm-link-button" data-carrier-details="${esc(carrier)}">${esc(carrier)}</button><small>CAR-${String(index + 1).padStart(3, '0')}</small></td><td>${esc(regions)}</td><td>${metric.active}</td><td>${metric.handled.length}</td><td>${metric.rate.toFixed(0)}%<small>${metric.completed.length} completed</small></td><td>${avgDelay ? `${avgDelay} min` : '—'}</td><td>${metric.failed}</td><td>${statusBadge(metric.active ? 'active' : 'inactive')}</td><td><button class="lm-row-actions" data-carrier-details="${esc(carrier)}">Performance</button></td></tr>`
  }).join('')
}

function trackingStatus(shipment) {
  if (shipment.status === 'delivered') return 'delivered'
  const last = shipment.tracking[shipment.tracking.length - 1]
  const age = last ? (Date.now() - new Date(last.timestamp).getTime()) / 3600000 : Infinity
  if (activeShipment(shipment) && age > 24) return 'missing-update'
  return shipment.status
}
function renderTracking() {
  const transit = state.shipments.filter((shipment) => shipment.status === 'in-transit').length
  const outForDelivery = state.shipments.filter((shipment) => shipment.status === 'out-for-delivery').length
  const delivered = state.shipments.filter((shipment) => shipment.status === 'delivered').length
  const missing = state.shipments.filter((shipment) => trackingStatus(shipment) === 'missing-update').length
  const nearing = state.shipments.filter((shipment) => activeShipment(shipment) && shipment.expectedDate === localDateKey()).length
  setKpis('lm-tracking-kpis', [
    { label: 'In transit', value: transit, note: 'Carrier moving shipments', icon: '↗', page: 'tracking' },
    { label: 'Out for delivery', value: outForDelivery, note: 'Final-mile delivery', icon: '⌖', page: 'tracking' },
    { label: 'Delivered', value: delivered, note: 'Recorded demo deliveries', icon: '✓', page: 'tracking' },
    { label: 'Missing updates', value: missing, note: 'No update within 24 hours', icon: '!', page: 'tracking' },
    { label: 'Due today', value: nearing, note: 'Expected today', icon: '◷', page: 'tracking' },
  ])
  const query = filters.tracking.query.toLowerCase()
  const list = state.shipments.filter((shipment) => {
    const status = trackingStatus(shipment)
    return (!query || `${shipment.id} ${shipment.destination}`.toLowerCase().includes(query))
      && (filters.tracking.status === 'all' || status === filters.tracking.status)
  })
  const steps = ['created', 'picked-up', 'in-transit', 'out-for-delivery', 'delivered']
  document.getElementById('lm-tracking-list').innerHTML = list.map((shipment) => {
    const currentIndex = shipment.status === 'pending-dispatch' || shipment.status === 'ready-for-dispatch' ? 0
      : shipment.status === 'delivered' ? 4 : shipment.status === 'out-for-delivery' ? 3 : 2
    const eventsByStatus = new Map(shipment.tracking.map((event) => [event.status, event]))
    return `<article class="lm-tracking-card"><div class="lm-tracking-heading"><div><h3><button class="lm-link-button" data-shipment-details="${esc(shipment.id)}">${esc(shipment.id)}</button> · ${esc(shipment.destination)}</h3><p>${esc(shipment.carrier)} · ${esc(shipment.vehicleId)} · ETA ${esc(shipment.eta || '—')}</p></div>${statusBadge(trackingStatus(shipment))}</div>
      <div class="lm-timeline">${steps.map((step, index) => {
        const event = eventsByStatus.get(step) || (step === 'in-transit' ? eventsByStatus.get('delayed') : null)
        const complete = index <= currentIndex
        const label = step === 'created' ? 'Shipment created' : titleCase(step)
        return `<div class="lm-timeline-step ${complete ? 'is-complete' : ''}"><strong>${esc(label)}</strong><small>${event ? `${fmtDate(event.timestamp, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${esc(event.location)}` : 'Awaiting confirmation'}</small><small>${event ? esc(event.note) : index === 4 ? 'Delivery confirmation pending' : 'Simulated tracking event'}</small></div>`
      }).join('')}</div></article>`
  }).join('') || '<p class="lm-empty">No tracking records match these filters.</p>'
}

function renderExceptions() {
  const filtered = state.exceptions.filter((exception) =>
    (filters.exceptions.severity === 'all' || exception.severity === filters.exceptions.severity)
    && (filters.exceptions.status === 'all' || exception.status === filters.exceptions.status)
    && (filters.exceptions.type === 'all' || exception.type === filters.exceptions.type))
    .sort((a, b) => String(b.reportedAt).localeCompare(String(a.reportedAt)))
  document.getElementById('lm-exception-body').innerHTML = filtered.map((exception) => {
    const shipment = getShipment(exception.shipmentId)
    return `<tr><td><button class="lm-link-button" data-exception-details="${esc(exception.id)}">${esc(exception.id)}</button></td>
      <td><button class="lm-link-button" data-shipment-details="${esc(exception.shipmentId)}">${esc(exception.shipmentId)}</button><small>${esc(shipment?.destination || '')}</small></td>
      <td>${esc(exception.type)}<small>${esc(exception.location)}</small></td><td>${statusBadge(exception.severity)}</td><td>${number(exception.estimatedDelay)} min</td>
      <td>${fmtDate(exception.reportedAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td>${esc(exception.assignedTo || 'Unassigned')}</td><td>${statusBadge(exception.status)}</td>
      <td><div class="lm-row-actions"><button data-exception-details="${esc(exception.id)}">Details</button>${exception.status !== 'resolved' ? `<button data-exception-action="investigate" data-exception-id="${esc(exception.id)}">Investigate</button><button data-exception-action="resolve" data-exception-id="${esc(exception.id)}">Resolve</button>` : ''}</div></td></tr>`
  }).join('') || '<tr><td colspan="9" class="lm-empty">No transport exceptions match these filters.</td></tr>'
}

function renderRoutes() {
  const active = state.routes.filter((route) => route.status === 'active').length
  const disrupted = state.routes.filter((route) => route.status === 'disrupted').length
  setKpis('lm-route-kpis', [
    { label: 'Total routes', value: state.routes.length, note: 'Distinct demo destinations', icon: '↗', page: 'routes' },
    { label: 'Active routes', value: active, note: 'In progress', icon: '●', page: 'routes' },
    { label: 'Disrupted routes', value: disrupted, note: 'Require schedule review', icon: '!', page: 'exceptions' },
    { label: 'Planned departures', value: state.routes.filter((route) => route.status === 'planned').length, note: 'Awaiting dispatch', icon: '◷', page: 'planning' },
  ])
  document.getElementById('lm-route-body').innerHTML = state.routes.map((route) => `
    <tr><td><strong>${esc(route.id)}</strong><small>${esc(route.origin)}</small></td><td>${esc(route.destination)}</td><td>${esc(route.vehicleId || 'Unassigned')}<small>${esc(route.carrier || 'Unassigned carrier')}</small></td>
      <td>${route.shipmentIds.length}${route.shipmentIds.map((id) => `<small><button class="lm-link-button" data-shipment-details="${esc(id)}">${esc(id)}</button></small>`).join('')}</td>
      <td>${fmtDate(route.departure)}</td><td>${fmtDate(route.arrival)}</td><td>${statusBadge(route.status)}</td>
      <td><button data-route-edit="${esc(route.id)}" class="lm-row-actions">Update schedule</button></td></tr>`).join('') || '<tr><td colspan="8" class="lm-empty">No route schedules are available.</td></tr>'
}

function reportShipments() {
  const from = document.getElementById('lm-report-from').value
  const to = document.getElementById('lm-report-to').value
  const carrier = document.getElementById('lm-report-carrier').value
  const vehicle = document.getElementById('lm-report-vehicle').value
  const origin = document.getElementById('lm-report-origin').value
  const destination = document.getElementById('lm-report-destination').value.toLowerCase()
  const status = document.getElementById('lm-report-status').value
  return state.shipments.filter((shipment) => (!from || shipment.dispatchDate >= from)
    && (!to || shipment.dispatchDate <= to)
    && (carrier === 'all' || shipment.carrier === carrier)
    && (vehicle === 'all' || shipment.vehicleId === vehicle)
    && (origin === 'all' || shipment.origin === origin)
    && (!destination || shipment.destination.toLowerCase().includes(destination))
    && (status === 'all' || shipment.status === status))
}
function populateReportOptions() {
  const mappings = [
    ['lm-report-carrier', [...new Set(state.shipments.map((shipment) => shipment.carrier).filter(Boolean))].sort(), 'All carriers'],
    ['lm-report-vehicle', [...new Set(state.shipments.map((shipment) => shipment.vehicleId).filter(Boolean))].sort(), 'All vehicles'],
    ['lm-report-origin', [...new Set(state.shipments.map((shipment) => shipment.origin).filter(Boolean))].sort(), 'All origins'],
    ['lm-report-status', [...new Set(state.shipments.map((shipment) => shipment.status))].sort(), 'All statuses'],
    ['lm-report-disruption', [...new Set(state.exceptions.map((exception) => exception.type))].sort(), 'All types'],
  ]
  mappings.forEach(([id, options, label]) => {
    const select = document.getElementById(id)
    const old = select.value
    select.innerHTML = `<option value="all">${label}</option>` + options.map((value) => `<option value="${esc(value)}">${esc(titleCase(value))}</option>`).join('')
    select.value = options.includes(old) ? old : 'all'
  })
}
function renderReport() {
  populateReportOptions()
  const type = document.getElementById('lm-report-type').value
  const shipments = reportShipments()
  const delivered = shipments.filter((shipment) => shipment.status === 'delivered')
  const rate = delivered.length ? delivered.filter((shipment) => !isLate(shipment)).length / delivered.length * 100 : 0
  const delays = shipments.filter((shipment) => shipment.status === 'delayed')
  document.getElementById('lm-report-summary').innerHTML = [
    ['Shipments', shipments.length],
    ['Delivered', delivered.length],
    ['On-time delivery', `${rate.toFixed(0)}%`],
    ['Delayed / exceptions', `${delays.length} / ${state.exceptions.filter((item) => item.status !== 'resolved').length}`],
  ].map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')
  const carrierValues = [...new Set(shipments.map((shipment) => shipment.carrier))].filter(Boolean).map((carrier) => {
    const items = shipments.filter((shipment) => shipment.carrier === carrier && shipment.status === 'delivered')
    return { label: carrier, value: items.length ? Math.round(items.filter((shipment) => !isLate(shipment)).length / items.length * 100) : 0, suffix: '%' }
  })
  document.getElementById('lm-report-charts').innerHTML = [
    makeChart('Shipment status', 'Filtered shipment count', [...new Set(shipments.map((shipment) => shipment.status))].map((status) => ({ label: titleCase(status), value: shipments.filter((shipment) => shipment.status === status).length })), 'mixed'),
    makeChart('Carrier on-time rate', 'Completed deliveries only', carrierValues, 'green'),
  ].join('')
  let headers = ['Shipment', 'Order', 'Origin', 'Destination', 'Carrier', 'Vehicle', 'Dispatch', 'Expected', 'Actual', 'Status', 'Delay']
  let rows = shipments.map((shipment) => [
    shipment.id, shipment.orderId, shipment.origin, shipment.destination, shipment.carrier, shipment.vehicleId,
    shipment.dispatchDate, shipment.expectedDate, shipment.actualDate || '', shipment.status, shipment.delayReason || '',
  ])
  if (type === 'delayed') {
    const delayed = shipments.filter((shipment) => shipment.status === 'delayed')
    rows = delayed.map((shipment) => [shipment.id, shipment.orderId, shipment.origin, shipment.destination, shipment.carrier, shipment.vehicleId, shipment.dispatchDate, shipment.expectedDate, '', shipment.status, shipment.delayReason || ''])
  } else if (type === 'carrier') {
    headers = ['Carrier', 'Shipments', 'Completed', 'On time %', 'Delayed', 'Failed']
    rows = [...new Set(shipments.map((shipment) => shipment.carrier))].map((carrier) => {
      const metric = carrierMetrics(carrier)
      return [carrier, metric.handled.length, metric.completed.length, `${metric.rate.toFixed(0)}%`, metric.handled.filter((item) => item.status === 'delayed').length, metric.failed]
    })
  } else if (type === 'vehicle') {
    headers = ['Vehicle', 'Registration', 'Type', 'Capacity kg', 'Availability', 'Current shipment']
    rows = state.vehicles.map((vehicle) => {
      const assignment = state.shipments.find((shipment) => shipment.vehicleId === vehicle.id && activeShipment(shipment))
      return [vehicle.id, vehicle.registration, vehicle.type, vehicle.capacity, vehicleAvailability(vehicle), assignment?.id || '']
    })
  } else if (type === 'routes') {
    headers = ['Route', 'Origin', 'Destination', 'Vehicle', 'Carrier', 'Shipment count', 'Departure', 'Arrival', 'Status']
    rows = state.routes.map((route) => [route.id, route.origin, route.destination, route.vehicleId, route.carrier, route.shipmentIds.length, route.departure, route.arrival, route.status])
  } else if (type === 'exceptions') {
    headers = ['Incident', 'Shipment', 'Type', 'Location', 'Severity', 'Delay minutes', 'Reported', 'Status', 'Assigned']
    rows = state.exceptions.filter((exception) => {
      const disruption = document.getElementById('lm-report-disruption').value
      return disruption === 'all' || exception.type === disruption
    }).map((exception) => [exception.id, exception.shipmentId, exception.type, exception.location, exception.severity, exception.estimatedDelay, exception.reportedAt, exception.status, exception.assignedTo])
  } else if (type === 'on-time' || type === 'delivery') {
    headers = ['Shipment', 'Destination', 'Carrier', 'Expected date', 'Actual date', 'Delivery result']
    rows = shipments.filter((shipment) => shipment.status === 'delivered').map((shipment) => [
      shipment.id, shipment.destination, shipment.carrier, shipment.expectedDate, shipment.actualDate, isLate(shipment) ? 'Late' : 'On time',
    ])
  } else if (type === 'cost') {
    headers = ['Cost report status']
    rows = []
  }
  document.getElementById('lm-report-head').innerHTML = `<tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr>`
  document.getElementById('lm-report-body').innerHTML = rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')
    || `<tr><td colspan="${headers.length}" class="lm-empty">${type === 'cost' ? 'Transportation cost data is not provided; no cost metrics are calculated.' : 'No records match this report.'}</td></tr>`
}

function renderActivity() {
  document.getElementById('lm-activity-body').innerHTML = state.activities.map((activity) => `
    <tr><td>${fmtDate(activity.timestamp, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
      <td>${esc(activity.user)}</td><td>${esc(activity.action)}</td>
      <td>${activity.shipmentId ? `<button class="lm-link-button" data-shipment-details="${esc(activity.shipmentId)}">${esc(activity.shipmentId)}</button>` : '—'}</td>
      <td>${esc(activity.reference)}</td><td>${esc(activity.details)}</td></tr>`).join('')
}
function renderNotifications() {
  const unread = state.notifications.filter((notification) => !notification.read).length
  document.getElementById('lm-notification-count').textContent = unread
  document.getElementById('lm-notification-badge').textContent = unread
  const markup = state.notifications.map((notification) => `
    <div class="lm-notification-item"><i class="lm-severity ${notification.read ? 'low' : 'high'}"></i><span class="lm-item-copy"><strong>${esc(notification.title)}</strong><small>${esc(notification.description)} · ${fmtDate(notification.date, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span><button class="lm-text-button" data-notification-id="${esc(notification.id)}">Open</button></div>`).join('') || '<p class="lm-empty">No logistics notifications.</p>'
  document.getElementById('lm-notifications-list').innerHTML = markup
  document.getElementById('lm-notification-modal-list').innerHTML = markup
}

function renderAll() {
  ensureInitialTracking()
  ensureShipmentExceptions()
  renderOverview()
  renderShipments()
  renderPlanning()
  renderVehicles()
  renderCarriers()
  renderTracking()
  renderExceptions()
  renderRoutes()
  renderReport()
  renderActivity()
  renderNotifications()
  persist()
}

function field(label, input, full = false) {
  return `<label class="${full ? 'full' : ''}">${esc(label)}${input}</label>`
}
function openDialog(title, fieldsMarkup, submitLabel, onSubmit) {
  const dialog = document.getElementById('lm-dialog')
  const form = document.getElementById('lm-dialog-form')
  document.getElementById('lm-dialog-title').textContent = title
  document.getElementById('lm-dialog-content').innerHTML = `<div class="lm-dialog-fields">${fieldsMarkup}</div>`
  document.getElementById('lm-dialog-submit').textContent = submitLabel
  document.getElementById('lm-dialog-error').textContent = ''
  form.onsubmit = (event) => {
    event.preventDefault()
    const result = onSubmit(new FormData(form))
    if (result !== false) dialog.close()
  }
  dialog.showModal()
}
document.getElementById('lm-dialog-close').addEventListener('click', () => document.getElementById('lm-dialog').close())
document.getElementById('lm-dialog-cancel').addEventListener('click', () => document.getElementById('lm-dialog').close())
document.getElementById('lm-detail-close').addEventListener('click', () => document.getElementById('lm-detail-dialog').close())
document.getElementById('lm-notification-close').addEventListener('click', () => document.getElementById('lm-notification-dialog').close())

function showShipmentDetails(id) {
  const shipment = getShipment(id)
  if (!shipment) return
  const exceptions = state.exceptions.filter((exception) => exception.shipmentId === id)
  const vehicle = getVehicle(shipment.vehicleId)
  document.getElementById('lm-detail-eyebrow').textContent = 'SHIPMENT DETAILS'
  document.getElementById('lm-detail-title').textContent = shipment.id
  document.getElementById('lm-detail-content').innerHTML = `
    <div class="lm-detail-grid">
      <div><span>Order reference</span><strong>${esc(shipment.orderId)}</strong></div><div><span>Shipment status</span><strong>${esc(titleCase(shipment.status))}</strong></div><div><span>Priority / quantity</span><strong>${esc(titleCase(shipment.priority || 'normal'))} · ${number(shipment.quantity)} units</strong></div>
      <div><span>Origin</span><strong>${esc(shipment.origin)}</strong></div><div><span>Destination</span><strong>${esc(shipment.destination)}</strong></div><div><span>Carrier</span><strong>${esc(shipment.carrier)}</strong></div>
      <div><span>Vehicle / driver</span><strong>${esc(shipment.vehicleId || 'Unassigned')} · ${esc(vehicle?.driver || '—')}</strong></div><div><span>Dispatch</span><strong>${fmtDate(shipment.dispatchDate)}</strong></div><div><span>Expected / actual</span><strong>${fmtDate(shipment.expectedDate)} / ${fmtDate(shipment.actualDate)}</strong></div>
    </div>
    ${shipment.delayReason ? `<p class="lm-note">Delay reason: ${esc(shipment.delayReason)}</p>` : ''}
    <h3>Products</h3>${(shipment.productIds || []).map((productId) => `<div class="lm-detail-event"><span>${esc(productId)}</span><strong>${number(shipment.quantity)} units</strong></div>`).join('') || '<p class="lm-note">No product line items in the demo record.</p>'}
    <h3>Tracking history · simulated</h3><div class="lm-detail-timeline">${(shipment.tracking || []).slice().reverse().map((event) => `<div class="lm-detail-event"><span>${fmtDate(event.timestamp, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${esc(event.location)}<small>${esc(event.note)}</small></span><strong>${esc(titleCase(event.status))}</strong></div>`).join('')}</div>
    <h3>Related exceptions</h3>${exceptions.map((exception) => `<div class="lm-detail-event"><span>${esc(exception.id)} · ${esc(exception.type)} · ${titleCase(exception.status)}</span><strong>${number(exception.estimatedDelay)} min</strong></div>`).join('') || '<p class="lm-note">No transport exceptions linked.</p>'}
    ${shipment.notes?.length ? `<h3>Internal notes</h3>${shipment.notes.map((note) => `<p class="lm-note">${esc(note)}</p>`).join('')}` : ''}
    <div class="lm-actions"><button class="lm-button lm-button-light" data-shipment-action="assign" data-shipment-id="${esc(id)}">Assign carrier / vehicle</button><button class="lm-button lm-button-light" data-shipment-action="note" data-shipment-id="${esc(id)}">Add note</button><button class="lm-button" data-shipment-action="update" data-shipment-id="${esc(id)}">Update status</button></div>`
  const dialog = document.getElementById('lm-detail-dialog')
  if (!dialog.open) dialog.showModal()
}

function showVehicleDetails(id) {
  const vehicle = getVehicle(id)
  if (!vehicle) return
  const assignment = state.shipments.find((shipment) => shipment.vehicleId === id && activeShipment(shipment))
  document.getElementById('lm-detail-eyebrow').textContent = 'VEHICLE DETAILS'
  document.getElementById('lm-detail-title').textContent = vehicle.id
  document.getElementById('lm-detail-content').innerHTML = `<div class="lm-detail-grid">
    <div><span>Registration</span><strong>${esc(vehicle.registration)}</strong></div><div><span>Vehicle type</span><strong>${esc(vehicle.type)}</strong></div><div><span>Capacity</span><strong>${number(vehicle.capacity)} kg</strong></div>
    <div><span>Assigned driver</span><strong>${esc(vehicle.driver)}</strong></div><div><span>Availability</span><strong>${titleCase(vehicleAvailability(vehicle))}</strong></div><div><span>Vehicle status</span><strong>${titleCase(vehicle.status)}</strong></div>
    <div><span>Last location</span><strong>${esc(vehicle.location)}</strong></div><div><span>Current shipment</span><strong>${esc(assignment?.id || 'Unassigned')}</strong></div></div>
    <h3>Maintenance history</h3>${vehicle.maintenance.length ? vehicle.maintenance.map((item) => `<p class="lm-note">${esc(item)}</p>`).join('') : '<p class="lm-note">No maintenance entries recorded.</p>'}
    <div class="lm-actions">${vehicle.status === 'active' ? `<button class="lm-button lm-button-light" data-vehicle-maintenance="${esc(id)}">Record maintenance</button>` : `<button class="lm-button" data-vehicle-activate="${esc(id)}">Mark active</button>`}</div>`
  const dialog = document.getElementById('lm-detail-dialog')
  if (!dialog.open) dialog.showModal()
}

function showCarrierDetails(carrier) {
  const metric = carrierMetrics(carrier)
  const shipmentRows = metric.handled.map((shipment) => `<div class="lm-detail-event"><span><button class="lm-link-button" data-shipment-details="${esc(shipment.id)}">${esc(shipment.id)}</button> · ${esc(shipment.destination)}</span><strong>${titleCase(shipment.status)}</strong></div>`).join('')
  document.getElementById('lm-detail-eyebrow').textContent = 'CARRIER PERFORMANCE'
  document.getElementById('lm-detail-title').textContent = carrier
  document.getElementById('lm-detail-content').innerHTML = `<div class="lm-detail-grid">
    <div><span>Total shipments handled</span><strong>${metric.handled.length}</strong></div><div><span>Successful deliveries</span><strong>${metric.completed.length}</strong></div><div><span>On-time delivery</span><strong>${metric.rate.toFixed(0)}%</strong></div>
    <div><span>Delayed shipments</span><strong>${metric.handled.filter((shipment) => shipment.status === 'delayed').length}</strong></div><div><span>Failed deliveries</span><strong>${metric.failed}</strong></div><div><span>Service regions</span><strong>${[...new Set(metric.handled.map((shipment) => destinationRegion(shipment.destination)))].join(', ')}</strong></div></div>
    <h3>Carrier shipment records</h3>${shipmentRows || '<p class="lm-note">No shipments assigned.</p>'}
    <p class="lm-note">Carrier contact, contract, and cost data are not included in this demo.</p>`
  const dialog = document.getElementById('lm-detail-dialog')
  if (!dialog.open) dialog.showModal()
}

function showExceptionDetails(id) {
  const exception = state.exceptions.find((item) => item.id === id)
  if (!exception) return
  const shipment = getShipment(exception.shipmentId)
  document.getElementById('lm-detail-eyebrow').textContent = 'TRANSPORT INCIDENT'
  document.getElementById('lm-detail-title').textContent = exception.id
  document.getElementById('lm-detail-content').innerHTML = `<div class="lm-detail-grid">
    <div><span>Disruption type</span><strong>${esc(exception.type)}</strong></div><div><span>Severity / status</span><strong>${titleCase(exception.severity)} · ${titleCase(exception.status)}</strong></div><div><span>Estimated delay</span><strong>${number(exception.estimatedDelay)} minutes</strong></div>
    <div><span>Shipment</span><strong>${esc(exception.shipmentId)}</strong></div><div><span>Carrier / vehicle</span><strong>${esc(shipment?.carrier || '—')} · ${esc(shipment?.vehicleId || '—')}</strong></div><div><span>Location</span><strong>${esc(exception.location)}</strong></div>
    <div><span>Reported</span><strong>${fmtDate(exception.reportedAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></div><div><span>Assigned to</span><strong>${esc(exception.assignedTo || 'Unassigned')}</strong></div><div><span>Delivery impact</span><strong>${fmtDate(shipment?.expectedDate)} expected</strong></div></div>
    <p class="lm-note">${esc(exception.description)}</p><h3>Investigation notes &amp; resolution history</h3>${[...exception.notes, ...exception.resolutionHistory].map((note) => `<p class="lm-note">${esc(note)}</p>`).join('')}
    ${exception.status !== 'resolved' ? `<div class="lm-actions"><button class="lm-button lm-button-light" data-exception-action="investigate" data-exception-id="${esc(id)}">Assign / investigate</button><button class="lm-button lm-button-light" data-alternative-plan="${esc(id)}">Record alternative plan</button><button class="lm-button" data-exception-action="resolve" data-exception-id="${esc(id)}">Resolve incident</button></div>` : ''}`
  const dialog = document.getElementById('lm-detail-dialog')
  if (!dialog.open) dialog.showModal()
}

function openNotificationRecord(notification) {
  if (notification.recordType === 'exception') {
    showExceptionDetails(notification.recordId)
    return
  }
  if (notification.recordType === 'vehicle') {
    showVehicleDetails(notification.recordId)
    return
  }
  showShipmentDetails(notification.recordId)
}

function assignShipment(id) {
  const shipment = getShipment(id)
  if (!shipment) return
  document.getElementById('lm-detail-dialog').close()
  const carrierOptions = [...new Set(state.shipments.map((item) => item.carrier).filter(Boolean))]
  const availableVehicles = state.vehicles.filter((vehicle) => vehicleAvailability(vehicle) === 'available' || vehicle.id === shipment.vehicleId)
  const options = availableVehicles.map((vehicle) => `<option value="${esc(vehicle.id)}" ${vehicle.id === shipment.vehicleId ? 'selected' : ''}>${esc(vehicle.id)} · ${number(vehicle.capacity)} kg · ${esc(vehicle.driver)}</option>`).join('')
  openDialog(`Assign transport · ${id}`, `
    ${field('Carrier', `<select name="carrier" required>${carrierOptions.map((carrier) => `<option ${carrier === shipment.carrier ? 'selected' : ''}>${esc(carrier)}</option>`).join('')}</select>`)}
    ${field('Available vehicle', `<select name="vehicleId" required><option value="">Select a vehicle</option>${options}</select>`)}
    ${field('Planned dispatch', `<input name="plannedDate" type="date" value="${esc(shipment.dispatchDate || localDateKey())}" required>`)}
    ${field('Priority', `<select name="priority">${['critical', 'high', 'normal'].map((value) => `<option value="${value}" ${shipment.priority === value ? 'selected' : ''}>${titleCase(value)}</option>`).join('')}</select>`)}
    <p class="lm-permission-note full">A vehicle is only assignable when available or already assigned to this shipment. A conflicting active assignment cannot be overwritten.</p>`,
  'Confirm transport plan', (data) => {
    const vehicle = getVehicle(String(data.get('vehicleId')))
    const carrier = String(data.get('carrier'))
    if (!vehicle || !carrier) {
      document.getElementById('lm-dialog-error').textContent = 'Select a carrier and an available vehicle.'
      return false
    }
    if (vehicleAvailability(vehicle) !== 'available' && vehicle.id !== shipment.vehicleId) {
      document.getElementById('lm-dialog-error').textContent = `${vehicle.id} is no longer available for assignment.`
      return false
    }
    const previousCarrier = shipment.carrier
    const previousVehicle = shipment.vehicleId
    shipment.carrier = carrier
    shipment.vehicleId = vehicle.id
    shipment.dispatchDate = String(data.get('plannedDate'))
    shipment.priority = String(data.get('priority'))
    if (shipment.status === 'pending-dispatch') shipment.status = 'ready-for-dispatch'
    addActivity('Transport resources assigned', id, `PLN-${id.slice(-4)}`, `${previousCarrier} / ${previousVehicle} → ${carrier} / ${vehicle.id}`)
    addNotification('Transport plan updated', `${id} assigned to ${carrier} · ${vehicle.id}.`, 'shipments', id)
    renderAll()
  })
}

function updateShipmentStatus(id) {
  const shipment = getShipment(id)
  if (!shipment) return
  document.getElementById('lm-detail-dialog').close()
  const statuses = ['pending-dispatch', 'ready-for-dispatch', 'in-transit', 'out-for-delivery', 'delayed', 'delivered', 'failed', 'cancelled']
  openDialog(`Update shipment status · ${id}`, `
    ${field('Current status', `<select name="status" required>${statuses.map((status) => `<option value="${status}" ${status === shipment.status ? 'selected' : ''}>${titleCase(status)}</option>`).join('')}</select>`)}
    ${field('Delivery / update date', `<input name="eventDate" type="date" value="${localDateKey()}" required>`)}
    ${field('Current location', `<input name="location" value="${shipment.status === 'delivered' ? esc(shipment.destination) : esc(shipment.origin)}" required>`)}
    ${field('Update note', '<textarea name="note" placeholder="Add carrier update or delivery confirmation"></textarea>', true)}`,
  'Save shipment update', (data) => {
    const nextStatus = String(data.get('status'))
    const previous = shipment.status
    const note = String(data.get('note')).trim()
    const dateValue = String(data.get('eventDate'))
    if (nextStatus === 'delivered' && !note) {
      document.getElementById('lm-dialog-error').textContent = 'Add a delivery confirmation note before marking the shipment delivered.'
      return false
    }
    if (['in-transit', 'out-for-delivery', 'delayed'].includes(nextStatus) && !shipment.vehicleId) {
      document.getElementById('lm-dialog-error').textContent = 'Assign a carrier and vehicle before moving this shipment.'
      return false
    }
    if (nextStatus === 'delivered') shipment.actualDate = dateValue
    shipment.status = nextStatus
    if (note) shipment.notes.unshift(`${fmtDate(new Date(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${settings.displayName}: ${note}`)
    makeTrackingEvent(shipment)
    if (nextStatus === 'delayed') {
      let exception = state.exceptions.find((item) => item.shipmentId === id && item.status !== 'resolved')
      if (!exception) {
        exception = {
          id: `DSP-${Date.now().toString().slice(-6)}`, shipmentId: id, type: 'Carrier failure',
          location: String(data.get('location')), severity: shipment.priority === 'critical' ? 'critical' : 'high',
          estimatedDelay: 60, reportedAt: new Date().toISOString(), status: 'open',
          assignedTo: '', description: note || 'Shipment status changed to delayed.',
          notes: [], resolutionHistory: [],
        }
        state.exceptions.unshift(exception)
        addNotification('Shipment delay reported', `${id} · ${exception.description}`, 'exceptions', exception.id, 'exception')
      }
    }
    if (nextStatus === 'delivered' && previous !== 'delivered') {
      addNotification('Delivery confirmation recorded', `${id} delivered to ${shipment.destination}.`, 'shipments', id)
    }
    addActivity('Shipment status updated', id, shipment.orderId, `${titleCase(previous)} → ${titleCase(nextStatus)}${note ? ` · ${note}` : ''}`)
    renderAll()
  })
}

function addShipmentNote(id) {
  const shipment = getShipment(id)
  if (!shipment) return
  document.getElementById('lm-detail-dialog').close()
  openDialog(`Add internal note · ${id}`, field('Note', '<textarea name="note" required placeholder="Record investigation or carrier communication"></textarea>', true), 'Save note', (data) => {
    const note = String(data.get('note')).trim()
    if (!note) {
      document.getElementById('lm-dialog-error').textContent = 'Enter a note before saving.'
      return false
    }
    shipment.notes.unshift(`${fmtDate(new Date(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${settings.displayName}: ${note}`)
    makeTrackingEvent(shipment)
    addActivity('Shipment note added', id, shipment.orderId, note)
    renderAll()
  })
}

function createException(shipmentId = '') {
  document.getElementById('lm-detail-dialog').close()
  const shipmentOptions = state.shipments.map((shipment) => `<option value="${esc(shipment.id)}" ${shipment.id === shipmentId ? 'selected' : ''}>${esc(shipment.id)} · ${esc(shipment.destination)}</option>`).join('')
  const types = ['Traffic congestion', 'Vehicle breakdown', 'Weather disruption', 'Road closure', 'Carrier failure', 'Missed pickup', 'Customs delay', 'Delivery address issue', 'Missing tracking update']
  openDialog('Report transport disruption', `
    ${field('Shipment', `<select name="shipmentId" required>${shipmentOptions}</select>`, true)}
    ${field('Disruption type', `<select name="type">${types.map((type) => `<option>${esc(type)}</option>`).join('')}</select>`)}
    ${field('Severity', '<select name="severity"><option value="critical">Critical</option><option value="high" selected>High</option><option value="medium">Medium</option><option value="low">Low</option></select>')}
    ${field('Location', '<input name="location" required>')}
    ${field('Estimated delay (minutes)', '<input name="delay" type="number" min="0" value="60" required>')}
    ${field('Description', '<textarea name="description" required placeholder="Describe the issue and expected delivery impact"></textarea>', true)}`,
  'Create exception', (data) => {
    const shipment = getShipment(String(data.get('shipmentId')))
    const delay = Number(data.get('delay'))
    const description = String(data.get('description')).trim()
    if (!shipment || !Number.isInteger(delay) || delay < 0 || !description) {
      document.getElementById('lm-dialog-error').textContent = 'Select a shipment and enter a description and valid delay.'
      return false
    }
    const exception = {
      id: `DSP-${Date.now().toString().slice(-6)}`, shipmentId: shipment.id,
      type: String(data.get('type')), location: String(data.get('location')).trim(),
      severity: String(data.get('severity')), estimatedDelay: delay,
      reportedAt: new Date().toISOString(), status: 'open', assignedTo: '',
      description, notes: [`Reported by ${settings.displayName}.`], resolutionHistory: [],
    }
    state.exceptions.unshift(exception)
    shipment.status = 'delayed'
    shipment.delayReason = description
    makeTrackingEvent(shipment)
    addActivity('Transport disruption reported', shipment.id, exception.id, `${exception.type} · ${description}`)
    addNotification('New transport disruption', `${shipment.id} · ${exception.type}`, 'exceptions', exception.id, 'exception')
    renderAll()
  })
}

function updateException(id, action) {
  const exception = state.exceptions.find((item) => item.id === id)
  if (!exception) return
  if (action === 'investigate') {
    exception.status = 'investigating'
    exception.assignedTo = settings.displayName
    exception.notes.unshift(`${fmtDate(new Date(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · Assigned and investigation started by ${settings.displayName}.`)
    addActivity('Transport incident investigation started', exception.shipmentId, exception.id, exception.type)
  } else {
    exception.status = 'resolved'
    const historyLine = `${fmtDate(new Date(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · Resolved by ${settings.displayName}.`
    exception.resolutionHistory.unshift(historyLine)
    exception.notes.unshift(historyLine)
    const shipment = getShipment(exception.shipmentId)
    if (shipment?.status === 'delayed') {
      shipment.status = 'in-transit'
      shipment.delayReason = ''
      makeTrackingEvent(shipment)
    }
    addActivity('Transport incident resolved', exception.shipmentId, exception.id, exception.type)
  }
  renderAll()
}

function alternativePlan(id) {
  const exception = state.exceptions.find((item) => item.id === id)
  if (!exception) return
  document.getElementById('lm-detail-dialog').close()
  const shipment = getShipment(exception.shipmentId)
  const vehicles = state.vehicles.filter((vehicle) => vehicleAvailability(vehicle) === 'available' || vehicle.id === shipment?.vehicleId)
  openDialog(`Record alternative plan · ${id}`, `
    ${field('Alternative vehicle', `<select name="vehicleId"><option value="">Keep current vehicle</option>${vehicles.map((vehicle) => `<option value="${esc(vehicle.id)}">${esc(vehicle.id)} · ${esc(vehicle.driver)}</option>`).join('')}</select>`)}
    ${field('Revised expected date', `<input name="expectedDate" type="date" value="${esc(shipment?.expectedDate || '')}">`)}
    ${field('Route / schedule note', '<textarea name="note" required placeholder="Record alternative route or transport action"></textarea>', true)}
    <p class="lm-permission-note full">Recording an alternative plan does not resolve the exception. Resolve it separately after confirming the delivery risk has cleared.</p>`,
  'Save alternative plan', (data) => {
    const note = String(data.get('note')).trim()
    const vehicleId = String(data.get('vehicleId'))
    if (!note) {
      document.getElementById('lm-dialog-error').textContent = 'Describe the alternative transport plan.'
      return false
    }
    if (vehicleId && (!getVehicle(vehicleId) || (vehicleAvailability(getVehicle(vehicleId)) !== 'available' && vehicleId !== shipment?.vehicleId))) {
      document.getElementById('lm-dialog-error').textContent = 'The selected vehicle is not available.'
      return false
    }
    if (shipment) {
      if (vehicleId) shipment.vehicleId = vehicleId
      const expectedDate = String(data.get('expectedDate'))
      if (expectedDate) shipment.expectedDate = expectedDate
      shipment.notes.unshift(`Alternative plan: ${note}`)
      makeTrackingEvent(shipment)
    }
    exception.notes.unshift(`Alternative plan recorded by ${settings.displayName}: ${note}`)
    addActivity('Alternative transport plan recorded', exception.shipmentId, exception.id, note)
    addNotification('Alternative transport plan updated', `${exception.shipmentId} · ${note}`, 'exceptions', exception.id, 'exception')
    renderAll()
  })
}

function assignPlanning(id) { assignShipment(id) }
function dispatchShipment(id) {
  const shipment = getShipment(id)
  if (!shipment) return
  if (!shipment.carrier || !shipment.vehicleId || !getVehicle(shipment.vehicleId)) {
    createException(id)
    return
  }
  const vehicle = getVehicle(shipment.vehicleId)
  if (vehicleAvailability(vehicle) !== 'available' && !state.shipments.some((item) => item.id === id && item.vehicleId === vehicle.id)) {
    window.alert(`${vehicle.id} is already assigned to an active shipment.`)
    return
  }
  const previous = shipment.status
  shipment.status = 'in-transit'
  shipment.dispatchDate = localDateKey()
  makeTrackingEvent(shipment)
  addActivity('Shipment dispatched', id, shipment.orderId, `${shipment.carrier} · ${shipment.vehicleId}`)
  addNotification('Shipment dispatched', `${id} is now in transit.`, 'tracking', id)
  renderAll()
}

function createRoute() {
  const destinationsForRoute = [...new Set(state.shipments.map((shipment) => shipment.destination))]
  const destinationOptions = destinationsForRoute.map((destination) => `<option>${esc(destination)}</option>`).join('')
  const carrierOptions = [...new Set(state.shipments.map((shipment) => shipment.carrier).filter(Boolean))].map((carrier) => `<option>${esc(carrier)}</option>`).join('')
  const vehicleOptions = state.vehicles.filter((vehicle) => vehicleAvailability(vehicle) === 'available').map((vehicle) => `<option value="${esc(vehicle.id)}">${esc(vehicle.id)}</option>`).join('')
  openDialog('Plan transportation route', `
    ${field('Origin', '<input name="origin" value="Central Distribution Warehouse" required>')}
    ${field('Destination', `<select name="destination" required>${destinationOptions}</select>`)}
    ${field('Carrier', `<select name="carrier">${carrierOptions}</select>`)}
    ${field('Available vehicle', `<select name="vehicleId"><option value="">Unassigned</option>${vehicleOptions}</select>`)}
    ${field('Planned departure', `<input name="departure" type="date" value="${localDateKey()}" required>`)}
    ${field('Expected arrival', `<input name="arrival" type="date" required>`)}
    ${field('Shipment', `<select name="shipmentId"><option value="">Route only</option>${state.shipments.filter((shipment) => activeShipment(shipment)).map((shipment) => `<option value="${esc(shipment.id)}">${esc(shipment.id)} · ${esc(shipment.destination)}</option>`).join('')}</select>`)}
    <p class="lm-permission-note full">Route schedule is illustrative; no live route geometry or travel-time service is connected.</p>`,
  'Save route plan', (data) => {
    const destination = String(data.get('destination'))
    const departure = String(data.get('departure'))
    const arrival = String(data.get('arrival'))
    const vehicleId = String(data.get('vehicleId'))
    const shipmentId = String(data.get('shipmentId'))
    if (!destination || (departure && arrival && departure > arrival)) {
      document.getElementById('lm-dialog-error').textContent = 'Choose a destination and ensure arrival is not before departure.'
      return false
    }
    const vehicle = vehicleId ? getVehicle(vehicleId) : null
    if (vehicleId && (!vehicle || vehicleAvailability(vehicle) !== 'available')) {
      document.getElementById('lm-dialog-error').textContent = 'Selected vehicle is no longer available.'
      return false
    }
    const route = {
      id: `RTE-${Date.now().toString().slice(-6)}`,
      origin: String(data.get('origin')).trim(), destination,
      carrier: String(data.get('carrier')), vehicleId,
      shipmentIds: shipmentId ? [shipmentId] : [],
      departure, arrival, status: 'planned',
    }
    state.routes.unshift(route)
    if (shipmentId) {
      const shipment = getShipment(shipmentId)
      if (shipment) {
        shipment.origin = route.origin
        shipment.destination = destination
        shipment.carrier = route.carrier
        if (vehicleId) shipment.vehicleId = vehicleId
        shipment.dispatchDate = departure
        shipment.expectedDate = arrival
        if (shipment.status === 'pending-dispatch') shipment.status = 'ready-for-dispatch'
      }
    }
    addActivity('Route scheduled', shipmentId, route.id, `${route.origin} → ${route.destination}`)
    renderAll()
  })
}

function updateRoute(id) {
  const route = state.routes.find((item) => item.id === id)
  if (!route) return
  openDialog(`Update route schedule · ${id}`, `
    ${field('Planned departure', `<input name="departure" type="date" value="${esc(route.departure)}" required>`)}
    ${field('Expected arrival', `<input name="arrival" type="date" value="${esc(route.arrival)}" required>`)}
    ${field('Route status', `<select name="status">${['planned', 'active', 'completed', 'disrupted'].map((status) => `<option value="${status}" ${status === route.status ? 'selected' : ''}>${titleCase(status)}</option>`).join('')}</select>`)}
    ${field('Schedule note', '<textarea name="note"></textarea>', true)}`,
  'Save schedule', (data) => {
    const departure = String(data.get('departure'))
    const arrival = String(data.get('arrival'))
    if (arrival < departure) {
      document.getElementById('lm-dialog-error').textContent = 'Expected arrival cannot be earlier than planned departure.'
      return false
    }
    route.departure = departure
    route.arrival = arrival
    route.status = String(data.get('status'))
    const note = String(data.get('note')).trim()
    addActivity('Route schedule updated', route.shipmentIds[0], route.id, note || `${departure} → ${arrival} · ${route.status}`)
    renderAll()
  })
}

function vehicleMaintenance(id) {
  const vehicle = getVehicle(id)
  if (!vehicle) return
  const assignment = state.shipments.find((shipment) => shipment.vehicleId === id && activeShipment(shipment))
  if (assignment) {
    window.alert(`${id} is assigned to active shipment ${assignment.id}; reassign or complete the shipment before maintenance.`)
    return
  }
  openDialog(`Record maintenance · ${id}`, field('Maintenance note', '<textarea name="note" required placeholder="Service or repair details"></textarea>', true), 'Save maintenance', (data) => {
    const note = String(data.get('note')).trim()
    if (!note) {
      document.getElementById('lm-dialog-error').textContent = 'Enter a maintenance note.'
      return false
    }
    vehicle.status = 'maintenance'
    vehicle.maintenance.unshift(`${fmtDate(new Date())} · ${note}`)
    addActivity('Vehicle marked for maintenance', '', id, note)
    addNotification('Vehicle unavailable', `${id} is under maintenance.`, 'vehicles', id, 'vehicle')
    renderAll()
  })
}
function activateVehicle(id) {
  const vehicle = getVehicle(id)
  if (!vehicle) return
  vehicle.status = 'active'
  addActivity('Vehicle returned to active fleet', '', id, vehicle.registration)
  renderAll()
}
function addVehicle() {
  openDialog('Add demo vehicle', `
    ${field('Vehicle ID', '<input name="id" required placeholder="TRK-X01">')}
    ${field('Registration', '<input name="registration" required>')}
    ${field('Type', '<select name="type"><option>Truck</option><option>Heavy truck</option><option>Container truck</option><option>Delivery van</option></select>')}
    ${field('Capacity (kg)', '<input name="capacity" type="number" min="1" required>')}
    ${field('Driver', '<input name="driver" required>')}
    ${field('Current location', '<input name="location" value="Central Distribution Warehouse" required>')}`,
  'Add vehicle', (data) => {
    const id = String(data.get('id')).trim().toUpperCase()
    const capacity = Number(data.get('capacity'))
    if (!id || state.vehicles.some((vehicle) => vehicle.id === id) || !Number.isInteger(capacity) || capacity <= 0) {
      document.getElementById('lm-dialog-error').textContent = 'Vehicle ID must be unique and capacity must be a positive whole number.'
      return false
    }
    state.vehicles.push({
      id, registration: String(data.get('registration')).trim(),
      type: String(data.get('type')), capacity, driver: String(data.get('driver')).trim(),
      location: String(data.get('location')).trim(), status: 'active', maintenance: [],
    })
    addActivity('Vehicle added to demo fleet', '', id, `${capacity} kg · ${String(data.get('type'))}`)
    renderAll()
  })
}

function openRecord(type, id) {
  if (type === 'shipment') showShipmentDetails(id)
  if (type === 'exception') showExceptionDetails(id)
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
function exportShipments() {
  const rows = state.shipments.map((shipment) => [shipment.id, shipment.orderId, shipment.origin, shipment.destination, shipment.carrier, shipment.vehicleId, shipment.dispatchDate, shipment.expectedDate, shipment.actualDate, shipment.status, shipment.delayReason])
  exportCsv('logistics-shipments.csv', ['Shipment', 'Order', 'Origin', 'Destination', 'Carrier', 'Vehicle', 'Dispatch', 'Expected', 'Actual', 'Status', 'Delay reason'], rows)
}
function exportReport() {
  const headers = [...document.querySelectorAll('#lm-report-head th')].map((item) => item.textContent)
  const rows = [...document.querySelectorAll('#lm-report-body tr')].filter((row) => !row.querySelector('.lm-empty')).map((row) => [...row.cells].map((cell) => cell.textContent))
  exportCsv(`${document.getElementById('lm-report-type').value}-logistics-report.csv`, headers, rows)
}
function exportActivity() {
  exportCsv('logistics-activity.csv', ['Timestamp', 'User', 'Action', 'Shipment', 'Reference', 'Details'],
    state.activities.map((item) => [item.timestamp, item.user, item.action, item.shipmentId, item.reference, item.details]))
}

document.addEventListener('click', (event) => {
  const detail = event.target.closest('[data-shipment-details]')
  if (detail) { showShipmentDetails(detail.dataset.shipmentDetails); return }
  const vehicleDetail = event.target.closest('[data-vehicle-details]')
  if (vehicleDetail) { showVehicleDetails(vehicleDetail.dataset.vehicleDetails); return }
  const carrierDetail = event.target.closest('[data-carrier-details]')
  if (carrierDetail) { showCarrierDetails(carrierDetail.dataset.carrierDetails); return }
  const exceptionDetail = event.target.closest('[data-exception-details]')
  if (exceptionDetail) { showExceptionDetails(exceptionDetail.dataset.exceptionDetails); return }
  const recordButton = event.target.closest('[data-open-record]')
  if (recordButton) {
    const [type, id] = recordButton.dataset.openRecord.split(':')
    openRecord(type, id)
    return
  }
  const plan = event.target.closest('[data-plan-shipment]')
  if (plan) { assignPlanning(plan.dataset.planShipment); return }
  const dispatch = event.target.closest('[data-dispatch]')
  if (dispatch) { dispatchShipment(dispatch.dataset.dispatch); return }
  const update = event.target.closest('[data-shipment-update]')
  if (update) { updateShipmentStatus(update.dataset.shipmentUpdate); return }
  const shipmentAction = event.target.closest('[data-shipment-action]')
  if (shipmentAction) {
    const { shipmentId, shipmentAction: action } = shipmentAction.dataset
    if (action === 'assign') assignShipment(shipmentId)
    if (action === 'note') addShipmentNote(shipmentId)
    if (action === 'update') updateShipmentStatus(shipmentId)
    return
  }
  const exceptionAction = event.target.closest('[data-exception-action]')
  if (exceptionAction) { updateException(exceptionAction.dataset.exceptionId, exceptionAction.dataset.exceptionAction); return }
  const alternative = event.target.closest('[data-alternative-plan]')
  if (alternative) { alternativePlan(alternative.dataset.alternativePlan); return }
  const maintenance = event.target.closest('[data-vehicle-maintenance]')
  if (maintenance) { vehicleMaintenance(maintenance.dataset.vehicleMaintenance); return }
  const activate = event.target.closest('[data-vehicle-activate]')
  if (activate) { activateVehicle(activate.dataset.vehicleActivate); return }
  const routeEdit = event.target.closest('[data-route-edit]')
  if (routeEdit) { updateRoute(routeEdit.dataset.routeEdit); return }
  const notification = event.target.closest('[data-notification-id]')
  if (notification) {
    const item = state.notifications.find((entry) => entry.id === notification.dataset.notificationId)
    if (!item) return
    item.read = true
    const page = pageIds.has(item.page) ? item.page : 'shipments'
    const modal = document.getElementById('lm-notification-dialog')
    if (modal.open) modal.close()
    if (location.hash !== `#${page}`) history.pushState(null, '', `#${page}`)
    showPage(page)
    renderAll()
    openNotificationRecord(item)
  }
})

document.getElementById('lm-global-search').addEventListener('input', (event) => {
  filters.shipments.query = event.target.value.trim()
  document.getElementById('lm-shipment-search').value = event.target.value
  if (location.hash !== '#shipments') history.pushState(null, '', '#shipments')
  showPage('shipments')
  renderShipments()
})
document.getElementById('lm-shipment-search').addEventListener('input', (event) => { filters.shipments.query = event.target.value.trim(); renderShipments() })
document.getElementById('lm-shipment-status').addEventListener('change', (event) => { filters.shipments.status = event.target.value; renderShipments() })
document.getElementById('lm-shipment-carrier').addEventListener('change', (event) => { filters.shipments.carrier = event.target.value; renderShipments() })
document.getElementById('lm-shipment-destination').addEventListener('input', (event) => { filters.shipments.destination = event.target.value.trim(); renderShipments() })
document.getElementById('lm-shipment-region').addEventListener('change', (event) => { filters.shipments.region = event.target.value; renderShipments() })
document.getElementById('lm-region').addEventListener('change', (event) => {
  filters.shipments.region = event.target.value
  document.getElementById('lm-shipment-region').value = event.target.value
  renderShipments()
})
document.getElementById('lm-vehicle-search').addEventListener('input', (event) => { filters.vehicles.query = event.target.value.trim(); renderVehicles() })
document.getElementById('lm-vehicle-status').addEventListener('change', (event) => { filters.vehicles.status = event.target.value; renderVehicles() })
document.getElementById('lm-tracking-search').addEventListener('input', (event) => { filters.tracking.query = event.target.value.trim(); renderTracking() })
document.getElementById('lm-tracking-status').addEventListener('change', (event) => { filters.tracking.status = event.target.value; renderTracking() })
;[['lm-exception-severity', 'severity'], ['lm-exception-status', 'status'], ['lm-exception-type', 'type']].forEach(([id, key]) => {
  document.getElementById(id).addEventListener('change', (event) => { filters.exceptions[key] = event.target.value; renderExceptions() })
})
document.getElementById('lm-create-exception').addEventListener('click', () => createException())
document.getElementById('lm-new-exception').addEventListener('click', () => createException())
document.getElementById('lm-new-route').addEventListener('click', createRoute)
document.getElementById('lm-new-vehicle').addEventListener('click', addVehicle)
document.getElementById('lm-export-shipments').addEventListener('click', exportShipments)
document.getElementById('lm-report-export').addEventListener('click', exportReport)
document.getElementById('lm-report-print').addEventListener('click', () => window.print())
document.getElementById('lm-activity-export').addEventListener('click', exportActivity)
;['lm-report-type', 'lm-report-from', 'lm-report-to', 'lm-report-carrier', 'lm-report-vehicle', 'lm-report-origin', 'lm-report-destination', 'lm-report-status', 'lm-report-disruption'].forEach((id) => {
  document.getElementById(id).addEventListener(id.endsWith('destination') ? 'input' : 'change', renderReport)
})
document.getElementById('lm-notification-button').addEventListener('click', () => {
  renderNotifications()
  document.getElementById('lm-notification-dialog').showModal()
})
;['lm-read-all', 'lm-notification-read-all'].forEach((id) => {
  document.getElementById(id).addEventListener('click', () => {
    state.notifications.forEach((notification) => { notification.read = true })
    addActivity('Notifications marked read', '', 'notifications', 'All logistics notifications marked as read.')
    renderAll()
  })
})
document.getElementById('lm-settings-name').value = settings.displayName
document.getElementById('lm-settings-region').value = settings.region
document.getElementById('lm-settings-notifications').checked = settings.notificationsEnabled
document.getElementById('lm-user-name').textContent = settings.displayName
document.getElementById('lm-settings-save').addEventListener('click', () => {
  const name = document.getElementById('lm-settings-name').value.trim()
  if (!name) {
    document.getElementById('lm-settings-status').textContent = 'Enter a display name before saving.'
    return
  }
  settings.displayName = name
  settings.region = document.getElementById('lm-settings-region').value
  settings.notificationsEnabled = document.getElementById('lm-settings-notifications').checked
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  document.getElementById('lm-user-name').textContent = name
  document.getElementById('lm-region').value = settings.region
  addActivity('Workspace settings updated', '', 'settings', `Name: ${name} · Region: ${settings.region}`)
  document.getElementById('lm-settings-status').textContent = 'Preferences saved in this browser.'
  renderAll()
})

function applyKpiFilter(filterKey, value) {
  if (filterKey === 'report') {
    document.getElementById('lm-report-type').value = value
    renderReport()
    return
  }
  if (filterKey === 'shipmentStatus') {
    filters.shipments.status = value
    document.getElementById('lm-shipment-status').value = value
    renderShipments()
  } else if (filterKey === 'vehicleStatus') {
    filters.vehicles.status = value
    document.getElementById('lm-vehicle-status').value = value
    renderVehicles()
  } else if (filterKey === 'exceptionStatus') {
    filters.exceptions.status = value
    document.getElementById('lm-exception-status').value = value
    renderExceptions()
  }
}
document.addEventListener('click', (event) => {
  const kpi = event.target.closest('[data-filter-key]')
  if (!kpi) return
  const key = kpi.dataset.filterKey
  const value = kpi.dataset.filterValue
  const page = kpi.hash.slice(1)
  if (!pageIds.has(page)) return
  event.preventDefault()
  if (location.hash !== `#${page}`) history.pushState(null, '', `#${page}`)
  applyKpiFilter(key, value)
  showPage(page)
})

renderAll()
showPage(location.hash.slice(1) || 'overview')
document.getElementById('lm-current-date').textContent = fmtDate(new Date(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
window.__logisticsManager = {
  getState: () => clone(state),
  getMetrics: () => ({
    totalShipments: state.shipments.length,
    activeShipments: state.shipments.filter((shipment) => ['in-transit', 'delayed', 'out-for-delivery'].includes(shipment.status)).length,
    pendingDispatch: state.shipments.filter((shipment) => ['pending-dispatch', 'ready-for-dispatch'].includes(shipment.status)).length,
    deliveredToday: state.shipments.filter((shipment) => shipment.status === 'delivered' && shipment.actualDate === localDateKey()).length,
    delayedShipments: state.shipments.filter((shipment) => shipment.status === 'delayed').length,
    onTimeRate: onTimeRate(),
    activeVehicles: state.vehicles.filter((vehicle) => vehicleAvailability(vehicle) === 'assigned').length,
    availableVehicles: state.vehicles.filter((vehicle) => vehicleAvailability(vehicle) === 'available').length,
    activeCarriers: new Set(state.shipments.filter(activeShipment).map((shipment) => shipment.carrier)).size,
    openExceptions: state.exceptions.filter((exception) => exception.status !== 'resolved').length,
  }),
}
