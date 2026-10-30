# DisruptionIQ AI Service

An AI-powered supply-chain disruption explanation and recovery recommendation service built with **Python, FastAPI, Pydantic, Gemini, and OpenRouter**.

The service provides natural-language explanations of supply-chain disruptions and backend-calculated risk, along with recommendations selected exclusively from recovery options supplied by the calling system.

---

## 1. Overview

DisruptionIQ AI Service is an independent REST API responsible for the AI-related capabilities of DisruptionIQ.

It provides three primary capabilities:

1. **Disruption Explanation** — generates a concise explanation of a reported supply-chain disruption using the supplied shipment and order information.
2. **Risk Explanation** — explains a risk score, risk level, and associated risk factors calculated by the backend.
3. **Recovery Recommendation** — evaluates recovery options supplied by the backend and recommends one of those options, explaining its rationale and trade-offs.

The service is designed to separate AI-generated explanations from deterministic supply-chain calculations.

### Core principles

- Backend-provided data is the source of truth.
- Risk scores and risk levels are not recalculated by the AI service.
- Recovery recommendations must reference an option supplied in the request.
- The AI service does not execute recovery actions.
- API keys are loaded from environment configuration rather than hardcoded.
- Provider failures and invalid AI responses are handled explicitly.
- Automated tests use mocked responses where appropriate to avoid unnecessary external API calls.

## 2. Technology stack

| Technology | Purpose |
|---|---|
| Python | Application language |
| FastAPI | REST API framework |
| Uvicorn | ASGI development server |
| Pydantic | Request and response validation |
| Pydantic Settings | Environment-based configuration |
| Google Gen AI SDK | Gemini integration |
| HTTPX | Asynchronous HTTP communication with OpenRouter |
| Python dotenv | Loading environment variables from `.env` |
| unittest | Automated testing |
| FastAPI TestClient | HTTP endpoint testing |

## 3. Architecture

The service uses a layered structure.

```text
Client
  |
  v
FastAPI Application
  |
  +-- Health Route
  |
  +-- Explanation Routes
  |     +-- Disruption Explanation
  |     +-- Risk Explanation
  |
  +-- Recommendation Route
        +-- Recovery Recommendation
              |
              v
          AI Service
              |
              +-- Prompt Service
              |     +-- Disruption Prompt
              |     +-- Risk Prompt
              |     +-- Recovery Prompt
              |
              v
          Provider Factory
              |
              +-- Gemini Provider
              |
              +-- OpenRouter Provider
```

### Component responsibilities

**FastAPI application**

- Initializes the application.
- Registers API routers.
- Exposes the health endpoint.
- Publishes OpenAPI documentation.

**Routes**

- Accept and validate incoming requests.
- Call the AI service.
- Return structured response objects.
- Convert known AI errors into appropriate HTTP responses.

**AI service**

- Coordinates prompt construction and provider calls.
- Applies a generation timeout.
- Validates AI-generated recovery recommendation structures.
- Rejects recommendations that reference options not supplied by the backend.

**Prompt service**

- Loads prompt templates from the `app/prompts` directory.
- Inserts supplied data into the relevant templates.
- Prepares recovery options as JSON for the AI provider.

**Provider factory**

- Selects the configured provider.
- Supports Gemini and OpenRouter.

**AI providers**

- Gemini uses the asynchronous Google Gen AI SDK.
- OpenRouter uses asynchronous HTTP requests through HTTPX.
- Provider errors are normalized into the shared exception model.

## 4. Project structure

