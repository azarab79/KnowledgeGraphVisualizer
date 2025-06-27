"""
Dependencies Integration Layer

This module integrates the new environment management system with
the existing FastAPI dependency injection system, providing a unified
configuration interface.
"""

import logging
from typing import Dict, Any, Optional
from functools import lru_cache

from fastapi import Depends
from pydantic_settings import BaseSettings

from .environment import (
    AppSettings, 
    get_settings, 
    detect_environment, 
    Environment,
    DatabaseConfig,
    LLMConfig,
    CacheConfig,
    SecurityConfig,
    MonitoringConfig
)

logger = logging.getLogger(__name__)


class UnifiedAppConfig(BaseSettings):
    """
    Unified application configuration that bridges the new environment
    management system with the existing FastAPI dependency system.
    
    This class maintains backward compatibility while providing enhanced
    environment management capabilities.
    """
    
    def __init__(self, **kwargs):
        """Initialize unified config from environment management system."""
        # Get settings from environment management
        env_settings = get_settings()
        
        # Map environment settings to FastAPI-compatible format
        super().__init__(
            # Server settings
            host=env_settings.host,
            port=env_settings.port,
            debug=env_settings.debug,
            environment=env_settings.environment.value,
            
            # CORS settings (from security config)
            cors_origins=env_settings.security.cors_origins,
            cors_allow_credentials=env_settings.security.cors_allow_credentials,
            cors_allow_methods=env_settings.security.cors_allow_methods,
            cors_allow_headers=env_settings.security.cors_allow_headers,
            
            # Trusted hosts
            trusted_hosts=env_settings.security.trusted_hosts,
            
            # Application settings
            max_conversation_length=env_settings.max_conversation_length,
            request_timeout=env_settings.request_timeout,
            
            # QA Pipeline settings
            primary_llm_provider=env_settings.llm.primary_provider,
            fallback_llm_providers=env_settings.llm.fallback_providers,
            max_concurrent_requests=env_settings.max_concurrent_requests,
            conversation_timeout=env_settings.conversation_timeout,
            default_timeout=env_settings.llm.default_timeout,
            
            # Database settings
            neo4j_uri=env_settings.database.neo4j_uri,
            neo4j_username=env_settings.database.neo4j_username,
            neo4j_password=env_settings.database.neo4j_password,
            neo4j_database=env_settings.database.neo4j_database,
            max_connection_pool_size=env_settings.database.max_connection_pool_size,
            connection_acquisition_timeout=env_settings.database.connection_acquisition_timeout,
            max_transaction_retry_time=env_settings.database.max_transaction_retry_time,
            default_query_timeout=env_settings.database.default_query_timeout,
            
            # Cache settings
            cache_backend=env_settings.cache.cache_backend,
            redis_url=env_settings.cache.redis_url,
            redis_db=env_settings.cache.redis_db,
            redis_password=env_settings.cache.redis_password,
            cache_default_ttl=env_settings.cache.cache_default_ttl,
            max_memory_entries=env_settings.cache.max_memory_entries,
            cache_cleanup_interval=env_settings.cache.cache_cleanup_interval,
            
            # Rate limiting settings
            enable_rate_limiting=env_settings.security.rate_limit_enabled,
            rate_limit_requests_per_minute=env_settings.security.rate_limit_requests_per_minute,
            slow_request_threshold=env_settings.monitoring.slow_request_threshold,
            
            # Health check settings
            health_check_interval=env_settings.monitoring.health_check_interval,
            service_startup_timeout=env_settings.monitoring.service_startup_timeout,
            
            # Logging settings
            log_level=env_settings.get_effective_log_level(),
            enable_json_logging=(env_settings.log_format == "json"),
            log_file_name=env_settings.log_file or "kg_qa_api.log",
            
            **kwargs
        )
        
        # Store reference to original settings for advanced access
        self._env_settings = env_settings
    
    @property
    def env_settings(self) -> AppSettings:
        """Access to full environment settings."""
        return self._env_settings
    
    def get_llm_config_dict(self) -> Dict[str, Any]:
        """Get LLM configuration as dictionary for LLM abstraction layer."""
        llm_config = self._env_settings.llm
        
        return {
            "primary_provider": llm_config.primary_provider,
            "fallback_providers": llm_config.fallback_providers,
            "providers": {
                "ollama": {
                    "enabled": llm_config.ollama_enabled,
                    "base_url": llm_config.ollama_base_url,
                    "model": llm_config.ollama_model,
                },
                "azure_openai": {
                    "enabled": llm_config.azure_openai_enabled,
                    "api_key": llm_config.azure_openai_api_key,
                    "endpoint": llm_config.azure_openai_endpoint,
                    "api_version": llm_config.azure_openai_api_version,
                    "deployment_name": llm_config.azure_openai_deployment_name,
                },
                "google_genai": {
                    "enabled": llm_config.google_enabled,
                    "api_key": llm_config.google_api_key,
                    "model": llm_config.google_model,
                }
            },
            "default_temperature": llm_config.default_temperature,
            "default_max_tokens": llm_config.default_max_tokens,
            "default_timeout": llm_config.default_timeout,
            "retry_attempts": llm_config.retry_attempts,
            "retry_delay": llm_config.retry_delay,
        }
    
    def get_database_config_dict(self) -> Dict[str, Any]:
        """Get database configuration as dictionary."""
        db_config = self._env_settings.database
        
        return {
            "uri": db_config.neo4j_uri,
            "username": db_config.neo4j_username,
            "password": db_config.neo4j_password,
            "database": db_config.neo4j_database,
            "max_connection_pool_size": db_config.max_connection_pool_size,
            "connection_acquisition_timeout": db_config.connection_acquisition_timeout,
            "max_transaction_retry_time": db_config.max_transaction_retry_time,
            "default_query_timeout": db_config.default_query_timeout,
            "health_check_timeout": db_config.health_check_timeout,
            "connection_retry_attempts": db_config.connection_retry_attempts,
        }
    
    def get_cache_config_dict(self) -> Dict[str, Any]:
        """Get cache configuration as dictionary."""
        cache_config = self._env_settings.cache
        
        return {
            "backend": cache_config.cache_backend,
            "enabled": cache_config.cache_enabled,
            "default_ttl": cache_config.cache_default_ttl,
            "redis_url": cache_config.redis_url,
            "redis_db": cache_config.redis_db,
            "redis_password": cache_config.redis_password,
            "redis_enabled": cache_config.redis_enabled,
            "max_memory_entries": cache_config.max_memory_entries,
            "cleanup_interval": cache_config.cache_cleanup_interval,
        }
    
    def get_security_config_dict(self) -> Dict[str, Any]:
        """Get security configuration as dictionary."""
        security_config = self._env_settings.security
        
        return {
            "secret_key": security_config.secret_key,
            "api_key_header": security_config.api_key_header,
            "cors_enabled": security_config.cors_enabled,
            "cors_origins": security_config.cors_origins,
            "cors_allow_credentials": security_config.cors_allow_credentials,
            "cors_allow_methods": security_config.cors_allow_methods,
            "cors_allow_headers": security_config.cors_allow_headers,
            "trusted_hosts": security_config.trusted_hosts,
            "rate_limit_enabled": security_config.rate_limit_enabled,
            "rate_limit_requests_per_minute": security_config.rate_limit_requests_per_minute,
            "rate_limit_burst_size": security_config.rate_limit_burst_size,
        }
    
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self._env_settings.is_development()
    
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self._env_settings.is_production()
    
    def is_testing(self) -> bool:
        """Check if running in testing environment."""
        return self._env_settings.is_testing()


