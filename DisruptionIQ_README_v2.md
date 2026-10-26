# DisruptionIQ

> **From Delivery Delays to Recovery Plans**
>
> **An explainable, graph-based supply-chain disruption simulator that traces cascading impact, compares recovery strategies, and enables authorized humans to approve and safely simulate recovery actions.**

---

## 1. Project Overview

DisruptionIQ is an AI-assisted supply-chain intelligence and recovery platform designed for logistics and supply-chain teams.

The system combines:

- suppliers
- shipments
- warehouses
- inventory
- products
- customer orders
- customers
- disruptions
- recovery plans

into a connected operational model.

When a disruption occurs, DisruptionIQ does not stop at detecting the problem.

It answers:

1. **What happened?**
2. **What will it affect?**
3. **How serious is the impact?**
4. **Which customer orders are most at risk?**
5. **What recovery options are available?**
6. **What happens if we do nothing?**
7. **What happens if we choose each recovery option?**
8. **Which option provides the best outcome?**
9. **Who is authorized to approve the action?**
10. **What changed after the recovery action?**

The platform is designed as a hackathon-grade **decision-support and recovery simulation system**, not as a generic logistics CRUD application or chatbot.

---

# 2. Core Product Idea

The central workflow is:

```text
                DISRUPTION
                    │
                    ▼
               DETECTION
                    │
                    ▼
             IMPACT ANALYSIS
                    │
                    ▼
               RISK RANKING
                    │
                    ▼
          RECOVERY OPTIONS
                    │
                    ▼
          WHAT-IF SIMULATION
                    │
                    ▼
          AI EXPLANATION
                    │
                    ▼
             HUMAN APPROVAL
                    │
                    ▼
          SIMULATED EXECUTION
                    │
                    ▼
           RECOVERY TRACKING
                    │
                    ▼
               AUDIT TRAIL
```

The key differentiator is the **Recovery Simulator**.

The system should not merely say:

> "Shipment SH-102 is delayed."

It should answer:

> "Shipment SH-102 is delayed by 4 days. It affects Product PROD-100 at Warehouse WH-001. Current available inventory will not cover expected demand during the delay. 17 orders are affected, including 5 critical orders. Here are the expected outcomes of doing nothing, reallocating stock, expediting the shipment, or using an alternative supplier."

---

# 3. Competitive Positioning

The basic capabilities of this project overlap with existing supply-chain control-tower products.

Therefore, DisruptionIQ must **not** position itself as:

> "An AI dashboard that detects supply-chain disruptions."

Instead, position it as:

> **"An explainable, graph-based disruption simulator that traces cascading operational impact and compares recovery strategies before a human approves the response."**

The product's identity should be:

```text
DETECT
  ↓
TRACE
  ↓
QUANTIFY
  ↓
EXPLAIN
  ↓
SIMULATE
  ↓
APPROVE
  ↓
EXECUTE
  ↓
MEASURE
```

---

# 4. Main Differentiator — Recovery Simulator

The Recovery Simulator is the most important feature.

When a disruption occurs, the system should compare multiple possible futures.

Example:

```text
SUPPLIER OUTAGE
7 DAYS
     │
     ▼
CURRENT STATE
     │
     ├──────────────┬──────────────┬───────────────┐
     ▼              ▼              ▼               ▼
DO NOTHING      REALLOCATE      EXPEDITE      ALT. SUPPLIER
     │              │              │               │
     ▼              ▼              ▼               ▼
47 orders       9 orders       5 orders        3 orders
12 critical    2 critical      0 critical      0 critical
820 shortage   0 shortage      0 shortage      0 shortage
$0 cost        $900 cost       $450 cost       $1200 cost
```

The user can then select a strategy.

The system does not execute it immediately.

Instead:

```text
Simulation
    ↓
Human Review
    ↓
Approval
    ↓
Simulated Execution
```

This allows the system to answer:

> **"What happens if we choose this?"**

rather than merely:

> "What is happening now?"

---

# 5. Problem Statement

## PS 1 — DisruptionIQ: From Delivery Delays to Recovery Plans

Logistics teams receive fragmented updates about:

- delayed shipments
- supplier disruptions
- inventory shortages
- warehouse constraints
- delivery commitments

Detecting a late shipment is easy.

Understanding the downstream consequences and deciding what to do is difficult.

The platform must combine shipment, inventory, supplier, warehouse, and order data to:

- detect disruptions
- trace downstream impact
- prioritize affected orders
- recommend recovery plans
- obtain human approval
- simulate execution
- maintain notifications and audit history

---

# 6. Mandatory Requirements

The implementation must include:

- CSV/JSON data import
- at least one simulated carrier webhook
- linked supply-chain data model
- supplier relationships
- shipment relationships
- warehouse relationships
- inventory relationships
- order relationships
- late-shipment detection
- supplier-delay detection
- stock-shortage detection
- downstream impact analysis
- order risk ranking
- explanations of risk factors
- AI-assisted recovery recommendations
- stock reallocation
- shipment expedition
- alternative supplier
- order splitting
- approve/reject/modify workflow
- simulated execution after confirmation
- notifications
- complete audit trail
- dashboard
- active disruption monitoring
- affected-order monitoring
- pending approval monitoring
- recovery-progress monitoring
- backend-enforced RBAC
- separation of duties
- duplicate-event handling
- invalid-data handling
- conflicting-update handling
- synthetic data
- at least two disruption scenarios

---

# 7. Critical Architecture Principle

The most important architectural rule is:

