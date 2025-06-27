"""
FastAPI Wrapper for Knowledge Graph QA Pipeline - Enhanced with Dependency Injection

This FastAPI application provides REST API endpoints for chat functionality and health checks,
using a comprehensive dependency injection system for service management.
"""

import time
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError
import uvicorn

# Import the enhanced dependency injection system
from dependencies import (
    AppConfig, get_config, initialize_services, shutdown_services,
    get_qa_service, get_database_service, get_cache_service,
    get_request_context, check_rate_limit, check_service_health,
    get_service_metrics, RequestContext
)

# Import services
from services import QAService, DatabaseService, CacheService

# Import logging configuration
from config.logging_config import (
    setup_logging, 
    get_logger, 
    RequestResponseLoggingMiddleware,
    log_performance
)

# Import enhanced error handling and middleware
from api_error_handlers import (
    ErrorResponse,
    ErrorType,
    http_exception_handler,
    validation_exception_handler,
    timeout_exception_handler,
    provider_unavailable_exception_handler,
    rate_limit_exception_handler,
    context_overflow_exception_handler,
    database_exception_handler,
    general_exception_handler,
    LLMTimeoutError,
    ProviderUnavailableError,
    RateLimitError,
    ContextOverflowError
)

from api_middleware import setup_enhanced_middleware

# Initialize logging
config = AppConfig()
setup_logging(
    log_level=config.log_level,
    enable_json=config.enable_json_logging,
    enable_console=True,
    enable_file=True,
    log_file_name=config.log_file_name
)

logger = get_logger(__name__)

# Application startup time for uptime calculation
APP_START_TIME = time.time()


# Pydantic Models for Request/Response Validation

class ChatMessage(BaseModel):
    """Represents a single message in the conversation."""
    role: str = Field(..., description="Role of the message sender (user/assistant)")
    content: str = Field(..., description="Content of the message")
    timestamp: Optional[str] = Field(None, description="ISO timestamp of the message")


class ChatRequest(BaseModel):
    """Request model for the /chat endpoint."""
    question: str = Field(
        ..., 
        description="The user's question to ask the QA pipeline",
        min_length=1,
        max_length=2000
    )
    conversation_history: Optional[List[ChatMessage]] = Field(
        default=[],
        description="Previous conversation history for context",
        max_length=100
    )
    conversation_id: Optional[str] = Field(
        None,
        description="Unique identifier for the conversation session",
        max_length=100
    )
    temperature: Optional[float] = Field(
        0.2,
        description="Temperature for LLM generation (0.0-1.0)",
        ge=0.0,
        le=1.0
    )
    max_tokens: Optional[int] = Field(
        None,
        description="Maximum tokens in the response",
        gt=0,
        le=4096
    )


class ChatResponse(BaseModel):
    """Response model for the /chat endpoint."""
    answer: str = Field(..., description="The QA pipeline's response to the question")
    conversation_id: str = Field(..., description="Unique identifier for the conversation")
    entities_extracted: List[str] = Field(
        default=[], 
        description="Entities extracted from the question"
    )
    processing_time: float = Field(..., description="Time taken to process the request in seconds")
    sources_used: List[str] = Field(
        default=[],
        description="Information about sources used in the response"
    )
    confidence_score: Optional[float] = Field(
        None,
        description="Confidence score for the response (0.0-1.0)",
        ge=0.0,
        le=1.0
    )
    service_metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Service-level metadata about request processing"
    )


class HealthResponse(BaseModel):
    """Response model for the /health endpoint."""
    status: str = Field(..., description="Overall health status")
    timestamp: str = Field(..., description="ISO timestamp of the health check")
    version: str = Field(..., description="API version")
    services: Dict[str, Any] = Field(
        default={},
        description="Status of individual services and dependencies"
    )
    uptime: float = Field(..., description="Application uptime in seconds")


class ServiceMetricsResponse(BaseModel):
    """Response model for service metrics."""
    metrics: Dict[str, Any] = Field(..., description="Service metrics data")
    timestamp: str = Field(..., description="ISO timestamp of metrics collection")


