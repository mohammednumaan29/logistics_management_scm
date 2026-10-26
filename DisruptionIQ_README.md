# DisruptionIQ

> **From Delivery Delays to Recovery Plans**

DisruptionIQ is an AI-assisted supply-chain disruption intelligence and recovery platform for logistics and supply-chain teams.

The system combines shipment, supplier, warehouse, inventory, product, and customer-order data into a connected model. When a disruption occurs, DisruptionIQ determines what is affected, measures the downstream business impact, ranks affected orders by risk, generates explainable recovery options, and allows authorized users to review and approve a recovery plan before simulated execution.

The project is designed as a **hackathon-grade control tower and disruption simulator**, not as a generic CRUD application or chatbot.

---

## 1. Problem Statement

### PS 1 — DisruptionIQ: From Delivery Delays to Recovery Plans

Logistics teams receive fragmented updates about:

- delayed shipments
- supplier disruptions
- inventory shortages
- warehouse constraints
- customer delivery commitments

Detecting that a shipment is late is relatively easy.

The difficult questions are:

1. Which products and warehouses will be affected?
2. Which customer orders depend on those products?
3. How severe is the impact?
4. Which orders should be prioritized?
5. What will happen if no action is taken?
6. What recovery options are available?
7. Which recovery option provides the best outcome?
8. Who is authorized to approve the action?
9. How can the system prove what happened and who approved it?

DisruptionIQ addresses this complete chain.

---

# 2. Core Product Idea

The central idea is:

```text
DISRUPTION
    ↓
DETECTION
    ↓
IMPACT ANALYSIS
    ↓
RISK RANKING
    ↓
RECOVERY OPTIONS
    ↓
WHAT-IF COMPARISON
    ↓
HUMAN APPROVAL
    ↓
SIMULATED EXECUTION
    ↓
RECOVERY TRACKING
    ↓
AUDIT TRAIL
```

The system must not simply say:

> "Shipment SH-102 is delayed."

It should say something closer to:

> "Shipment SH-102 is delayed by 4 days. It carries Product P-100 to Warehouse W-01. Current available inventory at W-01 will cover only 2.1 days of demand. 17 customer orders are therefore at risk, including 5 critical orders. The highest-risk order is ORD-204 because its promised delivery date is in 2 days and it has no alternative stock source."

Then the system should generate recovery options such as:

```text
Option A — Reallocate stock
Option B — Expedite shipment
Option C — Use alternative supplier
Option D — Split affected orders
```

The user should be able to compare the expected outcome of these options before approving one.

---

# 3. Project Goals

## Primary Goals

- Import supply-chain data from CSV and JSON.
- Receive simulated carrier webhook events.
- Maintain linked relationships between supply-chain entities.
- Detect disruptions using deterministic rules.
- Trace downstream impact through the supply-chain graph.
- Calculate inventory shortages and delivery risk.
- Rank affected customer orders.
- Explain risk factors clearly.
- Generate AI-assisted recovery recommendations.
- Compare recovery strategies using what-if simulation.
- Require human approval before execution.
- Enforce role-based permissions in the backend.
- Prevent self-approval where separation of duties applies.
- Simulate execution after approval.
- Send notifications.
- Maintain a complete audit trail.
- Provide a dashboard for active disruptions and recovery progress.
- Handle duplicate, invalid, and conflicting events safely.

## Non-Goals

Do NOT turn this project into:

- a generic chatbot
- a simple shipment CRUD application
- a fake AI demo where AI controls business rules
- a giant ERP system
- a production carrier-integration platform
- a fully autonomous supply-chain agent
- a system with dozens of unnecessary dashboard pages

The strongest implementation is a focused end-to-end disruption workflow.

---

# 4. Key Design Principle

The most important architectural rule is:

```text
GRAPH       → Relationships and dependency traversal
BACKEND     → Deterministic business logic
AI          → Explanation and recommendations
DATABASE    → Persistent state
RBAC        → Security and authorization
UI          → Visualization and human decision-making
```

### The AI must NOT decide:

- whether inventory is available
- whether an order is late
- whether a shipment is delayed
- whether a deadline has been violated
- whether a user is authorized
- whether an approval is valid
- whether a recovery action can actually be executed

Those decisions must come from deterministic backend logic.

### The AI MAY:

- summarize a disruption
- explain why an order is at risk
- explain contributing factors
- generate recovery suggestions from available facts
- explain trade-offs between recovery plans
- generate human-readable operational summaries

This separation is mandatory.

---

# 5. Target Users and Roles

The system has five primary roles.

## 5.1 Operations Analyst

Responsibilities:

- monitor disruptions
- inspect affected shipments
- inspect impact analysis
- view affected orders
- view risk rankings
- request recovery plans

Typical permissions:

```text
VIEW_DISRUPTIONS
VIEW_SHIPMENTS
VIEW_ORDERS
VIEW_INVENTORY
VIEW_IMPACT
CREATE_RECOVERY_PLAN
VIEW_NOTIFICATIONS
```

---

## 5.2 Supply Chain Manager

Responsibilities:

- review operational impact
- compare recovery plans
- approve or reject recovery actions
- monitor recovery progress

Typical permissions:

```text
VIEW_ALL_OPERATIONAL_DATA
VIEW_IMPACT
VIEW_RISK
REVIEW_RECOVERY_PLAN
APPROVE_RECOVERY_PLAN
REJECT_RECOVERY_PLAN
VIEW_AUDIT_LOG
```

A manager must not automatically approve their own plan if the workflow requires separation of duties.

---

## 5.3 Warehouse Operator

Responsibilities:

- view warehouse inventory
- receive stock movement instructions
- execute simulated warehouse actions
- update inventory status

Typical permissions:

```text
VIEW_WAREHOUSE
VIEW_INVENTORY
EXECUTE_WAREHOUSE_ACTION
UPDATE_INVENTORY
```

---

## 5.4 Procurement Approver

Responsibilities:

- review supplier-related recovery actions
- approve alternative supplier selection
- approve simulated procurement actions

Typical permissions:

