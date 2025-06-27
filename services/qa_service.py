"""
QA Service for Knowledge Graph Question Answering

This service provides a managed wrapper around the EnhancedQAPipeline,
implementing proper lifecycle management, connection pooling, and caching.
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional, List
from contextlib import asynccontextmanager

from .base import BaseService, ServiceHealth, ServiceStatus
from kg_qa_pipeline_enhanced import EnhancedQAPipeline, create_qa_pipeline

logger = logging.getLogger(__name__)


class QAService(BaseService):
    """
    QA Service that manages the Knowledge Graph QA Pipeline.
    
    Provides connection pooling, conversation management, and async interfaces
    for the QA pipeline functionality.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__("qa_service", config)
        
        # Configuration
        self.primary_provider = self.config.get('primary_provider', 'ollama')
        self.fallback_providers = self.config.get('fallback_providers', ['google_genai'])
        self.max_concurrent_requests = self.config.get('max_concurrent_requests', 10)
        self.conversation_timeout = self.config.get('conversation_timeout', 3600)  # 1 hour
        self.max_conversation_length = self.config.get('max_conversation_length', 100)
        
        # Service state
        self._pipeline: Optional[EnhancedQAPipeline] = None
        self._request_semaphore: Optional[asyncio.Semaphore] = None
        self._active_conversations: Dict[str, Dict[str, Any]] = {}
        self._conversation_cleanup_task: Optional[asyncio.Task] = None
        
        # Metrics
        self._request_count = 0
        self._success_count = 0
        self._error_count = 0
        self._total_processing_time = 0.0
        self._last_request_time: Optional[float] = None

    async def start(self) -> None:
        """Start the QA service."""
        logger.info("Initializing QA pipeline...")
        
        # Create the QA pipeline
        self._pipeline = create_qa_pipeline(
            primary_provider=self.primary_provider,
            fallback_providers=self.fallback_providers
        )
        
        # Initialize request semaphore for concurrency control
        self._request_semaphore = asyncio.Semaphore(self.max_concurrent_requests)
        
        # Start conversation cleanup task
        self._conversation_cleanup_task = asyncio.create_task(self._cleanup_conversations())
        
        logger.info(f"QA service started with {self.primary_provider} as primary provider")

    async def stop(self) -> None:
        """Stop the QA service."""
        logger.info("Stopping QA service...")
        
        # Cancel cleanup task
        if self._conversation_cleanup_task and not self._conversation_cleanup_task.done():
            self._conversation_cleanup_task.cancel()
            try:
                await self._conversation_cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Shutdown the pipeline
        if self._pipeline:
            self._pipeline.shutdown()
            self._pipeline = None
        
        # Clear active conversations
        self._active_conversations.clear()
        
        logger.info("QA service stopped")

    async def health_check(self) -> ServiceHealth:
        """Check the health of the QA service."""
        try:
            if not self._pipeline:
                return ServiceHealth(
                    status=self.status,
                    healthy=False,
                    last_check=time.time(),
                    error_message="QA pipeline not initialized"
                )
            
            # Try a simple health check
            health_question = "Health check"
            start_time = time.time()
            
            # Use a timeout for the health check
            try:
                async with asyncio.timeout(5.0):  # 5 second timeout
                    result = await self.process_question_async(
                        health_question, 
                        conversation_id="health_check",
                        timeout=5.0
                    )
                    
                response_time = time.time() - start_time
                
                return ServiceHealth(
                    status=self.status,
                    healthy=True,  
                    last_check=time.time(),
                    metadata={
                        'response_time': response_time,
                        'active_conversations': len(self._active_conversations),
                        'request_count': self._request_count,
                        'success_rate': self._success_count / max(1, self._request_count),
                        'average_processing_time': self._total_processing_time / max(1, self._success_count)
                    }
                )
                
            except asyncio.TimeoutError:
                return ServiceHealth(
                    status=self.status,
                    healthy=False,
                    last_check=time.time(),
                    error_message="Health check timeout"
                )
                
        except Exception as e:
            return ServiceHealth(
                status=ServiceStatus.ERROR,
                healthy=False,
                last_check=time.time(),
                error_message=str(e)
            )

    async def process_question_async(self, 
                                   question: str,
                                   conversation_id: Optional[str] = None,
                                   conversation_history: Optional[List[Dict[str, Any]]] = None,
                                   temperature: float = 0.2,
                                   max_tokens: Optional[int] = None,
                                   timeout: Optional[float] = None) -> Dict[str, Any]:
        """
        Process a question asynchronously with proper resource management.
        
        Args:
            question: The user's question
            conversation_id: Optional conversation identifier
            conversation_history: Previous conversation history
            temperature: LLM temperature setting
            max_tokens: Maximum response tokens
            timeout: Request timeout in seconds
            
        Returns:
            Dictionary containing the answer and metadata
        """
        if not self._pipeline:
            raise RuntimeError("QA service not initialized")
        
        # Use semaphore to limit concurrent requests
        async with self._request_semaphore:
            return await self._process_question_with_timeout(
                question=question,
                conversation_id=conversation_id,
                conversation_history=conversation_history,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout or self.config.get('default_timeout', 30.0)
            )

    async def _process_question_with_timeout(self,
                                           question: str,
                                           conversation_id: Optional[str] = None,
                                           conversation_history: Optional[List[Dict[str, Any]]] = None,
                                           temperature: float = 0.2,
                                           max_tokens: Optional[int] = None,
                                           timeout: float = 30.0) -> Dict[str, Any]:
        """Process question with timeout and metrics tracking."""
        
        start_time = time.time()
        self._request_count += 1
        self._last_request_time = start_time
        
        try:
            # Create a new event loop task for the synchronous pipeline
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    self._pipeline.process_question,
                    question
                ),
                timeout=timeout
            )
            
            # Update conversation tracking
            if conversation_id:
                self._active_conversations[conversation_id] = {
                    'last_activity': time.time(),
                    'question_count': self._active_conversations.get(conversation_id, {}).get('question_count', 0) + 1
                }
            
            # Update metrics
            processing_time = time.time() - start_time
            self._success_count += 1
            self._total_processing_time += processing_time
            
            # Add service metadata to result
            result['service_metadata'] = {
                'processing_time': processing_time,
                'conversation_id': conversation_id,
                'service_request_id': f"qa_{int(start_time * 1000)}"
            }
            
            logger.debug(f"Processed question successfully in {processing_time:.2f}s")
            return result
            
        except asyncio.TimeoutError:
            self._error_count += 1
            logger.error(f"Question processing timeout after {timeout}s")
            raise
        except Exception as e:
            self._error_count += 1
            logger.error(f"Error processing question: {e}")
            raise

    async def get_conversation_history(self, conversation_id: str) -> List[Dict[str, Any]]:
        """Get conversation history for a specific conversation."""
        # This is a placeholder - in a real implementation, you'd store conversation history
        # in a database or cache service
        return []

    async def clear_conversation_history(self, conversation_id: str) -> None:
        """Clear conversation history for a specific conversation."""
        if conversation_id in self._active_conversations:
            del self._active_conversations[conversation_id]

    async def _cleanup_conversations(self) -> None:
        """Background task to cleanup expired conversations."""
        while not self._shutdown_event.is_set():
            try:
                current_time = time.time()
                expired_conversations = []
                
                for conv_id, conv_data in self._active_conversations.items():
                    if current_time - conv_data['last_activity'] > self.conversation_timeout:
                        expired_conversations.append(conv_id)
                
                for conv_id in expired_conversations:
                    del self._active_conversations[conv_id]
                    logger.debug(f"Cleaned up expired conversation: {conv_id}")
                
                # Sleep for cleanup interval
                await asyncio.sleep(self.config.get('cleanup_interval', 300))  # 5 minutes
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in conversation cleanup: {e}")
                await asyncio.sleep(60)  # Wait before retrying

    def get_metrics(self) -> Dict[str, Any]:
        """Get service metrics."""
        return {
            'request_count': self._request_count,
            'success_count': self._success_count,
            'error_count': self._error_count,
            'success_rate': self._success_count / max(1, self._request_count),
            'average_processing_time': self._total_processing_time / max(1, self._success_count),
            'active_conversations': len(self._active_conversations),
            'last_request_time': self._last_request_time,
            'uptime': self.get_uptime()
        }

    def get_active_conversations(self) -> Dict[str, Dict[str, Any]]:
        """Get information about active conversations."""
        return self._active_conversations.copy()

    @asynccontextmanager
    async def conversation_context(self, conversation_id: str):
        """Context manager for conversation handling."""
        try:
            # Initialize conversation if needed
            if conversation_id not in self._active_conversations:
                self._active_conversations[conversation_id] = {
                    'last_activity': time.time(),
                    'question_count': 0
                }
            
            yield conversation_id
            
        finally:
            # Update last activity
            if conversation_id in self._active_conversations:
                self._active_conversations[conversation_id]['last_activity'] = time.time() 