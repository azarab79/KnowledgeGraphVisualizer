# Dependency Injection System Documentation

## Overview

The FastAPI Knowledge Graph QA application implements a comprehensive dependency injection system that provides:

- **Service Layer Architecture**: Modular, testable services with clear interfaces
- **Lifecycle Management**: Proper startup/shutdown sequences and resource cleanup
- **Connection Pooling**: Optimized database and cache connections
- **Health Monitoring**: Real-time service health checks and metrics
- **Configuration Management**: Environment-aware configuration with validation
- **Async Operations**: Non-blocking operations throughout the stack

## Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   FastAPI App   │────│   Dependencies   │────│  Service Layer  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │
                       ┌───────┼───────┐
                       │       │       │
                   ┌───▼───┐ ┌─▼──┐ ┌──▼──┐
                   │ QA    │ │ DB │ │Cache│
                   │Service│ │Svc │ │ Svc │
                   └───────┘ └────┘ └─────┘
```

### Service Layer

#### Base Service (`services/base.py`)

All services inherit from `BaseService` which provides:

- **Lifecycle Management**: `start()`, `stop()`, `startup()`, `shutdown()`
- **Health Monitoring**: Async health checks with metadata
- **Status Tracking**: Service state management
- **Background Tasks**: Automatic health check monitoring

```python
class BaseService(ABC):
    async def start(self) -> None:
        """Initialize service resources"""
        
    async def stop(self) -> None:
        """Cleanup service resources"""
        
    async def health_check(self) -> ServiceHealth:
        """Check service health"""
```

#### Service Manager (`services/base.py`)

Centralized service registry and lifecycle coordinator:

- **Service Registration**: Priority-based startup ordering
- **Dependency Management**: Automatic startup/shutdown sequences
- **Health Aggregation**: System-wide health monitoring
- **Failure Handling**: Graceful failure recovery and cleanup

```python
# Register services with startup priorities
service_manager.register_service(db_service, startup_priority=1)     # First
service_manager.register_service(cache_service, startup_priority=2)  # Second  
service_manager.register_service(qa_service, startup_priority=3)     # Last
```

### Services

#### QA Service (`services/qa_service.py`)

Manages the Knowledge Graph QA pipeline:

- **Async Interface**: Non-blocking question processing
- **Connection Pooling**: Semaphore-based request limiting
- **Conversation Management**: Session tracking and cleanup
- **Metrics Collection**: Performance and usage statistics

**Key Features:**
- Concurrent request limiting
- Automatic conversation timeout
- Background conversation cleanup
- Comprehensive metrics tracking

```python
async def process_question_async(self, 
                               question: str,
                               conversation_id: Optional[str] = None,
                               timeout: Optional[float] = None) -> Dict[str, Any]:
    """Process question with timeout and resource management"""
```

#### Database Service (`services/database_service.py`)

Neo4j connection management with pooling:

- **Connection Pooling**: Configurable pool size and timeouts
- **Async Operations**: Non-blocking database operations
- **Transaction Support**: Managed transaction contexts
- **Health Monitoring**: Connection and query health checks

**Key Features:**
- Automatic connection lifecycle management
- Query timeout protection
- Transaction retry logic
- Connection pool metrics

```python
async def execute_query(self, 
                      query: str, 
                      parameters: Optional[Dict[str, Any]] = None,
                      timeout: Optional[float] = None) -> List[Dict[str, Any]]:
    """Execute Cypher query with pooling and metrics"""
```

#### Cache Service (`services/cache_service.py`)

Multi-backend caching with Redis and in-memory fallback:

- **Hybrid Backend**: Redis primary, memory fallback
- **TTL Management**: Automatic expiration and cleanup
- **LRU Eviction**: Memory-based cache size management
- **Metrics Tracking**: Hit rates and performance stats

**Key Features:**
- Automatic Redis failover to memory
- Background cache cleanup
- Memory pressure management
- Comprehensive cache statistics

```python
async def get(self, key: str) -> Any:
    """Get value with automatic fallback"""
    
async def set(self, key: str, value: Any, ttl: Optional[float] = None) -> bool:
    """Set value in hybrid cache"""
```

### Dependency Functions (`dependencies.py`)

#### Configuration Management

```python
@lru_cache()
def get_config() -> AppConfig:
    """Cached configuration from environment variables"""
