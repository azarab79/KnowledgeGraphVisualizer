"""
Unit tests for the background task management system.

This module tests the BackgroundTaskManager and related functionality
for handling long-running QA pipeline operations.
"""

import pytest
import time
import uuid
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
import sys

# Mock the external dependencies before importing our module
sys.modules['kg_qa_pipeline_enhanced'] = Mock()
sys.modules['langchain_google_genai'] = Mock()
sys.modules['langchain_neo4j'] = Mock()
sys.modules['langchain_core.prompts'] = Mock()
sys.modules['langchain_core.documents'] = Mock()
sys.modules['langchain_core.output_parsers'] = Mock()
sys.modules['langchain.retrievers'] = Mock()
sys.modules['langchain_core.retrievers'] = Mock()
sys.modules['langchain_core.messages'] = Mock()
sys.modules['llm_abstraction'] = Mock()

from background_tasks import (
    BackgroundTaskManager, 
    BackgroundTask, 
    TaskStatus,
    get_task_manager,
    shutdown_task_manager
)


class TestBackgroundTask:
    """Tests for the BackgroundTask dataclass."""
    
    def test_background_task_creation(self):
        """Test BackgroundTask creation with default values."""
        task_id = str(uuid.uuid4())
        task = BackgroundTask(task_id=task_id)
        
        assert task.task_id == task_id
        assert task.status == TaskStatus.PENDING
        assert task.result is None
        assert task.error is None
        assert task.progress == 0.0
        assert task.timeout_seconds == 300
        assert isinstance(task.created_at, datetime)
        assert task.started_at is None
        assert task.completed_at is None
    
    def test_background_task_with_custom_values(self):
        """Test BackgroundTask creation with custom values."""
        task_id = str(uuid.uuid4())
        custom_timeout = 600
        
        task = BackgroundTask(
            task_id=task_id, 
            timeout_seconds=custom_timeout
        )
        
        assert task.task_id == task_id
        assert task.timeout_seconds == custom_timeout
        assert task.status == TaskStatus.PENDING


