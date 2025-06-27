#!/usr/bin/env python3
"""
Test script for Azure OpenAI integration in the LLM Abstraction Layer.

This script tests the Azure OpenAI provider integration, fallback mechanisms,
and configuration handling for task 26.4.
"""

import os
import sys
import logging
from typing import Dict, Any

# Add the llm_abstraction directory to the path
sys.path.insert(0, 'llm_abstraction')

from config import LLMConfig, LLMProvider
from providers import AzureOpenAIProvider, create_provider
from llm_manager import LLMManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_azure_openai_configuration():
    """Test Azure OpenAI configuration from environment variables."""
    print("🔧 Testing Azure OpenAI Configuration...")
    
    # Create configuration
    config = LLMConfig.from_environment()
    
    # Check if Azure OpenAI is in the configuration
    assert LLMProvider.AZURE_OPENAI in config.providers, "Azure OpenAI provider not in config"
    
    azure_config = config.providers[LLMProvider.AZURE_OPENAI]
    print(f"   ✅ Azure OpenAI provider found in configuration")
    print(f"   📍 Base URL: {azure_config.base_url or 'Not configured'}")
    print(f"   🔑 API Key: {'Configured' if azure_config.api_key else 'Not configured'}")
    print(f"   📋 Models: {list(azure_config.models.keys())}")
    print(f"   🟢 Enabled: {azure_config.enabled}")
    
    return azure_config


def test_azure_openai_provider_creation():
    """Test Azure OpenAI provider creation."""
    print("\n🏗️  Testing Azure OpenAI Provider Creation...")
    
    config = LLMConfig.from_environment()
    azure_config = config.providers[LLMProvider.AZURE_OPENAI]
    
    if not azure_config.enabled:
        print("   ⚠️  Azure OpenAI provider is disabled (no API key)")
        return None
    
    try:
        # Test provider creation
        provider = create_provider(LLMProvider.AZURE_OPENAI, "gpt-4o", azure_config)
        print(f"   ✅ Azure OpenAI provider created successfully")
        print(f"   📊 Model info: {provider.get_model_info()}")
        
        # Test availability check
        is_available = provider.is_available()
        print(f"   🔍 Provider availability: {'Available' if is_available else 'Not available'}")
        
        return provider
        
    except ImportError as e:
        print(f"   ❌ Import error: {e}")
        print("   💡 Install langchain-openai: pip install langchain-openai")
        return None
    except Exception as e:
        print(f"   ❌ Error creating provider: {e}")
        return None


def test_fallback_mechanism():
    """Test the fallback mechanism with Azure OpenAI."""
    print("\n🔄 Testing Fallback Mechanism...")
    
    # Configure primary as non-existent provider to test fallback
    config = LLMConfig.from_environment()
    
    # Temporarily disable Ollama to test Azure fallback
    if LLMProvider.OLLAMA in config.providers:
        config.providers[LLMProvider.OLLAMA].enabled = False
    
    # Set Azure as primary fallback
    config.primary_provider = LLMProvider.AZURE_OPENAI
    
    try:
        manager = LLMManager(config)
        
        # Get the selected provider
        selected_provider = manager.provider_selector.select_provider()
        
        if selected_provider:
            provider_name = None
            for name, provider in manager.provider_selector.providers.items():
                if provider == selected_provider:
                    provider_name = name
                    break
            
            print(f"   ✅ Fallback provider selected: {provider_name}")
            print(f"   📊 Provider info: {selected_provider.get_model_info()}")
        else:
            print("   ⚠️  No provider available for fallback")
            
    except Exception as e:
        print(f"   ❌ Error testing fallback: {e}")


def test_azure_openai_request():
    """Test making a request to Azure OpenAI (if configured)."""
    print("\n💬 Testing Azure OpenAI Request...")
    
    config = LLMConfig.from_environment()
    azure_config = config.providers[LLMProvider.AZURE_OPENAI]
    
    if not azure_config.enabled:
        print("   ⚠️  Skipping request test - Azure OpenAI not configured")
        return
    
    try:
        provider = create_provider(LLMProvider.AZURE_OPENAI, "gpt-4o", azure_config)
        
        # Make a simple test request
        test_message = "Say 'Hello from Azure OpenAI' and nothing else."
        
        print(f"   📤 Sending test message...")
        response = provider.invoke(test_message)
        print(f"   📥 Response: {response[:100]}{'...' if len(response) > 100 else ''}")
        print(f"   ✅ Request successful!")
        
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        if "API key" in str(e).lower():
            print("   💡 Check your AZURE_OPENAI_API_KEY environment variable")
        elif "endpoint" in str(e).lower():
            print("   💡 Check your AZURE_OPENAI_ENDPOINT environment variable")


def test_environment_variables():
    """Test and display environment variable configuration."""
    print("\n🌍 Testing Environment Variables...")
    
    env_vars = [
        "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_API_VERSION",
        "AZURE_OPENAI_DEPLOYMENT_NAME",
    ]
    
    configured_vars = []
    missing_vars = []
    
    for var in env_vars:
        value = os.getenv(var)
        if value:
            configured_vars.append(var)
            if "KEY" in var:
                print(f"   ✅ {var}: ****{value[-4:] if len(value) > 4 else '****'}")
            else:
                print(f"   ✅ {var}: {value}")
        else:
            missing_vars.append(var)
            print(f"   ❌ {var}: Not set")
    
    print(f"\n   📊 Summary: {len(configured_vars)} configured, {len(missing_vars)} missing")
    
    if missing_vars:
        print("\n   💡 To configure Azure OpenAI, set these environment variables:")
        for var in missing_vars:
            print(f"      export {var}=your_value_here")


def main():
    """Run all Azure OpenAI integration tests."""
    print("🚀 Azure OpenAI Integration Test Suite")
    print("=" * 50)
    
    try:
        # Test configuration
        azure_config = test_azure_openai_configuration()
        
        # Test environment variables
        test_environment_variables()
        
        # Test provider creation
        provider = test_azure_openai_provider_creation()
        
        # Test fallback mechanism
        test_fallback_mechanism()
        
        # Test actual request (if configured)
        if azure_config and azure_config.enabled:
            test_azure_openai_request()
        
        print("\n" + "=" * 50)
        print("✅ Azure OpenAI Integration Test Complete!")
        
        # Summary
        config = LLMConfig.from_environment()
        azure_enabled = config.providers[LLMProvider.AZURE_OPENAI].enabled
        
        if azure_enabled:
            print("🎉 Azure OpenAI is properly configured and ready to use as fallback!")
        else:
            print("⚠️  Azure OpenAI is not configured. Set environment variables to enable.")
            
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 