"""
FastAPI Dependency Injection Functions

This module provides dependency injection functions for the FastAPI application,
managing service lifecycle, configuration, and resource sharing.
"""

import asyncio
import logging
import os
from typing import Dict, Any, Optional, Generator, AsyncGenerator
from functools import lru_cache
from contextlib import asynccontextmanager

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from pydantic_settings import BaseSettings

from services import ServiceManager, QAService, DatabaseService, CacheService
from services.base import service_manager

logger = logging.getLogger(__name__)

# Security
security = HTTPBearer(auto_error=False)


class AppConfig(BaseSettings):
    """
    Application configuration with environment variable support.
    
    This replaces the Settings class in main.py with a more comprehensive
    dependency injection-friendly configuration.
    """
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    environment: str = "development"
    secret_key: str = "your-secret-key-change-in-production"
    
    # CORS settings
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3002"]
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    cors_allow_headers: list[str] = ["*"]
    
    # Trusted hosts
    trusted_hosts: list[str] = ["localhost", "127.0.0.1", "*.localhost"]
    
    # Application settings
    max_conversation_length: int = 100
    request_timeout: int = 30
    
    # QA Pipeline settings
    primary_llm_provider: str = "ollama"
    fallback_llm_providers: list[str] = ["google_genai"]
    max_concurrent_requests: int = 10
    conversation_timeout: int = 3600
    default_timeout: float = 30.0
    
    # Database settings
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_username: str = "neo4j"
    neo4j_password: str = "password"
    neo4j_database: str = "neo4j"
    max_connection_pool_size: int = 50
    connection_acquisition_timeout: int = 60
    max_transaction_retry_time: int = 30
    default_query_timeout: float = 30.0
    
    # Cache settings
    cache_backend: str = "hybrid"  # memory, redis, hybrid
    redis_url: str = "redis://localhost:6379"
    redis_db: int = 0
    redis_password: Optional[str] = None
    cache_default_ttl: int = 3600
    max_memory_entries: int = 10000
    cache_cleanup_interval: int = 300
    
    # Rate limiting settings
    enable_rate_limiting: bool = True
    rate_limit_requests_per_minute: int = 60
    slow_request_threshold: float = 1.0
    
    # Health check settings
    health_check_interval: float = 30.0
    service_startup_timeout: float = 60.0
    
    # Logging settings
    log_level: str = "INFO"
    enable_json_logging: bool = True
    log_file_name: str = "kg_qa_api.log"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global configuration instance
@lru_cache()
def get_config() -> AppConfig:
    """
    Get application configuration with caching.
    
    This dependency provides application configuration to all endpoints
    and services that need it.
    """
    return AppConfig()


# Service Dependencies

async def get_service_manager() -> ServiceManager:
    """
    Get the global service manager.
    
    This dependency provides access to the centralized service manager
    for service registration and lifecycle management.
    """
    return service_manager


async def get_qa_service(
    manager: ServiceManager = Depends(get_service_manager)
) -> QAService:
    """
    Get the QA service instance.
    
    This dependency provides access to the QA pipeline service with
    proper lifecycle management and connection pooling.
    """
    qa_service = manager.get_service_by_type(QAService)
    if not qa_service or not qa_service.is_healthy():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="QA service is not available"
        )
    return qa_service


async def get_database_service(
    manager: ServiceManager = Depends(get_service_manager)
) -> DatabaseService:
    """
    Get the database service instance.
    
    This dependency provides access to the Neo4j database service with
    connection pooling and transaction management.
    """
    db_service = manager.get_service_by_type(DatabaseService)
    if not db_service or not db_service.is_healthy():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is not available"
        )
    return db_service


async def get_cache_service(
    manager: ServiceManager = Depends(get_service_manager)
) -> CacheService:
    """
    Get the cache service instance.
    
    This dependency provides access to the caching service with
    Redis and in-memory fallback support.
    """
    cache_service = manager.get_service_by_type(CacheService)
    if not cache_service or not cache_service.is_healthy():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cache service is not available"
        )
    return cache_service


