"""
Custom exceptions for the LLM Abstraction Layer.

This module defines specific exception classes to handle different types of errors
that can occur when working with LLM providers, enabling more granular error handling
and recovery strategies.
"""

from typing import Optional, Dict, Any, List
from enum import Enum


class ErrorSeverity(str, Enum):
    """Error severity levels for classification."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(str, Enum):
    """Categories of errors for better classification."""
    CONNECTION = "connection"
    AUTHENTICATION = "authentication"
    RATE_LIMIT = "rate_limit"
    QUOTA_EXCEEDED = "quota_exceeded"
    VALIDATION = "validation"
    TIMEOUT = "timeout"
    PROVIDER_ERROR = "provider_error"
    CONFIGURATION = "configuration"
    CONTEXT_OVERFLOW = "context_overflow"
    MODEL_ERROR = "model_error"
    UNKNOWN = "unknown"


class LLMAbstractionError(Exception):
    """Base exception class for all LLM abstraction layer errors."""
    
    def __init__(
        self,
        message: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        details: Optional[Dict[str, Any]] = None,
        should_retry: bool = True,
        should_fallback: bool = True,
        original_error: Optional[Exception] = None
    ):
        """
        Initialize the LLM abstraction error.
        
        Args:
            message: Error message
            provider: Provider that caused the error
            model: Model that caused the error
            category: Error category for classification
            severity: Error severity level
            details: Additional error details
            should_retry: Whether this error should trigger a retry
            should_fallback: Whether this error should trigger fallback
            original_error: Original exception that caused this error
        """
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.model = model
        self.category = category
        self.severity = severity
        self.details = details or {}
        self.should_retry = should_retry
        self.should_fallback = should_fallback
        self.original_error = original_error
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for logging/serialization."""
        return {
            "type": self.__class__.__name__,
            "message": self.message,
            "provider": self.provider,
            "model": self.model,
            "category": self.category.value,
            "severity": self.severity.value,
            "should_retry": self.should_retry,
            "should_fallback": self.should_fallback,
            "details": self.details,
            "original_error": str(self.original_error) if self.original_error else None
        }


class ProviderUnavailableError(LLMAbstractionError):
    """Exception raised when a provider is not available."""
    
    def __init__(self, provider: str, reason: str = "Provider not available", **kwargs):
        super().__init__(
            message=f"Provider '{provider}' is not available: {reason}",
            provider=provider,
            category=ErrorCategory.CONNECTION,
            severity=ErrorSeverity.HIGH,
            should_retry=True,
            should_fallback=True,
            **kwargs
        )


class AuthenticationError(LLMAbstractionError):
    """Exception raised when authentication fails."""
    
    def __init__(self, provider: str, reason: str = "Authentication failed", **kwargs):
        super().__init__(
            message=f"Authentication failed for provider '{provider}': {reason}",
            provider=provider,
            category=ErrorCategory.AUTHENTICATION,
            severity=ErrorSeverity.HIGH,
            should_retry=False,  # Don't retry auth errors
            should_fallback=True,
            **kwargs
        )


class RateLimitError(LLMAbstractionError):
    """Exception raised when rate limits are exceeded."""
    
    def __init__(
        self,
        provider: str,
        retry_after: Optional[int] = None,
        reason: str = "Rate limit exceeded",
        **kwargs
    ):
        super().__init__(
            message=f"Rate limit exceeded for provider '{provider}': {reason}",
            provider=provider,
            category=ErrorCategory.RATE_LIMIT,
            severity=ErrorSeverity.MEDIUM,
            should_retry=True,
            should_fallback=True,
            details={"retry_after": retry_after},
            **kwargs
        )
        self.retry_after = retry_after


class QuotaExceededError(LLMAbstractionError):
    """Exception raised when quota/usage limits are exceeded."""
    
    def __init__(self, provider: str, reason: str = "Quota exceeded", **kwargs):
        super().__init__(
            message=f"Quota exceeded for provider '{provider}': {reason}",
            provider=provider,
            category=ErrorCategory.QUOTA_EXCEEDED,
            severity=ErrorSeverity.HIGH,
            should_retry=False,  # Don't retry quota errors
            should_fallback=True,
            **kwargs
        )


class ValidationError(LLMAbstractionError):
    """Exception raised when input validation fails."""
    
    def __init__(self, message: str, provider: Optional[str] = None, **kwargs):
        super().__init__(
            message=f"Validation error: {message}",
            provider=provider,
            category=ErrorCategory.VALIDATION,
            severity=ErrorSeverity.MEDIUM,
            should_retry=False,  # Don't retry validation errors
            should_fallback=False,  # Usually a client error
            **kwargs
        )


class TimeoutError(LLMAbstractionError):
    """Exception raised when requests timeout."""
    
    def __init__(self, provider: str, timeout_seconds: float, **kwargs):
        super().__init__(
            message=f"Request timeout for provider '{provider}' after {timeout_seconds}s",
            provider=provider,
            category=ErrorCategory.TIMEOUT,
            severity=ErrorSeverity.MEDIUM,
            should_retry=True,
            should_fallback=True,
            details={"timeout_seconds": timeout_seconds},
            **kwargs
        )


