#!/usr/bin/env python3
"""
Test script for Enhanced Conversation History Management.

This script thoroughly tests the enhanced conversation history functionality
including LangChain memory integration, persistence, and session management.
"""

import os
import sys
import tempfile
import shutil
import json
from pathlib import Path

# Add the llm_abstraction directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'llm_abstraction'))

try:
    from conversation_history import PersistentConversationHistory
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
    print("✅ Successfully imported Enhanced Conversation History components")
except ImportError as e:
    print(f"❌ Failed to import: {e}")
    sys.exit(1)


def test_basic_functionality():
    """Test basic conversation history functionality."""
    print("\n=== Testing Basic Functionality ===")
    
    try:
        # Create conversation history with memory storage
        history = PersistentConversationHistory(
            max_history_tokens=128000,
            persistence_type="memory",
            enable_langchain_memory=True
        )
        
        # Test adding exchanges
        history.add_exchange(
            "test_session_1",
            "Hello, how are you?",
            "I'm doing well, thank you for asking!"
        )
        
        history.add_exchange(
            "test_session_1", 
            "What's the weather like?",
            "I don't have access to real-time weather data."
        )
        
        # Test getting history
        messages = history.get_history("test_session_1")
        assert len(messages) == 4, f"Expected 4 messages, got {len(messages)}"
        
        # Test session count
        assert history.get_session_count() == 1, "Expected 1 session"
        
        # Test message count
        assert history.get_session_message_count("test_session_1") == 4, "Expected 4 messages"
        
        print("✅ Basic functionality test passed")
        return history
        
    except Exception as e:
        print(f"❌ Basic functionality test failed: {e}")
        return None


def test_system_message_functionality(history):
    """Test system message functionality."""
    print("\n=== Testing System Message Functionality ===")
    
    try:
        # Set system message
        history.set_system_message("test_session_1", "You are a helpful AI assistant.")
        
        # Get history with system message
        messages = history.get_history("test_session_1")
        assert len(messages) == 5, f"Expected 5 messages (including system), got {len(messages)}"
        assert isinstance(messages[0], SystemMessage), "First message should be SystemMessage"
        assert messages[0].content == "You are a helpful AI assistant.", "System message content mismatch"
        
        # Test new session with system message
        history.set_system_message("test_session_2", "You are a coding assistant.")
        history.add_exchange(
            "test_session_2",
            "Help me debug this code",
            "I'd be happy to help! Please share your code."
        )
        
        messages_2 = history.get_history("test_session_2")
        assert len(messages_2) == 3, f"Expected 3 messages, got {len(messages_2)}"
        assert isinstance(messages_2[0], SystemMessage), "First message should be SystemMessage"
        
        print("✅ System message functionality test passed")
        return True
        
    except Exception as e:
        print(f"❌ System message functionality test failed: {e}")
        return False


def test_langchain_memory_integration(history):
    """Test LangChain memory integration."""
    print("\n=== Testing LangChain Memory Integration ===")
    
    try:
        # Test getting LangChain memory
        memory = history.get_langchain_memory("test_session_1")
        assert memory is not None, "LangChain memory should be available"
        
        # Test that memory has been populated
        buffer = memory.buffer
        assert len(buffer) > 0, "Memory buffer should contain messages"
        
        # Add more exchanges to test memory update
        history.add_exchange(
            "test_session_1",
            "Can you remember our conversation?",
            "Yes, we talked about greetings and weather earlier."
        )
        
        # Verify memory was updated
        updated_memory = history.get_langchain_memory("test_session_1")
        updated_buffer = updated_memory.buffer
        assert len(updated_buffer) > len(buffer), "Memory should be updated with new exchange"
        
        print("✅ LangChain memory integration test passed")
        return True
        
    except Exception as e:
        print(f"❌ LangChain memory integration test failed: {e}")
        return False