```

**Configuration Categories:**
- Server settings (host, port, debug)
- Database connection (Neo4j URI, credentials, pooling)
- Cache settings (Redis URL, backend type, TTL)
- QA pipeline (providers, timeouts, concurrency)
- Security and rate limiting

#### Service Dependencies

```python
async def get_qa_service(manager: ServiceManager = Depends(get_service_manager)) -> QAService:
    """Get QA service with health check"""

async def get_database_service(manager: ServiceManager = Depends(get_service_manager)) -> DatabaseService:
    """Get database service with health check"""
    
async def get_cache_service(manager: ServiceManager = Depends(get_service_manager)) -> CacheService:
    """Get cache service with health check"""
```

#### Request Context

```python
async def get_request_context() -> RequestContext:
    """Request-scoped context with UUID and timing"""
```

**Request Context Fields:**
- `request_id`: Unique request identifier
- `start_time`: Request start timestamp
- `conversation_id`: Optional conversation tracking
- `metadata`: Custom request data

#### Health and Monitoring

```python
async def check_service_health(manager: ServiceManager = Depends(get_service_manager)) -> Dict[str, Any]:
    """Aggregate health check for all services"""
    
async def get_service_metrics(manager: ServiceManager = Depends(get_service_manager)) -> Dict[str, Any]:
    """Collect metrics from all services"""
```

## Usage Examples

### Basic Service Usage

```python
# In FastAPI endpoint
@app.post("/chat")
async def chat(
    request: ChatRequest,
    qa_service: QAService = Depends(get_qa_service),
    cache_service: CacheService = Depends(get_cache_service)
):
    # Check cache first
    cache_key = await cache_service.get_cache_key_hash(request.question)
    cached = await cache_service.get(cache_key)
    
    if cached:
        return cached
    
    # Process through QA service
    result = await qa_service.process_question_async(request.question)
    
    # Cache result
    await cache_service.set(cache_key, result, ttl=1800)
    
    return result
```

### Database Operations

```python
@app.get("/database/stats")
async def get_db_stats(db_service: DatabaseService = Depends(get_database_service)):
    # Direct query execution
    stats = await db_service.execute_query(
        "MATCH (n) RETURN count(n) as node_count"
    )
    
    # Transaction example
    async def update_transaction(tx):
        result = await tx.run("MATCH (n:Node) SET n.updated = timestamp() RETURN count(n)")
        return await result.single()
    
    updated = await db_service.execute_transaction(update_transaction)
    
    return {"stats": stats, "updated": updated}
```

### Service Health Monitoring

```python
@app.get("/health/detailed")
async def detailed_health(health_data: Dict[str, Any] = Depends(check_service_health)):
    return {
        "overall_healthy": health_data["healthy"],
        "services": health_data["services"],
        "timestamp": datetime.now().isoformat()
    }
```

## Configuration

### Environment Variables

```bash
# Server Configuration
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development
DEBUG=true

# Database Configuration  
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
MAX_CONNECTION_POOL_SIZE=50
CONNECTION_ACQUISITION_TIMEOUT=60

# Cache Configuration
CACHE_BACKEND=hybrid
REDIS_URL=redis://localhost:6379
REDIS_DB=0
CACHE_DEFAULT_TTL=3600
MAX_MEMORY_ENTRIES=10000

# QA Service Configuration
PRIMARY_LLM_PROVIDER=ollama
FALLBACK_LLM_PROVIDERS=google_genai,azure_openai
MAX_CONCURRENT_REQUESTS=10
CONVERSATION_TIMEOUT=3600

# Rate Limiting
ENABLE_RATE_LIMITING=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Health Monitoring
HEALTH_CHECK_INTERVAL=30.0
SERVICE_STARTUP_TIMEOUT=60.0
```

### Configuration Classes

```python
class AppConfig(BaseSettings):
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    environment: str = "development"
    
    # Database settings
    neo4j_uri: str = "bolt://localhost:7687"
    max_connection_pool_size: int = 50
    
    # Cache settings
    cache_backend: str = "hybrid"
    redis_url: str = "redis://localhost:6379"
    
    class Config:
        env_file = ".env"
        case_sensitive = False
```

## Service Initialization

### Application Lifespan

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle with dependency injection"""
    try:
        # Initialize all services
        await initialize_services(config)
        yield
    finally:
        # Cleanup all services
        await shutdown_services()
```

