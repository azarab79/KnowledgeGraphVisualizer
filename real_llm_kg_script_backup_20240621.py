#!/usr/bin/env python3
"""
Real LLM + Knowledge Graph Integration

Backup created on 2025-06-21 of original real_llm_kg_script.py.
"""

import sys
import json
import os
import re
import requests
from typing import List, Dict, Any
import argparse
from contextlib import contextmanager
from langchain_neo4j import Neo4jGraph
from langchain_core.documents import Document
from neo4j import GraphDatabase

# -------------------------------
# MARKDOWN FORMATTING UTILITIES
# -------------------------------

def format_markdown_response(content: str, title: str = None, add_metadata: bool = True, 
                           metadata_text: str = None) -> str:
    """
    Utility function to ensure proper Markdown formatting for responses with minimal spacing.
    
    Args:
        content: The main response content
        title: Optional title to add at the top
        add_metadata: Whether to add metadata footer
        metadata_text: Custom metadata text
        
    Returns:
        Properly formatted Markdown string
    """
    formatted = ""
    
    # Add title if provided (reduced spacing)
    if title:
        formatted += f"# {title}\n"
    
    # Ensure content has minimal line breaks
    if content:
        # Clean up excessive line breaks - convert multiple \n\n to single \n\n
        content = re.sub(r'\n\n\n+', '\n\n', content.strip())
        # Reduce excessive spacing between paragraphs
        content = re.sub(r'\n\n', '\n', content)
        formatted += content
    
    # Add metadata footer if requested (minimal spacing)
    if add_metadata and metadata_text:
        if not formatted.endswith('\n'):
            formatted += '\n'
        formatted += f"\n---\n{metadata_text}"
    
    return formatted