```text
ai-service/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   └── exceptions.py
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── gemini.py
│   │   ├── openrouter.py
│   │   └── factory.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── explanation.py
│   │   └── recommendation.py
│   ├── services/
│   │   ├── prompt_service.py
│   │   └── ai_service.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── disruption.py
│   │   ├── recovery.py
│   │   └── responses.py
│   └── prompts/
│       ├── disruption_summary.txt
│       ├── risk_explanation.txt
│       └── recovery_recommendation.txt
├── tests/
│   ├── __init__.py
│   ├── test_ai_service.py
│   ├── test_api_routes.py
│   ├── test_gemini_provider.py
│   ├── test_openrouter_provider.py
│   └── test_prompt_service.py
├── .env
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

This tree describes the intended project layout. Keep any additional existing files, such as local test scripts, if they are useful to your workflow.

## 5. Prerequisites

Before running the service, install:

- Python 3.11 or 3.12 recommended.
- pip.
- Visual Studio Code or another Python editor.
- A Gemini API key or an OpenRouter API key, depending on the selected provider.

The current development environment was built using Python 3.9. Python 3.9 emits end-of-life warnings from the Google authentication libraries. Upgrade the environment separately after confirming dependency compatibility.

## 6. Installation

### Step 1 — Navigate to the project

```powershell
cd D:\ai-service
```

### Step 2 — Create a virtual environment

For a supported Python installation:

```powershell
py -3.12 -m venv .venv
```

Activate it in PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, review the local execution policy rather than disabling security controls globally.

### Step 3 — Install dependencies

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Verify dependency consistency:

```powershell
python -m pip check
```

Expected result:

```text
No broken requirements found.
```

### Step 4 — Configure environment variables

Create `.env` in the project root, alongside `requirements.txt`.

Example configuration:

```dotenv
APP_NAME=DisruptionIQ AI Service
APP_ENV=development
APP_VERSION=0.1.0

AI_PROVIDER=gemini

GEMINI_API_KEY=your_gemini_api_key

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Replace the placeholder with your own valid API key. Never commit real API keys to version control.

When using OpenRouter, configure:

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4o-mini
```

The model name is configurable. Confirm that the selected model is available to your OpenRouter account.

The application reads configuration through `app/core/config.py`.

### Step 5 — Verify configuration

```powershell
python -c "from app.core.config import get_settings; s=get_settings(); print('Configuration loaded'); print('Provider:', s.ai_provider)"
```

Expected provider output for a Gemini configuration:

```text
Configuration loaded
Provider: gemini
```

Do not print API keys when verifying configuration.

## 7. Running the service

Start the development server from the project root:

```powershell
uvicorn app.main:app --reload
```

Default local address:

```text
http://127.0.0.1:8000
```

The `--reload` flag is intended for development, not production deployment.

### Available development URLs

| URL | Purpose |
|---|---|
| `http://127.0.0.1:8000/health` | Health check |
| `http://127.0.0.1:8000/docs` | Interactive Swagger UI |
| `http://127.0.0.1:8000/redoc` | ReDoc API documentation |
| `http://127.0.0.1:8000/openapi.json` | OpenAPI schema |

## 8. API endpoints

### 8.1 Health check

**Endpoint:** `GET /health`

Checks whether the FastAPI application is responding.

Example:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Example response:

```json
{
  "status": "ok",
  "service": "DisruptionIQ AI Service",
  "environment": "development"
}
```

A successful response returns HTTP `200 OK`.

This is a basic application health check. It does not guarantee that an external AI provider is reachable.

### 8.2 Disruption explanation

**Endpoint:** `POST /api/v1/explanations/disruption`

Generates a natural-language explanation based on the supplied disruption facts.

#### Request

```json
{
  "type": "Port Congestion",
  "shipmentId": "SHP-101",
  "delayDays": 3,
  "reason": "Severe congestion at the destination port",
  "affectedOrders": 12,
  "criticalOrders": 4
}
```

#### Response

```json
{
  "summary": "Shipment SHP-101 is delayed by three days because of severe congestion at the destination port. The disruption affects 12 orders, including 4 critical orders."
}
```

The response wording is illustrative. Actual AI-generated wording may vary.

#### Input fields

| Field | Type | Validation |
|---|---|---|
| `type` | String | Required, non-empty |
| `shipmentId` | String | Required, non-empty |
| `delayDays` | Integer | Must be zero or greater |
| `reason` | String | Required, non-empty |
| `affectedOrders` | Integer | Must be zero or greater |
| `criticalOrders` | Integer | Must be zero or greater |

#### Response fields

- `summary`: a non-empty explanation based on the supplied disruption facts.

The AI should not invent additional shipment facts or make unsupported operational recommendations.

### 8.3 Risk explanation

**Endpoint:** `POST /api/v1/explanations/risk`

Explains a risk score and risk factors supplied by the calling system.

#### Request

```json
{
  "orderId": "ORD-501",
  "riskScore": 85.5,
  "riskLevel": "HIGH",
  "factors": [
    "Shipment delayed by 5 days",
    "Critical inventory shortage",
    "Supplier reliability is low"
  ]
}
```

#### Response

```json
{
  "explanation": "Order ORD-501 has a high risk score of 85.5. The supplied factors include a shipment delay, a critical inventory shortage, and low supplier reliability."
}
```

The response text is illustrative.

