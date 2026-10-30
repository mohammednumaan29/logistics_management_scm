
import json
import unittest
from unittest.mock import AsyncMock, Mock, patch

from app.core.exceptions import (
    AIProviderError,
    AIResponseValidationError,
)
from app.services.ai_service import AIService


class TestAIService(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.service = AIService.__new__(AIService)

        self.service.prompt_service = Mock()
        self.service.prompt_service.build_disruption_summary_prompt.return_value = (
            "Summarize the disruption."
        )
        self.service.prompt_service.build_risk_explanation_prompt.return_value = (
            "Explain the risk."
        )
        self.service.prompt_service.build_recovery_recommendation_prompt.return_value = (
            "Recommend a recovery option."
        )

        self.service.provider = Mock()
        self.service.provider.generate = AsyncMock()

        # No fallback providers unless a test explicitly configures them.
        self.service.fallback_providers = []

        self.options = [
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

        self.valid_response = json.dumps(
            {
                "recommendedOption": "Air Freight",
                "reasoning": "It restores critical shipments faster.",
                "tradeoffs": [
                    "Higher transportation cost",
                    "Faster recovery",
                ],
            }
        )

    async def test_accepts_valid_recovery_recommendation(self):
        self.service.provider.generate.return_value = self.valid_response

        result = await self.service.recommend_recovery(self.options)

        self.assertEqual(result["recommendedOption"], "Air Freight")
        self.assertTrue(result["reasoning"])
        self.assertEqual(len(result["tradeoffs"]), 2)

    async def test_handles_provider_failure(self):
        self.service.provider.generate.side_effect = AIProviderError(
            "Provider could not complete the request."
        )

        with self.assertRaises(AIProviderError):
            await self.service.recommend_recovery(self.options)

    async def test_handles_provider_timeout(self):
        import asyncio

        async def slow_response(prompt):
            await asyncio.sleep(0.1)
            return self.valid_response

        self.service.provider.generate.side_effect = slow_response

        with patch(
            "app.services.ai_service.PROVIDER_TIMEOUT_SECONDS",
            0.01,
        ):
            with self.assertRaisesRegex(
                AIProviderError,
                "timed out",
            ):
                await self.service.recommend_recovery(self.options)

    async def test_rejects_empty_provider_response(self):
        self.service.provider.generate.return_value = "   "

        with self.assertRaisesRegex(
            AIResponseValidationError,
            "empty or invalid response",
        ):
            await self.service.recommend_recovery(self.options)

    async def test_rejects_invalid_json(self):
        self.service.provider.generate.return_value = (
            "This is not valid JSON"
        )

        with self.assertRaisesRegex(
            AIResponseValidationError,
            "invalid JSON",
        ):
            await self.service.recommend_recovery(self.options)

    async def test_rejects_unexpected_fields(self):
        self.service.provider.generate.return_value = json.dumps(
            {
                "recommendedOption": "Air Freight",
                "reasoning": "Fast recovery.",
                "tradeoffs": ["Expensive"],
                "extraField": "Unexpected",
            }
        )

        with self.assertRaisesRegex(
            AIResponseValidationError,
            "unexpected recovery recommendation structure",
        ):
            await self.service.recommend_recovery(self.options)

    async def test_rejects_unsupported_recovery_option(self):
        self.service.provider.generate.return_value = json.dumps(
            {
                "recommendedOption": "Express Drone Network",
                "reasoning": "It is fast.",
                "tradeoffs": ["Expensive"],
            }
        )

        with self.assertRaisesRegex(
            AIResponseValidationError,
            "not supplied by the backend",
        ):
            await self.service.recommend_recovery(self.options)

    async def test_rejects_empty_reasoning(self):
        self.service.provider.generate.return_value = json.dumps(
            {
                "recommendedOption": "Air Freight",
                "reasoning": "   ",
                "tradeoffs": ["Expensive"],
            }
        )

        with self.assertRaisesRegex(
            AIResponseValidationError,
            "reasoning must be a non-empty string",
        ):
            await self.service.recommend_recovery(self.options)

    async def test_rejects_invalid_tradeoffs(self):
        self.service.provider.generate.return_value = json.dumps(
            {
                "recommendedOption": "Air Freight",
                "reasoning": "Fast recovery.",
                "tradeoffs": ["Expensive", ""],
            }
        )

        with self.assertRaisesRegex(
            AIResponseValidationError,
            "tradeoffs must be a list",
        ):
            await self.service.recommend_recovery(self.options)

    async def test_rejects_empty_recovery_options(self):
        with self.assertRaisesRegex(
            ValueError,
            "At least one recovery option",
        ):
            await self.service.recommend_recovery([])

    async def test_invalid_json_uses_fallback_provider(self):
        self.service.provider.generate.return_value = (
            "This is not valid JSON"
        )

        fallback_provider = Mock()
        fallback_provider.generate = AsyncMock(
            return_value=json.dumps(
                {
                    "recommendedOption": "Air Freight",
                    "reasoning": "Faster recovery.",
                    "tradeoffs": ["Higher cost"],
                }
            )
        )

        self.service.fallback_providers = [
            ("openrouter", lambda: fallback_provider)
        ]

        result = await self.service.recommend_recovery(self.options)

        self.assertEqual(result["recommendedOption"], "Air Freight")
        fallback_provider.generate.assert_awaited_once()

    async def test_unsupported_option_uses_fallback_provider(self):
        self.service.provider.generate.return_value = json.dumps(
            {
                "recommendedOption": "Express Drone Network",
                "reasoning": "It is fast.",
                "tradeoffs": ["Expensive"],
            }
        )

        fallback_provider = Mock()
        fallback_provider.generate = AsyncMock(
            return_value=json.dumps(
                {
                    "recommendedOption": "Alternative Supplier",
                    "reasoning": "It reduces sourcing costs.",
                    "tradeoffs": ["Longer recovery time"],
                }
            )
        )

        self.service.fallback_providers = [
            ("openrouter", lambda: fallback_provider)
        ]

        result = await self.service.recommend_recovery(self.options)

        self.assertEqual(
            result["recommendedOption"],
            "Alternative Supplier",
        )
        fallback_provider.generate.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
