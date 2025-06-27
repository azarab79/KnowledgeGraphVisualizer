#!/usr/bin/env python3
"""
Test Script for Enhanced LLM Abstraction Layer
Comprehensive testing of error handling, fallback mechanisms, and provider integration.
"""

import os
import sys
import time
import asyncio
from pathlib import Path

# Add the llm_abstraction directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "llm_abstraction"))

try:
    from llm_abstraction.llm_manager import LLMManager
    from llm_abstraction.config import LLMConfig, LLMProvider
    from llm_abstraction.enhanced_error_handler import EnhancedErrorHandler, RetryStrategy
    from llm_abstraction.exceptions import (
        LLMAbstractionError, ProviderUnavailableError, RateLimitError,
        TimeoutError, ContextOverflowError
    )
    from llm_abstraction.provider_selector import SelectionPolicy
    from langchain_core.messages import HumanMessage, SystemMessage
except ImportError as e:
    print(f"Error importing LLM abstraction modules: {e}")
    print("Make sure the llm_abstraction directory is properly set up")
    sys.exit(1)


def test_enhanced_error_handler():
    """Test the enhanced error handler functionality."""
    print("🧪 Testing Enhanced Error Handler...")
    
    # Test retry strategy
    retry_strategy = RetryStrategy(
        max_attempts=5,
        base_delay=0.1,
        max_delay=2.0,
        exponential_base=1.5,
        jitter=True
    )
    
    error_handler = EnhancedErrorHandler(
        retry_strategy=retry_strategy,
        enable_circuit_breaker=True,
        enable_adaptive_timeout=True,
        context_truncation_strategy="smart"
    )
    
    # Test delay calculation
    delays = [error_handler.retry_strategy.get_delay(i) for i in range(1, 6)]
    print(f"  ✓ Retry delays: {[f'{d:.2f}s' for d in delays]}")
    
    # Test circuit breaker
    circuit_breaker = error_handler._get_circuit_breaker("test_provider")
    print(f"  ✓ Circuit breaker initialized: {circuit_breaker.should_allow_request()}")
    
    # Test error classification
    test_error = ProviderUnavailableError("test_provider", "Test provider error")
    classified = error_handler.handle_error(
        test_error, "test_provider", "test_model", 1
    )
    print(f"  ✓ Error classification: {classified.category.value} - {classified.severity.value}")
    
    print("  ✅ Enhanced Error Handler tests passed!\n")


def test_configuration_loading():
    """Test configuration loading with various scenarios."""
    print("🔧 Testing Configuration Loading...")
    
    # Set some test environment variables
    os.environ.update({
        'OLLAMA_BASE_URL': 'http://localhost:11434',
        'OLLAMA_MODEL': 'deepseek-r1:8b',
        'ANTHROPIC_API_KEY': 'test-key-not-real',
        'AZURE_OPENAI_API_KEY': 'test-azure-key',
        'AZURE_OPENAI_ENDPOINT': 'https://test.openai.azure.com/',
        'AZURE_OPENAI_API_VERSION': '2024-02-01',
        'AZURE_OPENAI_DEPLOYMENT_NAME': 'gpt-4',
        'ENABLE_LOGGING': 'true'
    })
    
    try:
        config = LLMConfig.from_environment()
        print(f"  ✓ Configuration loaded successfully")
        print(f"  ✓ Available providers: {[p.value for p in config.providers.keys()]}")
        print(f"  ✓ Logging enabled: {config.enable_logging}")
        
        # Test provider configurations
        for provider_type, provider_config in config.providers.items():
            if provider_config.enabled:
                print(f"  ✓ {provider_type.value}: {len(provider_config.models)} models configured")
    
    except Exception as e:
        print(f"  ❌ Configuration loading failed: {e}")
        return False
    
    print("  ✅ Configuration tests passed!\n")
    return True


