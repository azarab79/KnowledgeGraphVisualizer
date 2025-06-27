# Graphiti Hybrid Search Debugger Guide

## Overview

The `graphiti_debug.py` tool provides comprehensive diagnostics for your Graphiti hybrid search pipeline. It helps identify and troubleshoot issues across all components of the system.

## Quick Start

```bash
# Run full diagnostic check
python graphiti_debug.py --full-check

# Test with a specific query
python graphiti_debug.py --test-query "How do I configure the CRM module?"

# Check only Neo4j connectivity
python graphiti_debug.py --neo4j-only

# Check only Ollama connectivity  
python graphiti_debug.py --ollama-only
```

## What It Checks

### 🔧 Environment Configuration
- **Required Variables**: `OPENAI_API_KEY`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
- **Optional Variables**: `NEO4J_DATABASE`, `OLLAMA_URL`, `OLLAMA_MODEL`
- **Status**: Shows which variables are set (with masked sensitive values)

### 🗄️ Neo4j Database
- **Connection**: Tests basic connectivity to Neo4j
- **Graphiti Setup**: Verifies Graphiti can initialize properly
- **Data Presence**: Counts total nodes and Graphiti fact edges
- **Query Execution**: Tests basic database queries

### 🔍 Search Functionality
- **Query Execution**: Tests Graphiti's hybrid search
- **Result Quality**: Shows sample search results
- **Performance**: Indicates if search returns relevant data

### 🤖 Ollama Integration
- **API Connectivity**: Tests connection to Ollama server
- **Model Availability**: Lists all available models
- **Model Testing**: Tests preferred models with simple queries
- **Performance**: Measures response times

## Understanding Results

### Status Indicators
- ✅ **Success**: Component working correctly
- ⚠️ **Warning**: Component functional but has minor issues
- ❌ **Error**: Component failed - needs attention

### Common Issues & Solutions

#### Environment Issues
```
❌ OPENAI_API_KEY: NOT SET
```
**Solution**: Set your OpenAI API key:
```bash
export OPENAI_API_KEY="your-api-key-here"
```

#### Neo4j Connection Issues
```
❌ Neo4j - Basic Query: Connection failed
```
**Solutions**:
- Check if Neo4j is running: `systemctl status neo4j`
- Verify credentials in environment variables
- Test connection: `cypher-shell -u neo4j -p your-password`

#### Empty Knowledge Graph
```
⚠️ Neo4j - Graphiti Data: Found 0 fact edges
```
**Solution**: Your knowledge graph is empty. Run data ingestion first.

#### Ollama Issues
```
❌ Ollama - API Connection: Failed to connect
```
**Solutions**:
- Start Ollama: `ollama serve`
- Check if running: `curl http://localhost:11434/api/tags`
- Install models: `ollama pull deepseek-r1:8b`

## Advanced Usage

### Custom Test Queries
Test search functionality with domain-specific queries:
```bash
python graphiti_debug.py --test-query "counterpart relationship management"
python graphiti_debug.py --test-query "trading configuration"
python graphiti_debug.py --test-query "user permissions"
```

### Targeted Debugging
Focus on specific components when you know where the issue is:
```bash
# Only check database connectivity
python graphiti_debug.py --neo4j-only

# Only check AI model availability
python graphiti_debug.py --ollama-only
```

## Integration with Main Script

Use the debugger before running `graphiti_hybrid_search.py`:

```bash
# 1. Run diagnostics first
python graphiti_debug.py --full-check

# 2. If all systems are ✅, run your search
python graphiti_hybrid_search.py "your question here"
```

## Troubleshooting Workflow

1. **Start with full check**: `python graphiti_debug.py --full-check`
2. **Identify failed components** (❌ status)
3. **Fix issues** using solutions above
4. **Re-run specific checks** to verify fixes
5. **Test with actual query** once all systems are ✅

## Performance Insights

The debugger also provides performance insights:
- **Database size**: Number of nodes and edges
- **Model availability**: Which AI models are ready
- **Response times**: How quickly components respond

## Example Output Interpretation

```
Overall: 19✅ 2⚠️ 0❌ (Total: 21)
⚠️ System functional with minor issues
```

This means:
- 19 tests passed completely
- 2 tests have warnings (usually missing optional config)
- 0 tests failed critically
- System will work but may have reduced functionality

## Getting Help

If the debugger shows persistent issues:
1. Check the error messages in the detailed output
2. Verify all prerequisites are installed
3. Ensure services (Neo4j, Ollama) are running
4. Check network connectivity and firewall settings

The debugger is designed to give you complete visibility into your Graphiti pipeline health! 🔍
