#!/usr/bin/env python3
"""
Test script for LLM Abstraction Layer.

This script tests the basic functionality of the LLM abstraction layer,
including provider initialization, health checks, and basic inference.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from llm_abstraction import LLMManager, LLMConfig, LLMProvider


def test_configuration():
    """Test configuration loading."""
    print("🔧 Testing configuration...")
    
    config = LLMConfig.from_environment()
    print(f"Primary provider: {config.primary_provider.value}")
    print(f"Fallback providers: {[p.value for p in config.fallback_providers]}")
    print(f"Enabled providers: {[p.value for p in config.get_enabled_providers()]}")
    print(f"Provider order: {[p.value for p in config.get_provider_order()]}")
    print()


def test_manager_initialization():
    """Test LLM manager initialization."""
    print("🚀 Testing LLM manager initialization...")
    
    try:
        manager = LLMManager()
        print("✅ LLM manager initialized successfully")
        
        # Get provider info
        provider_info = manager.get_provider_info()
        print(f"Available providers: {list(provider_info.keys())}")
        
        for provider, info in provider_info.items():
            print(f"  {provider}: {info.get('available', False)} - {info.get('error', 'OK')}")
        
        print()
        return manager
        
    except Exception as e:
        print(f"❌ Failed to initialize LLM manager: {e}")
        return None


def test_health_check(manager):
    """Test health check functionality."""
    print("🏥 Testing health check...")
    
    try:
        health = manager.health_check()
        print(f"Overall status: {health['overall_status']}")
        print(f"Available providers: {health['available_providers']}/{health['total_providers']}")
        
        for provider, status in health['providers'].items():
            status_emoji = "✅" if status['status'] == 'healthy' else "❌"
            print(f"  {status_emoji} {provider}: {status['status']}")
            if 'error' in status:
                print(f"    Error: {status['error']}")
        
        print()
        return health['available_providers'] > 0
        
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False


def test_simple_inference(manager):
    """Test simple inference."""
    print("💬 Testing simple inference...")
    
    try:
        # Test with a simple question
        response = manager.invoke(
            "What is 2+2? Please give a brief answer.",
            session_id="test_session",
            include_history=False
        )
        
        print(f"Question: What is 2+2?")
        print(f"Response: {response[:200]}...")
        print("✅ Simple inference successful")
        print()
        return True
        
    except Exception as e:
        print(f"❌ Simple inference failed: {e}")
        return False


def test_conversation_history(manager):
    """Test conversation history functionality."""
    print("📝 Testing conversation history...")
    
    try:
        session_id = "history_test"
        
        # Clear any existing history
        manager.clear_conversation_history(session_id)
        
        # Set a system message
        manager.set_system_message(session_id, "You are a helpful math assistant.")
        
        # First message
        response1 = manager.invoke(
            "What is 5 + 3?",
            session_id=session_id,
            include_history=True
        )
        print(f"Q1: What is 5 + 3?")
        print(f"A1: {response1[:100]}...")
        
        # Second message (should have context)
        response2 = manager.invoke(
            "What about if I multiply that result by 2?",
            session_id=session_id,
            include_history=True
        )
        print(f"Q2: What about if I multiply that result by 2?")
        print(f"A2: {response2[:100]}...")
        
        # Check conversation history
        history = manager.get_conversation_history(session_id)
        print(f"History length: {len(history)} messages")
        
        print("✅ Conversation history test successful")
        print()
        return True
        
    except Exception as e:
        print(f"❌ Conversation history test failed: {e}")
        return False


def main():
    """Main test function."""
    print("🧪 LLM Abstraction Layer Test Suite")
    print("=" * 50)
    
    # Test configuration
    test_configuration()
    
    # Test manager initialization
    manager = test_manager_initialization()
    if not manager:
        print("❌ Cannot proceed without manager")
        sys.exit(1)
    
    # Test health check
    has_healthy_providers = test_health_check(manager)
    
    if has_healthy_providers:
        # Test simple inference
        if test_simple_inference(manager):
            # Test conversation history
            test_conversation_history(manager)
    else:
        print("⚠️  No healthy providers available for inference tests")
        print("   Make sure Ollama is running with deepseek-r1:8b model")
        print("   Or configure other providers (Azure OpenAI, Google GenAI)")
    
    print("🏁 Test suite completed!")


if __name__ == "__main__":
    main() 