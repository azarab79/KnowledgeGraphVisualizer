"""
Enhanced Middleware for FastAPI Wrapper
This module provides CORS configuration, security headers, and request tracking middleware.
"""

import re
import time
import logging
from typing import List, Dict, Optional, Union, Callable, Any
from datetime import datetime, timezone

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.middleware.base import BaseHTTPMiddleware as StarletteBaseHTTPMiddleware

from config.logging_config import get_logger

logger = get_logger(__name__)


class EnhancedCORSConfiguration:
    """Enhanced CORS configuration with environment-aware settings."""
    
    def __init__(
        self,
        environment: str = "development",
        custom_origins: Optional[List[str]] = None,
        allow_credentials: bool = True,
        max_age: int = 3600
    ):
        self.environment = environment.lower()
        self.custom_origins = custom_origins or []
        self.allow_credentials = allow_credentials
        self.max_age = max_age
        
        # Define base origins for different environments
        self._base_origins = {
            "development": [
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:3002",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://127.0.0.1:3002",
                "http://localhost:8080",
                "http://127.0.0.1:8080"
            ],
            "staging": [
                "https://staging.example.com",
                "https://staging-api.example.com"
            ],
            "production": [
                "https://example.com",
                "https://www.example.com",
                "https://api.example.com"
            ]
        }
        
        # Define allowed methods and headers
        self._allowed_methods = [
            "GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"
        ]
        
        self._allowed_headers = [
            "Accept",
            "Accept-Language",
            "Content-Language",
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "X-Correlation-ID",
            "X-API-Key",
            "Cache-Control"
        ]
        
        # Define exposed headers that client can access
        self._exposed_headers = [
            "X-Correlation-ID",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "X-Request-ID"
        ]
    
    def get_allowed_origins(self) -> List[str]:
        """Get allowed origins based on environment and custom settings."""
        base_origins = self._base_origins.get(self.environment, self._base_origins["development"])
        
        # Combine base origins with custom origins
        all_origins = base_origins + self.custom_origins
        
        # Remove duplicates while preserving order
        unique_origins = []
        for origin in all_origins:
            if origin not in unique_origins:
                unique_origins.append(origin)
        
        return unique_origins
    
    def get_allowed_methods(self) -> List[str]:
        """Get allowed HTTP methods."""
        return self._allowed_methods.copy()
    
    def get_allowed_headers(self) -> List[str]:
        """Get allowed request headers."""
        return self._allowed_headers.copy()
    
    def get_exposed_headers(self) -> List[str]:
        """Get headers exposed to the client."""
        return self._exposed_headers.copy()
    
    def is_origin_allowed(self, origin: str) -> bool:
        """Check if a specific origin is allowed."""
        allowed_origins = self.get_allowed_origins()
        
        # Exact match
        if origin in allowed_origins:
            return True
        
        # Pattern matching for development
        if self.environment == "development":
            # Allow localhost with any port
            if re.match(r"^https?://localhost:\d+$", origin):
                return True
            if re.match(r"^https?://127\.0\.0\.1:\d+$", origin):
                return True
        
        return False
    
    def to_cors_kwargs(self) -> Dict[str, Any]:
        """Convert configuration to CORSMiddleware kwargs."""
        return {
            "allow_origins": self.get_allowed_origins(),
            "allow_credentials": self.allow_credentials,
            "allow_methods": self.get_allowed_methods(),
            "allow_headers": self.get_allowed_headers(),
            "expose_headers": self.get_exposed_headers(),
            "max_age": self.max_age
        }


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to responses."""
    
    def __init__(self, app: ASGIApp, environment: str = "development"):
        super().__init__(app)
        self.environment = environment.lower()
        
        # Define security headers based on environment
        self._security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "X-Permitted-Cross-Domain-Policies": "none",
        }
        
        # Add stricter headers for production
        if self.environment == "production":
            self._security_headers.update({
                "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
                "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
            })
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add security headers to the response."""
        response = await call_next(request)
        
        # Add security headers
        for header_name, header_value in self._security_headers.items():
            response.headers[header_name] = header_value
        
        # Add server identification (optional)
        response.headers["Server"] = "KG-QA-API/1.0"
        
        return response


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Middleware to handle correlation ID tracking for requests."""
    
    def __init__(self, app: ASGIApp, header_name: str = "X-Correlation-ID"):
        super().__init__(app)
        self.header_name = header_name
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add or extract correlation ID for request tracking."""
        # Try to get correlation ID from headers
        correlation_id = request.headers.get(self.header_name)
        
        # Generate new correlation ID if not provided
        if not correlation_id:
            import uuid
            correlation_id = f"req_{uuid.uuid4()}"
        
        # Store correlation ID in request state
        request.state.correlation_id = correlation_id
        
        # Process the request
        response = await call_next(request)
        
        # Add correlation ID to response headers
        response.headers[self.header_name] = correlation_id
        
        return response


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Middleware to track request processing times."""
    
    def __init__(self, app: ASGIApp, slow_request_threshold: float = 1.0):
        super().__init__(app)
        self.slow_request_threshold = slow_request_threshold
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Track request processing time and log slow requests."""
        start_time = time.time()
        
        # Add start time to request state
        request.state.start_time = start_time
        
        # Process the request
        response = await call_next(request)
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Add timing headers
        response.headers["X-Response-Time"] = f"{processing_time:.3f}s"
        
        # Log slow requests
        if processing_time > self.slow_request_threshold:
            correlation_id = getattr(request.state, "correlation_id", "unknown")
            logger.warning(
                f"Slow request detected: {processing_time:.3f}s",
                extra={
                    "processing_time": processing_time,
                    "correlation_id": correlation_id,
                    "path": request.url.path,
                    "method": request.method,
                    "slow_request": True,
                    "client_ip": request.client.host if request.client else None
                }
            )
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware for API protection."""
    
    def __init__(
        self,
        app: ASGIApp,
        requests_per_minute: int = 60,
        burst_limit: int = 10,
        enabled: bool = True
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_limit = burst_limit
        self.enabled = enabled
        
        # Simple in-memory storage (use Redis in production)
        self._requests: Dict[str, List[float]] = {}
        self._burst_requests: Dict[str, List[float]] = {}
    
    def _get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting."""
        # Try to get user ID from authentication
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user_{user_id}"
        
        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"
        return f"ip_{client_ip}"
    
    def _cleanup_old_requests(self, requests: List[float], window_seconds: int) -> List[float]:
        """Remove requests older than the time window."""
        current_time = time.time()
        cutoff_time = current_time - window_seconds
        return [req_time for req_time in requests if req_time > cutoff_time]
    
    def _is_rate_limited(self, client_id: str) -> tuple[bool, Dict[str, Any]]:
        """Check if client is rate limited."""
        current_time = time.time()
        
        # Check per-minute rate limit
        if client_id not in self._requests:
            self._requests[client_id] = []
        
        self._requests[client_id] = self._cleanup_old_requests(
            self._requests[client_id], 60
        )
        
        minute_requests = len(self._requests[client_id])
        
        # Check burst limit (requests per 10 seconds)
        if client_id not in self._burst_requests:
            self._burst_requests[client_id] = []
        
        self._burst_requests[client_id] = self._cleanup_old_requests(
            self._burst_requests[client_id], 10
        )
        
        burst_requests = len(self._burst_requests[client_id])
        
        # Check limits
        rate_limit_info = {
            "requests_per_minute": minute_requests,
            "requests_per_minute_limit": self.requests_per_minute,
            "burst_requests": burst_requests,
            "burst_limit": self.burst_limit,
            "reset_time": int(current_time) + 60
        }
        
        if minute_requests >= self.requests_per_minute or burst_requests >= self.burst_limit:
            return True, rate_limit_info
        
        # Record this request
        self._requests[client_id].append(current_time)
        self._burst_requests[client_id].append(current_time)
        
        return False, rate_limit_info
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Apply rate limiting to requests."""
        if not self.enabled:
            return await call_next(request)
        
        client_id = self._get_client_id(request)
        is_limited, rate_info = self._is_rate_limited(client_id)
        
        if is_limited:
            correlation_id = getattr(request.state, "correlation_id", "unknown")
            
            logger.warning(
                f"Rate limit exceeded for client: {client_id}",
                extra={
                    "client_id": client_id,
                    "correlation_id": correlation_id,
                    "path": request.url.path,
                    "method": request.method,
                    "rate_limit_info": rate_info
                }
            )
            
            from fastapi import HTTPException
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait before making another request.",
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(rate_info["reset_time"])
                }
            )
        
        # Process the request
        response = await call_next(request)
        
        # Add rate limit headers to response
        remaining = self.requests_per_minute - rate_info["requests_per_minute"]
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
        
        return response


def create_cors_middleware(
    environment: str = "development",
    custom_origins: Optional[List[str]] = None,
    allow_credentials: bool = True
) -> tuple[type, Dict[str, Any]]:
    """Create CORS middleware with enhanced configuration."""
    cors_config = EnhancedCORSConfiguration(
        environment=environment,
        custom_origins=custom_origins,
        allow_credentials=allow_credentials
    )
    
    cors_kwargs = cors_config.to_cors_kwargs()
    
    logger.info(
        "CORS middleware configured",
        extra={
            "environment": environment,
            "allowed_origins_count": len(cors_kwargs["allow_origins"]),
            "allow_credentials": cors_kwargs["allow_credentials"],
            "allowed_methods": cors_kwargs["allow_methods"]
        }
    )
    
    return CORSMiddleware, cors_kwargs


def setup_enhanced_middleware(
    app,
    environment: str = "development",
    cors_origins: Optional[List[str]] = None,
    enable_rate_limiting: bool = True,
    rate_limit_requests_per_minute: int = 60,
    slow_request_threshold: float = 1.0
) -> None:
    """Set up all enhanced middleware for the FastAPI application."""
    
    # 1. Add correlation ID middleware (should be first)
    app.add_middleware(CorrelationIDMiddleware)
    
    # 2. Add request timing middleware
    app.add_middleware(
        RequestTimingMiddleware,
        slow_request_threshold=slow_request_threshold
    )
    
    # 3. Add rate limiting middleware (if enabled)
    if enable_rate_limiting:
        app.add_middleware(
            RateLimitMiddleware,
            requests_per_minute=rate_limit_requests_per_minute,
            enabled=True
        )
    
    # 4. Add security headers middleware
    app.add_middleware(SecurityHeadersMiddleware, environment=environment)
    
    # 5. Add CORS middleware
    cors_middleware_class, cors_kwargs = create_cors_middleware(
        environment=environment,
        custom_origins=cors_origins
    )
    app.add_middleware(cors_middleware_class, **cors_kwargs)
    
    logger.info(
        "Enhanced middleware setup completed",
        extra={
            "environment": environment,
            "rate_limiting_enabled": enable_rate_limiting,
            "cors_enabled": True,
            "security_headers_enabled": True,
            "correlation_tracking_enabled": True,
            "timing_tracking_enabled": True
        }
    ) 