#### Input fields

| Field | Type | Validation |
|---|---|---|
| `orderId` | String | Required, non-empty |
| `riskScore` | Number | Between 0 and 100 |
| `riskLevel` | String | Required, non-empty |
| `factors` | String array | At least one factor |

#### Response fields

- `explanation`: a non-empty explanation of the supplied score, level, and factors.

The backend remains authoritative for the risk score and risk level. The AI service explains those values; it does not recalculate them.

### 8.4 Recovery recommendation

**Endpoint:** `POST /api/v1/recommendations/recovery`

Selects one recovery strategy from the options supplied in the request and explains the associated trade-offs.

#### Request

```json
{
  "options": [
    {
      "name": "Air Freight",
      "cost": 5000,
      "ordersSaved": 10,
      "recoveryDays": 2
    },
    {
      "name": "Alternative Supplier",
      "cost": 3000,
      "ordersSaved": 8,
      "recoveryDays": 4
    }
  ]
}
```

#### Response

```json
{
  "recommendedOption": "Air Freight",
  "reasoning": "Air Freight offers the shorter recovery time and saves more orders among the supplied options.",
  "tradeoffs": [
    "Air Freight costs more than Alternative Supplier.",
    "Alternative Supplier costs less but has a longer recovery time and saves fewer orders."
  ]
}
```

The response is illustrative and may differ depending on the AI output.

#### Input fields

| Field | Type | Validation |
|---|---|---|
| `options` | Recovery option array | At least one option |
| `options[].name` | String | Required, non-empty |
| `options[].cost` | Number | Must be zero or greater |
| `options[].ordersSaved` | Integer | Must be zero or greater |
| `options[].recoveryDays` | Integer | Must be zero or greater |

#### Response fields

- `recommendedOption`: must match one of the supplied option names.
- `reasoning`: a non-empty explanation for the recommendation.
- `tradeoffs`: a list of non-empty strings.

The service validates the recommendation structure and rejects unsupported option names. The backend remains responsible for generating and validating the available recovery options and for executing any approved operational action.

## 9. Error handling

The service uses shared exceptions defined in `app/core/exceptions.py`.

| Error | Meaning |
|---|---|
| `AIServiceError` | Base class for expected service failures |
| `AIProviderError` | Provider request failed, timed out, or could not provide usable output |
| `AIResponseValidationError` | AI output did not satisfy the expected response contract |

### HTTP response behavior

| HTTP status | Meaning |
|---|---|
| `200 OK` | Request succeeded |
| `422 Unprocessable Entity` | Request data failed validation |
| `502 Bad Gateway` | AI provider failure or invalid AI response |

The three AI endpoints convert known provider and AI-response validation errors to HTTP `502`.

Unexpected exceptions should also be handled consistently before production deployment. Avoid returning stack traces, API keys, provider response bodies, or other sensitive details to API clients.

## 10. AI provider configuration

### Gemini

Implemented in `app/providers/gemini.py`.

- Uses the Google Gen AI SDK.
- Uses asynchronous content generation.
- Reads the API key from application settings.
- Converts generation failures into `AIProviderError`.
- Rejects empty text responses.

### OpenRouter

Implemented in `app/providers/openrouter.py`.

- Uses HTTPX for asynchronous HTTP requests.
- Reads its API key and model name from application settings.
- Uses a 30-second HTTP timeout.
- Handles HTTP errors, network errors, and invalid responses.
- Validates the completion choice and message content.

### Provider selection

Implemented in `app/providers/factory.py`.

Set `AI_PROVIDER` to either:

```dotenv
AI_PROVIDER=gemini
```

or:

```dotenv
AI_PROVIDER=openrouter
```

The current factory selects one provider based on configuration. **Automatic failover from Gemini to OpenRouter is not implemented by the current factory.**

## 11. Prompt templates

Prompt templates are stored under `app/prompts/`.

| Template | Purpose |
|---|---|
| `disruption_summary.txt` | Explain a supplied disruption |
| `risk_explanation.txt` | Explain a supplied risk score and factors |
| `recovery_recommendation.txt` | Select and explain one supplied recovery option |

The prompt service loads these templates and inserts request values.

Template construction is implemented in `app/services/prompt_service.py`.

Keep prompts explicit about the limits of the AI's authority. In particular, recovery recommendations must be limited to backend-provided options, and AI-generated text must not be treated as permission to execute an operational action.

## 12. Automated testing

