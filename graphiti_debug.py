#!/usr/bin/env python3
"""
Graphiti Hybrid Search Debugger
===============================

Comprehensive debugging tool for the Graphiti hybrid search pipeline.
Helps diagnose issues with:
- Environment configuration
- Neo4j connectivity
- Graphiti initialization
- Knowledge graph content
- Search functionality
- Ollama connectivity
- Model availability

Usage:
    python graphiti_debug.py [--test-query "your query"]
    python graphiti_debug.py --full-check
    python graphiti_debug.py --neo4j-only
    python graphiti_debug.py --ollama-only
"""

import argparse
import asyncio
import os
import sys
import traceback
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv
from graphiti_core import Graphiti
from graphiti_core.search.search_config_recipes import (
    COMBINED_HYBRID_SEARCH_MMR,
    COMBINED_HYBRID_SEARCH_RRF,   # NEW
)
from pydantic import BaseModel, Field  # NEW – tiny helper for weights config

# Load environment variables from .env file
load_dotenv()


class GraphitiDebugger:
    """Comprehensive debugger for Graphiti hybrid search pipeline."""

    def __init__(self):
        self.results: Dict[str, Dict] = {}
        self.full_ai_responses: Dict[str, str] = {}  # Store complete AI responses
        
    def log_result(self, category: str, test: str, status: str, details: str = "", error: str = ""):
        """Log a test result."""
        if category not in self.results:
            self.results[category] = {}
        
        self.results[category][test] = {
            "status": status,
            "details": details,
            "error": error
        }
        
        # Print immediately for real-time feedback
        status_emoji = {"✅": "✅", "❌": "❌", "⚠️": "⚠️"}.get(status, "🔍")
        print(f"{status_emoji} {category} - {test}: {details}")
        if error:
            print(f"   Error: {error}")

    def call_ollama_for_debug(self, prompt: str, model: str = None) -> str:
        """Call Ollama for debugging purposes."""
        url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        if url.endswith("/v1"):
            url = url[:-3]

        if model is None:
            model = os.getenv("OLLAMA_MODEL", "deepseek-r1:32b-qwen-distill-q4_k_m")

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "top_p": 0.9, "top_k": 40},
        }

        try:
            response = requests.post(f"{url}/api/generate", json=payload, timeout=180)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
        except Exception as e:
            return f"❌ Ollama error: {e}"

    def check_environment(self):
        """Check environment variables and configuration."""
        print("\n🔧 ENVIRONMENT CHECK")
        print("=" * 50)
        
        required_vars = {
            "OPENAI_API_KEY": "OpenAI API key for embeddings",
            "NEO4J_URI": "Neo4j database URI",
            "NEO4J_USER": "Neo4j username", 
            "NEO4J_PASSWORD": "Neo4j password"
        }
        
        optional_vars = {
            "NEO4J_DATABASE": "Neo4j database name",
            "OLLAMA_URL": "Ollama API URL",
            "OLLAMA_MODEL": "Ollama model name"
        }
        
        for var, desc in required_vars.items():
            value = os.getenv(var)
            if value:
                display_value = "***" if "KEY" in var or "PASSWORD" in var else value
                self.log_result("Environment", var, "✅", f"{desc}: {display_value}")
            else:
                self.log_result("Environment", var, "❌", f"{desc}: NOT SET")
        
        for var, desc in optional_vars.items():
            value = os.getenv(var, "NOT SET")
            display_value = "***" if "KEY" in var or "PASSWORD" in var else value
            status = "✅" if value != "NOT SET" else "⚠️"
            self.log_result("Environment", var, status, f"{desc}: {display_value}")

    async def check_neo4j_connection(self):
        """Test Neo4j connectivity."""
        print("\n🗄️ NEO4J CONNECTION CHECK")
        print("=" * 50)
        
        try:
            # Test basic connection parameters
            uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
            user = os.getenv("NEO4J_USER", "neo4j")
            password = os.getenv("NEO4J_PASSWORD", "password")
            
            self.log_result("Neo4j", "Configuration", "✅", f"URI: {uri}, User: {user}")
            
            # Test Graphiti initialization
            try:
                g = Graphiti(uri=uri, user=user, password=password)
                self.log_result("Neo4j", "Graphiti Init", "✅", "Graphiti instance created")
                
                # Test basic query
                try:
                    # Simple test query to check connectivity
                    result = await g.driver.execute_query("RETURN 1 as test")
                    self.log_result("Neo4j", "Basic Query", "✅", "Database connection successful")
                    
                    # Check if there's any data
                    node_count_result = await g.driver.execute_query("MATCH (n) RETURN count(n) as count")
                    node_count = node_count_result.records[0]["count"]
                    self.log_result("Neo4j", "Data Check", "✅" if node_count > 0 else "⚠️", 
                                  f"Found {node_count} nodes in database")
                    
                    # Check for Graphiti-specific data
                    try:
                        edge_count_result = await g.driver.execute_query(
                            "MATCH ()-[r]->() WHERE r.fact IS NOT NULL RETURN count(r) as count"
                        )
                        edge_count = edge_count_result.records[0]["count"]
                        self.log_result("Neo4j", "Graphiti Data", "✅" if edge_count > 0 else "⚠️",
                                      f"Found {edge_count} fact edges")
                    except Exception as e:
                        self.log_result("Neo4j", "Graphiti Data", "⚠️", "Could not check fact edges", str(e))
                    
                except Exception as e:
                    self.log_result("Neo4j", "Database Query", "❌", "Failed to query database", str(e))
                
                await g.close()
                
            except Exception as e:
                self.log_result("Neo4j", "Graphiti Init", "❌", "Failed to create Graphiti instance", str(e))
                
        except Exception as e:
            self.log_result("Neo4j", "Connection", "❌", "Connection failed", str(e))

    async def check_graphiti_search(
        self,
        test_query: str = "test query",
        include_ai_response: bool = False,
        mode: str = "mmr",
        edge_node_mix: str = "6,2",
    ):
        """Test Graphiti hybrid search – now returns edges *and* nodes, config driven."""
        print(f"\n🔍 GRAPHITI SEARCH CHECK (Query: '{test_query}', mode={mode})")
        print("=" * 50)

        # Parse mix
        try:
            edge_cap, node_cap = map(int, edge_node_mix.split(","))
        except ValueError:
            edge_cap, node_cap = 6, 2  # fallback

        # Choose recipe
        cfg = (
            COMBINED_HYBRID_SEARCH_MMR.model_copy(deep=True)
            if mode == "mmr"
            else COMBINED_HYBRID_SEARCH_RRF.model_copy(deep=True)
        )
        cfg.limit = edge_cap + node_cap

        try:
            g = Graphiti(
                uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
                user=os.getenv("NEO4J_USER", "neo4j"),
                password=os.getenv("NEO4J_PASSWORD", "password"),
            )

            results = await g._search(query=test_query, config=cfg)

            if not results.edges and not results.nodes:
                self.log_result("Search", "Query Execution", "⚠️", "No results")
                await g.close()
                return

            # ----- Build context (edges first, then node summaries) -----
            context_lines: List[str] = []
            idx = 1

            # Edges
            for edge in results.edges[:edge_cap]:
                context_lines.append(f"[{idx}] {edge.fact}")
                idx += 1

            # Nodes with summaries
            nodes_with_text = [n for n in results.nodes if n.summary][:node_cap]
            for node in nodes_with_text:
                context_lines.append(f"[{idx}] {node.summary}")
                idx += 1

            context_md = "\n\n".join(context_lines)

            self.log_result(
                "Search",
                "Query Execution",
                "✅",
                f"{len(results.edges)} edges, {len(results.nodes)} nodes (context uses "
                f"{edge_cap}/{node_cap})",
            )

            # Debug-print the first few edge & node previews
            previews = (
                [(e.fact[:120] + "...", "edge") for e in results.edges[:3]]
                + [(n.summary[:120] + "...", "node") for n in nodes_with_text[:2]]
            )
            for txt, typ in previews:
                self.log_result("Search", f"Preview ({typ})", "✅", txt)

            if include_ai_response and context_md:
                await self.test_ai_response_generation(test_query, context_md)

            await g.close()

        except Exception as e:
            self.log_result("Search", "Setup/Execution", "❌", "Search failed", str(e))

    async def test_ai_response_generation(self, query: str, context: str):
        """Test AI response generation with the search context."""
        print(f"\n🤖 AI RESPONSE GENERATION TEST")
        print("=" * 50)

        # Create prompt template similar to the main script
        prompt_template = """
You are a domain expert answering questions using *only* the supplied context.

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

        prompt = prompt_template.format(context=context, question=query)

        try:
            # Test AI response generation
            self.log_result("AI Response", "Generation Started", "✅",
                          f"Generating response for query: {query[:50]}...")

            # Use asyncio to run the synchronous Ollama call
            import asyncio
            loop = asyncio.get_running_loop()

            ai_response = await loop.run_in_executor(
                None,
                self.call_ollama_for_debug,
                prompt
            )

            if ai_response and not ai_response.startswith("❌"):
                # Store the full response
                self.full_ai_responses[query] = ai_response

                # Log success with preview
                response_preview = ai_response[:150] + "..." if len(ai_response) > 150 else ai_response
                self.log_result("AI Response", "Generation Complete", "✅",
                              f"Generated {len(ai_response)} characters")
                self.log_result("AI Response", "Preview", "✅", response_preview)

            else:
                self.log_result("AI Response", "Generation Failed", "❌",
                              "Failed to generate AI response", ai_response)

        except Exception as e:
            self.log_result("AI Response", "Generation Error", "❌",
                          "Error during AI response generation", str(e))

    def check_ollama_connection(self):
        """Test Ollama connectivity and model availability."""
        print("\n🤖 OLLAMA CONNECTION CHECK")
        print("=" * 50)

        url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        # Remove /v1 suffix if present (Ollama doesn't use it)
        if url.endswith("/v1"):
            url = url[:-3]

        try:
            # Test basic connectivity
            response = requests.get(f"{url}/api/tags", timeout=10)
            response.raise_for_status()
            
            self.log_result("Ollama", "API Connection", "✅", f"Connected to {url}")
            
            # Check available models
            data = response.json()
            models = data.get("models", [])
            
            if models:
                self.log_result("Ollama", "Models Available", "✅", f"Found {len(models)} models")
                
                # List models
                for model in models[:5]:  # Show first 5 models
                    name = model.get("name", "Unknown")
                    size_gb = model.get("size", 0) / (1024**3)
                    self.log_result("Ollama", f"Model: {name}", "✅", f"Size: {size_gb:.1f}GB")
                    
                # Test specific models
                preferred_models = [
                    os.getenv("OLLAMA_MODEL", "deepseek-r1:8b"),
                    "deepseek-r1:8b",
                    "deepseek-r1:32b-qwen-distill-q4_k_m"
                ]
                
                available_model_names = [m.get("name", "") for m in models]
                
                for model_name in preferred_models:
                    if model_name in available_model_names:
                        self.log_result("Ollama", f"Preferred Model", "✅", f"{model_name} is available")
                        
                        # Test model with simple query
                        try:
                            test_payload = {
                                "model": model_name,
                                "prompt": "Hello",
                                "stream": False
                            }
                            
                            test_response = requests.post(
                                f"{url}/api/generate", 
                                json=test_payload, 
                                timeout=30
                            )
                            
                            if test_response.status_code == 200:
                                result = test_response.json()
                                response_text = result.get("response", "")[:50]
                                self.log_result("Ollama", f"Model Test", "✅", 
                                              f"{model_name} responded: {response_text}...")
                                break
                            else:
                                self.log_result("Ollama", f"Model Test", "❌", 
                                              f"{model_name} failed with status {test_response.status_code}")
                                
                        except Exception as e:
                            self.log_result("Ollama", f"Model Test", "❌", 
                                          f"{model_name} test failed", str(e))
                    else:
                        self.log_result("Ollama", f"Model Check", "⚠️", 
                                      f"{model_name} not found")
                        
            else:
                self.log_result("Ollama", "Models Available", "⚠️", "No models found")
                
        except Exception as e:
            self.log_result("Ollama", "API Connection", "❌", f"Failed to connect to {url}", str(e))

    def print_summary(self):
        """Print a summary of all test results."""
        print("\n📊 SUMMARY")
        print("=" * 50)
        
        total_tests = 0
        passed_tests = 0
        failed_tests = 0
        warning_tests = 0
        
        for category, tests in self.results.items():
            print(f"\n{category}:")
            for test, result in tests.items():
                status = result["status"]
                total_tests += 1
                
                if status == "✅":
                    passed_tests += 1
                elif status == "❌":
                    failed_tests += 1
                elif status == "⚠️":
                    warning_tests += 1
                    
                print(f"  {status} {test}")
                
        print(f"\nOverall: {passed_tests}✅ {warning_tests}⚠️ {failed_tests}❌ (Total: {total_tests})")
        
        if failed_tests == 0 and warning_tests == 0:
            print("🎉 All systems operational!")
        elif failed_tests == 0:
            print("⚠️ System functional with minor issues")
        else:
            print("❌ Critical issues detected - check failed tests above")

        # Display full AI responses if any were generated
        if self.full_ai_responses:
            print("\n" + "=" * 80)
            print("🤖 COMPLETE AI RESPONSES")
            print("=" * 80)

            for query, response in self.full_ai_responses.items():
                print(f"\n📝 Query: {query}")
                print("-" * 60)
                print(response)
                print("-" * 60)

    async def run_full_check(self, test_query: Optional[str] = None, search_mode: str = "mmr", edge_node_mix: str = "6,2"):
        """Run all diagnostic checks."""
        print("🔍 GRAPHITI HYBRID SEARCH DEBUGGER")
        print("=" * 50)

        self.check_environment()
        await self.check_neo4j_connection()

        if test_query:
            # Enable AI response generation when testing with a query
            await self.check_graphiti_search(test_query, include_ai_response=True, mode=search_mode, edge_node_mix=edge_node_mix)
        else:
            # Basic search test without AI response
            await self.check_graphiti_search("test query", include_ai_response=False, mode=search_mode, edge_node_mix=edge_node_mix)

        self.check_ollama_connection()
        self.print_summary()


async def main():
    parser = argparse.ArgumentParser(description="Debug Graphiti hybrid search pipeline")
    parser.add_argument("--test-query", type=str, help="Test query for search functionality")
    parser.add_argument("--full-check", action="store_true", help="Run all diagnostic checks")
    parser.add_argument("--neo4j-only", action="store_true", help="Check only Neo4j connectivity")
    parser.add_argument("--ollama-only", action="store_true", help="Check only Ollama connectivity")
    parser.add_argument("--search-mode", choices=["mmr", "rrf"],
                        help="Hybrid search reranker: mmr (diversity) or rrf (fusion)")
    parser.add_argument("--edge-node-mix", type=str, default="6,2",
                        help="Comma-separated numbers: edges,nodes to include in context (default 6 edges, 2 nodes)")
    
    args = parser.parse_args()
    
    debugger = GraphitiDebugger()
    
    try:
        if args.neo4j_only:
            debugger.check_environment()
            await debugger.check_neo4j_connection()
        elif args.ollama_only:
            debugger.check_environment()
            debugger.check_ollama_connection()
        elif args.test_query:
            # When testing with a specific query, include AI response generation
            await debugger.run_full_check(
                args.test_query,
                search_mode=args.search_mode or "mmr",
                edge_node_mix=args.edge_node_mix,
            )
        elif args.full_check:
            # Full check without specific query - basic functionality only
            await debugger.run_full_check(
                search_mode=args.search_mode or "mmr",
                edge_node_mix=args.edge_node_mix,
            )
        else:
            # Default: run basic checks without AI response
            await debugger.run_full_check(
                search_mode=args.search_mode or "mmr",
                edge_node_mix=args.edge_node_mix,
            )
            
        debugger.print_summary()
        
    except KeyboardInterrupt:
        print("\n⏹️ Debugging interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
