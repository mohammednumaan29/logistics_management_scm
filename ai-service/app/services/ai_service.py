
import asyncio
import json
import logging
from typing import Any, Dict, List, Mapping, Tuple

from app.core.exceptions import (
    AIProviderError,
    AIResponseValidationError,
)
from app.providers.base import BaseAIProvider
from app.providers.factory import (
    get_ai_provider,
    get_fallback_providers,
)
from app.services.prompt_service import PromptService


logger = logging.getLogger(__name__)

PROVIDER_TIMEOUT_SECONDS = 60.0


class AIService:
    """Coordinate prompts, AI provider failover, and response validation."""

    def __init__(self) -> None:
        self.prompt_service = PromptService()
        self.provider = get_ai_provider()
        self.fallback_providers = get_fallback_providers()

    async def _try_provider(
        self,
        provider: BaseAIProvider,
        provider_name: str,
        prompt: str,
    ) -> str:
        """Generate text using one provider with a timeout."""
        try:
            response = await asyncio.wait_for(
                provider.generate(prompt),
                timeout=PROVIDER_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            logger.warning("%s request timed out", provider_name)
            raise AIProviderError(
                f"{provider_name} request timed out."
            ) from exc
        except AIProviderError:
            raise
        except Exception as exc:
            logger.warning(
                "%s request failed: %s",
                provider_name,
                type(exc).__name__,
            )
            raise AIProviderError(
                f"{provider_name} could not complete the request."
            ) from exc

        if not isinstance(response, str) or not response.strip():
            raise AIProviderError(
                f"{provider_name} returned an empty or invalid response."
            )

        return response.strip()


    async def _generate(self, prompt: str) -> str:
        """Try the primary provider, then configured fallback providers."""
        providers = [("primary", self.provider)]

        fallback_providers = getattr(self, "fallback_providers", [])

        for provider_name, provider_factory in fallback_providers:
            try:
                provider = provider_factory()
            except Exception as exc:
                logger.warning(
                    "Could not initialize fallback provider %s: %s",
                    provider_name,
                    type(exc).__name__,
                )
                continue

            providers.append((provider_name, provider))

        last_error = None
        empty_response_seen = False

        for index, (provider_name, provider) in enumerate(providers):
            try:
                response = await self._try_provider(
                    provider=provider,
                    provider_name=provider_name,
                    prompt=prompt,
                )

                if index > 0:
                    logger.info(
                        "AI generation succeeded using fallback provider %s",
                        provider_name,
                    )

                return response

            except AIProviderError as exc:
                last_error = exc

                if "empty or invalid response" in str(exc):
                    empty_response_seen = True

                logger.warning(
                    "Provider %s failed; attempting the next provider",
                    provider_name,
                )

        if empty_response_seen:
            raise AIResponseValidationError(
                "All configured AI providers returned empty or invalid responses."
            ) from last_error

        if last_error is not None:
            raise last_error

        raise AIProviderError(
            "All configured AI providers failed. Please try again later."
        )


    async def summarize_disruption(
        self,
        disruption_type: str,
        shipment_id: str,
        delay_days: int,
        reason: str,
        affected_orders: int,
        critical_orders: int,
    ) -> str:
        """Generate a summary based on supplied disruption facts."""
        prompt = self.prompt_service.build_disruption_summary_prompt(
            disruption_type=disruption_type,
            shipment_id=shipment_id,
            delay_days=delay_days,
            reason=reason,
            affected_orders=affected_orders,
            critical_orders=critical_orders,
        )
        return await self._generate(prompt)

    async def explain_risk(
        self,
        order_id: str,
        risk_score: float,
        risk_level: str,
        risk_factors: List[str],
    ) -> str:
        """Explain risk using backend-provided values."""
        prompt = self.prompt_service.build_risk_explanation_prompt(
            order_id=order_id,
            risk_score=risk_score,
            risk_level=risk_level,
            risk_factors=risk_factors,
        )
        return await self._generate(prompt)


    def _get_provider_sequence(self) -> List[Tuple[str, Any]]:
        """Return the primary provider followed by configured fallbacks."""

        providers = [("primary", self.provider)]
        fallback_providers = getattr(self, "fallback_providers", [])

        for provider_name, provider_factory in fallback_providers:
            try:
                provider = provider_factory()
            except Exception as exc:
                logger.warning(
                    "Could not initialize fallback provider %s: %s",
                    provider_name,
                    type(exc).__name__,
                )
                continue

            providers.append((provider_name, provider))

        return providers


    def _validate_recovery_response(
        self,
        response_text: str,
        allowed_names: List[str],
    ) -> Dict[str, Any]:
        """Parse and validate an AI-generated recovery recommendation."""

        try:
            result = json.loads(response_text)
        except (json.JSONDecodeError, TypeError) as exc:
            raise AIResponseValidationError(
                "AI provider returned invalid JSON."
            ) from exc

        if not isinstance(result, dict):
            raise AIResponseValidationError(
                "AI response must be a JSON object."
            )

        required_keys = {
            "recommendedOption",
            "reasoning",
            "tradeoffs",
        }

        if set(result.keys()) != required_keys:
            raise AIResponseValidationError(
                "unexpected recovery recommendation structure"
            )

        recommended_option = result["recommendedOption"]
        reasoning = result["reasoning"]
        tradeoffs = result["tradeoffs"]

        if (
            not isinstance(recommended_option, str)
            or recommended_option not in allowed_names
        ):
            raise AIResponseValidationError(
                "not supplied by the backend"
            )

        if not isinstance(reasoning, str) or not reasoning.strip():
            raise AIResponseValidationError(
                "AI response reasoning must be a non-empty string."
            )

        if (
            not isinstance(tradeoffs, list)
            or not all(
                isinstance(item, str) and item.strip()
                for item in tradeoffs
            )
        ):
            raise AIResponseValidationError(
                "AI response tradeoffs must be a list of non-empty strings."
            )

        return result




    async def recommend_recovery(
        self,
        recovery_options: List[Mapping[str, Any]],
    ) -> Dict[str, Any]:
        """Recommend a supplied option, retrying when output is invalid."""

        if not recovery_options:
            raise ValueError("At least one recovery option is required.")

        allowed_names = {
            option.get("name")
            for option in recovery_options
            if isinstance(option.get("name"), str)
            and option.get("name").strip()
        }

        if not allowed_names:
            raise ValueError(
                "Recovery options must include at least one valid name."
            )

        prompt = self.prompt_service.build_recovery_recommendation_prompt(
            recovery_options=recovery_options,
        )

        providers = self._get_provider_sequence()
        last_error = None
        empty_response_seen = False

        for index, (provider_name, provider) in enumerate(providers):
            try:
                response_text = await self._try_provider(
                    provider=provider,
                    provider_name=provider_name,
                    prompt=prompt,
                )

                result = self._validate_recovery_response(
                    response_text=response_text,
                    allowed_names=allowed_names,
                )

                if index > 0:
                    logger.info(
                        "Recovery recommendation succeeded using fallback provider %s",
                        provider_name,
                    )

                return result

            except AIResponseValidationError as exc:
                last_error = exc
                logger.warning(
                    "Provider %s returned an invalid recovery recommendation; "
                    "attempting the next provider",
                    provider_name,
                )

            except AIProviderError as exc:
                last_error = exc

                if "empty or invalid response" in str(exc):
                    empty_response_seen = True

                logger.warning(
                    "Provider %s failed; attempting the next provider",
                    provider_name,
                )

        if empty_response_seen:
            raise AIResponseValidationError(
                "All configured AI providers returned empty or invalid responses."
            ) from last_error

        if last_error is not None:
            raise last_error

        raise AIProviderError(
            "All configured AI providers failed. Please try again later."
        )
