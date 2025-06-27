# Graphiti Hybrid Search Enhancement Proposal

## Overview
This proposal outlines the specific changes needed to enhance `graphiti_hybrid_search.py` with advanced search functionality from `graphiti_debug.py` while maintaining GUI compatibility and production-ready output.

## 1. Import Updates

**Current imports to modify:**
```python
# EXISTING
from graphiti_core.search.search_config_recipes import (
    COMBINED_HYBRID_SEARCH_MMR,
)

# ENHANCED
from graphiti_core.search.search_config_recipes import (
    COMBINED_HYBRID_SEARCH_MMR,
    COMBINED_HYBRID_SEARCH_RRF,   # NEW
)
from pydantic import BaseModel, Field  # NEW - for configuration support
```

## 2. CLI Argument Enhancements

**Add to argument parser:**
```python
parser.add_argument("--search-mode", choices=["mmr", "rrf"], default="mmr",
                    help="Hybrid search reranker: mmr (diversity) or rrf (fusion)")
parser.add_argument("--edge-node-mix", type=str, default="6,2",
                    help="Comma-separated numbers: edges,nodes to include in context (default 6 edges, 2 nodes)")
```

## 3. Enhanced fetch_context Function

**Current signature:**
```python
async def fetch_context(graphiti: Graphiti, query: str, top_k: int = 8) -> Tuple[str, List[str]]:
```

**Enhanced signature:**
```python
async def fetch_context(
    graphiti: Graphiti, 
    query: str, 
    mode: str = "mmr", 
    edge_node_mix: str = "6,2", 
    top_k: int = 8
) -> Tuple[str, List[str]]:
```

**Implementation changes:**
```python
async def fetch_context(
    graphiti: Graphiti, 
    query: str, 
    mode: str = "mmr", 
    edge_node_mix: str = "6,2", 
    top_k: int = 8
) -> Tuple[str, List[str]]:
    """Run Graphiti hybrid search with configurable mode and edge/node mixing."""
    
    # Parse edge/node mix
    try:
        edge_cap, node_cap = map(int, edge_node_mix.split(","))
    except ValueError:
        edge_cap, node_cap = 6, 2  # fallback
    
    # Choose search recipe based on mode
    cfg = (
        COMBINED_HYBRID_SEARCH_MMR.model_copy(deep=True)
        if mode == "mmr"
        else COMBINED_HYBRID_SEARCH_RRF.model_copy(deep=True)
    )
    cfg.limit = edge_cap + node_cap
    
    # Execute enhanced search
    results = await graphiti._search(query=query, config=cfg)
    
    # Build mixed context: edges first, then node summaries
    context_lines: List[str] = []
    citations: List[str] = []
    idx = 1
    
    # Add edges
    for edge in results.edges[:edge_cap]:
        context_lines.append(f"[{idx}] {edge.fact}")
        citations.append(f"[{idx}]")
        idx += 1
    
    # Add node summaries
    nodes_with_text = [n for n in results.nodes if n.summary][:node_cap]
    for node in nodes_with_text:
        context_lines.append(f"[{idx}] {node.summary}")
        citations.append(f"[{idx}]")
        idx += 1
    
    context_md = "\n\n".join(context_lines)
    return context_md, citations
```

## 4. Main Function Integration

**Enhanced run() function signature:**
```python
async def run(query: str, mode: str = "mmr", edge_node_mix: str = "6,2") -> None:
```

**Implementation:**
```python
async def run(query: str, mode: str = "mmr", edge_node_mix: str = "6,2") -> None:
    """Execute end‑to‑end search + answer pipeline with configurable search."""
    g = build_graphiti_instance()
    try:
        context_md, _cites = await fetch_context(g, query, mode, edge_node_mix)
        if not context_md:
            print("No relevant context found in the graph.")
            return

        prompt = PROMPT_TEMPLATE.format(context=context_md, question=query)

        # Call DeepSeek (unchanged)
        loop = asyncio.get_running_loop()
        answer_md = await loop.run_in_executor(
            None,
            call_ollama,
            prompt,
            os.getenv("OLLAMA_MODEL", "deepseek-r1:8b"),
            os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate"),
        )

        timestamp = datetime.now(timezone.utc).isoformat()
        print(f"\n---\n⏱️ {timestamp}\n{answer_md}\n")
    finally:
        await g.close()
```

## 5. GUI Compatibility Wrapper

**Add wrapper function for GUI integration:**
```python
async def get_real_kg_data(
    question: str, 
    uri: str, 
    user: str, 
    password: str, 
    database: str,
    mode: str = "mmr",
    edge_node_mix: str = "6,2"
) -> Dict[str, Any]:
    """
    GUI-compatible wrapper function matching real_llm_kg_script.py signature.
    Returns structured data instead of printing to console.
    """
    # Override environment with provided parameters
    original_env = {}
    env_vars = {
        "NEO4J_URI": uri,
        "NEO4J_USER": user, 
        "NEO4J_PASSWORD": password,
        "NEO4J_DATABASE": database
    }
    
    # Temporarily set environment variables
    for key, value in env_vars.items():
        original_env[key] = os.getenv(key)
        os.environ[key] = value
    
    try:
        g = build_graphiti_instance()
        context_md, citations = await fetch_context(g, question, mode, edge_node_mix)
        
        if not context_md:
            return {
                "success": False,
                "error": "No relevant context found in the graph",
                "context": "",
                "answer": "",
                "citations": []
            }

        prompt = PROMPT_TEMPLATE.format(context=context_md, question=question)
        
        # Generate AI response
        loop = asyncio.get_running_loop()
        answer_md = await loop.run_in_executor(
            None,
            call_ollama,
            prompt,
            os.getenv("OLLAMA_MODEL", "deepseek-r1:8b"),
            os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate"),
        )
        
        await g.close()
        
        return {
            "success": True,
            "context": context_md,
            "answer": answer_md,
            "citations": citations,
            "search_mode": mode,
            "edge_node_mix": edge_node_mix
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "context": "",
            "answer": "",
            "citations": []
        }
    finally:
        # Restore original environment
        for key, original_value in original_env.items():
            if original_value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = original_value
```

