# DisruptionIQ Backend --- Folder Structure

This document defines the recommended **Spring Boot + Maven backend
directory structure** for DisruptionIQ, using **Java 25**, Spring Boot,
Spring Security, and Neo4j.

## 1. Project structure

``` text
disruptioniq-backend/
├── pom.xml
├── mvnw
├── mvnw.cmd
├── .mvn/
│   └── wrapper/
├── README.md
├── .gitignore
└── src/
    ├── main/
    │   ├── java/
    │   │   └── com/
    │   │       └── disruptioniq/
    │   │           ├── DisruptionIqApplication.java
    │   │           │
    │   │           ├── config/
    │   │           │   ├── SecurityConfig.java
    │   │           │   ├── Neo4jConfig.java
    │   │           │   └── CorsConfig.java
    │   │           │
    │   │           ├── controller/
    │   │           │   ├── DisruptionController.java
    │   │           │   ├── ImpactController.java
    │   │           │   ├── RecoveryController.java
    │   │           │   ├── SimulationController.java
    │   │           │   ├── ApprovalController.java
    │   │           │   ├── ImportController.java
    │   │           │   └── HealthController.java
    │   │           │
    │   │           ├── service/
    │   │           │   ├── DisruptionService.java
    │   │           │   ├── ImpactAnalysisService.java
    │   │           │   ├── RiskAssessmentService.java
    │   │           │   ├── RecoveryPlanningService.java
    │   │           │   ├── SimulationService.java
    │   │           │   ├── ApprovalService.java
    │   │           │   ├── ImportService.java
    │   │           │   └── NotificationService.java
    │   │           │
    │   │           ├── engine/
    │   │           │   ├── ImpactAnalysisEngine.java
    │   │           │   ├── RiskEngine.java
    │   │           │   ├── RecoveryEngine.java
    │   │           │   └── SimulationEngine.java
    │   │           │
    │   │           ├── repository/
    │   │           │   ├── SupplierRepository.java
    │   │           │   ├── ShipmentRepository.java
    │   │           │   ├── WarehouseRepository.java
    │   │           │   ├── ProductRepository.java
    │   │           │   ├── InventoryRepository.java
    │   │           │   ├── OrderRepository.java
    │   │           │   ├── DisruptionRepository.java
    │   │           │   └── AuditEventRepository.java
    │   │           │
    │   │           ├── model/
    │   │           │   ├── Supplier.java
    │   │           │   ├── Shipment.java
    │   │           │   ├── Warehouse.java
    │   │           │   ├── Product.java
    │   │           │   ├── Inventory.java
    │   │           │   ├── CustomerOrder.java
    │   │           │   ├── Disruption.java
    │   │           │   ├── RecoveryPlan.java
    │   │           │   ├── Approval.java
    │   │           │   └── AuditEvent.java
    │   │           │
    │   │           ├── dto/
    │   │           │   ├── request/
    │   │           │   │   ├── CreateDisruptionRequest.java
    │   │           │   │   ├── CarrierWebhookRequest.java
    │   │           │   │   ├── SimulationRequest.java
    │   │           │   │   ├── RecoveryPlanRequest.java
    │   │           │   │   └── ApprovalRequest.java
    │   │           │   └── response/
    │   │           │       ├── DisruptionResponse.java
    │   │           │       ├── ImpactAnalysisResponse.java
    │   │           │       ├── RiskAssessmentResponse.java
    │   │           │       ├── RecoveryPlanResponse.java
    │   │           │       └── SimulationResponse.java
    │   │           │
    │   │           ├── mapper/
    │   │           │   └── RecoveryPlanMapper.java
    │   │           │
    │   │           ├── security/
    │   │           │   ├── JwtAuthenticationService.java
    │   │           │   ├── UserRole.java
    │   │           │   └── CurrentUserService.java
    │   │           │
    │   │           ├── webhook/
    │   │           │   ├── CarrierWebhookController.java
    │   │           │   ├── CarrierWebhookService.java
    │   │           │   └── WebhookEventDeduplicationService.java
    │   │           │
    │   │           ├── validation/
    │   │           │   ├── ImportValidator.java
    │   │           │   └── CarrierEventValidator.java
    │   │           │
    │   │           ├── audit/
    │   │           │   └── AuditService.java
    │   │           │
    │   │           ├── notification/
    │   │           │   └── NotificationService.java
    │   │           │
    │   │           ├── client/
    │   │           │   └── AiServiceClient.java
    │   │           │
    │   │           └── exception/
    │   │               ├── GlobalExceptionHandler.java
    │   │               ├── ResourceNotFoundException.java
    │   │               ├── InvalidEventException.java
    │   │               └── DuplicateEventException.java
    │   │
    │   └── resources/
    │       ├── application.yml
    │       ├── application-dev.yml
    │       ├── application-test.yml
    │       └── logback-spring.xml
    │
    └── test/
        └── java/
            └── com/
                └── disruptioniq/
                    ├── controller/
                    ├── service/
                    ├── engine/
                    ├── repository/
                    ├── security/
                    └── webhook/
```