class ContextOverflowError(LLMAbstractionError):
    """Exception raised when context window is exceeded."""
    
    def __init__(
        self,
        provider: str,
        model: str,
        context_length: int,
        max_context: int,
        **kwargs
    ):
        super().__init__(
            message=f"Context overflow for {provider}/{model}: {context_length} tokens exceeds limit of {max_context}",
            provider=provider,
            model=model,
            category=ErrorCategory.CONTEXT_OVERFLOW,
            severity=ErrorSeverity.MEDIUM,
            should_retry=False,  # Need to truncate context
            should_fallback=True,
            details={
                "context_length": context_length,
                "max_context": max_context
            },
            **kwargs
        )


class ModelError(LLMAbstractionError):
    """Exception raised when model-specific errors occur."""
    
    def __init__(self, provider: str, model: str, reason: str, **kwargs):
        super().__init__(
            message=f"Model error for {provider}/{model}: {reason}",
            provider=provider,
            model=model,
            category=ErrorCategory.MODEL_ERROR,
            severity=ErrorSeverity.HIGH,
            should_retry=True,
            should_fallback=True,
            **kwargs
        )


class ConfigurationError(LLMAbstractionError):
    """Exception raised when configuration errors occur."""
    
    def __init__(self, message: str, provider: Optional[str] = None, **kwargs):
        super().__init__(
            message=f"Configuration error: {message}",
            provider=provider,
            category=ErrorCategory.CONFIGURATION,
            severity=ErrorSeverity.HIGH,
            should_retry=False,
            should_fallback=True,
            **kwargs
        )


class AllProvidersFailedError(LLMAbstractionError):
    """Exception raised when all providers fail."""
    
    def __init__(
        self,
        message: str = "All providers failed",
        failed_providers: Optional[List[str]] = None,
        provider_errors: Optional[Dict[str, Exception]] = None,
        **kwargs
    ):
        super().__init__(
            message=message,
            category=ErrorCategory.PROVIDER_ERROR,
            severity=ErrorSeverity.CRITICAL,
            should_retry=False,
            should_fallback=False,
            details={
                "failed_providers": failed_providers or [],
                "provider_errors": {
                    k: str(v) for k, v in (provider_errors or {}).items()
                }
            },
            **kwargs
        )
        self.failed_providers = failed_providers or []
        self.provider_errors = provider_errors or {}


def classify_error(
    error: Exception,
    provider: Optional[str] = None,
    model: Optional[str] = None
) -> LLMAbstractionError:
    """
    Classify and convert a generic exception into a specific LLM abstraction error.
    
    Args:
        error: Original exception
        provider: Provider that caused the error
        model: Model that caused the error
        
    Returns:
        Classified LLM abstraction error
    """
    error_str = str(error).lower()
    error_type = type(error).__name__.lower()
    
    # Authentication errors
    if any(keyword in error_str for keyword in ["unauthorized", "401", "auth", "key", "token"]):
        return AuthenticationError(
            provider=provider or "unknown",
            reason=str(error),
            original_error=error
        )
    
    # Rate limit errors
    if any(keyword in error_str for keyword in ["rate limit", "429", "too many requests"]):
        return RateLimitError(
            provider=provider or "unknown",
            reason=str(error),
            original_error=error
        )
    
    # Quota errors
    if any(keyword in error_str for keyword in ["quota", "limit exceeded", "insufficient"]):
        return QuotaExceededError(
            provider=provider or "unknown",
            reason=str(error),
            original_error=error
        )
    
    # Timeout errors
    if any(keyword in error_str for keyword in ["timeout", "timed out", "connection"]):
        return TimeoutError(
            provider=provider or "unknown",
            timeout_seconds=30.0,  # Default timeout
            original_error=error
        )
    
    # Context window errors
    if any(keyword in error_str for keyword in ["context", "token limit", "too long"]):
        return ContextOverflowError(
            provider=provider or "unknown",
            model=model or "unknown",
            context_length=0,  # Unknown
            max_context=0,     # Unknown
            original_error=error
        )
    
    # Validation errors
    if any(keyword in error_str for keyword in ["invalid", "validation", "bad request", "400"]):
        return ValidationError(
            message=str(error),
            provider=provider,
            original_error=error
        )
    
    # Provider unavailable
    if any(keyword in error_str for keyword in ["connection", "unavailable", "service", "502", "503"]):
        return ProviderUnavailableError(
            provider=provider or "unknown",
            reason=str(error),
            original_error=error
        )
    
    # Model errors
    if any(keyword in error_str for keyword in ["model", "not found", "404"]):
        return ModelError(
            provider=provider or "unknown",
            model=model or "unknown",
            reason=str(error),
            original_error=error
        )
    
    # Default to generic error
    return LLMAbstractionError(
        message=str(error),
        provider=provider,
        model=model,
        category=ErrorCategory.UNKNOWN,
        severity=ErrorSeverity.MEDIUM,
        original_error=error
    ) 