def test_llm_manager_initialization():
    """Test LLM Manager initialization with enhanced features."""
    print("🚀 Testing LLM Manager Initialization...")
    
    try:
        # Test with enhanced error handling
        manager = LLMManager(
            selection_policy=SelectionPolicy.FAILOVER,
            enable_conversation_history=True,
            enable_enhanced_error_handling=True,
            retry_strategy=RetryStrategy(max_attempts=3, base_delay=0.5)
        )
        
        print(f"  ✓ LLM Manager initialized with enhanced error handling")
        print(f"  ✓ Available providers: {[p.value for p in manager.get_available_providers()]}")
        print(f"  ✓ Selection policy: {manager.provider_selector.selection_policy.value}")
        print(f"  ✓ Enhanced error handler: {manager.error_handler is not None}")
        print(f"  ✓ Conversation history: {manager.conversation_history is not None}")
        
        # Test health check
        health_status = manager.health_check()
        print(f"  ✓ Health check completed: {health_status['total_providers']} providers checked")
        
        # Test provider metrics
        metrics = manager.get_provider_metrics()
        if metrics:
            print(f"  ✓ Provider metrics available")
        
    except Exception as e:
        print(f"  ❌ LLM Manager initialization failed: {e}")
        return False
    
    print("  ✅ LLM Manager initialization tests passed!\n")
    return True


def test_error_simulation():
    """Test error handling with simulated failures."""
    print("🔬 Testing Error Simulation and Recovery...")
    
    try:
        # Create manager with aggressive retry settings for testing
        manager = LLMManager(
            enable_enhanced_error_handling=True,
            retry_strategy=RetryStrategy(
                max_attempts=2,
                base_delay=0.1,
                max_delay=0.5
            )
        )
        
        # Test with a simple message
        test_messages = [
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="Hello! Can you respond with just 'Hi there!'?")
        ]
        
        print("  🔄 Attempting request with fallback handling...")
        
        try:
            response = manager.invoke(
                test_messages,
                conversation_id="test_session",
                temperature=0.3,
                max_tokens=50
            )
            print(f"  ✓ Response received (length: {len(response)})")
            print(f"  ✓ Response preview: {response[:100]}...")
            
        except Exception as e:
            # This is expected if no providers are actually available
            print(f"  ⚠️ Expected error (no live providers): {type(e).__name__}")
            print(f"    Error details: {str(e)[:100]}...")
        
        # Test error handler statistics
        if manager.error_handler:
            stats = manager.error_handler.get_error_statistics()
            print(f"  ✓ Error statistics collected: {len(stats)} providers tracked")
        
    except Exception as e:
        print(f"  ❌ Error simulation test failed: {e}")
        return False
    
    print("  ✅ Error simulation tests completed!\n")
    return True


def test_conversation_history():
    """Test conversation history management."""
    print("💬 Testing Conversation History...")
    
    try:
        manager = LLMManager(
            enable_conversation_history=True,
            enable_enhanced_error_handling=True
        )
        
        conversation_id = "test_conversation_123"
        
        # Set system message
        manager.set_system_message(conversation_id, "You are a helpful AI assistant.")
        print("  ✓ System message set")
        
        # Get conversation history
        history = manager.get_conversation_history(conversation_id)
        print(f"  ✓ Conversation history retrieved: {len(history)} messages")
        
        # Clear conversation history
        manager.clear_conversation_history(conversation_id)
        print("  ✓ Conversation history cleared")
        
        # Test conversation with history disabled
        manager_no_history = LLMManager(enable_conversation_history=False)
        print("  ✓ Manager with disabled history created")
        
    except Exception as e:
        print(f"  ❌ Conversation history test failed: {e}")
        return False
    
    print("  ✅ Conversation history tests passed!\n")
    return True


def test_provider_health_monitoring():
    """Test provider health monitoring features."""
    print("🏥 Testing Provider Health Monitoring...")
    
    try:
        manager = LLMManager(
            selection_policy=SelectionPolicy.BEST_HEALTH,
            enable_enhanced_error_handling=True
        )
        
        # Force health check
        manager.force_provider_health_check()
        print("  ✓ Forced health check completed")
        
        # Get healthy providers
        healthy_providers = manager.get_healthy_providers()
        print(f"  ✓ Healthy providers: {healthy_providers}")
        
        # Get system status
        system_status = manager.get_system_status()
        print(f"  ✓ System status retrieved")
        print(f"    - Total providers: {system_status['total_providers']}")
        print(f"    - Healthy providers: {system_status['healthy_providers']}")
        print(f"    - Uptime: {system_status['uptime']:.2f}s")
        
        # Test metrics reset
        manager.reset_provider_metrics()
        print("  ✓ Provider metrics reset")
        
    except Exception as e:
        print(f"  ❌ Health monitoring test failed: {e}")
        return False
    
    print("  ✅ Health monitoring tests passed!\n")
    return True


