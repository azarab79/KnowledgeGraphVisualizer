"""
Tests for the FastAPI application wrapping the QA pipeline.

This module contains unit and integration tests for all endpoints,
error handling, and the QA pipeline integration.
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from httpx import AsyncClient

# Import the FastAPI app and related components
from main import app, settings, get_qa_pipeline
from kg_qa_pipeline_enhanced import EnhancedQAPipeline


class TestFastAPIApp:
    """Test class for FastAPI application endpoints and functionality."""
    
    def setup_method(self):
        """Set up test environment before each test method."""
        self.client = TestClient(app)
        
        # Mock QA pipeline for testing
        self.mock_pipeline = Mock(spec=EnhancedQAPipeline)
        self.mock_pipeline.conversation_id = "test_conversation"
        self.mock_pipeline.process_question.return_value = {
            "answer": "Test answer from pipeline",
            "entities_extracted": ["entity1", "entity2"],
            "processing_time": 1.5,
            "sources_used": ["source1", "source2"],
            "conversation_id": "test_conversation"
        }
        
        # Mock health checks
        self.mock_pipeline.llm_manager = Mock()
        self.mock_pipeline.llm_manager.health_check.return_value = {"status": "healthy"}
        self.mock_pipeline.graph = Mock()
        self.mock_pipeline.graph.query.return_value = [{"test": 1}]
    
    def test_health_endpoint_success(self):
        """Test the /health endpoint returns healthy status."""
        with patch('main.qa_pipeline', self.mock_pipeline):
            response = self.client.get("/health")
            
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data
        assert "services" in data
        assert "uptime" in data
        
        # Check individual service statuses
        services = data["services"]
        assert services["api"] == "healthy"
        assert services["qa_pipeline"] == "healthy"
        assert services["llm_abstraction"] == "healthy"
        assert services["neo4j"] == "healthy"
    
    def test_health_endpoint_degraded(self):
        """Test the /health endpoint returns degraded status when services fail."""
        # Mock LLM manager failure
        self.mock_pipeline.llm_manager.health_check.side_effect = Exception("LLM failure")
        
        with patch('main.qa_pipeline', self.mock_pipeline):
            response = self.client.get("/health")
            
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "degraded"
        assert data["services"]["llm_abstraction"] == "unhealthy"
    
    def test_health_endpoint_no_pipeline(self):
        """Test the /health endpoint when QA pipeline is not initialized."""
        with patch('main.qa_pipeline', None):
            response = self.client.get("/health")
            
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "unhealthy"
        assert data["services"]["qa_pipeline"] == "unhealthy"
    
    def test_chat_endpoint_success(self):
        """Test successful chat request processing."""
        request_data = {
            "question": "What is the difference between risk reversal strategies?",
            "conversation_id": "test_conv_123",
            "temperature": 0.3
        }
        
        with patch('main.get_qa_pipeline', return_value=self.mock_pipeline):
            response = self.client.post("/chat", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["answer"] == "Test answer from pipeline"
        assert data["conversation_id"] == "test_conv_123"
        assert data["entities_extracted"] == ["entity1", "entity2"]
        assert "processing_time" in data
        assert data["sources_used"] == ["source1", "source2"]
        assert "confidence_score" in data
        
        # Verify the pipeline was called correctly
        self.mock_pipeline.process_question.assert_called_once_with(
            "What is the difference between risk reversal strategies?"
        )
    
    def test_chat_endpoint_auto_conversation_id(self):
        """Test chat endpoint generates conversation ID when not provided."""
        request_data = {
            "question": "Test question without conversation ID"
        }
        
        with patch('main.get_qa_pipeline', return_value=self.mock_pipeline):
            response = self.client.post("/chat", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have generated a conversation ID
        assert "conversation_id" in data
        assert len(data["conversation_id"]) > 0
        assert data["conversation_id"] != "test_conversation"  # Should be newly generated
    
    def test_chat_endpoint_validation_errors(self):
        """Test chat endpoint request validation."""
        # Test empty question
        response = self.client.post("/chat", json={"question": ""})
        assert response.status_code == 422
        
        # Test question too long
        long_question = "x" * 2001
        response = self.client.post("/chat", json={"question": long_question})
        assert response.status_code == 422
        
        # Test invalid temperature
        response = self.client.post("/chat", json={
            "question": "valid question",
            "temperature": 1.5  # Above maximum
        })
        assert response.status_code == 422
    
    def test_chat_endpoint_pipeline_error(self):
        """Test chat endpoint handles pipeline processing errors."""
        self.mock_pipeline.process_question.side_effect = Exception("Pipeline processing error")
        
        request_data = {"question": "Test question"}
        
        with patch('main.get_qa_pipeline', return_value=self.mock_pipeline):
            response = self.client.post("/chat", json=request_data)
        
        assert response.status_code == 500
        data = response.json()
        assert "Internal server error" in data["detail"]
    
    def test_chat_endpoint_no_pipeline(self):
        """Test chat endpoint when QA pipeline is not available."""
        with patch('main.get_qa_pipeline', side_effect=Exception("Pipeline not initialized")):
            response = self.client.post("/chat", json={"question": "test"})
        
        assert response.status_code == 500
    
    def test_conversation_history_endpoint(self):
        """Test the conversation history endpoint."""
        conversation_id = "test_conv_456"
        mock_history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ]
        
        self.mock_pipeline.llm_manager.get_conversation_history.return_value = mock_history
        
        with patch('main.get_qa_pipeline', return_value=self.mock_pipeline):
            response = self.client.get(f"/chat/history/{conversation_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["conversation_id"] == conversation_id
        assert data["history"] == mock_history
        
        self.mock_pipeline.llm_manager.get_conversation_history.assert_called_once_with(conversation_id)
    
    def test_conversation_history_no_llm_manager(self):
        """Test conversation history endpoint when LLM manager is not available."""
        self.mock_pipeline.llm_manager = None
        
        with patch('main.get_qa_pipeline', return_value=self.mock_pipeline):
            response = self.client.get("/chat/history/test_conv")
        
        assert response.status_code == 200
        data = response.json()
        assert data["history"] == []
    
    def test_cors_headers(self):
        """Test CORS headers are properly set."""
        response = self.client.options("/health", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET"
        })
        
        assert response.status_code == 200
        # Note: TestClient might not fully simulate CORS middleware
        # In a real test, you'd check for Access-Control-Allow-Origin headers
    
    def test_request_with_conversation_history(self):
        """Test chat request with conversation history."""
        request_data = {
            "question": "Continue our discussion",
            "conversation_history": [
                {"role": "user", "content": "Previous question"},
                {"role": "assistant", "content": "Previous answer"}
            ],
            "conversation_id": "ongoing_conv"
        }
        
        with patch('main.get_qa_pipeline', return_value=self.mock_pipeline):
            response = self.client.post("/chat", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["conversation_id"] == "ongoing_conv"
    
    def test_error_handler(self):
        """Test general exception handler."""
        # This is harder to test directly, but we can test indirectly
        # through other endpoints that might raise exceptions
        pass


class TestAsyncEndpoints:
    """Test class for async endpoint behavior."""
    
    @pytest.mark.asyncio
    async def test_async_chat_processing(self):
        """Test that chat processing doesn't block the event loop."""
        mock_pipeline = Mock(spec=EnhancedQAPipeline)
        mock_pipeline.conversation_id = "async_test"
        mock_pipeline.process_question.return_value = {
            "answer": "Async test answer",
            "entities_extracted": [],
            "processing_time": 2.0,
            "sources_used": [],
            "conversation_id": "async_test"
        }
        
        # Simulate a slow processing function
        def slow_process(question):
            import time
            time.sleep(0.1)  # Simulate processing time
            return mock_pipeline.process_question.return_value
        
        mock_pipeline.process_question = slow_process
        
        with patch('main.get_qa_pipeline', return_value=mock_pipeline):
            async with AsyncClient(app=app, base_url="http://test") as ac:
                # Make multiple concurrent requests
                tasks = [
                    ac.post("/chat", json={"question": f"Question {i}"})
                    for i in range(3)
                ]
                
                responses = await asyncio.gather(*tasks)
                
                # All requests should succeed
                for response in responses:
                    assert response.status_code == 200


