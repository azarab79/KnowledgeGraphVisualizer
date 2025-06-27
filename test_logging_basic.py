#!/usr/bin/env python3
"""
Basic test script for logging configuration verification (without FastAPI dependencies).

This script tests the core logging functionality without requiring FastAPI middleware.
"""

import os
import sys
import time
import json
import traceback
from pathlib import Path

# Add the config directory to the path
sys.path.insert(0, str(Path(__file__).parent))

# Test basic logging configuration without FastAPI middleware
def test_basic_structured_logging():
    """Test basic structured logging functionality."""
    print("Testing basic structured logging functionality...")
    
    # Import only the core components we need
    from config.logging_config_core import (
        setup_logging,
        get_logger,
        StructuredJSONFormatter,
        log_performance,
        correlation_id
    )
    
    # Setup logging with JSON format
    setup_logging(
        log_level='DEBUG',
        enable_console=True,
        enable_file=True,
        enable_json=True,
        log_file_name='test_basic_logging.log'
    )
    
    # Test basic logging
    logger = get_logger("test_basic")
    
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    logger.critical("This is a critical message")
    
    print("✅ Basic logging levels test completed")
    
    # Test structured logging with extra fields
    logger = get_logger("test_structured")
    
    logger.info(
        "Structured log entry with extra fields",
        extra={
            'user_id': 12345,
            'operation': 'test_operation',
            'request_id': 'req_123',
            'metadata': {
                'nested_field': 'nested_value',
                'count': 42
            }
        }
    )
    
    print("✅ Structured logging test completed")
    
    # Test correlation ID
    logger = get_logger("test_correlation")
    
    # Set correlation ID
    correlation_id.set("test-correlation-id-123")
    
    logger.info("Log entry with correlation ID set")
    logger.warning("Warning with correlation ID")
    
    # Clear correlation ID
    correlation_id.set(None)
    
    logger.info("Log entry without correlation ID")
    
    print("✅ Correlation ID test completed")
    
    # Test exception logging
    logger = get_logger("test_exception")
    
    try:
        # Intentionally cause an exception
        result = 1 / 0
    except ZeroDivisionError as e:
        logger.exception(
            "Caught division by zero",
            extra={
                'error_context': 'testing_exception_logging',
                'operation': 'division'
            }
        )
    
    print("✅ Exception logging test completed")
    
    # Test performance logging
    start_time = time.time()
    time.sleep(0.1)  # Simulate work
    duration = time.time() - start_time
    
    log_performance(
        operation="test_slow_operation",
        duration=duration,
        test_context="performance_test",
        operation_type="simulation"
    )
    
    print("✅ Performance logging test completed")
    
    return True


def test_json_formatter():
    """Test the JSON formatter directly."""
    print("Testing JSON formatter...")
    
    from config.logging_config_core import StructuredJSONFormatter
    import logging
    
    # Create a test log record
    logger = logging.getLogger("test_formatter")
    formatter = StructuredJSONFormatter()
    
    # Create a log record
    record = logger.makeRecord(
        name="test_formatter",
        level=logging.INFO,
        fn="test_file.py",
        lno=42,
        msg="Test message with extra data",
        args=(),
        exc_info=None,
        func="test_function",
        extra={'custom_field': 'custom_value', 'number_field': 123}
    )
    
    # Format the record
    formatted = formatter.format(record)
    
    # Parse the JSON to verify it's valid
    try:
        parsed = json.loads(formatted)
        print(f"✅ JSON formatter produced valid JSON with {len(parsed)} fields")
        
        # Check required fields
        required_fields = ['timestamp', 'level', 'logger', 'message', 'service', 'process', 'source']
        for field in required_fields:
            if field not in parsed:
                print(f"❌ Missing required field: {field}")
                return False
            
        print(f"✅ All required fields present: {required_fields}")
        
        # Check custom fields are in extra
        if 'extra' in parsed and 'custom_field' in parsed['extra']:
            print("✅ Custom fields properly included in extra section")
        else:
            print("❌ Custom fields not found in extra section")
            return False
            
    except json.JSONDecodeError as e:
        print(f"❌ JSON formatter produced invalid JSON: {e}")
        return False
    
    return True


def test_log_files():
    """Test that log files are created and contain expected content."""
    print("Testing log file creation...")
    
    logs_dir = Path("logs")
    if not logs_dir.exists():
        print("❌ Logs directory does not exist")
        return False
    
    log_files = list(logs_dir.glob("*.log"))
    if not log_files:
        print("❌ No log files found")
        return False
    
    print(f"✅ Found {len(log_files)} log files:")
    
    for log_file in log_files:
        size = log_file.stat().st_size
        print(f"  - {log_file.name}: {size} bytes")
        
        if size == 0:
            print(f"    ⚠️  Log file {log_file.name} is empty")
        else:
            # Read a few lines to verify content
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    print(f"    ✅ {len(lines)} log entries")
                    
                    # Try to parse first line as JSON
                    if lines:
                        try:
                            first_entry = json.loads(lines[0].strip())
                            print(f"    ✅ Valid JSON format confirmed")
                        except json.JSONDecodeError:
                            print(f"    ⚠️  First line is not valid JSON")
                            
            except Exception as e:
                print(f"    ❌ Error reading log file: {e}")
    
    return True


def main():
    """Run all basic logging tests."""
    print("🚀 Starting Basic Logging Configuration Tests")
    print("=" * 50)
    
    tests = [
        ("Basic Structured Logging", test_basic_structured_logging),
        ("JSON Formatter", test_json_formatter),
        ("Log Files", test_log_files)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🧪 Running: {test_name}")
        print("-" * 30)
        
        try:
            result = test_func()
            results.append((test_name, result))
            
            if result:
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
                
        except Exception as e:
            print(f"❌ {test_name} FAILED with exception: {e}")
            traceback.print_exc()
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary")
    print("=" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All basic logging tests passed!")
        print("\nTo view structured JSON logs, try:")
        print("  cat logs/test_basic_logging.log | head -5")
        return 0
    else:
        print("⚠️ Some tests failed. Review the implementation.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 