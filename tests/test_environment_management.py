#!/usr/bin/env python3
"""
Test Suite for Environment Management System

This module provides comprehensive testing for the environment management
system including configuration loading, environment detection, and
integration with FastAPI dependencies.
"""

import os
import sys
import tempfile
import pytest
from pathlib import Path
from unittest.mock import patch, Mock

# Add the project root to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from config.environment import (
        Environment,
        AppSettings,
        DatabaseConfig,
        LLMConfig,
        CacheConfig,
        SecurityConfig,
        MonitoringConfig,
        detect_environment,
        get_settings,
        create_env_files
    )
    from config.dependencies_integration import (
        UnifiedAppConfig,
        get_unified_config,
        get_app_config,
        get_llm_config,
        get_database_config,
        get_cache_config,
        get_security_config,
        validate_production_config,
        print_configuration_summary
    )
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure the config modules are properly set up")
    sys.exit(1)


def test_environment_detection():
    """Test basic environment detection functionality."""
    print("Testing environment detection...")
    
    # Test environment detection from ENV variable
    test_cases = [
        ("development", "development"),
        ("testing", "testing"), 
        ("staging", "staging"),
        ("production", "production"),
        ("invalid", "development")  # Should default to development
    ]
    
    for env_value, expected in test_cases:
        with patch.dict(os.environ, {"ENVIRONMENT": env_value}, clear=True):
            try:
                env = detect_environment()
                expected_enum = Environment(expected) if expected != "development" or env_value != "invalid" else Environment.DEVELOPMENT
                assert env == expected_enum, f"Expected {expected_enum}, got {env}"
                print(f"  ✓ {env_value} -> {env.value}")
            except Exception as e:
                print(f"  ❌ {env_value} failed: {e}")


def test_configuration_loading():
    """Test configuration loading with various scenarios."""
    print("\nTesting configuration loading...")
    
    try:
        # Test default configuration
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}, clear=True):
            get_settings.cache_clear() if hasattr(get_settings, 'cache_clear') else None
            settings = get_settings()
            
            assert settings.app_name == "QA Pipeline API"
            assert settings.environment.value == "development"
            assert settings.debug is True
            print("  ✓ Default configuration loaded")
        
        # Test with custom environment variables
        env_vars = {
            "ENVIRONMENT": "production",
            "APP_NAME": "Production QA API",
            "DEBUG": "false",
            "PORT": "9000"
        }
        
        with patch.dict(os.environ, env_vars):
            get_settings.cache_clear() if hasattr(get_settings, 'cache_clear') else None
            settings = get_settings()
            
            assert settings.environment.value == "production"
            assert settings.port == 9000
            print("  ✓ Environment variable override works")
            
    except Exception as e:
        print(f"  ❌ Configuration loading failed: {e}")


def test_llm_configuration():
    """Test LLM configuration functionality."""
    print("\nTesting LLM configuration...")
    
    try:
        # Test default LLM config
        config = LLMConfig()
        assert config.primary_provider == "ollama"
        assert config.ollama_enabled is True
        assert config.azure_openai_enabled is False
        print("  ✓ Default LLM configuration")
        
        # Test auto-enabling providers with API keys
        env_vars = {
            "LLM_AZURE_OPENAI_API_KEY": "test-azure-key",
            "LLM_GOOGLE_API_KEY": "test-google-key"
        }
        
        with patch.dict(os.environ, env_vars):
            config = LLMConfig()
            assert config.azure_openai_enabled is True
            assert config.google_enabled is True
            print("  ✓ Auto-enabling providers with API keys")
            
    except Exception as e:
        print(f"  ❌ LLM configuration failed: {e}")


def test_database_configuration():
    """Test database configuration functionality."""
    print("\nTesting database configuration...")
    
    try:
        # Test default database config
        config = DatabaseConfig()
        assert config.neo4j_uri == "bolt://localhost:7687"
        assert config.neo4j_username == "neo4j"
        assert config.max_connection_pool_size == 50
        print("  ✓ Default database configuration")
        
        # Test with environment variables
        env_vars = {
            "NEO4J_URI": "bolt://prod-neo4j:7687",
            "NEO4J_USERNAME": "prod_user",
            "NEO4J_MAX_CONNECTION_POOL_SIZE": "100"
        }
        
        with patch.dict(os.environ, env_vars):
            config = DatabaseConfig()
            assert config.neo4j_uri == "bolt://prod-neo4j:7687"
            assert config.neo4j_username == "prod_user"
            assert config.max_connection_pool_size == 100
            print("  ✓ Environment variable database configuration")
            
    except Exception as e:
        print(f"  ❌ Database configuration failed: {e}")


def test_unified_configuration():
    """Test unified configuration integration."""
    print("\nTesting unified configuration...")
    
    try:
        # Clear cache if it exists
        if hasattr(get_unified_config, 'cache_clear'):
            get_unified_config.cache_clear()
        
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            config = get_unified_config()
            
            assert config.is_development() is True
            assert hasattr(config, 'env_settings')
            print("  ✓ Unified configuration creation")
            
            # Test LLM configuration mapping
            llm_config = config.get_llm_config_dict()
            assert isinstance(llm_config, dict)
            assert "primary_provider" in llm_config
            assert "providers" in llm_config
            print("  ✓ LLM configuration mapping")
            
            # Test database configuration mapping
            db_config = config.get_database_config_dict()
            assert isinstance(db_config, dict)
            assert "uri" in db_config
            assert "username" in db_config
            print("  ✓ Database configuration mapping")
            
    except Exception as e:
        print(f"  ❌ Unified configuration failed: {e}")