# Global configuration instance with caching
@lru_cache()
def get_unified_config() -> UnifiedAppConfig:
    """
    Get unified application configuration with caching.
    
    This function provides a single point of access to application
    configuration that bridges the environment management system
    with FastAPI dependencies.
    """
    return UnifiedAppConfig()


# FastAPI dependency functions
def get_app_config() -> UnifiedAppConfig:
    """FastAPI dependency for application configuration."""
    return get_unified_config()


def get_environment_config() -> AppSettings:
    """FastAPI dependency for full environment configuration."""
    return get_unified_config().env_settings


def get_llm_config() -> Dict[str, Any]:
    """FastAPI dependency for LLM configuration."""
    return get_unified_config().get_llm_config_dict()


def get_database_config() -> Dict[str, Any]:
    """FastAPI dependency for database configuration."""
    return get_unified_config().get_database_config_dict()


def get_cache_config() -> Dict[str, Any]:
    """FastAPI dependency for cache configuration."""
    return get_unified_config().get_cache_config_dict()


def get_security_config() -> Dict[str, Any]:
    """FastAPI dependency for security configuration."""
    return get_unified_config().get_security_config_dict()


# Backward compatibility functions
def get_config() -> UnifiedAppConfig:
    """Backward compatibility alias for get_app_config."""
    return get_app_config()


