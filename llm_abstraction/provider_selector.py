"""
Advanced Provider Selection Logic for LLM Abstraction Layer.

This module implements sophisticated provider selection with health monitoring,
metrics tracking, and multiple selection policies.
"""

import logging
import time
import threading
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any, Callable
from datetime import datetime, timedelta

try:
    from .providers import BaseLLMProvider, create_provider
    from .config import LLMConfig, ProviderConfig
except ImportError:
    from providers import BaseLLMProvider, create_provider
    from config import LLMConfig, ProviderConfig

logger = logging.getLogger(__name__)


class SelectionPolicy(Enum):
    """Provider selection policies."""
    FAILOVER = "failover"  # Use primary, fallback on failure
    ROUND_ROBIN = "round_robin"  # Rotate between available providers
    LOWEST_LATENCY = "lowest_latency"  # Select provider with lowest average latency
    LOWEST_COST = "lowest_cost"  # Select provider with lowest cost per token
    LOAD_BALANCE = "load_balance"  # Balance load across providers
    BEST_HEALTH = "best_health"  # Select provider with best health metrics


@dataclass
class ProviderMetrics:
    """Metrics for a provider."""
    request_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    total_latency: float = 0.0
    total_tokens: int = 0
    total_cost: float = 0.0
    last_request_time: Optional[datetime] = None
    health_score: float = 1.0
    recent_latencies: deque = field(default_factory=lambda: deque(maxlen=50))
    recent_errors: deque = field(default_factory=lambda: deque(maxlen=20))
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.request_count == 0:
            return 1.0
        return self.success_count / self.request_count
    
    @property
    def average_latency(self) -> float:
        """Calculate average latency."""
        if self.success_count == 0:
            return float('inf')
        return self.total_latency / self.success_count
    
    @property
    def cost_per_token(self) -> float:
        """Calculate cost per token."""
        if self.total_tokens == 0:
            return 0.0
        return self.total_cost / self.total_tokens
    
    @property
    def recent_average_latency(self) -> float:
        """Calculate recent average latency."""
        if not self.recent_latencies:
            return float('inf')
        return sum(self.recent_latencies) / len(self.recent_latencies)


@dataclass
class HealthStatus:
    """Health status of a provider."""
    is_healthy: bool = True
    last_check: Optional[datetime] = None
    consecutive_failures: int = 0
    last_error: Optional[str] = None
    uptime_percentage: float = 100.0


class BaseSelectionStrategy(ABC):
    """Base class for provider selection strategies."""
    
    @abstractmethod
    def select_provider(
        self,
        providers: Dict[str, BaseLLMProvider],
        metrics: Dict[str, ProviderMetrics],
        health_status: Dict[str, HealthStatus],
        **kwargs
    ) -> Optional[str]:
        """Select a provider based on the strategy."""
        pass


class FailoverStrategy(BaseSelectionStrategy):
    """Primary provider with fallback on failure."""
    
    def __init__(self, primary_provider: str, fallback_providers: List[str]):
        self.primary_provider = primary_provider
        self.fallback_providers = fallback_providers
    
    def select_provider(
        self,
        providers: Dict[str, BaseLLMProvider],
        metrics: Dict[str, ProviderMetrics],
        health_status: Dict[str, HealthStatus],
        **kwargs
    ) -> Optional[str]:
        # Try primary first
        if (self.primary_provider in providers and 
            health_status[self.primary_provider].is_healthy):
            return self.primary_provider
        
        # Try fallbacks
        for provider_name in self.fallback_providers:
            if (provider_name in providers and 
                health_status[provider_name].is_healthy):
                return provider_name
        
        return None


class RoundRobinStrategy(BaseSelectionStrategy):
    """Round-robin selection among healthy providers."""
    
    def __init__(self):
        self._last_index = -1
        self._lock = threading.Lock()
    
    def select_provider(
        self,
        providers: Dict[str, BaseLLMProvider],
        metrics: Dict[str, ProviderMetrics],
        health_status: Dict[str, HealthStatus],
        **kwargs
    ) -> Optional[str]:
        healthy_providers = [
            name for name, status in health_status.items()
            if status.is_healthy and name in providers
        ]
        
        if not healthy_providers:
            return None
        
        with self._lock:
            self._last_index = (self._last_index + 1) % len(healthy_providers)
            return healthy_providers[self._last_index]


