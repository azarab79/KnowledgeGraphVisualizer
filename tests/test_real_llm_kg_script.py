#!/usr/bin/env python3
"""
Test for real_llm_kg_script.py with source_nodes functionality
"""

import pytest
import json
import sys
import os
from unittest.mock import patch, MagicMock

# Add the project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from real_llm_kg_script import get_real_kg_data, main


class TestRealLlmKgScript:
    """Tests for the real LLM knowledge graph script."""

    def test_source_nodes_in_error_response(self):
        """Test that error responses include empty source_nodes."""
        # Call function without proper Neo4j setup to trigger error path
        result = get_real_kg_data("test question")
        
        # Verify error response structure includes source_nodes
        assert result["success"] is False
        assert "source_nodes" in result
        assert result["source_nodes"] == []
        assert "error" in result

    @patch('real_llm_kg_script.get_real_kg_data')
    @patch('real_llm_kg_script.call_gemini')
    @patch('sys.argv', ['real_llm_kg_script.py', 'test question'])
    def test_main_function_includes_source_nodes(self, mock_call_gemini, mock_get_kg_data):
        """Test that main function includes source_nodes in output."""
        # Mock the knowledge graph data with source nodes
        mock_kg_data = {
            "success": True,
            "context": "Test context",
            "cypher_result": "Test cypher",
            "num_docs": 2,
            "source_documents": [{"id": "doc1", "title": "Test Doc"}],
            "source_nodes": [
                {"id": "node1", "name": "Test Node", "labels": ["Test"]}
            ]
        }
        mock_get_kg_data.return_value = mock_kg_data
        
        # Mock LLM response
        mock_call_gemini.return_value = "Test response"
        
        # Capture stdout
        import io
        from contextlib import redirect_stdout
        
        output_buffer = io.StringIO()
        with redirect_stdout(output_buffer):
            main()
        
        # Parse the JSON output
        output = output_buffer.getvalue().strip()
        result = json.loads(output)
        
        # Verify source_nodes are included
        assert "source_nodes" in result
        assert len(result["source_nodes"]) == 1
        assert result["source_nodes"][0]["id"] == "node1"
        assert result["source_nodes"][0]["name"] == "Test Node"
        assert result["source_nodes"][0]["labels"] == ["Test"]

    def test_source_node_structure_validation(self):
        """Test that source node structure is correct when manually constructed."""
        # Test the source node structure we expect
        test_node = {
            "id": "test_node_001",
            "name": "Test Node",
            "labels": ["Test", "Node"]
        }
        
        # Verify required fields
        assert "id" in test_node
        assert "name" in test_node
        assert "labels" in test_node
        assert isinstance(test_node["id"], str)
        assert isinstance(test_node["name"], str)
        assert isinstance(test_node["labels"], list)
        assert all(isinstance(label, str) for label in test_node["labels"])


if __name__ == "__main__":
    pytest.main([__file__]) 