# Convenience dependencies for common operations

@asynccontextmanager
async def get_qa_conversation(
    conversation_id: str,
    qa_service: QAService = Depends(get_qa_service)
) -> AsyncGenerator[str, None]:
    """
    Context manager for QA conversations.
    
    This dependency provides a managed conversation context that
    handles conversation lifecycle and cleanup.
    """
    async with qa_service.conversation_context(conversation_id) as conv_id:
        yield conv_id


@asynccontextmanager
async def get_database_session(
    db_service: DatabaseService = Depends(get_database_service),
    **session_kwargs
) -> AsyncGenerator[Any, None]:
    """
    Context manager for database sessions.
    
    This dependency provides a managed database session with
    proper connection pooling and resource cleanup.
    """
    async with db_service.session(**session_kwargs) as session:
        yield session


# Request-scoped dependencies

class RequestContext:
    """Request context for storing request-scoped data."""
    
    def __init__(self):
        self.request_id: Optional[str] = None
        self.start_time: float = 0.0
        self.user_id: Optional[str] = None
        self.conversation_id: Optional[str] = None
        self.metadata: Dict[str, Any] = {}


async def get_request_context() -> RequestContext:
    """
    Get request context for the current request.
    
    This dependency provides request-scoped data storage and tracking.
    """
    import time
    import uuid
    
    context = RequestContext()
    context.request_id = str(uuid.uuid4())
    context.start_time = time.time()
    
    return context


# Health check dependencies

async def check_service_health(
    manager: ServiceManager = Depends(get_service_manager)
) -> Dict[str, Any]:
    """
    Check the health of all services.
    
    This dependency provides health status for all registered services
    and can be used for health check endpoints.
    """
    try:
        health_results = await manager.health_check_all()
        
        overall_healthy = all(
            health.healthy for health in health_results.values()
        )
        
        return {
            'healthy': overall_healthy,
            'services': {
                name: {
                    'healthy': health.healthy,
                    'status': health.status.value,
                    'last_check': health.last_check,
                    'error_message': health.error_message,
                    'metadata': health.metadata or {}
                }
                for name, health in health_results.items()
            },
            'service_count': len(health_results)
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            'healthy': False,
            'error': str(e),
            'services': {},
            'service_count': 0
        }


# Service initialization functions

async def initialize_services(config: AppConfig) -> ServiceManager:
    """
    Initialize all services with the given configuration.
    
    This function sets up all services with proper configuration
    and registers them with the service manager.
    """
    logger.info("Initializing application services...")
    
    try:
        # Create service configurations
        qa_config = {
            'primary_provider': config.primary_llm_provider,
            'fallback_providers': config.fallback_llm_providers,
            'max_concurrent_requests': config.max_concurrent_requests,
            'conversation_timeout': config.conversation_timeout,
            'default_timeout': config.default_timeout,
            'health_check_interval': config.health_check_interval
        }
        
        db_config = {
            'neo4j_uri': config.neo4j_uri,
            'neo4j_username': config.neo4j_username,
            'neo4j_password': config.neo4j_password,
            'neo4j_database': config.neo4j_database,
            'max_connection_pool_size': config.max_connection_pool_size,
            'connection_acquisition_timeout': config.connection_acquisition_timeout,
            'max_transaction_retry_time': config.max_transaction_retry_time,
            'default_query_timeout': config.default_query_timeout,
            'health_check_interval': config.health_check_interval
        }
        
        cache_config = {
            'backend': config.cache_backend,
            'redis_url': config.redis_url,
            'redis_db': config.redis_db,
            'redis_password': config.redis_password,
            'default_ttl': config.cache_default_ttl,
            'max_memory_entries': config.max_memory_entries,
            'cleanup_interval': config.cache_cleanup_interval,
            'health_check_interval': config.health_check_interval
        }
        
        # Create and register services
        # Database service has highest priority (starts first)
        db_service = DatabaseService(db_config)
        service_manager.register_service(db_service, startup_priority=1)
        
        # Cache service has medium priority
        cache_service = CacheService(cache_config)
        service_manager.register_service(cache_service, startup_priority=2)
        
        # QA service has lowest priority (starts last, depends on others)
        qa_service = QAService(qa_config)
        service_manager.register_service(qa_service, startup_priority=3)
        
        # Start all services
        await asyncio.wait_for(
            service_manager.start_all(),
            timeout=config.service_startup_timeout
        )
        
        logger.info("All services initialized successfully")
        return service_manager
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        # Try to stop any services that were started
        try:
            await service_manager.stop_all()
        except Exception as cleanup_error:
            logger.error(f"Error during service cleanup: {cleanup_error}")
        raise


