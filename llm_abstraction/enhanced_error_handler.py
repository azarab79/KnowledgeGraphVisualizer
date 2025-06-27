"""
Enhanced Error Handler for LLM Abstraction Layer.

This module provides sophisticated error handling, fallback mechanisms,
and recovery strategies for LLM provider failures.
"""

import logging
import time
import asyncio
from typing import Dict, List, Optional, Any, Callable, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, field

try:
    from .exceptions import (
        LLMAbstractionError, ProviderUnavailableError, AuthenticationError,
        RateLimitError, QuotaExceededError, ValidationError, TimeoutError,
        ContextOverflowError, ModelError, ConfigurationError,
        AllProvidersFailedError, classify_error, ErrorCategory, ErrorSeverity
    )
    from .config import LLMProvider
except ImportError:
    from exceptions import (
        LLMAbstractionError, ProviderUnavailableError, AuthenticationError,
        RateLimitError, QuotaExceededError, ValidationError, TimeoutError,
        ContextOverflowError, ModelError, ConfigurationError,
        AllProvidersFailedError, classify_error, ErrorCategory, ErrorSeverity
    )
    from config import LLMProvider

logger = logging.getLogger(__name__)


@dataclass
class RetryStrategy:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True
    
    def get_delay(self, attempt: int) -> float:
        """Calculate delay for the given attempt."""
        if attempt <= 0:
            return 0.0
        
        delay = self.base_delay * (self.exponential_base ** (attempt - 1))
        delay = min(delay, self.max_delay)
        
        if self.jitter:
            import random
            delay *= (0.5 + random.random() * 0.5)  # 50%-100% of calculated delay
        
        return delay


@dataclass
class CircuitBreakerState:
    """State tracking for circuit breaker pattern."""
    failure_count: int = 0
    last_failure_time: Optional[datetime] = None
    is_open: bool = False
    failure_threshold: int = 5
    recovery_timeout: int = 60  # seconds
    
    def should_allow_request(self) -> bool:
        """Check if request should be allowed based on circuit breaker state."""
        if not self.is_open:
            return True
        
        if self.last_failure_time and self.recovery_timeout:
            time_since_failure = (datetime.now() - self.last_failure_time).total_seconds()
            if time_since_failure >= self.recovery_timeout:
                # Allow one request to test if service is recovered
                return True
        
        return False
    
    def record_success(self):
        """Record successful request."""
        self.failure_count = 0
        self.is_open = False
        self.last_failure_time = None
    
    def record_failure(self):
        """Record failed request."""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.is_open = True


