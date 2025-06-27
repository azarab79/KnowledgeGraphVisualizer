#!/usr/bin/env python3
"""
Graphiti‑Powered Hybrid Knowledge‑Graph Search + DeepSeek Answer Generation
==========================================================================

* Replaces the custom Neo4j‑query / RRF / MMR code with Graphiti Core calls
* Keeps OpenAI embeddings (handled internally by Graphiti)
* Uses DeepSeek‑32B (via Ollama) only for final answer generation
* Compatible with FastAPI **or** CLI – see __main__ for CLI usage

Key Graphiti components leveraged
---------------------------------
- **Graphiti.search()** — one‑line hybrid retrieval (vector + BM25) with RRF
- **search_config_recipes.COMBINED_HYBRID_SEARCH_MMR** — optional if you want MMR instead of RRF
- **EntityEdge** / **SearchResults** Pydantic models for strong typing & JSON serialization

Environment variables expected
------------------------------
```
OPENAI_API_KEY      # for query embeddings (Graphiti internal)
NEO4J_URI           # bolt://localhost:7687 (default)
NEO4J_USER          # neo4j (default)
NEO4J_PASSWORD      # <your‑pw>
NEO4J_DATABASE      # neo4j (default)
OLLAMA_URL          # http://localhost:11434 (default)
OLLAMA_MODEL        # deepseek-r1:32b (default)
```
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import textwrap
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Any

import requests
from graphiti_core import Graphiti
from graphiti_core.search.search_config_recipes import (
    COMBINED_HYBRID_SEARCH_MMR,
)

# ---------------------------------------------------------------------------
# DeepSeek via Ollama helper (sync HTTP → can be called from async code via run_in_executor)
# ---------------------------------------------------------------------------

def call_ollama(prompt: str, model: str = "deepseek-r1:8b", url: str = "http://localhost:11434/api/generate") -> str:  # noqa: E501
    """Send prompt to Ollama and return response text (non‑streaming)."""
    # Fix URL if it has /v1 suffix (Ollama doesn't use /v1)
    if url.endswith("/v1"):
        url = url[:-3] + "/api/generate"
    elif not url.endswith("/api/generate"):
        # If URL doesn't end with /api/generate, add it
        url = url.rstrip("/") + "/api/generate"

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3, "top_p": 0.9, "top_k": 40},
    }
    try:
        resp = requests.post(url, json=payload, timeout=180)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")
    except Exception as exc:  # pylint: disable=broad-except
        return f"❌ Ollama error: {exc}"

# ---------------------------------------------------------------------------
# Graphiti helpers
# ---------------------------------------------------------------------------

def build_graphiti_instance() -> Graphiti:
    """Initialise Graphiti (lazy embedder uses OPENAI_API_KEY)."""
    return Graphiti(
        uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        user=os.getenv("NEO4J_USER", "neo4j"),
        password=os.getenv("NEO4J_PASSWORD", "password"),
    )

async def fetch_context(graphiti: Graphiti, query: str, edge_count: int = 4, node_count: int = 2) -> Tuple[str, List[str]]:
    """Run Graphiti hybrid search and return (context_md, citations) with mixed edges and nodes."""

    cfg = COMBINED_HYBRID_SEARCH_MMR.model_copy(deep=True)
    cfg.limit = edge_count + node_count  # Total results to retrieve

    results = await graphiti._search(query=query, config=cfg)  # noqa: SLF001 (protected API with recipes)

    context_lines: List[str] = []
    citations: List[str] = []
    idx = 1

    # Add edges first (facts)
    for edge in results.edges[:edge_count]:
        context_lines.append(f"[{idx}] {edge.fact}")
        citations.append(f"[{idx}]")
        idx += 1

    # Add node summaries (entities)
    nodes_with_text = [n for n in results.nodes if n.summary][:node_count]
    for node in nodes_with_text:
        context_lines.append(f"[{idx}] {node.summary}")
        citations.append(f"[{idx}]")
        idx += 1

    context_md = "\n\n".join(context_lines)
    return context_md, citations



# ---------------------------------------------------------------------------
# Prompt template for DeepSeek
# ---------------------------------------------------------------------------

PROMPT_TEMPLATE = textwrap.dedent(
    """
    You are a FOREX domain knowledge expert answering questions using *only* the supplied context.

    === CONTEXT ===
    {context}
    === QUESTION ===
    {question}

    Instructions:
    1. Begin with a concise answer, then elaborate.
    2. Cite facts using the bracket numbers provided in CONTEXT (e.g. [1]).
    3. Format output in clean Markdown with headings, lists, and **bold** keywords.
    4. If context is insufficient, state so clearly.
    5. Finish with a "### 💡 Related" section suggesting 2 follow‑up questions.
    """
)

# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def run(query: str) -> None:  # noqa: D401
    """Execute end‑to‑end search + answer pipeline and print Markdown."""
    print(f"🔍 Searching for: {query}")
    g = build_graphiti_instance()
    try:
        print(" Fetching context from knowledge graph...")
        context_md, _cites = await fetch_context(g, query)
        if not context_md:
            print("❌ No relevant context found in the graph.")
            return

        print(f"✅ Found context ({len(context_md)} characters)")
        print(f"📝 Context preview: {context_md[:200]}...")

        prompt = PROMPT_TEMPLATE.format(context=context_md, question=query)

        print("🤖 Calling DeepSeek via Ollama...")
        # Call DeepSeek in a thread‑pool to avoid blocking event loop
        loop = asyncio.get_running_loop()
        answer_md = await loop.run_in_executor(
            None,
            call_ollama,
            prompt,
            os.getenv("OLLAMA_MODEL", "deepseek-r1:8b"),
            os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate"),
        )

        timestamp = datetime.now(timezone.utc).isoformat()
        if answer_md.startswith("❌ Ollama error:"):
            print(f"\n---\n⏱️ {timestamp}")
            print("🔍 **Raw Context Found (Ollama unavailable):**\n")
            print(context_md)
            print("\n💡 **Note:** Install and start Ollama with DeepSeek model for AI-generated answers.")
        else:
            print(f"\n---\n⏱️ {timestamp}\n{answer_md}\n")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await g.close()

# ---------------------------------------------------------------------------
# GUI-compatible function (drop-in replacement for real_llm_kg_script.py)
# ---------------------------------------------------------------------------

def get_real_kg_data(question: str, uri: str, user: str, password: str, database: str) -> Dict[str, Any]:
    """
    GUI-compatible function that matches the signature of real_llm_kg_script.py
    Returns structured data instead of printing to console.
    """
    # Temporarily override environment variables for this call
    original_env = {}
    env_vars = {
        "NEO4J_URI": uri,
        "NEO4J_USER": user,
        "NEO4J_PASSWORD": password,
        "NEO4J_DATABASE": database
    }

    # Set environment variables
    for key, value in env_vars.items():
        original_env[key] = os.getenv(key)
        os.environ[key] = value

    try:
        # Run the async search and get results
        result = asyncio.run(_get_kg_data_async(question))
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "context": "",
            "answer": "",
            "citations": []
        }
    finally:
        # Restore original environment variables
        for key, original_value in original_env.items():
            if original_value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = original_value

async def _get_kg_data_async(question: str) -> Dict[str, Any]:
    """Internal async function that does the actual work"""
    g = build_graphiti_instance()
    try:
        context_md, citations = await fetch_context(g, question)

        if not context_md:
            return {
                "success": False,
                "error": "No relevant context found in the graph",
                "context": "",
                "answer": "",
                "citations": []
            }

        prompt = PROMPT_TEMPLATE.format(context=context_md, question=question)

        # Call DeepSeek
        loop = asyncio.get_running_loop()
        answer_md = await loop.run_in_executor(
            None,
            call_ollama,
            prompt,
            os.getenv("OLLAMA_MODEL", "deepseek-r1:8b"),
            os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate"),
        )

        # Handle Ollama errors
        if answer_md.startswith("❌ Ollama error:"):
            return {
                "success": True,
                "context": context_md,
                "answer": f"**Context Found (AI unavailable):**\n\n{context_md}\n\n**Note:** Ollama/DeepSeek not available for answer generation.",
                "citations": citations,
                "ollama_error": True
            }

        return {
            "success": True,
            "context": context_md,
            "answer": answer_md,
            "citations": citations,
            "ollama_error": False
        }

    finally:
        await g.close()

# ---------------------------------------------------------------------------
# CLI wrapper
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Graphiti search + DeepSeek answer generator")
    parser.add_argument("question", type=str, help="Question to ask the knowledge graph")
    parser.add_argument("--uri", type=str, default=os.getenv("NEO4J_URI"), help="Neo4j URI")
    parser.add_argument("--user", type=str, default=os.getenv("NEO4J_USER"), help="Neo4j Username")
    parser.add_argument("--password", type=str, default=os.getenv("NEO4J_PASSWORD"), help="Neo4j Password")
    parser.add_argument("--database", type=str, default=os.getenv("NEO4J_DATABASE", "neo4j"), help="Neo4j Database")

    args = parser.parse_args()

    # If CLI arguments are provided, use them instead of environment variables
    if args.uri or args.user or args.password or args.database:
        # Use the get_real_kg_data function for CLI compatibility
        result = get_real_kg_data(
            args.question,
            args.uri or os.getenv("NEO4J_URI", "bolt://localhost:7687"),
            args.user or os.getenv("NEO4J_USER", "neo4j"),
            args.password or os.getenv("NEO4J_PASSWORD", "password"),
            args.database or os.getenv("NEO4J_DATABASE", "neo4j")
        )
        # Output JSON for compatibility with Node.js backend
        print(json.dumps(result))
    else:
        # Use the original run function for interactive CLI usage
        try:
            asyncio.run(run(args.question))
        except KeyboardInterrupt:
            sys.exit(130)
