"""
Tests for Dependency Injection System

This module tests the service layer, dependency injection, and FastAPI integration
for the Knowledge Graph QA application.
"""

import pytest
import asyncio
import time
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any

# Test imports
from services.base import BaseService, ServiceManager, ServiceStatus, ServiceHealth
from services.qa_service import QAService
from services.database_service import DatabaseService
from services.cache_service import CacheService, CacheBackend
from dependencies import (
    AppConfig, get_config, initialize_services, shutdown_services,
    get_qa_service, get_database_service, get_cache_service,
    RequestContext, get_request_context, check_rate_limit
)

# FastAPI test imports
from fastapi.testclient import TestClient
from fastapi import FastAPI
import httpx


class MockService(BaseService):
    """Mock service for testing the base service functionality."""
    
    def __init__(self, name: str = "mock_service", fail_start: bool = False, fail_health: bool = False):
        super().__init__(name)
        self.fail_start = fail_start
        self.fail_health = fail_health
        self.started = False
        self.stopped = False
        
    async def start(self) -> None:
        if self.fail_start:
            raise RuntimeError("Mock service start failure")
        self.started = True
        
    async def stop(self) -> None:
        self.stopped = True
        
    async def health_check(self) -> ServiceHealth:
        if self.fail_health:
            return ServiceHealth(
                status=self.status,
                healthy=False,
                last_check=time.time(),
                error_message="Mock health check failure"
            )
        
        return ServiceHealth(
            status=self.status,
            healthy=True,
            last_check=time.time(),
            metadata={'mock': True}
        )


class TestBaseService:
    """Test the base service class functionality."""
    
    @pytest.mark.asyncio
    async def test_service_lifecycle(self):
        """Test basic service lifecycle management."""
        service = MockService("test_service")
        
        # Initial state
        assert service.status == ServiceStatus.INITIALIZED
        assert not service.started
        assert not service.stopped
        
        # Startup
        await service.startup()
        assert service.status == ServiceStatus.RUNNING
        assert service.started
        assert service.get_uptime() > 0
        
        # Health check
        health = await service.health_check()
        assert health.healthy
        assert health.status == ServiceStatus.RUNNING
        
        # Shutdown
        await service.shutdown()
        assert service.status == ServiceStatus.STOPPED
        assert service.stopped
    
    @pytest.mark.asyncio
    async def test_service_start_failure(self):
        """Test service startup failure handling."""
        service = MockService("failing_service", fail_start=True)
        
        with pytest.raises(RuntimeError, match="Mock service start failure"):
            await service.startup()
        
        assert service.status == ServiceStatus.ERROR
        assert service.error_message == "Mock service start failure"
    
    @pytest.mark.asyncio
    async def test_service_health_failure(self):
        """Test service health check failure."""
        service = MockService("unhealthy_service", fail_health=True)
        await service.startup()
        
        health = await service.health_check()
        assert not health.healthy
        assert health.error_message == "Mock health check failure"
    
    def test_service_uptime_calculation(self):
        """Test service uptime calculation."""
        service = MockService()
        
        # No uptime before start
        assert service.get_uptime() == 0.0
        
        # Set start time manually for testing
        service.start_time = time.time() - 10.0
        uptime = service.get_uptime()
        assert 9.0 < uptime < 11.0  # Allow for small timing variations