```text
GRAPH
"What is connected to what?"

        ↓

BACKEND
"What does this data mean?"

        ↓

AI
"How can we explain and recommend?"

        ↓

HUMAN
"Should we approve this?"

        ↓

BACKEND
"Is this action actually permitted?"
```

---

# 8. Deterministic Logic vs AI

This separation is mandatory.

## Backend must determine:

- whether a shipment is late
- whether a supplier is disrupted
- whether inventory is sufficient
- whether a shortage exists
- which orders are affected
- risk scores
- risk levels
- deadlines
- available stock
- feasible recovery actions
- recovery calculations
- user permissions
- approval validity
- self-approval restrictions
- duplicate events
- conflicting updates
- whether execution is allowed

## AI may:

- summarize disruptions
- explain risk
- explain cascading impact
- explain recovery options
- compare trade-offs
- recommend a recovery option based on deterministic facts
- generate human-readable operational summaries

The AI must never become the source of truth for business rules.

---

# 9. Recommended Architecture

```text
                         ┌──────────────────────┐
                         │      React Web       │
                         │                      │
                         │ Dashboard            │
                         │ Impact Graph         │
                         │ Recovery Simulator   │
                         │ Approval Center      │
                         │ Audit                 │
                         └──────────┬───────────┘
                                    │
                              REST / WebSocket
                                    │
                         ┌──────────▼───────────┐
                         │     Spring Boot      │
                         │       Backend        │
                         ├──────────────────────┤
                         │ Controllers          │
                         │ Services             │
                         │ Impact Engine        │
                         │ Risk Engine          │
                         │ Recovery Engine      │
                         │ Security / RBAC      │
                         │ Audit Service        │
                         │ Webhook Processing   │
                         └───────┬───────┬──────┘
                                 │       │
                        ┌────────▼──┐ ┌──▼─────────────┐
                        │   Neo4j   │ │   AI Gateway   │
                        │  Graph DB │ │    FastAPI     │
                        └───────────┘ └───────┬────────┘
                                             │
                                      ┌──────┴──────┐
                                      │             │
                                      ▼             ▼
                                  Gemini API    OpenRouter
                                  Provider      Provider
```

---

# 10. Technology Stack

## Frontend

- React
- Vite
- Tailwind CSS
- React Router
- React Flow
- Recharts

## Backend

- Java
- Spring Boot
- Spring Web
- Spring Security
- Spring Data Neo4j
- Bean Validation
- JWT

## Database

- Neo4j

## AI Gateway

- Python
- FastAPI

## LLM Providers

Primary:

- Google Gemini API

Fallback/alternative:

- OpenRouter

Development-only local option:

- Ollama

## Data

- CSV
- JSON
- Synthetic generated dataset

---

# 11. Why an AI Gateway?

The application should not directly couple business logic to a particular LLM provider.

Instead:

```text
Spring Boot
      │
      ▼
AI Gateway
      │
      ├──────────────► Gemini
      │
      └──────────────► OpenRouter
```

This provides:

- provider independence
- easier deployment
- easier model replacement
- centralized prompt management
- centralized validation
- easier rate-limit handling
- easier fallback handling

The backend should communicate with the AI gateway through a stable internal API.

---

# 12. AI Provider Abstraction

Recommended conceptual interface:

```text
AIProvider
   │
   ├── GeminiProvider
   │
   └── OpenRouterProvider
```

The rest of the application should call:

```text
AIService.generateRecoveryRecommendation(...)
```

rather than directly calling Gemini or OpenRouter.

This allows the provider to change without rewriting the recovery engine.

---

# 13. Deployment Architecture

The application is intended to be deployed as a web application.

Recommended deployment topology:

```text
                         INTERNET
                            │
                            ▼
                    ┌──────────────┐
                    │   Frontend   │
                    │ React / Vite │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Backend    │
                    │ Spring Boot  │
                    └───┬──────┬───┘
                        │      │
             ┌──────────┘      └─────────────┐
             ▼                               ▼
       ┌───────────┐                   ┌────────────┐
       │   Neo4j   │                   │ AI Gateway │
       │   Aura /  │                   │  FastAPI   │
       │  Hosted   │                   └─────┬──────┘
       └───────────┘                         │
                                    ┌────────┴────────┐
                                    ▼                 ▼
                                  Gemini          OpenRouter
```

The exact hosting providers can be selected based on available free tiers and hackathon requirements.

---

# 14. LLM Strategy

The LLM is not the competitive advantage.

The system's competitive advantage is the **deterministic recovery simulation and impact analysis**.

The LLM is used to make the system easier to understand.

Recommended flow:

```text
Disruption
    ↓
Neo4j
    ↓
Impact Analysis
    ↓
Risk Engine
    ↓
Recovery Engine
    ↓
Structured Facts
    ↓
AI Gateway
    ↓
Gemini / OpenRouter
    ↓
Explanation + Recommendation
```

---

# 15. Recommended LLM Use Cases

## 15.1 Disruption Summary

Input:

```json
{
  "type": "SHIPMENT_DELAY",
  "shipmentId": "SH-102",
  "delayDays": 4,
  "reason": "Heavy traffic",
  "affectedOrders": 17,
  "criticalOrders": 5
}
```

Output:

```text
Shipment SH-102 is delayed by 4 days due to heavy traffic.
The delay affects 17 customer orders, including 5 critical orders.
```

---

## 15.2 Risk Explanation

Input:

```json
{
  "orderId": "ORD-204",
  "riskScore": 92,
  "riskLevel": "CRITICAL",
  "factors": [
    "delivery deadline in 1 day",
    "insufficient inventory",
    "delayed inbound shipment",
    "no alternative warehouse stock"
  ]
}
```

Output:

