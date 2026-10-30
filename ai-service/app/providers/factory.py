
from typing import Callable, List, Tuple

from app.core.config import get_settings
from app.core.exceptions import AIServiceError
from app.providers.base import BaseAIProvider
from app.providers.gemini import GeminiProvider
from app.providers.openrouter import OpenRouterProvider
from app.providers.ollama import OllamaProvider


ProviderFactory = Callable[[], BaseAIProvider]

PROVIDER_FACTORIES: dict[str, ProviderFactory] = {
    "gemini": GeminiProvider,
    "openrouter": OpenRouterProvider,
    "ollama": OllamaProvider,
}


def get_ai_provider() -> BaseAIProvider:
    """Return the configured primary AI provider."""
    settings = get_settings()
    provider_name = settings.ai_provider.strip().lower()

    factory = PROVIDER_FACTORIES.get(provider_name)
    if factory is None:
        raise AIServiceError(
            f"Unsupported AI provider: '{provider_name}'. "
            "Supported providers are 'gemini', 'openrouter', and 'ollama'."
        )

    return factory()


def get_fallback_providers() -> List[Tuple[str, ProviderFactory]]:
    """Return backup provider factories in failover order."""
    settings = get_settings()
    primary = settings.ai_provider.strip().lower()

    if primary not in PROVIDER_FACTORIES:
        raise AIServiceError(
            f"Unsupported AI provider: '{primary}'."
        )

    # Gemini is primary by default; OpenRouter and Ollama are backups.
    preferred_order = ["gemini", "openrouter", "ollama"]

    if primary != "gemini":
        preferred_order = [primary] + [
            name for name in ["gemini", "openrouter", "ollama"]
            if name != primary
        ]

    return [
        (name, PROVIDER_FACTORIES[name])
        for name in preferred_order
        if name != primary
    ]
