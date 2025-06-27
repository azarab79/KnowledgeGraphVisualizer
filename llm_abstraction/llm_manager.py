"""
Main LLM Manager for the abstraction layer.

This module provides the primary interface for interacting with multiple LLM providers,
handling provider selection, fallback logic, error handling, and conversation history.
"""

import logging
import time
from typing import Any, Dict, List, Optional, Union
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage

try:
    from .config import LLMConfig, LLMProvider
    from .providers import BaseLLMProvider, create_provider
    from .conversation_history import ConversationHistory
    from .provider_selector import ProviderSelector, SelectionPolicy
    from .enhanced_error_handler import EnhancedErrorHandler, RetryStrategy
    from .exceptions import (
        LLMAbstractionError, AllProvidersFailedError, classify_error,
        ErrorCategory, ErrorSeverity
    )
except ImportError:
    from config import LLMConfig, LLMProvider
    from providers import BaseLLMProvider, create_provider
    from conversation_history import ConversationHistory
    from provider_selector import ProviderSelector, SelectionPolicy
    from enhanced_error_handler import EnhancedErrorHandler, RetryStrategy
    from exceptions import (
        LLMAbstractionError, AllProvidersFailedError, classify_error,
        ErrorCategory, ErrorSeverity
    )

logger = logging.getLogger(__name__)