```text
ORD-204 is critical because its delivery deadline falls within
the disruption window, available inventory is insufficient, and
no alternative stock is currently available.
```

---

## 15.3 Recovery Recommendation

Input:

```json
{
  "options": [
    {
      "name": "Reallocate Stock",
      "cost": 900,
      "ordersSaved": 12,
      "recoveryDays": 2
    },
    {
      "name": "Expedite Shipment",
      "cost": 450,
      "ordersSaved": 14,
      "recoveryDays": 1
    }
  ]
}
```

Output:

```json
{
  "recommendedOption": "EXPEDITE_SHIPMENT",
  "reason": "It saves more orders, has lower cost, and provides faster recovery.",
  "tradeoffs": [
    "Requires additional transportation cost"
  ]
}
```

The AI must only use facts supplied by the backend.

---

# 16. AI Prompt Rules

Every AI prompt should explicitly state:

```text
You are a supply-chain operations assistant.

Use only the facts provided in the input.

Do not invent:
- inventory
- costs
- supplier capacity
- delivery dates
- order quantities
- permissions
- execution status

Do not override deterministic calculations.

Do not claim an action has been executed.

Return structured output where requested.
```

---

# 17. AI Must Not Access the Database Directly

Do NOT build:

```text
LLM → Neo4j
```

Prefer:

```text
Neo4j
   ↓
Backend
   ↓
Deterministic analysis
   ↓
Structured AI context
   ↓
LLM
```

This protects the system against:

- hallucinated data
- unauthorized data access
- accidental database mutations
- inconsistent business calculations

---

# 18. AI Failure Handling

The application must remain operational when the LLM is unavailable.

Example:

```text
Gemini unavailable
       ↓
AI explanation unavailable
       ↓
Impact analysis still works
       ↓
Risk ranking still works
       ↓
Recovery calculations still work
       ↓
User can still inspect deterministic results
```

AI must be an enhancement, not a single point of failure.

---

# 19. Supply-Chain Graph

The graph is the foundation of impact analysis.

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

Disruptions:

```text
Disruption
   ├── AFFECTS → Supplier
   ├── AFFECTS → Shipment
   ├── AFFECTS → Warehouse
   ├── AFFECTS → Product
   └── AFFECTS → Order
```

---

# 20. Graph Query Example

Example Neo4j query:

```cypher
MATCH
    (s:Shipment {id: "SH-102"})
    -[:DELIVERS_TO]->
    (w:Warehouse)
    -[:STORES]->
    (p:Product)
    -[:REQUIRED_BY]->
    (o:Order)
RETURN o;
```

The graph answers:

> Which orders depend on this disrupted shipment?

The backend then determines:

> What does this dependency mean operationally?

---

# 21. Core Entities

The system should contain:

```text
Supplier
Product
Warehouse
Inventory
Shipment
Customer
Order
Disruption
RecoveryPlan
RecoveryAction
Notification
AuditEvent
User
Role
```

---

# 22. Supplier

Example:

```json
{
  "id": "SUP-001",
  "name": "Global Components Ltd",
  "status": "ACTIVE",
  "leadTimeDays": 7
}
```

Statuses:

```text
ACTIVE
DELAYED
DISRUPTED
SUSPENDED
```

---

# 23. Product

```json
{
  "id": "PROD-100",
  "name": "Industrial Sensor",
  "category": "Electronics",
  "unitCost": 120
}
```

---

# 24. Warehouse

```json
{
  "id": "WH-001",
  "name": "Chennai Central Warehouse",
  "location": "Chennai",
  "capacity": 10000
}
```

---

# 25. Inventory

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

Deterministic calculation:

```text
available = onHand - reserved
```

---

# 26. Shipment

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

Statuses:

```text
PLANNED
IN_TRANSIT
DELIVERED
DELAYED
CANCELLED
```

---

# 27. Customer Order

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

Priorities:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

---

# 28. Disruption Types

Initial supported types:

```text
SHIPMENT_DELAY
SUPPLIER_DELAY
SUPPLIER_OUTAGE
INVENTORY_SHORTAGE
STOCKOUT
```

Future types:

```text
WAREHOUSE_FAILURE
PORT_CLOSURE
CUSTOMS_DELAY
DEMAND_SPIKE
QUALITY_HOLD
TRANSPORT_CAPACITY_REDUCTION
```

---

# 29. Disruption Detection

Detection is deterministic.

### Shipment delay

```text
updated ETA > required delivery threshold
        ↓
SHIPMENT_DELAY
```

### Supplier disruption

```text
supplier.status = DISRUPTED
        ↓
SUPPLIER_OUTAGE
```

### Inventory shortage

```text
available inventory < required demand
        ↓
INVENTORY_SHORTAGE
```

### Stockout

```text
available inventory <= 0
        ↓
STOCKOUT
```

The LLM must not determine these states.

---

# 30. Carrier Webhook

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

Flow:

```text
Carrier
   ↓
POST /api/webhooks/carrier
   ↓
Validate
   ↓
Check event ID
   ↓
Deduplicate
   ↓
Update shipment
   ↓
Detect disruption
   ↓
Impact analysis
   ↓
Risk engine
   ↓
Recovery engine
   ↓
AI explanation
   ↓
Notification
```

---

# 31. Duplicate Event Handling

Webhook processing must be idempotent.

If:

```text
EVT-1001
```

has already been processed, receiving it again must not:

- create another disruption
- double-count inventory
- create duplicate notifications
- create duplicate recovery plans
- corrupt shipment state

Possible event states:

```text
RECEIVED
PROCESSED
DUPLICATE
REJECTED
CONFLICTING
```

---