def sanitize_markdown(text: str) -> str:
    """
    Clean and sanitize Markdown text to ensure proper rendering with minimal spacing.
    
    Args:
        text: Raw text that may contain Markdown
        
    Returns:
        Cleaned Markdown text with reduced spacing
    """
    # Remove any potential code block markers that might be incorrectly added
    text = re.sub(r'^```markdown\s*\n?', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n?```$', '', text)
    
    # Ensure minimal spacing around headers (single line break instead of double)
    text = re.sub(r'\n(#{1,6})\s*', r'\n\1 ', text)
    
    # Ensure minimal spacing around horizontal rules
    text = re.sub(r'\n-{3,}\n', r'\n---\n', text)
    
    # Collapse 3+ newlines to 2
    text = re.sub(r'\n\n\n+', '\n\n', text)
    # The following line was collapsing list items into a single line.
    # It has been commented out to preserve list formatting for related questions.
    # text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    
    return text.strip()

# -------------------------------

# Load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass # dotenv not installed, continue without it

# Get Neo4j credentials from environment variables, with defaults
NEO4J_URI = os.environ.get("NEO4J_URI", "neo4j://localhost:7687")
NEO4J_USERNAME = os.environ.get("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "password")
NEO4J_DATABASE = os.environ.get("NEO4J_DATABASE", "neo4j")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

def get_real_kg_data(question: str, uri: str, user: str, password: str, database: str) -> Dict[str, Any]:
    """
    Query the knowledge graph for context relevant to the user's question.
    Connects to Neo4j, retrieves documents, and constructs a context string.
    """
    try:
        # Initialize Neo4j connection directly with LangChain's wrapper
        graph = Neo4jGraph(
            url=uri,
            username=user,
            password=password,
            database=database
        )

        # 1. Full-text search for documents using a custom retriever
        class SimpleFullTextRetriever:
            def __init__(self, graph):
                self.graph = graph
                
            def invoke(self, query: str) -> List[Document]:
                ft_query = re.sub(r'[+\-!(){}\[\]^"~*?:\\/]|&&|\|\|', "", query)
                result = self.graph.query(
                    "CALL db.index.fulltext.queryNodes('keyword', $query) YIELD node, score "
                    "RETURN node.text AS text, score, node.metadata AS metadata LIMIT 10",
                    {"query": ft_query}
                )
                return [
                    Document(page_content=record["text"], metadata=record.get("metadata") or {})
                    for record in result
                ]
        
        # Get documents using full-text search
        retriever = SimpleFullTextRetriever(graph)
        context_docs = retriever.invoke(question)
        context = "\n\n".join([doc.page_content for doc in context_docs])
        
        # Convert documents to serializable format for frontend
        source_documents = []
        for i, doc in enumerate(context_docs):
            # Create a truncated preview for the icon (first 150 chars)
            preview = doc.page_content[:150].strip()
            if len(doc.page_content) > 150:
                preview += "..."
                
            source_documents.append({
                "id": f"doc_{i+1}",
                "title": f"Document {i+1}",
                "preview": preview,
                "full_text": doc.page_content,
                "metadata": dict(doc.metadata) if doc.metadata else {},
                "source": "knowledge_graph"
            })
        
        # Enhanced Cypher query generation based on question analysis
        cypher_result = ""
        question_lower = question.lower()
        
        # Try different Cypher queries based on question content
        cypher_queries = []
        
        if any(keyword in question_lower for keyword in ['risk', 'reversal', 'option', 'strategy']):
            cypher_queries.append(
                "MATCH (n) WHERE toLower(n.id) CONTAINS 'risk' OR toLower(n.id) CONTAINS 'reversal' OR toLower(n.id) CONTAINS 'option' "
                "RETURN n.id AS id, n.name AS name, labels(n) AS labels LIMIT 5"
            )
        
        if any(keyword in question_lower for keyword in ['currency', 'group', 'ads', 'amount']):
            cypher_queries.append(
                "MATCH (n) WHERE toLower(n.id) CONTAINS 'currency' OR toLower(n.id) CONTAINS 'group' OR toLower(n.id) CONTAINS 'amount' "
                "RETURN n.id AS id, n.name AS name, labels(n) AS labels LIMIT 5"
            )
        
        if any(keyword in question_lower for keyword in ['module', 'component', 'platform', 'api']):
            cypher_queries.append(
                "MATCH (n) WHERE toLower(n.id) CONTAINS 'module' OR toLower(n.id) CONTAINS 'api' OR toLower(n.id) CONTAINS 'platform' "
                "RETURN n.id AS id, n.name AS name, labels(n) AS labels LIMIT 5"
            )
        
        # If no specific queries, do a general search
        if not cypher_queries:
            # Extract key terms from the question
            key_terms = re.findall(r'\b[a-zA-Z]{3,}\b', question_lower)
            if key_terms:
                term = key_terms[0]  # Use first significant term
                cypher_queries.append(
                    f"MATCH (n) WHERE toLower(n.id) CONTAINS '{term}' "
                    "RETURN n.id AS id, n.name AS name, labels(n) AS labels LIMIT 5"
                )
        
        # Execute Cypher queries and collect source nodes
        source_nodes = []
        for query in cypher_queries:
            try:
                query_result = graph.query(query)
                if query_result:
                    cypher_result += f"Graph nodes found: {str(query_result)}\n"
                    
                    # Extract source nodes from query result (limit to 15 nodes max)
                    try:
                        for record in query_result[:15]:
                            if isinstance(record, dict) and 'id' in record:
                                node_id = record.get('id', '')
                                node_name = record.get('name', node_id)  # Use id as fallback for name
                                node_labels = record.get('labels', [])
                                
                                # Ensure labels is a list and strings
                                if not isinstance(node_labels, list):
                                    node_labels = [str(node_labels)] if node_labels else []
                                
                                # Create source node object with error boundary
                                try:
                                    source_node = {
                                        "id": str(node_id),
                                        "name": str(node_name) if node_name else str(node_id),
                                        "labels": [str(label) for label in node_labels]
                                    }
                                    source_nodes.append(source_node)
                                except Exception as node_error:
                                    # Skip malformed nodes but continue processing
                                    print(f"Warning: Skipping malformed node: {node_error}", file=sys.stderr)
                                    continue
                    except Exception as extraction_error:
                        print(f"Warning: Error extracting source nodes: {extraction_error}", file=sys.stderr)
                    break  # Use first successful query
            except Exception as e:
                continue
        
        return {
            "context": context,
            "cypher_result": cypher_result,
            "num_docs": len(context_docs),
            "source_documents": source_documents,  # Add source documents
            "source_nodes": source_nodes,  # Add source nodes
            "success": True
        }
    
    except Exception as e:
        return {
            "context": "",
            "cypher_result": "",
            "num_docs": 0,
            "source_documents": [],  # Empty documents on error
            "source_nodes": [],  # Empty nodes on error
            "success": False,
            "error": str(e)
        }


def call_ollama(prompt: str, model: str = "deepseek-r1:8b") -> str:
    """
    Call Ollama API to generate a response using the specified model.
    """
    try:
        ollama_url = "http://localhost:11434/api/generate"
        response = requests.post(ollama_url, json={"prompt": prompt, "model": model})
        response.raise_for_status()
        return response.json()["response"]
    except Exception as e:
        print(f"Error calling Ollama API: {e}", file=sys.stderr)
        return ""
