function dateOnly(value) {
  if (!value) return null
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function shipmentDelayDays(shipment, today = new Date()) {
  const expected = dateOnly(shipment.expectedDate)
  if (!expected) return 0
  const comparison = shipment.status === 'delivered'
    ? dateOnly(shipment.actualDate)
    : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  if (!comparison) return 0
  return Math.max(0, Math.ceil((comparison.getTime() - expected.getTime()) / 86400000))
}

export function assessShipments(shipments, inventory, alerts, today = new Date()) {
  return shipments.map((shipment) => {
    const products = inventory.filter((product) => shipment.productIds.includes(product.productId))
    const shortageProducts = products.filter((product) =>
      Math.max(0, product.quantity - product.reserved) < shipment.quantity,
    )
    const delayDays = shipmentDelayDays(shipment, today)
    const statusRisk = shipment.status === 'failed' ? 45 : shipment.status === 'delayed' ? 35 : 0
    const priorityRisk = shipment.priority === 'critical' ? 35 : shipment.priority === 'high' ? 22 : 0
    const inventoryRisk = shortageProducts.length ? 18 : 0
    const score = Math.min(100, Math.max(0, 18 + statusRisk + priorityRisk + Math.min(delayDays * 8, 24) + inventoryRisk))
    const linkedAlerts = alerts.filter((alert) =>
      (alert.relatedType === 'shipment' && alert.relatedId === shipment.id) ||
      products.some((product) => alert.relatedType === 'inventory' && alert.relatedId === product.productId),
    )
    const factors = [
      shipment.status === 'delayed' ? `Shipment is marked delayed${delayDays ? ` by ${delayDays} day(s)` : ''}.` : '',
      shipment.status === 'failed' ? 'Shipment is marked failed.' : '',
      shipment.priority !== 'normal' ? `${shipment.priority} shipment priority.` : '',
      shortageProducts.length ? `${shortageProducts.length} linked product(s) have less available stock than this shipment quantity.` : '',
      linkedAlerts.length ? `${linkedAlerts.length} linked operational alert(s).` : '',
    ].filter(Boolean)
    return {
      ...shipment,
      delayDays,
      riskScore: score,
      riskLevel: score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low',
      factors: factors.length ? factors : ['No delay, priority, inventory, or linked-alert exposure is recorded in the supplied demo data.'],
      products,
      shortageProducts,
      linkedAlerts,
    }
  })
}

export function inventoryImpacts(shipments, inventory) {
  return inventory.map((product) => {
    const dependencies = shipments.filter((shipment) =>
      shipment.productIds.includes(product.productId) && !['delivered', 'failed'].includes(shipment.status),
    )
    const required = dependencies.reduce((sum, shipment) => sum + Number(shipment.quantity || 0), 0)
    const available = Math.max(0, Number(product.quantity || 0) - Number(product.reserved || 0))
    const otherWarehouseAvailability = inventory
      .filter((other) => other.sku === product.sku && other.warehouse !== product.warehouse)
      .reduce((sum, other) => sum + Math.max(0, Number(other.quantity || 0) - Number(other.reserved || 0)), 0)
    return {
      ...product,
      available,
      required,
      shortage: Math.max(0, required - available),
      otherWarehouseAvailability,
      dependentShipments: dependencies.map((shipment) => shipment.id),
      dependentOrders: [...new Set(dependencies.map((shipment) => shipment.orderId))],
    }
  })
}

export function summarizeDisruption(alert, shipmentRisks, impacts) {
  const linkedShipments = shipmentRisks.filter((shipment) =>
    (alert.relatedType === 'shipment' && shipment.id === alert.relatedId) ||
    (alert.relatedType === 'inventory' && shipment.productIds.includes(
      impacts.find((product) => product.productId === alert.relatedId)?.productId,
    )),
  )
  const linkedOrders = [...new Set(linkedShipments.map((shipment) => shipment.orderId))]
  const scoreRank = { critical: 82, high: 68, medium: 46, low: 25 }
  const riskScore = linkedShipments.length
    ? Math.max(...linkedShipments.map((shipment) => shipment.riskScore))
    : scoreRank[alert.severity] || 25
  const linkedProductImpacts = impacts.filter((product) =>
    linkedShipments.some((shipment) => shipment.productIds.includes(product.productId)) ||
    (alert.relatedType === 'inventory' && product.productId === alert.relatedId),
  )
  return {
    ...alert,
    riskScore,
    riskLevel: riskScore >= 70 ? 'high' : riskScore >= 45 ? 'medium' : 'low',
    shipments: linkedShipments,
    orders: linkedOrders,
    products: linkedProductImpacts,
    factors: [
      `${alert.severity} severity incident in ${alert.category}.`,
      ...linkedShipments.flatMap((shipment) => shipment.factors),
      ...linkedProductImpacts.filter((product) => product.shortage > 0).map((product) =>
        `${product.productName}: ${product.shortage} unit(s) short against linked open shipments.`,
      ),
    ],
  }
}

export function simulateRecoveryOptions(assessment, inventoryImpacts) {
  const orderCount = assessment.orders.length
  const affected = assessment.shipments.length
  const delayed = assessment.shipments.reduce((sum, shipment) => sum + shipment.delayDays, 0)
  const linkedProducts = inventoryImpacts.filter((item) =>
    assessment.shipments.some((shipment) => shipment.productIds.includes(item.productId)),
  )
  const shortageUnits = linkedProducts.reduce((sum, item) => sum + item.shortage, 0)
  const alternativeUnits = linkedProducts.reduce((sum, item) => sum + item.otherWarehouseAvailability, 0)
  const orders = Math.max(1, orderCount)
  const supplierCost = Math.round((18000 + shortageUnits * 18 + orders * 850) / 100) * 100
  const carrierCost = Math.round((6500 + affected * 1800 + orders * 500) / 100) * 100
  const transferCost = Math.round((2500 + orders * 700 + alternativeUnits * 4) / 100) * 100
  return [
    {
      id: 'alternate-carrier',
      strategy: 'Expedite or reroute shipment',
      estimatedCost: carrierCost,
      recoveryDays: Math.max(1, delayed ? Math.ceil(delayed / Math.max(1, affected)) : 2),
      expectedRiskReduction: Math.min(45, 18 + Math.min(delayed, 5) * 4),
      affectedOrders: orderCount,
      requiredActions: ['Confirm alternate carrier capacity', 'Review route and delivery deadlines'],
      resources: ['Transport coordination', 'Carrier capacity confirmation'],
      requiredApprovals: [],
      feasible: affected > 0,
      basis: `${affected} linked shipment(s), ${orderCount} unique order(s), ${delayed} overdue day(s) in current records.`,
      costBasis: `Illustrative estimate: INR 6,500 baseline + INR 1,800 per linked shipment + INR 500 per order, rounded to INR 100.`,
    },
    {
      id: 'inventory-transfer',
      strategy: 'Reallocate inventory between warehouses',
      estimatedCost: transferCost,
      recoveryDays: alternativeUnits > 0 ? 1 : 3,
      expectedRiskReduction: Math.min(50, alternativeUnits > 0 ? 35 : 12),
      affectedOrders: orderCount,
      requiredActions: ['Confirm source stock and reservations', 'Arrange a transfer with the assigned warehouse team'],
      resources: ['Source warehouse stock', 'Authorized warehouse execution'],
      requiredApprovals: ['Warehouse Operator'],
      feasible: alternativeUnits > 0,
      basis: alternativeUnits > 0
        ? `${alternativeUnits} available unit(s) are listed at another warehouse for linked SKUs.`
        : 'No alternative warehouse quantity is present for the linked SKUs in the supplied demo records.',
      costBasis: `Illustrative estimate: INR 2,500 baseline + INR 700 per order + INR 4 per other-warehouse unit, rounded to INR 100.`,
    },
    {
      id: 'alternative-supplier',
      strategy: 'Request alternative supplier replenishment',
      estimatedCost: supplierCost,
      recoveryDays: shortageUnits > 0 ? 4 : 5,
      expectedRiskReduction: Math.min(40, 20 + Math.min(assessment.riskScore, 100) * 0.15),
      affectedOrders: orderCount,
      requiredActions: ['Request supplier availability and lead time', 'Confirm landed cost before commitment'],
      resources: [...new Set(linkedProducts.map((item) => item.supplier).filter(Boolean))],
      requiredApprovals: ['Procurement Approver'],
      feasible: linkedProducts.length > 0,
      basis: `Uses ${shortageUnits} calculated shortage unit(s); no supplier quote or confirmed lead time is available.`,
      costBasis: `Illustrative estimate: INR 18,000 baseline + INR 18 per calculated shortage unit + INR 850 per order, rounded to INR 100.`,
    },
  ]
}

export function buildRiskExplanation(assessment) {
  const firstLine = `${assessment.id} is assessed at ${assessment.riskScore}/100 (${assessment.riskLevel} demo risk).`
  const evidence = assessment.factors.join(' ')
  const suggestion = assessment.shortageProducts.length
    ? 'Review linked product availability and any alternate warehouse stock before proposing a transfer.'
    : assessment.status === 'delayed'
      ? 'Confirm carrier capacity and compare rerouting with the recorded delivery deadline.'
      : 'Continue monitoring the recorded shipment status and linked operational alerts.'
  return { explanation: `${firstLine} ${evidence}`, recommendation: suggestion }
}
