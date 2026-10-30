
import logging

from google import genai

from app.core.config import get_settings
from app.core.exceptions import AIProviderError
from app.providers.base import BaseAIProvider

logger = logging.getLogger(__name__)


class GeminiProvider(BaseAIProvider):
    """Gemini implementation of the shared AI provider interface."""

    def __init__(self) -> None:
        settings = get_settings()

        if not settings.gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY is not configured. "
                "Add it to your local .env file."
            )

        self.client = genai.Client(
            api_key=settings.gemini_api_key
        )

    async def generate(self, prompt: str) -> str:
        """Generate text using the Gemini API."""

        try:
            response = await self.client.aio.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=prompt,
            )
        except Exception as exc:
            logger.warning(
                "Gemini generation request failed: %s",
                type(exc).__name__,
            )
            raise AIProviderError(
                "Gemini could not complete the generation request."
            ) from exc

        text = response.text

        if not text or not text.strip():
            raise AIProviderError(
                "Gemini returned an empty response."
            )

        return text.strip()
