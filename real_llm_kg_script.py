#!/usr/bin/env python3
"""
Real LLM + Knowledge Graph Integration

This script properly combines:
1. Real Neo4j knowledge graph data retrieval
2. Ollama LLM for intelligent response generation
3. Proper context passing to the LLM
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
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "top_p": 0.9,
                "top_k": 40
            }
        }
        
        response = requests.post(ollama_url, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        return result.get("response", "No response generated")
        
    except requests.exceptions.RequestException as e:
        return f"Error calling Ollama: {str(e)}"
    except Exception as e:
        return f"Unexpected error: {str(e)}"

def call_gemini(prompt: str, model: str = "gemini-2.5-pro-preview-06-05") -> str:
    """
    Call Google Gemini API to generate a response using the specified model.
    Particularly useful for Cypher query generation.
    """
    try:
        api_key = GOOGLE_API_KEY
        if not api_key:
            return "Error: GOOGLE_API_KEY not found in environment variables"
        
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topK": 40,
                "topP": 0.9,
                "maxOutputTokens": 8192,
            }
        }
        
        response = requests.post(gemini_url, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        # Extract the generated text from Gemini's response structure
        if "candidates" in result and len(result["candidates"]) > 0:
            candidate = result["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"]:
                parts = candidate["content"]["parts"]
                if len(parts) > 0 and "text" in parts[0]:
                    return parts[0]["text"]
        
        return "No response generated by Gemini"
        
    except requests.exceptions.RequestException as e:
        return f"Error calling Gemini API: {str(e)}"
    except Exception as e:
        return f"Unexpected error calling Gemini: {str(e)}"

def generate_llm_response(question: str, kg_data: Dict[str, Any]) -> str:
    """
    Generate a response using Gemini LLM with real knowledge graph data as context.
    """
    
    if not kg_data["success"]:
        return f"❌ **Error**: I encountered an error accessing the knowledge graph: {kg_data.get('error', 'Unknown error')}"
    
    context = kg_data["context"]
    cypher_result = kg_data["cypher_result"]
    
    if not context and not cypher_result:
        return """❓ **No Information Found**

I couldn't find relevant information in the knowledge graph for your question. Could you try:
- Rephrasing your question
- Being more specific about the 360T platform feature you're asking about
- Using different keywords related to your query"""
    
    # Construct a comprehensive prompt for the LLM with Markdown formatting instructions
    prompt = f"""You are a 360T Platform expert assistant. Answer the user's question using ONLY the provided knowledge graph data. 

**IMPORTANT**: 
- Format your response in clean, well-structured Markdown with:
- Use ## for main sections
- Use ### for subsections  
- Use bullet points (-) for lists
- Use **bold** for emphasis on key terms
- Use `code blocks` for technical terms, field names, or values
- Use > blockquotes for important notes or warnings
- Include line breaks between sections for readability
- At the end, suggest 2-3 relevant follow-up questions in a "### 💡 Related Questions" section

=== KNOWLEDGE GRAPH DATA ===

Documents Found ({kg_data['num_docs']} total):
{context[:10000]}  

Graph Relationships:
{cypher_result[:1000]}

=== USER QUESTION ===
{question}

=== INSTRUCTIONS ===
0. Start with a short version of the response, and then the details
1. Base your answer ONLY on the provided knowledge graph data above
2. If the data doesn't fully answer the question, say so clearly in a callout box
3. Be specific and detailed where the data supports it
4. Use clear Markdown formatting as specified above
5. Mention that your response is based on the 360T knowledge base
6. Structure your answer logically with clear sections

**Format your response in Markdown starting now:**
"""

    # Call Gemini to generate the response
    llm_response = call_gemini(prompt)
    
    # Sanitize and format the response
    llm_response = sanitize_markdown(llm_response)
    
    # Add metadata to the response with Markdown formatting
    if "Error" not in llm_response and "❌" not in llm_response:
        metadata_text = f"*📊 This response is based on **{kg_data['num_docs']} documents** from the 360T knowledge graph.*"
        llm_response = format_markdown_response(
            content=llm_response,
            add_metadata=True,
            metadata_text=metadata_text
        )
    
    return llm_response

def main():
    parser = argparse.ArgumentParser(description="Query the 360T knowledge graph.")
    parser.add_argument("question", type=str, help="The question to ask the knowledge graph.")
    parser.add_argument("--uri", type=str, default=os.getenv("NEO4J_URI"), help="Neo4j URI")
    parser.add_argument("--user", type=str, default=os.getenv("NEO4J_USERNAME"), help="Neo4j Username")
    parser.add_argument("--password", type=str, default=os.getenv("NEO4J_PASSWORD"), help="Neo4j Password")
    parser.add_argument("--database", type=str, default=os.getenv("NEO4J_DATABASE", "neo4j"), help="Neo4j Database")

    if len(sys.argv) < 2:
        parser.print_help()
        sys.exit(1)

    args = parser.parse_args()

    try:
        # Get real knowledge graph data
        print(f"🔍 Retrieving knowledge graph data for: {args.question}", file=sys.stderr)
        kg_data = get_real_kg_data(
            args.question, 
            uri=args.uri, 
            user=args.user, 
            password=args.password, 
            database=args.database
        )
        
        if kg_data["success"]:
            print(f"✅ Found {kg_data['num_docs']} documents in knowledge graph", file=sys.stderr)
        else:
            print(f"❌ Knowledge graph error: {kg_data.get('error')}", file=sys.stderr)
        
        # Generate LLM response using Gemini
        print("🤖 Generating response with Gemini LLM...", file=sys.stderr)
        answer = generate_llm_response(args.question, kg_data)
        
        result = {
            "answer": answer,
            "question": args.question,
            "timestamp": "2025-01-06T12:00:00Z",
            "source": "gemini_knowledge_graph",
            "kg_success": kg_data["success"],
            "documents_found": kg_data["num_docs"],
            "source_documents": kg_data.get("source_documents", []),  # Include source documents
            "source_nodes": kg_data.get("source_nodes", []),  # Include source nodes
            "llm_used": "gemini-2.5-pro-preview-06-05"
        }
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main() 