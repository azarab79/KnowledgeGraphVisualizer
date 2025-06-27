

#!/usr/bin/env python3
"""
Updated LLM + Knowledge Graph Search Script

This script uses Graphiti-style hybrid search logic on a Neo4j knowledge graph:
1. Retrieves relevant context from Neo4j using semantic vector similarity and keyword (BM25) search, combining results with RRF (Reciprocal Rank Fusion) and optional MMR for diversity.
2. Generates a final answer using a locally hosted DeepSeek 32B model via Ollama, including source citations.

The code is organized into modular functions for clarity:
- `get_real_kg_data`: performs retrieval from Neo4j (vector search + full-text search) and prepares context.
- `call_ollama`: queries the local Ollama API for LLM response generation.
- `generate_llm_response`: formats the prompt with context and instructions, and invokes the LLM to get the answer.
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
# OpenAI client will be imported when needed

# -------------------------------
# MARKDOWN FORMATTING UTILITIES
# (Same as original script for formatting outputs)
# -------------------------------
def format_markdown_response(content: str, title: str = None, add_metadata: bool = True, 
                             metadata_text: str = None) -> str:
    """
    Utility function to ensure proper Markdown formatting for responses with minimal spacing.
    """
    formatted = ""
    if title:
        formatted += f"# {title}\n"
    if content:
        # Clean up excessive line breaks
        content = re.sub(r'\n\n\n+', '\n\n', content.strip())
        content = re.sub(r'\n\n', '\n', content)
        formatted += content
    if add_metadata and metadata_text:
        if not formatted.endswith('\n'):
            formatted += '\n'
        formatted += f"\n---\n{metadata_text}"
    return formatted

def sanitize_markdown(text: str) -> str:
    """
    Clean and sanitize Markdown text to ensure proper rendering with minimal spacing.
    """
    # Remove any incorrectly added code block markers
    text = re.sub(r'^```markdown\s*\n?', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n?```$', '', text)
    # Ensure minimal spacing around headers and horizontal rules
    text = re.sub(r'\n(#{1,6})\s*', r'\n\1 ', text)
    text = re.sub(r'\n-{3,}\n', r'\n---\n', text)
    # Collapse 3+ newlines to 2
    text = re.sub(r'\n\n\n+', '\n\n', text)
    return text.strip()

# Load environment variables if available (e.g., OpenAI API key for embeddings)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Neo4j connection parameters (with defaults)
NEO4J_URI = os.environ.get("NEO4J_URI", "neo4j://localhost:7687")
NEO4J_USERNAME = os.environ.get("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "1979@rabu")
NEO4J_DATABASE = os.environ.get("NEO4J_DATABASE", "neo4j")

def get_real_kg_data(question: str, uri: str, user: str, password: str, database: str) -> Dict[str, Any]:
    """
    Retrieve relevant context from the Neo4j knowledge graph for the given question.
    Uses Graphiti-style hybrid search: semantic vector similarity + full-text keyword search 
    on both entity nodes and relationship facts. Results are combined and reranked to select 
    the most relevant and diverse set of context snippets.
    """

    try:
        # Connect to Neo4j database
        graph = Neo4jGraph(url=uri, username=user, password=password, database=database)
        
        # 1. Generate embedding for the user query using OpenAI (ensure OPENAI_API_KEY is set)
        query_embedding = None
        try:
            # Use OpenAI's embedding model (e.g., text-embedding-3-small)
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("Missing OpenAI API key for embedding generation.")

            # Use the new OpenAI client (v1.0.0+)
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            embed_response = client.embeddings.create(model="text-embedding-3-small", input=question)
            query_embedding = embed_response.data[0].embedding
        except Exception as e:
            # If embedding generation fails, return error
            return {
                "context": "",
                "num_docs": 0,
                "source_documents": [],
                "source_nodes": [],
                "success": False,
                "error": f"Embedding generation failed: {str(e)}"
            }
        
        # 2. Identify Neo4j vector and full-text indexes for nodes (entities/communities) and relationships (edges)
        vector_indexes = graph.query(
          "SHOW INDEXES YIELD name, type, entityType, labelsOrTypes, properties "
            "WHERE type = 'VECTOR'"  
        )
        fulltext_indexes = graph.query(
            "SHOW INDEXES YIELD name, type, entityType, labelsOrTypes, properties "
            "WHERE type = 'FULLTEXT'"
        )
        # Determine index names for semantic search
        node_vector_indexes = []  # could be multiple if separate per label
        rel_vector_indexes = []
        for idx in vector_indexes:
            if idx.get("entityType") == "NODE" and "name_embedding" in idx.get("properties", []):
                node_vector_indexes.append(idx["name"])
            if idx.get("entityType") == "RELATIONSHIP" and any(prop.endswith("fact_embedding") for prop in idx.get("properties", [])):
                rel_vector_indexes.append(idx["name"])
        # Determine index names for keyword search
        node_fulltext_indexes = []
        rel_fulltext_indexes = []
        for idx in fulltext_indexes:
            if idx.get("entityType") == "NODE" and ("name" in idx.get("properties", []) or "summary" in idx.get("properties", [])):
                node_fulltext_indexes.append(idx["name"])
            if idx.get("entityType") == "RELATIONSHIP" and "fact" in idx.get("properties", []):
                rel_fulltext_indexes.append(idx["name"])
        
        # 3. Perform semantic vector search on relationships (edge facts) and nodes (entity or community names)
        semantic_results: List[Dict] = []  # will collect {id, text, score, type}
        # Vector search on relationship facts
        if rel_vector_indexes:
            # Use the first relationship vector index (assuming one covers all facts). If multiple, use each and combine later.
            for rel_idx in rel_vector_indexes:
                try:
                    records = graph.query(
                        f"CALL db.index.vector.queryRelationships('{rel_idx}', $k, $vector) YIELD relationship, score "
                        "RETURN id(relationship) AS rel_id, relationship.fact AS text, relationship.fact_embedding AS embedding, score "
                        "LIMIT 10",
                        {"vector": query_embedding, "k": 10}
                    )
                    # Each record: {'rel_id': <int>, 'text': <fact string>, 'embedding': <list[float]>, 'score': <float>}
                    for rec in records:
                        rec["type"] = "edge"
                        semantic_results.append(rec)
                except Exception as e:
                    # Continue even if one index query fails
                    print(f"Warning: Vector search on relationships index {rel_idx} failed: {e}", file=sys.stderr)
        # Vector search on entity/community nodes
        if node_vector_indexes:
            for node_idx in node_vector_indexes:
                try:
                    records = graph.query(
                        f"CALL db.index.vector.queryNodes('{node_idx}', $k, $vector) YIELD node, score "
                        "RETURN id(node) AS node_id, node.name AS name, node.summary AS summary, node.name_embedding AS embedding, labels(node) AS labels, score "
                        "LIMIT 10",
                        {"vector": query_embedding, "k": 10}
                    )
                    for rec in records:
                        # Only include node result if it has a meaningful summary (for context text)
                        if rec.get("summary"):
                            rec["text"] = rec["summary"]
                        else:
                            # If no summary, skip using this node as context (no descriptive text)
                            continue
                        rec["type"] = "node"
                        semantic_results.append(rec)
                except Exception as e:
                    print(f"Warning: Vector search on nodes index {node_idx} failed: {e}", file=sys.stderr)
        
        # 4. Perform full-text keyword search on relationships and nodes
        keyword_query = re.sub(r'[+\-!(){}\\[\\]^"~*?:\\/]|&&|\\|\\|', " ", question)
        keyword_results: List[Dict] = []
        # Full-text search on relationship facts
        if rel_fulltext_indexes:
            for rel_idx in rel_fulltext_indexes:
                try:
                    records = graph.query(
                        f"CALL db.index.fulltext.queryRelationships('{rel_idx}', $query) YIELD relationship, score "
                        "RETURN id(relationship) AS rel_id, relationship.fact AS text, score "
                        "LIMIT 10",
                        {"query": keyword_query}
                    )
                    for rec in records:
                        rec["type"] = "edge"
                        # (We could retrieve embedding for these edges if needed for MMR, omitted for simplicity)
                        keyword_results.append(rec)
                except Exception as e:
                    print(f"Warning: Full-text search on relationships index {rel_idx} failed: {e}", file=sys.stderr)
        # Full-text search on node names/summaries
        if node_fulltext_indexes:
            for node_idx in node_fulltext_indexes:
                try:
                    records = graph.query(
                        f"CALL db.index.fulltext.queryNodes('{node_idx}', $query) YIELD node, score "
                        "RETURN id(node) AS node_id, node.name AS name, node.summary AS summary, labels(node) AS labels, score "
                        "LIMIT 10",
                        {"query": keyword_query}
                    )
                    for rec in records:
                        if rec.get("summary"):
                            rec["text"] = rec["summary"]
                        else:
                            # If no summary text, we can skip (node name alone is not useful context)
                            continue
                        rec["type"] = "node"
                        keyword_results.append(rec)
                except Exception as e:
                    print(f"Warning: Full-text search on nodes index {node_idx} failed: {e}", file=sys.stderr)
        
        # 5. Combine and rerank results using Reciprocal Rank Fusion (RRF) and Maximal Marginal Relevance (MMR)
        combined_candidates: Dict[str, Dict] = {}  # key by unique identifier (node_id or rel_id)
        # Assign RRF scores for semantic and keyword result lists separately
        # Semantic results list
        for rank, rec in enumerate(semantic_results, start=1):
            # Unique key: distinguish node vs edge by prefix
            if rec.get("node_id") is not None:
                key = f"node_{rec['node_id']}"
            else:
                key = f"rel_{rec['rel_id']}"
            # Initialize candidate entry
            if key not in combined_candidates:
                combined_candidates[key] = {
                    "text": rec.get("text") or rec.get("name", ""),
                    "type": rec["type"],
                    "score": 0.0,
                    "embedding": rec.get("embedding")  # may be None for keyword-only results
                }
            # RRF scoring: using 1/(rank + 0) (could add constant if desired)
            combined_candidates[key]["score"] += 1.0 / rank
        # Keyword results list
        for rank, rec in enumerate(keyword_results, start=1):
            if rec.get("node_id") is not None:
                key = f"node_{rec['node_id']}"
            else:
                key = f"rel_{rec['rel_id']}"
            if key not in combined_candidates:
                combined_candidates[key] = {
                    "text": rec.get("text") or rec.get("name", ""),
                    "type": rec["type"],
                    "score": 0.0,
                    "embedding": None  # we may not have embedding for keyword-only results
                }
            combined_candidates[key]["score"] += 1.0 / rank
        
        # Convert combined candidates to list for ranking
        combined_list = list(combined_candidates.values())
        # Sort by RRF score (descending)
        combined_list.sort(key=lambda x: x["score"], reverse=True)
        
        # Apply Maximal Marginal Relevance (MMR) to select diverse top results
        max_results = 5  # number of context snippets to include
        selected_contexts: List[Dict] = []
        selected_embeddings: List[List[float]] = []
        lambda_param = 0.8  # trade-off between relevance and diversity (0.8 favors relevance more)
        for candidate in combined_list:
            if len(selected_contexts) >= max_results:
                break
            # If no context selected yet, select the highest-scoring candidate
            if not selected_contexts:
                selected_contexts.append(candidate)
                if candidate.get("embedding"):
                    selected_embeddings.append(candidate["embedding"])
                else:
                    # If embedding missing (e.g., from keyword search only), try to retrieve it if available
                    selected_embeddings.append(candidate.get("embedding"))  # could be None
                continue
            # Compute MMR score for this candidate
            # Relevance = candidate['score'] (from RRF)
            relevance = candidate["score"]
            # Diversity = max cosine similarity with any already selected context
            diversity = 0.0
            if candidate.get("embedding") and selected_embeddings:
                # Compute cosine similarity with each selected embedding
                # (Assuming embeddings are normalized or at least comparable)
                import math
                def cosine_sim(vec1, vec2):
                    dot = sum(a*b for a, b in zip(vec1, vec2))
                    norm1 = math.sqrt(sum(a*a for a in vec1))
                    norm2 = math.sqrt(sum(b*b for b in vec2))
                    return dot / (norm1 * norm2) if norm1 and norm2 else 0.0
                diversity = max(cosine_sim(candidate["embedding"], emb) for emb in selected_embeddings)
            # Calculate MMR score
            mmr_score = lambda_param * relevance - (1 - lambda_param) * diversity
            candidate["mmr_score"] = mmr_score
        # Sort candidates by MMR score and select next
            # We'll perform a greedy selection: pick the next candidate with highest MMR score
        # (To simplify, we'll sort by mmr_score in each iteration and pick the top)
            # [The greedy selection can be approximated by sorting once after computing mmr_score 
            # since we update mmr_score each iteration. In practice, re-evaluating per iteration 
            # is more precise, but we assume single pass for simplicity.]
        # After computing mmr_score for all remaining candidates, sort and pick the top
        remaining_candidates = [c for c in combined_list if c not in selected_contexts]
        remaining_candidates.sort(key=lambda x: x.get("mmr_score", -1), reverse=True)
            # Select the candidate with highest MMR score
        if remaining_candidates:
            next_pick = remaining_candidates[0]
            selected_contexts.append(next_pick)
            if next_pick.get("embedding"):
                selected_embeddings.append(next_pick["embedding"])
            else:
                selected_embeddings.append(next_pick.get("embedding"))
        
        # If MMR was not applied (e.g., not enough results), ensure at most max_results are taken
        if not selected_contexts:
            selected_contexts = combined_list[:max_results]
        else:
            selected_contexts = selected_contexts[:max_results]
        
        # 6. Prepare the context string and source documents for output
        context_segments = []
        source_documents = []
        for i, item in enumerate(selected_contexts, start=1):
            text = item["text"].strip()
            if not text:
                continue
            # Prefix each segment with a citation number [i]
            context_segments.append(f"[{i}] {text}")
            # Prepare source document entry with preview and metadata
            preview = text[:150].strip()
            if len(text) > 150:
                preview += "..."
            source_documents.append({
                "id": f"doc_{i}",
                "title": f"Document {i}",
                "preview": preview,
                "full_text": text,
                "metadata": {"type": item["type"]},  # include whether it's an edge fact or node summary
                "source": "knowledge_graph"
            })
        
        context_str = "\n\n".join(context_segments)
        return {
            "context": context_str,
            "num_docs": len(source_documents),
            "source_documents": source_documents,
            "source_nodes": [],  # (Optional) no separate source nodes list needed in this implementation
            "success": True
        }
    except Exception as e:
        return {
            "context": "",
            "num_docs": 0,
            "source_documents": [],
            "source_nodes": [],
            "success": False,
            "error": str(e)
        }

def call_ollama(prompt: str, model: str = "deepseek-r1:32b-qwen-distill-q4_k_m") -> str:
    """
    Call the Ollama API to generate a response using the specified model.
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
        # Increase timeout for large model if needed
        response = requests.post(ollama_url, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        return result.get("response", "No response generated")
    except requests.exceptions.RequestException as e:
        return f"Error calling Ollama: {str(e)}"
    except Exception as e:
        return f"Unexpected error: {str(e)}"

def generate_llm_response(question: str, kg_data: Dict[str, Any]) -> str:
    """
    Generate a Markdown-formatted answer to the user's question using the DeepSeek 32B LLM.
    The answer is based ONLY on the provided knowledge graph data and includes source citations.
    """
    if not kg_data.get("success"):
        return f"❌ **Error**: I encountered an error accessing the knowledge graph: {kg_data.get('error', 'Unknown error')}"
    context = kg_data.get("context", "")
    if not context:
        return ("❓ **No Information Found**\n\n"
                "I couldn't find relevant information in the knowledge graph for your question. "
                "Please try rephrasing your question or using different keywords.")
    # Construct the LLM prompt with instructions and context
    prompt = f"""You are a 360T Platform expert assistant. Answer the user's question using ONLY the provided knowledge graph data.
    
**IMPORTANT**:
- Format your response in clean, well-structured Markdown with:
  - Use ## for main sections
  - Use ### for subsections
  - Use bullet points (-) for lists
  - Use **bold** for key terms
  - Use `code blocks` for technical terms or values
  - Use > blockquotes for important notes or warnings
  - Include line breaks between sections for readability
- Include source citations in square brackets (e.g., [1], [2]) when referencing facts from the knowledge graph data.
- If the provided data does not fully answer the question, state this clearly in a blockquote.
- Be specific and detailed, using the data to support your answer.
- Mention that your response is based on the 360T knowledge base.
- Organize your answer with clear sections and logical flow.

=== KNOWLEDGE GRAPH DATA ===

{context}

=== USER QUESTION ===
{question}

=== INSTRUCTIONS ===
1. Begin with a brief direct answer, then provide details.
2. Base your answer **only** on the knowledge graph data above.
3. If the data is insufficient to answer, indicate this clearly.
4. Provide specific details from the data where possible.
5. Format the answer in Markdown as instructed, including citations for each fact used.
6. End with a "### 💡 Related Questions" section suggesting 2-3 follow-up questions.

Now, draft a comprehensive answer in Markdown:
"""
    # Call the local LLM via Ollama to generate the answer
    llm_response = call_ollama(prompt)
    # Sanitize and format the LLM output
    llm_response = sanitize_markdown(llm_response)
    if "Error" not in llm_response and "❌" not in llm_response:
        metadata_text = f"*📊 This response is based on **{kg_data['num_docs']} documents** from the 360T knowledge graph.*"
        llm_response = format_markdown_response(content=llm_response, add_metadata=True, metadata_text=metadata_text)
    return llm_response

def main():
    parser = argparse.ArgumentParser(description="Query the 360T knowledge graph with an LLM.")
    parser.add_argument("question", type=str, help="The question to ask the knowledge graph.")
    parser.add_argument("--uri", type=str, default=os.getenv("NEO4J_URI"), help="Neo4j URI")
    parser.add_argument("--user", type=str, default=os.getenv("NEO4J_USERNAME"), help="Neo4j Username")
    parser.add_argument("--password", type=str, default=os.getenv("NEO4J_PASSWORD"), help="Neo4j Password")
    parser.add_argument("--database", type=str, default=os.getenv("NEO4J_DATABASE", "neo4j"), help="Neo4j Database")

    # Debug: Print command line arguments
    print(f"DEBUG: sys.argv = {sys.argv}", file=sys.stderr)

    # For debugging: handle case where no arguments are provided
    if len(sys.argv) == 1:
        # If no arguments provided during debugging, use defaults
        print("DEBUG: No arguments provided, using defaults for debugging", file=sys.stderr)
        class DebugArgs:
            question = "How do I configure the CRM module for counterpart-relationship management?"
            uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
            user = os.getenv("NEO4J_USERNAME", "neo4j")
            password = os.getenv("NEO4J_PASSWORD", "1979@rabu")
            database = os.getenv("NEO4J_DATABASE", "neo4j")
        args = DebugArgs()
    else:
        args = parser.parse_args()

    # Debug: Print parsed arguments
    print(f"DEBUG: Parsed args - question: {args.question}", file=sys.stderr)
    print(f"DEBUG: Parsed args - uri: {args.uri}", file=sys.stderr)
    print(f"DEBUG: Parsed args - user: {args.user}", file=sys.stderr)
    try:
        # Retrieve relevant knowledge graph data for the question
        print(f"🔍 Retrieving knowledge graph data for: {args.question}", file=sys.stderr)
        kg_data = get_real_kg_data(args.question, uri=args.uri, user=args.user, password=args.password, database=args.database)
        if kg_data["success"]:
            print(f"✅ Retrieved {kg_data['num_docs']} relevant context documents from the knowledge graph.", file=sys.stderr)
        else:
            print(f"❌ Knowledge graph retrieval error: {kg_data.get('error')}", file=sys.stderr)
        # Generate answer using the local DeepSeek LLM via Ollama
        print("🤖 Generating answer with DeepSeek 32B via Ollama...", file=sys.stderr)
        answer_md = generate_llm_response(args.question, kg_data)
        result = {
            "answer": answer_md,
            "question": args.question,
            "timestamp": "2025-06-25T12:22:00Z",
            "source": "deepseek_knowledge_graph",
            "kg_success": kg_data["success"],
            "documents_found": kg_data.get("num_docs", 0),
            "source_documents": kg_data.get("source_documents", []),
            "source_nodes": kg_data.get("source_nodes", []),
            "llm_used": "DeepSeek-32B (Ollama)"
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()