
from abc import ABC, abstractmethod


class BaseAIProvider(ABC):
    """Common interface for all AI providers."""

    @abstractmethod
    async def generate(self, prompt: str) -> str:
        """
        Generate a text response from the configured AI provider.

        Args:
            prompt: The complete prompt to send to the provider.

        Returns:
            The generated text response.

        Raises:
            NotImplementedError:
                If a subclass does not implement this method.
        """
        raise NotImplementedError