# 32. Invalid Data Handling

Examples:

```text
negative quantity
missing shipment ID
unknown warehouse
unknown product
invalid status
invalid date
missing event ID
```

Return:

```http
400 Bad Request
```

Example:

```json
{
  "error": "INVALID_EVENT",
  "message": "shipmentId is required"
}
```

Do not silently accept invalid data.

---

# 33. Conflicting Event Handling

Example:

```text
Event A:
SH-102 = DELAYED

Event B:
SH-102 = DELIVERED
```

The system must not blindly overwrite state.

Possible deterministic strategy:

```text
NEWER VALID EVENT
        ↓
ACCEPT

OLDER EVENT
        ↓
IGNORE / RECORD

CONFLICTING EVENT
        ↓
FLAG FOR REVIEW
```

Use event timestamps, versions, sequence numbers, or source priority where appropriate.

---

# 34. Impact Analysis

When a disruption occurs:

```text
Supplier
   ↓
Shipment
   ↓
Warehouse
   ↓
Product
   ↓
Inventory
   ↓
Orders
   ↓
Customers
```

The system should calculate:

- affected suppliers
- affected shipments
- affected warehouses
- affected products
- affected inventory
- affected orders
- affected customers
- shortage quantities
- delivery risk

---

# 35. Inventory Calculation

Example:

```text
Current inventory = 100
Reserved = 40

Available:

100 - 40 = 60
```

If:

```text
Daily demand = 30
Delay = 4 days
```

Then:

```text
Expected demand = 30 × 4
                = 120
```

Shortage:

```text
120 - 60 = 60 units
```

Backend output:

```json
{
  "availableInventory": 60,
  "expectedDemand": 120,
  "shortage": 60
}
```

The AI can explain this result but must not recalculate or override it.

---

# 36. Risk Ranking

Every affected order should receive a deterministic risk score.

Possible factors:

```text
deadline risk
order priority
inventory risk
shortage quantity
shipment delay
supplier risk
alternative stock availability
customer importance
```

Example:

```text
Risk Score =
    Deadline Risk
  + Inventory Risk
  + Disruption Severity
  + Order Priority
  + Supply Dependency
```

Example:

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

---

# 37. Risk Levels

Recommended:

```text
LOW       0–24
MEDIUM   25–49
HIGH     50–74
CRITICAL 75–100
```

The thresholds should be configurable.

The LLM cannot invent risk levels.

---

# 38. Recovery Strategies

The system must support:

```text
1. Reallocate stock
2. Expedite shipment
3. Alternative supplier
4. Split order
```

---

# 39. Reallocate Stock

Example:

```text
Warehouse A:
shortage = 60

Warehouse B:
surplus = 100
```

Potential action:

```text
WH-B → WH-A
60 units
```

Backend must verify:

- source has sufficient available stock
- destination exists
- quantity is valid
- source does not become critically short
- product matches

---

# 40. Expedite Shipment

Example:

```text
Normal arrival: 4 days
Expedited arrival: 1 day
Additional cost: $450
```

Calculate:

- recovery time
- cost
- orders saved
- residual risk

---

# 41. Alternative Supplier

Backend must verify:

- supplier status
- product capability
- available quantity
- lead time
- cost
- capacity

---

# 42. Split Order

Example:

```text
Order = 100

Available now = 60

Ship now = 60
Remaining = 40
```

The system must calculate the resulting delivery impact.

---

# 43. Recovery Plan

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

# 44. What-If Simulation Engine

This is the central differentiator.

The engine should evaluate:

```text
DO NOTHING
REALLOCATE
EXPEDITE
ALTERNATIVE SUPPLIER
SPLIT ORDER
```

Example:

```text
                    DO NOTHING  REALLOCATE  EXPEDITE
-----------------------------------------------------
Affected Orders         47           9          5
Critical Orders         12           2          0
Shortage Units         820           0          0
Recovery Days            8           2          1
Estimated Cost          $0          $900       $450
```

The simulation must be deterministic.

The AI can explain the results.

The AI must not generate the numbers.

---

# 45. Simulation Isolation

A what-if simulation must not mutate live operational state.

Correct:

```text
Current State
     ↓
Copy / Scenario State
     ↓
Apply hypothetical action
     ↓
Calculate result
     ↓
Discard scenario
```

Incorrect:

```text
Current State
     ↓
Modify database
     ↓
Call it a simulation
```

Only approved execution should modify operational state.

---

# 46. Recovery Recommendation

The recovery engine produces structured options.

The AI receives them and explains trade-offs.

Example:

```json
{
  "options": [
    {
      "type": "REALLOCATE",
      "cost": 900,
      "ordersSaved": 38,
      "recoveryDays": 2,
      "residualRisk": 10
    },
    {
      "type": "EXPEDITE",
      "cost": 450,
      "ordersSaved": 44,
      "recoveryDays": 1,
      "residualRisk": 4
    }
  ]
}
```

AI output:

```json
{
  "recommendedOption": "EXPEDITE",
  "reason": "It has the lowest cost among the options with zero critical orders and provides the fastest recovery.",
  "tradeoffs": [
    "Requires expedited transportation",
    "Depends on carrier availability"
  ]
}
```

---

# 47. Approval Workflow

Recovery plan lifecycle:

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

Alternative states:

```text
PENDING_APPROVAL
   ├── REJECTED
   └── MODIFICATION_REQUESTED
```

---

# 48. Separation of Duties

Example:

```text
User A creates plan
       ↓
User A cannot approve it
       ↓
User B reviews
       ↓
User B approves
       ↓
Execution allowed
```

Backend must enforce this.

A hidden frontend button is not security.