def test_file_persistence():
    """Test file persistence functionality."""
    print("\n=== Testing File Persistence ===")
    
    try:
        # Create temporary directory for testing
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Create conversation history with file persistence
            history = PersistentConversationHistory(
                max_history_tokens=128000,
                persistence_type="file",
                storage_path=temp_dir,
                enable_langchain_memory=True
            )
            
            # Add some conversations
            history.set_system_message("persistent_session", "You are a helpful assistant.")
            history.add_exchange(
                "persistent_session",
                "Test persistence",
                "This should be saved to file."
            )
            
            history.add_exchange(
                "persistent_session",
                "Another message", 
                "This should also be saved."
            )
            
            # Verify files were created
            sessions_file = Path(temp_dir) / "sessions.json"
            metadata_file = Path(temp_dir) / "metadata.json"
            
            assert sessions_file.exists(), "Sessions file should be created"
            assert metadata_file.exists(), "Metadata file should be created"
            
            # Create new instance to test loading
            history2 = PersistentConversationHistory(
                max_history_tokens=128000,
                persistence_type="file",
                storage_path=temp_dir,
                enable_langchain_memory=True
            )
            
            # Verify data was loaded
            assert history2.get_session_count() == 1, "Should load 1 session"
            messages = history2.get_history("persistent_session")
            assert len(messages) == 5, f"Should load 5 messages, got {len(messages)}"
            
            print("✅ File persistence test passed")
            return True
            
        finally:
            # Clean up temporary directory
            shutil.rmtree(temp_dir)
            
    except Exception as e:
        print(f"❌ File persistence test failed: {e}")
        return False


def test_session_management():
    """Test session management capabilities."""
    print("\n=== Testing Session Management ===")
    
    try:
        history = PersistentConversationHistory(
            max_history_tokens=128000,
            persistence_type="memory",
            cleanup_after_hours=1,  # Short cleanup time for testing
            enable_langchain_memory=True
        )
        
        # Create multiple sessions
        for i in range(5):
            session_id = f"session_{i}"
            history.add_exchange(
                session_id,
                f"Message from session {i}",
                f"Response to session {i}"
            )
        
        # Test session listing
        sessions = history.list_sessions()
        assert len(sessions) == 5, f"Expected 5 sessions, got {len(sessions)}"
        
        # Verify session structure
        for session in sessions:
            assert "session_id" in session
            assert "message_count" in session
            assert "has_system_message" in session
            assert "has_langchain_memory" in session
            assert "created_at" in session
            assert "last_updated" in session
        
        # Test session metadata
        metadata = history.get_session_metadata("session_0")
        assert "created_at" in metadata
        assert "exchange_count" in metadata
        assert metadata["exchange_count"] == 1
        
        # Test session clearing
        history.clear_session("session_0")
        assert history.get_session_count() == 4, "Should have 4 sessions after clearing one"
        
        print("✅ Session management test passed")
        return True
        
    except Exception as e:
        print(f"❌ Session management test failed: {e}")
        return False


def test_context_window_optimization():
    """Test context window optimization and truncation."""
    print("\n=== Testing Context Window Optimization ===")
    
    try:
        # Create history with small context window for testing truncation
        history = PersistentConversationHistory(
            max_history_tokens=1000,  # Small context for testing
            persistence_type="memory",
            enable_langchain_memory=True
        )
        
        # Add many exchanges to trigger truncation
        session_id = "truncation_test"
        for i in range(50):
            history.add_exchange(
                session_id,
                f"This is a longer message number {i} that should help fill up the context window quickly.",
                f"This is the AI response number {i} which is also quite long to help test the truncation functionality."
            )
        
        # Check that truncation occurred
        messages = history.get_history(session_id)
        total_chars = sum(len(msg.content) for msg in messages if hasattr(msg, 'content'))
        estimated_tokens = total_chars // 3.5  # Conservative estimation
        
        # Should be within 90% of limit (effective limit)
        assert estimated_tokens <= 900, f"Messages should be truncated, estimated tokens: {estimated_tokens}"
        
        # Verify we still have recent messages
        assert len(messages) > 10, "Should retain some recent messages"
        
        print("✅ Context window optimization test passed")
        return True
        
    except Exception as e:
        print(f"❌ Context window optimization test failed: {e}")
        return False


