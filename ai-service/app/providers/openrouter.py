
import logging

import httpx

from app.core.config import get_settings
from app.core.exceptions import AIProviderError
from app.providers.base import BaseAIProvider

logger = logging.getLogger(__name__)


class OpenRouterProvider(BaseAIProvider):
    """OpenRouter implementation of the shared AI provider interface."""

    API_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self) -> None:
        settings = get_settings()

        if not settings.openrouter_api_key:
            raise ValueError(
                "OPENROUTER_API_KEY is not configured. "
                "Add it to your local .env file."
            )

        self.api_key = settings.openrouter_api_key
        self.model = settings.openrouter_model

    async def generate(self, prompt: str) -> str:
        """Generate text through the OpenRouter chat completions API."""

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        }

        timeout = httpx.Timeout(30.0)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self.API_URL,
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                result = response.json()

        except httpx.HTTPStatusError as exc:
            logger.warning(
                "OpenRouter returned HTTP status %s",
                exc.response.status_code,
            )
            raise AIProviderError(
                "OpenRouter rejected the generation request."
            ) from exc

        except httpx.RequestError as exc:
            logger.warning(
                "OpenRouter network request failed: %s",
                type(exc).__name__,
            )
            raise AIProviderError(
                "OpenRouter could not be reached or timed out."
            ) from exc

        except ValueError as exc:
            logger.warning("OpenRouter returned invalid JSON.")
            raise AIProviderError(
                "OpenRouter returned an invalid response."
            ) from exc

        choices = result.get("choices", [])

        if not isinstance(choices, list) or not choices:
            raise AIProviderError(
                "OpenRouter returned no completion choices."
            )

        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            raise AIProviderError(
                "OpenRouter returned an invalid completion choice."
            )

        message = first_choice.get("message")
        if not isinstance(message, dict):
            raise AIProviderError(
                "OpenRouter returned an invalid message."
            )

        content = message.get("content")

        if not isinstance(content, str) or not content.strip():
            raise AIProviderError(
                "OpenRouter returned an empty or invalid response."
            )

        return content.strip()
