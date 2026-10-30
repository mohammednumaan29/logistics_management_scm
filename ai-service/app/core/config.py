
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the DisruptionIQ AI service."""

    app_name: str = "DisruptionIQ AI Service"
    app_env: str = "development"
    app_version: str = "0.1.0"

    # Primary provider
    ai_provider: Literal["gemini", "openrouter", "ollama"] = "gemini"

    # Provider credentials
    gemini_api_key: str = Field(default="", repr=False)
    openrouter_api_key: str = Field(default="", repr=False)

    # OpenRouter model configuration
    openrouter_model: str = "nvidia/nemotron-3-ultra-550b-a55b:free"

    # Local Ollama configuration
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:8b"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="",
        extra="ignore",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    """Load settings once and reuse them."""
    return Settings()