def test_deepseek_optimization():
    """Test optimizations specific to deepseek-r1:8b model."""
    print("\n=== Testing Deepseek-r1:8b Optimizations ===")
    
    try:
        # Create history optimized for deepseek-r1:8b
        history = PersistentConversationHistory(
            max_history_tokens=128000,  # 128K context window
            persistence_type="memory",
            enable_langchain_memory=True
        )
        
        # Test token estimation for deepseek-r1:8b
        test_messages = [
            HumanMessage(content="This is a test message for token estimation."),
            AIMessage(content="This is the AI response for testing token count estimation.")
        ]
        
        estimated_tokens = history._estimate_tokens(test_messages)
        # Should use ~3.5 chars per token ratio
        expected_tokens = sum(len(msg.content) + 20 for msg in test_messages) / 3.5
        
        assert abs(estimated_tokens - expected_tokens) < 5, f"Token estimation mismatch: {estimated_tokens} vs {expected_tokens}"
        
        # Test LangChain memory type selection for large context
        history.add_exchange("deepseek_test", "Test message", "Test response")
        memory = history.get_langchain_memory("deepseek_test")
        
        # Should use ConversationBufferWindowMemory for large context
        from langchain.memory import ConversationBufferWindowMemory
        assert isinstance(memory, ConversationBufferWindowMemory), "Should use ConversationBufferWindowMemory for large context"
        assert memory.k == 50, "Should keep 50 exchanges (100 messages)"
        
        print("✅ Deepseek-r1:8b optimization test passed")
        return True
        
    except Exception as e:
        print(f"❌ Deepseek-r1:8b optimization test failed: {e}")
        return False


def test_statistics_and_monitoring():
    """Test statistics and monitoring capabilities."""
    print("\n=== Testing Statistics and Monitoring ===")
    
    try:
        history = PersistentConversationHistory(
            max_history_tokens=128000,
            persistence_type="memory",
            enable_langchain_memory=True
        )
        
        # Add some data
        history.set_system_message("stats_session", "System message")
        history.add_exchange("stats_session", "User message", "AI response")
        history.add_exchange("stats_session_2", "Another user message", "Another AI response")
        
        # Test statistics
        stats = history.get_stats()
        
        # Verify required fields
        required_fields = [
            "total_sessions", "total_messages", "system_messages", "langchain_memories",
            "max_history_tokens", "total_estimated_tokens", "max_session_tokens",
            "persistence_type", "storage_path", "cleanup_after_hours",
            "average_messages_per_session"
        ]
        
        for field in required_fields:
            assert field in stats, f"Missing required field: {field}"
        
        # Verify values
        assert stats["total_sessions"] == 2, f"Expected 2 sessions, got {stats['total_sessions']}"
        assert stats["total_messages"] == 4, f"Expected 4 messages, got {stats['total_messages']}"
        assert stats["system_messages"] == 1, f"Expected 1 system message, got {stats['system_messages']}"
        assert stats["langchain_memories"] == 2, f"Expected 2 LangChain memories, got {stats['langchain_memories']}"
        assert stats["max_history_tokens"] == 128000, "Max history tokens mismatch"
        assert stats["persistence_type"] == "memory", "Persistence type mismatch"
        
        print("✅ Statistics and monitoring test passed")
        return True
        
    except Exception as e:
        print(f"❌ Statistics and monitoring test failed: {e}")
        return False


def run_all_tests():
    """Run all test suites."""
    print("🚀 Starting Enhanced Conversation History Tests...")
    print("=" * 60)
    
    test_results = []
    
    # Test 1: Basic functionality
    history = test_basic_functionality()
    test_results.append(history is not None)
    
    if history:
        # Test 2: System message functionality
        test_results.append(test_system_message_functionality(history))
        
        # Test 3: LangChain memory integration
        test_results.append(test_langchain_memory_integration(history))
    else:
        test_results.extend([False, False])
    
    # Test 4: File persistence
    test_results.append(test_file_persistence())
    
    # Test 5: Session management
    test_results.append(test_session_management())
    
    # Test 6: Context window optimization
    test_results.append(test_context_window_optimization())
    
    # Test 7: Deepseek optimization
    test_results.append(test_deepseek_optimization())
    
    # Test 8: Statistics and monitoring
    test_results.append(test_statistics_and_monitoring())
    
    # Summary
    print("\n" + "=" * 60)
    print("🎯 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    test_names = [
        "Basic Functionality",
        "System Message Functionality", 
        "LangChain Memory Integration",
        "File Persistence",
        "Session Management",
        "Context Window Optimization",
        "Deepseek-r1:8b Optimization",
        "Statistics and Monitoring"
    ]
    
    passed = sum(test_results)
    total = len(test_results)
    
    for i, (name, result) in enumerate(zip(test_names, test_results), 1):
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{i:2d}. {name:<35} {status}")
    
    print("-" * 60)
    print(f"Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! Enhanced Conversation History is working correctly.")
        return True
    else:
        print(f"⚠️  {total-passed} test(s) failed. Please review the issues above.")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1) 