Example:

```http
POST /api/recovery-plans/RP-1001/approve
```

Unauthorized:

```http
403 Forbidden
```

---

# 49. Roles

## Operations Analyst

Can:

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

## Supply Chain Manager

Can:

```text
VIEW_OPERATIONAL_DATA
VIEW_IMPACT
VIEW_RISK
REVIEW_RECOVERY_PLAN
APPROVE_RECOVERY_PLAN
REJECT_RECOVERY_PLAN
VIEW_AUDIT
```

---

## Warehouse Operator

Can:

```text
VIEW_WAREHOUSE
VIEW_INVENTORY
EXECUTE_WAREHOUSE_ACTION
UPDATE_INVENTORY
```

---

## Procurement Approver

Can:

```text
VIEW_SUPPLIERS
VIEW_DISRUPTIONS
VIEW_RECOVERY_PLAN
APPROVE_PROCUREMENT_ACTION
```

---

## Administrator

Can:

```text
MANAGE_USERS
MANAGE_ROLES
VIEW_AUDIT
VIEW_SYSTEM_STATE
CONFIGURE_SYSTEM
```

Administrators must still respect business approval rules where required.

---

# 50. Notifications

Generate notifications for:

```text
critical disruption
critical order
approval required
plan approved
plan rejected
execution completed
execution failed
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

# 51. Audit Trail

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

---

# 52. Dashboard

The dashboard should answer:

> **"What is happening right now?"**

Primary metrics:

```text
Active Disruptions
Affected Orders
Critical Orders
Inventory Shortage
Pending Approvals
Recovery Plans
Recovery Success Rate
```

Main sections:

### Active Disruptions

```text
Disruption
Severity
Affected Orders
Affected Products
Duration
Status
```

### Risk Overview

```text
Critical
High
Medium
Low
```

### Pending Approvals

```text
Plan
Created By
Estimated Cost
Orders Saved
Risk Reduction
Required Approver
```

### Recovery Progress

```text
Approved
Executing
Completed
Failed
```

---

# 53. Impact Graph

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

The graph UI should support:

- node selection
- relationship inspection
- entity details
- severity highlighting
- filtering
- critical-order focus

---

# 54. Recommended API

## Authentication

```http
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me
```

## Suppliers

```http
GET    /api/suppliers
GET    /api/suppliers/{id}
POST   /api/suppliers
PUT    /api/suppliers/{id}
```

## Shipments

```http
GET    /api/shipments
GET    /api/shipments/{id}
POST   /api/shipments
PUT    /api/shipments/{id}
```

## Orders

```http
GET /api/orders
GET /api/orders/{id}
GET /api/orders/{id}/risk
```

## Inventory

```http
GET /api/inventory
GET /api/inventory/{id}
GET /api/inventory/warehouse/{warehouseId}
```

## Disruptions

```http
GET  /api/disruptions
GET  /api/disruptions/{id}
POST /api/disruptions
GET  /api/disruptions/{id}/impact
GET  /api/disruptions/{id}/risk
```

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

## Webhook

```http
POST /api/webhooks/carrier
```

## Notifications

```http
GET  /api/notifications
POST /api/notifications/{id}/read
```

## Audit

```http
GET /api/audit
GET /api/audit/{entityId}
```

---

# 55. Data Import

Required formats:

```text
CSV
JSON
```

Recommended endpoints:

```http
POST /api/import/suppliers
POST /api/import/products
POST /api/import/warehouses
POST /api/import/inventory
POST /api/import/shipments
POST /api/import/orders
```

Pipeline:

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
Import report
```

Example:

```json
{
  "totalRows": 100,
  "successful": 94,
  "duplicates": 3,
  "invalid": 3
}
```

---

# 56. Synthetic Dataset

Generate the dataset rather than relying on external data.

Suggested initial scale:

```text
5–10 suppliers
3–5 warehouses
20–50 products
50–100 shipments
100–300 orders
100–500 inventory records
```

The dataset must contain deliberate relationships and disruptions.

---

# 57. Required Scenario A — Shipment Delay

Initial:

```text
Shipment SH-102
Supplier SUP-001
Warehouse WH-001
Product PROD-100
```

Trigger:

```text
Carrier reports 4-day delay
```

Expected:

```text
Webhook received
       ↓
Shipment DELAYED
       ↓
Impact analysis
       ↓
Inventory impact
       ↓
Affected orders
       ↓
Risk ranking
       ↓
Recovery options
       ↓
AI explanation
       ↓
Approval
       ↓
Simulation
```

---

# 58. Required Scenario B — Supplier Outage

Trigger:

```text
Supplier SUP-002
Unavailable for 7 days
```

Expected:

```text
Supplier disruption
       ↓
Affected inbound shipments
       ↓
Inventory depletion
       ↓
Potential stockout
       ↓
Affected orders
       ↓
Critical order ranking
       ↓
Recovery comparison
```

Possible recovery:

```text
Alternative supplier
Reallocation
Expedite
Split orders
```

---

# 59. Ideal Hackathon Demo

The demonstration should tell one coherent story.

## Step 1 — Normal State

```text
Active disruptions: 0
Critical orders: 0
Pending approvals: 0
```

## Step 2 — Trigger Disruption

```http
POST /api/webhooks/carrier
```

```json
{
  "eventId": "EVT-1001",
  "shipmentId": "SH-102",
  "status": "DELAYED",
  "delayDays": 4,
  "reason": "Heavy traffic"
}
```

## Step 3 — Show Cascading Impact

```text
Shipment 🔴
    ↓
Warehouse 🟠
    ↓
Product 🟠
    ↓
Orders 🔴
```