# Environment-aware service initialization
def initialize_llm_manager_from_config(config: UnifiedAppConfig = Depends(get_app_config)):
    """
    Initialize LLM manager from configuration.
    
    This function can be used as a dependency to initialize the LLM
    abstraction layer with proper configuration.
    """
    from llm_abstraction import LLMManager, LLMConfig
    
    # Convert unified config to LLM config format
    llm_config_dict = config.get_llm_config_dict()
    
    # Create LLM configuration
    llm_config = LLMConfig()
    llm_config.primary_provider = llm_config_dict["primary_provider"]
    llm_config.fallback_providers = llm_config_dict["fallback_providers"]
    
    # Configure providers based on environment config
    # This would involve mapping the config dict to LLMConfig format
    # Implementation details depend on LLMConfig structure
    
    # Create and return LLM manager
    return LLMManager(config=llm_config)


def create_service_dependencies(config: UnifiedAppConfig = Depends(get_app_config)):
    """
    Create service dependencies based on configuration.
    
    This function initializes all required services with proper
    configuration based on the detected environment.
    """
    services = {}
    
    # Database service configuration
    db_config = config.get_database_config_dict()
    services["database"] = db_config
    
    # Cache service configuration
    cache_config = config.get_cache_config_dict()
    services["cache"] = cache_config
    
    # LLM service configuration
    llm_config = config.get_llm_config_dict()
    services["llm"] = llm_config
    
    return services


# Configuration validation
def validate_production_config():
    """
    Validate configuration for production deployment.
    
    This function checks that all required configuration is present
    and properly set for production use.
    """
    config = get_unified_config()
    
    if not config.is_production():
        return True
    
    errors = []
    
    # Check secret key
    if config.env_settings.security.secret_key == "your-secret-key-change-in-production":
        errors.append("Secret key must be changed for production")
    
    # Check LLM providers
    llm_config = config.get_llm_config_dict()
    if not any(provider["enabled"] for provider in llm_config["providers"].values()):
        errors.append("At least one LLM provider must be enabled for production")
    
    # Check database connection
    db_config = config.get_database_config_dict()
    if db_config["password"] == "password":
        errors.append("Database password should be changed for production")
    
    # Check CORS origins
    security_config = config.get_security_config_dict()
    if "*" in security_config["cors_origins"]:
        errors.append("CORS origins should be restricted for production")
    
    if errors:
        raise ValueError(f"Production configuration errors: {'; '.join(errors)}")
    
    return True


# Development helpers
def print_configuration_summary():
    """Print a summary of the current configuration."""
    config = get_unified_config()
    env_settings = config.env_settings
    
    print("\n" + "="*60)
    print("APPLICATION CONFIGURATION SUMMARY")
    print("="*60)
    
    print(f"Environment: {env_settings.environment.value}")
    print(f"Debug Mode: {env_settings.debug}")
    print(f"Log Level: {env_settings.get_effective_log_level()}")
    print(f"Host: {env_settings.host}:{env_settings.port}")
    
    print("\nLLM Configuration:")
    llm_config = config.get_llm_config_dict()
    print(f"  Primary Provider: {llm_config['primary_provider']}")
    print(f"  Fallback Providers: {llm_config['fallback_providers']}")
    for provider, pconfig in llm_config['providers'].items():
        print(f"  {provider}: {'Enabled' if pconfig['enabled'] else 'Disabled'}")
    
    print("\nDatabase Configuration:")
    db_config = config.get_database_config_dict()
    print(f"  URI: {db_config['uri']}")
    print(f"  Database: {db_config['database']}")
    print(f"  Pool Size: {db_config['max_connection_pool_size']}")
    
    print("\nCache Configuration:")
    cache_config = config.get_cache_config_dict()
    print(f"  Backend: {cache_config['backend']}")
    print(f"  Redis: {'Enabled' if cache_config['redis_enabled'] else 'Disabled'}")
    
    print("\nSecurity Configuration:")
    security_config = config.get_security_config_dict()
    print(f"  CORS Origins: {security_config['cors_origins']}")
    print(f"  Rate Limiting: {'Enabled' if security_config['rate_limit_enabled'] else 'Disabled'}")
    
    print("="*60)


if __name__ == "__main__":
    # Test configuration loading
    try:
        print_configuration_summary()
        print("\n✅ Configuration loaded successfully!")
        
        # Validate production config if in production
        config = get_unified_config()
        if config.is_production():
            validate_production_config()
            print("✅ Production configuration validated!")
        
    except Exception as e:
        print(f"\n❌ Configuration error: {e}")
        exit(1) 