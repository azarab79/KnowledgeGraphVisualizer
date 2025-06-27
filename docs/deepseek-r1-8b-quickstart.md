# DeepSeek-R1 8B Quick Start

> **Quick reference for developers** - See [detailed setup guide](./deepseek-r1-8b-setup.md) for comprehensive instructions.

## TL;DR Installation

```bash
# 1. Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# 2. Start Ollama service
ollama serve

# 3. Install DeepSeek-R1 8B (5.2GB download)
ollama run deepseek-r1:8b

# 4. Exit interactive mode and verify
/bye
ollama list
```

## Essential Environment Variables

```bash
# Add to your .env file
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:8b
OLLAMA_TEMPERATURE=0.7
OLLAMA_MAX_TOKENS=4096
OLLAMA_CONTEXT_WINDOW=128000
```

## Python Integration

```python
from llm_abstraction.providers import OllamaProvider

# Basic usage
provider = OllamaProvider(
    model_name="deepseek-r1:8b",
    base_url="http://localhost:11434"
)

response = provider.invoke("Your question here")
print(response)
```

## Model Specs at a Glance

| Attribute | Value |
|-----------|-------|
| Parameters | 8B |
| Download Size | 5.2GB |
| Context Window | 128K tokens |
| License | MIT (commercial use OK) |
| RAM Required | 8GB minimum, 16GB+ recommended |

## Common Commands

```bash
# Check running models
ollama ps

# Test model
ollama run deepseek-r1:8b "What is Python?"

# Update model
ollama pull deepseek-r1:8b

# Remove model
ollama rm deepseek-r1:8b

# Debug mode
OLLAMA_DEBUG=1 ollama serve
```

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Connection refused | `curl http://localhost:11434/api/tags` |
| Out of memory | `export OLLAMA_NUM_GPU=0` (force CPU) |
| Slow responses | Check `htop` for CPU/memory usage |
| Model not found | `ollama pull deepseek-r1:8b` |

## Performance Profiles

```python
# Creative (high variation)
{"temperature": 0.9, "top_p": 0.95, "top_k": 50}

# Precise (low variation)  
{"temperature": 0.3, "top_p": 0.8, "top_k": 20}

# Balanced (default)
{"temperature": 0.7, "top_p": 0.9, "top_k": 40}
```

## Health Check

```bash
# Verify everything is working
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-r1:8b", "prompt": "Hello", "stream": false}'
```

---

For detailed installation, configuration, troubleshooting, and optimization, see the [complete setup guide](./deepseek-r1-8b-setup.md). 