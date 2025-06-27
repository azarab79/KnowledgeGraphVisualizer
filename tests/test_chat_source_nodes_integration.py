"""
Integration test for source nodes flow from Python backend to frontend.
This test verifies that source_nodes are properly extracted and propagated.
"""

import json
import subprocess
import sys
from pathlib import Path

def test_python_script_includes_source_nodes():
    """Test that the Python script includes source_nodes in its JSON output."""
    script_path = Path(__file__).parent.parent / "real_llm_kg_script.py"
    
    try:
        # Run the Python script with a test question
        result = subprocess.run(
            [sys.executable, str(script_path), "test question"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        # Check that the script executed successfully
        assert result.returncode == 0, f"Script failed with error: {result.stderr}"
        
        # Parse the JSON output
        output = json.loads(result.stdout.strip())
        
        # Verify source_nodes field exists
        assert "source_nodes" in output, "source_nodes field missing from output"
        assert isinstance(output["source_nodes"], list), "source_nodes should be a list"
        
        print("✅ Python script correctly includes source_nodes field")
        return True
        
    except subprocess.TimeoutExpired:
        print("❌ Python script timed out")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse JSON output: {e}")
        print(f"Raw output: {result.stdout}")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def test_api_endpoint_structure():
    """Test that the main API endpoint is structured to handle source_nodes."""
    api_file = Path(__file__).parent.parent / "360t-kg-api" / "routes" / "chatRoutes.js"
    
    try:
        content = api_file.read_text()
        
        # Check that source_nodes is extracted from result
        assert "source_nodes" in content, "API should extract source_nodes from Python result"
        assert "sourceNodes: result.source_nodes" in content, "API should map source_nodes to sourceNodes"
        
        print("✅ Main API correctly handles source_nodes")
        return True
        
    except Exception as e:
        print(f"❌ API structure test failed: {e}")
        return False

def test_frontend_api_service():
    """Test that the frontend API service handles sourceNodes."""
    api_service_file = Path(__file__).parent.parent / "360t-kg-ui" / "src" / "services" / "chatApiService.js"
    
    try:
        content = api_service_file.read_text()
        
        # Check that sourceNodes is extracted and handled
        assert "sourceNodes" in content, "Frontend should handle sourceNodes"
        assert "responseData.response?.sourceNodes" in content, "Frontend should extract sourceNodes from response"
        
        print("✅ Frontend API service correctly handles sourceNodes")
        return True
        
    except Exception as e:
        print(f"❌ Frontend API service test failed: {e}")
        return False

def test_type_definitions():
    """Test that type definitions include SourceNode interface."""
    types_file = Path(__file__).parent.parent / "360t-kg-ui" / "src" / "types" / "chat.js"
    
    try:
        content = types_file.read_text()
        
        # Check that SourceNode type is defined
        assert "SourceNode" in content, "SourceNode type should be defined"
        assert "@property {string} id" in content, "SourceNode should have id property"
        assert "@property {string} name" in content, "SourceNode should have name property"
        assert "@property {string[]} labels" in content, "SourceNode should have labels property"
        
        # Check that ChatMessage includes sourceNodes
        assert "sourceNodes" in content, "ChatMessage should include sourceNodes field"
        
        print("✅ Type definitions correctly include SourceNode")
        return True
        
    except Exception as e:
        print(f"❌ Type definitions test failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Running Chat Source Nodes Integration Tests")
    print("=" * 50)
    
    tests = [
        test_python_script_includes_source_nodes,
        test_api_endpoint_structure,
        test_frontend_api_service,
        test_type_definitions
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All integration tests passed! Source nodes implementation is working correctly.")
        sys.exit(0)
    else:
        print("❌ Some tests failed. Please check the implementation.")
        sys.exit(1) 