class LLMManager:
    """
    Main manager class for LLM abstraction layer.
    
    This class provides a unified interface for interacting with multiple LLM providers,
    with automatic fallback support, error handling, and conversation history management.
    """
    
    def __init__(
        self,
        config: Optional[LLMConfig] = None,
        selection_policy: SelectionPolicy = SelectionPolicy.FAILOVER,
        enable_conversation_history: bool = True,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        enable_enhanced_error_handling: bool = True,
        retry_strategy: Optional[RetryStrategy] = None
    ):
        """
        Initialize the LLM Manager.
        
        Args:
            config: LLM configuration. If None, loads from environment.
            selection_policy: Provider selection policy to use.
            enable_conversation_history: Whether to enable conversation history
            max_retries: Maximum number of retry attempts (deprecated, use retry_strategy)
            retry_delay: Delay between retries in seconds (deprecated, use retry_strategy)
            enable_enhanced_error_handling: Whether to use enhanced error handling
            retry_strategy: Advanced retry strategy configuration
        """
        self.config = config or LLMConfig.from_environment()
        self._providers: Dict[LLMProvider, BaseLLMProvider] = {}
        
        # Initialize provider selector with advanced features
        self.provider_selector = ProviderSelector(
            config=self.config,
            selection_policy=selection_policy,
            health_check_interval=60,  # Check health every minute
            max_consecutive_failures=3
        )
        
        # Initialize conversation history
        if enable_conversation_history:
            self.conversation_history = ConversationHistory(
                max_history_tokens=128000  # Default for deepseek-r1:8b context window
            )
        else:
            self.conversation_history = None
        
        # Initialize enhanced error handling
        if enable_enhanced_error_handling:
            if not retry_strategy:
                retry_strategy = RetryStrategy(
                    max_attempts=max_retries,
                    base_delay=retry_delay
                )
            self.error_handler = EnhancedErrorHandler(retry_strategy=retry_strategy)
        else:
            self.error_handler = None
        
        # Legacy retry configuration (for backward compatibility)
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        
        # Configure logging
        if self.config.enable_logging:
            logging.getLogger(__name__).setLevel(logging.DEBUG)
        
        # Track start time for uptime calculation
        self._start_time = time.time()
    
    def _get_provider(self, provider_type: LLMProvider, model_name: Optional[str] = None) -> BaseLLMProvider:
        """Get or create a provider instance."""
        if provider_type not in self._providers:
            provider_config = self.config.providers.get(provider_type)
            if not provider_config or not provider_config.enabled:
                raise ValueError(f"Provider {provider_type.value} is not configured or enabled")
            
            # Use the first available model if no model specified
            if not model_name:
                if not provider_config.models:
                    raise ValueError(f"No models configured for provider {provider_type.value}")
                model_name = list(provider_config.models.keys())[0]
            
            self._providers[provider_type] = create_provider(provider_config, model_name)
        
        return self._providers[provider_type]
    
    def _try_provider(self, provider_type: LLMProvider, messages: List[BaseMessage], **kwargs) -> Optional[str]:
        """Try to get a response from a specific provider."""
        start_time = time.time()
        success = False
        tokens = 0
        error = None
        
        try:
            provider = self._get_provider(provider_type)
            
            # Check if provider is available
            if not provider.is_available():
                logger.warning(f"Provider {provider_type.value} is not available")
                error = Exception("Provider not available")
                return None
            
            # Get response
            response = provider.invoke(messages, **kwargs)
            logger.info(f"Successfully got response from {provider_type.value}")
            
            # Estimate token count (rough approximation)
            tokens = len(response) // 4  # ~4 chars per token
            success = True
            
            return response
            
        except Exception as e:
            logger.error(f"Error with provider {provider_type.value}: {e}")
            error = e
            return None
            
        finally:
            # Record metrics
            latency = time.time() - start_time
            self.provider_selector.record_request(
                provider=provider_type,
                latency=latency,
                success=success,
                tokens=tokens,
                error=error
            )
    
    def invoke(
        self,
        messages: Union[str, List[BaseMessage]],
        conversation_id: Optional[str] = None,
        provider_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        profile: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Invoke LLM with intelligent provider selection and automatic fallback.
        
        Args:
            messages: Input messages (string or list of BaseMessage)
            conversation_id: Optional conversation ID for history tracking
            provider_name: Specific provider to use (overrides selection policy)
            temperature: Temperature override
            max_tokens: Max tokens override
            profile: Parameter profile to use (creative, precise, balanced, etc.)
            **kwargs: Additional parameters for the LLM
            
        Returns:
            Generated response as string
            
        Raises:
            AllProvidersFailedError: If all providers fail
            LLMAbstractionError: For specific error conditions
        """
        start_time = time.time()
        
        # Convert string to messages if needed
        if isinstance(messages, str):
            current_messages = [HumanMessage(content=messages)]
        else:
            current_messages = messages.copy()
        
        # Add conversation history if requested
        if self.conversation_history and conversation_id:
            # Get existing conversation history and prepend to current messages
            history_messages = self.conversation_history.get_history(conversation_id)
            current_messages = history_messages + current_messages
        
        # Prepare parameter overrides
        param_overrides = kwargs.copy()
        if temperature is not None:
            param_overrides['temperature'] = temperature
        if max_tokens is not None:
            param_overrides['max_tokens'] = max_tokens
        
        # Context for error handling
        error_context = {
            "messages": current_messages,
            "conversation_id": conversation_id,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "profile": profile,
            "param_overrides": param_overrides,
            "kwargs": kwargs
        }
        
        # Use enhanced error handling if available
        if self.error_handler:
            return self._invoke_with_enhanced_error_handling(
                current_messages, error_context, provider_name, profile, param_overrides
            )
        else:
            return self._invoke_legacy(
                current_messages, conversation_id, provider_name, profile, param_overrides
            )
    
    def _invoke_with_enhanced_error_handling(
        self,
        current_messages: List[BaseMessage],
        error_context: Dict[str, Any],
        provider_name: Optional[str] = None,
        profile: Optional[str] = None,
        param_overrides: Dict[str, Any] = {}
    ) -> str:
        """Enhanced invoke with sophisticated error handling."""
        start_time = time.time()
        providers_tried = []
        provider_errors = {}
        last_error = None
        
        # Get provider order
        if provider_name:
            provider_order = [provider_name]
        else:
            enabled_providers = self.provider_selector.get_healthy_providers()
            if not enabled_providers:
                raise AllProvidersFailedError("No healthy providers available")
            provider_order = enabled_providers
        
        for provider in provider_order:
            attempt = 1
            max_attempts = self.error_handler.retry_strategy.max_attempts
            
            while attempt <= max_attempts:
                try:
                    # Get provider instance
                    provider_instance = self.provider_selector.get_provider_by_name(provider)
                    if not provider_instance:
                        raise LLMAbstractionError(
                            f"Provider '{provider}' not available",
                            provider=provider,
                            category=ErrorCategory.PROVIDER_ERROR
                        )
                    
                    providers_tried.append(f"{provider}(attempt {attempt})")
                    
                    # Prepare parameters
                    invoke_params = {}
                    if profile:
                        invoke_params['profile'] = profile
                    invoke_params.update(param_overrides)
                    
                    # Log attempt
                    logger.debug(f"Attempting {provider} (attempt {attempt}/{max_attempts})")
                    
                    # Invoke the provider
                    request_start = time.time()
                    response = provider_instance.invoke(current_messages, **invoke_params)
                    request_latency = time.time() - request_start
                    
                    # Record success
                    if self.error_handler:
                        self.error_handler.handle_success(provider)
                    
                    # Estimate token count and record metrics
                    token_count = self._estimate_token_count(current_messages, response)
                    self.provider_selector.record_request(
                        provider_name=provider,
                        latency=request_latency,
                        success=True,
                        token_count=token_count
                    )
                    
                    # Store in conversation history if enabled
                    conversation_id = error_context.get("conversation_id")
                    if self.conversation_history and conversation_id:
                        self.conversation_history.add_exchange(
                            conversation_id=conversation_id,
                            human_message=current_messages[-1].content if current_messages else "",
                            ai_response=response
                        )
                    
                    total_time = time.time() - start_time
                    logger.info(f"Request completed successfully in {total_time:.2f}s using {provider}")
                    
                    return response
                    
                except Exception as e:
                    # Handle error using enhanced error handler
                    request_latency = time.time() - request_start if 'request_start' in locals() else 0
                    
                    # Get model name for error context
                    model_name = "unknown"
                    try:
                        if provider_instance:
                            model_name = provider_instance.model_name
                    except:
                        pass
                    
                    # Classify and handle the error
                    classified_error = self.error_handler.handle_error(
                        error=e,
                        provider=provider,
                        model=model_name,
                        attempt=attempt,
                        context=error_context
                    )
                    
                    last_error = classified_error
                    provider_errors[provider] = classified_error
                    
                    # Record failed request metrics
                    self.provider_selector.record_request(
                        provider_name=provider,
                        latency=request_latency,
                        success=False,
                        error=str(classified_error)
                    )
                    
                    # Check if we should retry this provider
                    if self.error_handler.should_retry(classified_error, attempt, provider):
                        delay = self.error_handler.retry_strategy.get_delay(attempt)
                        if delay > 0:
                            logger.info(f"Retrying {provider} in {delay:.2f}s (attempt {attempt + 1})")
                            time.sleep(delay)
                        attempt += 1
                        continue
                    else:
                        # No more retries for this provider
                        logger.warning(f"No more retries for provider {provider}: {classified_error}")
                        break
            
            # Check if we should fallback to next provider
            available_fallbacks = [p for p in provider_order if p != provider and p not in [pe.split('(')[0] for pe in providers_tried]]
            
            if last_error and self.error_handler.should_fallback(last_error, provider, available_fallbacks):
                logger.info(f"Falling back from {provider} to next available provider")
                continue
            else:
                # No fallback appropriate
                break
        
        # All providers and retries exhausted
        total_time = time.time() - start_time
        
        raise AllProvidersFailedError(
            message=f"All providers failed after {total_time:.2f}s. Providers tried: {providers_tried}",
            failed_providers=list(provider_errors.keys()),
            provider_errors=provider_errors
        )
    
    def _invoke_legacy(
        self,
        current_messages: List[BaseMessage],
        conversation_id: Optional[str] = None,
        provider_name: Optional[str] = None,
        profile: Optional[str] = None,
        param_overrides: Dict[str, Any] = {}
    ) -> str:
        """Legacy invoke method for backward compatibility."""
        start_time = time.time()
        last_exception = None
        providers_tried = []
        
        for attempt in range(self.max_retries):
            try:
                # Select provider
                if provider_name:
                    provider = self.provider_selector.get_provider_by_name(provider_name)
                    if not provider:
                        raise ValueError(f"Provider '{provider_name}' not available")
                    selected_provider_name = provider_name
                else:
                    provider = self.provider_selector.select_provider()
                    if not provider:
                        raise RuntimeError("No healthy providers available")
                    
                    # Find the provider name for metrics
                    selected_provider_name = None
                    for name, p in self.provider_selector.providers.items():
                        if p is provider:
                            selected_provider_name = name
                            break
                
                if not selected_provider_name:
                    raise RuntimeError("Could not determine selected provider name")
                
                providers_tried.append(selected_provider_name)
                
                # Prepare parameters
                invoke_params = {}
                if profile:
                    invoke_params['profile'] = profile
                invoke_params.update(param_overrides)
                
                # Log attempt
                logger.debug(f"Attempt {attempt + 1}: Using provider {selected_provider_name}")
                
                # Invoke the provider
                request_start = time.time()
                response = provider.invoke(current_messages, **invoke_params)
                request_latency = time.time() - request_start
                
                # Estimate token count (simplified)
                token_count = self._estimate_token_count(current_messages, response)
                
                # Record successful request metrics
                self.provider_selector.record_request(
                    provider_name=selected_provider_name,
                    latency=request_latency,
                    success=True,
                    token_count=token_count
                )
                
                # Store in conversation history if enabled
                if self.conversation_history and conversation_id:
                    self.conversation_history.add_exchange(
                        conversation_id=conversation_id,
                        human_message=current_messages[-1].content if current_messages else "",
                        ai_response=response
                    )
                
                total_time = time.time() - start_time
                logger.info(f"Request completed successfully in {total_time:.2f}s using {selected_provider_name}")
                
                return response
                
            except Exception as e:
                request_latency = time.time() - start_time
                last_exception = e
                
                # Record failed request metrics if we have a provider name
                if 'selected_provider_name' in locals():
                    self.provider_selector.record_request(
                        provider_name=selected_provider_name,
                        latency=request_latency,
                        success=False,
                        error=str(e)
                    )
                
                logger.warning(f"Attempt {attempt + 1} failed with {selected_provider_name if 'selected_provider_name' in locals() else 'unknown provider'}: {e}")
                
                # Wait before retry (except on last attempt)
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))  # Exponential backoff
        
        # All attempts failed
        total_time = time.time() - start_time
        error_msg = f"All {self.max_retries} attempts failed after {total_time:.2f}s. Providers tried: {providers_tried}"
        if last_exception:
            error_msg += f". Last error: {last_exception}"
        
        logger.error(error_msg)
        raise RuntimeError(error_msg)
    
    def get_available_providers(self) -> List[LLMProvider]:
        """Get list of currently available providers."""
        available = []
        for provider_type in self.config.get_enabled_providers():
            try:
                provider = self._get_provider(provider_type)
                if provider.is_available():
                    available.append(provider_type)
            except Exception as e:
                logger.debug(f"Provider {provider_type.value} not available: {e}")
        
        return available
    
    def get_provider_info(self, provider_type: Optional[LLMProvider] = None) -> Dict[str, Any]:
        """
        Get information about providers including metrics.
        
        Args:
            provider_type: Specific provider to get info for. If None, returns all.
            
        Returns:
            Provider information dictionary
        """
        if provider_type:
            try:
                provider = self._get_provider(provider_type)
                metrics = self.provider_selector.get_provider_metrics(provider_type)
                
                info = {
                    **provider.get_model_info(),
                    "available": provider.is_available()
                }
                
                if metrics:
                    info.update({
                        "total_requests": metrics.total_requests,
                        "success_rate": metrics.success_rate,
                        "average_latency": metrics.average_latency,
                        "health_score": metrics.health_score,
                        "consecutive_failures": metrics.consecutive_failures
                    })
                
                return {provider_type.value: info}
                
            except Exception as e:
                return {provider_type.value: {"error": str(e), "available": False}}
        
        # Return info for all providers
        info = {}
        for ptype in LLMProvider:
            if ptype in self.config.providers:
                try:
                    provider = self._get_provider(ptype)
                    metrics = self.provider_selector.get_provider_metrics(ptype)
                    
                    provider_info = {
                        **provider.get_model_info(),
                        "available": provider.is_available()
                    }
                    
                    if metrics:
                        provider_info.update({
                            "total_requests": metrics.total_requests,
                            "success_rate": metrics.success_rate,
                            "average_latency": metrics.average_latency,
                            "health_score": metrics.health_score,
                            "consecutive_failures": metrics.consecutive_failures
                        })
                    
                    info[ptype.value] = provider_info
                    
                except Exception as e:
                    info[ptype.value] = {"error": str(e), "available": False}
        
        return info
    
    def set_selection_policy(self, policy: SelectionPolicy):
        """Change the provider selection policy."""
        self.provider_selector.selection_policy = policy
        logger.info(f"Changed selection policy to: {policy.value}")
    
    def get_provider_metrics(self, provider: Optional[LLMProvider] = None):
        """Get provider metrics."""
        if provider:
            # Get metrics for specific provider
            return self.provider_selector.get_metrics_summary().get(provider.value, {})
        return self.provider_selector.get_metrics_summary()
    
    def reset_provider_metrics(self, provider: Optional[LLMProvider] = None):
        """Reset provider metrics."""
        self.provider_selector.reset_metrics(provider)
        if provider:
            logger.info(f"Reset metrics for provider: {provider.value}")
        else:
            logger.info("Reset metrics for all providers")
    
    def clear_conversation_history(self, conversation_id: Optional[str] = None):
        """
        Clear conversation history.
        
        Args:
            conversation_id: Specific conversation to clear, or None for all
        """
        if self.conversation_history:
            if conversation_id:
                self.conversation_history.clear_session(conversation_id)
            else:
                self.conversation_history.clear_all()
    
    def get_conversation_history(self, conversation_id: str) -> List[BaseMessage]:
        """Get conversation history for a conversation."""
        if not self.conversation_history:
            return []
        
        return self.conversation_history.get_history(conversation_id)
    
    def set_system_message(self, conversation_id: str, system_message: str):
        """Set a system message for a conversation."""
        self.conversation_history.set_system_message(conversation_id, system_message)
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on all providers.
        
        Returns:
            Health check results
        """
        self.provider_selector._perform_health_checks()
        
        metrics = self.get_provider_metrics()
        healthy_providers = self.get_healthy_providers()
        
        return {
            'status': 'healthy' if healthy_providers else 'unhealthy',
            'healthy_providers': healthy_providers,
            'total_providers': len(self.get_available_providers()),
            'provider_metrics': metrics,
            'conversation_history_enabled': self.conversation_history is not None,
            'selection_policy': self.provider_selector.selection_policy.value
        }
    
    def get_healthy_providers(self) -> List[str]:
        """
        Get list of currently healthy provider names.
        
        Returns:
            List of healthy provider names
        """
        healthy = []
        for name, status in self.provider_selector.health_status.items():
            if status.is_healthy and name in self.provider_selector.providers:
                healthy.append(name)
        return healthy
    
    def force_provider_health_check(self):
        """Force an immediate health check of all providers."""
        self.provider_selector._perform_health_checks()
    
    def get_system_status(self) -> Dict[str, Any]:
        """
        Get comprehensive system status information.
        
        Returns:
            System status information
        """
        healthy_providers = self.get_healthy_providers()
        total_providers = len(self.get_available_providers())
        
        return {
            'manager_status': 'active',
            'total_providers': total_providers,
            'healthy_providers': len(healthy_providers),
            'uptime': time.time() - getattr(self, '_start_time', time.time()),
            'config': {
                'primary_provider': self.config.primary_provider,
                'fallback_providers': self.config.fallback_providers,
                'selection_policy': self.provider_selector.selection_policy.value
            },
            'providers': self.get_provider_metrics(),
            'conversation_history': {
                'enabled': self.conversation_history is not None,
                'max_history_tokens': self.conversation_history.max_history_tokens if self.conversation_history else None
            },
            'retry_config': {
                'max_retries': self.max_retries,
                'retry_delay': self.retry_delay
            }
        }
    
    def _estimate_token_count(self, messages: List[BaseMessage], response: str) -> int:
        """
        Estimate token count for metrics (simplified approach).
        
        Args:
            messages: Input messages
            response: Generated response
            
        Returns:
            Estimated token count
        """
        # Simple estimation: ~4 characters per token
        total_chars = sum(len(msg.content) for msg in messages) + len(response)
        return max(1, total_chars // 4)
    
    def shutdown(self):
        """Shutdown the LLM manager and cleanup resources."""
        if self.provider_selector:
            self.provider_selector.shutdown()
        logger.info("LLM Manager shutdown complete")
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.shutdown()
    
    def get_available_profiles(self, provider_name: Optional[str] = None, model_name: Optional[str] = None) -> Dict[str, List[str]]:
        """
        Get available parameter profiles for providers.
        
        Args:
            provider_name: Specific provider to query (returns all if None)
            model_name: Specific model to query (returns first available if None)
            
        Returns:
            Dict mapping provider names to lists of available profiles
        """
        profiles = {}
        
        if provider_name:
            # Get profiles for specific provider
            if provider_name in self.provider_selector.providers:
                provider = self.provider_selector.providers[provider_name]
                profiles[provider_name] = provider.get_available_profiles()
        else:
            # Get profiles for all providers
            for name, provider in self.provider_selector.providers.items():
                profiles[name] = provider.get_available_profiles()
        
        return profiles
    
    def get_profile_info(self, profile_name: str, provider_name: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """
        Get information about a specific parameter profile.
        
        Args:
            profile_name: Name of the profile to query
            provider_name: Specific provider to query (returns all if None)
            
        Returns:
            Dict mapping provider names to profile information
        """
        profile_info = {}
        
        if provider_name:
            # Get profile info for specific provider
            if provider_name in self.provider_selector.providers:
                provider = self.provider_selector.providers[provider_name]
                info = provider.get_profile_info(profile_name)
                if info:
                    profile_info[provider_name] = info
        else:
            # Get profile info for all providers
            for name, provider in self.provider_selector.providers.items():
                info = provider.get_profile_info(profile_name)
                if info:
                    profile_info[name] = info
        
        return profile_info
    
    def validate_parameters(self, params: Dict[str, Any], provider_name: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """
        Validate parameters against provider constraints.
        
        Args:
            params: Parameters to validate
            provider_name: Specific provider to validate against (validates all if None)
            
        Returns:
            Dict mapping provider names to validation results
        """
        validation_results = {}
        
        if provider_name:
            # Validate for specific provider
            if provider_name in self.provider_selector.providers:
                provider = self.provider_selector.providers[provider_name]
                try:
                    validated_params = provider.validate_parameters(params)
                    validation_results[provider_name] = {
                        "valid": True,
                        "validated_params": validated_params
                    }
                except ValueError as e:
                    validation_results[provider_name] = {
                        "valid": False,
                        "error": str(e)
                    }
        else:
            # Validate for all providers
            for name, provider in self.provider_selector.providers.items():
                try:
                    validated_params = provider.validate_parameters(params)
                    validation_results[name] = {
                        "valid": True,  
                        "validated_params": validated_params
                    }
                except ValueError as e:
                    validation_results[name] = {
                        "valid": False,
                        "error": str(e)
                    }
        
        return validation_results
    
    def get_parameter_constraints(self, provider_name: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """
        Get parameter constraints for providers.
        
        Args:
            provider_name: Specific provider to query (returns all if None)
            
        Returns:
            Dict mapping provider names to parameter constraints
        """
        constraints = {}
        
        if provider_name:
            # Get constraints for specific provider
            if provider_name in self.provider_selector.providers:
                provider = self.provider_selector.providers[provider_name]
                constraints[provider_name] = provider.model_config.parameter_constraints
        else:
            # Get constraints for all providers
            for name, provider in self.provider_selector.providers.items():
                constraints[name] = provider.model_config.parameter_constraints
        
        return constraints 