```text
VIEW_SUPPLIERS
VIEW_DISRUPTIONS
VIEW_RECOVERY_PLAN
APPROVE_PROCUREMENT_ACTION
```

---

## 5.5 Administrator

Responsibilities:

- manage users
- manage roles
- inspect system state
- inspect audit logs
- configure system settings

Administrators should not bypass business approval rules simply because they have broad administrative access.

---

# 6. Separation of Duties

The backend must enforce approval separation.

Example:

```text
User A creates recovery plan
        ↓
User A cannot approve that same plan
        ↓
Authorized User B reviews plan
        ↓
User B approves/rejects
        ↓
Execution can begin
```

The UI hiding an approval button is NOT sufficient.

The backend must reject unauthorized requests.

Example:

```http
POST /api/recovery-plans/RP-1001/approve
```

If the current user created the plan and self-approval is prohibited:

```http
403 Forbidden
```

The authorization decision must be server-side.

---

# 7. System Architecture

Recommended high-level architecture:

```text
                    ┌─────────────────────┐
                    │       React UI      │
                    │ Dashboard / Graph   │
                    │ Approval / Reports  │
                    └──────────┬──────────┘
                               │
                         REST / WebSocket
                               │
                    ┌──────────▼──────────┐
                    │    Spring Boot      │
                    │      Backend        │
                    ├─────────────────────┤
                    │ Controllers         │
                    │ Services            │
                    │ Risk Engine         │
                    │ Impact Analysis     │
                    │ Recovery Engine     │
                    │ Security / RBAC     │
                    │ Audit Service       │
                    └──────┬───────┬──────┘
                           │       │
                    ┌──────▼───┐ ┌─▼─────────────┐
                    │  Neo4j   │ │ Ollama / AI   │
                    │  Graph   │ │ Service       │
                    └──────────┘ └───────────────┘
                           │
                    ┌──────▼────────┐
                    │ Persistent    │
                    │ Supply Chain  │
                    │ Data          │
                    └───────────────┘
```

---

# 8. Recommended Technology Stack

## Frontend

- React
- Vite
- Tailwind CSS
- React Router
- Recharts
- React Flow

React Flow should be used for the supply-chain impact graph.

Recharts can be used for:

- risk distribution
- disruption counts
- recovery progress
- inventory trends
- order impact

---

## Backend

- Java
- Spring Boot
- Spring Web
- Spring Security
- Spring Data Neo4j
- Bean Validation
- JWT authentication

Optional:

- WebSocket / Server-Sent Events for live dashboard updates
- Maven for dependency management

---

## Database

### Primary recommendation: Neo4j

Neo4j is appropriate because the central problem is relationship traversal.

The application needs to answer questions such as:

```text
Shipment
   ↓
Warehouse
   ↓
Product
   ↓
Inventory
   ↓
Order
```

and:

```text
Supplier
   ↓
Shipment
   ↓
Product
   ↓
Orders
```

A graph database makes these dependency relationships explicit.

For a hackathon implementation, avoid introducing multiple databases unless there is a clear reason.

Neo4j can store:

- supply-chain entities
- relationships
- disruption state
- recovery plans
- operational state

If a second relational database is later required for authentication/audit requirements, introduce it intentionally rather than by default.

---

## AI Layer

Recommended:

- Python
- FastAPI
- Ollama
- Local LLM

The AI service should receive structured facts from Spring Boot rather than querying arbitrary production data directly.

Example:

```json
{
  "disruption": {
    "type": "SHIPMENT_DELAY",
    "shipmentId": "SH-102",
    "delayDays": 4
  },
  "impact": {
    "affectedOrders": 17,
    "criticalOrders": 5,
    "inventoryShortage": 60
  },
  "recoveryOptions": [
    {
      "type": "REALLOCATE_STOCK",
      "availableUnits": 80
    },
    {
      "type": "EXPEDITE",
      "additionalCost": 450
    }
  ]
}
```

The AI converts these facts into an explanation and recommendation.

---

# 9. Supply-Chain Data Model

The core entities are:

```text
Supplier
Shipment
Warehouse
Inventory
Product
Order
Customer
Disruption
RecoveryPlan
RecoveryAction
Notification
AuditEvent
User
Role
```

---

# 10. Entity Relationships

The conceptual graph is:

```text
Supplier
   │
   │ SENDS
   ▼
Shipment
   │
   │ DELIVERS_TO
   ▼
Warehouse
   │
   │ STORES
   ▼
Inventory
   │
   │ FOR
   ▼
Product
   │
   │ REQUIRED_BY
   ▼
Order
   │
   │ PLACED_BY
   ▼
Customer
```

Disruptions connect to affected entities:

```text
Disruption
   ├── AFFECTS → Shipment
   ├── AFFECTS → Supplier
   ├── AFFECTS → Warehouse
   ├── AFFECTS → Product
   └── AFFECTS → Order
```

Recovery:

```text
Disruption
    ↓
RecoveryPlan
    ↓
RecoveryAction
    ↓
Execution
    ↓
RecoveryStatus
```

---

# 11. Core Domain Entities

## Supplier

Example:

```json
{
  "id": "SUP-001",
  "name": "Global Components Ltd",
  "status": "ACTIVE",
  "leadTimeDays": 7
}
```

Possible statuses:

```text
ACTIVE
DELAYED
DISRUPTED
SUSPENDED
```

---

## Product

```json
{
  "id": "PROD-100",
  "name": "Industrial Sensor",
  "category": "Electronics",
  "unitCost": 120
}
```

---

## Warehouse

```json
{
  "id": "WH-001",
  "name": "Chennai Central Warehouse",
  "location": "Chennai",
  "capacity": 10000
}
```

---

## Inventory

Inventory must distinguish total and usable stock.

Recommended fields:

```text
productId
warehouseId
onHand
reserved
available
reorderPoint
dailyDemand
```

The important calculation is:

```text
available = onHand - reserved
```

---

## Shipment

Example:

```json
{
  "id": "SH-102",
  "supplierId": "SUP-001",
  "warehouseId": "WH-001",
  "productId": "PROD-100",
  "quantity": 120,
  "status": "DELAYED",
  "expectedDelivery": "2026-10-28"
}
```