## Step 4 — Show Risk

```text
ORD-204   92   CRITICAL
ORD-211   84   CRITICAL
ORD-205   71   HIGH
ORD-208   54   HIGH
```

## Step 5 — Show AI Explanation

Example:

> ORD-204 is critical because its promised delivery date falls within the disruption window, available inventory is insufficient, and no alternative warehouse stock is currently available.

## Step 6 — Show Recovery Simulator

```text
                 Do Nothing   Reallocate   Expedite
-----------------------------------------------------
Affected Orders      17            5           3
Critical Orders       5            1           0
Shortage              60            0           0
Cost                  $0           $900        $450
```

## Step 7 — Select Strategy

Example:

```text
EXPEDITE
```

## Step 8 — Human Approval

Manager approves.

Backend validates:

```text
authenticated?
correct role?
authorized?
not plan creator?
plan still pending?
```

## Step 9 — Simulated Execution

Update:

```text
shipment
inventory
orders
recovery plan
notifications
audit
```

## Step 10 — Show Before / After

```text
BEFORE                    AFTER

Critical orders: 5   →   0
Shortage: 60         →   0
Affected orders: 17  →   3
```

This is the key visual payoff.

---

# 60. Competitive Hackathon Strategy

Because the hackathon has only four problem statements, multiple teams are expected to solve the same problem.

Therefore:

**Do not compete by building the largest system.**

Compete by making the core decision workflow significantly better.

The project should optimize for:

```text
Clarity
+
Technical depth
+
Visible cause/effect
+
Strong demo
+
Explainability
```

The judge should remember:

> "That was the team that simulated the consequences of each recovery decision."

---

# 61. Features to Prioritize

| Feature | Priority |
|---|---:|
| Recovery Simulator | 10/10 |
| Cascading Impact Graph | 10/10 |
| Before/After Metrics | 10/10 |
| Deterministic Risk Engine | 9/10 |
| RBAC + Approval | 9/10 |
| AI Explanation | 8/10 |
| Carrier Webhook | 8/10 |
| Audit Trail | 7/10 |
| Notifications | 6/10 |
| Extra Features | 2/10 |

Do not spend hackathon time building unnecessary features before these are polished.

---

# 62. Features to Avoid Overbuilding

Do not prioritize:

- generic chatbot
- excessive CRUD pages
- huge ML model
- fake real-time integrations
- unnecessary microservices
- complex event streaming unless needed
- advanced autonomous agents
- dozens of charts
- decorative animations
- production-scale infrastructure

The project should demonstrate depth, not feature count.

---

# 63. Backend Project Structure

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
│
├── dto/
│
├── repository/
│
├── exception/
│
└── util/
```

---

# 64. AI Gateway Structure

```text
ai-service/
│
├── app/
│   ├── main.py
│   │
│   ├── routes/
│   │   ├── explanation.py
│   │   └── recommendation.py
│   │
│   ├── providers/
│   │   ├── base.py
│   │   ├── gemini.py
│   │   └── openrouter.py
│   │
│   ├── services/
│   │   ├── ai_service.py
│   │   └── prompt_service.py
│   │
│   ├── schemas/
│   │   ├── disruption.py
│   │   └── recovery.py
│   │
│   └── prompts/
│       ├── disruption_summary.txt
│       ├── risk_explanation.txt
│       └── recovery_recommendation.txt
│
└── requirements.txt
```

---

# 65. Frontend Structure

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
│   │   ├── SimulationTable.jsx
│   │   ├── ApprovalPanel.jsx
│   │   └── AuditTimeline.jsx
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Disruptions.jsx
│   │   ├── DisruptionDetails.jsx
│   │   ├── RecoveryPlanner.jsx
│   │   ├── Approvals.jsx
│   │   └── Audit.jsx
│   │
│   ├── services/
│   │   └── api.js
│   │
│   ├── hooks/
│   ├── context/
│   └── App.jsx
```

---

# 66. AI Coding Agent Rules

This section is specifically for AI coding agents.

Before modifying code:

1. Read this README.
2. Inspect the repository.
3. Identify the relevant module.
4. Understand existing models.
5. Understand existing APIs.
6. Preserve architecture.
7. Make the smallest appropriate change.
8. Add tests for critical logic.
9. Do not invent requirements.
10. Do not rewrite unrelated code.

---

# 67. Coding Rule — Controller

Controllers should handle:

```text
HTTP request
validation
authentication context
service invocation
HTTP response
```

Do not put complex business logic in controllers.

---

# 68. Coding Rule — Service

Services should contain:

```text
business logic
workflow orchestration
state transitions
deterministic calculations
```

---

# 69. Coding Rule — Repository

Repositories should handle:

```text
persistence
queries
graph traversal
data retrieval
```

---

# 70. Coding Rule — AI

AI services should:

```text
receive structured facts
generate explanations
generate recommendations
return validated structured output
```

AI must not:

```text
modify database
approve plans
change inventory
change risk scores
change permissions
execute actions
```

---

# 71. Coding Rule — Authorization

Never rely on frontend role checks.

Incorrect:

```javascript
if (user.role === "MANAGER") {
    showApproveButton();
}
```

Correct:

```text
Frontend hides/shows UI
        +
Backend enforces permission
```

---

# 72. Coding Rule — External Input

Validate:

- REST requests
- webhooks
- CSV
- JSON
- AI responses
- query parameters

---

# 73. Coding Rule — Idempotency

Operations triggered by external events must be safe to retry.

Especially:

```text
carrier webhook
inventory update
recovery execution
notification generation
```

---

# 74. Coding Rule — Simulation

