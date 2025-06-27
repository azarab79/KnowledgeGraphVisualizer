"""
Structured Logging Configuration for Knowledge Graph QA API

This module provides comprehensive logging configuration with JSON formatting,
request/response logging, correlation IDs, and proper error handling.
"""

import os
import sys
import json
import time
import uuid
import logging
import logging.config
import logging.handlers
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Union
from contextvars import ContextVar
from pathlib import Path

import uvicorn
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Context variable for correlation ID tracking
correlation_id: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)


class StructuredJSONFormatter(logging.Formatter):
    """
    Custom JSON formatter for structured logging.
    
    Formats log records as JSON with additional context and correlation IDs.
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.hostname = os.uname().nodename if hasattr(os, 'uname') else 'unknown'
        self.service_name = os.getenv('SERVICE_NAME', 'kg-qa-api')
        self.service_version = os.getenv('SERVICE_VERSION', '1.0.0')
        self.environment = os.getenv('ENVIRONMENT', 'development')
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON."""
        
        # Base log structure
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'service': {
                'name': self.service_name,
                'version': self.service_version,
                'environment': self.environment,
                'hostname': self.hostname
            },
            'process': {
                'pid': os.getpid(),
                'thread_id': record.thread,
                'thread_name': record.threadName
            },
            'source': {
                'file': record.filename,
                'line': record.lineno,
                'function': record.funcName,
                'module': record.module,
                'path': record.pathname
            }
        }
        
        # Add correlation ID if available
        corr_id = correlation_id.get()
        if corr_id:
            log_entry['correlation_id'] = corr_id
        
        # Add exception information if present
        if record.exc_info:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
                'traceback': self.formatException(record.exc_info) if record.exc_info else None
            }
        
        # Add custom fields from extra parameter
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 'filename',
                'module', 'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
                'thread', 'threadName', 'processName', 'process', 'exc_info', 'exc_text',
                'stack_info', 'getMessage', 'message'
            }:
                try:
                    # Ensure the value is JSON serializable
                    json.dumps(value)
                    extra_fields[key] = value
                except (TypeError, ValueError):
                    extra_fields[key] = str(value)
        
        if extra_fields:
            log_entry['extra'] = extra_fields
        
        return json.dumps(log_entry, ensure_ascii=False, separators=(',', ':'))


class RequestResponseLoggingMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for logging HTTP requests and responses.
    
    Adds correlation IDs, logs request/response details, and tracks processing time.
    """
    
    def __init__(self, app, logger_name: str = "fastapi.requests"):
        super().__init__(app)
        self.logger = logging.getLogger(logger_name)
    
    async def dispatch(self, request: Request, call_next):
        """Process request and response with logging."""
        
        # Generate correlation ID for this request
        corr_id = str(uuid.uuid4())
        correlation_id.set(corr_id)
        
        # Add correlation ID to request headers for downstream services
        request.headers.__dict__['_list'].append((b'x-correlation-id', corr_id.encode()))
        
        start_time = time.time()
        
        # Log incoming request
        request_body = None
        if request.method in ['POST', 'PUT', 'PATCH']:
            try:
                # Read body for logging (FastAPI will re-read it later)
                body = await request.body()
                if body:
                    request_body = body.decode('utf-8')[:1000]  # Limit body size in logs
            except Exception:
                request_body = "<unable to read request body>"
        
        self.logger.info(
            "HTTP request received",
            extra={
                'http_request': {
                    'method': request.method,
                    'url': str(request.url),
                    'path': request.url.path,
                    'query_params': dict(request.query_params),
                    'headers': dict(request.headers),
                    'client_ip': request.client.host if request.client else None,
                    'user_agent': request.headers.get('user-agent'),
                    'content_type': request.headers.get('content-type'),
                    'content_length': request.headers.get('content-length'),
                    'body_preview': request_body
                },
                'request_id': corr_id
            }
        )
        
        # Process request
        response = None
        error = None
        status_code = None
        
        try:
            response = await call_next(request)
            status_code = response.status_code
            
        except Exception as e:
            error = e
            status_code = 500
            self.logger.error(
                "Request processing failed",
                extra={
                    'error': {
                        'type': type(e).__name__,
                        'message': str(e)
                    },
                    'request_id': corr_id
                },
                exc_info=True
            )
            # Re-raise the exception
            raise
        
        finally:
            # Calculate processing time
            processing_time = time.time() - start_time
            
            # Log response
            log_level = logging.INFO
            if status_code and status_code >= 400:
                log_level = logging.WARNING if status_code < 500 else logging.ERROR
            
            self.logger.log(
                log_level,
                "HTTP request completed",
                extra={
                    'http_response': {
                        'status_code': status_code,
                        'processing_time_ms': round(processing_time * 1000, 2),
                        'headers': dict(response.headers) if response else None
                    },
                    'http_request': {
                        'method': request.method,
                        'path': request.url.path,
                        'client_ip': request.client.host if request.client else None
                    },
                    'performance': {
                        'duration_ms': round(processing_time * 1000, 2),
                        'slow_request': processing_time > 1.0  # Flag slow requests
                    },
                    'request_id': corr_id
                }
            )
        
        # Add correlation ID to response headers
        if response:
            response.headers['X-Correlation-ID'] = corr_id
        
        return response


def get_log_level() -> int:
    """Get log level from environment variable."""
    level_str = os.getenv('LOG_LEVEL', 'INFO').upper()
    return getattr(logging, level_str, logging.INFO)


def get_logs_directory() -> Path:
    """Get or create logs directory."""
    logs_dir = Path(os.getenv('LOGS_DIR', 'logs'))
    logs_dir.mkdir(exist_ok=True)
    return logs_dir


def setup_logging(
    log_level: Optional[Union[str, int]] = None,
    enable_console: bool = True,
    enable_file: bool = True,
    enable_json: bool = True,
    log_file_name: str = 'app.log',
    max_file_size: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5
) -> None:
    """
    Configure comprehensive logging for the application.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        enable_console: Whether to enable console logging
        enable_file: Whether to enable file logging
        enable_json: Whether to use JSON formatting
        log_file_name: Name of the log file
        max_file_size: Maximum size of log file before rotation
        backup_count: Number of backup files to keep
    """
    
    # Determine log level
    if log_level is None:
        log_level = get_log_level()
    elif isinstance(log_level, str):
        log_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Create logs directory
    logs_dir = get_logs_directory()
    
    # Clear existing handlers
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Configure formatters
    if enable_json:
        formatter = StructuredJSONFormatter()
    else:
        formatter = logging.Formatter(
            fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    handlers = []
    
    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        console_handler.setFormatter(formatter)
        handlers.append(console_handler)
    
    # File handler with rotation
    if enable_file:
        file_path = logs_dir / log_file_name
        file_handler = logging.handlers.RotatingFileHandler(
            file_path,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding='utf-8'
        )
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        handlers.append(file_handler)
    
    # Error file handler (separate file for errors and above)
    if enable_file:
        error_file_path = logs_dir / f'error_{log_file_name}'
        error_handler = logging.handlers.RotatingFileHandler(
            error_file_path,
            maxBytes=max_file_size,
            backupCount=backup_count,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(formatter)
        handlers.append(error_handler)
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        handlers=handlers,
        force=True
    )
    
    # Reduce verbosity of third-party libraries
    logging.getLogger('uvicorn').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('fastapi').setLevel(logging.INFO)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    
    # Create application logger
    app_logger = logging.getLogger('kg_qa_api')
    app_logger.info(
        "Logging configuration initialized",
        extra={
            'config': {
                'log_level': logging.getLevelName(log_level),
                'console_enabled': enable_console,
                'file_enabled': enable_file,
                'json_enabled': enable_json,
                'log_file': str(logs_dir / log_file_name) if enable_file else None,
                'error_file': str(logs_dir / f'error_{log_file_name}') if enable_file else None
            }
        }
    )


def get_logger(name: str) -> logging.Logger:
    """
    Get a configured logger instance.
    
    Args:
        name: Logger name (typically __name__)
    
    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


def log_function_call(func_name: str, **kwargs) -> None:
    """
    Log function call with parameters.
    
    Args:
        func_name: Name of the function being called
        **kwargs: Function parameters to log
    """
    logger = get_logger('function_calls')
    logger.debug(
        f"Function called: {func_name}",
        extra={
            'function_call': {
                'name': func_name,
                'parameters': kwargs
            }
        }
    )


def log_performance(operation: str, duration: float, **context) -> None:
    """
    Log performance metrics for operations.
    
    Args:
        operation: Name of the operation
        duration: Duration in seconds
        **context: Additional context information
    """
    logger = get_logger('performance')
    logger.info(
        f"Performance metric: {operation}",
        extra={
            'performance': {
                'operation': operation,
                'duration_ms': round(duration * 1000, 2),
                'duration_seconds': round(duration, 3),
                'slow_operation': duration > 1.0
            },
            'context': context
        }
    )


# Module initialization
if __name__ == "__main__":
    # Test the logging configuration
    setup_logging(log_level='DEBUG', enable_json=True)
    
    logger = get_logger(__name__)
    logger.info("Logging configuration test")
    logger.warning("This is a warning message")
    logger.error("This is an error message", extra={'test_field': 'test_value'})
    
    try:
        raise ValueError("Test exception")
    except Exception:
        logger.exception("Exception occurred during test") 