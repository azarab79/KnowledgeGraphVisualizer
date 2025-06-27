"""
Enhanced Error Handling for FastAPI Wrapper
This module provides comprehensive error handling with proper logging, correlation IDs, and structured responses.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Union
from enum import Enum

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

# Import custom exceptions from the QA pipeline
try:
    from llm_abstraction.exceptions import (
        LLMAbstractionError,
        ProviderUnavailableError,
        RateLimitError,
        TimeoutError as LLMTimeoutError,
        ContextOverflowError
    )
except ImportError:
    # Fallback if LLM abstraction is not available
    class LLMAbstractionError(Exception):
        pass
    class ProviderUnavailableError(Exception):
        pass
    class RateLimitError(Exception):
        pass
    class LLMTimeoutError(Exception):
        pass
    class ContextOverflowError(Exception):
        pass

from config.logging_config import get_logger

logger = get_logger(__name__)


class ErrorType(str, Enum):
    """Enumeration of different error types for classification."""
    VALIDATION = "validation_error"
    AUTHENTICATION = "authentication_error"
    AUTHORIZATION = "authorization_error"
    NOT_FOUND = "not_found_error"
    TIMEOUT = "timeout_error"
    RATE_LIMIT = "rate_limit_error"
    PROVIDER_UNAVAILABLE = "provider_unavailable_error"
    CONTEXT_OVERFLOW = "context_overflow_error"
    SERVER_ERROR = "server_error"
    DATABASE_ERROR = "database_error"
    EXTERNAL_SERVICE_ERROR = "external_service_error"


class ErrorResponse(BaseModel):
    """Standardized error response model."""
    error_type: ErrorType = Field(..., description="Type of error that occurred")
    error_code: str = Field(..., description="Specific error code for client handling")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    correlation_id: str = Field(..., description="Unique identifier for request tracking")
    timestamp: str = Field(..., description="ISO timestamp when error occurred")
    path: Optional[str] = Field(None, description="API path where error occurred")
    method: Optional[str] = Field(None, description="HTTP method used")
    
    class Config:
        schema_extra = {
            "example": {
                "error_type": "validation_error",
                "error_code": "INVALID_INPUT",
                "message": "The request contains invalid input data",
                "details": {
                    "field": "question",
                    "issue": "Field is required and cannot be empty"
                },
                "correlation_id": "req_123e4567-e89b-12d3-a456-426614174000",
                "timestamp": "2024-01-15T10:30:00Z",
                "path": "/chat",
                "method": "POST"
            }
        }


def generate_correlation_id() -> str:
    """Generate a unique correlation ID for request tracking."""
    return f"req_{uuid.uuid4()}"


def get_correlation_id(request: Request) -> str:
    """Extract or generate correlation ID from request."""
    # Try to get from headers first
    correlation_id = request.headers.get("X-Correlation-ID")
    if not correlation_id:
        # Try to get from request state
        correlation_id = getattr(request.state, "correlation_id", None)
    if not correlation_id:
        # Generate new one
        correlation_id = generate_correlation_id()
        request.state.correlation_id = correlation_id
    return correlation_id


def create_error_response(
    error_type: ErrorType,
    error_code: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    correlation_id: Optional[str] = None,
    request: Optional[Request] = None
) -> ErrorResponse:
    """Create a standardized error response."""
    if not correlation_id:
        correlation_id = generate_correlation_id()
    
    path = None
    method = None
    if request:
        path = str(request.url.path)
        method = request.method
        # Ensure correlation ID is set on request
        if not hasattr(request.state, "correlation_id"):
            request.state.correlation_id = correlation_id
    
    return ErrorResponse(
        error_type=error_type,
        error_code=error_code,
        message=message,
        details=details,
        correlation_id=correlation_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        path=path,
        method=method
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTPException with proper logging and response formatting."""
    correlation_id = get_correlation_id(request)
    
    # Map HTTP status codes to error types
    error_type_map = {
        400: ErrorType.VALIDATION,
        401: ErrorType.AUTHENTICATION,
        403: ErrorType.AUTHORIZATION,
        404: ErrorType.NOT_FOUND,
        408: ErrorType.TIMEOUT,
        429: ErrorType.RATE_LIMIT,
        500: ErrorType.SERVER_ERROR,
        502: ErrorType.EXTERNAL_SERVICE_ERROR,
        503: ErrorType.PROVIDER_UNAVAILABLE,
        504: ErrorType.TIMEOUT
    }
    
    error_type = error_type_map.get(exc.status_code, ErrorType.SERVER_ERROR)
    error_code = f"HTTP_{exc.status_code}"
    
    # Create detailed error response
    error_response = create_error_response(
        error_type=error_type,
        error_code=error_code,
        message=str(exc.detail),
        details={"status_code": exc.status_code},
        correlation_id=correlation_id,
        request=request
    )
    
    # Log the error
    log_level = logging.WARNING if exc.status_code < 500 else logging.ERROR
    logger.log(
        log_level,
        f"HTTP exception occurred: {exc.status_code} - {exc.detail}",
        extra={
            "error_type": error_type,
            "error_code": error_code,
            "status_code": exc.status_code,
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method,
            "client_ip": request.client.host if request.client else None
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.dict(),
        headers={"X-Correlation-ID": correlation_id}
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors with detailed field information."""
    correlation_id = get_correlation_id(request)
    
    # Extract validation details
    validation_details = []
    for error in exc.errors():
        field_path = " -> ".join(str(loc) for loc in error["loc"])
        validation_details.append({
            "field": field_path,
            "message": error["msg"],
            "type": error["type"],
            "input": error.get("input")
        })
    
    error_response = create_error_response(
        error_type=ErrorType.VALIDATION,
        error_code="VALIDATION_ERROR",
        message="Request validation failed",
        details={
            "validation_errors": validation_details,
            "error_count": len(validation_details)
        },
        correlation_id=correlation_id,
        request=request
    )
    
    logger.warning(
        f"Request validation failed with {len(validation_details)} errors",
        extra={
            "error_type": ErrorType.VALIDATION,
            "error_code": "VALIDATION_ERROR",
            "validation_errors": validation_details,
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=422,
        content=error_response.dict(),
        headers={"X-Correlation-ID": correlation_id}
    )


async def timeout_exception_handler(request: Request, exc: Union[LLMTimeoutError, TimeoutError]) -> JSONResponse:
    """Handle timeout errors from LLM processing or other operations."""
    correlation_id = get_correlation_id(request)
    
    error_response = create_error_response(
        error_type=ErrorType.TIMEOUT,
        error_code="OPERATION_TIMEOUT",
        message="The operation timed out. Please try again or contact support if the issue persists.",
        details={
            "timeout_type": type(exc).__name__,
            "timeout_message": str(exc)
        },
        correlation_id=correlation_id,
        request=request
    )
    
    logger.warning(
        f"Timeout error occurred: {type(exc).__name__} - {str(exc)}",
        extra={
            "error_type": ErrorType.TIMEOUT,
            "error_code": "OPERATION_TIMEOUT",
            "exception_type": type(exc).__name__,
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=504,
        content=error_response.dict(),
        headers={"X-Correlation-ID": correlation_id}
    )


async def provider_unavailable_exception_handler(request: Request, exc: ProviderUnavailableError) -> JSONResponse:
    """Handle LLM provider unavailable errors."""
    correlation_id = get_correlation_id(request)
    
    error_response = create_error_response(
        error_type=ErrorType.PROVIDER_UNAVAILABLE,
        error_code="PROVIDER_UNAVAILABLE",
        message="The AI service is temporarily unavailable. Please try again in a few moments.",
        details={
            "provider": getattr(exc, 'provider', 'unknown'),
            "provider_message": str(exc)
        },
        correlation_id=correlation_id,
        request=request
    )
    
    logger.error(
        f"Provider unavailable: {str(exc)}",
        extra={
            "error_type": ErrorType.PROVIDER_UNAVAILABLE,
            "error_code": "PROVIDER_UNAVAILABLE",
            "provider": getattr(exc, 'provider', 'unknown'),
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=503,
        content=error_response.dict(),
        headers={"X-Correlation-ID": correlation_id}
    )


async def rate_limit_exception_handler(request: Request, exc: RateLimitError) -> JSONResponse:
    """Handle rate limiting errors."""
    correlation_id = get_correlation_id(request)
    
    error_response = create_error_response(
        error_type=ErrorType.RATE_LIMIT,
        error_code="RATE_LIMIT_EXCEEDED",
        message="Too many requests. Please wait before making another request.",
        details={
            "rate_limit_message": str(exc),
            "retry_advice": "Wait a few seconds before retrying"
        },
        correlation_id=correlation_id,
        request=request
    )
    
    logger.warning(
        f"Rate limit exceeded: {str(exc)}",
        extra={
            "error_type": ErrorType.RATE_LIMIT,
            "error_code": "RATE_LIMIT_EXCEEDED",
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method,
            "client_ip": request.client.host if request.client else None
        }
    )
    
    return JSONResponse(
        status_code=429,
        content=error_response.dict(),
        headers={
            "X-Correlation-ID": correlation_id,
            "Retry-After": "60"  # Suggest waiting 60 seconds
        }
    )


async def context_overflow_exception_handler(request: Request, exc: ContextOverflowError) -> JSONResponse:
    """Handle context overflow errors from LLM processing."""
    correlation_id = get_correlation_id(request)
    
    error_response = create_error_response(
        error_type=ErrorType.CONTEXT_OVERFLOW,
        error_code="CONTEXT_TOO_LARGE",
        message="The request contains too much text. Please reduce the input size or conversation history.",
        details={
            "context_message": str(exc),
            "suggestion": "Try reducing the conversation history or input text length"
        },
        correlation_id=correlation_id,
        request=request
    )
    
    logger.warning(
        f"Context overflow error: {str(exc)}",
        extra={
            "error_type": ErrorType.CONTEXT_OVERFLOW,
            "error_code": "CONTEXT_TOO_LARGE",
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=413,
        content=error_response.dict(),
        headers={"X-Correlation-ID": correlation_id}
    )


async def database_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle database connection and query errors."""
    correlation_id = get_correlation_id(request)
    
    # Check if it's a Neo4j specific error
    is_neo4j_error = "neo4j" in str(type(exc)).lower() or "cypher" in str(exc).lower()
    
    error_response = create_error_response(
        error_type=ErrorType.DATABASE_ERROR,
        error_code="DATABASE_UNAVAILABLE",
        message="Database service is temporarily unavailable. Please try again later.",
        details={
            "database_type": "neo4j" if is_neo4j_error else "unknown",
            "error_message": str(exc)[:200]  # Limit error message length
        },
        correlation_id=correlation_id,
        request=request
    )
    
    logger.error(
        f"Database error occurred: {type(exc).__name__} - {str(exc)}",
        extra={
            "error_type": ErrorType.DATABASE_ERROR,
            "error_code": "DATABASE_UNAVAILABLE",
            "exception_type": type(exc).__name__,
            "is_neo4j_error": is_neo4j_error,
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method
        },
        exc_info=True
    )
    
    return JSONResponse(
        status_code=503,
        content=error_response.dict(),
        headers={"X-Correlation-ID": correlation_id}
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle all other unhandled exceptions."""
    correlation_id = get_correlation_id(request)
    
    # Create a sanitized error response for production
    error_response = create_error_response(
        error_type=ErrorType.SERVER_ERROR,
        error_code="INTERNAL_SERVER_ERROR",
        message="An unexpected error occurred. Please try again or contact support if the issue persists.",
        details={
            "exception_type": type(exc).__name__,
            # Only include exception message in development
            "exception_message": str(exc) if logger.level <= logging.DEBUG else None
        },
        correlation_id=correlation_id,
        request=request
    )
    
    logger.error(
        f"Unhandled exception occurred: {type(exc).__name__} - {str(exc)}",
        extra={
            "error_type": ErrorType.SERVER_ERROR,
            "error_code": "INTERNAL_SERVER_ERROR",
            "exception_type": type(exc).__name__,
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method,
            "client_ip": request.client.host if request.client else None
        },
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content=error_response.dict(),
        headers={"X-Correlation-ID": correlation_id}
    ) 