class TestServiceManager:
    """Test the service manager functionality."""
    
    @pytest.fixture
    def manager(self):
        """Create a fresh service manager for each test."""
        return ServiceManager()
    
    @pytest.mark.asyncio
    async def test_service_registration(self, manager):
        """Test service registration and retrieval."""
        service1 = MockService("service1")
        service2 = MockService("service2")
        
        # Register services
        manager.register_service(service1, startup_priority=1)
        manager.register_service(service2, startup_priority=2)
        
        # Test retrieval
        assert manager.get_service("service1") == service1
        assert manager.get_service("service2") == service2
        assert manager.get_service_by_type(MockService) == service1  # First registered
        assert len(manager) == 2
        assert "service1" in manager
        assert "nonexistent" not in manager
    
    @pytest.mark.asyncio
    async def test_service_startup_order(self, manager):
        """Test that services start in priority order."""
        service1 = MockService("high_priority")
        service2 = MockService("low_priority")
        
        # Register with different priorities
        manager.register_service(service2, startup_priority=10)
        manager.register_service(service1, startup_priority=1)
        
        # Start all services
        await manager.start_all()
        
        # Both should be started
        assert service1.started
        assert service2.started
        
        # Shutdown
        await manager.stop_all()
        assert service1.stopped
        assert service2.stopped
    
    @pytest.mark.asyncio
    async def test_service_startup_failure_cleanup(self, manager):
        """Test cleanup when service startup fails."""
        good_service = MockService("good_service")
        bad_service = MockService("bad_service", fail_start=True)
        
        manager.register_service(good_service, startup_priority=1)
        manager.register_service(bad_service, startup_priority=2)
        
        # Should fail and cleanup started services
        with pytest.raises(RuntimeError):
            await manager.start_all()
        
        # Good service should be stopped during cleanup
        assert good_service.stopped
    
    @pytest.mark.asyncio
    async def test_health_check_all(self, manager):
        """Test health checking all services."""
        healthy_service = MockService("healthy")
        unhealthy_service = MockService("unhealthy", fail_health=True)
        
        manager.register_service(healthy_service)
        manager.register_service(unhealthy_service)
        
        await manager.start_all()
        
        health_results = await manager.health_check_all()
        
        assert len(health_results) == 2
        assert health_results["healthy"].healthy
        assert not health_results["unhealthy"].healthy
        
        await manager.stop_all()


class TestQAService:
    """Test the QA service implementation."""
    
    @pytest.fixture
    def qa_config(self):
        """QA service configuration for testing."""
        return {
            'primary_provider': 'ollama',
            'fallback_providers': ['google_genai'],
            'max_concurrent_requests': 5,
            'conversation_timeout': 3600,
            'default_timeout': 30.0,
            'health_check_interval': 0  # Disable for testing
        }
    
    @pytest.mark.asyncio
    async def test_qa_service_initialization(self, qa_config):
        """Test QA service initialization."""
        service = QAService(qa_config)
        
        assert service.name == "qa_service"
        assert service.primary_provider == "ollama"
        assert service.max_concurrent_requests == 5
    
    @pytest.mark.asyncio
    async def test_qa_service_metrics(self, qa_config):
        """Test QA service metrics collection."""
        service = QAService(qa_config)
        
        metrics = service.get_metrics()
        
        expected_keys = [
            'request_count', 'success_count', 'error_count',
            'success_rate', 'average_processing_time', 'active_conversations',
            'uptime'
        ]
        
        for key in expected_keys:
            assert key in metrics
        
        assert metrics['request_count'] == 0
        assert metrics['success_count'] == 0


class TestDatabaseService:
    """Test the database service implementation."""
    
    @pytest.fixture
    def db_config(self):
        """Database service configuration for testing."""
        return {
            'neo4j_uri': 'bolt://localhost:7687',
            'neo4j_username': 'neo4j',
            'neo4j_password': 'password',
            'max_connection_pool_size': 10,
            'health_check_interval': 0  # Disable for testing
        }
    
    @pytest.mark.asyncio
    async def test_database_service_initialization(self, db_config):
        """Test database service initialization."""
        service = DatabaseService(db_config)
        
        assert service.name == "database_service"
        assert service.uri == "bolt://localhost:7687"
        assert service.max_connection_pool_size == 10
    
    @pytest.mark.asyncio
    async def test_database_service_metrics(self, db_config):
        """Test database service metrics collection."""
        service = DatabaseService(db_config)
        
        metrics = service.get_metrics()
        
        expected_keys = [
            'query_count', 'success_count', 'error_count',
            'success_rate', 'average_query_time', 'active_connections',
            'uptime', 'pool_metrics'
        ]
        
        for key in expected_keys:
            assert key in metrics