class LowestLatencyStrategy(BaseSelectionStrategy):
    """Select provider with lowest recent average latency."""
    
    def select_provider(
        self,
        providers: Dict[str, BaseLLMProvider],
        metrics: Dict[str, ProviderMetrics],
        health_status: Dict[str, HealthStatus],
        **kwargs
    ) -> Optional[str]:
        healthy_providers = [
            name for name, status in health_status.items()
            if status.is_healthy and name in providers
        ]
        
        if not healthy_providers:
            return None
        
        return min(
            healthy_providers,
            key=lambda name: metrics[name].recent_average_latency
        )


class LowestCostStrategy(BaseSelectionStrategy):
    """Select provider with lowest cost per token."""
    
    def select_provider(
        self,
        providers: Dict[str, BaseLLMProvider],
        metrics: Dict[str, ProviderMetrics],
        health_status: Dict[str, HealthStatus],
        **kwargs
    ) -> Optional[str]:
        healthy_providers = [
            name for name, status in health_status.items()
            if status.is_healthy and name in providers
        ]
        
        if not healthy_providers:
            return None
        
        return min(
            healthy_providers,
            key=lambda name: metrics[name].cost_per_token
        )


class LoadBalanceStrategy(BaseSelectionStrategy):
    """Balance load based on recent request counts."""
    
    def select_provider(
        self,
        providers: Dict[str, BaseLLMProvider],
        metrics: Dict[str, ProviderMetrics],
        health_status: Dict[str, HealthStatus],
        **kwargs
    ) -> Optional[str]:
        healthy_providers = [
            name for name, status in health_status.items()
            if status.is_healthy and name in providers
        ]
        
        if not healthy_providers:
            return None
        
        # Select provider with lowest recent load
        current_time = datetime.now()
        recent_window = timedelta(minutes=5)
        
        provider_loads = {}
        for name in healthy_providers:
            metric = metrics[name]
            if (metric.last_request_time and 
                current_time - metric.last_request_time < recent_window):
                provider_loads[name] = metric.request_count
            else:
                provider_loads[name] = 0
        
        return min(provider_loads, key=provider_loads.get)


class BestHealthStrategy(BaseSelectionStrategy):
    """Select provider with best overall health score."""
    
    def select_provider(
        self,
        providers: Dict[str, BaseLLMProvider],
        metrics: Dict[str, ProviderMetrics],
        health_status: Dict[str, HealthStatus],
        **kwargs
    ) -> Optional[str]:
        healthy_providers = [
            name for name, status in health_status.items()
            if status.is_healthy and name in providers
        ]
        
        if not healthy_providers:
            return None
        
        return max(
            healthy_providers,
            key=lambda name: metrics[name].health_score
        )


