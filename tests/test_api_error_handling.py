"""
Tests for Enhanced API Error Handling and Middleware
This module tests the error handlers, CORS middleware, and other security middleware.
"""

import pytest
import uuid
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from starlette.datastructures import Headers

# Import the modules to test
from api_error_handlers import (
    ErrorType,
    ErrorResponse,
    generate_correlation_id,
    get_correlation_id,
    create_error_response,
    http_exception_handler,
    validation_exception_handler,
    timeout_exception_handler,
    provider_unavailable_exception_handler,
    rate_limit_exception_handler,
    context_overflow_exception_handler,
    general_exception_handler,
    ProviderUnavailableError,
    RateLimitError,
    LLMTimeoutError,
    ContextOverflowError
)

from api_middleware import (
    EnhancedCORSConfiguration,
    SecurityHeadersMiddleware,
    CorrelationIDMiddleware,
    RequestTimingMiddleware,
    RateLimitMiddleware,
    create_cors_middleware,
    setup_enhanced_middleware
)

from main import app


class TestErrorResponse:
    """Test the ErrorResponse model."""
    
    def test_error_response_creation(self):
        """Test creating an ErrorResponse instance."""
        response = ErrorResponse(
            error_type=ErrorType.VALIDATION,
            error_code="TEST_ERROR",
            message="Test error message",
            correlation_id="test-123",
            timestamp="2024-01-01T00:00:00Z"
        )
        
        assert response.error_type == ErrorType.VALIDATION
        assert response.error_code == "TEST_ERROR"
        assert response.message == "Test error message"
        assert response.correlation_id == "test-123"
        assert response.timestamp == "2024-01-01T00:00:00Z"
    
    def test_error_response_with_details(self):
        """Test ErrorResponse with additional details."""
        details = {"field": "test_field", "value": "invalid"}
        response = ErrorResponse(
            error_type=ErrorType.VALIDATION,
            error_code="FIELD_INVALID",
            message="Field validation failed",
            details=details,
            correlation_id="test-456",
            timestamp="2024-01-01T00:00:00Z"
        )
        
        assert response.details == details
        assert response.details["field"] == "test_field"


class TestCorrelationID:
    """Test correlation ID functionality."""
    
    def test_generate_correlation_id(self):
        """Test correlation ID generation."""
        correlation_id = generate_correlation_id()
        
        assert correlation_id.startswith("req_")
        assert len(correlation_id) > 10  # Should be UUID format
        
        # Test uniqueness
        another_id = generate_correlation_id()
        assert correlation_id != another_id
    
    def test_get_correlation_id_from_headers(self):
        """Test extracting correlation ID from request headers."""
        # Mock request with correlation ID in headers
        mock_request = Mock()
        mock_request.headers = {"X-Correlation-ID": "test-correlation-123"}
        mock_request.state = Mock()
        
        correlation_id = get_correlation_id(mock_request)
        assert correlation_id == "test-correlation-123"
    
    def test_get_correlation_id_from_state(self):
        """Test extracting correlation ID from request state."""
        mock_request = Mock()
        mock_request.headers = {}
        mock_request.state = Mock()
        mock_request.state.correlation_id = "state-correlation-456"
        
        correlation_id = get_correlation_id(mock_request)
        assert correlation_id == "state-correlation-456"
    
    def test_get_correlation_id_generate_new(self):
        """Test generating new correlation ID when none exists."""
        mock_request = Mock()
        mock_request.headers = {}
        mock_request.state = Mock()
        mock_request.state.correlation_id = None
        
        correlation_id = get_correlation_id(mock_request)
        assert correlation_id.startswith("req_")
        assert mock_request.state.correlation_id == correlation_id


class TestCreateErrorResponse:
    """Test error response creation utility."""
    
    def test_create_error_response_basic(self):
        """Test basic error response creation."""
        response = create_error_response(
            error_type=ErrorType.SERVER_ERROR,
            error_code="TEST_ERROR",
            message="Test message"
        )
        
        assert response.error_type == ErrorType.SERVER_ERROR
        assert response.error_code == "TEST_ERROR"
        assert response.message == "Test message"
        assert response.correlation_id.startswith("req_")
        assert response.timestamp is not None
    
    def test_create_error_response_with_request(self):
        """Test error response creation with request context."""
        mock_request = Mock()
        mock_request.url.path = "/test/path"
        mock_request.method = "POST"
        mock_request.state = Mock()
        
        response = create_error_response(
            error_type=ErrorType.VALIDATION,
            error_code="VALIDATION_ERROR",
            message="Validation failed",
            request=mock_request
        )
        
        assert response.path == "/test/path"
        assert response.method == "POST"
        assert hasattr(mock_request.state, 'correlation_id')


