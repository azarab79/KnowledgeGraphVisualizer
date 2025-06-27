"""
FastAPI Wrapper for Knowledge Graph QA Pipeline

This FastAPI application wraps the existing kg_qa_pipeline.py to provide
REST API endpoints for chat functionality and health checks.
"""

import os
import asyncio
import logging
import time
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
import uvicorn

# Import the enhanced QA pipeline
from kg_qa_pipeline_enhanced import create_qa_pipeline, EnhancedQAPipeline

# Import background task management
from background_tasks import (
    get_task_manager, 
    shutdown_task_manager, 
    BackgroundTaskManager,
    TaskStatus
)

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

# Configure structured logging
setup_logging(
    log_level=os.getenv('LOG_LEVEL', 'INFO'),
    enable_json=os.getenv('ENABLE_JSON_LOGGING', 'true').lower() == 'true',
    enable_console=True,
    enable_file=True,
    log_file_name='kg_qa_api.log'
)

logger = get_logger(__name__)

# Application startup time for uptime calculation
APP_START_TIME = time.time()


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    environment: str = "development"
    
    # CORS settings
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3002"]
    cors_allow_credentials: bool = True
    cors_allow_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    cors_allow_headers: List[str] = ["*"]
    
    # Trusted hosts
    trusted_hosts: List[str] = ["localhost", "127.0.0.1", "*.localhost"]
    
    # Application settings
    max_conversation_length: int = 100
    request_timeout: int = 30
    
    # QA Pipeline settings
    primary_llm_provider: str = "ollama"
    fallback_llm_providers: List[str] = ["google_genai"]
    
    # Rate limiting settings
    enable_rate_limiting: bool = True
    rate_limit_requests_per_minute: int = 60
    slow_request_threshold: float = 1.0
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


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


class AsyncChatRequest(BaseModel):
    """Request model for the /chat/async endpoint."""
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
    timeout: Optional[int] = Field(
        300,
        description="Task timeout in seconds (default: 300)",
        ge=30,
        le=1800
    )


class AsyncChatResponse(BaseModel):
    """Response model for the /chat/async endpoint."""
    task_id: str = Field(..., description="Unique identifier for the background task")
    status: str = Field(..., description="Current status of the task")
    message: str = Field(..., description="Status message")
    estimated_completion_time: Optional[str] = Field(
        None, 
        description="Estimated completion time in seconds"
    )


class TaskStatusResponse(BaseModel):
    """Response model for the /chat/status/{task_id} endpoint."""
    task_id: str = Field(..., description="Task identifier")
    status: str = Field(..., description="Current task status")
    progress: float = Field(..., description="Progress percentage (0.0 to 1.0)")
    created_at: str = Field(..., description="Task creation timestamp")
    started_at: Optional[str] = Field(None, description="Task start timestamp")
    completed_at: Optional[str] = Field(None, description="Task completion timestamp")
    error: Optional[str] = Field(None, description="Error message if task failed")
    has_result: bool = Field(..., description="Whether the task has a result available")


# Global settings instance
settings = Settings()