Possible statuses:

```text
PLANNED
IN_TRANSIT
DELIVERED
DELAYED
CANCELLED
```

---

## Customer Order

Example:

```json
{
  "id": "ORD-204",
  "customerId": "CUS-101",
  "warehouseId": "WH-001",
  "priority": "HIGH",
  "quantity": 50,
  "promisedDelivery": "2026-10-27",
  "status": "AT_RISK"
}
```

Possible priorities:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

---

# 12. Disruption Types

The system should initially support:

```text
SHIPMENT_DELAY
SUPPLIER_DELAY
SUPPLIER_OUTAGE
INVENTORY_SHORTAGE
STOCKOUT
```

Future extensions can include:

```text
WAREHOUSE_FAILURE
PORT_CLOSURE
CUSTOMS_DELAY
DEMAND_SPIKE
QUALITY_HOLD
TRANSPORT_CAPACITY_REDUCTION
```

---

# 13. Disruption Detection

Detection must be deterministic.

Examples:

### Shipment delay

```text
If actual/updated ETA > promised/required delivery threshold
→ SHIPMENT_DELAY
```

### Supplier disruption

```text
If supplier status = DISRUPTED
→ SUPPLIER_OUTAGE
```

### Inventory shortage

```text
available inventory < required demand
→ INVENTORY_SHORTAGE
```

### Stockout

```text
available inventory <= 0
→ STOCKOUT
```

The AI must not determine whether a disruption exists.

---

# 14. Carrier Webhook

At least one simulated carrier webhook is mandatory.

Endpoint:

```http
POST /api/webhooks/carrier
```

Example:

```json
{
  "eventId": "EVT-1001",
  "shipmentId": "SH-102",
  "status": "DELAYED",
  "delayDays": 4,
  "reason": "Heavy traffic"
}
```

Expected flow:

```text
Carrier
   ↓
POST /api/webhooks/carrier
   ↓
Validate payload
   ↓
Check eventId
   ↓
Reject duplicate
   ↓
Update shipment
   ↓
Detect disruption
   ↓
Run impact analysis
   ↓
Calculate risk
   ↓
Generate recovery options
   ↓
Notify users
```

---

# 15. Duplicate Event Handling

Webhook events must be idempotent.

If:

```text
eventId = EVT-1001
```

has already been processed, receiving the same event again must not:

- create a second disruption
- double-count inventory
- create duplicate notifications
- create duplicate recovery plans
- corrupt shipment state

Store processed event IDs.

Possible event state:

```text
RECEIVED
PROCESSED
DUPLICATE
REJECTED
CONFLICTING
```

---

# 16. Invalid Data Handling

Examples of invalid input:

```text
negative quantity
missing shipment ID
invalid status
unknown warehouse
unknown product
invalid date
missing event ID
```

Return appropriate validation errors.

Example:

```http
400 Bad Request
```

with a useful response:

```json
{
  "error": "INVALID_EVENT",
  "message": "shipmentId is required"
}
```

Do not silently accept invalid data.

---

# 17. Conflicting Event Handling

Example:

```text
Event A:
Shipment SH-102 = DELAYED

Event B:
Shipment SH-102 = DELIVERED
```

The system must not blindly overwrite state.

Use deterministic conflict rules such as:

- event timestamp
- event sequence number
- event version
- source priority

Example:

```text
NEWER_VALID_EVENT
        ↓
accept

OLDER_EVENT
        ↓
ignore / record

CONFLICTING_EVENT
        ↓
flag for review
```

The exact conflict strategy should be documented in the implementation.

---

# 18. Impact Analysis

This is one of the most important components.

When a disruption occurs, traverse the graph.

Example:

```text
Supplier SUP-001
      ↓
Shipment SH-102
      ↓
Warehouse WH-001
      ↓
Product PROD-100
      ↓
Inventory
      ↓
Orders ORD-201
       ORD-202
       ORD-203
```

The system should identify:

- affected shipments
- affected warehouses
- affected products
- affected inventory
- affected orders
- affected customers
- expected shortage
- delivery risk

---

# 19. Inventory Impact Calculation

Inventory analysis must be deterministic.

Example:

```text
Current inventory = 100
Reserved inventory = 40

Available inventory:

100 - 40 = 60
```

If:

```text
Daily demand = 30 units
Delay = 4 days
```

Expected requirement:

```text
30 × 4 = 120 units
```

Shortage:

```text
120 - 60 = 60 units
```

Therefore:

```text
Expected shortage = 60 units
```

The AI should not calculate this itself.

The backend should produce:

```json
{
  "availableInventory": 60,
  "expectedDemand": 120,
  "shortage": 60
}
```

The AI can then explain the result.

---

# 20. Order Risk Ranking

Every affected order should receive a deterministic risk score.

Possible factors:

```text
delivery deadline
order priority
customer importance
inventory availability
shortage quantity
shipment delay
alternative stock availability
supplier risk
```

A simple example:

```text
Risk Score =
    Deadline Risk
  + Inventory Risk
  + Disruption Severity
  + Order Priority
  + Supply Dependency
```

The exact weighting should be configurable.

Example output:

```json
{
  "orderId": "ORD-204",
  "riskScore": 92,
  "riskLevel": "CRITICAL",
  "factors": [
    "Delivery deadline in 1 day",
    "Insufficient inventory",
    "Delayed inbound shipment",
    "No alternative warehouse stock"
  ]
}
```

The backend calculates the score.

The AI explains it in natural language.

---

# 21. Risk Levels

Recommended:

```text
LOW       0–24
MEDIUM   25–49
HIGH     50–74
CRITICAL 75–100
```

These thresholds can be configured.

Do not allow the AI to invent risk levels.

---

# 22. Recovery Options

The platform must support at least these recovery strategies.

## 22.1 Reallocate Stock

Move inventory from another warehouse.

Example:

```text
Warehouse A shortage = 60
Warehouse B surplus = 100

Reallocate 60 units
```

The system must verify:

- source warehouse has enough available stock
- transfer quantity is valid
- destination is valid
- transfer does not create an unacceptable shortage elsewhere

---

## 22.2 Expedite Shipment

Reduce expected delay using expedited transportation.

Example:

```text
Normal arrival: 4 days
Expedited arrival: 1 day
Additional cost: $450
```

The system should calculate:

- estimated recovery time
- additional cost
- affected orders saved
- residual risk

---

## 22.3 Alternative Supplier

Use another supplier for the required product.

The backend must check:

- supplier availability
- product capability
- lead time
- available quantity
- cost
- supplier status

---

## 22.4 Split Order

Partially fulfill an order.

Example:

```text
Order quantity = 100

Available now = 60

Ship 60 now
Ship remaining 40 later
```

The system should calculate the effect on customer commitment.

---

# 23. Recovery Plan Representation

Example:

```json
{
  "id": "RP-1001",
  "disruptionId": "DIS-001",
  "createdBy": "USR-101",
  "status": "PENDING_APPROVAL",
  "actions": [
    {
      "type": "REALLOCATE_STOCK",
      "fromWarehouse": "WH-002",
      "toWarehouse": "WH-001",
      "quantity": 60
    }
  ],
  "estimatedCost": 0,
  "estimatedRecoveryDays": 1,
  "ordersSaved": 12
}
```

---

# 24. What-If Simulator

This should be a major differentiating feature.

The user should be able to compare:

```text
DO NOTHING
vs
REALLOCATE
vs
EXPEDITE
vs
ALTERNATIVE SUPPLIER
vs
SPLIT ORDER
```

Example:

```text
                  No Action    Reallocate    Expedite
-------------------------------------------------------
Affected Orders       47           9            12
Critical Orders       12           2             1
Shortage Units       820           0             0
Recovery Days          8            2             1
Estimated Cost         $0          $900          $450
```

The goal is to show:

> "What happens if we do nothing?"

and:

> "What improves if we take this action?"

This makes the system a decision-support platform rather than just a monitoring dashboard.

---

# 25. AI Recommendation Engine

The AI should receive structured deterministic facts.

Example:

```json
{
  "scenario": {
    "type": "SUPPLIER_OUTAGE",
    "durationDays": 7
  },
  "impact": {
    "affectedOrders": 47,
    "criticalOrders": 12,
    "shortageUnits": 820
  },
  "options": [
    {
      "type": "REALLOCATE",
      "cost": 900,
      "ordersSaved": 38
    },
    {
      "type": "EXPEDITE",
      "cost": 450,
      "ordersSaved": 44
    }
  ]
}
```

The AI should respond with structured output such as:

```json
{
  "summary": "...",
  "recommendedOption": "EXPEDITE",
  "reasoning": [
    "...",
    "..."
  ],
  "risks": [
    "..."
  ]
}
```

AI output should be treated as advisory.

The backend remains authoritative.

---

# 26. AI Prompting Rules

Prompts should explicitly tell the model:

```text
You are an operations recovery assistant.

Use only the facts provided.

Do not invent:
- inventory quantities
- supplier capacity
- delivery dates
- costs
- permissions
- system states

Do not override deterministic calculations.

Explain:
1. what happened
2. what is affected
3. why affected orders are risky
4. available recovery options
5. trade-offs
6. recommended option
```

The AI should never claim that an action has been executed.

It should say:

```text
"Recommended action"
```

not:

```text
"Action completed"
```

unless the backend has actually executed the simulated action.

---

# 27. Human Approval Workflow

Recovery plan states:

```text
DRAFT
   ↓
PENDING_APPROVAL
   ↓
APPROVED
   ↓
EXECUTING
   ↓
EXECUTED
   ↓
RECOVERY_MONITORING
   ↓
COMPLETED
```

Alternative outcomes:

```text
PENDING_APPROVAL
   ├── REJECTED
   └── MODIFICATION_REQUESTED
```

---

# 28. Approval Rules

A recovery plan must not execute immediately after generation.

Correct flow:

```text
AI generates recommendation
        ↓
Backend creates recovery plan
        ↓
Plan waits for approval
        ↓
Authorized human reviews
        ↓
Approve / Reject / Modify
        ↓
Backend validates approval
        ↓
Simulated execution
```

The AI cannot approve its own recommendation.

---

# 29. Notifications

Notifications should be generated for important events.

Examples:

```text
New critical disruption
Critical order affected
Recovery plan created
Approval required
Recovery plan approved
Recovery plan rejected
Recovery execution completed
Recovery failed
```

Example:

```json
{
  "id": "NOT-001",
  "userId": "USR-201",
  "type": "APPROVAL_REQUIRED",
  "message": "Recovery plan RP-1001 requires approval.",
  "read": false
}
```

---

# 30. Audit Trail

Every important operation must be auditable.

Record:

```text
timestamp
user
role
action
entity
entityId
previousState
newState
reason
request/event ID
```

Example:

```json
{
  "timestamp": "2026-10-26T18:20:00Z",
  "userId": "USR-201",
  "role": "SUPPLY_CHAIN_MANAGER",
  "action": "APPROVE_RECOVERY_PLAN",
  "entityId": "RP-1001",
  "previousState": "PENDING_APPROVAL",
  "newState": "APPROVED"
}
```

Audit logs should be append-only from the application perspective.

---

# 31. Dashboard

The dashboard should focus on decision-making.

## Primary metrics

```text
Active Disruptions
Affected Orders
Critical Orders
Inventory Shortage
Pending Approvals
Recovery Plans
Recovery Success Rate
```

## Main sections

### Active Disruptions

Show:

```text
Disruption
Severity
Affected Orders
Affected Products
Duration
Status
```

### Risk Overview

Show:

```text
Critical
High
Medium
Low
```

### Pending Approvals

Show:

```text
Plan
Created By
Estimated Cost
Orders Saved
Risk Reduction
Required Approver
```

### Recovery Progress

Show:

```text
Approved
Executing
Completed
Failed
```

---

# 32. Impact Graph UI

The graph should visually communicate cascading impact.

Example:

```text
Supplier
   │
   ▼
Shipment 🔴
   │
   ▼
Warehouse 🟠
   │
   ▼
Product 🟠
   │
   ├────► Order 🔴
   ├────► Order 🔴
   └────► Order 🟡
```

Color/severity should be based on deterministic risk levels.

The graph should support:

- click node
- view details
- show relationship
- filter by entity type
- highlight affected path
- focus on critical orders

---

# 33. API Design

Recommended endpoints:

## Authentication

```http
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me
```

---

## Suppliers

```http
GET    /api/suppliers
GET    /api/suppliers/{id}
POST   /api/suppliers
PUT    /api/suppliers/{id}
```

---

## Shipments

```http
GET    /api/shipments
GET    /api/shipments/{id}
POST   /api/shipments
PUT    /api/shipments/{id}
```

---

## Orders

```http
GET /api/orders
GET /api/orders/{id}
GET /api/orders/{id}/risk
```

---

## Inventory

```http
GET /api/inventory
GET /api/inventory/{id}
GET /api/inventory/warehouse/{warehouseId}
```

---

## Disruptions

```http
GET  /api/disruptions
GET  /api/disruptions/{id}
POST /api/disruptions
GET  /api/disruptions/{id}/impact
GET  /api/disruptions/{id}/risk
```

---

## Recovery

```http
POST /api/recovery-plans
GET  /api/recovery-plans
GET  /api/recovery-plans/{id}

POST /api/recovery-plans/{id}/approve
POST /api/recovery-plans/{id}/reject
POST /api/recovery-plans/{id}/modify
POST /api/recovery-plans/{id}/execute

GET /api/recovery-plans/{id}/simulation
```

---

## Webhook

```http
POST /api/webhooks/carrier
```

---

## Notifications

```http
GET  /api/notifications
POST /api/notifications/{id}/read
```

---

## Audit

```http
GET /api/audit
GET /api/audit/{entityId}
```

---

# 34. Data Import

The system must support:

```text
CSV
JSON
```

Recommended import endpoints:

```http
POST /api/import/suppliers
POST /api/import/products
POST /api/import/warehouses
POST /api/import/inventory
POST /api/import/shipments
POST /api/import/orders
```

Import process:

```text
Upload
 ↓
Parse
 ↓
Validate
 ↓
Resolve references
 ↓
Detect duplicates
 ↓
Persist
 ↓
Return import report
```

Example import report:

```json
{
  "totalRows": 100,
  "successful": 94,
  "duplicates": 3,
  "invalid": 3
}
```

---

# 35. Synthetic Dataset

The project must generate its own synthetic data.

The dataset should be large enough to make the dashboard and graph meaningful but small enough for a hackathon demo.

Suggested initial scale:

```text
5–10 suppliers
3–5 warehouses
20–50 products
50–100 shipments
100–300 orders
100–500 inventory records
```

The exact size can change depending on performance.

The dataset should contain deliberate relationships that allow disruptions to cascade.

---

# 36. Required Demo Scenarios

At least two disruption scenarios are mandatory.

## Scenario A — Shipment Delay

Initial state:

```text
Shipment SH-102
Supplier SUP-001
Warehouse WH-001
Product PROD-100
```

Trigger:

```text
4-day carrier delay
```

Expected behavior:

```text
Webhook received
       ↓
Shipment becomes DELAYED
       ↓
Impact analysis runs
       ↓
Affected inventory identified
       ↓
Affected orders identified
       ↓
Risk scores calculated
       ↓
Recovery options generated
```

---

## Scenario B — Supplier Outage + Inventory Shortage

Trigger:

```text
Supplier SUP-002 unavailable for 7 days
```

Expected behavior:

```text
Supplier disruption
       ↓
Affected inbound shipments
       ↓
Inventory depletion forecast
       ↓
Potential stockout
       ↓
Affected orders
       ↓
Critical order ranking
       ↓
Recovery strategies
```

Possible recommendation:

```text
Alternative supplier
or
Reallocate inventory
or
Expedite
or
Split orders
```

---

# 37. End-to-End Demo

The ideal hackathon demonstration should take approximately 3–5 minutes.

## Step 1 — Show Normal State

Dashboard:

```text
Active disruptions: 0
Critical orders: 0
Pending approvals: 0
```

---

## Step 2 — Trigger Disruption

Send:

```http
POST /api/webhooks/carrier
```

with:

```json
{
  "eventId": "EVT-1001",
  "shipmentId": "SH-102",
  "status": "DELAYED",
  "delayDays": 4,
  "reason": "Heavy traffic"
}
```

---

## Step 3 — Show Cascading Impact

Graph changes:

```text
Shipment 🔴
    ↓
Warehouse 🟠
    ↓
Product 🟠
    ↓
Orders 🔴
```

---

## Step 4 — Show Risk Ranking

Example:

```text
ORD-204   92   CRITICAL
ORD-211   84   CRITICAL
ORD-205   71   HIGH
ORD-208   54   HIGH
```

Clicking an order should show why.

---

## Step 5 — Show AI Explanation

Example:

> "ORD-204 is critical because its promised delivery date is within the disruption window, available inventory is insufficient, and no alternative warehouse stock is currently available."

---

## Step 6 — Show Recovery Comparison

```text
                 Do Nothing   Reallocate   Expedite
Affected Orders      17            5           3
Critical Orders       5            1           0
Shortage              60            0           0
Cost                  $0           $900        $450
```

---

## Step 7 — Approve

A manager approves the selected plan.

The backend checks:

```text
authenticated?
correct role?
authorized?
not plan creator?
plan still pending?
```

---

## Step 8 — Simulate Execution

The system updates simulated state.

Example:

```text
Inventory updated
Shipment updated
Orders updated
Recovery status updated
Notifications created
Audit event created
```

---

## Step 9 — Show Before/After

Before:

```text
Critical orders: 5
Shortage: 60
```

After:

```text
Critical orders: 0
Shortage: 0
```

This before/after comparison is extremely important for the final presentation.

---

# 38. What Makes DisruptionIQ Different

