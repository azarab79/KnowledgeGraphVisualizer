"""
Environment Management System for QA Pipeline API

This module provides environment detection, configuration management,
and environment-specific settings for the FastAPI application.
"""

import os
import sys
import logging
from enum import Enum
from typing import Type, Union, Optional, Dict, Any, List
from pathlib import Path
from functools import lru_cache

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic import Field, validator, root_validator
except ImportError:
    from pydantic import BaseSettings, Field, validator, root_validator
    # Fallback for older pydantic versions
    class SettingsConfigDict:
        def __init__(self, **kwargs):
            self.config = kwargs

logger = logging.getLogger(__name__)


class Environment(str, Enum):
    """Supported deployment environments."""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


class DatabaseConfig(BaseSettings):
    """Database configuration settings."""
    # Neo4j settings
    neo4j_uri: str = Field(default="bolt://localhost:7687", description="Neo4j connection URI")
    neo4j_username: str = Field(default="neo4j", description="Neo4j username")
    neo4j_password: str = Field(default="password", description="Neo4j password")
    neo4j_database: str = Field(default="neo4j", description="Neo4j database name")
    
    # Connection pool settings
    max_connection_pool_size: int = Field(default=50, description="Maximum connection pool size")
    connection_acquisition_timeout: int = Field(default=60, description="Connection acquisition timeout in seconds")
    max_transaction_retry_time: int = Field(default=30, description="Maximum transaction retry time in seconds")
    default_query_timeout: float = Field(default=30.0, description="Default query timeout in seconds")
    
    # Health check settings
    health_check_timeout: float = Field(default=5.0, description="Database health check timeout")
    connection_retry_attempts: int = Field(default=3, description="Number of connection retry attempts")
    
    class Config:
        env_prefix = "NEO4J_"


class LLMConfig(BaseSettings):
    """LLM provider configuration settings."""
    # Primary provider settings
    primary_provider: str = Field(default="ollama", description="Primary LLM provider")
    fallback_providers: List[str] = Field(default=["google_genai"], description="Fallback LLM providers")
    
    # Provider-specific settings
    ollama_base_url: str = Field(default="http://localhost:11434", description="Ollama API base URL")
    ollama_model: str = Field(default="deepseek-r1:8b", description="Ollama model name")
    ollama_enabled: bool = Field(default=True, description="Enable Ollama provider")
    
    azure_openai_api_key: Optional[str] = Field(default=None, description="Azure OpenAI API key")
    azure_openai_endpoint: Optional[str] = Field(default=None, description="Azure OpenAI endpoint")
    azure_openai_api_version: str = Field(default="2024-02-15-preview", description="Azure OpenAI API version")
    azure_openai_deployment_name: str = Field(default="gpt-4o", description="Azure OpenAI deployment name")
    azure_openai_enabled: bool = Field(default=False, description="Enable Azure OpenAI provider")
    
    google_api_key: Optional[str] = Field(default=None, description="Google Generative AI API key")
    google_model: str = Field(default="gemini-2.5-flash-preview-05-20", description="Google model name")
    google_enabled: bool = Field(default=False, description="Enable Google GenAI provider")
    
    # LLM behavior settings
    default_temperature: float = Field(default=0.2, ge=0.0, le=2.0, description="Default model temperature")
    default_max_tokens: Optional[int] = Field(default=None, description="Default maximum tokens")
    default_timeout: float = Field(default=60.0, description="Default request timeout")
    retry_attempts: int = Field(default=3, description="Number of retry attempts")
    retry_delay: float = Field(default=1.0, description="Delay between retries")
    
    class Config:
        env_prefix = "LLM_"
    
    @validator('azure_openai_enabled', always=True)
    def validate_azure_enabled(cls, v, values):
        """Auto-enable Azure OpenAI if API key is provided."""
        if values.get('azure_openai_api_key'):
            return True
        return v
    
    @validator('google_enabled', always=True)
    def validate_google_enabled(cls, v, values):
        """Auto-enable Google GenAI if API key is provided."""
        if values.get('google_api_key'):
            return True
        return v