class TestBackgroundTaskManager:
    """Tests for the BackgroundTaskManager class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.manager = BackgroundTaskManager(max_workers=2, default_timeout=60)
    
    def teardown_method(self):
        """Clean up after tests."""
        if hasattr(self, 'manager'):
            self.manager.shutdown()
    
    def test_manager_initialization(self):
        """Test BackgroundTaskManager initialization."""
        assert self.manager.default_timeout == 60
        assert len(self.manager.tasks) == 0
        assert self.manager.executor._max_workers == 2
    
    def test_create_task(self):
        """Test task creation."""
        task_id = self.manager.create_task()
        
        assert task_id in self.manager.tasks
        task = self.manager.tasks[task_id]
        assert task.task_id == task_id
        assert task.status == TaskStatus.PENDING
        assert task.timeout_seconds == 60  # default
    
    def test_create_task_with_custom_timeout(self):
        """Test task creation with custom timeout."""
        custom_timeout = 120
        task_id = self.manager.create_task(timeout=custom_timeout)
        
        task = self.manager.tasks[task_id]
        assert task.timeout_seconds == custom_timeout
    
    def test_get_task_existing(self):
        """Test getting an existing task."""
        task_id = self.manager.create_task()
        
        retrieved_task = self.manager.get_task(task_id)
        
        assert retrieved_task is not None
        assert retrieved_task.task_id == task_id
    
    def test_get_task_nonexistent(self):
        """Test getting a non-existent task."""
        fake_task_id = str(uuid.uuid4())
        
        retrieved_task = self.manager.get_task(fake_task_id)
        
        assert retrieved_task is None
    
    def test_get_task_status_existing(self):
        """Test getting status of an existing task."""
        task_id = self.manager.create_task()
        
        status_info = self.manager.get_task_status(task_id)
        
        assert status_info["task_id"] == task_id
        assert status_info["status"] == "pending"
        assert status_info["progress"] == 0.0
        assert status_info["error"] is None
        assert status_info["has_result"] is False
        assert "created_at" in status_info
    
    def test_get_task_status_nonexistent(self):
        """Test getting status of a non-existent task."""
        fake_task_id = str(uuid.uuid4())
        
        status_info = self.manager.get_task_status(fake_task_id)
        
        assert "error" in status_info
        assert status_info["error"] == "Task not found"
    
    def test_get_task_result_completed(self):
        """Test getting result of a completed task."""
        task_id = self.manager.create_task()
        task = self.manager.tasks[task_id]
        
        # Simulate completed task
        task.status = TaskStatus.COMPLETED
        task.result = {"answer": "test answer", "processing_time": 1.5}
        
        result = self.manager.get_task_result(task_id)
        
        assert result == {"answer": "test answer", "processing_time": 1.5}
    
    def test_get_task_result_not_completed(self):
        """Test getting result of a non-completed task."""
        task_id = self.manager.create_task()
        
        result = self.manager.get_task_result(task_id)
        
        assert result is None
    
    def test_cancel_task_pending(self):
        """Test cancelling a pending task."""
        task_id = self.manager.create_task()
        
        cancelled = self.manager.cancel_task(task_id)
        
        assert cancelled is True
        task = self.manager.tasks[task_id]
        assert task.status == TaskStatus.FAILED
        assert task.error == "Task cancelled by user"
        assert task.completed_at is not None
    
    def test_cancel_task_completed(self):
        """Test cancelling a completed task (should fail)."""
        task_id = self.manager.create_task()
        task = self.manager.tasks[task_id]
        task.status = TaskStatus.COMPLETED
        
        cancelled = self.manager.cancel_task(task_id)
        
        assert cancelled is False
    
    def test_cancel_task_nonexistent(self):
        """Test cancelling a non-existent task."""
        fake_task_id = str(uuid.uuid4())
        
        cancelled = self.manager.cancel_task(fake_task_id)
        
        assert cancelled is False
    
    def test_cleanup_old_tasks(self):
        """Test cleanup of old completed tasks."""
        # Create a task and mark it as old
        task_id = self.manager.create_task()
        task = self.manager.tasks[task_id]
        task.status = TaskStatus.COMPLETED
        
        # Make the task appear old by setting completed_at to an old timestamp
        old_time = datetime.now(timezone.utc).timestamp() - 7200  # 2 hours ago
        task.completed_at = datetime.fromtimestamp(old_time, tz=timezone.utc)
        
        # Force cleanup by setting last cleanup to an old time
        self.manager._last_cleanup = old_time - 3700  # Force cleanup
        
        # Trigger cleanup
        self.manager._cleanup_old_tasks()
        
        # Task should be removed
        assert task_id not in self.manager.tasks


class TestQATaskProcessing:
    """Tests for QA task processing functionality."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.manager = BackgroundTaskManager(max_workers=2, default_timeout=60)
        self.mock_pipeline = Mock()
    
    def teardown_method(self):
        """Clean up after tests."""
        if hasattr(self, 'manager'):
            self.manager.shutdown()
    
    def test_submit_qa_task_invalid_task_id(self):
        """Test submitting QA task with invalid task ID."""
        fake_task_id = str(uuid.uuid4())
        
        # Should not raise exception but log error
        self.manager.submit_qa_task(
            task_id=fake_task_id,
            pipeline=self.mock_pipeline,
            question="Test question"
        )
        
        # No task should be found
        assert fake_task_id not in self.manager.tasks
    
    @patch('background_tasks.logger')
    def test_submit_qa_task_valid(self, mock_logger):
        """Test submitting valid QA task."""
        task_id = self.manager.create_task()
        
        self.manager.submit_qa_task(
            task_id=task_id,
            pipeline=self.mock_pipeline,
            question="Test question"
        )
        
        # Should log successful submission
        mock_logger.info.assert_called()
        
        # Task should exist
        assert task_id in self.manager.tasks
    
    def test_process_qa_question_success(self):
        """Test successful QA question processing."""
        task_id = self.manager.create_task()
        
        # Mock pipeline methods
        self.mock_pipeline.extract_entities.return_value = ["entity1", "entity2"]
        self.mock_pipeline.ensemble_retriever.invoke.return_value = [
            Mock(page_content="doc1"), Mock(page_content="doc2")
        ]
        self.mock_pipeline.generate_cypher_query.return_value = "MATCH (n) RETURN n"
        self.mock_pipeline.graph.query.return_value = [{"result": "test"}]
        self.mock_pipeline.synthesize_final_answer.return_value = "Test answer"
        self.mock_pipeline.conversation_id = "test-conv-id"
        
        # Process the question
        self.manager._process_qa_question(
            task_id=task_id,
            pipeline=self.mock_pipeline,
            question="Test question"
        )
        
        # Check task completion
        task = self.manager.tasks[task_id]
        assert task.status == TaskStatus.COMPLETED
        assert task.result is not None
        assert task.result["answer"] == "Test answer"
        assert task.result["entities_extracted"] == ["entity1", "entity2"]
        assert task.progress == 1.0
    
    def test_process_qa_question_failure(self):
        """Test QA question processing with failure."""
        task_id = self.manager.create_task()
        
        # Mock pipeline to raise exception
        self.mock_pipeline.extract_entities.side_effect = Exception("Test error")
        
        # Process the question
        self.manager._process_qa_question(
            task_id=task_id,
            pipeline=self.mock_pipeline,
            question="Test question"
        )
        
        # Check task failure
        task = self.manager.tasks[task_id]
        assert task.status == TaskStatus.FAILED
        assert task.error == "Test error"
        assert task.result is None
    
    def test_process_qa_question_timeout(self):
        """Test QA question processing with timeout."""
        # Create task with very short timeout
        task_id = self.manager.create_task(timeout=0.001)  # 1ms timeout
        
        # Mock pipeline with slow operations
        def slow_extract_entities(question):
            time.sleep(0.01)  # 10ms delay
            return ["entity"]
        
        self.mock_pipeline.extract_entities.side_effect = slow_extract_entities
        
        # Process the question
        self.manager._process_qa_question(
            task_id=task_id,
            pipeline=self.mock_pipeline,
            question="Test question"
        )
        
        # Check task timeout
        task = self.manager.tasks[task_id]
        assert task.status == TaskStatus.TIMEOUT
        assert "timed out" in task.error


class TestGlobalTaskManager:
    """Tests for global task manager functions."""
    
    def test_get_task_manager_singleton(self):
        """Test that get_task_manager returns the same instance."""
        manager1 = get_task_manager()
        manager2 = get_task_manager()
        
        assert manager1 is manager2
    
    def test_shutdown_task_manager(self):
        """Test shutting down the global task manager."""
        # Get the manager to initialize it
        manager = get_task_manager()
        assert manager is not None
        
        # Shutdown
        shutdown_task_manager()
        
        # Getting manager again should create a new instance
        new_manager = get_task_manager()
        assert new_manager is not manager


if __name__ == "__main__":
    pytest.main([__file__]) 