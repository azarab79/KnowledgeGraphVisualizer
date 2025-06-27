"""
Database Service for Neo4j Connection Management

This service provides connection pooling, transaction management, and health monitoring
for Neo4j database connections used by the QA pipeline.
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional, List, Union
from contextlib import asynccontextmanager

import neo4j
from neo4j import GraphDatabase, AsyncGraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError, ConfigurationError

from .base import BaseService, ServiceHealth, ServiceStatus

logger = logging.getLogger(__name__)


class DatabaseService(BaseService):
    """
    Database service for Neo4j connection management.
    
    Provides connection pooling, health monitoring, and async database operations
    for the Knowledge Graph QA system.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__("database_service", config)
        
        # Database configuration
        self.uri = self.config.get('neo4j_uri', 'bolt://localhost:7687')
        self.username = self.config.get('neo4j_username', 'neo4j')
        self.password = self.config.get('neo4j_password', 'password')
        self.database = self.config.get('neo4j_database', 'neo4j')
        
        # Connection pool configuration
        self.max_connection_lifetime = self.config.get('max_connection_lifetime', 3600)  # 1 hour
        self.max_connection_pool_size = self.config.get('max_connection_pool_size', 50)
        self.connection_acquisition_timeout = self.config.get('connection_acquisition_timeout', 60)
        self.max_transaction_retry_time = self.config.get('max_transaction_retry_time', 30)
        
        # Service state
        self._driver: Optional[neo4j.AsyncDriver] = None
        self._sync_driver: Optional[neo4j.Driver] = None
        self._connection_semaphore: Optional[asyncio.Semaphore] = None
        
        # Metrics
        self._query_count = 0
        self._success_count = 0
        self._error_count = 0
        self._total_query_time = 0.0
        self._active_connections = 0
        self._last_query_time: Optional[float] = None

    async def start(self) -> None:
        """Start the database service."""
        logger.info(f"Connecting to Neo4j database at {self.uri}")
        
        try:
            # Configure driver options
            driver_config = {
                'max_connection_lifetime': self.max_connection_lifetime,
                'max_connection_pool_size': self.max_connection_pool_size,
                'connection_acquisition_timeout': self.connection_acquisition_timeout,
                'max_transaction_retry_time': self.max_transaction_retry_time,
                'user_agent': 'KnowledgeGraphQA/1.0'
            }
            
            # Create async driver
            self._driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.username, self.password),
                **driver_config
            )
            
            # Create sync driver for compatibility
            self._sync_driver = GraphDatabase.driver(
                self.uri,
                auth=(self.username, self.password),
                **driver_config
            )
            
            # Initialize connection semaphore
            self._connection_semaphore = asyncio.Semaphore(self.max_connection_pool_size)
            
            # Verify connectivity
            await self._verify_connectivity()
            
            logger.info("Database service started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start database service: {e}")
            raise

    async def stop(self) -> None:
        """Stop the database service."""
        logger.info("Stopping database service...")
        
        try:
            # Close async driver
            if self._driver:
                await self._driver.close()
                self._driver = None
            
            # Close sync driver
            if self._sync_driver:
                self._sync_driver.close()
                self._sync_driver = None
            
            logger.info("Database service stopped successfully")
            
        except Exception as e:
            logger.error(f"Error stopping database service: {e}")
            raise

    async def health_check(self) -> ServiceHealth:
        """Check database connectivity and performance."""
        try:
            if not self._driver:
                return ServiceHealth(
                    status=self.status,
                    healthy=False,
                    last_check=time.time(),
                    error_message="Database driver not initialized"
                )
            
            start_time = time.time()
            
            # Simple connectivity test
            try:
                async with self._driver.session(database=self.database) as session:
                    result = await session.run("RETURN 1 as health_check")
                    record = await result.single()
                    assert record["health_check"] == 1
                
                response_time = time.time() - start_time
                
                # Get connection pool metrics
                pool_metrics = self._get_pool_metrics()
                
                return ServiceHealth(
                    status=self.status,
                    healthy=True,
                    last_check=time.time(),
                    metadata={
                        'response_time': response_time,
                        'query_count': self._query_count,
                        'success_rate': self._success_count / max(1, self._query_count),
                        'average_query_time': self._total_query_time / max(1, self._success_count),
                        'active_connections': self._active_connections,
                        'pool_metrics': pool_metrics
                    }
                )
                
            except (ServiceUnavailable, AuthError, ConfigurationError) as e:
                return ServiceHealth(
                    status=ServiceStatus.ERROR,
                    healthy=False,
                    last_check=time.time(),
                    error_message=f"Database error: {e}"
                )
            except asyncio.TimeoutError:
                return ServiceHealth(
                    status=self.status,
                    healthy=False,
                    last_check=time.time(),
                    error_message="Database health check timeout"
                )
                
        except Exception as e:
            return ServiceHealth(
                status=ServiceStatus.ERROR,
                healthy=False,
                last_check=time.time(),
                error_message=str(e)
            )

    async def _verify_connectivity(self) -> None:
        """Verify database connectivity during startup."""
        try:
            async with asyncio.timeout(10.0):  # 10 second timeout for startup
                async with self._driver.session(database=self.database) as session:
                    result = await session.run("RETURN 'Connection successful' as status")
                    record = await result.single()
                    logger.info(f"Database connectivity verified: {record['status']}")
        except Exception as e:
            raise ConnectionError(f"Failed to connect to Neo4j database: {e}")

    async def execute_query(self, 
                          query: str, 
                          parameters: Optional[Dict[str, Any]] = None,
                          timeout: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Execute a Cypher query with connection pooling and metrics.
        
        Args:
            query: Cypher query string
            parameters: Query parameters
            timeout: Query timeout in seconds
            
        Returns:
            List of result records as dictionaries
        """
        if not self._driver:
            raise RuntimeError("Database service not initialized")
        
        async with self._connection_semaphore:
            return await self._execute_query_with_timeout(query, parameters, timeout)

    async def _execute_query_with_timeout(self,
                                        query: str,
                                        parameters: Optional[Dict[str, Any]] = None,
                                        timeout: Optional[float] = None) -> List[Dict[str, Any]]:
        """Execute query with timeout and metrics tracking."""
        
        start_time = time.time()
        self._query_count += 1
        self._last_query_time = start_time
        self._active_connections += 1
        
        try:
            timeout = timeout or self.config.get('default_query_timeout', 30.0)
            
            async with asyncio.timeout(timeout):
                async with self._driver.session(database=self.database) as session:
                    result = await session.run(query, parameters or {})
                    records = await result.data()
            
            # Update metrics
            query_time = time.time() - start_time
            self._success_count += 1
            self._total_query_time += query_time
            
            logger.debug(f"Query executed successfully in {query_time:.2f}s")
            return records
            
        except asyncio.TimeoutError:
            self._error_count += 1
            logger.error(f"Query timeout after {timeout}s: {query[:100]}...")
            raise
        except Exception as e:
            self._error_count += 1
            logger.error(f"Query execution error: {e}")
            raise
        finally:
            self._active_connections -= 1

    async def execute_transaction(self,
                                transaction_function,
                                *args,
                                timeout: Optional[float] = None,
                                **kwargs) -> Any:
        """
        Execute a transaction function with proper resource management.
        
        Args:
            transaction_function: Async function to execute in transaction
            args: Positional arguments for the transaction function
            timeout: Transaction timeout in seconds
            kwargs: Keyword arguments for the transaction function
            
        Returns:
            Result from the transaction function
        """
        if not self._driver:
            raise RuntimeError("Database service not initialized")
        
        async with self._connection_semaphore:
            return await self._execute_transaction_with_timeout(
                transaction_function, *args, timeout=timeout, **kwargs
            )

    async def _execute_transaction_with_timeout(self,
                                              transaction_function,
                                              *args,
                                              timeout: Optional[float] = None,
                                              **kwargs) -> Any:
        """Execute transaction with timeout and metrics tracking."""
        
        start_time = time.time()
        self._query_count += 1
        self._last_query_time = start_time
        self._active_connections += 1
        
        try:
            timeout = timeout or self.config.get('default_transaction_timeout', 60.0)
            
            async with asyncio.timeout(timeout):
                async with self._driver.session(database=self.database) as session:
                    result = await session.execute_write(transaction_function, *args, **kwargs)
            
            # Update metrics
            transaction_time = time.time() - start_time
            self._success_count += 1
            self._total_query_time += transaction_time
            
            logger.debug(f"Transaction executed successfully in {transaction_time:.2f}s")
            return result
            
        except asyncio.TimeoutError:
            self._error_count += 1
            logger.error(f"Transaction timeout after {timeout}s")
            raise
        except Exception as e:
            self._error_count += 1
            logger.error(f"Transaction execution error: {e}")
            raise
        finally:
            self._active_connections -= 1

    def get_sync_driver(self) -> neo4j.Driver:
        """Get synchronous driver for compatibility with existing code."""
        if not self._sync_driver:
            raise RuntimeError("Database service not initialized")
        return self._sync_driver

    @asynccontextmanager
    async def session(self, **kwargs):
        """Context manager for database sessions."""
        if not self._driver:
            raise RuntimeError("Database service not initialized")
        
        async with self._connection_semaphore:
            async with self._driver.session(database=self.database, **kwargs) as session:
                self._active_connections += 1
                try:
                    yield session
                finally:
                    self._active_connections -= 1

    def _get_pool_metrics(self) -> Dict[str, Any]:
        """Get connection pool metrics."""
        # Note: Neo4j driver doesn't expose detailed pool metrics directly
        # This is a placeholder for where you'd implement pool monitoring
        return {
            'max_pool_size': self.max_connection_pool_size,
            'active_connections': self._active_connections,
            'pool_utilization': self._active_connections / self.max_connection_pool_size
        }

    def get_metrics(self) -> Dict[str, Any]:
        """Get database service metrics."""
        return {
            'query_count': self._query_count,
            'success_count': self._success_count,
            'error_count': self._error_count,
            'success_rate': self._success_count / max(1, self._query_count),
            'average_query_time': self._total_query_time / max(1, self._success_count),
            'active_connections': self._active_connections,
            'last_query_time': self._last_query_time,
            'uptime': self.get_uptime(),
            'pool_metrics': self._get_pool_metrics()
        }

    async def test_query(self, query: str = "MATCH (n) RETURN count(n) as node_count") -> Dict[str, Any]:
        """Execute a test query for debugging purposes."""
        return await self.execute_query(query)

    async def get_database_info(self) -> Dict[str, Any]:
        """Get information about the connected database."""
        try:
            info_queries = [
                ("node_count", "MATCH (n) RETURN count(n) as value"),
                ("relationship_count", "MATCH ()-[r]->() RETURN count(r) as value"),
                ("database_name", "CALL db.info() YIELD name RETURN name as value"),
            ]
            
            info = {}
            for key, query in info_queries:
                try:
                    result = await self.execute_query(query)
                    if result and len(result) > 0:
                        info[key] = result[0].get('value', 'unknown')
                except Exception as e:
                    info[key] = f"error: {e}"
            
            return info
            
        except Exception as e:
            logger.error(f"Failed to get database info: {e}")
            return {"error": str(e)} 