# Application Lifespan Management

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events with dependency injection."""
    
    # Startup
    logger.info(
        "Starting FastAPI application with dependency injection",
        extra={
            'startup_time': datetime.now(timezone.utc).isoformat(),
            'environment': config.environment,
            'log_level': config.log_level,
            'primary_llm_provider': config.primary_llm_provider,
            'rate_limiting_enabled': config.enable_rate_limiting
        }
    )
    
    try:
        # Initialize all services through dependency injection
        await initialize_services(config)
        logger.info("Application startup completed successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down FastAPI application")
        try:
            await shutdown_services()
            logger.info("Application shutdown completed successfully")
        except Exception as e:
            logger.error(f"Error during application shutdown: {e}")


# FastAPI Application Factory

def create_app() -> FastAPI:
    """Create and configure FastAPI application with dependency injection."""
    
    app = FastAPI(
        title="Knowledge Graph QA Pipeline API",
        description="REST API for Knowledge Graph Question Answering with Enhanced Dependency Injection",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan
    )
    
    # Setup enhanced middleware
    setup_enhanced_middleware(app, config)
    
    # Add request/response logging middleware
    app.add_middleware(RequestResponseLoggingMiddleware)
    
    # Register exception handlers
    register_exception_handlers(app)
    
    return app


def register_exception_handlers(app: FastAPI) -> None:
    """Register enhanced exception handlers."""
    
    # Register specialized exception handlers
    app.exception_handler(HTTPException)(http_exception_handler)
    app.exception_handler(ValidationError)(validation_exception_handler)
    app.exception_handler(LLMTimeoutError)(timeout_exception_handler)
    app.exception_handler(ProviderUnavailableError)(provider_unavailable_exception_handler)
    app.exception_handler(RateLimitError)(rate_limit_exception_handler)
    app.exception_handler(ContextOverflowError)(context_overflow_exception_handler)
    
    # Database error handler
    @app.exception_handler(Exception)
    async def database_and_general_exception_handler(request, exc):
        def is_database_error(exc: Exception) -> bool:
            """Check if exception is database-related."""
            error_indicators = [
                'neo4j', 'database', 'connection', 'cypher', 'graph',
                'ServiceUnavailable', 'AuthError', 'ConfigurationError'
            ]
            error_msg = str(exc).lower()
            return any(indicator in error_msg for indicator in error_indicators)
        
        if is_database_error(exc):
            return await database_exception_handler(request, exc)
        else:
            return await general_exception_handler(request, exc)


# Create the FastAPI app
app = create_app()


# API Endpoints with Dependency Injection

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check(
    health_data: Dict[str, Any] = Depends(check_service_health),
    config: AppConfig = Depends(get_config)
) -> HealthResponse:
    """
    Enhanced health check endpoint using dependency injection.
    
    Provides comprehensive health information about all services
    including the QA pipeline, database, cache, and system status.
    """
    
    try:
        uptime = time.time() - APP_START_TIME
        
        # Determine overall status
        overall_status = "healthy" if health_data.get('healthy', False) else "unhealthy"
        
        return HealthResponse(
            status=overall_status,
            timestamp=datetime.now(timezone.utc).isoformat(),
            version="2.0.0",
            services=health_data.get('services', {}),
            uptime=uptime
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="error",
            timestamp=datetime.now(timezone.utc).isoformat(),
            version="2.0.0",
            services={"error": str(e)},
            uptime=time.time() - APP_START_TIME
        )


@app.get("/metrics", response_model=ServiceMetricsResponse, tags=["Monitoring"])
async def get_metrics(
    metrics_data: Dict[str, Any] = Depends(get_service_metrics)
) -> ServiceMetricsResponse:
    """
    Get comprehensive service metrics.
    
    Provides detailed metrics from all services including performance,
    usage statistics, and health information.
    """
    return ServiceMetricsResponse(
        metrics=metrics_data,
        timestamp=datetime.now(timezone.utc).isoformat()
    )


@app.post("/chat", response_model=ChatResponse, responses={
    422: {"model": ErrorResponse, "description": "Validation Error"},
    429: {"model": ErrorResponse, "description": "Rate Limit Exceeded"},
    503: {"model": ErrorResponse, "description": "Service Unavailable"},
    504: {"model": ErrorResponse, "description": "Request Timeout"}
}, tags=["Chat"])
async def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    qa_service: QAService = Depends(get_qa_service),
    cache_service: CacheService = Depends(get_cache_service),
    request_context: RequestContext = Depends(get_request_context),
    config: AppConfig = Depends(get_config),
    _: None = Depends(check_rate_limit)  # Rate limiting dependency
) -> ChatResponse:
    """
    Enhanced chat endpoint with dependency injection.
    
    Process a user question through the Knowledge Graph QA pipeline
    with caching, rate limiting, and comprehensive service management.
    """
    
    start_time = time.time()
    conversation_id = request.conversation_id or f"conv_{int(start_time * 1000)}"
    
    # Update request context
    request_context.conversation_id = conversation_id
    
    logger.info(
        f"Processing chat request",
        extra={
            'conversation_id': conversation_id,
            'question_length': len(request.question),
            'has_history': len(request.conversation_history) > 0,
            'temperature': request.temperature,
            'request_id': request_context.request_id
        }
    )
    
    try:
        # Check cache first
        cache_key = await cache_service.get_cache_key_hash(
            request.question,
            conversation_id,
            request.temperature
        )
        
        cached_response = await cache_service.get(cache_key)
        if cached_response:
            logger.info(f"Returning cached response for conversation {conversation_id}")
            cached_response['processing_time'] = time.time() - start_time
            return ChatResponse(**cached_response)
        
        # Process question through QA service
        result = await qa_service.process_question_async(
            question=request.question,
            conversation_id=conversation_id,
            conversation_history=[msg.dict() for msg in request.conversation_history],
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            timeout=config.request_timeout
        )
        
        # Create response
        response_data = {
            "answer": result.get("answer", ""),
            "conversation_id": conversation_id,
            "entities_extracted": result.get("entities_extracted", []),
            "processing_time": time.time() - start_time,
            "sources_used": result.get("sources_used", []),
            "confidence_score": result.get("confidence_score"),
            "service_metadata": result.get("service_metadata", {})
        }
        
        # Cache the response
        background_tasks.add_task(
            cache_service.set,
            cache_key,
            response_data,
            ttl=1800  # 30 minutes
        )
        
        # Log performance metrics
        processing_time = response_data["processing_time"]
        log_performance(
            operation="chat_request",
            duration=processing_time,
            metadata={
                'conversation_id': conversation_id,
                'entities_count': len(response_data["entities_extracted"]),
                'sources_count': len(response_data["sources_used"]),
                'answer_length': len(response_data["answer"]),
                'request_id': request_context.request_id
            }
        )
        
        logger.info(
            f"Chat request completed successfully",
            extra={
                'conversation_id': conversation_id,
                'processing_time': processing_time,
                'answer_length': len(response_data["answer"]),
                'entities_count': len(response_data["entities_extracted"]),
                'request_id': request_context.request_id
            }
        )
        
        return ChatResponse(**response_data)
        
    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(
            f"Chat request failed: {e}",
            extra={
                'conversation_id': conversation_id,
                'processing_time': processing_time,
                'error_type': type(e).__name__,
                'request_id': request_context.request_id
            }
        )
        raise


@app.get("/chat/history/{conversation_id}", tags=["Chat"])
async def get_conversation_history(
    conversation_id: str,
    qa_service: QAService = Depends(get_qa_service)
):
    """
    Get conversation history for a specific conversation using dependency injection.
    """
    try:
        history = await qa_service.get_conversation_history(conversation_id)
        return {
            "conversation_id": conversation_id,
            "history": history,
            "message_count": len(history)
        }
    except Exception as e:
        logger.error(f"Failed to get conversation history: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve conversation history: {str(e)}"
        )


@app.delete("/chat/history/{conversation_id}", tags=["Chat"])
async def clear_conversation_history(
    conversation_id: str,
    qa_service: QAService = Depends(get_qa_service),
    cache_service: CacheService = Depends(get_cache_service)
):
    """
    Clear conversation history for a specific conversation.
    """
    try:
        await qa_service.clear_conversation_history(conversation_id)
        
        # Also clear any cached responses for this conversation
        # This is a simplified approach - in production you might want more sophisticated cache invalidation
        await cache_service.clear()
        
        return {
            "conversation_id": conversation_id,
            "status": "cleared"
        }
    except Exception as e:
        logger.error(f"Failed to clear conversation history: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear conversation history: {str(e)}"
        )


@app.get("/services/status", tags=["Monitoring"])
async def get_service_status(
    health_data: Dict[str, Any] = Depends(check_service_health)
):
    """
    Get detailed status information for all services.
    """
    return {
        "overall_healthy": health_data.get('healthy', False),
        "services": health_data.get('services', {}),
        "service_count": health_data.get('service_count', 0),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# Main execution
if __name__ == "__main__":
    uvicorn.run(
        "main_with_di:app",
        host=config.host,
        port=config.port,
        reload=config.debug,
        log_level=config.log_level.lower(),
        access_log=True
    ) 