class TestSettings:
    """Test configuration and settings."""
    
    def test_default_settings(self):
        """Test default application settings."""
        from main import Settings
        
        test_settings = Settings()
        
        assert test_settings.host == "0.0.0.0"
        assert test_settings.port == 8000
        assert test_settings.debug is False
        assert "http://localhost:3000" in test_settings.cors_origins
        assert test_settings.primary_llm_provider == "ollama"
        assert "google_genai" in test_settings.fallback_llm_providers
    
    def test_settings_from_env(self):
        """Test settings loading from environment variables."""
        import os
        from main import Settings
        
        # Set environment variables
        test_env = {
            "HOST": "127.0.0.1",
            "PORT": "9000",
            "DEBUG": "true",
            "PRIMARY_LLM_PROVIDER": "azure_openai"
        }
        
        for key, value in test_env.items():
            os.environ[key] = value
        
        try:
            test_settings = Settings()
            
            assert test_settings.host == "127.0.0.1"
            assert test_settings.port == 9000
            assert test_settings.debug is True
            assert test_settings.primary_llm_provider == "azure_openai"
        finally:
            # Clean up environment variables
            for key in test_env:
                os.environ.pop(key, None)


class TestIntegration:
    """Integration tests that test the full application stack."""
    
    def test_full_chat_integration(self):
        """Test full chat flow with mocked QA pipeline components."""
        # This test would require more setup to mock the entire pipeline
        # For now, we'll do a basic integration test
        
        request_data = {
            "question": "What is a forex trading strategy?",
            "conversation_id": "integration_test"
        }
        
        # Mock the entire pipeline creation and processing
        mock_result = {
            "answer": "A forex trading strategy is a systematic approach...",
            "entities_extracted": ["forex", "strategy", "trading"],
            "processing_time": 1.2,
            "sources_used": ["vector_search", "graph_query"],
            "conversation_id": "integration_test"
        }
        
        with patch('kg_qa_pipeline_enhanced.create_qa_pipeline') as mock_create:
            mock_pipeline = Mock()
            mock_pipeline.process_question.return_value = mock_result
            mock_pipeline.llm_manager.health_check.return_value = {"status": "healthy"}
            mock_pipeline.graph.query.return_value = [{"test": 1}]
            mock_create.return_value = mock_pipeline
            
            client = TestClient(app)
            
            # Test health check first
            health_response = client.get("/health")
            assert health_response.status_code == 200
            
            # Test chat endpoint
            chat_response = client.post("/chat", json=request_data)
            assert chat_response.status_code == 200
            
            data = chat_response.json()
            assert "forex trading strategy" in data["answer"].lower()
            assert data["conversation_id"] == "integration_test"


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"]) 