## 6. CLI Integration

**Update main section:**
```python
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Graphiti search + DeepSeek answer generator")
    parser.add_argument("question", type=str, help="Question to ask the knowledge graph")
    parser.add_argument("--search-mode", choices=["mmr", "rrf"], default="mmr",
                        help="Hybrid search reranker: mmr (diversity) or rrf (fusion)")
    parser.add_argument("--edge-node-mix", type=str, default="6,2",
                        help="Comma-separated numbers: edges,nodes to include in context")
    
    args = parser.parse_args()
    try:
        asyncio.run(run(args.question, args.search_mode, args.edge_node_mix))
    except KeyboardInterrupt:
        sys.exit(130)
```

## 7. Benefits of This Enhancement

### **Advanced Search Capabilities**
- **MMR Mode**: Maximizes diversity in results for comprehensive coverage
- **RRF Mode**: Optimizes relevance through reciprocal rank fusion
- **Mixed Context**: Combines edge facts with node summaries for richer context

### **Flexible Configuration**
- **Configurable Ratios**: Adjust edge/node balance (e.g., "4,2", "8,0", "3,3")
- **Mode Selection**: Choose search strategy based on query type
- **Backward Compatible**: Default parameters maintain existing behavior

### **GUI Integration Ready**
- **Compatible Signature**: Matches `real_llm_kg_script.py` for easy replacement
- **Structured Returns**: Returns data objects instead of console output
- **Error Handling**: Comprehensive error reporting for GUI feedback

### **Production Quality**
- **Clean Output**: No debug logging or diagnostic noise
- **Performance Optimized**: Uses Graphiti's advanced search recipes
- **Maintainable**: Clear separation of concerns and modular design

## 8. Usage Examples

**CLI Usage:**
```bash
# Default MMR with 6 edges, 2 nodes
python graphiti_hybrid_search.py "How do I configure CRM?"

# RRF mode with 4 edges, 2 nodes  
python graphiti_hybrid_search.py "How do I configure CRM?" --search-mode rrf --edge-node-mix 4,2

# Edge-only context
python graphiti_hybrid_search.py "How do I configure CRM?" --edge-node-mix 8,0
```

**GUI Integration:**
```python
# Replace real_llm_kg_script.py calls with:
result = await get_real_kg_data(
    question="How do I configure CRM?",
    uri="bolt://localhost:7687",
    user="neo4j", 
    password="password",
    database="neo4j",
    mode="mmr",
    edge_node_mix="6,2"
)
```

This enhancement provides powerful, configurable search capabilities while maintaining production quality and GUI compatibility.

## 9. Implementation Steps

### **Step 1: Update Imports**
```python
# In graphiti_hybrid_search.py, modify the imports section:
from graphiti_core.search.search_config_recipes import (
    COMBINED_HYBRID_SEARCH_MMR,
    COMBINED_HYBRID_SEARCH_RRF,   # ADD THIS
)
from pydantic import BaseModel, Field  # ADD THIS
```

### **Step 2: Replace fetch_context Function**
Replace the entire `fetch_context` function with the enhanced version shown in section 3.

### **Step 3: Update run Function**
Modify the `run` function signature and implementation as shown in section 4.

### **Step 4: Add GUI Wrapper**
Add the complete `get_real_kg_data` function from section 5.

### **Step 5: Update CLI Parser**
Replace the argument parser section with the enhanced version from section 6.

### **Step 6: Test Integration**
- Test CLI functionality with new arguments
- Test GUI wrapper compatibility
- Verify backward compatibility with default parameters

## 10. Risk Assessment

### **Low Risk Changes**
- ✅ Adding new CLI arguments (backward compatible)
- ✅ Adding GUI wrapper function (additive only)
- ✅ Import additions (no breaking changes)

### **Medium Risk Changes**
- ⚠️ Modifying `fetch_context` signature (internal function)
- ⚠️ Changing search method from `.search()` to `._search()` (API change)

### **Mitigation Strategies**
- Maintain default parameter values for backward compatibility
- Add comprehensive error handling for new functionality
- Test thoroughly with existing queries before deployment

## 11. Testing Checklist

- [ ] CLI works with original syntax (no arguments)
- [ ] CLI works with new `--search-mode` argument
- [ ] CLI works with new `--edge-node-mix` argument
- [ ] GUI wrapper returns expected data structure
- [ ] Error handling works for invalid parameters
- [ ] Mixed edge/node context generates properly
- [ ] MMR and RRF modes produce different results
- [ ] Performance is acceptable with new search method

This proposal provides a clear roadmap for enhancing the production script while maintaining compatibility and reliability.