async def shutdown_services() -> None:
    """
    Shutdown all services gracefully.
    
    This function stops all services in reverse dependency order
    and cleans up resources.
    """
    logger.info("Shutting down application services...")
    
    try:
        await service_manager.stop_all()
        logger.info("All services shut down successfully")
        
    except Exception as e:
        logger.error(f"Error during service shutdown: {e}")
        raise


# Background task dependencies

async def get_background_task_manager():
    """
    Get background task manager for long-running operations.
    
    This could be expanded to include Celery or other task queue
    integrations for more complex background processing.
    """
    # Placeholder for future background task management
    return None


# Security dependencies

async def get_current_user(token: Optional[str] = Depends(security)):
    """
    Get current user from authentication token.
    
    This is a placeholder for authentication. In production,
    you would implement proper JWT token validation here.
    """
    # Placeholder for authentication
    if token is None:
        return None
    
    # In production, validate JWT token here
    return {"user_id": "anonymous", "permissions": ["read"]}


# Rate limiting dependencies

class RateLimiter:
    """Simple rate limiter for demonstration."""
    
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests = {}
    
    async def check_rate_limit(self, identifier: str) -> bool:
        """Check if request is within rate limit."""
        import time
        
        current_time = time.time()
        minute_window = int(current_time // 60)
        
        if identifier not in self.requests:
            self.requests[identifier] = {}
        
        user_requests = self.requests[identifier]
        
        # Clean old windows
        old_windows = [w for w in user_requests.keys() if w < minute_window - 1]
        for old_window in old_windows:
            del user_requests[old_window]
        
        # Check current window
        current_count = user_requests.get(minute_window, 0)
        
        if current_count >= self.requests_per_minute:
            return False
        
        user_requests[minute_window] = current_count + 1
        return True


# Global rate limiter instance
_rate_limiter = RateLimiter()


async def check_rate_limit(
    request_context: RequestContext = Depends(get_request_context),
    config: AppConfig = Depends(get_config)
) -> None:
    """
    Check rate limit for the current request.
    
    This dependency enforces rate limiting based on IP address
    or user identifier.
    """
    if not config.enable_rate_limiting:
        return
    
    # Use request ID as identifier (in production, use IP or user ID)
    identifier = request_context.request_id or "anonymous"
    
    if not await _rate_limiter.check_rate_limit(identifier):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded"
        )


# Metrics dependencies

async def get_service_metrics(
    manager: ServiceManager = Depends(get_service_manager)
) -> Dict[str, Any]:
    """
    Get metrics from all services.
    
    This dependency provides aggregated metrics from all services
    for monitoring and observability.
    """
    try:
        metrics = {}
        
        # Get metrics from each service
        for service_name in manager._services:
            service = manager.get_service(service_name)
            if service and hasattr(service, 'get_metrics'):
                metrics[service_name] = service.get_metrics()
        
        # Add overall system metrics
        service_status = manager.get_service_status()
        metrics['system'] = {
            'service_count': len(manager),
            'healthy_services': sum(
                1 for status in service_status.values() 
                if status['healthy']
            ),
            'total_uptime': min(
                status['uptime'] for status in service_status.values()
            ) if service_status else 0
        }
        
        return metrics
        
    except Exception as e:
        logger.error(f"Failed to get service metrics: {e}")
        return {"error": str(e)} 