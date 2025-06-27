#!/usr/bin/env python3
"""
Minimal Ollama-only test to isolate integration issues.
"""

import os
import sys
import logging

# Add the llm_abstraction directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import LLMConfig, LLMProvider, ProviderConfig, ModelConfig
from llm_manager import LLMManager
from provider_selector import SelectionPolicy

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def test_ollama_only():
    """Test Ollama provider in isolation."""
    print("=== Testing Ollama Provider Only ===")
    
    # Create a minimal config with just Ollama
    config = LLMConfig(
        providers={
                    LLMProvider.OLLAMA: ProviderConfig(
            provider=LLMProvider.OLLAMA,
            enabled=True,
            models={
                "deepseek-r1:8b": ModelConfig(
                    name="deepseek-r1:8b",
                    max_tokens=128000,
                    temperature=0.7,
                    timeout=120
                )
            },
            base_url="http://localhost:11434"
        )
        },
        primary_provider=LLMProvider.OLLAMA,
        fallback_providers=[],  # No fallbacks to avoid initialization issues
        enable_logging=True
    )
    
    print(f"Config created with providers: {list(config.providers.keys())}")
    
    try:
        # Create LLM manager with only Ollama
        manager = LLMManager(
            config=config,
            selection_policy=SelectionPolicy.FAILOVER,
            enable_conversation_history=True
        )
        print("✅ LLM Manager initialized successfully")
        
        # Test basic functionality
        response = manager.invoke("Hello, how are you?")
        print(f"✅ Response received: {response[:100]}...")
        
        # Test provider info
        info = manager.get_provider_info()
        print(f"✅ Provider info: {info}")
        
        # Test health check
        health = manager.health_check()
        print(f"✅ Health check: {health}")
        
        print("🎉 All tests passed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        try:
            manager.shutdown()
            print("✅ Manager shutdown complete")
        except:
            pass

if __name__ == "__main__":
    test_ollama_only() 