### Service Registration

```python
async def initialize_services(config: AppConfig) -> ServiceManager:
    """Initialize services with proper dependency order"""
    
    # Create service configurations
    db_config = {
        'neo4j_uri': config.neo4j_uri,
        'max_connection_pool_size': config.max_connection_pool_size,
        # ... other database config
    }
    
    # Register services in dependency order
    db_service = DatabaseService(db_config)
    service_manager.register_service(db_service, startup_priority=1)
    
    cache_service = CacheService(cache_config)
    service_manager.register_service(cache_service, startup_priority=2)
    
    qa_service = QAService(qa_config)
    service_manager.register_service(qa_service, startup_priority=3)
    
    # Start all services
    await service_manager.start_all()
    
    return service_manager
```

## Testing

### Mock Services

```python
class MockQAService(QAService):
    async def process_question_async(self, question: str, **kwargs):
        return {
            "answer": f"Mock response to: {question}",
            "entities_extracted": ["test"],
            "processing_time": 0.1
        }

# Override dependency for testing
app.dependency_overrides[get_qa_service] = lambda: MockQAService({})
```

### Integration Testing

```python
@pytest.mark.asyncio
async def test_chat_endpoint_with_services():
    # Mock service dependencies
    with patch('services.qa_service.create_qa_pipeline'):
        async with TestClient(app) as client:
            response = await client.post("/chat", json={
                "question": "Test question",
                "conversation_id": "test_conv"
            })
            
            assert response.status_code == 200
            data = response.json()
            assert "answer" in data
            assert "processing_time" in data
```

## Performance Considerations

### Connection Pooling

- **Database**: Configure `max_connection_pool_size` based on expected load
- **Cache**: Use Redis connection pooling for high-throughput scenarios
- **QA Service**: Limit concurrent requests with `max_concurrent_requests`

### Memory Management

- **Cache Service**: Automatic LRU eviction when memory limits reached
- **Service Manager**: Proper resource cleanup on shutdown
- **Background Tasks**: Configurable cleanup intervals

### Monitoring

- **Health Checks**: Regular service health monitoring
- **Metrics Collection**: Performance and usage statistics
- **Request Tracking**: Correlation IDs for request tracing

## Error Handling

### Service Failures

- **Startup Failures**: Automatic cleanup of started services
- **Runtime Failures**: Service health status updates
- **Dependency Failures**: Graceful degradation patterns

### Circuit Breaker Pattern

```python
# Implemented in enhanced error handler
if not qa_service.is_healthy():
    raise HTTPException(
        status_code=503,
        detail="QA service is not available"
    )
```

## Extending the System

### Adding New Services

1. **Create Service Class**:
```python
class NewService(BaseService):
    async def start(self) -> None:
        # Initialize resources
        
    async def stop(self) -> None:
        # Cleanup resources
        
    async def health_check(self) -> ServiceHealth:
        # Check service health
```

2. **Add Dependency Function**:
```python
async def get_new_service(manager: ServiceManager = Depends(get_service_manager)) -> NewService:
    service = manager.get_service_by_type(NewService)
    if not service or not service.is_healthy():
        raise HTTPException(status_code=503, detail="New service unavailable")
    return service
```

3. **Register Service**:
```python
new_service = NewService(config)
service_manager.register_service(new_service, startup_priority=4)
```

### Custom Dependencies

```python
async def get_user_context(
    request: Request,
    context: RequestContext = Depends(get_request_context)
) -> UserContext:
    # Extract user information from request
    # Add to request context
    return UserContext(user_id=..., permissions=...)
```

## Best Practices

1. **Service Design**:
   - Keep services focused and single-purpose
   - Implement proper health checks
   - Use async operations throughout
   - Handle failures gracefully

2. **Configuration**:
   - Use environment variables for all configuration
   - Provide sensible defaults
   - Validate configuration at startup

3. **Resource Management**:
   - Implement proper cleanup in `stop()` methods
   - Use connection pooling for external resources
   - Monitor resource usage with metrics

4. **Testing**:
   - Mock services for unit tests
   - Use dependency overrides for testing
   - Test service lifecycle and failure scenarios

5. **Monitoring**:
   - Implement comprehensive health checks
   - Collect performance metrics
   - Use correlation IDs for request tracing 