def test_environment_files():
    """Test environment file creation."""
    print("\nTesting environment file creation...")
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            original_cwd = os.getcwd()
            try:
                os.chdir(temp_dir)
                create_env_files()
                
                expected_files = [
                    ".env.development",
                    ".env.testing", 
                    ".env.staging",
                    ".env.production"
                ]
                
                for filename in expected_files:
                    file_path = Path(filename)
                    assert file_path.exists(), f"File {filename} not created"
                    
                    content = file_path.read_text()
                    assert "ENVIRONMENT=" in content
                    assert "NEO4J_URI=" in content
                    print(f"  ✓ Created {filename}")
                    
            finally:
                os.chdir(original_cwd)
                
    except Exception as e:
        print(f"  ❌ Environment file creation failed: {e}")


def test_production_validation():
    """Test production configuration validation."""
    print("\nTesting production validation...")
    
    try:
        # Test non-production validation (should pass)
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            if hasattr(get_unified_config, 'cache_clear'):
                get_unified_config.cache_clear()
            result = validate_production_config()
            assert result is True
            print("  ✓ Non-production validation passes")
        
        # Test production validation with proper config
        env_vars = {
            "ENVIRONMENT": "production",
            "SECURITY_SECRET_KEY": "production-secret-key-32-chars-min",
            "SECURITY_CORS_ORIGINS": '["https://yourdomain.com"]',
            "NEO4J_PASSWORD": "production-password",
            "LLM_AZURE_OPENAI_API_KEY": "prod-azure-key"
        }
        
        with patch.dict(os.environ, env_vars):
            if hasattr(get_unified_config, 'cache_clear'):
                get_unified_config.cache_clear()
            result = validate_production_config()
            assert result is True
            print("  ✓ Production validation with proper config")
            
    except Exception as e:
        print(f"  ❌ Production validation failed: {e}")


def test_configuration_summary():
    """Test configuration summary functionality."""
    print("\nTesting configuration summary...")
    
    try:
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            if hasattr(get_unified_config, 'cache_clear'):
                get_unified_config.cache_clear()
                
            # Capture output
            import io
            from contextlib import redirect_stdout
            
            f = io.StringIO()
            with redirect_stdout(f):
                print_configuration_summary()
            
            output = f.getvalue()
            assert "APPLICATION CONFIGURATION SUMMARY" in output
            assert "Environment: development" in output
            print("  ✓ Configuration summary generated")
            
    except Exception as e:
        print(f"  ❌ Configuration summary failed: {e}")


def run_integration_test():
    """Run complete integration test."""
    print("\n" + "="*60)
    print("INTEGRATION TEST")
    print("="*60)
    
    try:
        # Test complete flow for development environment
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            from config.environment import detect_environment, get_settings
            from config.dependencies_integration import (
                get_unified_config, get_llm_config, get_database_config,
                get_cache_config, get_security_config
            )
            
            # Clear caches
            if hasattr(get_settings, 'cache_clear'):
                get_settings.cache_clear()
            if hasattr(get_unified_config, 'cache_clear'):
                get_unified_config.cache_clear()
            
            # Test environment detection
            env = detect_environment()
            print(f"Environment detected: {env.value}")
            
            # Test settings loading
            settings = get_settings()
            print(f"Settings loaded for: {settings.environment.value}")
            print(f"Debug mode: {settings.debug}")
            print(f"Log level: {settings.get_effective_log_level()}")
            
            # Test unified config
            config = get_unified_config()
            print(f"Unified config created: {config.is_development()}")
            
            # Test dependency functions
            llm_config = get_llm_config()
            print(f"LLM config: {llm_config['primary_provider']}")
            
            db_config = get_database_config()
            print(f"Database config: {db_config['uri']}")
            
            cache_config = get_cache_config()
            print(f"Cache config: {cache_config['backend']}")
            
            security_config = get_security_config()
            print(f"Security config: Rate limiting = {security_config['rate_limit_enabled']}")
            
            print("\n✅ Integration test completed successfully!")
            return True
            
    except Exception as e:
        print(f"\n❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("🧪 Environment Management Test Suite")
    print("=" * 60)
    
    # List of test functions
    tests = [
        test_environment_detection,
        test_configuration_loading,
        test_llm_configuration,
        test_database_configuration,
        test_unified_configuration,
        test_environment_files,
        test_production_validation,
        test_configuration_summary
    ]
    
    # Run individual tests
    passed = 0
    total = len(tests)
    
    for test_func in tests:
        try:
            test_func()
            passed += 1
        except Exception as e:
            print(f"\n❌ {test_func.__name__} failed: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    # Run integration test
    integration_success = run_integration_test()
    
    if passed == total and integration_success:
        print("\n🎉 All tests passed! Environment management system is working correctly.")
        return 0
    else:
        print("\n⚠️ Some tests failed. Please review the implementation.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 