class TestExceptionHandlers:
    """Test the exception handler functions."""
    
    @pytest.mark.asyncio
    async def test_http_exception_handler(self):
        """Test HTTP exception handler."""
        mock_request = Mock()
        mock_request.url.path = "/test"
        mock_request.method = "GET"
        mock_request.headers = {}
        mock_request.client.host = "127.0.0.1"
        mock_request.state = Mock()
        
        exc = HTTPException(status_code=404, detail="Not found")
        
        response = await http_exception_handler(mock_request, exc)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == 404
        assert "X-Correlation-ID" in response.headers
        
        # Check response content
        content = response.body.decode()
        assert "not_found_error" in content
        assert "HTTP_404" in content
    
    @pytest.mark.asyncio
    async def test_validation_exception_handler(self):
        """Test validation exception handler."""
        mock_request = Mock()
        mock_request.url.path = "/test"
        mock_request.method = "POST"
        mock_request.headers = {}
        mock_request.state = Mock()
        
        # Create a mock validation error
        validation_errors = [
            {
                "loc": ("body", "field1"),
                "msg": "field required",
                "type": "value_error.missing"
            }
        ]
        
        with patch.object(RequestValidationError, 'errors', return_value=validation_errors):
            exc = RequestValidationError([])
            response = await validation_exception_handler(mock_request, exc)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == 422
        assert "X-Correlation-ID" in response.headers
    
    @pytest.mark.asyncio
    async def test_timeout_exception_handler(self):
        """Test timeout exception handler."""
        mock_request = Mock()
        mock_request.url.path = "/test"
        mock_request.method = "POST"
        mock_request.headers = {}
        mock_request.state = Mock()
        
        exc = LLMTimeoutError("Operation timed out")
        response = await timeout_exception_handler(mock_request, exc)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == 504
        assert "X-Correlation-ID" in response.headers
    
    @pytest.mark.asyncio
    async def test_provider_unavailable_exception_handler(self):
        """Test provider unavailable exception handler."""
        mock_request = Mock()
        mock_request.url.path = "/test"
        mock_request.method = "POST"
        mock_request.headers = {}
        mock_request.state = Mock()
        
        exc = ProviderUnavailableError("test_provider", "Provider is down")
        response = await provider_unavailable_exception_handler(mock_request, exc)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == 503
        assert "X-Correlation-ID" in response.headers
    
    @pytest.mark.asyncio
    async def test_rate_limit_exception_handler(self):
        """Test rate limit exception handler."""
        mock_request = Mock()
        mock_request.url.path = "/test"
        mock_request.method = "POST"
        mock_request.headers = {}
        mock_request.client.host = "127.0.0.1"
        mock_request.state = Mock()
        
        exc = RateLimitError("Rate limit exceeded")
        response = await rate_limit_exception_handler(mock_request, exc)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == 429
        assert "X-Correlation-ID" in response.headers
        assert "Retry-After" in response.headers
    
    @pytest.mark.asyncio
    async def test_general_exception_handler(self):
        """Test general exception handler."""
        mock_request = Mock()
        mock_request.url.path = "/test"
        mock_request.method = "POST"
        mock_request.headers = {}
        mock_request.client.host = "127.0.0.1"
        mock_request.state = Mock()
        
        exc = Exception("Unexpected error")
        response = await general_exception_handler(mock_request, exc)
        
        assert isinstance(response, JSONResponse)
        assert response.status_code == 500
        assert "X-Correlation-ID" in response.headers