Simulation must never mutate production state.

Use:

```text
Current State
      ↓
Scenario Copy
      ↓
Hypothetical Action
      ↓
Calculate Result
      ↓
Discard
```

Only approved execution can change operational state.

---

# 75. Coding Rule — No Unnecessary Dependencies

Before adding a library, ask:

```text
Does the existing stack already solve this?
```

Do not add technology merely because it is popular.

---

# 76. Testing

## Unit Tests

Test:

- inventory calculations
- risk scoring
- disruption classification
- recovery calculations
- permissions
- duplicate detection

Example:

```text
onHand = 100
reserved = 40
dailyDemand = 30
delay = 4

expected shortage = 60
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

Minimum:

```text
Create disruption
→ calculate impact
→ generate recovery plan
→ simulate alternatives
→ approve
→ execute
→ verify state
→ verify audit
```

---

# 77. Error Handling

Use consistent errors.

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

Recommended categories:

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

# 78. Environment Variables

Example:

```env
SPRING_PROFILES_ACTIVE=dev

NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=

JWT_SECRET=

AI_SERVICE_URL=http://localhost:8001

GEMINI_API_KEY=
OPENROUTER_API_KEY=

AI_PROVIDER=gemini
```

Never commit secrets.

Provide:

```text
.env.example
```

---

# 79. Local Development

Recommended:

```text
1. Start Neo4j
2. Start AI service
3. Start Spring Boot
4. Start React
```

Development AI provider:

```text
Gemini
or
OpenRouter
```

Ollama may remain available as a local-development fallback.

---

# 80. Production/Web Deployment

The deployed application should follow:

```text
Browser
  ↓ HTTPS
Frontend
  ↓ HTTPS
Spring Boot
  ↓
Neo4j
  ↓
AI Gateway
  ↓
Gemini/OpenRouter
```

Important requirements:

- HTTPS
- environment variables
- CORS configuration
- secure JWT handling
- server-side API keys
- backend authorization
- rate limiting where appropriate
- provider timeout handling
- AI failure fallback
- logging without secrets

---

# 81. Seed Data

Provide deterministic seed data.

It must create:

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

It should also create the two demonstration scenarios.

The demo should be reproducible from a clean database.

---

# 82. Database Reset

Development-only reset:

```text
reset
 ↓
constraints
 ↓
seed
 ↓
ready
```

Never expose destructive reset operations publicly.

---

# 83. UI Pages

Keep the application focused.

## Dashboard

Answers:

> What is happening right now?

## Disruption Details

Answers:

> What happened and what is affected?

Contains:

- disruption
- impact graph
- affected orders
- risk
- AI explanation

## Recovery Simulator

Answers:

> What should we do?

Contains:

- recovery options
- what-if results
- cost
- recovery time
- orders saved
- residual risk

## Approval Center

Answers:

> What requires my decision?

## Audit

Answers:

> What happened and who did it?

---

# 84. UX Principles

The user should be able to understand:

```text
WHAT HAPPENED?
      ↓
WHAT IS AFFECTED?
      ↓
HOW SERIOUS?
      ↓
WHAT CAN WE DO?
      ↓
WHAT HAPPENS IF WE DO IT?
      ↓
WHO APPROVES?
      ↓
WHAT CHANGED?
```

Avoid overwhelming users with raw database information.

---

# 85. Dashboard Design Philosophy

The dashboard should prioritize:

```text
severity
impact
decision
action
result
```

not:

```text
maximum number of charts
maximum number of tables
maximum number of CRUD screens
```

---

# 86. Observability

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

Never log:

- passwords
- API keys
- JWT tokens
- secrets

---

# 87. Performance

For hackathon scale:

- index IDs
- avoid N+1 queries
- optimize graph traversal
- cache where useful
- paginate large tables
- avoid repeated impact calculations
- use asynchronous AI requests where appropriate

Do not introduce distributed infrastructure unless required.

---

# 88. Development Roadmap

## Phase 1 — Foundation

```text
[ ] Spring Boot
[ ] React
[ ] Neo4j
[ ] Authentication
[ ] Roles
```

## Phase 2 — Core Data

```text
[ ] Supplier
[ ] Product
[ ] Warehouse
[ ] Inventory
[ ] Shipment
[ ] Order
[ ] Customer
```

## Phase 3 — Graph

```text
[ ] Relationships
[ ] Graph queries
[ ] Impact traversal
```

## Phase 4 — Disruption

```text
[ ] Disruption model
[ ] Carrier webhook
[ ] Validation
[ ] Idempotency
[ ] Conflict handling
```

## Phase 5 — Impact

```text
[ ] Affected products
[ ] Affected inventory
[ ] Affected orders
[ ] Shortage calculation
```

## Phase 6 — Risk

```text
[ ] Risk score
[ ] Risk levels
[ ] Risk factors
```

## Phase 7 — Recovery

```text
[ ] Reallocate
[ ] Expedite
[ ] Alternative supplier
[ ] Split order
```

## Phase 8 — Recovery Simulator

```text
[ ] Do nothing
[ ] Simulate reallocation
[ ] Simulate expedite
[ ] Simulate supplier change
[ ] Simulate split
[ ] Compare outcomes
```

## Phase 9 — AI Gateway

```text
[ ] FastAPI
[ ] Provider abstraction
[ ] Gemini provider
[ ] OpenRouter provider
[ ] Structured outputs
[ ] Prompt validation
```

## Phase 10 — Approval

```text
[ ] Create plan
[ ] Approve
[ ] Reject
[ ] Modify
[ ] Self-approval prevention
```

## Phase 11 — Execution

```text
[ ] Simulated execution
[ ] State updates
[ ] Notifications
[ ] Audit
```

## Phase 12 — Dashboard

```text
[ ] KPIs
[ ] Disruptions
[ ] Risk
[ ] Recovery simulator
[ ] Approvals
[ ] Recovery progress
[ ] Audit
```

## Phase 13 — Deployment

```text
[ ] Deploy frontend
[ ] Deploy backend
[ ] Deploy AI gateway
[ ] Configure Neo4j
[ ] Configure API keys
[ ] Configure CORS
[ ] Test public application
```

## Phase 14 — Demo Hardening

```text
[ ] Scenario A
[ ] Scenario B
[ ] Duplicate webhook
[ ] Invalid webhook
[ ] RBAC
[ ] Self-approval rejection
[ ] Before/after metrics
[ ] AI failure fallback
```

---

# 89. Definition of Done

The project is complete when:

```text
[ ] Synthetic data loads
[ ] User logs in
[ ] Dashboard works
[ ] Carrier webhook works
[ ] Duplicate webhook is safe
[ ] Invalid event is rejected
[ ] Shipment updates
[ ] Disruption is detected
[ ] Graph impact is calculated
[ ] Inventory shortage is calculated
[ ] Orders are identified
[ ] Orders receive risk scores
[ ] Critical orders are ranked
[ ] AI explains impact
[ ] Recovery strategies are calculated
[ ] What-if simulation works
[ ] Recovery options are comparable
[ ] Recovery plan is created
[ ] Unauthorized approval fails
[ ] Self-approval fails
[ ] Authorized approval succeeds
[ ] Simulated execution succeeds
[ ] State changes correctly
[ ] Notification is created
[ ] Audit event is created
[ ] Before/after results are shown
[ ] Scenario B works
[ ] Web deployment works
[ ] AI provider failure does not break core system
```

---

# 90. Example Canonical Flow

Initial state:

```text
Shipment SH-102
Status: IN_TRANSIT