Basic supply-chain visibility products can already detect delays.

The project should therefore NOT pitch itself as:

> "An AI dashboard that detects supply-chain disruptions."

Instead, position it as:

> **An explainable, graph-based disruption simulator that traces cascading impact, compares recovery strategies, and lets supply-chain teams safely approve the best response before simulated execution.**

The differentiating features are:

1. Graph-based dependency tracing
2. Deterministic impact and risk engine
3. Explainable AI recommendations
4. What-if recovery simulation
5. Human approval workflow
6. Backend-enforced separation of duties
7. Complete auditability
8. Before/after recovery measurement

---

# 39. Recommended Backend Structure

Spring Boot package structure:

```text
src/main/java/com/disruptioniq/
│
├── config/
│   ├── SecurityConfig.java
│   └── Neo4jConfig.java
│
├── controller/
│   ├── AuthController.java
│   ├── SupplierController.java
│   ├── ShipmentController.java
│   ├── WarehouseController.java
│   ├── InventoryController.java
│   ├── OrderController.java
│   ├── DisruptionController.java
│   ├── RecoveryController.java
│   ├── WebhookController.java
│   ├── NotificationController.java
│   └── AuditController.java
│
├── service/
│   ├── ShipmentService.java
│   ├── InventoryService.java
│   ├── ImpactAnalysisService.java
│   ├── RiskEngine.java
│   ├── RecoveryService.java
│   ├── SimulationService.java
│   ├── NotificationService.java
│   ├── AuditService.java
│   └── ImportService.java
│
├── security/
│   ├── JwtService.java
│   ├── JwtAuthenticationFilter.java
│   └── PermissionService.java
│
├── model/
│   ├── Supplier.java
│   ├── Shipment.java
│   ├── Warehouse.java
│   ├── Product.java
│   ├── Inventory.java
│   ├── Order.java
│   ├── Customer.java
│   ├── Disruption.java
│   ├── RecoveryPlan.java
│   ├── RecoveryAction.java
│   ├── Notification.java
│   ├── AuditEvent.java
│   └── User.java
│
├── dto/
│
├── repository/
│
├── exception/
│
└── util/
```

Use DTOs at API boundaries.

Do not expose internal database models directly if the API contract should remain stable.

---

# 40. AI Service Structure

Recommended:

```text
ai-service/
│
├── app/
│   ├── main.py
│   ├── routes/
│   │   ├── explanation.py
│   │   └── recommendation.py
│   ├── services/
│   │   ├── ollama_service.py
│   │   └── prompt_service.py
│   ├── schemas/
│   │   └── recovery.py
│   └── prompts/
│       ├── disruption_summary.txt
│       └── recovery_recommendation.txt
│
└── requirements.txt
```

---

# 41. Frontend Structure

Recommended:

```text
frontend/
│
├── src/
│   ├── components/
│   │   ├── DashboardCard.jsx
│   │   ├── DisruptionCard.jsx
│   │   ├── RiskBadge.jsx
│   │   ├── ImpactGraph.jsx
│   │   ├── RecoveryOption.jsx
│   │   ├── ApprovalPanel.jsx
│   │   └── AuditTimeline.jsx
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Disruptions.jsx
│   │   ├── DisruptionDetails.jsx
│   │   ├── Orders.jsx
│   │   ├── RecoveryPlans.jsx
│   │   ├── Approvals.jsx
│   │   └── Audit.jsx
│   │
│   ├── services/
│   │   └── api.js
│   │
│   ├── hooks/
│   │
│   ├── context/
│   │
│   └── App.jsx
```

---

# 42. Important Coding Rules for AI Agents

This section is specifically intended for AI coding agents.

## Rule 1 — Understand before changing

Before modifying code:

1. inspect the existing project structure
2. identify the relevant module
3. understand existing data models
4. check existing APIs
5. avoid rewriting unrelated code

Never replace the entire project simply to implement one feature.

---

## Rule 2 — Preserve architecture

Follow:

```text
Controller
    ↓
Service
    ↓
Repository / Graph Query
```

Do not place complex business logic inside controllers.

---

## Rule 3 — Business logic must be deterministic

Do not ask an LLM:

```text
"Is there enough inventory?"
```

Calculate it in Java.

Do not ask an LLM:

```text
"Is this user allowed to approve?"
```

Use Spring Security and deterministic permission logic.

Do not ask an LLM:

```text
"Is this event a duplicate?"
```

Check event IDs in persistent storage.

---

## Rule 4 — AI is advisory

AI output must never directly mutate critical state.

Correct:

```text
AI recommendation
        ↓
Backend validates
        ↓
Human approval
        ↓
Backend execution
```

Incorrect:

```text
AI recommendation
        ↓
Automatic database mutation
```

---

## Rule 5 — Never trust the frontend for authorization

Incorrect:

```javascript
if (role === "MANAGER") {
    showApproveButton();
}
```

This is only a UI convenience.

The backend must enforce:

```text
Authentication
+
Role
+
Permission
+
Business rule
```

---

## Rule 6 — Validate every external input

Validate:

- API requests
- webhook payloads
- CSV files
- JSON imports
- AI responses
- query parameters

---

## Rule 7 — Idempotency matters

Any operation triggered by an external event must be safe to retry.

Especially:

```text
carrier webhook
inventory update
recovery execution
notification generation
```

---

## Rule 8 — Do not invent data

AI coding agents must never invent:

- database fields
- API responses
- entity relationships
- environment variables
- credentials
- supplier information
- inventory values

If uncertain, inspect the codebase first.

---

## Rule 9 — Keep changes focused

Prefer:

```text
small feature
→ test
→ verify
→ continue
```

over:

```text
rewrite everything
```

---

## Rule 10 — Test critical business rules

Tests are especially important for:

```text
risk calculation
inventory calculation
impact analysis
duplicate webhook handling
approval rules
self-approval prevention
recovery simulation
```

---

# 43. Testing Strategy

## Unit Tests

Test:

- inventory calculations
- risk scoring
- disruption classification
- recovery calculations
- permission rules
- duplicate detection

Example:

```text
100 on-hand
40 reserved
30 daily demand
4-day delay

Expected shortage = 60
```

---

## Integration Tests

Test:

```text
Webhook
 → Shipment update
 → Impact analysis
 → Risk
 → Recovery
```

---

## Security Tests

Verify:

```text
Analyst cannot approve
Warehouse Operator cannot approve procurement
Plan creator cannot self-approve
Unauthenticated user cannot access protected endpoints
```

---

## End-to-End Test

At minimum, automate:

```text
Create disruption
→ calculate impact
→ generate plan
→ approve
→ execute
→ verify state
→ verify audit log
```

---

# 44. Error Handling

Use consistent API error responses.

Example:

```json
{
  "timestamp": "2026-10-26T18:30:00Z",
  "status": 403,
  "error": "FORBIDDEN",
  "message": "The plan creator cannot approve their own recovery plan.",
  "path": "/api/recovery-plans/RP-1001/approve"
}
```

Recommended error categories:

```text
VALIDATION_ERROR
NOT_FOUND
DUPLICATE_EVENT
CONFLICT
FORBIDDEN
UNAUTHORIZED
INVALID_STATE
EXECUTION_ERROR
AI_SERVICE_ERROR
```

---

# 45. AI Failure Handling

The application must remain functional if the AI service is unavailable.

Example:

```text
Ollama unavailable
       ↓
Deterministic impact analysis still works
       ↓
Risk ranking still works
       ↓
Recovery calculations still work
       ↓
AI explanation marked unavailable
```

The system should not fail completely because the LLM is offline.

---

# 46. Observability

Useful logs:

```text
event received
event validated
duplicate detected
shipment updated
disruption detected
impact analysis completed
risk calculation completed
AI request sent
AI response received
recovery plan created
approval requested
approval completed
execution started
execution completed
```

Do not log:

- passwords
- JWT tokens
- secrets
- unnecessary personal information

---

# 47. Environment Configuration

Use environment variables.

Example:

```env
SPRING_PROFILES_ACTIVE=dev

NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=

JWT_SECRET=

AI_SERVICE_URL=http://localhost:8001
OLLAMA_URL=http://localhost:11434
```

Never commit secrets.

Provide:

```text
.env.example
```

instead.

---

# 48. Local Development

Recommended startup order:

```text
1. Start Neo4j
2. Start Ollama
3. Start AI service
4. Start Spring Boot backend
5. Start React frontend
```

Example:

```text
Neo4j        : 7687 / 7474
AI service   : 8001
Backend      : 8080
Frontend     : 5173
```

The exact ports may be changed in configuration.

---

# 49. Seed Data

Provide a deterministic seed script.

The seed should create:

```text
suppliers
warehouses
products
inventory
shipments
orders
customers
users
roles
```

It should also create the two demo scenarios.

The demo must be reproducible from a clean database.

---

# 50. Database Reset

Provide a development-only reset mechanism.

Example:

```text
reset database
↓
create constraints
↓
insert seed data
↓
ready for demo
```

Do not expose destructive reset operations in production.

---

# 51. Demo Data Design

The seed data should intentionally include:

### Healthy paths

```text
Supplier → Shipment → Warehouse → Inventory → Order
```

### Delayed path

```text
Supplier → Delayed Shipment → Warehouse → Low Inventory → Critical Orders
```

### Alternative path

```text
Warehouse A shortage
Warehouse B surplus
```

### Alternative supplier

```text
Supplier A disrupted
Supplier B available
```

This allows the recovery engine to produce meaningful options.

---

# 52. Recommended UI Pages

Keep the number of pages small.

## 1. Dashboard

Purpose:

```text
"What is happening right now?"
```

---

## 2. Disruption Details

Purpose:

```text
"What happened and what is affected?"
```

Contains:

- disruption summary
- impact graph
- affected orders
- risk
- AI explanation

---

## 3. Recovery Planner

Purpose:

```text
"What should we do?"
```

Contains:

- recovery options
- what-if comparison
- estimated cost
- recovery time
- orders saved
- residual risk

---

## 4. Approval Center

Purpose:

```text
"What requires my decision?"
```

Contains:

- pending plans
- creator
- recommendation
- trade-offs
- approve/reject/modify

---

## 5. Audit / History

Purpose:

```text
"What happened and who did it?"
```

---

# 53. UX Principles

The UI should emphasize:

```text
severity
impact
decision
action
result
```

Avoid overwhelming users with raw data.

A user should be able to answer within seconds:

```text
What happened?
↓
What is affected?
↓
How serious is it?
↓
What can I do?
↓
What happens if I do it?
↓
Who needs to approve?
```

---

# 54. Security Requirements

Minimum requirements:

- JWT authentication
- password hashing
- backend role checks
- permission checks
- protected endpoints
- audit logging
- input validation
- no secrets in source code
- no direct database credentials in frontend

Never rely only on frontend route protection.

---

# 55. Performance Considerations

For hackathon scale:

- index frequently queried IDs
- use graph traversal efficiently
- avoid N+1 database calls
- avoid recalculating unchanged impacts unnecessarily
- cache read-heavy dashboard data if needed
- use asynchronous processing for expensive AI calls
- paginate large tables

Do not prematurely introduce distributed systems.

---

# 56. Architecture Decision Summary

| Concern | Technology / Approach |
|---|---|
| Frontend | React |
| Styling | Tailwind CSS |
| Graph visualization | React Flow |
| Charts | Recharts |
| Backend | Spring Boot |
| Security | Spring Security + JWT |
| Graph DB | Neo4j |
| AI API | FastAPI |
| Local LLM | Ollama |
| Data format | CSV / JSON |
| Carrier integration | Simulated webhook |
| Risk engine | Deterministic Java |
| Inventory rules | Deterministic Java |
| Approval rules | Backend RBAC |
| Audit | Persistent audit events |
| Recovery execution | Simulation |
| Testing | JUnit + integration/E2E tests |

---

# 57. Development Priorities

Build in this order.

## Phase 1 — Foundation

```text
Project setup
Neo4j
Spring Boot
React
Authentication
Roles
```