class TestEnhancedCORSConfiguration:
    """Test the enhanced CORS configuration."""
    
    def test_cors_config_development(self):
        """Test CORS configuration for development environment."""
        config = EnhancedCORSConfiguration(environment="development")
        
        origins = config.get_allowed_origins()
        assert "http://localhost:3000" in origins
        assert "http://localhost:3001" in origins
        assert "http://127.0.0.1:3000" in origins
        
        methods = config.get_allowed_methods()
        assert "GET" in methods
        assert "POST" in methods
        assert "OPTIONS" in methods
    
    def test_cors_config_production(self):
        """Test CORS configuration for production environment."""
        config = EnhancedCORSConfiguration(environment="production")
        
        origins = config.get_allowed_origins()
        assert "https://example.com" in origins
        assert "https://www.example.com" in origins
        assert "http://localhost:3000" not in origins
    
    def test_cors_config_custom_origins(self):
        """Test CORS configuration with custom origins."""
        custom_origins = ["https://custom.example.com", "https://app.example.com"]
        config = EnhancedCORSConfiguration(
            environment="development",
            custom_origins=custom_origins
        )
        
        origins = config.get_allowed_origins()
        assert "https://custom.example.com" in origins
        assert "https://app.example.com" in origins
        assert "http://localhost:3000" in origins  # Should include base origins too
    
    def test_is_origin_allowed_exact_match(self):
        """Test exact origin matching."""
        config = EnhancedCORSConfiguration(environment="development")
        
        assert config.is_origin_allowed("http://localhost:3000")
        assert not config.is_origin_allowed("https://malicious.com")
    
    def test_is_origin_allowed_pattern_match(self):
        """Test pattern-based origin matching for development."""
        config = EnhancedCORSConfiguration(environment="development")
        
        # Should allow localhost with any port in development
        assert config.is_origin_allowed("http://localhost:4000")
        assert config.is_origin_allowed("http://127.0.0.1:5000")
        
        # But not in production
        config_prod = EnhancedCORSConfiguration(environment="production")
        assert not config_prod.is_origin_allowed("http://localhost:4000")
    
    def test_to_cors_kwargs(self):
        """Test conversion to CORS middleware kwargs."""
        config = EnhancedCORSConfiguration(environment="development")
        kwargs = config.to_cors_kwargs()
        
        assert "allow_origins" in kwargs
        assert "allow_credentials" in kwargs
        assert "allow_methods" in kwargs
        assert "allow_headers" in kwargs
        assert "expose_headers" in kwargs
        assert "max_age" in kwargs
        
        assert kwargs["allow_credentials"] is True
        assert isinstance(kwargs["allow_origins"], list)


class TestSecurityHeadersMiddleware:
    """Test the security headers middleware."""
    
    @pytest.mark.asyncio
    async def test_security_headers_development(self):
        """Test security headers in development environment."""
        mock_app = Mock()
        middleware = SecurityHeadersMiddleware(mock_app, environment="development")
        
        mock_request = Mock()
        mock_response = Mock()
        mock_response.headers = {}
        
        async def mock_call_next(request):
            return mock_response
        
        response = await middleware.dispatch(mock_request, mock_call_next)
        
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["X-XSS-Protection"] == "1; mode=block"
        assert response.headers["Server"] == "KG-QA-API/1.0"
        
        # Should not have strict headers in development
        assert "Strict-Transport-Security" not in response.headers
    
    @pytest.mark.asyncio
    async def test_security_headers_production(self):
        """Test security headers in production environment."""
        mock_app = Mock()
        middleware = SecurityHeadersMiddleware(mock_app, environment="production")
        
        mock_request = Mock()
        mock_response = Mock()
        mock_response.headers = {}
        
        async def mock_call_next(request):
            return mock_response
        
        response = await middleware.dispatch(mock_request, mock_call_next)
        
        # Should have all headers including strict ones
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["Strict-Transport-Security"] == "max-age=31536000; includeSubDomains"
        assert "Content-Security-Policy" in response.headers


class TestCorrelationIDMiddleware:
    """Test the correlation ID middleware."""
    
    @pytest.mark.asyncio
    async def test_correlation_id_middleware_generate(self):
        """Test that middleware generates correlation ID."""
        mock_app = Mock()
        middleware = CorrelationIDMiddleware(mock_app)
        
        mock_request = Mock()
        mock_request.headers = {}
        mock_request.state = Mock()
        
        mock_response = Mock()
        mock_response.headers = {}
        
        async def mock_call_next(request):
            return mock_response
        
        response = await middleware.dispatch(mock_request, mock_call_next)
        
        # Should have set correlation ID in state and headers
        assert hasattr(mock_request.state, 'correlation_id')
        correlation_id = mock_request.state.correlation_id
        assert correlation_id.startswith("req_")
        assert response.headers["X-Correlation-ID"] == correlation_id
    
    @pytest.mark.asyncio
    async def test_correlation_id_middleware_preserve_existing(self):
        """Test that middleware preserves existing correlation ID."""
        mock_app = Mock()
        middleware = CorrelationIDMiddleware(mock_app)
        
        existing_id = "existing-correlation-123"
        mock_request = Mock()
        mock_request.headers = {"X-Correlation-ID": existing_id}
        mock_request.state = Mock()
        
        mock_response = Mock()
        mock_response.headers = {}
        
        async def mock_call_next(request):
            return mock_response
        
        response = await middleware.dispatch(mock_request, mock_call_next)
        
        assert mock_request.state.correlation_id == existing_id
        assert response.headers["X-Correlation-ID"] == existing_id