Available inventory:
60

Affected orders:
0

Critical orders:
0
```

Webhook:

```text
SH-102 delayed by 4 days
```

System:

```text
IN_TRANSIT
    ↓
DELAYED
```

Impact:

```text
Available = 60
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
Reallocate
Expedite
Alternative Supplier
Split Order
```

Simulator:

```text
Do Nothing
Reallocate
Expedite
Alternative Supplier
```

AI:

```text
Explains trade-offs
```

Human:

```text
Approves chosen strategy
```

Backend:

```text
Validates authorization
```

Execution:

```text
Simulated state change
```

Result:

```text
Critical orders: 5 → 0
Shortage: 60 → 0
```

Audit:

```text
Plan approved
Execution completed
```

---

# 91. Future Extensions

Only after the core system is stable:

- real carrier APIs
- real supplier APIs
- demand forecasting
- ML risk prediction
- optimization solver
- multi-echelon planning
- digital twin
- autonomous agents
- Kafka
- event streaming
- carbon-aware recovery
- cost optimization
- customer communication generation
- mobile application

These are not required for the core hackathon solution.

---

# 92. Final Product Philosophy

DisruptionIQ should be able to answer five questions better than a basic supply-chain dashboard:

```text
1. WHAT HAPPENED?
2. WHAT WILL IT AFFECT?
3. HOW SERIOUS IS IT?
4. WHAT ARE OUR OPTIONS?
5. WHAT HAPPENS IF WE CHOOSE EACH OPTION?
```

The platform should make a clear distinction between:

```text
DETERMINISTIC FACTS
```

and:

```text
AI-ASSISTED RECOMMENDATIONS
```

The AI assists the decision.

The backend is the source of truth.

The human remains responsible for approval.

---

# 93. Instructions to AI Coding Agents

Treat this README as the primary product and architecture specification.

Before implementing anything:

1. Read this README.
2. Inspect the repository.
3. Understand the existing architecture.
4. Identify the relevant module.
5. Preserve existing APIs where possible.
6. Do not rewrite unrelated code.
7. Keep business logic deterministic.
8. Keep AI advisory.
9. Enforce authorization server-side.
10. Preserve auditability.
11. Validate all external input.
12. Add tests for critical logic.
13. Keep simulations isolated from live state.
14. Do not expose API keys.
15. Do not invent missing requirements.

Requirement priority:

```text
Problem Statement
       ↓
This README
       ↓
Existing Architecture
       ↓
Existing Domain Model
       ↓
Existing API Contracts
       ↓
Existing Tests
       ↓
Minimal reasonable implementation
```

---

# 94. AI Agent Safety Rules

An AI coding agent must never:

```text
allow LLM output to directly mutate inventory
allow LLM output to approve recovery plans
allow LLM output to bypass RBAC
allow LLM output to modify risk scores
allow frontend-only authorization
skip webhook idempotency
mutate live state during simulation
hard-code API keys
invent database facts
invent business rules
```

---

# 95. Most Important Implementation Principle

If implementation time becomes limited, prioritize:

```text
1. Impact Graph
2. Deterministic Risk Engine
3. Recovery Simulator
4. Before/After Metrics
5. Approval + RBAC
6. AI Explanation
7. Webhook
8. Audit
9. Dashboard polish
```

A smaller implementation with these features working correctly is better than a huge incomplete system.

---

# 96. One-Sentence Project Definition

> **DisruptionIQ is an explainable, graph-based supply-chain disruption intelligence and recovery platform that traces cascading operational impact, deterministically ranks order risk, compares recovery strategies through what-if simulation, uses cloud LLMs to explain and recommend, and enables authorized humans to approve and safely simulate recovery actions.**
