#!/usr/bin/env python3
"""
Debug version of deekseek_query.py
This version has hardcoded parameters for easy debugging
"""

import os
import sys

# Set environment variables
os.environ["OPENAI_API_KEY"] = "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"
os.environ["NEO4J_USERNAME"] = "neo4j"
os.environ["NEO4J_URI"] = "bolt://localhost:7687"
os.environ["NEO4J_PASSWORD"] = "1979@rabu"
os.environ["NEO4J_DATABASE"] = "neo4j"

# Import the functions from the main script
from deekseek_query import get_real_kg_data, generate_llm_response

def debug_main():
    """Debug version of main function with hardcoded parameters"""
    
    # Debug parameters
    question = "How do I create a Spot order in EMS?"
    uri = "bolt://localhost:7687"
    user = "neo4j"
    password = "1979@rabu"
    database = "neo4j"
    
    print(f"🔍 DEBUG: Starting debug session", file=sys.stderr)
    print(f"🔍 DEBUG: Question: {question}", file=sys.stderr)
    print(f"🔍 DEBUG: Neo4j URI: {uri}", file=sys.stderr)
    print(f"🔍 DEBUG: Neo4j User: {user}", file=sys.stderr)
    
    try:
        # Step 1: Test knowledge graph retrieval
        print(f"🔍 DEBUG: Step 1 - Retrieving knowledge graph data", file=sys.stderr)
        kg_data = get_real_kg_data(question, uri=uri, user=user, password=password, database=database)
        
        print(f"🔍 DEBUG: KG retrieval success: {kg_data.get('success')}", file=sys.stderr)
        print(f"🔍 DEBUG: Documents found: {kg_data.get('num_docs', 0)}", file=sys.stderr)
        
        if not kg_data.get('success'):
            print(f"❌ DEBUG: KG Error: {kg_data.get('error')}", file=sys.stderr)
            return
            
        # Step 2: Test LLM response generation
        print(f"🔍 DEBUG: Step 2 - Generating LLM response", file=sys.stderr)
        answer = generate_llm_response(question, kg_data)
        
        print(f"🔍 DEBUG: LLM response generated successfully", file=sys.stderr)
        print(f"🔍 DEBUG: Answer length: {len(answer)} characters", file=sys.stderr)
        
        # Print the result
        result = {
            "answer": answer,
            "question": question,
            "kg_success": kg_data["success"],
            "documents_found": kg_data.get("num_docs", 0),
            "source_documents": kg_data.get("source_documents", [])
        }
        
        print("✅ DEBUG: Final result:")
        import json
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"❌ DEBUG: Exception occurred: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_main()
