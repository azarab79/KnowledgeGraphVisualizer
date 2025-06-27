"""
Cache Service for Application Caching

This service provides caching functionality with support for both Redis and in-memory
storage, with automatic fallback and TTL management.
"""

import asyncio
import logging
import time
import json
import hashlib
from typing import Dict, Any, Optional, Union, List
from dataclasses import dataclass
from enum import Enum

from .base import BaseService, ServiceHealth, ServiceStatus

logger = logging.getLogger(__name__)

# Optional Redis import - service will use in-memory cache if Redis is unavailable
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_AVAILABLE = False


class CacheBackend(Enum):
    """Cache backend types."""
    MEMORY = "memory"
    REDIS = "redis"
    HYBRID = "hybrid"


@dataclass
class CacheEntry:
    """Cache entry with metadata."""
    value: Any
    timestamp: float
    ttl: Optional[float] = None
    access_count: int = 0
    last_access: float = 0.0

    def is_expired(self) -> bool:
        """Check if the cache entry has expired."""
        if self.ttl is None:
            return False
        return time.time() - self.timestamp > self.ttl

    def update_access(self):
        """Update access statistics."""
        self.access_count += 1
        self.last_access = time.time()


class CacheService(BaseService):
    """
    Cache service providing Redis and in-memory caching capabilities.
    
    Supports automatic fallback from Redis to in-memory cache, TTL management,
    and cache statistics.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__("cache_service", config)
        
        # Configuration
        self.backend = CacheBackend(self.config.get('backend', 'hybrid'))
        self.redis_url = self.config.get('redis_url', 'redis://localhost:6379')
        self.redis_db = self.config.get('redis_db', 0)
        self.redis_password = self.config.get('redis_password')
        self.default_ttl = self.config.get('default_ttl', 3600)  # 1 hour
        self.max_memory_entries = self.config.get('max_memory_entries', 10000)
        self.cleanup_interval = self.config.get('cleanup_interval', 300)  # 5 minutes
        
        # Service state
        self._redis_client: Optional[redis.Redis] = None
        self._memory_cache: Dict[str, CacheEntry] = {}
        self._cache_lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None
        self._redis_available = False
        
        # Metrics
        self._hit_count = 0
        self._miss_count = 0
        self._set_count = 0
        self._delete_count = 0
        self._memory_hits = 0
        self._redis_hits = 0
        self._eviction_count = 0

    async def start(self) -> None:
        """Start the cache service."""
        logger.info(f"Starting cache service with backend: {self.backend.value}")
        
        # Initialize Redis if configured
        if self.backend in [CacheBackend.REDIS, CacheBackend.HYBRID] and REDIS_AVAILABLE:
            await self._initialize_redis()
        
        # Start cleanup task for memory cache
        self._cleanup_task = asyncio.create_task(self._cleanup_memory_cache())
        
        logger.info("Cache service started successfully")

    async def stop(self) -> None:
        """Stop the cache service."""
        logger.info("Stopping cache service...")
        
        # Cancel cleanup task
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Close Redis connection
        if self._redis_client:
            await self._redis_client.close()
            self._redis_client = None
        
        # Clear memory cache
        async with self._cache_lock:
            self._memory_cache.clear()
        
        logger.info("Cache service stopped successfully")

    async def health_check(self) -> ServiceHealth:
        """Check cache service health."""
        try:
            metadata = {
                'backend': self.backend.value,
                'redis_available': self._redis_available,
                'memory_entries': len(self._memory_cache),
                'hit_rate': self._hit_count / max(1, self._hit_count + self._miss_count),
                'total_operations': self._hit_count + self._miss_count + self._set_count + self._delete_count
            }
            
            # Test cache operations
            test_key = "health_check"
            test_value = {"timestamp": time.time()}
            
            await self.set(test_key, test_value, ttl=10)
            retrieved = await self.get(test_key)
            await self.delete(test_key)
            
            if retrieved != test_value:
                return ServiceHealth(
                    status=self.status,
                    healthy=False,
                    last_check=time.time(),
                    error_message="Cache operations test failed",
                    metadata=metadata
                )
            
            return ServiceHealth(
                status=self.status,
                healthy=True,
                last_check=time.time(),
                metadata=metadata
            )
            
        except Exception as e:
            return ServiceHealth(
                status=ServiceStatus.ERROR,
                healthy=False,
                last_check=time.time(),
                error_message=str(e)
            )

    async def _initialize_redis(self) -> None:
        """Initialize Redis connection."""
        try:
            logger.info(f"Connecting to Redis at {self.redis_url}")
            
            # Parse Redis URL and create client
            redis_kwargs = {
                'db': self.redis_db,
                'decode_responses': True,
                'socket_timeout': 5.0,
                'socket_connect_timeout': 5.0,
                'retry_on_timeout': True
            }
            
            if self.redis_password:
                redis_kwargs['password'] = self.redis_password
            
            self._redis_client = redis.from_url(self.redis_url, **redis_kwargs)
            
            # Test connection
            await self._redis_client.ping()
            self._redis_available = True
            
            logger.info("Redis connection established successfully")
            
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            self._redis_available = False
            self._redis_client = None
            
            if self.backend == CacheBackend.REDIS:
                raise RuntimeError(f"Redis backend required but unavailable: {e}")

    async def get(self, key: str) -> Any:
        """
        Get a value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found
        """
        # Try Redis first if available
        if self._redis_available and self._redis_client:
            try:
                value = await self._redis_client.get(key)
                if value is not None:
                    self._hit_count += 1
                    self._redis_hits += 1
                    logger.debug(f"Cache hit (Redis): {key}")
                    return json.loads(value)
            except Exception as e:
                logger.warning(f"Redis get error for key {key}: {e}")
                self._redis_available = False
        
        # Fallback to memory cache
        async with self._cache_lock:
            if key in self._memory_cache:
                entry = self._memory_cache[key]
                
                if entry.is_expired():
                    del self._memory_cache[key]
                    self._miss_count += 1
                    logger.debug(f"Cache miss (expired): {key}")
                    return None
                
                entry.update_access()
                self._hit_count += 1
                self._memory_hits += 1
                logger.debug(f"Cache hit (memory): {key}")
                return entry.value
        
        self._miss_count += 1
        logger.debug(f"Cache miss: {key}")
        return None

    async def set(self, 
                  key: str, 
                  value: Any, 
                  ttl: Optional[float] = None) -> bool:
        """
        Set a value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            
        Returns:
            True if successful, False otherwise
        """
        ttl = ttl or self.default_ttl
        success = False
        
        # Try Redis first if available
        if self._redis_available and self._redis_client:
            try:
                serialized_value = json.dumps(value)
                await self._redis_client.setex(key, int(ttl), serialized_value)
                success = True
                logger.debug(f"Cache set (Redis): {key}")
            except Exception as e:
                logger.warning(f"Redis set error for key {key}: {e}")
                self._redis_available = False
        
        # Always store in memory cache as backup
        async with self._cache_lock:
            # Check if we need to evict entries
            if len(self._memory_cache) >= self.max_memory_entries:
                await self._evict_memory_entries()
            
            self._memory_cache[key] = CacheEntry(
                value=value,
                timestamp=time.time(),
                ttl=ttl
            )
            success = True
            logger.debug(f"Cache set (memory): {key}")
        
        self._set_count += 1
        return success

    async def delete(self, key: str) -> bool:
        """
        Delete a key from cache.
        
        Args:
            key: Cache key to delete
            
        Returns:
            True if key was deleted, False if not found
        """
        deleted = False
        
        # Delete from Redis if available
        if self._redis_available and self._redis_client:
            try:
                result = await self._redis_client.delete(key)
                deleted = result > 0
                logger.debug(f"Cache delete (Redis): {key}")
            except Exception as e:
                logger.warning(f"Redis delete error for key {key}: {e}")
                self._redis_available = False
        
        # Delete from memory cache
        async with self._cache_lock:
            if key in self._memory_cache:
                del self._memory_cache[key]
                deleted = True
                logger.debug(f"Cache delete (memory): {key}")
        
        if deleted:
            self._delete_count += 1
        
        return deleted

    async def exists(self, key: str) -> bool:
        """
        Check if a key exists in cache.
        
        Args:
            key: Cache key to check
            
        Returns:
            True if key exists, False otherwise
        """
        # Check Redis first if available
        if self._redis_available and self._redis_client:
            try:
                exists = await self._redis_client.exists(key)
                if exists:
                    return True
            except Exception as e:
                logger.warning(f"Redis exists error for key {key}: {e}")
                self._redis_available = False
        
        # Check memory cache
        async with self._cache_lock:
            if key in self._memory_cache:
                entry = self._memory_cache[key]
                if not entry.is_expired():
                    return True
                else:
                    del self._memory_cache[key]
        
        return False

    async def clear(self) -> bool:
        """Clear all cache entries."""
        success = True
        
        # Clear Redis if available
        if self._redis_available and self._redis_client:
            try:
                await self._redis_client.flushdb()
                logger.debug("Cache cleared (Redis)")
            except Exception as e:
                logger.warning(f"Redis clear error: {e}")
                success = False
        
        # Clear memory cache
        async with self._cache_lock:
            self._memory_cache.clear()
            logger.debug("Cache cleared (memory)")
        
        return success

    async def get_cache_key_hash(self, *args, **kwargs) -> str:
        """
        Generate a cache key hash from arguments.
        
        Useful for caching function results.
        """
        key_data = {
            'args': args,
            'kwargs': sorted(kwargs.items())
        }
        key_string = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_string.encode()).hexdigest()

    async def _cleanup_memory_cache(self) -> None:
        """Background task to cleanup expired memory cache entries."""
        while not self._shutdown_event.is_set():
            try:
                current_time = time.time()
                expired_keys = []
                
                async with self._cache_lock:
                    for key, entry in self._memory_cache.items():
                        if entry.is_expired():
                            expired_keys.append(key)
                    
                    for key in expired_keys:
                        del self._memory_cache[key]
                        self._eviction_count += 1
                
                if expired_keys:
                    logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
                
                await asyncio.sleep(self.cleanup_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cache cleanup: {e}")
                await asyncio.sleep(60)

    async def _evict_memory_entries(self) -> None:
        """Evict least recently used entries from memory cache."""
        if len(self._memory_cache) < self.max_memory_entries:
            return
        
        # Sort by last access time and remove oldest entries
        entries_by_access = sorted(
            self._memory_cache.items(),
            key=lambda x: x[1].last_access or x[1].timestamp
        )
        
        # Remove 20% of entries to make room
        evict_count = max(1, len(entries_by_access) // 5)
        
        for key, _ in entries_by_access[:evict_count]:
            del self._memory_cache[key]
            self._eviction_count += 1
        
        logger.debug(f"Evicted {evict_count} cache entries due to size limit")

    def get_metrics(self) -> Dict[str, Any]:
        """Get cache service metrics."""
        total_requests = self._hit_count + self._miss_count
        
        return {
            'backend': self.backend.value,
            'redis_available': self._redis_available,
            'memory_entries': len(self._memory_cache),
            'hit_count': self._hit_count,
            'miss_count': self._miss_count,
            'set_count': self._set_count,
            'delete_count': self._delete_count,
            'hit_rate': self._hit_count / max(1, total_requests),
            'redis_hits': self._redis_hits,
            'memory_hits': self._memory_hits,
            'eviction_count': self._eviction_count,
            'total_operations': total_requests + self._set_count + self._delete_count,
            'uptime': self.get_uptime()
        }

    async def get_cache_info(self) -> Dict[str, Any]:
        """Get detailed cache information."""
        info = {
            'backend': self.backend.value,
            'redis_available': self._redis_available,
            'memory_cache_size': len(self._memory_cache),
            'max_memory_entries': self.max_memory_entries,
            'default_ttl': self.default_ttl,
            'metrics': self.get_metrics()
        }
        
        # Add Redis info if available
        if self._redis_available and self._redis_client:
            try:
                redis_info = await self._redis_client.info('memory')
                info['redis_memory'] = {
                    'used_memory': redis_info.get('used_memory'),
                    'used_memory_human': redis_info.get('used_memory_human'),
                    'maxmemory': redis_info.get('maxmemory')
                }
            except Exception as e:
                logger.warning(f"Failed to get Redis info: {e}")
        
        return info 