class EnhancedErrorHandler:
    """
    Enhanced error handler with sophisticated fallback and recovery mechanisms.
    """
    
    def __init__(
        self,
        retry_strategy: Optional[RetryStrategy] = None,
        enable_circuit_breaker: bool = True,
        enable_adaptive_timeout: bool = True,
        context_truncation_strategy: str = "tail",  # 'head', 'tail', 'smart'
        max_context_ratio: float = 0.9  # Use 90% of context window
    ):
        """
        Initialize enhanced error handler.
        
        Args:
            retry_strategy: Retry configuration
            enable_circuit_breaker: Enable circuit breaker pattern
            enable_adaptive_timeout: Enable adaptive timeout adjustments
            context_truncation_strategy: Strategy for context truncation
            max_context_ratio: Maximum ratio of context window to use
        """
        self.retry_strategy = retry_strategy or RetryStrategy()
        self.enable_circuit_breaker = enable_circuit_breaker
        self.enable_adaptive_timeout = enable_adaptive_timeout
        self.context_truncation_strategy = context_truncation_strategy
        self.max_context_ratio = max_context_ratio
        
        # Circuit breaker states per provider
        self.circuit_breakers: Dict[str, CircuitBreakerState] = {}
        
        # Error statistics for adaptive adjustments
        self.error_stats: Dict[str, Dict[str, Any]] = {}
        
        # Recovery strategies
        self.recovery_strategies: Dict[ErrorCategory, Callable] = {
            ErrorCategory.CONTEXT_OVERFLOW: self._handle_context_overflow,
            ErrorCategory.RATE_LIMIT: self._handle_rate_limit,
            ErrorCategory.TIMEOUT: self._handle_timeout,
            ErrorCategory.AUTHENTICATION: self._handle_authentication,
            ErrorCategory.QUOTA_EXCEEDED: self._handle_quota_exceeded,
        }
    
    def _get_circuit_breaker(self, provider: str) -> CircuitBreakerState:
        """Get or create circuit breaker for provider."""
        if provider not in self.circuit_breakers:
            self.circuit_breakers[provider] = CircuitBreakerState()
        return self.circuit_breakers[provider]
    
    def _update_error_stats(self, provider: str, error: LLMAbstractionError):
        """Update error statistics for adaptive learning."""
        if provider not in self.error_stats:
            self.error_stats[provider] = {
                "total_errors": 0,
                "error_categories": {},
                "last_error_time": None,
                "error_rate": 0.0
            }
        
        stats = self.error_stats[provider]
        stats["total_errors"] += 1
        stats["last_error_time"] = datetime.now()
        
        category = error.category.value
        if category not in stats["error_categories"]:
            stats["error_categories"][category] = 0
        stats["error_categories"][category] += 1
    
    def should_retry(
        self,
        error: LLMAbstractionError,
        attempt: int,
        provider: str
    ) -> bool:
        """
        Determine if a request should be retried based on error type and attempt count.
        
        Args:
            error: The error that occurred
            attempt: Current attempt number (1-based)
            provider: Provider name
            
        Returns:
            True if should retry, False otherwise
        """
        # Check basic retry conditions
        if attempt >= self.retry_strategy.max_attempts:
            return False
        
        if not error.should_retry:
            return False
        
        # Check circuit breaker
        if self.enable_circuit_breaker:
            circuit_breaker = self._get_circuit_breaker(provider)
            if not circuit_breaker.should_allow_request():
                logger.warning(f"Circuit breaker open for provider {provider}")
                return False
        
        # Category-specific retry logic
        if error.category == ErrorCategory.RATE_LIMIT:
            # For rate limits, retry with exponential backoff
            return True
        
        if error.category == ErrorCategory.TIMEOUT:
            # Retry timeouts but with adaptive timeout adjustment
            return True
        
        if error.category in [ErrorCategory.AUTHENTICATION, ErrorCategory.QUOTA_EXCEEDED]:
            # Don't retry auth or quota errors
            return False
        
        if error.category == ErrorCategory.VALIDATION:
            # Don't retry validation errors
            return False
        
        # Default to the error's should_retry flag
        return error.should_retry
    
    def should_fallback(
        self,
        error: LLMAbstractionError,
        provider: str,
        available_providers: List[str]
    ) -> bool:
        """
        Determine if we should fall back to another provider.
        
        Args:
            error: The error that occurred
            provider: Current provider name
            available_providers: List of available fallback providers
            
        Returns:
            True if should fallback, False otherwise
        """
        if not error.should_fallback:
            return False
        
        if not available_providers:
            return False
        
        # Don't fallback for validation errors (likely client-side issue)
        if error.category == ErrorCategory.VALIDATION:
            return False
        
        # Circuit breaker check for current provider
        if self.enable_circuit_breaker:
            circuit_breaker = self._get_circuit_breaker(provider)
            if circuit_breaker.is_open:
                return True
        
        # Fallback for high-severity errors
        if error.severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
            return True
        
        return error.should_fallback
    
    def handle_error(
        self,
        error: Exception,
        provider: str,
        model: str,
        attempt: int,
        context: Optional[Dict[str, Any]] = None
    ) -> LLMAbstractionError:
        """
        Handle and classify an error, potentially applying recovery strategies.
        
        Args:
            error: Original exception
            provider: Provider that caused the error
            model: Model that caused the error
            attempt: Current attempt number
            context: Additional context for error handling
            
        Returns:
            Classified LLM abstraction error
        """
        # Classify the error
        if isinstance(error, LLMAbstractionError):
            classified_error = error
        else:
            classified_error = classify_error(error, provider, model)
        
        # Update statistics
        self._update_error_stats(provider, classified_error)
        
        # Update circuit breaker
        if self.enable_circuit_breaker:
            circuit_breaker = self._get_circuit_breaker(provider)
            circuit_breaker.record_failure()
        
        # Apply recovery strategy if available
        if classified_error.category in self.recovery_strategies:
            try:
                recovery_func = self.recovery_strategies[classified_error.category]
                recovery_result = recovery_func(classified_error, context or {})
                if recovery_result:
                    # Update error with recovery information
                    classified_error.details.update(recovery_result)
            except Exception as recovery_error:
                logger.warning(f"Error recovery strategy failed: {recovery_error}")
        
        # Log the error
        self._log_error(classified_error, attempt, context)
        
        return classified_error
    
    def handle_success(self, provider: str):
        """Handle successful request for circuit breaker and stats."""
        if self.enable_circuit_breaker:
            circuit_breaker = self._get_circuit_breaker(provider)
            circuit_breaker.record_success()
    
    def _handle_context_overflow(
        self,
        error: ContextOverflowError,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle context overflow by implementing truncation strategy."""
        messages = context.get("messages", [])
        if not messages:
            return {}
        
        max_context = error.details.get("max_context", 4096)
        target_length = int(max_context * self.max_context_ratio)
        
        if self.context_truncation_strategy == "tail":
            # Keep the last messages
            truncated_messages = self._truncate_tail(messages, target_length)
        elif self.context_truncation_strategy == "head":
            # Keep the first messages
            truncated_messages = self._truncate_head(messages, target_length)
        else:  # smart
            # Keep important messages (system, recent user queries)
            truncated_messages = self._truncate_smart(messages, target_length)
        
        return {
            "recovery_action": "context_truncation",
            "original_length": len(str(messages)),
            "truncated_length": len(str(truncated_messages)),
            "truncated_messages": truncated_messages
        }
    
    def _handle_rate_limit(
        self,
        error: RateLimitError,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle rate limit by calculating wait time."""
        retry_after = error.details.get("retry_after", 60)
        
        # Add some jitter to avoid thundering herd
        import random
        wait_time = retry_after + random.uniform(0, 10)
        
        return {
            "recovery_action": "rate_limit_wait",
            "wait_time": wait_time,
            "retry_after": retry_after
        }
    
    def _handle_timeout(
        self,
        error: TimeoutError,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle timeout by suggesting timeout adjustment."""
        current_timeout = error.details.get("timeout_seconds", 30)
        
        if self.enable_adaptive_timeout:
            # Increase timeout for next attempt
            new_timeout = min(current_timeout * 1.5, 120)  # Cap at 2 minutes
            
            return {
                "recovery_action": "adaptive_timeout",
                "original_timeout": current_timeout,
                "suggested_timeout": new_timeout
            }
        
        return {}
    
    def _handle_authentication(
        self,
        error: AuthenticationError,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle authentication error."""
        return {
            "recovery_action": "authentication_error",
            "suggestion": "Check API key configuration",
            "should_fallback": True
        }
    
    def _handle_quota_exceeded(
        self,
        error: QuotaExceededError,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle quota exceeded error."""
        return {
            "recovery_action": "quota_exceeded",
            "suggestion": "Switch to fallback provider or wait for quota reset",
            "should_fallback": True
        }
    
    def _truncate_tail(self, messages: List[Any], target_length: int) -> List[Any]:
        """Keep the most recent messages."""
        current_length = 0
        result = []
        
        for message in reversed(messages):
            message_length = len(str(message))
            if current_length + message_length <= target_length:
                result.insert(0, message)
                current_length += message_length
            else:
                break
        
        return result
    
    def _truncate_head(self, messages: List[Any], target_length: int) -> List[Any]:
        """Keep the earliest messages."""
        current_length = 0
        result = []
        
        for message in messages:
            message_length = len(str(message))
            if current_length + message_length <= target_length:
                result.append(message)
                current_length += message_length
            else:
                break
        
        return result
    
    def _truncate_smart(self, messages: List[Any], target_length: int) -> List[Any]:
        """Smart truncation keeping system messages and recent exchanges."""
        # This is a simplified implementation
        # In practice, you'd want more sophisticated logic
        system_messages = []
        user_messages = []
        
        for message in messages:
            if hasattr(message, 'type') and message.type == 'system':
                system_messages.append(message)
            else:
                user_messages.append(message)
        
        # Always keep system messages
        result = system_messages[:]
        remaining_length = target_length - sum(len(str(msg)) for msg in system_messages)
        
        # Add as many recent user messages as possible
        for message in reversed(user_messages):
            message_length = len(str(message))
            if remaining_length >= message_length:
                result.append(message)
                remaining_length -= message_length
            else:
                break
        
        return result
    
    def _log_error(
        self,
        error: LLMAbstractionError,
        attempt: int,
        context: Optional[Dict[str, Any]]
    ):
        """Log error with appropriate level based on severity."""
        log_data = {
            "error_type": error.__class__.__name__,
            "provider": error.provider,
            "model": error.model,
            "category": error.category.value,
            "severity": error.severity.value,
            "attempt": attempt,
            "should_retry": error.should_retry,
            "should_fallback": error.should_fallback,
            "details": error.details
        }
        
        if error.severity == ErrorSeverity.CRITICAL:
            logger.error(f"Critical error: {error.message}", extra=log_data)
        elif error.severity == ErrorSeverity.HIGH:
            logger.error(f"High severity error: {error.message}", extra=log_data)
        elif error.severity == ErrorSeverity.MEDIUM:
            logger.warning(f"Medium severity error: {error.message}", extra=log_data)
        else:
            logger.info(f"Low severity error: {error.message}", extra=log_data)
    
    def get_error_statistics(self, provider: Optional[str] = None) -> Dict[str, Any]:
        """Get error statistics for analysis."""
        if provider:
            return self.error_stats.get(provider, {})
        
        return {
            "providers": dict(self.error_stats),
            "circuit_breakers": {
                name: {
                    "failure_count": cb.failure_count,
                    "is_open": cb.is_open,
                    "last_failure": cb.last_failure_time.isoformat() if cb.last_failure_time else None
                }
                for name, cb in self.circuit_breakers.items()
            }
        }
    
    def reset_circuit_breaker(self, provider: str):
        """Manually reset circuit breaker for a provider."""
        if provider in self.circuit_breakers:
            self.circuit_breakers[provider] = CircuitBreakerState()
            logger.info(f"Reset circuit breaker for provider: {provider}")
    
    def reset_all_circuit_breakers(self):
        """Reset all circuit breakers."""
        self.circuit_breakers.clear()
        logger.info("Reset all circuit breakers") 