
class AIServiceError(Exception):
    """Base exception for expected AI service failures."""


class AIProviderError(AIServiceError):
    """Raised when an AI provider cannot complete a request."""


class AIResponseValidationError(AIServiceError):
    """Raised when an AI response fails validation."""