class TestRequestTimingMiddleware:
    """Test the request timing middleware."""
    
    @pytest.mark.asyncio
    async def test_request_timing_middleware(self):
        """Test request timing functionality."""
        mock_app = Mock()
        middleware = RequestTimingMiddleware(mock_app, slow_request_threshold=0.1)
        
        mock_request = Mock()
        mock_request.state = Mock()
        
        mock_response = Mock()
        mock_response.headers = {}
        
        async def mock_call_next(request):
            # Simulate some processing time
            import asyncio
            await asyncio.sleep(0.01)
            return mock_response
        
        response = await middleware.dispatch(mock_request, mock_call_next)
        
        # Should have added timing headers
        assert "X-Response-Time" in response.headers
        assert response.headers["X-Response-Time"].endswith("s")
        
        # Should have set start time in request state
        assert hasattr(mock_request.state, 'start_time')


class TestRateLimitMiddleware:
    """Test the rate limiting middleware."""
    
    @pytest.mark.asyncio
    async def test_rate_limit_middleware_disabled(self):
        """Test rate limiting when disabled."""
        mock_app = Mock()
        middleware = RateLimitMiddleware(mock_app, enabled=False)
        
        mock_request = Mock()
        mock_response = Mock()
        
        async def mock_call_next(request):
            return mock_response
        
        response = await middleware.dispatch(mock_request, mock_call_next)
        assert response == mock_response  # Should pass through unchanged
    
    @pytest.mark.asyncio
    async def test_rate_limit_middleware_allow_request(self):
        """Test rate limiting allowing requests within limits."""
        mock_app = Mock()
        middleware = RateLimitMiddleware(
            mock_app, 
            requests_per_minute=10, 
            burst_limit=5,
            enabled=True
        )
        
        mock_request = Mock()
        mock_request.client.host = "127.0.0.1"
        mock_request.state = Mock()
        
        mock_response = Mock()
        mock_response.headers = {}
        
        async def mock_call_next(request):
            return mock_response
        
        response = await middleware.dispatch(mock_request, mock_call_next)
        
        # Should add rate limit headers
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers


class TestIntegrationWithFastAPI:
    """Integration tests with the actual FastAPI app."""
    
    def setup_method(self):
        """Set up test client."""
        self.client = TestClient(app)
    
    def test_health_endpoint_with_cors(self):
        """Test health endpoint with CORS headers."""
        response = self.client.get("/health")
        
        # Should have CORS headers
        assert "access-control-allow-origin" in response.headers
        
        # Should have correlation ID
        assert "x-correlation-id" in response.headers
        
        # Should have security headers
        assert "x-content-type-options" in response.headers
        assert "x-frame-options" in response.headers
        
        # Should have timing headers
        assert "x-response-time" in response.headers
    
    def test_cors_preflight_request(self):
        """Test CORS preflight OPTIONS request."""
        headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        }
        
        response = self.client.options("/chat", headers=headers)
        
        # Should allow the request
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers
    
    def test_validation_error_response(self):
        """Test validation error response format."""
        # Send invalid request to trigger validation error
        response = self.client.post("/chat", json={})
        
        assert response.status_code == 422
        
        data = response.json()
        assert "error_type" in data
        assert "error_code" in data
        assert "message" in data
        assert "correlation_id" in data
        assert "timestamp" in data
        
        assert data["error_type"] == "validation_error"
    
    def test_not_found_error_response(self):
        """Test 404 error response format."""
        response = self.client.get("/nonexistent")
        
        assert response.status_code == 404
        
        data = response.json()
        assert "error_type" in data
        assert "error_code" in data
        assert "correlation_id" in data
        
        assert data["error_type"] == "not_found_error"


if __name__ == "__main__":
    pytest.main([__file__]) 