class ProviderSelector:
    """Advanced provider selector with health monitoring and multiple strategies."""
    
    def __init__(
        self,
        config: LLMConfig,
        selection_policy: SelectionPolicy = SelectionPolicy.FAILOVER,
        health_check_interval: int = 60,
        max_consecutive_failures: int = 3,
        cost_estimator: Optional[Callable[[str, int], float]] = None
    ):
        """
        Initialize the provider selector.
        
        Args:
            config: LLM configuration
            selection_policy: Selection policy to use
            health_check_interval: Health check interval in seconds
            max_consecutive_failures: Max failures before marking unhealthy
            cost_estimator: Optional function to estimate cost per provider
        """
        self.config = config
        self.selection_policy = selection_policy
        self.health_check_interval = health_check_interval
        self.max_consecutive_failures = max_consecutive_failures
        self.cost_estimator = cost_estimator or self._default_cost_estimator
        
        # Initialize providers
        self.providers: Dict[str, BaseLLMProvider] = {}
        self.metrics: Dict[str, ProviderMetrics] = defaultdict(ProviderMetrics)
        self.health_status: Dict[str, HealthStatus] = defaultdict(HealthStatus)
        
        # Initialize strategy
        self.strategy = self._create_strategy()
        
        # Health monitoring
        self._health_check_thread = None
        self._stop_health_check = threading.Event()
        self._lock = threading.RLock()
        
        self._initialize_providers()
        self._start_health_monitoring()
    
    def _initialize_providers(self):
        """Initialize all configured providers."""
        for provider_enum, provider_config in self.config.providers.items():
            try:
                # Convert enum to string for consistent provider naming
                provider_name = provider_enum.value if hasattr(provider_enum, 'value') else str(provider_enum)
                
                # Get the default model for this provider
                default_model = next(iter(provider_config.models.keys()))
                provider = create_provider(provider_config, default_model)
                self.providers[provider_name] = provider
                logger.info(f"Initialized provider: {provider_name}")
            except Exception as e:
                provider_name = provider_enum.value if hasattr(provider_enum, 'value') else str(provider_enum)
                logger.error(f"Failed to initialize provider {provider_name}: {e}")
                self.health_status[provider_name].is_healthy = False
                self.health_status[provider_name].last_error = str(e)
    
    def _create_strategy(self) -> BaseSelectionStrategy:
        """Create the selection strategy based on policy."""
        if self.selection_policy == SelectionPolicy.FAILOVER:
            # Convert enums to strings for strategy
            primary = self.config.primary_provider.value if hasattr(self.config.primary_provider, 'value') else str(self.config.primary_provider)
            fallbacks = [
                p.value if hasattr(p, 'value') else str(p) 
                for p in self.config.fallback_providers
            ]
            return FailoverStrategy(
                primary_provider=primary,
                fallback_providers=fallbacks
            )
        elif self.selection_policy == SelectionPolicy.ROUND_ROBIN:
            return RoundRobinStrategy()
        elif self.selection_policy == SelectionPolicy.LOWEST_LATENCY:
            return LowestLatencyStrategy()
        elif self.selection_policy == SelectionPolicy.LOWEST_COST:
            return LowestCostStrategy()
        elif self.selection_policy == SelectionPolicy.LOAD_BALANCE:
            return LoadBalanceStrategy()
        elif self.selection_policy == SelectionPolicy.BEST_HEALTH:
            return BestHealthStrategy()
        else:
            raise ValueError(f"Unknown selection policy: {self.selection_policy}")
    
    def _start_health_monitoring(self):
        """Start background health monitoring."""
        if self.health_check_interval > 0:
            self._health_check_thread = threading.Thread(
                target=self._health_check_loop,
                daemon=True
            )
            self._health_check_thread.start()
            logger.info("Started health monitoring")
    
    def _health_check_loop(self):
        """Background health check loop."""
        while not self._stop_health_check.wait(self.health_check_interval):
            try:
                self._perform_health_checks()
            except Exception as e:
                logger.error(f"Error in health check loop: {e}")
    
    def _perform_health_checks(self):
        """Perform health checks on all providers."""
        with self._lock:
            for provider_name, provider in self.providers.items():
                try:
                    is_available = provider.is_available()
                    status = self.health_status[provider_name]
                    
                    if is_available:
                        status.is_healthy = True
                        status.consecutive_failures = 0
                        status.last_error = None
                    else:
                        status.consecutive_failures += 1
                        if status.consecutive_failures >= self.max_consecutive_failures:
                            status.is_healthy = False
                            status.last_error = "Health check failed"
                    
                    status.last_check = datetime.now()
                    
                except Exception as e:
                    status = self.health_status[provider_name]
                    status.consecutive_failures += 1
                    status.last_error = str(e)
                    
                    if status.consecutive_failures >= self.max_consecutive_failures:
                        status.is_healthy = False
                    
                    status.last_check = datetime.now()
                    logger.warning(f"Health check failed for {provider_name}: {e}")
    
    def _default_cost_estimator(self, provider_name: str, token_count: int) -> float:
        """Default cost estimation (placeholder)."""
        # This is a simplified cost model - in practice, you'd want
        # provider-specific pricing
        cost_per_1k_tokens = {
            "ollama": 0.0,  # Local model, no cost
            "azure_openai": 0.002,  # Example pricing
            "google_genai": 0.001,  # Example pricing
        }
        
        rate = cost_per_1k_tokens.get(provider_name, 0.002)
        return (token_count / 1000) * rate
    
    def select_provider(self, **kwargs) -> Optional[BaseLLMProvider]:
        """
        Select the best provider based on the current strategy.
        
        Returns:
            Selected provider instance or None if no healthy providers
        """
        with self._lock:
            provider_name = self.strategy.select_provider(
                self.providers,
                self.metrics,
                self.health_status,
                **kwargs
            )
            
            if provider_name:
                return self.providers[provider_name]
            
            logger.warning("No healthy providers available")
            return None
    
    def record_request(
        self,
        provider_name: str,
        latency: float,
        success: bool,
        token_count: int = 0,
        error: Optional[str] = None
    ):
        """
        Record metrics for a request.
        
        Args:
            provider_name: Name of the provider
            latency: Request latency in seconds
            success: Whether the request was successful
            token_count: Number of tokens processed
            error: Error message if request failed
        """
        with self._lock:
            metrics = self.metrics[provider_name]
            metrics.request_count += 1
            metrics.last_request_time = datetime.now()
            
            if success:
                metrics.success_count += 1
                metrics.total_latency += latency
                metrics.recent_latencies.append(latency)
                metrics.total_tokens += token_count
                metrics.total_cost += self.cost_estimator(provider_name, token_count)
            else:
                metrics.failure_count += 1
                if error:
                    metrics.recent_errors.append({
                        'timestamp': datetime.now(),
                        'error': error
                    })
            
            # Update health score based on recent performance
            self._update_health_score(provider_name)
    
    def _update_health_score(self, provider_name: str):
        """Update health score based on recent metrics."""
        metrics = self.metrics[provider_name]
        
        if metrics.request_count == 0:
            return
        
        # Calculate health score based on success rate and latency
        success_rate = metrics.success_rate
        
        # Penalize high latency
        latency_penalty = 0.0
        if metrics.recent_latencies:
            avg_latency = sum(metrics.recent_latencies) / len(metrics.recent_latencies)
            # Penalize latencies > 10 seconds
            if avg_latency > 10.0:
                latency_penalty = min(0.5, (avg_latency - 10.0) / 20.0)
        
        health_score = success_rate - latency_penalty
        metrics.health_score = max(0.0, min(1.0, health_score))
    
    def get_metrics_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get a summary of all provider metrics."""
        with self._lock:
            summary = {}
            for provider_name, metrics in self.metrics.items():
                summary[provider_name] = {
                    'request_count': metrics.request_count,
                    'success_rate': metrics.success_rate,
                    'average_latency': metrics.average_latency,
                    'recent_average_latency': metrics.recent_average_latency,
                    'cost_per_token': metrics.cost_per_token,
                    'total_cost': metrics.total_cost,
                    'health_score': metrics.health_score,
                    'is_healthy': self.health_status[provider_name].is_healthy,
                    'last_check': self.health_status[provider_name].last_check,
                    'consecutive_failures': self.health_status[provider_name].consecutive_failures,
                }
            return summary
    
    def get_provider_by_name(self, provider_name: str) -> Optional[BaseLLMProvider]:
        """Get a specific provider by name."""
        return self.providers.get(provider_name)
    
    def get_healthy_providers(self) -> List[str]:
        """Get list of currently healthy provider names."""
        with self._lock:
            healthy = []
            for name, status in self.health_status.items():
                if status.is_healthy and name in self.providers:
                    healthy.append(name)
            return healthy
    
    def reset_metrics(self, provider: Optional[str] = None):
        """Reset metrics for a specific provider or all providers."""
        with self._lock:
            if provider:
                if provider in self.metrics:
                    self.metrics[provider] = ProviderMetrics()
            else:
                for name in self.metrics:
                    self.metrics[name] = ProviderMetrics()
    
    def shutdown(self):
        """Shutdown the provider selector and stop health monitoring."""
        self._stop_health_check.set()
        if self._health_check_thread:
            self._health_check_thread.join(timeout=5)
        logger.info("Provider selector shutdown complete") 