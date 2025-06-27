"""
Configuration module for LLM Abstraction Layer.

This module handles configuration settings for different LLM providers,
including model parameters, API keys, and fallback configurations.
"""

import os
from typing import Dict, Any, Optional, List, Union
from enum import Enum
from pydantic import BaseModel, Field, validator
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    OLLAMA = "ollama"
    OPENAI = "openai"
    AZURE_OPENAI = "azure_openai"
    GOOGLE_GENAI = "google_genai"


class ParameterProfile(BaseModel):
    """Predefined parameter profiles for common use cases."""
    name: str = Field(..., description="Profile name")
    description: str = Field(..., description="Profile description")
    parameters: Dict[str, Any] = Field(..., description="Parameter values for this profile")


class ModelConfig(BaseModel):
    """Configuration for a specific model."""
    name: str = Field(..., description="Model name")
    temperature: float = Field(default=0.2, ge=0.0, le=2.0, description="Model temperature")
    max_tokens: Optional[int] = Field(default=None, description="Maximum tokens to generate")
    context_window: int = Field(default=4096, description="Context window size")
    timeout: int = Field(default=60, description="Request timeout in seconds")
    
    # Provider-specific parameters
    additional_params: Dict[str, Any] = Field(default_factory=dict, description="Additional provider-specific parameters")
    
    # Parameter validation rules
    parameter_constraints: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict, 
        description="Parameter validation constraints (min, max, allowed_values, etc.)"
    )
    
    # Parameter mapping for provider-specific names
    parameter_mapping: Dict[str, str] = Field(
        default_factory=dict,
        description="Maps standard parameter names to provider-specific names"
    )
    
    # Predefined parameter profiles
    profiles: Dict[str, ParameterProfile] = Field(
        default_factory=dict,
        description="Predefined parameter profiles for common use cases"
    )
    
    @validator('temperature')
    def validate_temperature(cls, v):
        """Validate temperature is within valid range."""
        if not 0.0 <= v <= 2.0:
            raise ValueError('Temperature must be between 0.0 and 2.0')
        return v
    
    @validator('max_tokens')
    def validate_max_tokens(cls, v):
        """Validate max_tokens is positive if specified."""
        if v is not None and v <= 0:
            raise ValueError('max_tokens must be positive')
        return v
    
    def get_effective_parameters(
        self, 
        overrides: Optional[Dict[str, Any]] = None,
        profile: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get effective parameters combining base config, profile, and overrides.
        
        Args:
            overrides: Parameter overrides for this request
            profile: Profile name to apply
            
        Returns:
            Dict of effective parameters
        """
        # Start with base parameters
        params = {
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            **self.additional_params
        }
        
        # Apply profile if specified
        if profile and profile in self.profiles:
            profile_params = self.profiles[profile].parameters
            params.update(profile_params)
        
        # Apply overrides
        if overrides:
            # Validate overrides
            validated_overrides = self.validate_parameters(overrides)
            params.update(validated_overrides)
        
        # Remove None values
        return {k: v for k, v in params.items() if v is not None}
    
    def validate_parameters(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate parameters against constraints.
        
        Args:
            params: Parameters to validate
            
        Returns:
            Validated parameters
            
        Raises:
            ValueError: If parameters are invalid
        """
        validated = {}
        
        for param_name, value in params.items():
            # Check if parameter has constraints
            if param_name in self.parameter_constraints:
                constraints = self.parameter_constraints[param_name]
                
                # Check minimum value
                if 'min' in constraints and value < constraints['min']:
                    raise ValueError(f"{param_name} must be >= {constraints['min']}, got {value}")
                
                # Check maximum value
                if 'max' in constraints and value > constraints['max']:
                    raise ValueError(f"{param_name} must be <= {constraints['max']}, got {value}")
                
                # Check allowed values
                if 'allowed_values' in constraints and value not in constraints['allowed_values']:
                    raise ValueError(f"{param_name} must be one of {constraints['allowed_values']}, got {value}")
                
                # Check type
                if 'type' in constraints:
                    expected_type = constraints['type']
                    if not isinstance(value, expected_type):
                        raise ValueError(f"{param_name} must be of type {expected_type.__name__}, got {type(value).__name__}")
            
            validated[param_name] = value
        
        return validated
    
    def map_parameters_for_provider(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map standard parameter names to provider-specific names.
        
        Args:
            params: Parameters with standard names
            
        Returns:
            Parameters with provider-specific names
        """
        if not self.parameter_mapping:
            return params
        
        mapped = {}
        for param_name, value in params.items():
            # Use mapped name if available, otherwise use original name
            mapped_name = self.parameter_mapping.get(param_name, param_name)
            mapped[mapped_name] = value
        
        return mapped


class ProviderConfig(BaseModel):
    """Configuration for a specific provider."""
    provider: LLMProvider
    api_key: Optional[str] = Field(default=None, description="API key for the provider")
    base_url: Optional[str] = Field(default=None, description="Base URL for the API")
    models: Dict[str, ModelConfig] = Field(default_factory=dict, description="Available models")
    enabled: bool = Field(default=True, description="Whether this provider is enabled")
    
    # Provider-specific settings
    additional_settings: Dict[str, Any] = Field(default_factory=dict, description="Additional provider settings")


class LLMConfig(BaseModel):
    """Main configuration for the LLM abstraction layer."""
    
    # Primary and fallback providers
    primary_provider: LLMProvider = Field(default=LLMProvider.OLLAMA, description="Primary LLM provider")
    fallback_providers: List[LLMProvider] = Field(
        default_factory=lambda: [LLMProvider.AZURE_OPENAI, LLMProvider.GOOGLE_GENAI],
        description="List of fallback providers in order of preference"
    )
    
    # Provider configurations
    providers: Dict[LLMProvider, ProviderConfig] = Field(default_factory=dict, description="Provider configurations")
    
    # Global settings
    retry_attempts: int = Field(default=3, description="Number of retry attempts for failed requests")
    retry_delay: float = Field(default=1.0, description="Delay between retry attempts in seconds")
    enable_logging: bool = Field(default=True, description="Enable request/response logging")
    
    @classmethod
    def from_environment(cls) -> "LLMConfig":
        """Create configuration from environment variables."""
        config = cls()
        
        # Set primary provider from environment
        primary_provider = os.getenv("LLM_PRIMARY_PROVIDER", "ollama").lower()
        if primary_provider in [p.value for p in LLMProvider]:
            config.primary_provider = LLMProvider(primary_provider)
        
        # Configure Ollama with enhanced parameter configuration
        config.providers[LLMProvider.OLLAMA] = ProviderConfig(
            provider=LLMProvider.OLLAMA,
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            models={
                "deepseek-r1:8b": ModelConfig(
                    name="deepseek-r1:8b",
                    temperature=0.2,
                    max_tokens=None,  # Let model determine
                    context_window=128000,  # 128K context window
                    additional_params={
                        "num_predict": -1,  # Generate until done
                        "top_k": 40,
                        "top_p": 0.9,
                    },
                    parameter_constraints={
                        "temperature": {"min": 0.0, "max": 2.0, "type": float},
                        "top_k": {"min": 1, "max": 100, "type": int},
                        "top_p": {"min": 0.0, "max": 1.0, "type": float},
                        "num_predict": {"min": -1, "max": 128000, "type": int}
                    },
                    parameter_mapping={
                        "max_tokens": "num_predict"  # Ollama uses num_predict instead of max_tokens
                    },
                    profiles={
                        "creative": ParameterProfile(
                            name="creative",
                            description="Creative writing and brainstorming",
                            parameters={"temperature": 0.8, "top_p": 0.9, "top_k": 40}
                        ),
                        "precise": ParameterProfile(
                            name="precise",
                            description="Precise and factual responses",
                            parameters={"temperature": 0.1, "top_p": 0.8, "top_k": 20}
                        ),
                        "balanced": ParameterProfile(
                            name="balanced",
                            description="Balanced creativity and accuracy",
                            parameters={"temperature": 0.4, "top_p": 0.85, "top_k": 30}
                        )
                    }
                )
            },
            enabled=os.getenv("OLLAMA_ENABLED", "true").lower() == "true"
        )
        
        # Configure Azure OpenAI with enhanced parameter configuration
        config.providers[LLMProvider.AZURE_OPENAI] = ProviderConfig(
            provider=LLMProvider.AZURE_OPENAI,
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            base_url=os.getenv("AZURE_OPENAI_ENDPOINT"),
            models={
                "gpt-4o": ModelConfig(
                    name="gpt-4o",
                    temperature=0.2,
                    max_tokens=4096,
                    context_window=128000,
                    additional_params={
                        "api_version": os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
                    },
                    parameter_constraints={
                        "temperature": {"min": 0.0, "max": 2.0, "type": float},
                        "max_tokens": {"min": 1, "max": 4096, "type": int},
                        "top_p": {"min": 0.0, "max": 1.0, "type": float},
                        "frequency_penalty": {"min": -2.0, "max": 2.0, "type": float},
                        "presence_penalty": {"min": -2.0, "max": 2.0, "type": float}
                    },
                    profiles={
                        "creative": ParameterProfile(
                            name="creative",
                            description="Creative writing and brainstorming",
                            parameters={"temperature": 0.8, "top_p": 0.9}
                        ),
                        "precise": ParameterProfile(
                            name="precise",
                            description="Precise and factual responses",
                            parameters={"temperature": 0.1, "top_p": 0.8}
                        ),
                        "balanced": ParameterProfile(
                            name="balanced",
                            description="Balanced creativity and accuracy",
                            parameters={"temperature": 0.4, "top_p": 0.85}
                        )
                    }
                )
            },
            enabled=bool(os.getenv("AZURE_OPENAI_API_KEY")),
            additional_settings={
                "deployment_name": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
            }
        )
        
        # Configure Google Generative AI with enhanced parameter configuration
        config.providers[LLMProvider.GOOGLE_GENAI] = ProviderConfig(
            provider=LLMProvider.GOOGLE_GENAI,
            api_key=os.getenv("GOOGLE_API_KEY"),
            models={
                "gemini-2.5-flash-preview-05-20": ModelConfig(
                    name="gemini-2.5-flash-preview-05-20",
                    temperature=0.2,
                    max_tokens=8192,
                    context_window=1000000,  # 1M context window
                    parameter_constraints={
                        "temperature": {"min": 0.0, "max": 2.0, "type": float},
                        "max_tokens": {"min": 1, "max": 8192, "type": int},
                        "top_p": {"min": 0.0, "max": 1.0, "type": float},
                        "top_k": {"min": 1, "max": 40, "type": int}
                    },
                    parameter_mapping={
                        "max_tokens": "max_output_tokens"  # Google uses max_output_tokens
                    },
                    profiles={
                        "creative": ParameterProfile(
                            name="creative",
                            description="Creative writing and brainstorming",
                            parameters={"temperature": 0.8, "top_p": 0.9, "top_k": 40}
                        ),
                        "precise": ParameterProfile(
                            name="precise",
                            description="Precise and factual responses",
                            parameters={"temperature": 0.1, "top_p": 0.8, "top_k": 20}
                        ),
                        "balanced": ParameterProfile(
                            name="balanced",
                            description="Balanced creativity and accuracy",
                            parameters={"temperature": 0.4, "top_p": 0.85, "top_k": 30}
                        )
                    }
                )
            },
            enabled=bool(os.getenv("GOOGLE_API_KEY"))
        )
        
        # Global settings from environment
        config.retry_attempts = int(os.getenv("LLM_RETRY_ATTEMPTS", "3"))
        config.retry_delay = float(os.getenv("LLM_RETRY_DELAY", "1.0"))
        config.enable_logging = os.getenv("LLM_ENABLE_LOGGING", "true").lower() == "true"
        
        return config
    
    def get_model_config(self, provider: LLMProvider, model_name: str) -> Optional[ModelConfig]:
        """Get model configuration for a specific provider and model."""
        if provider not in self.providers:
            return None
        
        provider_config = self.providers[provider]
        return provider_config.models.get(model_name)
    
    def get_enabled_providers(self) -> List[LLMProvider]:
        """Get list of enabled providers."""
        return [
            provider for provider, config in self.providers.items()
            if config.enabled
        ]
    
    def get_provider_order(self) -> List[LLMProvider]:
        """Get providers in order of preference (primary first, then fallbacks)."""
        providers = [self.primary_provider]
        providers.extend([p for p in self.fallback_providers if p != self.primary_provider])
        return [p for p in providers if p in self.get_enabled_providers()] 