"""
Background Task Management for QA Pipeline

This module provides background task functionality for long-running operations
in the QA pipeline, preventing blocking of the main request-response cycle.
"""

import asyncio
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor
import logging

from kg_qa_pipeline_enhanced import EnhancedQAPipeline

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Status of a background task."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class BackgroundTask:
    """Represents a background task."""
    task_id: str
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: float = 0.0  # Progress percentage (0.0 to 1.0)
    timeout_seconds: int = 300  # 5 minutes default timeout


class BackgroundTaskManager:
    """
    Manages background tasks for the QA pipeline operations.
    
    This provides a simple in-memory task queue with status tracking,
    suitable for single-instance deployments. For production with multiple
    instances, consider using Redis or a proper task queue like Celery.
    """
    
    def __init__(self, max_workers: int = 4, default_timeout: int = 300):
        """
        Initialize the background task manager.
        
        Args:
            max_workers: Maximum number of concurrent background tasks
            default_timeout: Default timeout for tasks in seconds
        """
        self.tasks: Dict[str, BackgroundTask] = {}
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.default_timeout = default_timeout
        self._cleanup_interval = 3600  # Clean up completed tasks after 1 hour
        self._last_cleanup = time.time()
        
    def create_task(self, timeout: Optional[int] = None) -> str:
        """
        Create a new background task and return its ID.
        
        Args:
            timeout: Task timeout in seconds
            
        Returns:
            str: Unique task ID
        """
        task_id = str(uuid.uuid4())
        task = BackgroundTask(
            task_id=task_id,
            timeout_seconds=timeout or self.default_timeout
        )
        self.tasks[task_id] = task
        
        logger.info(f"Created background task {task_id}")
        return task_id
    
    def get_task(self, task_id: str) -> Optional[BackgroundTask]:
        """
        Get task information by ID.
        
        Args:
            task_id: Task ID
            
        Returns:
            BackgroundTask or None if not found
        """
        self._cleanup_old_tasks()
        return self.tasks.get(task_id)
    
    def submit_qa_task(self, 
                       task_id: str, 
                       pipeline: EnhancedQAPipeline, 
                       question: str,
                       conversation_history: Optional[list] = None) -> None:
        """
        Submit a QA pipeline task for background processing.
        
        Args:
            task_id: Task ID
            pipeline: QA pipeline instance
            question: User question
            conversation_history: Optional conversation history
        """
        task = self.tasks.get(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return
            
        # Submit the task to the thread pool
        future = self.executor.submit(
            self._process_qa_question, 
            task_id, 
            pipeline, 
            question, 
            conversation_history
        )
        
        logger.info(f"Submitted QA task {task_id} for background processing")
    
    def _process_qa_question(self, 
                            task_id: str, 
                            pipeline: EnhancedQAPipeline, 
                            question: str,
                            conversation_history: Optional[list] = None) -> None:
        """
        Process a QA question in the background.
        
        Args:
            task_id: Task ID
            pipeline: QA pipeline instance  
            question: User question
            conversation_history: Optional conversation history
        """
        task = self.tasks.get(task_id)
        if not task:
            logger.error(f"Task {task_id} not found during processing")
            return
            
        try:
            # Update task status
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.now(timezone.utc)
            task.progress = 0.1
            
            logger.info(f"Starting QA processing for task {task_id}")
            
            # Check for timeout
            start_time = time.time()
            
            # Step 1: Extract entities (20% progress)
            task.progress = 0.2
            entities = pipeline.extract_entities(question)
            
            if time.time() - start_time > task.timeout_seconds:
                raise TimeoutError(f"Task {task_id} timed out during entity extraction")
            
            # Step 2: Retrieve context (40% progress)  
            task.progress = 0.4
            context_docs = pipeline.ensemble_retriever.invoke(question)
            context = "\n\n".join([doc.page_content for doc in context_docs])
            
            if time.time() - start_time > task.timeout_seconds:
                raise TimeoutError(f"Task {task_id} timed out during context retrieval")
            
            # Step 3: Generate Cypher query (60% progress)
            task.progress = 0.6
            cypher_query = pipeline.generate_cypher_query(question, entities)
            
            if time.time() - start_time > task.timeout_seconds:
                raise TimeoutError(f"Task {task_id} timed out during Cypher generation")
            
            # Step 4: Execute graph query (80% progress)
            task.progress = 0.8
            graph_result = ""
            if cypher_query:
                try:
                    graph_data = pipeline.graph.query(cypher_query)
                    graph_result = str(graph_data)
                except Exception as e:
                    logger.warning(f"Graph query failed for task {task_id}: {e}")
                    graph_result = "Error executing graph query."
            
            if time.time() - start_time > task.timeout_seconds:
                raise TimeoutError(f"Task {task_id} timed out during graph query")
                
            # Step 5: Synthesize final answer (100% progress)
            task.progress = 0.9
            final_answer = pipeline.synthesize_final_answer(question, context, graph_result)
            
            processing_time = time.time() - start_time
            
            # Complete the task
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now(timezone.utc)
            task.progress = 1.0
            task.result = {
                "answer": final_answer,
                "entities_extracted": entities,
                "processing_time": processing_time,
                "cypher_query": cypher_query,
                "sources_used": [
                    f"Vector search ({len(context_docs)} documents)",
                    "Graph database query" if graph_result and "Error" not in graph_result else "Graph query failed"
                ],
                "conversation_id": pipeline.conversation_id
            }
            
            logger.info(f"Completed QA processing for task {task_id} in {processing_time:.2f}s")
            
        except TimeoutError as e:
            task.status = TaskStatus.TIMEOUT
            task.error = str(e)
            task.completed_at = datetime.now(timezone.utc)
            logger.error(f"Task {task_id} timed out: {e}")
            
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.now(timezone.utc)
            logger.error(f"Task {task_id} failed: {e}")
    
    def _cleanup_old_tasks(self) -> None:
        """Clean up old completed tasks to prevent memory leaks."""
        current_time = time.time()
        
        if current_time - self._last_cleanup < self._cleanup_interval:
            return
            
        cutoff_time = datetime.now(timezone.utc).timestamp() - self._cleanup_interval
        
        tasks_to_remove = []
        for task_id, task in self.tasks.items():
            if (task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.TIMEOUT] and
                task.completed_at and task.completed_at.timestamp() < cutoff_time):
                tasks_to_remove.append(task_id)
        
        for task_id in tasks_to_remove:
            del self.tasks[task_id]
            logger.info(f"Cleaned up old task {task_id}")
        
        self._last_cleanup = current_time
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get detailed task status information.
        
        Args:
            task_id: Task ID
            
        Returns:
            Dict with task status information
        """
        task = self.get_task(task_id)
        if not task:
            return {"error": "Task not found"}
        
        return {
            "task_id": task.task_id,
            "status": task.status.value,
            "progress": task.progress,
            "created_at": task.created_at.isoformat(),
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "error": task.error,
            "has_result": task.result is not None
        }
    
    def get_task_result(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get task result if completed.
        
        Args:
            task_id: Task ID
            
        Returns:
            Task result or None if not completed
        """
        task = self.get_task(task_id)
        if not task or task.status != TaskStatus.COMPLETED:
            return None
        
        return task.result
    
    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a pending or running task.
        
        Args:
            task_id: Task ID
            
        Returns:
            bool: True if cancelled, False if not found or already completed
        """
        task = self.get_task(task_id)
        if not task or task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.TIMEOUT]:
            return False
        
        task.status = TaskStatus.FAILED
        task.error = "Task cancelled by user"
        task.completed_at = datetime.now(timezone.utc)
        
        logger.info(f"Cancelled task {task_id}")
        return True
    
    def shutdown(self) -> None:
        """Shutdown the task manager and clean up resources."""
        logger.info("Shutting down background task manager")
        self.executor.shutdown(wait=True)


# Global task manager instance
_task_manager: Optional[BackgroundTaskManager] = None


def get_task_manager() -> BackgroundTaskManager:
    """Get the global task manager instance."""
    global _task_manager
    if _task_manager is None:
        _task_manager = BackgroundTaskManager()
    return _task_manager


def shutdown_task_manager() -> None:
    """Shutdown the global task manager."""
    global _task_manager
    if _task_manager:
        _task_manager.shutdown()
        _task_manager = None 