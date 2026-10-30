const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character])

const number = value => new Intl.NumberFormat().format(Number(value) || 0)
const titleCase = value => String(value || 'Unknown')
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, letter => letter.toUpperCase())

function dayValue(value) {
  if (!value) return null
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function todayUTC() {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

export function delayDaysUntil(value) {
  const date = dayValue(value)
  if (!date) return 0
  return Math.max(0, Math.ceil((todayUTC() - date.getTime()) / 86400000))
}

function severityFor(order, orderDelay) {
  const priority = String(order.priority || '').toUpperCase()
  if (orderDelay >= 4 || priority === 'CRITICAL') return 'critical'
  if (orderDelay >= 1 || priority === 'HIGH') return 'high'
  if (priority === 'MEDIUM') return 'medium'
  return 'low'
}

function truncate(value, length) {
  const text = String(value ?? '')
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}

function node({ x, y, width = 176, height = 74, title, subtitle, meta, tone = 'default', kind, id, reveal, bar }) {
  const left = x - width / 2
  const top = y - height / 2
  const metaLine = meta
    ? `<text class="impact-node-meta" x="14" y="${height - 14}">${escapeHTML(meta)}</text>`
    : ''
  const barMarkup = bar
    ? `<rect class="impact-stock-track" x="14" y="${height - 30}" width="${width - 28}" height="6" rx="3" />
       <rect class="impact-stock-fill" x="14" y="${height - 30}" width="${Math.max(2, Math.min(1, bar.ratio) * (width - 28))}" height="6" rx="3" />`
    : ''
  return `<g class="impact-node impact-node--${tone}" transform="translate(${left} ${top})" data-impact-kind="${escapeHTML(kind)}" data-impact-id="${escapeHTML(id)}" style="--reveal:${reveal}s" tabindex="0" role="button" aria-label="${escapeHTML(`${kind} ${id}: ${title}`)}">
    <rect class="impact-node-card" width="${width}" height="${height}" rx="14" />
    <rect class="impact-node-accent" width="4" height="${height}" rx="2" />
    <text class="impact-node-kicker" x="14" y="20">${escapeHTML(titleCase(kind))}${bar ? '' : ''}</text>
    <text class="impact-node-title" x="14" y="42">${escapeHTML(truncate(title, 26))}</text>
    ${barMarkup}
    ${bar ? '' : metaLine}
  </g>`
}

function edge({ from, to, depth, tone, curve = 60 }) {
  const x1 = from.x + 88
  const y1 = from.y
  const x2 = to.x - 88
  const y2 = to.y
  const path = `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`
  return `<g class="impact-edge-group impact-edge-group--${tone}" style="--depth:${depth}">
    <path class="impact-edge impact-edge--${tone}" d="${path}" />
    <circle class="impact-pulse impact-pulse--${tone}" r="4">
      <animateMotion dur="2.8s" begin="${depth * 0.35}s" repeatCount="indefinite" path="${path}" />
    </circle>
  </g>`
}

export function buildImpactGraph(container, impact, { onSelect } = {}) {
  if (!container) return
  if (!impact) {
    container.innerHTML = '<div class="impact-graph-empty">Select a shipment to render its backend impact chain.</div>'
    return
  }
  const orders = Array.isArray(impact.affectedOrders) ? impact.affectedOrders : []
  const orderCount = Math.max(1, orders.length)
  const height = Math.max(460, orderCount * 84 + 150)
  const midY = Math.round(height / 2)
  const startY = orderCount === 1 ? midY : 105
  const orderGap = orderCount === 1 ? 0 : (height - 210) / (orderCount - 1)
  const maxDelay = orders.reduce((max, order) => Math.max(max, delayDaysUntil(order.promisedDelivery)), 0)
  const availableRatio = impact.onHand > 0 ? Number(impact.available || 0) / Number(impact.onHand || 1) : 0
  const inventoryTone = Number(impact.available || 0) <= 0
    ? 'critical'
    : Number(impact.available || 0) <= Number(impact.reorderPoint || 0)
      ? 'high'
      : 'low'
  const shipmentTone = String(impact.shipmentStatus || '').toUpperCase().match(/DELAY|DISRUPT|FAIL|CANCEL/)
    ? 'critical'
    : 'default'

  const supplier = { x: 100, y: midY }
  const shipment = { x: 300, y: midY }
  const warehouse = { x: 500, y: midY }
  const inventory = { x: 700, y: midY }
  const product = { x: 900, y: midY }
  const orderX = 1100
  const customerX = 1300

  const orderNodes = orders.map((order, index) => {
    const y = orderCount === 1 ? midY : startY + index * orderGap
    const delay = delayDaysUntil(order.promisedDelivery)
    const tone = severityFor(order, delay)
    return {
      x: orderX,
      y,
      tone,
      delay,
      markup: node({
        x: orderX,
        y,
        width: 158,
        height: 64,
        title: order.orderId || 'Order',
        subtitle: '',
        meta: `${titleCase(order.priority)} · ${number(order.quantity)} units${delay ? ` · +${delay}d` : ''}`,
        tone,
        kind: 'order',
        id: order.orderId || '',
        reveal: 1.45 + index * 0.08,
      }),
      customerMarkup: node({
        x: customerX,
        y,
        width: 170,
        height: 58,
        title: order.customerName || order.customerId || 'Customer',
        meta: order.status ? titleCase(order.status) : '',
        tone: delay ? tone : 'default',
        kind: 'customer',
        id: order.customerId || '',
        reveal: 1.7 + index * 0.08,
      }),
      customerPoint: { x: customerX, y },
    }
  })

  const shortage = Math.max(0, Math.round(Number(impact.dailyDemand || 0) * maxDelay - Number(impact.available || 0)))
  const summary = [
    ['Shipment status', titleCase(impact.shipmentStatus)],
    ['Longest order delay', maxDelay ? `${maxDelay} day${maxDelay === 1 ? '' : 's'}` : 'None recorded'],
    ['Projected units short', shortage ? number(shortage) : 'None'],
    ['Available stock', `${number(impact.available)} of ${number(impact.onHand)}`],
  ]

  const edges = [
    edge({ from: supplier, to: shipment, depth: 0, tone: 'low' }),
    edge({ from: shipment, to: warehouse, depth: 1, tone: shipmentTone === 'critical' ? 'critical' : 'low' }),
    edge({ from: warehouse, to: inventory, depth: 2, tone: inventoryTone }),
    edge({ from: inventory, to: product, depth: 3, tone: inventoryTone }),
    ...orderNodes.map((orderPoint, index) => edge({
      from: product,
      to: { x: orderX, y: orderPoint.y },
      depth: 4,
      tone: orderPoint.tone,
      curve: 50,
    })),
    ...orderNodes.map((orderPoint, index) => edge({
      from: { x: orderX, y: orderPoint.y },
      to: orderPoint.customerPoint,
      depth: 5,
      tone: orderPoint.tone,
      curve: 40,
    })),
  ].join('')

  const nodeMarkup = [
    node({
      ...supplier,
      title: impact.supplierName || impact.supplierId || 'Supplier',
      meta: impact.supplierId || 'Not recorded',
      kind: 'supplier',
      id: impact.supplierId || '',
      tone: 'default',
      reveal: 0.1,
    }),
    node({
      ...shipment,
      title: impact.shipmentId || 'Shipment',
      meta: `${titleCase(impact.shipmentStatus)} · ${number(impact.shipmentQuantity)} units`,
      kind: 'shipment',
      id: impact.shipmentId || '',
      tone: shipmentTone,
      reveal: 0.4,
    }),
    node({
      ...warehouse,
      title: impact.warehouseName || impact.warehouseId || 'Warehouse',
      meta: impact.warehouseId || 'Not recorded',
      kind: 'warehouse',
      id: impact.warehouseId || '',
      tone: 'default',
      reveal: 0.7,
    }),
    node({
      ...inventory,
      title: impact.inventoryId || 'Inventory',
      meta: '',
      kind: 'inventory',
      id: impact.inventoryId || '',
      tone: inventoryTone,
      reveal: 1.0,
      bar: { ratio: Math.max(0, Math.min(1, availableRatio)) },
    }),
    node({
      ...product,
      title: impact.productName || impact.productId || 'Product',
      meta: `${number(impact.available)} available · reorder ${number(impact.reorderPoint)}`,
      kind: 'product',
      id: impact.productId || '',
      tone: inventoryTone,
      reveal: 1.25,
    }),
    ...orderNodes.map(orderPoint => orderPoint.markup),
    ...orderNodes.map(orderPoint => orderPoint.customerMarkup),
  ].join('')

  container.innerHTML = `
    <div class="impact-graph-toolbar">
      <div class="impact-graph-summary">
        <span class="impact-graph-chip">Shipment ${escapeHTML(impact.shipmentId)}</span>
        <span class="impact-graph-chip impact-graph-chip--${shipmentTone}">${escapeHTML(titleCase(impact.shipmentStatus))}</span>
        <span class="impact-graph-chip impact-graph-chip--${maxDelay ? 'critical' : 'low'}">${maxDelay ? `${maxDelay}d delay propagating` : 'No order delay recorded'}</span>
      </div>
      <div class="impact-graph-actions">
        <span class="impact-graph-hint">Select any node to inspect the record</span>
        <button class="analyst-button analyst-button--quiet impact-graph-replay" type="button">Replay propagation</button>
      </div>
    </div>
    <div class="impact-graph-stage" data-impact-stage>
      <svg class="impact-graph-svg" viewBox="0 0 1400 ${height}" role="img" aria-label="Backend impact chain for shipment ${escapeHTML(impact.shipmentId)} showing supplier, shipment, warehouse, inventory, product, ${orders.length} affected order(s), and customers">
        <defs>
          <linearGradient id="impact-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="rgba(255,255,255,0.03)" />
            <stop offset="100%" stop-color="rgba(255,255,255,0)" />
          </linearGradient>
          <marker id="impact-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <rect width="1400" height="${height}" fill="url(#impact-bg)" />
        <g class="impact-column-labels">
          <text x="100" y="32">SUPPLIER</text>
          <text x="300" y="32">SHIPMENT</text>
          <text x="500" y="32">WAREHOUSE</text>
          <text x="700" y="32">INVENTORY</text>
          <text x="900" y="32">PRODUCT</text>
          <text x="1100" y="32">ORDER</text>
          <text x="1300" y="32">CUSTOMER</text>
        </g>
        <g class="impact-edges">${edges}</g>
        <g class="impact-nodes">${nodeMarkup}</g>
      </svg>
    </div>
    <div class="impact-graph-footer">
      <div class="impact-graph-legend">
        <span><i class="impact-dot impact-dot--critical"></i>Critical / delayed</span>
        <span><i class="impact-dot impact-dot--high"></i>High exposure</span>
        <span><i class="impact-dot impact-dot--medium"></i>Medium</span>
        <span><i class="impact-dot impact-dot--low"></i>Covered</span>
      </div>
      <div class="impact-graph-facts">
        ${summary.map(([label, value]) => `<span><strong>${escapeHTML(value)}</strong>${escapeHTML(label)}</span>`).join('')}
      </div>
    </div>
  `

  const replay = container.querySelector('.impact-graph-replay')
  replay?.addEventListener('click', () => {
    // Re-render so every staged reveal and propagation pulse restarts cleanly.
    buildImpactGraph(container, impact, { onSelect })
  })

  container.querySelectorAll('.impact-node').forEach(element => {
    const activate = () => {
      const kind = element.dataset.impactKind
      const id = element.dataset.impactId
      if (onSelect && kind && id) onSelect(kind, id, impact)
    }
    element.addEventListener('click', activate)
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        activate()
      }
    })
  })
}
