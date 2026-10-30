
import unittest

from app.services.prompt_service import PromptService


class TestPromptService(unittest.TestCase):

    def setUp(self):
        self.service = PromptService()

    def test_builds_disruption_summary_prompt(self):
        prompt = self.service.build_disruption_summary_prompt(
            disruption_type="Port Congestion",
            shipment_id="SHP-101",
            delay_days=3,
            reason="Severe congestion at the destination port",
            affected_orders=12,
            critical_orders=4,
        )

        self.assertIn("Port Congestion", prompt)
        self.assertIn("SHP-101", prompt)
        self.assertIn("3", prompt)
        self.assertIn("Severe congestion at the destination port", prompt)
        self.assertIn("12", prompt)
        self.assertIn("4", prompt)

    def test_builds_risk_explanation_prompt(self):
        prompt = self.service.build_risk_explanation_prompt(
            order_id="ORD-501",
            risk_score=85.5,
            risk_level="HIGH",
            risk_factors=[
                "Shipment delayed by 5 days",
                "Critical inventory shortage",
                "Supplier reliability is low",
            ],
        )

        self.assertIn("ORD-501", prompt)
        self.assertIn("85.5", prompt)
        self.assertIn("HIGH", prompt)
        self.assertIn("Shipment delayed by 5 days", prompt)
        self.assertIn("Critical inventory shortage", prompt)
        self.assertIn("Supplier reliability is low", prompt)

    def test_builds_recovery_recommendation_prompt(self):
        options = [
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

        prompt = self.service.build_recovery_recommendation_prompt(
            recovery_options=options
        )

        self.assertIn("Air Freight", prompt)
        self.assertIn("Alternative Supplier", prompt)
        self.assertIn("5000", prompt)
        self.assertIn("3000", prompt)
        self.assertIn("ordersSaved", prompt)
        self.assertIn("recoveryDays", prompt)


if __name__ == "__main__":
    unittest.main()