class TestCacheService:
    """Test the cache service implementation."""
    
    @pytest.fixture
    def cache_config(self):
        """Cache service configuration for testing."""
        return {
            'backend': 'memory',  # Use memory backend for testing
            'default_ttl': 3600,
            'max_memory_entries': 1000,
            'health_check_interval': 0  # Disable for testing
        }
    
    @pytest.mark.asyncio
    async def test_cache_service_initialization(self, cache_config):
        """Test cache service initialization."""
        service = CacheService(cache_config)
        
        assert service.name == "cache_service"
        assert service.backend == CacheBackend.MEMORY
        assert service.default_ttl == 3600
    
    @pytest.mark.asyncio
    async def test_cache_operations(self, cache_config):
        """Test basic cache operations."""
        service = CacheService(cache_config)
        await service.startup()
        
        try:
            # Test set/get
            await service.set("test_key", {"data": "test_value"}, ttl=60)
            value = await service.get("test_key")
            assert value == {"data": "test_value"}
            
            # Test exists
            assert await service.exists("test_key")
            assert not await service.exists("nonexistent_key")
            
            # Test delete
            await service.delete("test_key")
            value = await service.get("test_key")
            assert value is None
            
        finally:
            await service.shutdown()
    
    @pytest.mark.asyncio
    async def test_cache_service_metrics(self, cache_config):
        """Test cache service metrics collection."""
        service = CacheService(cache_config)
        
        metrics = service.get_metrics()
        
        expected_keys = [
            'backend', 'memory_entries', 'hit_count', 'miss_count',
            'set_count', 'delete_count', 'hit_rate', 'uptime'
        ]
        
        for key in expected_keys:
            assert key in metrics


class TestDependencies:
    """Test FastAPI dependency functions."""
    
    def test_get_config(self):
        """Test configuration dependency."""
        config = get_config()
        
        assert isinstance(config, AppConfig)
        assert hasattr(config, 'host')
        assert hasattr(config, 'port')
        assert hasattr(config, 'primary_llm_provider')
    
    @pytest.mark.asyncio
    async def test_request_context(self):
        """Test request context dependency."""
        context = await get_request_context()
        
        assert isinstance(context, RequestContext)
        assert context.request_id is not None
        assert context.start_time > 0
        assert isinstance(context.metadata, dict)
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        """Test rate limiting dependency."""
        from dependencies import RateLimiter
        
        limiter = RateLimiter(requests_per_minute=2)
        
        # First two requests should pass
        assert await limiter.check_rate_limit("test_user")
        assert await limiter.check_rate_limit("test_user")
        
        # Third request should be limited
        assert not await limiter.check_rate_limit("test_user")


class TestIntegration:
    """Integration tests for the dependency injection system."""
    
    @pytest.mark.asyncio
    async def test_service_initialization_integration(self):
        """Test complete service initialization flow."""
        config = AppConfig(
            # Override settings for testing
            neo4j_uri="bolt://localhost:7687",
            cache_backend="memory",
            health_check_interval=0,
            service_startup_timeout=10.0
        )
        
        # Mock the QA pipeline creation since we don't have actual services
        with patch('services.qa_service.create_qa_pipeline') as mock_create:
            mock_pipeline = Mock()
            mock_pipeline.process_question = Mock(return_value={"answer": "test"})
            mock_create.return_value = mock_pipeline
            
            # Mock Neo4j driver
            with patch('services.database_service.AsyncGraphDatabase') as mock_neo4j:
                mock_driver = AsyncMock()
                mock_neo4j.driver.return_value = mock_driver
                
                # Mock session and results for connectivity test
                mock_session = AsyncMock()
                mock_result = AsyncMock()
                mock_record = {'status': 'Connection successful'}
                mock_result.single.return_value = mock_record
                mock_session.run.return_value = mock_result
                mock_driver.session.return_value.__aenter__.return_value = mock_session
                
                try:
                    # Initialize services
                    manager = await initialize_services(config)
                    
                    # Verify services are registered and running
                    assert len(manager) == 3  # QA, Database, Cache
                    
                    qa_service = manager.get_service_by_type(QAService)
                    db_service = manager.get_service_by_type(DatabaseService)
                    cache_service = manager.get_service_by_type(CacheService)
                    
                    assert qa_service is not None
                    assert db_service is not None
                    assert cache_service is not None
                    
                    # Test service health
                    health_results = await manager.health_check_all()
                    assert len(health_results) == 3
                    
                finally:
                    # Cleanup
                    await shutdown_services()