## 2. What each directory is for

  -----------------------------------------------------------------------
  Directory                           Responsibility
  ----------------------------------- -----------------------------------
  `config/`                           Application configuration, CORS,
                                      security, and Neo4j setup.

  `controller/`                       REST API endpoints called by the
                                      React frontend.

  `service/`                          Coordinates use cases and business
                                      workflows.

  `engine/`                           Contains deterministic impact,
                                      risk, recovery, and simulation
                                      calculations.

  `repository/`                       Reads and writes graph data using
                                      Spring Data Neo4j and Cypher.

  `model/`                            Neo4j node and relationship domain
                                      models.

  `dto/request/`                      Validated input objects accepted by
                                      API endpoints.

  `dto/response/`                     Structured responses returned to
                                      the frontend.

  `mapper/`                           Converts domain models to response
                                      objects and vice versa.

  `security/`                         Authentication helpers, user
                                      identity, and role-related logic.

  `webhook/`                          Accepts carrier events and handles
                                      idempotency and duplicate
                                      detection.

  `validation/`                       Validates imported data and
                                      external event payloads.

  `audit/`                            Records important actions,
                                      approvals, and simulated
                                      executions.

  `notification/`                     Creates notifications for
                                      disruption and recovery workflow
                                      updates.

  `client/`                           Calls the separate Python FastAPI
                                      AI service.

  `exception/`                        Defines application exceptions and
                                      consistent API error responses.

  `resources/`                        YAML configuration and logging
                                      configuration.

  `src/test/`                         Unit, integration, repository, API,
                                      security, and webhook tests.
  -----------------------------------------------------------------------

## 3. Recommended implementation order

1.  **Foundation:** application class, `application.yml`, Neo4j
    connection, and health endpoint.
2.  **Graph data:** domain models and repositories for suppliers,
    shipments, warehouses, products, inventory, and orders.
3.  **Event ingestion:** disruption APIs, CSV/JSON imports, carrier
    webhook validation, and duplicate-event protection.
4.  **Impact analysis:** traverse graph relationships and identify
    affected shipments, inventory, orders, and customers.
5.  **Risk assessment:** calculate risk scores deterministically in
    Java.
6.  **Recovery and simulation:** compare recovery strategies without
    changing live graph state during what-if simulations.
7.  **Approvals and audit:** role-based permissions, separation of
    duties, approval checks, and audit events.
8.  **AI integration:** call FastAPI through
    `client/AiServiceClient.java` to explain results and recovery
    options.
9.  **Testing and hardening:** test duplicate events,
    invalid/conflicting events, permissions, simulations, and both demo
    scenarios.

## 4. Architecture rules

-   Keep business calculations in Java; do not rely on an LLM for risk
    scores or recovery calculations.
-   Keep the AI gateway separate. The AI service must not access Neo4j
    directly.
-   Treat what-if simulations as isolated from live state until an
    approved recovery action is executed.
-   Make carrier webhook handling idempotent so repeated event
    deliveries do not create duplicate effects.
-   Enforce authorization and prevent a user from approving their own
    recovery action when separation of duties is required.
-   Keep credentials and secrets in environment variables rather than
    committing them to source control.
-   Add classes as the corresponding feature is implemented; this tree
    is a target structure, not a requirement to create every file
    immediately.

## 5. Configuration reminder

Use environment variables for Neo4j credentials and the AI service URL.
For example:

``` yaml
spring:
  application:
    name: disruptioniq-backend
  neo4j:
    uri: ${NEO4J_URI:bolt://localhost:7687}
    authentication:
      username: ${NEO4J_USERNAME:neo4j}
      password: ${NEO4J_PASSWORD}

server:
  port: 8080

ai:
  service:
    url: ${AI_SERVICE_URL:http://localhost:8001}
```

Do not commit real passwords, API keys, or signing secrets to Git.