class CacheConfig(BaseSettings):
    """Cache configuration settings."""
    cache_backend: str = Field(default="hybrid", description="Cache backend type (memory, redis, hybrid)")
    cache_enabled: bool = Field(default=True, description="Enable caching")
    cache_default_ttl: int = Field(default=3600, description="Default cache TTL in seconds")
    
    # Redis settings
    redis_url: str = Field(default="redis://localhost:6379", description="Redis connection URL")
    redis_db: int = Field(default=0, description="Redis database number")
    redis_password: Optional[str] = Field(default=None, description="Redis password")
    redis_enabled: bool = Field(default=True, description="Enable Redis cache")
    
    # Memory cache settings
    max_memory_entries: int = Field(default=10000, description="Maximum in-memory cache entries")
    cache_cleanup_interval: int = Field(default=300, description="Cache cleanup interval in seconds")
    
    class Config:
        env_prefix = "CACHE_"


class SecurityConfig(BaseSettings):
    """Security configuration settings."""
    secret_key: str = Field(default="your-secret-key-change-in-production", description="Application secret key")
    api_key_header: str = Field(default="X-API-Key", description="API key header name")
    cors_enabled: bool = Field(default=True, description="Enable CORS")
    
    # CORS settings
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3002"], 
        description="Allowed CORS origins"
    )
    cors_allow_credentials: bool = Field(default=True, description="Allow CORS credentials")
    cors_allow_methods: List[str] = Field(
        default=["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
        description="Allowed CORS methods"
    )
    cors_allow_headers: List[str] = Field(default=["*"], description="Allowed CORS headers")
    
    # Trusted hosts
    trusted_hosts: List[str] = Field(
        default=["localhost", "127.0.0.1", "*.localhost"], 
        description="Trusted host patterns"
    )
    
    # Rate limiting
    rate_limit_enabled: bool = Field(default=True, description="Enable rate limiting")
    rate_limit_requests_per_minute: int = Field(default=60, description="Rate limit requests per minute")
    rate_limit_burst_size: int = Field(default=100, description="Rate limit burst size")
    
    class Config:
        env_prefix = "SECURITY_"
    
    @validator('secret_key')
    def validate_secret_key(cls, v, values):
        """Validate that secret key is changed for production."""
        if v == "your-secret-key-change-in-production":
            logger.warning("Using default secret key - change this for production!")
        return v


class MonitoringConfig(BaseSettings):
    """Monitoring and observability configuration."""
    # Health checks
    health_check_enabled: bool = Field(default=True, description="Enable health checks")
    health_check_interval: float = Field(default=30.0, description="Health check interval in seconds")
    service_startup_timeout: float = Field(default=60.0, description="Service startup timeout")
    
    # Metrics
    metrics_enabled: bool = Field(default=True, description="Enable metrics collection")
    metrics_endpoint: str = Field(default="/metrics", description="Metrics endpoint path")
    
    # Performance monitoring
    slow_request_threshold: float = Field(default=1.0, description="Slow request threshold in seconds")
    enable_performance_logging: bool = Field(default=True, description="Enable performance logging")
    
    # Error tracking
    error_tracking_enabled: bool = Field(default=True, description="Enable error tracking")
    max_error_history: int = Field(default=1000, description="Maximum error history entries")
    
    class Config:
        env_prefix = "MONITORING_"


class AppSettings(BaseSettings):
    """Main application settings class."""
    
    # Basic app info
    app_name: str = Field(default="QA Pipeline API", description="Application name")
    app_version: str = Field(default="1.0.0", description="Application version")
    app_description: str = Field(default="Knowledge Graph QA Pipeline API")
    
    # Environment
    environment: Environment = Field(default=Environment.DEVELOPMENT, description="Deployment environment")
    debug: bool = Field(default=False, description="Enable debug mode")
    testing: bool = Field(default=False, description="Enable testing mode")
    
    # Server settings
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, ge=1, le=65535, description="Server port")
    reload: bool = Field(default=False, description="Enable auto-reload")
    workers: int = Field(default=1, ge=1, description="Number of worker processes")
    
    # API settings
    api_prefix: str = Field(default="/api/v1", description="API path prefix")
    docs_url: str = Field(default="/docs", description="OpenAPI docs URL")
    redoc_url: str = Field(default="/redoc", description="ReDoc URL")
    openapi_url: str = Field(default="/openapi.json", description="OpenAPI JSON URL")
    
    # Request settings
    max_request_size: int = Field(default=16 * 1024 * 1024, description="Maximum request size in bytes")
    request_timeout: float = Field(default=30.0, description="Request timeout in seconds")
    max_conversation_length: int = Field(default=100, description="Maximum conversation length")
    
    # QA Pipeline settings
    max_concurrent_requests: int = Field(default=10, description="Maximum concurrent requests")
    conversation_timeout: int = Field(default=3600, description="Conversation timeout in seconds")
    
    # Logging settings
    log_level: str = Field(default="INFO", description="Logging level")
    log_format: str = Field(default="json", description="Log format (json, text)")
    log_file: Optional[str] = Field(default=None, description="Log file path")
    enable_request_logging: bool = Field(default=True, description="Enable request logging")
    
    # Component configurations
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    llm: LLMConfig = Field(default_factory=LLMConfig)
    cache: CacheConfig = Field(default_factory=CacheConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    monitoring: MonitoringConfig = Field(default_factory=MonitoringConfig)
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"
    
    @validator('environment', pre=True)
    def validate_environment(cls, v):
        """Validate and convert environment string to enum."""
        if isinstance(v, str):
            env_str = v.lower().strip()
            for env in Environment:
                if env.value == env_str:
                    return env
            logger.warning(f"Unknown environment '{v}', defaulting to development")
            return Environment.DEVELOPMENT
        return v
    
    @validator('debug', always=True)
    def set_debug_mode(cls, v, values):
        """Auto-enable debug mode for development environment."""
        if values.get('environment') == Environment.DEVELOPMENT:
            return True
        return v
    
    @validator('reload', always=True)
    def set_reload_mode(cls, v, values):
        """Auto-enable reload for development environment."""
        if values.get('environment') == Environment.DEVELOPMENT:
            return True
        return v
    
    def get_effective_log_level(self) -> str:
        """Get effective log level based on environment."""
        if self.environment == Environment.DEVELOPMENT:
            return "DEBUG"
        elif self.environment == Environment.TESTING:
            return "WARNING"
        else:
            return self.log_level
    
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == Environment.PRODUCTION
    
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == Environment.DEVELOPMENT
    
    def is_testing(self) -> bool:
        """Check if running in testing environment."""
        return self.environment == Environment.TESTING


def detect_environment() -> Environment:
    """
    Detect the current environment from various sources.
    
    Priority order:
    1. ENVIRONMENT environment variable
    2. ENV environment variable
    3. Detect from system/container environment
    4. Default to development
    """
    # Check explicit environment variables
    env_var = os.getenv("ENVIRONMENT") or os.getenv("ENV")
    if env_var:
        env_str = env_var.lower().strip()
        for env in Environment:
            if env.value == env_str:
                logger.info(f"Environment detected from variable: {env.value}")
                return env
    
    # Check for container/cloud environment indicators
    if os.getenv("KUBERNETES_SERVICE_HOST"):
        logger.info("Kubernetes environment detected, assuming production")
        return Environment.PRODUCTION
    
    if os.getenv("DOCKER_CONTAINER"):
        logger.info("Docker container detected, assuming staging")
        return Environment.STAGING
    
    # Check for testing frameworks
    if "pytest" in sys.modules or os.getenv("PYTEST_CURRENT_TEST"):
        logger.info("Pytest detected, using testing environment")
        return Environment.TESTING
    
    # Default to development
    logger.info("No environment indicators found, defaulting to development")
    return Environment.DEVELOPMENT


@lru_cache()
def get_settings(environment: Optional[Environment] = None) -> AppSettings:
    """
    Get application settings with caching.
    
    This function creates and caches the appropriate settings instance
    based on the detected or specified environment.
    """
    if environment is None:
        environment = detect_environment()
    
    # Load environment-specific .env file if it exists
    env_file = f".env.{environment.value}"
    env_path = Path(env_file)
    
    if env_path.exists():
        logger.info(f"Loading environment-specific config: {env_file}")
        # For older pydantic versions, we manually load the env file
        from dotenv import load_dotenv
        load_dotenv(env_file)
    else:
        logger.info(f"No environment-specific config found ({env_file}), using defaults")
    
    # Create settings instance
    settings = AppSettings()
    settings.environment = environment
    
    return settings


def create_env_files():
    """Create example environment files for different environments."""
    templates = {
        ".env.development": """# Development Environment Configuration
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG

# Database (use local Neo4j)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j

# LLM Configuration
LLM_PRIMARY_PROVIDER=ollama
LLM_OLLAMA_BASE_URL=http://localhost:11434
LLM_OLLAMA_MODEL=deepseek-r1:8b

# Optional: Add API keys for other providers
# LLM_AZURE_OPENAI_API_KEY=your-azure-api-key
# LLM_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
# LLM_GOOGLE_API_KEY=your-google-api-key

# Cache (use local Redis or memory)
CACHE_BACKEND=hybrid
CACHE_REDIS_URL=redis://localhost:6379

# Security (relaxed for development)
SECURITY_CORS_ORIGINS=["*"]
SECURITY_RATE_LIMIT_ENABLED=false
""",
        
        ".env.testing": """# Testing Environment Configuration
ENVIRONMENT=testing
DEBUG=true
LOG_LEVEL=WARNING

# Database (use test database)
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=test

# LLM Configuration (use local/mock providers)
LLM_PRIMARY_PROVIDER=ollama
LLM_OLLAMA_BASE_URL=http://localhost:11434

# Cache (use memory only for testing)
CACHE_BACKEND=memory
CACHE_REDIS_ENABLED=false

# Security (minimal for testing)
SECURITY_RATE_LIMIT_ENABLED=false
""",
        
        ".env.staging": """# Staging Environment Configuration
ENVIRONMENT=staging
DEBUG=false
LOG_LEVEL=INFO

# Database (staging database)
NEO4J_URI=bolt://staging-neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-staging-password
NEO4J_DATABASE=neo4j

# LLM Configuration (staging API keys)
LLM_PRIMARY_PROVIDER=azure_openai
LLM_AZURE_OPENAI_API_KEY=your-staging-azure-api-key
LLM_AZURE_OPENAI_ENDPOINT=https://your-staging-resource.openai.azure.com/
LLM_GOOGLE_API_KEY=your-staging-google-api-key

# Cache (staging Redis)
CACHE_BACKEND=redis
CACHE_REDIS_URL=redis://staging-redis:6379

# Security (moderate restrictions)
SECURITY_SECRET_KEY=your-staging-secret-key
SECURITY_CORS_ORIGINS=["https://staging.yourdomain.com"]
SECURITY_RATE_LIMIT_REQUESTS_PER_MINUTE=120
""",
        
        ".env.production": """# Production Environment Configuration
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=WARNING

# Database (production database)
NEO4J_URI=bolt://prod-neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-production-password
NEO4J_DATABASE=neo4j

# LLM Configuration (production API keys)
LLM_PRIMARY_PROVIDER=azure_openai
LLM_AZURE_OPENAI_API_KEY=your-production-azure-api-key
LLM_AZURE_OPENAI_ENDPOINT=https://your-production-resource.openai.azure.com/
LLM_GOOGLE_API_KEY=your-production-google-api-key

# Cache (production Redis cluster)
CACHE_BACKEND=redis
CACHE_REDIS_URL=redis://prod-redis-cluster:6379

# Security (strict settings)
SECURITY_SECRET_KEY=your-production-secret-key-32-chars-min
SECURITY_CORS_ORIGINS=["https://yourdomain.com", "https://www.yourdomain.com"]
SECURITY_RATE_LIMIT_ENABLED=true
SECURITY_RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Monitoring (enabled for production)
MONITORING_METRICS_ENABLED=true
MONITORING_ERROR_TRACKING_ENABLED=true
"""
    }
    
    for filename, content in templates.items():
        if not Path(filename).exists():
            with open(filename, 'w') as f:
                f.write(content)
            logger.info(f"Created example environment file: {filename}")
        else:
            logger.info(f"Environment file already exists: {filename}")


# Convenience function for FastAPI dependency injection
def get_app_config() -> AppSettings:
    """Get application configuration for dependency injection."""
    return get_settings()


if __name__ == "__main__":
    # Create example environment files
    create_env_files()
    
    # Test environment detection
    env = detect_environment()
    print(f"Detected environment: {env.value}")
    
    # Test settings loading
    settings = get_settings()
    print(f"Settings loaded for: {settings.environment.value}")
    print(f"Debug mode: {settings.debug}")
    print(f"Log level: {settings.get_effective_log_level()}") 