The project uses Python's built-in `unittest` framework.

### Run all tests

From the project root:

```powershell
python -m unittest discover -s tests -v
```

### Run individual test modules

```powershell
python -m unittest tests.test_ai_service -v
python -m unittest tests.test_api_routes -v
python -m unittest tests.test_gemini_provider -v
python -m unittest tests.test_openrouter_provider -v
python -m unittest tests.test_prompt_service -v
```

### Current verified test coverage

The current development session verified **28 passing automated tests** across:

- AI service behavior and recovery validation.
- API endpoint responses and request validation.
- Gemini provider behavior.
- OpenRouter provider behavior.
- Prompt construction.

The provider and route tests use mocks where appropriate, so those tests do not need live API credentials for every case.

The exact test count should be rechecked after future code or test changes.

### Test coverage goals

Continue expanding tests to cover:

- Missing provider API keys.
- Invalid provider configuration.
- Provider network failures and timeouts.
- Malformed provider responses.
- Unexpected exceptions and safe HTTP error responses.
- Regression tests for prompt and response schemas.

Passing tests do not by themselves establish production readiness; deployment, security, and operational behavior also require verification.

## 13. Troubleshooting

### Missing Gemini API key

If Gemini reports that `GEMINI_API_KEY` is not configured:

1. Confirm that `.env` exists in `D:\ai-service`.
2. Verify that the variable is named `GEMINI_API_KEY`.
3. Ensure the key is valid.
4. Restart the application after configuration changes.

Never paste the key into source code or commit it to Git.

### Missing OpenRouter API key

Verify that both variables are configured:

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key
```

Also verify that the configured model is available to your account.

### Invalid provider

Only these provider values are supported:

```text
gemini
openrouter
```

An unsupported value should fail configuration validation.

### AI provider timeout

The shared AI service applies a 60-second generation timeout. OpenRouter also uses a 30-second HTTP timeout.

Check network connectivity, provider availability, API credentials, and model access before retrying.

### HTTP 422

A request body does not satisfy the schema. Review the field names, data types, numeric ranges, and required fields in the endpoint documentation.

### HTTP 502

The AI provider failed or returned a response that did not meet the service's requirements. Check server-side logs for diagnostic information without exposing secrets.

### Python 3.9 warnings

The current development environment uses Python 3.9, which has reached end of life. A supported Python version is recommended. Upgrade in a separate virtual environment, reinstall dependencies, and run the full test suite before switching environments.

## 14. Security considerations

Before production deployment:

- Keep `.env` out of version control.
- Rotate any API key that has been exposed.
- Store production secrets in an appropriate secrets-management system.
- Restrict CORS and network access to approved clients.
- Add authentication and authorization at the appropriate application boundary.
- Avoid logging API keys, complete sensitive prompts, or confidential provider responses.
- Apply rate limits and request-size limits.
- Review provider data-retention and privacy requirements.
- Validate all AI-generated output before using it downstream.
- Never execute recovery actions solely because an AI recommendation was generated.

The service's current exception handling and tests are a foundation, not a substitute for a complete production security review.

## 15. Scope and integration boundary

This repository contains the standalone Python AI service.

Its responsibilities are to:

- Explain supplied disruption facts.
- Explain supplied backend-calculated risk.
- Recommend among supplied recovery options.
- Return structured AI responses.

Its responsibilities do not include:

- Calculating authoritative supply-chain risk scores.
- Creating authoritative recovery option data.
- Modifying inventory, orders, shipments, or supplier records.
- Executing recovery actions.
- Implementing Spring Boot backend integration.

Spring Boot integration is a separate project task and is intentionally outside the scope of this README.

## 16. Development checklist

- [x] FastAPI application and health endpoint.
- [x] Disruption explanation endpoint.
- [x] Risk explanation endpoint.
- [x] Recovery recommendation endpoint.
- [x] Gemini provider.
- [x] OpenRouter provider.
- [x] Provider selection through configuration.
- [x] Prompt template service.
- [x] Request and response schemas.
- [x] Recovery recommendation validation.
- [x] Automated tests for services, prompts, providers, and routes.
- [ ] Upgrade and verify the environment using a supported Python version.
- [ ] Complete remaining security and reliability checks.
- [ ] Verify final documentation against the live implementation.
- [ ] Complete a final clean-environment installation and test run.

---

**DisruptionIQ AI Service**
*Standalone AI capabilities for supply-chain disruption explanation and recovery recommendation.*