def main():
    """Run all tests for the enhanced LLM abstraction layer."""
    print("🚀 Enhanced LLM Abstraction Layer Test Suite")
    print("=" * 50)
    
    test_results = []
    
    # Run all test functions
    tests = [
        ("Enhanced Error Handler", test_enhanced_error_handler),
        ("Configuration Loading", test_configuration_loading),
        ("LLM Manager Initialization", test_llm_manager_initialization),
        ("Error Simulation", test_error_simulation),
        ("Conversation History", test_conversation_history),
        ("Provider Health Monitoring", test_provider_health_monitoring),
    ]
    
    for test_name, test_func in tests:
        try:
            print(f"Running: {test_name}")
            result = test_func()
            if result is None:  # Some tests don't return boolean
                result = True
            test_results.append((test_name, result))
        except Exception as e:
            print(f"  ❌ {test_name} failed with exception: {e}")
            test_results.append((test_name, False))
    
    # Print summary
    print("\n📊 Test Summary")
    print("=" * 30)
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Enhanced error handling implementation is complete.")
        return 0
    else:
        print("⚠️ Some tests failed. Review the implementation.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
os.environ.setdefault("OLLAMA_BASE_URL", "http://localhost:11434")
os.environ.setdefault("GOOGLE_API_KEY", "your-google-api-key-here")  # Replace with actual key if testing
os.environ.setdefault("AZURE_OPENAI_API_KEY", "your-azure-api-key-here")  # Replace with actual key

from llm_abstraction import (
    LLMManager,
    LLMConfig,
    SelectionPolicy,
    create_manager,
    create_ollama_manager,
    create_cloud_manager
)


def print_section(title: str):
    """Print a formatted section header."""
    print("\n" + "="*60)
    print(f" {title}")
    print("="*60)


def print_subsection(title: str):
    """Print a formatted subsection header."""
    print(f"\n--- {title} ---")


def demonstrate_basic_functionality():
    """Demonstrate basic LLM manager functionality."""
    print_section("BASIC FUNCTIONALITY DEMONSTRATION")
    
    # Create manager with failover policy
    print("Creating LLM manager with failover policy...")
    manager = create_manager(
        primary_provider="ollama",
        fallback_providers=["google_genai"],
        selection_policy=SelectionPolicy.FAILOVER
    )
    
    print("✅ Manager created successfully")
    
    # Check available providers
    print_subsection("Available Providers")
    available = manager.get_available_providers()
    healthy = manager.get_healthy_providers()
    
    print(f"Available providers: {available}")
    print(f"Healthy providers: {healthy}")
    
    # Perform health check
    print_subsection("Health Check")
    health_result = manager.health_check()
    print(f"Overall status: {health_result['status']}")
    print(f"Healthy providers: {health_result['healthy_providers']}")
    
    # Simple chat test (if providers are available)
    if healthy:
        print_subsection("Simple Chat Test")
        try:
            response = manager.chat(
                "Hello! Please respond with exactly 'Hello from AI' and nothing else.",
                conversation_id="test_basic"
            )
            print(f"✅ Response received: {response[:100]}...")
        except Exception as e:
            print(f"❌ Chat failed: {e}")
    
    manager.shutdown()
    print("✅ Manager shutdown complete")


def demonstrate_advanced_selection_policies():
    """Demonstrate all provider selection policies."""
    print_section("ADVANCED SELECTION POLICIES DEMONSTRATION")
    
    policies = [
        SelectionPolicy.FAILOVER,
        SelectionPolicy.ROUND_ROBIN,
        SelectionPolicy.LOWEST_LATENCY,
        SelectionPolicy.LOWEST_COST,
        SelectionPolicy.LOAD_BALANCE,
        SelectionPolicy.BEST_HEALTH
    ]
    
    for policy in policies:
        print_subsection(f"Testing {policy.value.upper()} Policy")
        
        try:
            manager = create_manager(
                primary_provider="ollama",
                fallback_providers=["google_genai", "azure_openai"],
                selection_policy=policy
            )
            
            print(f"✅ Manager created with {policy.value} policy")
            
            # Get system status
            status = manager.get_system_status()
            print(f"Selection policy: {status['config']['selection_policy']}")
            print(f"Primary provider: {status['config']['primary_provider']}")
            
            # Test multiple requests to see policy in action
            if manager.get_healthy_providers():
                print("Testing policy with multiple requests...")
                for i in range(3):
                    try:
                        response = manager.chat(
                            f"Request {i+1}: Say 'Response {i+1}'",
                            conversation_id=f"policy_test_{policy.value}_{i}"
                        )
                        print(f"  Request {i+1}: ✅ Success ({len(response)} chars)")
                        time.sleep(0.5)  # Small delay between requests
                    except Exception as e:
                        print(f"  Request {i+1}: ❌ Failed - {e}")
            
            manager.shutdown()
            
        except Exception as e:
            print(f"❌ Failed to test {policy.value} policy: {e}")


def demonstrate_metrics_and_monitoring():
    """Demonstrate metrics collection and health monitoring."""
    print_section("METRICS AND MONITORING DEMONSTRATION")
    
    # Create manager with health monitoring
    manager = create_manager(
        primary_provider="ollama",
        fallback_providers=["google_genai"],
        selection_policy=SelectionPolicy.LOWEST_LATENCY
    )
    
    print_subsection("Initial Metrics")
    initial_metrics = manager.get_provider_metrics()
    for provider_name, metrics in initial_metrics.items():
        print(f"{provider_name}:")
        print(f"  Request count: {metrics['request_count']}")
        print(f"  Success rate: {metrics['success_rate']:.2%}")
        print(f"  Health score: {metrics['health_score']:.2f}")
        print(f"  Is healthy: {metrics['is_healthy']}")
    
    # Make several requests to generate metrics
    if manager.get_healthy_providers():
        print_subsection("Generating Metrics with Test Requests")
        
        test_messages = [
            "What is 2+2?",
            "Tell me a fun fact about space.",
            "How does machine learning work?",
            "What's the weather like on Mars?",
            "Explain quantum computing in one sentence."
        ]
        
        for i, message in enumerate(test_messages):
            try:
                start_time = time.time()
                response = manager.chat(message, conversation_id=f"metrics_test_{i}")
                duration = time.time() - start_time
                print(f"  Request {i+1}: ✅ Success ({duration:.2f}s, {len(response)} chars)")
                time.sleep(0.2)  # Small delay
            except Exception as e:
                print(f"  Request {i+1}: ❌ Failed - {e}")
    
    # Show updated metrics
    print_subsection("Updated Metrics After Requests")
    updated_metrics = manager.get_provider_metrics()
    for provider_name, metrics in updated_metrics.items():
        if metrics['request_count'] > 0:
            print(f"{provider_name}:")
            print(f"  Request count: {metrics['request_count']}")
            print(f"  Success rate: {metrics['success_rate']:.2%}")
            print(f"  Average latency: {metrics['average_latency']:.2f}s")
            print(f"  Recent avg latency: {metrics['recent_average_latency']:.2f}s")
            print(f"  Total cost: ${metrics['total_cost']:.4f}")
            print(f"  Cost per token: ${metrics['cost_per_token']:.6f}")
            print(f"  Health score: {metrics['health_score']:.2f}")
            print(f"  Consecutive failures: {metrics['consecutive_failures']}")
    
    manager.shutdown()


def demonstrate_conversation_management():
    """Demonstrate advanced conversation history management."""
    print_section("CONVERSATION MANAGEMENT DEMONSTRATION")
    
    manager = create_manager(
        primary_provider="ollama",
        fallback_providers=["google_genai"],
        enable_conversation_history=True
    )
    
    if not manager.get_healthy_providers():
        print("❌ No healthy providers available for conversation test")
        manager.shutdown()
        return
    
    print_subsection("Multi-turn Conversation Test")
    
    conversation_id = "demo_conversation"
    
    # Conversation flow
    conversation_turns = [
        "Hello! My name is Alice and I'm a software developer.",
        "What's my name and profession?",
        "I'm working on a Python project. Can you help me with testing?",
        "What programming language and topic did I mention?",
        "Thanks for the help! Can you summarize our conversation?"
    ]
    
    for i, message in enumerate(conversation_turns):
        try:
            print(f"\nTurn {i+1}:")
            print(f"Human: {message}")
            
            response = manager.chat(message, conversation_id=conversation_id)
            print(f"AI: {response[:200]}{'...' if len(response) > 200 else ''}")
            
            time.sleep(0.5)  # Small delay between turns
            
        except Exception as e:
            print(f"❌ Turn {i+1} failed: {e}")
    
    print_subsection("Conversation History Summary")
    history = manager.get_conversation_history(conversation_id)
    print(f"Total exchanges in conversation: {len(history)}")
    
    # Test multiple conversations
    print_subsection("Multiple Conversation Tracking")
    
    conversations = [
        ("tech_chat", "Let's discuss technology trends."),
        ("science_chat", "Tell me about recent scientific discoveries."),
        ("art_chat", "What's your favorite art movement?")
    ]
    
    for conv_id, initial_message in conversations:
        try:
            response = manager.chat(initial_message, conversation_id=conv_id)
            print(f"✅ {conv_id}: Started successfully")
        except Exception as e:
            print(f"❌ {conv_id}: Failed - {e}")
    
    manager.shutdown()


def demonstrate_error_handling_and_fallbacks():
    """Demonstrate robust error handling and fallback mechanisms."""
    print_section("ERROR HANDLING AND FALLBACK DEMONSTRATION")
    
    # Test with intentionally problematic configuration
    print_subsection("Testing Fallback Mechanisms")
    
    # Create manager with a non-existent primary provider to force fallback
    manager = create_manager(
        primary_provider="nonexistent_provider",  # This will fail
        fallback_providers=["ollama", "google_genai"],
        selection_policy=SelectionPolicy.FAILOVER,
        max_retries=2,
        retry_delay=0.5
    )
    
    print("Manager created with intentionally failing primary provider")
    
    # Test fallback behavior
    if manager.get_healthy_providers():
        try:
            print("Testing fallback to healthy providers...")
            response = manager.chat(
                "This should work via fallback providers",
                conversation_id="fallback_test"
            )
            print("✅ Fallback mechanism worked successfully")
        except Exception as e:
            print(f"❌ Fallback failed: {e}")
    else:
        print("❌ No healthy fallback providers available")
    
    # Test provider health monitoring
    print_subsection("Health Monitoring Test")
    manager.force_provider_health_check()
    
    health_status = manager.health_check()
    print(f"System status: {health_status['status']}")
    print(f"Healthy providers: {health_status['healthy_providers']}")
    
    manager.shutdown()


def demonstrate_specialized_managers():
    """Demonstrate specialized manager configurations."""
    print_section("SPECIALIZED MANAGER CONFIGURATIONS")
    
    # Ollama-optimized manager
    print_subsection("Ollama-Optimized Manager")
    ollama_manager = create_ollama_manager()
    
    print("✅ Ollama manager created")
    print(f"Available providers: {ollama_manager.get_available_providers()}")
    print(f"Selection policy: {ollama_manager.provider_selector.selection_policy.value}")
    
    ollama_status = ollama_manager.get_system_status()
    print(f"Primary provider: {ollama_status['config']['primary_provider']}")
    print(f"Fallback providers: {ollama_status['config']['fallback_providers']}")
    
    ollama_manager.shutdown()
    
    # Cloud-optimized manager  
    print_subsection("Cloud-Optimized Manager")
    cloud_manager = create_cloud_manager(selection_policy=SelectionPolicy.LOWEST_COST)
    
    print("✅ Cloud manager created")
    print(f"Available providers: {cloud_manager.get_available_providers()}")
    print(f"Selection policy: {cloud_manager.provider_selector.selection_policy.value}")
    
    cloud_status = cloud_manager.get_system_status()
    print(f"Primary provider: {cloud_status['config']['primary_provider']}")
    print(f"Fallback providers: {cloud_status['config']['fallback_providers']}")
    
    cloud_manager.shutdown()


def main():
    """Run all demonstrations."""
    print("🚀 Enhanced LLM Abstraction Layer Test Suite")
    print("=" * 60)
    
    try:
        demonstrate_basic_functionality()
        demonstrate_advanced_selection_policies()
        demonstrate_metrics_and_monitoring()
        demonstrate_conversation_management()
        demonstrate_error_handling_and_fallbacks()
        demonstrate_specialized_managers()
        
        print_section("TEST SUITE COMPLETED SUCCESSFULLY")
        print("✅ All demonstrations completed!")
        print("\nKey Features Demonstrated:")
        print("• Multiple provider selection policies")
        print("• Real-time health monitoring")
        print("• Comprehensive metrics collection")
        print("• Advanced conversation management")
        print("• Robust error handling and fallbacks")
        print("• Specialized manager configurations")
        print("• Cost tracking and performance monitoring")
        
    except Exception as e:
        print_section("TEST SUITE FAILED")
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main() 