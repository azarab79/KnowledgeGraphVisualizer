"""
LLM Abstraction Layer

This module provides a unified interface for interacting with different LLM providers
including Ollama, Azure OpenAI, and Google Generative AI. It features advanced provider
selection, health monitoring, metrics collection, and conversation history management.
"""

from .config import (
    LLMProvider,
    ModelConfig,
    ProviderConfig,
    LLMConfig
)

from .providers import (
    BaseLLMProvider,
    OllamaProvider,
    AzureOpenAIProvider,
    GoogleGenAIProvider,
    create_provider
)

from .provider_selector import (
    SelectionPolicy,
    ProviderMetrics,
    HealthStatus,
    BaseSelectionStrategy,
    FailoverStrategy,
    RoundRobinStrategy,
    LowestLatencyStrategy,
    LowestCostStrategy,
    LoadBalanceStrategy,
    BestHealthStrategy,
    ProviderSelector
)

from .conversation_history import ConversationHistory

from .llm_manager import LLMManager

__version__ = "1.0.0"

# Main exports for easy usage
__all__ = [
    # Configuration
    "LLMProvider",
    "ModelConfig", 
    "ProviderConfig",
    "LLMConfig",
    
    # Providers
    "BaseLLMProvider",
    "OllamaProvider",
    "AzureOpenAIProvider", 
    "GoogleGenAIProvider",
    "create_provider",
    
    # Provider Selection
    "SelectionPolicy",
    "ProviderMetrics",
    "HealthStatus",
    "BaseSelectionStrategy",
    "FailoverStrategy",
    "RoundRobinStrategy", 
    "LowestLatencyStrategy",
    "LowestCostStrategy",
    "LoadBalanceStrategy",
    "BestHealthStrategy",
    "ProviderSelector",
    
    # Conversation Management
    "ConversationHistory",
    
    # Main Interface
    "LLMManager"
]

# Quick setup functions for common use cases
def create_manager(
    primary_provider: str = "ollama",
    fallback_providers: list = None,
    selection_policy: SelectionPolicy = SelectionPolicy.FAILOVER,
    **kwargs
) -> LLMManager:
    """
    Create a pre-configured LLM manager with sensible defaults.
    
    Args:
        primary_provider: Primary provider name
        fallback_providers: List of fallback provider names  
        selection_policy: Provider selection policy
        **kwargs: Additional configuration parameters
        
    Returns:
        Configured LLM manager
    """
    if fallback_providers is None:
        fallback_providers = ["google_genai", "azure_openai"]
    
    config = LLMConfig.from_environment()
    # Convert string names to LLMProvider enums if needed
    if isinstance(primary_provider, str):
        config.primary_provider = LLMProvider(primary_provider)
    else:
        config.primary_provider = primary_provider
        
    if fallback_providers and isinstance(fallback_providers[0], str):
        config.fallback_providers = [LLMProvider(p) for p in fallback_providers]
    else:
        config.fallback_providers = fallback_providers
    
    return LLMManager(
        config=config,
        selection_policy=selection_policy,
        **kwargs
    )

def create_ollama_manager(**kwargs) -> LLMManager:
    """
    Create an LLM manager optimized for Ollama with deepseek-r1:8b.
    
    Args:
        **kwargs: Additional configuration parameters
        
    Returns:
        Ollama-optimized LLM manager
    """
    return create_manager(
        primary_provider="ollama", 
        fallback_providers=["google_genai"],
        selection_policy=SelectionPolicy.FAILOVER,
        **kwargs
    )

def create_cloud_manager(
    selection_policy: SelectionPolicy = SelectionPolicy.LOWEST_LATENCY,
    **kwargs
) -> LLMManager:
    """
    Create an LLM manager optimized for cloud providers with intelligent selection.
    
    Args:
        selection_policy: Selection policy for cloud providers
        **kwargs: Additional configuration parameters
        
    Returns:
        Cloud-optimized LLM manager
    """
    return create_manager(
        primary_provider="azure_openai",
        fallback_providers=["google_genai", "ollama"], 
        selection_policy=selection_policy,
        **kwargs
    ) 