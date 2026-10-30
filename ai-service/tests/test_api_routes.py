
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.core.exceptions import AIProviderError, AIResponseValidationError
from app.main import app

client = TestClient(app)


class TestHealthEndpoint(unittest.TestCase):

    def test_health_returns_success(self):
        response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")


class TestDisruptionEndpoint(unittest.TestCase):

    @patch("app.routes.explanation.AIService")
    def test_successful_disruption_summary(self, mock_service_class):
        mock_service = mock_service_class.return_value
        mock_service.summarize_disruption = AsyncMock(
            return_value="Shipment SHP-101 is delayed by three days."
        )

        response = client.post(
            "/api/v1/explanations/disruption",
            json={
                "type": "Port Congestion",
                "shipmentId": "SHP-101",
                "delayDays": 3,
                "reason": "Port congestion",
                "affectedOrders": 12,
                "criticalOrders": 4,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("summary", response.json())

    def test_invalid_disruption_request_returns_422(self):
        response = client.post(
            "/api/v1/explanations/disruption",
            json={
                "type": "",
                "shipmentId": "SHP-101",
                "delayDays": -1,
                "reason": "Port congestion",
                "affectedOrders": 12,
                "criticalOrders": 4,
            },
        )

        self.assertEqual(response.status_code, 422)

    @patch("app.routes.explanation.AIService")
    def test_provider_failure_returns_502(self, mock_service_class):
        mock_service = mock_service_class.return_value
        mock_service.summarize_disruption = AsyncMock(
            side_effect=AIProviderError("Internal provider detail")
        )

        response = client.post(
            "/api/v1/explanations/disruption",
            json={
                "type": "Port Congestion",
                "shipmentId": "SHP-101",
                "delayDays": 3,
                "reason": "Port congestion",
                "affectedOrders": 12,
                "criticalOrders": 4,
            },
        )

        self.assertEqual(response.status_code, 502)
        self.assertNotIn("Internal provider detail", response.text)


class TestRiskEndpoint(unittest.TestCase):

    @patch("app.routes.explanation.AIService")
    def test_successful_risk_explanation(self, mock_service_class):
        mock_service = mock_service_class.return_value
        mock_service.explain_risk = AsyncMock(
            return_value="This order has high risk due to the supplied factors."
        )

        response = client.post(
            "/api/v1/explanations/risk",
            json={
                "orderId": "ORD-501",
                "riskScore": 85.5,
                "riskLevel": "HIGH",
                "factors": ["Shipment delay", "Inventory shortage"],
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("explanation", response.json())

    def test_invalid_risk_request_returns_422(self):
        response = client.post(
            "/api/v1/explanations/risk",
            json={
                "orderId": "ORD-501",
                "riskScore": 120,
                "riskLevel": "HIGH",
                "factors": [],
            },
        )

        self.assertEqual(response.status_code, 422)


class TestRecoveryEndpoint(unittest.TestCase):

    @patch("app.routes.recommendation.AIService")
    def test_successful_recovery_recommendation(self, mock_service_class):
        mock_service = mock_service_class.return_value
        mock_service.recommend_recovery = AsyncMock(
            return_value={
                "recommendedOption": "Air Freight",
                "reasoning": "It recovers faster.",
                "tradeoffs": ["It costs more."],
            }
        )

        response = client.post(
            "/api/v1/recommendations/recovery",
            json={
                "options": [
                    {
                        "name": "Air Freight",
                        "cost": 5000,
                        "ordersSaved": 10,
                        "recoveryDays": 2,
                    },
                    {
                        "name": "Alternative Supplier",
                        "cost": 3000,
                        "ordersSaved": 8,
                        "recoveryDays": 4,
                    },
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["recommendedOption"], "Air Freight")

    def test_empty_recovery_options_returns_422(self):
        response = client.post(
            "/api/v1/recommendations/recovery",
            json={"options": []},
        )

        self.assertEqual(response.status_code, 422)

    @patch("app.routes.recommendation.AIService")
    def test_invalid_ai_response_returns_502(self, mock_service_class):
        mock_service = mock_service_class.return_value
        mock_service.recommend_recovery = AsyncMock(
            side_effect=AIResponseValidationError("Invalid internal response")
        )

        response = client.post(
            "/api/v1/recommendations/recovery",
            json={
                "options": [
                    {
                        "name": "Air Freight",
                        "cost": 5000,
                        "ordersSaved": 10,
                        "recoveryDays": 2,
                    }
                ]
            },
        )

        self.assertEqual(response.status_code, 502)
        self.assertNotIn("Invalid internal response", response.text)


if __name__ == "__main__":
    unittest.main()
