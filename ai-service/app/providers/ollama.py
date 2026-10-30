
import logging

import httpx

from app.core.config import get_settings
from app.core.exceptions import AIProviderError
from app.providers.base import BaseAIProvider

logger = logging.getLogger(__name__)


class OllamaProvider(BaseAIProvider):
    """Local AI provider using Ollama's chat API."""

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_model

    async def generate(self, prompt: str) -> str:
        """Generate text using a locally running Ollama model."""
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "stream": False,
        }

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(45.0)
            ) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                )
                response.raise_for_status()
                result = response.json()

        except httpx.HTTPStatusError as exc:
            logger.warning(
                "Ollama returned HTTP status %s",
                exc.response.status_code,
            )
            raise AIProviderError(
                "Ollama rejected the generation request."
            ) from exc

        except httpx.RequestError as exc:
            logger.warning(
                "Ollama request failed: %s",
                type(exc).__name__,
            )
            raise AIProviderError(
                "Ollama could not be reached or timed out."
            ) from exc

        except ValueError as exc:
            logger.warning("Ollama returned invalid JSON.")
            raise AIProviderError(
                "Ollama returned an invalid response."
            ) from exc

        if not isinstance(result, dict):
            raise AIProviderError(
                "Ollama returned an invalid response structure."
            )

        message = result.get("message")
        if not isinstance(message, dict):
            raise AIProviderError(
                "Ollama returned an invalid message."
            )

        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise AIProviderError(
                "Ollama returned an empty or invalid response."
            )

        return content.strip()
