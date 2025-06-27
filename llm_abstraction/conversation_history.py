"""
Conversation History Management for LLM Abstraction Layer.

This module handles conversation history tracking, memory management,
and context window optimization for multi-turn dialogues.
"""

import logging
import json
import os
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from pathlib import Path

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain.memory import ConversationBufferWindowMemory
from langchain_core.memory import BaseMemory

logger = logging.getLogger(__name__)


class PersistentConversationHistory:
    """
    Enhanced conversation history management with persistence support.
    
    This class handles storing conversation exchanges, managing context windows,
    implementing intelligent truncation strategies, and provides persistence
    options for production use.
    """
    
    def __init__(
        self, 
        max_history_tokens: int = 128000,  # Optimized for deepseek-r1:8b
        persistence_type: str = "memory",  # "memory", "file", or "database"
        storage_path: Optional[str] = None,
        cleanup_after_hours: int = 24,
        enable_langchain_memory: bool = True
    ):
        """
        Initialize enhanced conversation history manager.
        
        Args:
            max_history_tokens: Maximum tokens to keep in history (128K for deepseek-r1:8b)
            persistence_type: Storage type ("memory", "file", "database")
            storage_path: Path for file-based storage
            cleanup_after_hours: Hours after which inactive sessions are cleaned up
            enable_langchain_memory: Whether to use LangChain memory modules
        """
        self.max_history_tokens = max_history_tokens
        self.persistence_type = persistence_type
        self.storage_path = storage_path or ".conversation_history"
        self.cleanup_after_hours = cleanup_after_hours
        self.enable_langchain_memory = enable_langchain_memory
        
        # Core storage
        self._sessions: Dict[str, List[BaseMessage]] = {}
        self._system_messages: Dict[str, SystemMessage] = {}
        self._session_metadata: Dict[str, Dict[str, Any]] = {}
        
        # LangChain memory integration
        self._langchain_memories: Dict[str, BaseMemory] = {}
        
        # Initialize persistence
        self._initialize_persistence()
        
        logger.info(f"Initialized Enhanced ConversationHistory:")
        logger.info(f"  - Max tokens: {max_history_tokens}")
        logger.info(f"  - Persistence: {persistence_type}")
        logger.info(f"  - LangChain memory: {enable_langchain_memory}")
        logger.info(f"  - Storage path: {self.storage_path}")
    
    def _initialize_persistence(self):
        """Initialize persistence layer based on configuration."""
        if self.persistence_type == "file":
            # Create storage directory
            Path(self.storage_path).mkdir(parents=True, exist_ok=True)
            
            # Load existing sessions
            self._load_from_file()
            
        elif self.persistence_type == "database":
            # Database initialization would go here
            logger.warning("Database persistence not yet implemented, using memory")
            self.persistence_type = "memory"
    
    def _load_from_file(self):
        """Load conversation history from file storage."""
        try:
            sessions_file = Path(self.storage_path) / "sessions.json"
            metadata_file = Path(self.storage_path) / "metadata.json"
            
            if sessions_file.exists():
                with open(sessions_file, 'r') as f:
                    session_data = json.load(f)
                
                # Reconstruct messages from JSON
                for session_id, messages_data in session_data.items():
                    self._sessions[session_id] = []
                    for msg_data in messages_data:
                        if msg_data['type'] == 'human':
                            self._sessions[session_id].append(HumanMessage(content=msg_data['content']))
                        elif msg_data['type'] == 'ai':
                            self._sessions[session_id].append(AIMessage(content=msg_data['content']))
                        elif msg_data['type'] == 'system':
                            self._system_messages[session_id] = SystemMessage(content=msg_data['content'])
            
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    self._session_metadata = json.load(f)
            
            logger.info(f"Loaded {len(self._sessions)} sessions from file storage")
            
        except Exception as e:
            logger.error(f"Error loading conversation history from file: {e}")
    
    def _save_to_file(self):
        """Save conversation history to file storage."""
        if self.persistence_type != "file":
            return
        
        try:
            sessions_file = Path(self.storage_path) / "sessions.json"
            metadata_file = Path(self.storage_path) / "metadata.json"
            
            # Convert messages to JSON-serializable format
            session_data = {}
            for session_id, messages in self._sessions.items():
                session_data[session_id] = []
                for msg in messages:
                    if isinstance(msg, HumanMessage):
                        session_data[session_id].append({'type': 'human', 'content': msg.content})
                    elif isinstance(msg, AIMessage):
                        session_data[session_id].append({'type': 'ai', 'content': msg.content})
            
            # Add system messages
            for session_id, system_msg in self._system_messages.items():
                if session_id not in session_data:
                    session_data[session_id] = []
                session_data[session_id].insert(0, {'type': 'system', 'content': system_msg.content})
            
            with open(sessions_file, 'w') as f:
                json.dump(session_data, f, indent=2)
            
            with open(metadata_file, 'w') as f:
                json.dump(self._session_metadata, f, indent=2)
            
        except Exception as e:
            logger.error(f"Error saving conversation history to file: {e}")
    
    def add_exchange(
        self, 
        conversation_id: str, 
        human_message: str, 
        ai_response: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Add a conversation exchange (user message + AI response).
        
        Args:
            conversation_id: Session identifier
            human_message: User's message content
            ai_response: AI's response content
            metadata: Optional metadata for the exchange
        """
        if conversation_id not in self._sessions:
            self._sessions[conversation_id] = []
            self._session_metadata[conversation_id] = {
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
                "exchange_count": 0
            }
        
        # Create message objects
        user_msg = HumanMessage(content=human_message)
        ai_msg = AIMessage(content=ai_response)
        
        # Add the exchange
        self._sessions[conversation_id].extend([user_msg, ai_msg])
        
        # Update metadata
        self._session_metadata[conversation_id]["last_updated"] = datetime.now().isoformat()
        self._session_metadata[conversation_id]["exchange_count"] += 1
        
        if metadata:
            self._session_metadata[conversation_id].update(metadata)
        
        # Handle LangChain memory integration
        if self.enable_langchain_memory:
            self._update_langchain_memory(conversation_id, human_message, ai_response)
        
        # Truncate if needed
        self._truncate_session(conversation_id)
        
        # Persist changes
        self._save_to_file()
        
        logger.debug(f"Added exchange to session {conversation_id}. Total messages: {len(self._sessions[conversation_id])}")
    
    def _update_langchain_memory(self, conversation_id: str, human_input: str, ai_output: str):
        """Update LangChain memory for the session."""
        if conversation_id not in self._langchain_memories:
            # Create appropriate memory type based on context window size
            if self.max_history_tokens >= 100000:  # Large context window (like deepseek-r1:8b)
                # Use buffer memory with large window for 128K context models
                self._langchain_memories[conversation_id] = ConversationBufferWindowMemory(
                    k=50,  # Keep last 50 exchanges (100 messages)
                    return_messages=True
                )
            else:
                # Use simple buffer memory for smaller context windows
                # ConversationSummaryBufferMemory requires an LLM instance
                self._langchain_memories[conversation_id] = ConversationBufferWindowMemory(
                    k=10,  # Keep last 10 exchanges for smaller contexts
                    return_messages=True
                )
        
        memory = self._langchain_memories[conversation_id]
        memory.save_context({"input": human_input}, {"output": ai_output})
    
    def get_history(self, conversation_id: str) -> List[BaseMessage]:
        """
        Get conversation history for a session.
        
        Args:
            conversation_id: Session identifier
            
        Returns:
            List of messages in chronological order
        """
        messages = []
        
        # Add system message if exists
        if conversation_id in self._system_messages:
            messages.append(self._system_messages[conversation_id])
        
        # Add conversation history
        if conversation_id in self._sessions:
            messages.extend(self._sessions[conversation_id])
        
        return messages
    
    def get_langchain_memory(self, conversation_id: str) -> Optional[BaseMemory]:
        """
        Get LangChain memory object for a session.
        
        Args:
            conversation_id: Session identifier
            
        Returns:
            LangChain memory object or None
        """
        return self._langchain_memories.get(conversation_id)
    
    def set_system_message(self, conversation_id: str, system_message: str):
        """
        Set system message for a session.
        
        Args:
            conversation_id: Session identifier
            system_message: System message content
        """
        self._system_messages[conversation_id] = SystemMessage(content=system_message)
        
        # Update metadata
        if conversation_id not in self._session_metadata:
            self._session_metadata[conversation_id] = {
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
                "exchange_count": 0
            }
        
        self._session_metadata[conversation_id]["system_message_set"] = True
        self._session_metadata[conversation_id]["last_updated"] = datetime.now().isoformat()
        
        # Persist changes
        self._save_to_file()
        
        logger.debug(f"Set system message for session {conversation_id}")
    
    def clear_session(self, conversation_id: str):
        """
        Clear history for a specific session.
        
        Args:
            conversation_id: Session identifier
        """
        if conversation_id in self._sessions:
            del self._sessions[conversation_id]
        if conversation_id in self._system_messages:
            del self._system_messages[conversation_id]
        if conversation_id in self._session_metadata:
            del self._session_metadata[conversation_id]
        if conversation_id in self._langchain_memories:
            del self._langchain_memories[conversation_id]
        
        # Persist changes
        self._save_to_file()
        
        logger.debug(f"Cleared session {conversation_id}")
    
    def clear_all(self):
        """Clear all conversation history."""
        self._sessions.clear()
        self._system_messages.clear()
        self._session_metadata.clear()
        self._langchain_memories.clear()
        
        # Persist changes
        self._save_to_file()
        
        logger.debug("Cleared all conversation history")
    
    def cleanup_old_sessions(self) -> int:
        """
        Clean up old inactive sessions.
        
        Returns:
            Number of sessions cleaned up
        """
        cutoff_time = datetime.now() - timedelta(hours=self.cleanup_after_hours)
        sessions_to_remove = []
        
        for session_id, metadata in self._session_metadata.items():
            last_updated = datetime.fromisoformat(metadata.get("last_updated", "1970-01-01"))
            if last_updated < cutoff_time:
                sessions_to_remove.append(session_id)
        
        for session_id in sessions_to_remove:
            self.clear_session(session_id)
        
        logger.info(f"Cleaned up {len(sessions_to_remove)} old sessions")
        return len(sessions_to_remove)
    
    def get_session_count(self) -> int:
        """Get number of active sessions."""
        return len(self._sessions)
    
    def get_session_message_count(self, conversation_id: str) -> int:
        """
        Get message count for a session.
        
        Args:
            conversation_id: Session identifier
            
        Returns:
            Number of messages in the session
        """
        count = 0
        if conversation_id in self._system_messages:
            count += 1
        if conversation_id in self._sessions:
            count += len(self._sessions[conversation_id])
        return count
    
    def get_session_metadata(self, conversation_id: str) -> Dict[str, Any]:
        """
        Get metadata for a session.
        
        Args:
            conversation_id: Session identifier
            
        Returns:
            Session metadata dictionary
        """
        return self._session_metadata.get(conversation_id, {})
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        """
        List all sessions with their metadata.
        
        Returns:
            List of session information dictionaries
        """
        sessions = []
        for session_id in self._sessions.keys():
            metadata = self.get_session_metadata(session_id)
            sessions.append({
                "session_id": session_id,
                "message_count": self.get_session_message_count(session_id),
                "has_system_message": session_id in self._system_messages,
                "has_langchain_memory": session_id in self._langchain_memories,
                **metadata
            })
        
        # Sort by last updated
        sessions.sort(key=lambda x: x.get("last_updated", ""), reverse=True)
        return sessions
    
    def _estimate_tokens(self, messages: List[BaseMessage]) -> int:
        """
        Estimate token count for messages.
        
        Enhanced estimation for deepseek-r1:8b model.
        This is still a rough estimation - a more accurate implementation
        would use the actual model tokenizer.
        
        Args:
            messages: List of messages
            
        Returns:
            Estimated token count
        """
        total_chars = 0
        for msg in messages:
            if hasattr(msg, 'content') and msg.content:
                total_chars += len(msg.content)
                # Add overhead for message structure (role, etc.)
                total_chars += 20
        
        # Estimation for deepseek-r1:8b (more conservative than general rule)
        # Accounting for reasoning tokens and model-specific tokenization
        return int(total_chars / 3.5)  # ~3.5 chars per token for this model
    
    def _truncate_session(self, conversation_id: str):
        """
        Truncate session history to fit within context window.
        
        Enhanced truncation strategy optimized for deepseek-r1:8b's 128K context:
        1. Keep system message always
        2. Keep most recent exchanges
        3. Remove oldest exchanges first
        4. Try to preserve complete user-assistant pairs
        5. Use intelligent truncation for long conversations
        
        Args:
            conversation_id: Session identifier
        """
        if conversation_id not in self._sessions:
            return
        
        messages = self._sessions[conversation_id]
        system_msg = self._system_messages.get(conversation_id)
        
        # Calculate total estimated tokens
        all_messages = []
        if system_msg:
            all_messages.append(system_msg)
        all_messages.extend(messages)
        
        estimated_tokens = self._estimate_tokens(all_messages)
        
        # If within limit, no truncation needed
        # Use 90% of limit to leave room for new messages
        effective_limit = int(self.max_history_tokens * 0.9)
        if estimated_tokens <= effective_limit:
            return
        
        logger.debug(f"Truncating session {conversation_id}: {estimated_tokens} tokens > {effective_limit} limit")
        
        # Keep system message token count
        system_tokens = self._estimate_tokens([system_msg]) if system_msg else 0
        available_tokens = effective_limit - system_tokens
        
        # For very long conversations, use summarization approach
        if len(messages) > 100:  # Very long conversation
            self._smart_truncate_long_conversation(conversation_id, available_tokens)
        else:
            # Standard truncation for shorter conversations
            self._standard_truncate(conversation_id, available_tokens)
    
    def _smart_truncate_long_conversation(self, conversation_id: str, available_tokens: int):
        """Smart truncation for very long conversations."""
        messages = self._sessions[conversation_id]
        
        # Keep last 20 exchanges (40 messages) + summarize the rest
        recent_messages = messages[-40:]  # Last 20 exchanges
        old_messages = messages[:-40]
        
        recent_tokens = self._estimate_tokens(recent_messages)
        
        if recent_tokens <= available_tokens:
            # Recent messages fit, just keep them
            self._sessions[conversation_id] = recent_messages
            removed_count = len(old_messages)
        else:
            # Even recent messages are too long, apply standard truncation
            self._standard_truncate(conversation_id, available_tokens)
            return
        
        if removed_count > 0:
            logger.debug(f"Smart truncation removed {removed_count} old messages from session {conversation_id}")
    
    def _standard_truncate(self, conversation_id: str, available_tokens: int):
        """Standard truncation strategy preserving recent exchanges."""
        messages = self._sessions[conversation_id]
        
        # Truncate from the beginning, keeping complete pairs
        truncated_messages = []
        current_tokens = 0
        
        # Process messages in reverse order (most recent first)
        for i in range(len(messages) - 1, -1, -1):
            msg = messages[i]
            msg_tokens = self._estimate_tokens([msg])
            
            if current_tokens + msg_tokens <= available_tokens:
                truncated_messages.insert(0, msg)  # Insert at beginning
                current_tokens += msg_tokens
            else:
                # Try to keep complete user-assistant pairs
                if i > 0 and isinstance(msg, AIMessage) and isinstance(messages[i-1], HumanMessage):
                    # This is an AI message, check if we can include the preceding human message
                    human_msg = messages[i-1]
                    pair_tokens = msg_tokens + self._estimate_tokens([human_msg])
                    
                    if current_tokens + pair_tokens <= available_tokens:
                        truncated_messages.insert(0, human_msg)
                        truncated_messages.insert(1, msg)
                        current_tokens += pair_tokens
                        i -= 1  # Skip the human message in the next iteration
                break
        
        # Update the session with truncated messages
        removed_count = len(messages) - len(truncated_messages)
        if removed_count > 0:
            self._sessions[conversation_id] = truncated_messages
            logger.debug(f"Standard truncation removed {removed_count} messages from session {conversation_id}")
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get comprehensive statistics about conversation history.
        
        Returns:
            Dictionary with detailed statistics
        """
        total_messages = sum(len(messages) for messages in self._sessions.values())
        total_sessions = len(self._sessions)
        system_messages = len(self._system_messages)
        langchain_memories = len(self._langchain_memories)
        
        # Token usage statistics
        total_tokens = 0
        max_session_tokens = 0
        for session_id, messages in self._sessions.items():
            all_messages = []
            if session_id in self._system_messages:
                all_messages.append(self._system_messages[session_id])
            all_messages.extend(messages)
            
            session_tokens = self._estimate_tokens(all_messages)
            total_tokens += session_tokens
            max_session_tokens = max(max_session_tokens, session_tokens)
        
        return {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "system_messages": system_messages,
            "langchain_memories": langchain_memories,
            "max_history_tokens": self.max_history_tokens,
            "total_estimated_tokens": total_tokens,
            "max_session_tokens": max_session_tokens,
            "persistence_type": self.persistence_type,
            "storage_path": self.storage_path,
            "cleanup_after_hours": self.cleanup_after_hours,
            "average_messages_per_session": total_messages / total_sessions if total_sessions > 0 else 0,
        }


# Backward compatibility alias
ConversationHistory = PersistentConversationHistory 