class TestFastAPIIntegration:
    """Test FastAPI integration with dependency injection."""
    
    @pytest.fixture
    def test_app(self):
        """Create a test FastAPI app with minimal dependencies."""
        from fastapi import FastAPI
        
        app = FastAPI()
        
        @app.get("/test-config")
        async def test_config_endpoint(config: AppConfig = Depends(get_config)):
            return {"host": config.host, "port": config.port}
        
        @app.get("/test-context")
        async def test_context_endpoint(context: RequestContext = Depends(get_request_context)):
            return {"request_id": context.request_id}
        
        return app
    
    def test_config_dependency_endpoint(self, test_app):
        """Test config dependency in FastAPI endpoint."""
        with TestClient(test_app) as client:
            response = client.get("/test-config")
            assert response.status_code == 200
            data = response.json()
            assert "host" in data
            assert "port" in data
    
    def test_context_dependency_endpoint(self, test_app):
        """Test request context dependency in FastAPI endpoint."""
        with TestClient(test_app) as client:
            response = client.get("/test-context")
            assert response.status_code == 200
            data = response.json()
            assert "request_id" in data
            assert data["request_id"] is not None


# Performance and load testing helpers

class TestPerformance:
    """Performance tests for the dependency injection system."""
    
    @pytest.mark.asyncio
    async def test_service_manager_performance(self):
        """Test service manager performance with many services."""
        manager = ServiceManager()
        
        # Register many services
        services = []
        for i in range(100):
            service = MockService(f"service_{i}")
            services.append(service)
            manager.register_service(service, startup_priority=i)
        
        # Time startup
        start_time = time.time()
        await manager.start_all()
        startup_time = time.time() - start_time
        
        # Should start reasonably quickly (less than 1 second for 100 mock services)
        assert startup_time < 1.0
        
        # Verify all started
        assert all(service.started for service in services)
        
        # Time shutdown
        start_time = time.time()
        await manager.stop_all()
        shutdown_time = time.time() - start_time
        
        # Should stop reasonably quickly
        assert shutdown_time < 1.0
        
        # Verify all stopped
        assert all(service.stopped for service in services)
    
    @pytest.mark.asyncio
    async def test_cache_performance(self):
        """Test cache service performance."""
        config = {'backend': 'memory', 'max_memory_entries': 10000}
        service = CacheService(config)
        await service.startup()
        
        try:
            # Test many cache operations
            start_time = time.time()
            
            for i in range(1000):
                await service.set(f"key_{i}", f"value_{i}")
            
            set_time = time.time() - start_time
            
            start_time = time.time()
            
            for i in range(1000):
                value = await service.get(f"key_{i}")
                assert value == f"value_{i}"
            
            get_time = time.time() - start_time
            
            # Operations should be reasonably fast
            assert set_time < 1.0  # 1000 sets in less than 1 second
            assert get_time < 1.0  # 1000 gets in less than 1 second
            
        finally:
            await service.shutdown()


if __name__ == "__main__":
    pytest.main([__file__]) 