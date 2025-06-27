"""
Base Service Classes and Service Manager

This module provides the foundation for all services in the dependency injection system.
It includes base classes, lifecycle management, and a centralized service manager.
"""

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Type, TypeVar, Generic, List
from contextlib import asynccontextmanager
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

T = TypeVar('T', bound='BaseService')


class ServiceStatus(Enum):
    """Service lifecycle status."""
    INITIALIZED = "initialized"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    STOPPED = "stopped"
    ERROR = "error"


@dataclass
class ServiceHealth:
    """Service health information."""
    status: ServiceStatus
    healthy: bool
    last_check: float
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class BaseService(ABC):
    """
    Abstract base class for all services in the dependency injection system.
    
    Provides lifecycle management, health checking, and common service patterns.
    """

    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None):
        self.name = name
        self.config = config or {}
        self.status = ServiceStatus.INITIALIZED
        self.start_time: Optional[float] = None
        self.error_message: Optional[str] = None
        self._health_check_interval = self.config.get('health_check_interval', 30.0)
        self._health_check_task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()

    @abstractmethod
    async def start(self) -> None:
        """Start the service. Must be implemented by subclasses."""
        pass

    @abstractmethod
    async def stop(self) -> None:
        """Stop the service. Must be implemented by subclasses."""
        pass

    @abstractmethod
    async def health_check(self) -> ServiceHealth:
        """Check service health. Must be implemented by subclasses."""
        pass

    async def startup(self) -> None:
        """Initialize and start the service."""
        try:
            logger.info(f"Starting service: {self.name}")
            self.status = ServiceStatus.STARTING
            self.start_time = time.time()
            
            await self.start()
            
            self.status = ServiceStatus.RUNNING
            self.error_message = None
            
            # Start health check monitoring
            if self._health_check_interval > 0:
                self._health_check_task = asyncio.create_task(self._health_check_loop())
            
            logger.info(f"Service started successfully: {self.name}")
            
        except Exception as e:
            self.status = ServiceStatus.ERROR
            self.error_message = str(e)
            logger.error(f"Failed to start service {self.name}: {e}")
            raise

    async def shutdown(self) -> None:
        """Stop the service and clean up resources."""
        try:
            logger.info(f"Stopping service: {self.name}")
            self.status = ServiceStatus.STOPPING
            
            # Signal shutdown to health check loop
            self._shutdown_event.set()
            
            # Cancel health check task
            if self._health_check_task and not self._health_check_task.done():
                self._health_check_task.cancel()
                try:
                    await self._health_check_task
                except asyncio.CancelledError:
                    pass
            
            await self.stop()
            
            self.status = ServiceStatus.STOPPED
            logger.info(f"Service stopped successfully: {self.name}")
            
        except Exception as e:
            self.status = ServiceStatus.ERROR
            self.error_message = str(e)
            logger.error(f"Failed to stop service {self.name}: {e}")
            raise

    async def _health_check_loop(self) -> None:
        """Background task for periodic health checks."""
        while not self._shutdown_event.is_set():
            try:
                await asyncio.sleep(self._health_check_interval)
                if self._shutdown_event.is_set():
                    break
                    
                health = await self.health_check()
                if not health.healthy:
                    logger.warning(f"Service {self.name} health check failed: {health.error_message}")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error for service {self.name}: {e}")

    def get_uptime(self) -> float:
        """Get service uptime in seconds."""
        if self.start_time is None:
            return 0.0
        return time.time() - self.start_time

    def is_healthy(self) -> bool:
        """Quick health check without async call."""
        return self.status == ServiceStatus.RUNNING and self.error_message is None