# Global QA pipeline instance (will be initialized in lifespan)
qa_pipeline: Optional[EnhancedQAPipeline] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events."""
    global qa_pipeline
    
    # Startup
    logger.info(
        "Starting FastAPI application",
        extra={
            'startup_time': datetime.now(timezone.utc).isoformat(),
            'environment': settings.environment,
            'log_level': os.getenv('LOG_LEVEL', 'INFO'),
            'primary_llm_provider': settings.primary_llm_provider,
            'fallback_providers': settings.fallback_llm_providers,
            'rate_limiting_enabled': settings.enable_rate_limiting
        }
    )
    
    startup_start = time.time()
    
    try:
        # Initialize the QA pipeline
        logger.info("Initializing enhanced QA pipeline...")
        qa_init_start = time.time()
        
        qa_pipeline = create_qa_pipeline(
            primary_provider=settings.primary_llm_provider,
            fallback_providers=settings.fallback_llm_providers
        )
        
        qa_init_time = time.time() - qa_init_start
        
        logger.info(
            "FastAPI application started successfully",
            extra={
                'startup_duration': time.time() - startup_start,
                'qa_pipeline_init_duration': qa_init_time,
                'pipeline_initialized': qa_pipeline is not None
            }
        )
        
        yield  # Application runs here
        
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}", exc_info=True)
        raise
    finally:
        # Shutdown
        logger.info("Shutting down FastAPI application...")
        
        # Shutdown background task manager
        try:
            shutdown_task_manager()
            logger.info("Background task manager shut down successfully")
        except Exception as e:
            logger.warning(f"Error during task manager shutdown: {e}")
        
        # Shutdown QA pipeline
        if qa_pipeline and hasattr(qa_pipeline, 'cleanup'):
            try:
                qa_pipeline.cleanup()
            except Exception as e:
                logger.warning(f"Error during QA pipeline cleanup: {e}")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    app = FastAPI(
        title="Knowledge Graph QA API",
        description="FastAPI wrapper for the Enhanced Knowledge Graph QA Pipeline with LLM abstraction layer",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        debug=settings.debug,
        lifespan=lifespan
    )
    
    # Set up enhanced middleware (replaces manual middleware addition)
    setup_enhanced_middleware(
        app=app,
        environment=settings.environment,
        cors_origins=settings.cors_origins,
        enable_rate_limiting=settings.enable_rate_limiting,
        rate_limit_requests_per_minute=settings.rate_limit_requests_per_minute,
        slow_request_threshold=settings.slow_request_threshold
    )
    
    # Add request/response logging middleware (after enhanced middleware)
    app.add_middleware(RequestResponseLoggingMiddleware)
    
    # Add trusted host middleware for security (if not in development)
    if settings.environment != "development":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.trusted_hosts
        )
    
    # Register enhanced exception handlers
    register_exception_handlers(app)
    
    return app


def register_exception_handlers(app: FastAPI) -> None:
    """Register all custom exception handlers."""
    
    # HTTP exceptions
    app.add_exception_handler(HTTPException, http_exception_handler)
    
    # Validation errors
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    
    # LLM-specific errors
    app.add_exception_handler(LLMTimeoutError, timeout_exception_handler)
    app.add_exception_handler(TimeoutError, timeout_exception_handler)
    app.add_exception_handler(ProviderUnavailableError, provider_unavailable_exception_handler)
    app.add_exception_handler(RateLimitError, rate_limit_exception_handler)
    app.add_exception_handler(ContextOverflowError, context_overflow_exception_handler)
    
    # Database errors (Neo4j)
    def is_database_error(exc: Exception) -> bool:
        """Check if exception is a database-related error."""
        exc_str = str(type(exc)).lower()
        return any(keyword in exc_str for keyword in ['neo4j', 'driver', 'session', 'transaction'])
    
    # General exception handler (catch-all)
    app.add_exception_handler(Exception, general_exception_handler)
    
    logger.info("Exception handlers registered successfully")


# Create the FastAPI application instance
app = create_app()


# Dependency to get settings
def get_settings() -> Settings:
    """Dependency to inject settings."""
    return settings


# Dependency to get QA pipeline
def get_qa_pipeline() -> EnhancedQAPipeline:
    """Dependency to inject QA pipeline."""
    if qa_pipeline is None:
        raise HTTPException(
            status_code=503, 
            detail="QA pipeline is not initialized"
        )
    return qa_pipeline


# Health check endpoint with proper service monitoring
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """
    Health check endpoint that returns the status of the API and its dependencies.
    
    Returns:
        HealthResponse: Current health status of the service
    """
    uptime = time.time() - APP_START_TIME
    
    # Check service health
    services = {
        "api": "healthy",
        "qa_pipeline": "unknown",
        "llm_abstraction": "unknown",
        "neo4j": "unknown"
    }
    
    overall_status = "healthy"
    
    try:
        # Check QA pipeline health
        if qa_pipeline is not None:
            services["qa_pipeline"] = "healthy"
            
            # Check LLM manager health
            if hasattr(qa_pipeline, 'llm_manager') and qa_pipeline.llm_manager:
                try:
                    health_status = qa_pipeline.llm_manager.health_check()
                    if health_status.get('status') == 'healthy':
                        services["llm_abstraction"] = "healthy"
                    else:
                        services["llm_abstraction"] = "degraded"
                        overall_status = "degraded"
                except Exception as e:
                    logger.warning(f"LLM health check failed: {e}")
                    services["llm_abstraction"] = "unhealthy"
                    overall_status = "degraded"
            
            # Check Neo4j connection
            if hasattr(qa_pipeline, 'graph') and qa_pipeline.graph:
                try:
                    # Simple query to test Neo4j connection
                    qa_pipeline.graph.query("RETURN 1 as test")
                    services["neo4j"] = "healthy"
                except Exception as e:
                    logger.warning(f"Neo4j health check failed: {e}")
                    services["neo4j"] = "unhealthy"
                    overall_status = "degraded"
        else:
            services["qa_pipeline"] = "unhealthy"
            overall_status = "unhealthy"
            
    except Exception as e:
        logger.error(f"Health check error: {e}")
        overall_status = "unhealthy"
    
    return HealthResponse(
        status=overall_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        version="1.0.0",
        services=services,
        uptime=uptime
    )


# Chat endpoint with real QA pipeline integration
@app.post("/chat", response_model=ChatResponse, responses={
    422: {"model": ErrorResponse, "description": "Validation Error"},
    429: {"model": ErrorResponse, "description": "Rate Limit Exceeded"},
    503: {"model": ErrorResponse, "description": "Service Unavailable"},
    504: {"model": ErrorResponse, "description": "Request Timeout"}
}, tags=["Chat"])
async def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    pipeline: EnhancedQAPipeline = Depends(get_qa_pipeline),
    settings: Settings = Depends(get_settings)
) -> ChatResponse:
    """
    Chat endpoint that processes questions using the Enhanced Knowledge Graph QA Pipeline.
    
    Args:
        request: The chat request containing question and conversation history
        background_tasks: FastAPI background tasks for async operations
        pipeline: The QA pipeline instance
        settings: Application settings
        
    Returns:
        ChatResponse: The response from the QA pipeline
        
    Raises:
        HTTPException: If there's an error processing the request
    """
    import uuid
    
    start_time = time.time()
    conversation_id = request.conversation_id or str(uuid.uuid4())
    
    try:
        logger.info(
            "Processing chat request", 
            extra={
                'conversation_id': conversation_id,
                'question_preview': request.question[:100],
                'question_length': len(request.question),
                'temperature': request.temperature,
                'max_tokens': request.max_tokens,
                'history_length': len(request.conversation_history) if request.conversation_history else 0
            }
        )
        
        # Set conversation ID on the pipeline for this request
        if conversation_id != pipeline.conversation_id:
            pipeline.conversation_id = conversation_id
        
        # Process the question using the enhanced pipeline
        # Note: We run this in an async wrapper to avoid blocking
        def process_sync():
            return pipeline.process_question(request.question)
        
        # Execute the synchronous QA pipeline processing
        qa_start_time = time.time()
        result = await asyncio.get_event_loop().run_in_executor(None, process_sync)
        qa_processing_time = time.time() - qa_start_time
        
        # Log QA pipeline performance
        log_performance(
            operation="qa_pipeline_processing",
            duration=qa_processing_time,
            conversation_id=conversation_id,
            question_length=len(request.question)
        )
        
        # Extract response data
        answer = result.get('answer', 'No answer generated')
        entities = result.get('entities_extracted', [])
        sources = result.get('sources_used', [])
        
        # Calculate confidence score based on processing success
        confidence_score = 0.9 if 'error' not in result else 0.3
        
        processing_time = time.time() - start_time
        
        logger.info(
            "Chat request processed successfully",
            extra={
                'conversation_id': conversation_id,
                'processing_time_seconds': processing_time,
                'answer_length': len(answer),
                'entities_count': len(entities),
                'sources_count': len(sources),
                'confidence_score': confidence_score
            }
        )
        
        # Log total processing time
        log_performance(
            operation="chat_endpoint_total",
            duration=processing_time,
            conversation_id=conversation_id,
            success=True
        )
        
        return ChatResponse(
            answer=answer,
            conversation_id=conversation_id,
            entities_extracted=entities,
            processing_time=processing_time,
            sources_used=sources,
            confidence_score=confidence_score
        )
        
    except Exception as e:
        processing_time = time.time() - start_time
        
        logger.error(
            "Error processing chat request",
            extra={
                'conversation_id': conversation_id,
                'processing_time_seconds': processing_time,
                'error_type': type(e).__name__,
                'error_message': str(e),
                'question_preview': request.question[:100]
            },
            exc_info=True
        )
        
        # Log failed processing time
        log_performance(
            operation="chat_endpoint_total",
            duration=processing_time,
            conversation_id=conversation_id,
            success=False,
            error_type=type(e).__name__
        )
        
        # Re-raise exception to be handled by exception handlers
        raise


# Background Task Chat Endpoints

@app.post("/chat/async", response_model=AsyncChatResponse, responses={
    422: {"model": ErrorResponse, "description": "Validation Error"},
    503: {"model": ErrorResponse, "description": "Service Unavailable"}
}, tags=["Chat", "Background Tasks"])
async def chat_async(
    request: AsyncChatRequest,
    pipeline: EnhancedQAPipeline = Depends(get_qa_pipeline),
    settings: Settings = Depends(get_settings)
) -> AsyncChatResponse:
    """
    Submit a chat question for background processing and return immediately with a task ID.
    
    Args:
        request: The async chat request containing question and optional parameters
        pipeline: The QA pipeline instance
        settings: Application settings
        
    Returns:
        AsyncChatResponse: Task ID and status information
        
    Raises:
        HTTPException: If there's an error creating the task
    """
    import uuid
    
    try:
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        logger.info(
            "Creating background task for chat request",
            extra={
                'conversation_id': conversation_id,
                'question_preview': request.question[:100],
                'question_length': len(request.question),
                'timeout': request.timeout,
                'history_length': len(request.conversation_history) if request.conversation_history else 0
            }
        )
        
        # Get the task manager
        task_manager = get_task_manager()
        
        # Create a new background task
        task_id = task_manager.create_task(timeout=request.timeout)
        
        # Set conversation ID on the pipeline for this request
        if conversation_id != pipeline.conversation_id:
            pipeline.conversation_id = conversation_id
        
        # Submit the task for background processing
        task_manager.submit_qa_task(
            task_id=task_id,
            pipeline=pipeline,
            question=request.question,
            conversation_history=request.conversation_history
        )
        
        logger.info(
            "Background task created successfully",
            extra={
                'task_id': task_id,
                'conversation_id': conversation_id,
                'timeout': request.timeout
            }
        )
        
        return AsyncChatResponse(
            task_id=task_id,
            status="pending",
            message=f"Task {task_id} has been submitted for background processing",
            estimated_completion_time="30-120"
        )
        
    except Exception as e:
        logger.error(
            "Error creating background task",
            extra={
                'error_type': type(e).__name__,
                'error_message': str(e),
                'question_preview': request.question[:100]
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create background task: {str(e)}"
        )


@app.get("/chat/status/{task_id}", response_model=TaskStatusResponse, responses={
    404: {"model": ErrorResponse, "description": "Task Not Found"}
}, tags=["Chat", "Background Tasks"])
async def get_task_status(task_id: str) -> TaskStatusResponse:
    """
    Get the status of a background chat task.
    
    Args:
        task_id: Unique task identifier
        
    Returns:
        TaskStatusResponse: Current task status and metadata
        
    Raises:
        HTTPException: If task is not found
    """
    try:
        task_manager = get_task_manager()
        status_info = task_manager.get_task_status(task_id)
        
        if "error" in status_info and status_info["error"] == "Task not found":
            logger.warning(f"Task {task_id} not found")
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        logger.debug(f"Retrieved status for task {task_id}: {status_info['status']}")
        
        return TaskStatusResponse(**status_info)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving task status for {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/chat/result/{task_id}", response_model=ChatResponse, responses={
    404: {"model": ErrorResponse, "description": "Task Not Found or Not Completed"},
    202: {"description": "Task Still Processing"}
}, tags=["Chat", "Background Tasks"])
async def get_task_result(task_id: str) -> ChatResponse:
    """
    Get the result of a completed background chat task.
    
    Args:
        task_id: Unique task identifier
        
    Returns:
        ChatResponse: The chat result if task is completed
        
    Raises:
        HTTPException: If task is not found, not completed, or failed
    """
    try:
        task_manager = get_task_manager()
        task = task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        if task.status == TaskStatus.PENDING or task.status == TaskStatus.RUNNING:
            raise HTTPException(
                status_code=202, 
                detail=f"Task {task_id} is still processing (status: {task.status.value})"
            )
        
        if task.status == TaskStatus.FAILED:
            raise HTTPException(
                status_code=500, 
                detail=f"Task {task_id} failed: {task.error or 'Unknown error'}"
            )
        
        if task.status == TaskStatus.TIMEOUT:
            raise HTTPException(
                status_code=408, 
                detail=f"Task {task_id} timed out"
            )
        
        result = task_manager.get_task_result(task_id)
        if not result:
            raise HTTPException(
                status_code=404, 
                detail=f"No result available for task {task_id}"
            )
        
        logger.info(f"Retrieved result for completed task {task_id}")
        
        return ChatResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving task result for {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/chat/cancel/{task_id}", responses={
    200: {"description": "Task Cancelled Successfully"},
    404: {"model": ErrorResponse, "description": "Task Not Found"},
    409: {"model": ErrorResponse, "description": "Task Cannot Be Cancelled"}
}, tags=["Chat", "Background Tasks"])
async def cancel_task(task_id: str):
    """
    Cancel a pending or running background task.
    
    Args:
        task_id: Unique task identifier
        
    Returns:
        Success message if cancelled
        
    Raises:
        HTTPException: If task cannot be cancelled or not found
    """
    try:
        task_manager = get_task_manager()
        
        cancelled = task_manager.cancel_task(task_id)
        if not cancelled:
            task = task_manager.get_task(task_id)
            if not task:
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            else:
                raise HTTPException(
                    status_code=409, 
                    detail=f"Task {task_id} cannot be cancelled (status: {task.status.value})"
                )
        
        logger.info(f"Cancelled task {task_id}")
        return {"message": f"Task {task_id} has been cancelled"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Additional endpoint for conversation history (bonus)
@app.get("/chat/history/{conversation_id}", tags=["Chat"])
async def get_conversation_history(
    conversation_id: str,
    pipeline: EnhancedQAPipeline = Depends(get_qa_pipeline)
):
    """Get conversation history for a specific conversation ID."""
    try:
        if hasattr(pipeline, 'llm_manager') and pipeline.llm_manager:
            history = pipeline.llm_manager.get_conversation_history(conversation_id)
            return {"conversation_id": conversation_id, "history": history}
    except Exception as e:
        logger.error(f"Error retrieving conversation history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"conversation_id": conversation_id, "history": []}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    ) 