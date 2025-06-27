"""
Provider implementations for different LLM services.

This module contains concrete implementations for various LLM providers
using LangChain's interface for consistent interaction.
"""

import logging
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List, Union
from langchain_core.language_models import BaseLLM
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage

try:
    from .config import LLMProvider, ProviderConfig, ModelConfig
except ImportError:
    from config import LLMProvider, ProviderConfig, ModelConfig

logger = logging.getLogger(__name__)


class BaseLLMProvider(ABC):
    """Base class for all LLM providers."""
    
    def __init__(self, provider_config: ProviderConfig, model_name: str):
        """
        Initialize the provider.
        
        Args:
            provider_config: Configuration for this provider
            model_name: Name of the model to use
        """
        self.provider_config = provider_config
        self.model_name = model_name
        self.model_config = provider_config.models.get(model_name)
        
        if not self.model_config:
            raise ValueError(f"Model '{model_name}' not found in provider configuration")
        
        self._llm: Optional[BaseLLM] = None
        
    @property
    def llm(self) -> BaseLLM:
        """Get or create the LangChain LLM instance."""
        if self._llm is None:
            self._llm = self._create_llm()
        return self._llm
    
    @abstractmethod
    def _create_llm(self) -> BaseLLM:
        """Create the LangChain LLM instance."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if the provider is available and accessible."""
        pass
    
    def invoke(
        self, 
        messages: Union[str, List[BaseMessage]], 
        profile: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Invoke the LLM with messages and flexible parameter configuration.
        
        Args:
            messages: Input messages (string or list of BaseMessage)
            profile: Parameter profile to use (creative, precise, balanced, etc.)
            **kwargs: Additional parameters to override model config
            
        Returns:
            Generated response as string
        """
        start_time = time.time()
        
        try:
            # Convert string to HumanMessage if needed
            if isinstance(messages, str):
                messages = [HumanMessage(content=messages)]
            
            # Get effective parameters using profile and overrides
            effective_params = self.model_config.get_effective_parameters(
                overrides=kwargs,
                profile=profile
            )
            
            # Map parameters to provider-specific names
            mapped_params = self.model_config.map_parameters_for_provider(effective_params)
            
            # Log request if enabled
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(f"[{self.provider_config.provider.value}] Invoking model {self.model_name}")
                logger.debug(f"Profile: {profile}")
                logger.debug(f"Effective parameters: {effective_params}")
                logger.debug(f"Mapped parameters: {mapped_params}")
                logger.debug(f"Messages: {[msg.content[:100] + '...' if len(msg.content) > 100 else msg.content for msg in messages]}")
            
            # Invoke the LLM with provider-specific parameters
            response = self._invoke_with_params(messages, mapped_params)
            
            # Extract content from response
            if hasattr(response, 'content'):
                content = response.content
            else:
                content = str(response)
            
            elapsed_time = time.time() - start_time
            
            # Log response if enabled
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(f"[{self.provider_config.provider.value}] Response received in {elapsed_time:.2f}s")
                logger.debug(f"Response length: {len(content)} characters")
            
            return content
            
        except Exception as e:
            elapsed_time = time.time() - start_time
            logger.error(f"[{self.provider_config.provider.value}] Error after {elapsed_time:.2f}s: {e}")
            raise
    
    def _invoke_with_params(self, messages: List[BaseMessage], params: Dict[str, Any]) -> Any:
        """
        Invoke the LLM with provider-specific parameters.
        This method can be overridden by subclasses for custom parameter handling.
        
        Args:
            messages: Input messages
            params: Provider-specific parameters
            
        Returns:
            LLM response
        """
        # Default implementation - just pass params as kwargs
        return self.llm.invoke(messages, **params)
    
    def get_available_profiles(self) -> List[str]:
        """Get list of available parameter profiles."""
        return list(self.model_config.profiles.keys())
    
    def get_profile_info(self, profile_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific profile."""
        if profile_name not in self.model_config.profiles:
            return None
        
        profile = self.model_config.profiles[profile_name]
        return {
            "name": profile.name,
            "description": profile.description,
            "parameters": profile.parameters
        }
    
    def validate_parameters(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Validate parameters against model constraints."""
        return self.model_config.validate_parameters(params)
    
    def get_context_window_size(self) -> int:
        """Get the context window size for this model."""
        return self.model_config.context_window
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the model."""
        return {
            "provider": self.provider_config.provider.value,
            "model_name": self.model_name,
            "context_window": self.model_config.context_window,
            "temperature": self.model_config.temperature,
            "max_tokens": self.model_config.max_tokens,
            "available_profiles": self.get_available_profiles(),
            "parameter_constraints": self.model_config.parameter_constraints,
            "parameter_mapping": self.model_config.parameter_mapping
        }


class OllamaProvider(BaseLLMProvider):
    """Ollama provider implementation."""
    
    def _create_llm(self) -> BaseLLM:
        """Create Ollama LLM instance."""
        try:
            from langchain_ollama import OllamaLLM
            
            # Get base parameters for LLM initialization
            base_params = self.model_config.get_effective_parameters()
            mapped_params = self.model_config.map_parameters_for_provider(base_params)
            
            return OllamaLLM(
                model=self.model_name,
                base_url=self.provider_config.base_url,
                timeout=self.model_config.timeout,
                # Use mapped parameters for initialization
                **{k: v for k, v in mapped_params.items() 
                   if k in ['temperature', 'num_predict', 'top_k', 'top_p']}
            )
        except ImportError:
            raise ImportError("langchain-ollama package is required for Ollama provider")
    
    def _invoke_with_params(self, messages: List[BaseMessage], params: Dict[str, Any]) -> Any:
        """
        Custom parameter handling for Ollama.
        Ollama LLM doesn't support dynamic parameter updates, so we recreate if needed.
        """
        # Check if parameters are different from current LLM configuration
        current_params = {
            'temperature': self.llm.temperature,
            'num_predict': self.llm.num_predict,
            'top_k': self.llm.top_k,
            'top_p': self.llm.top_p
        }
        
        # Extract relevant parameters
        invoke_params = {k: v for k, v in params.items() 
                        if k in ['temperature', 'num_predict', 'top_k', 'top_p']}
        
        # If parameters changed significantly, we might need to recreate
        # For now, just use the existing LLM and log the difference
        if invoke_params != current_params:
            logger.debug(f"Parameter difference detected: {invoke_params} vs {current_params}")
        
        # Ollama handles parameters at initialization, so we use the existing LLM
        return self.llm.invoke(messages)
    
    def is_available(self) -> bool:
        """Check if Ollama is available."""
        try:
            import requests
            response = requests.get(f"{self.provider_config.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception:
            return False


class AzureOpenAIProvider(BaseLLMProvider):
    """Azure OpenAI provider implementation."""
    
    def _create_llm(self) -> BaseLLM:
        """Create Azure OpenAI LLM instance."""
        try:
            from langchain_openai import AzureChatOpenAI
            
            # Get base parameters for LLM initialization
            base_params = self.model_config.get_effective_parameters()
            mapped_params = self.model_config.map_parameters_for_provider(base_params)
            
            return AzureChatOpenAI(
                azure_endpoint=self.provider_config.base_url,
                api_key=self.provider_config.api_key,
                api_version=self.model_config.additional_params.get("api_version", "2024-02-15-preview"),
                deployment_name=self.provider_config.additional_settings.get("deployment_name", self.model_name),
                timeout=self.model_config.timeout,
                # Use mapped parameters for initialization
                **{k: v for k, v in mapped_params.items() 
                   if k in ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty']}
            )
        except ImportError:
            raise ImportError("langchain-openai package is required for Azure OpenAI provider")
    
    def _invoke_with_params(self, messages: List[BaseMessage], params: Dict[str, Any]) -> Any:
        """
        Custom parameter handling for Azure OpenAI.
        Azure OpenAI supports dynamic parameter updates via invoke kwargs.
        """
        # Extract parameters that can be passed to invoke
        invoke_params = {k: v for k, v in params.items() 
                        if k in ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty']}
        
        return self.llm.invoke(messages, **invoke_params)
    
    def is_available(self) -> bool:
        """Check if Azure OpenAI is available."""
        return bool(self.provider_config.api_key and self.provider_config.base_url)


class GoogleGenAIProvider(BaseLLMProvider):
    """Google Generative AI provider implementation."""
    
    def _create_llm(self) -> BaseLLM:
        """Create Google Generative AI LLM instance."""
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            
            # Get base parameters for LLM initialization
            base_params = self.model_config.get_effective_parameters()
            mapped_params = self.model_config.map_parameters_for_provider(base_params)
            
            return ChatGoogleGenerativeAI(
                model=self.model_name,
                google_api_key=self.provider_config.api_key,
                # Use mapped parameters for initialization
                **{k: v for k, v in mapped_params.items() 
                   if k in ['temperature', 'max_output_tokens', 'top_p', 'top_k']}
            )
        except ImportError:
            raise ImportError("langchain-google-genai package is required for Google Generative AI provider")
    
    def _invoke_with_params(self, messages: List[BaseMessage], params: Dict[str, Any]) -> Any:
        """
        Custom parameter handling for Google Generative AI.
        Google supports dynamic parameter updates via invoke kwargs.
        """
        # Extract parameters that can be passed to invoke
        invoke_params = {k: v for k, v in params.items() 
                        if k in ['temperature', 'max_output_tokens', 'top_p', 'top_k']}
        
        return self.llm.invoke(messages, **invoke_params)
    
    def is_available(self) -> bool:
        """Check if Google Generative AI is available."""
        return bool(self.provider_config.api_key)


def create_provider(provider_config: ProviderConfig, model_name: str) -> BaseLLMProvider:
    """
    Factory function to create provider instances.
    
    Args:
        provider_config: Configuration for the provider
        model_name: Name of the model to use
        
    Returns:
        Provider instance
        
    Raises:
        ValueError: If provider type is not supported
    """
    provider_classes = {
        LLMProvider.OLLAMA: OllamaProvider,
        LLMProvider.AZURE_OPENAI: AzureOpenAIProvider,
        LLMProvider.GOOGLE_GENAI: GoogleGenAIProvider,
    }
    
    provider_class = provider_classes.get(provider_config.provider)
    if not provider_class:
        raise ValueError(f"Unsupported provider: {provider_config.provider}")
    
    return provider_class(provider_config, model_name) 