class ServiceManager:
    """
    Centralized service manager for dependency injection.
    
    Manages service lifecycle, dependencies, and provides a registry for all services.
    """

    def __init__(self):
        self._services: Dict[str, BaseService] = {}
        self._service_types: Dict[Type[BaseService], str] = {}
        self._startup_order: List[str] = []
        self._shutdown_order: List[str] = []
        self._started = False

    def register_service(self, service: BaseService, startup_priority: int = 0) -> None:
        """
        Register a service with the manager.
        
        Args:
            service: Service instance to register
            startup_priority: Priority for startup order (lower numbers start first)
        """
        if service.name in self._services:
            raise ValueError(f"Service {service.name} is already registered")
        
        self._services[service.name] = service
        self._service_types[type(service)] = service.name
        
        # Insert service in startup order based on priority
        inserted = False
        for i, existing_name in enumerate(self._startup_order):
            existing_priority = getattr(self._services[existing_name], '_startup_priority', 0)
            if startup_priority < existing_priority:
                self._startup_order.insert(i, service.name)
                inserted = True
                break
        
        if not inserted:
            self._startup_order.append(service.name)
        
        # Shutdown order is reverse of startup order
        self._shutdown_order = list(reversed(self._startup_order))
        
        # Store priority for future reference
        service._startup_priority = startup_priority
        
        logger.info(f"Registered service: {service.name} (priority: {startup_priority})")

    def get_service(self, name: str) -> Optional[BaseService]:
        """Get a service by name."""
        return self._services.get(name)

    def get_service_by_type(self, service_type: Type[T]) -> Optional[T]:
        """Get a service by type."""
        service_name = self._service_types.get(service_type)
        if service_name:
            return self._services.get(service_name)
        return None

    async def start_all(self) -> None:
        """Start all registered services in dependency order."""
        if self._started:
            logger.warning("Services are already started")
            return
        
        logger.info("Starting all services...")
        
        for service_name in self._startup_order:
            service = self._services[service_name]
            try:
                await service.startup()
            except Exception as e:
                logger.error(f"Failed to start service {service_name}: {e}")
                # Try to stop any services that were started
                await self._stop_started_services(service_name)
                raise
        
        self._started = True
        logger.info("All services started successfully")

    async def stop_all(self) -> None:
        """Stop all services in reverse dependency order."""
        if not self._started:
            logger.warning("Services are not started")
            return
        
        logger.info("Stopping all services...")
        
        for service_name in self._shutdown_order:
            service = self._services[service_name]
            try:
                await service.shutdown()
            except Exception as e:
                logger.error(f"Failed to stop service {service_name}: {e}")
                # Continue stopping other services
        
        self._started = False
        logger.info("All services stopped")

    async def _stop_started_services(self, failed_service_name: str) -> None:
        """Stop services that were started before a failure occurred."""
        failed_index = self._startup_order.index(failed_service_name)
        
        # Stop services in reverse order up to the failed service
        for i in range(failed_index - 1, -1, -1):
            service_name = self._startup_order[i]
            service = self._services[service_name]
            try:
                await service.shutdown()
            except Exception as e:
                logger.error(f"Failed to stop service {service_name} during cleanup: {e}")

    async def health_check_all(self) -> Dict[str, ServiceHealth]:
        """Get health status for all services."""
        health_results = {}
        
        for service_name, service in self._services.items():
            try:
                health = await service.health_check()
                health_results[service_name] = health
            except Exception as e:
                health_results[service_name] = ServiceHealth(
                    status=ServiceStatus.ERROR,
                    healthy=False,
                    last_check=time.time(),
                    error_message=str(e)
                )
        
        return health_results

    def get_service_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status information for all services."""
        status_info = {}
        
        for service_name, service in self._services.items():
            status_info[service_name] = {
                'status': service.status.value,
                'healthy': service.is_healthy(),
                'uptime': service.get_uptime(),
                'error_message': service.error_message,
                'config': service.config
            }
        
        return status_info

    @asynccontextmanager
    async def lifespan(self):
        """Async context manager for service lifecycle."""
        try:
            await self.start_all()
            yield self
        finally:
            await self.stop_all()

    def __len__(self) -> int:
        """Get number of registered services."""
        return len(self._services)

    def __contains__(self, service_name: str) -> bool:
        """Check if a service is registered."""
        return service_name in self._services


# Global service manager instance
service_manager = ServiceManager() 