---

## Phase 2 — Core Data

```text
Supplier
Product
Warehouse
Inventory
Shipment
Order
Customer
```

---

## Phase 3 — Graph

```text
Create relationships
Graph traversal
Impact query
```

---

## Phase 4 — Disruptions

```text
Disruption model
Carrier webhook
Validation
Duplicate handling
Conflict handling
```

---

## Phase 5 — Impact Engine

```text
Affected products
Affected inventory
Affected orders
Shortage calculation
```

---

## Phase 6 — Risk Engine

```text
Risk score
Risk level
Risk explanations/factors
```

---

## Phase 7 — Recovery

```text
Reallocate
Expedite
Alternative supplier
Split order
```

---

## Phase 8 — What-If Simulator

```text
Do nothing
Compare options
Calculate outcomes
```

---

## Phase 9 — AI

```text
Disruption summary
Risk explanation
Recovery recommendation
Trade-off explanation
```

---

## Phase 10 — Approval

```text
Create plan
Approve
Reject
Modify
Self-approval prevention
```

---

## Phase 11 — Execution

```text
Simulated execution
State updates
Notifications
Audit
```

---

## Phase 12 — Dashboard

```text
KPIs
Disruption list
Risk
Approval queue
Recovery progress
```

---

## Phase 13 — Demo Hardening

```text
Seed data
Scenario A
Scenario B
Error handling
Duplicate webhook
RBAC test
Before/after metrics
```

---

# 58. Definition of Done

The project should not be considered complete until the following workflow works:

```text
[ ] Synthetic data loaded
[ ] User logs in
[ ] Dashboard shows normal state
[ ] Carrier webhook accepted
[ ] Duplicate webhook rejected safely
[ ] Shipment status updated
[ ] Disruption detected
[ ] Graph impact calculated
[ ] Inventory shortage calculated
[ ] Affected orders identified
[ ] Risk scores calculated
[ ] Critical orders ranked
[ ] AI explains impact
[ ] Recovery options generated
[ ] What-if comparison works
[ ] Recovery plan created
[ ] Unauthorized approval rejected
[ ] Self-approval rejected
[ ] Authorized approval succeeds
[ ] Simulated execution succeeds
[ ] Inventory/order state changes
[ ] Notification generated
[ ] Audit event generated
[ ] Dashboard reflects recovery
[ ] Before/after impact visible
[ ] Scenario B works
```

---

# 59. Example End-to-End State Transition

Initial:

```text
Shipment SH-102
Status: IN_TRANSIT

Inventory:
Available = 60

Orders:
Affected = 0
Critical = 0
```

Webhook:

```text
SH-102 delayed 4 days
```

System:

```text
Shipment
IN_TRANSIT
    ↓
DELAYED
```

Impact:

```text
Available inventory = 60
Expected demand = 120
Shortage = 60
```

Orders:

```text
17 affected
5 critical
```

Recovery:

```text
Option A:
Reallocate 60 units

Option B:
Expedite shipment

Option C:
Alternative supplier
```

Human:

```text
Manager approves Option A
```

Execution:

```text
WH-002 → WH-001
60 units
```

Result:

```text
Shortage = 0
Critical orders = 0
```

Audit:

```text
Recovery plan RP-1001 approved by USR-202
```

This is the canonical successful flow.

---

# 60. Future Extensions

These are optional and should only be implemented after the core workflow is stable.

Potential extensions:

- real carrier APIs
- real supplier APIs
- demand forecasting
- machine-learning risk prediction
- reinforcement learning for recovery optimization
- optimization solver
- multi-echelon inventory planning
- digital twin
- autonomous agents
- advanced event streaming
- Kafka
- multi-warehouse optimization
- carbon-aware recovery planning
- cost optimization
- customer communication generation
- mobile application

Do not implement these before the core hackathon workflow is complete.

---

# 61. Final Product Philosophy

DisruptionIQ should answer five questions better than a basic logistics dashboard:

```text
1. WHAT HAPPENED?
2. WHAT WILL IT AFFECT?
3. HOW SERIOUS IS IT?
4. WHAT ARE OUR OPTIONS?
5. WHAT HAPPENS IF WE CHOOSE EACH OPTION?
```

The strongest product experience is:

```text
Detect
  ↓
Trace
  ↓
Quantify
  ↓
Explain
  ↓
Simulate
  ↓
Approve
  ↓
Execute
  ↓
Measure
```

The system should always make it clear which parts are:

```text
DETERMINISTIC FACTS
```

and which parts are:

```text
AI-ASSISTED RECOMMENDATIONS
```

The AI assists humans.

The backend remains the source of truth.

Humans remain responsible for operational approval.

---

# 62. Instructions to AI Coding Agents

When an AI coding agent is working on this repository, treat this README as the product and architecture specification.

Before implementing any feature:

1. Read this README.
2. Inspect the existing repository.
3. Identify the relevant domain entity/service/controller.
4. Preserve the existing architecture.
5. Implement deterministic business rules in the backend.
6. Use AI only for explanation/recommendation tasks.
7. Validate all external inputs.
8. Enforce authorization on the backend.
9. Maintain auditability.
10. Add tests for critical business logic.
11. Do not invent requirements.
12. Do not replace working code unnecessarily.
13. Do not add dependencies unless they solve a real requirement.
14. Do not expose secrets.
15. Keep the implementation demoable.

When a requirement is ambiguous, prefer the following priority:

```text
Problem Statement
      ↓
This README
      ↓
Existing Domain Model
      ↓
Existing API Contracts
      ↓
Existing Tests
      ↓
Minimal reasonable implementation
```

Never allow an AI-generated implementation to bypass:

```text
inventory rules
deadline rules
risk calculations
permissions
approval rules
audit requirements
```

---

# 63. One-Sentence Project Definition

> **DisruptionIQ is an explainable, graph-based supply-chain disruption intelligence platform that traces cascading operational impact, deterministically ranks order risk, compares AI-assisted recovery strategies through what-if simulation, and enables authorized humans to approve and safely simulate recovery actions.**
