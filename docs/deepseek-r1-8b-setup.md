# DeepSeek-R1 8B Model Setup Guide

## Overview

DeepSeek-R1 8B is a powerful reasoning-focused language model that serves as the primary LLM provider in our Knowledge Graph Visualizer chat feature. This guide covers installation, configuration, and optimization for production use.

## Model Specifications

- **Model Name**: deepseek-r1:8b
- **Parameters**: 8 billion parameters
- **Model Size**: ~5.2GB download
- **Context Window**: 128,000 tokens (128K context)
- **Architecture**: Transformer-based reasoning model
- **License**: MIT License (commercial use permitted)
- **Provider**: Ollama
- **Update**: 0528 version (latest as of implementation)

## Prerequisites

### System Requirements

- **RAM**: Minimum 8GB, recommended 16GB+
- **Storage**: At least 6GB free space for model files
- **CPU**: Multi-core processor (ARM64 or x86_64)
- **GPU** (Optional): NVIDIA GPU with CUDA support for acceleration
- **Network**: Stable internet connection for initial download

### Software Dependencies

- **Ollama**: Latest version (0.1.0+)
- **Python**: 3.8+ (for our application integration)
- **Node.js**: 18+ (for our proxy server)

## Installation

### Step 1: Install Ollama

#### macOS (Homebrew)
```bash
brew install ollama
```

#### macOS (Direct Download)
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Windows
Download the installer from [ollama.ai](https://ollama.ai) and follow the installation wizard.

### Step 2: Start Ollama Service

#### macOS/Linux
```bash
# Start as a background service
ollama serve

# Or run in foreground for debugging
OLLAMA_DEBUG=1 ollama serve
```

#### Windows
The Ollama service starts automatically after installation. Check the system tray for the Ollama icon.

### Step 3: Download and Install DeepSeek-R1 8B

```bash
# Download and install the model (this will take several minutes)
ollama run deepseek-r1:8b

# The first run will:
# 1. Download the 5.2GB model file
# 2. Load it into memory
# 3. Start an interactive session

# Exit the interactive session
/bye
```

### Step 4: Verify Installation

```bash
# List installed models
ollama list

# Should show something like:
# NAME                ID              SIZE    MODIFIED
# deepseek-r1:8b      abc123def456    5.2GB   2 minutes ago

# Test the model
ollama run deepseek-r1:8b "What is 2+2?"
```

## Configuration

### Environment Variables

Add these to your `.env` file in the project root:

```bash
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:8b
OLLAMA_TIMEOUT=60000

# Model Parameters
OLLAMA_TEMPERATURE=0.7
OLLAMA_TOP_P=0.9
OLLAMA_TOP_K=40
OLLAMA_MAX_TOKENS=4096
OLLAMA_CONTEXT_WINDOW=128000

# Performance Settings
OLLAMA_NUM_PREDICT=4096
OLLAMA_NUM_CTX=128000
OLLAMA_NUM_BATCH=512
OLLAMA_NUM_GQA=8
OLLAMA_NUM_GPU=1  # Set to 0 for CPU-only
OLLAMA_NUM_THREAD=0  # 0 = auto-detect CPU cores

# Debugging
OLLAMA_DEBUG=false
OLLAMA_VERBOSE=false
```

### Model Configuration File

Create `config/ollama-config.json`:

```json
{
  "model": "deepseek-r1:8b",
  "host": "http://localhost:11434",
  "options": {
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40,
    "num_predict": 4096,
    "num_ctx": 128000,
    "num_batch": 512,
    "num_gqa": 8,
    "num_gpu": 1,
    "num_thread": 0,
    "repeat_last_n": 64,
    "repeat_penalty": 1.1,
    "seed": -1,
    "stop": ["</s>", "[INST]", "[/INST]"],
    "tfs_z": 1.0,
    "mirostat": 0,
    "mirostat_eta": 0.1,
    "mirostat_tau": 5.0
  },
  "keep_alive": "5m",
  "stream": true
}
```

## DeepSeek-R1 0528 Update Features

The 0528 version includes several improvements:

### Enhanced Reasoning Capabilities
- **Chain-of-Thought**: Improved step-by-step reasoning
- **Self-Reflection**: Better error detection and correction
- **Multi-step Problems**: Enhanced handling of complex queries

### Performance Optimizations
- **Faster Inference**: 15-20% speed improvement
- **Memory Efficiency**: Better context window utilization
- **Batch Processing**: Improved multi-query handling

### Context Window Improvements
- **128K Context**: Full utilization of the large context window
- **Context Retention**: Better long-conversation memory
- **Context Compression**: Intelligent truncation strategies

### Commercial Use License (MIT)
- **No Usage Restrictions**: Free for commercial applications
- **No Attribution Required**: Can be used in proprietary systems
- **Modification Allowed**: Can fine-tune or adapt the model
- **Redistribution Permitted**: Can package with applications

## Integration with Our Application

### LLM Abstraction Layer Integration

The model integrates with our `OllamaProvider` class:

```python
# Example usage in our application
from llm_abstraction.providers import OllamaProvider

provider = OllamaProvider(
    model_name="deepseek-r1:8b",
    base_url="http://localhost:11434",
    temperature=0.7,
    max_tokens=4096
)

response = provider.invoke("Analyze this knowledge graph query...")
```

### Parameter Profiles

Our application supports these pre-configured profiles:

#### Creative Profile
```python
{
    "temperature": 0.9,
    "top_p": 0.95,
    "top_k": 50
}
```

#### Precise Profile
```python
{
    "temperature": 0.3,
    "top_p": 0.8,
    "top_k": 20
}
```

#### Balanced Profile (Default)
```python
{
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40
}
```

## Performance Optimization

### Hardware Recommendations

#### For Development
- **RAM**: 16GB minimum
- **CPU**: 8+ cores (Apple M1/M2, Intel i7/i9, AMD Ryzen 7/9)
- **Storage**: SSD recommended for faster model loading

#### For Production
- **RAM**: 32GB+ recommended
- **CPU**: 16+ cores server processor
- **GPU**: NVIDIA RTX 4090, A100, or similar for acceleration
- **Storage**: NVMe SSD for model storage

### Ollama Performance Tuning

#### CPU Optimization
```bash
# Set thread count to CPU cores - 1
export OLLAMA_NUM_THREAD=$((`nproc` - 1))

# Increase batch size for throughput
export OLLAMA_NUM_BATCH=1024

# Enable performance mode
export OLLAMA_FLASH_ATTENTION=1
```

#### GPU Acceleration (NVIDIA)
```bash
# Enable GPU acceleration
export OLLAMA_NUM_GPU=1

# For multiple GPUs
export OLLAMA_NUM_GPU=2

# Set CUDA memory fraction
export OLLAMA_GPU_MEMORY_FRACTION=0.8
```

#### Memory Management
```bash
# Increase context cache
export OLLAMA_CONTEXT_CACHE_SIZE=2048

# Set keep-alive duration
export OLLAMA_KEEP_ALIVE=30m

# Enable memory mapping
export OLLAMA_MMAP=1
```

### Application-Level Optimizations

#### Connection Pooling
```python
# Use connection pooling in production
OLLAMA_CONNECTION_POOL_SIZE=10
OLLAMA_CONNECTION_TIMEOUT=30
```

#### Caching Strategies
```python
# Enable response caching for similar queries
ENABLE_RESPONSE_CACHE=true
CACHE_TTL=3600  # 1 hour
```

## Troubleshooting

### Common Issues

#### 1. Model Download Fails
```bash
# Check Ollama service status
ollama ps

# Restart Ollama service
pkill ollama
ollama serve

# Try download again with debug
OLLAMA_DEBUG=1 ollama run deepseek-r1:8b
```

#### 2. Out of Memory Errors
```bash
# Reduce context window
export OLLAMA_NUM_CTX=32000

# Reduce batch size
export OLLAMA_NUM_BATCH=256

# Force CPU mode
export OLLAMA_NUM_GPU=0
```

#### 3. Slow Response Times
```bash
# Check system resources
top
htop

# Monitor Ollama performance
ollama ps

# Increase timeout
export OLLAMA_TIMEOUT=120000
```

#### 4. Connection Refused Errors
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Check port availability
lsof -i :11434

# Restart Ollama on different port
OLLAMA_HOST=0.0.0.0:11435 ollama serve
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Environment variables for debugging
export OLLAMA_DEBUG=1
export OLLAMA_VERBOSE=1
export OLLAMA_LOG_LEVEL=DEBUG

# Start Ollama with debugging
ollama serve 2>&1 | tee ollama-debug.log

# Test with debug output
ollama run deepseek-r1:8b "Test query" --debug
```

### Performance Monitoring

#### System Monitoring
```bash
# Monitor CPU usage
htop

# Monitor memory usage
free -h

# Monitor GPU usage (if applicable)
nvidia-smi

# Monitor disk I/O
iotop
```

#### Application Monitoring
```python
# Add to your application
import time
import psutil

def monitor_ollama_performance():
    start_time = time.time()
    
    # Your Ollama call here
    response = provider.invoke(query)
    
    end_time = time.time()
    response_time = end_time - start_time
    
    # Log performance metrics
    logger.info(f"Response time: {response_time:.2f}s")
    logger.info(f"Memory usage: {psutil.virtual_memory().percent}%")
    logger.info(f"CPU usage: {psutil.cpu_percent()}%")
```

## Security Considerations

### Network Security
```bash
# Bind to localhost only (default)
OLLAMA_HOST=127.0.0.1:11434

# For secure remote access, use reverse proxy
# nginx, Apache, or similar with SSL/TLS
```

### Model Security
- DeepSeek-R1 8B runs locally, ensuring data privacy
- No data sent to external services
- Model files stored locally in Ollama directory
- Regular security updates through Ollama updates

### Access Control
```python
# Implement rate limiting in your application
from ratelimit import limits, sleep_and_retry

@sleep_and_retry
@limits(calls=100, period=60)  # 100 calls per minute
def protected_ollama_call(query):
    return provider.invoke(query)
```

## Maintenance

### Regular Updates
```bash
# Update Ollama
ollama update

# Re-download model for updates
ollama pull deepseek-r1:8b

# List available model versions
ollama list deepseek-r1
```

### Cleanup
```bash
# Remove unused models
ollama rm old-model:version

# Clean up temporary files
ollama prune

# Check disk usage
du -sh ~/.ollama/
```

### Backup
```bash
# Backup model files
cp -r ~/.ollama/models/ /path/to/backup/

# Export model configuration
ollama show deepseek-r1:8b > deepseek-config-backup.txt
```

## Support and Resources

### Official Documentation
- [Ollama Documentation](https://github.com/ollama/ollama)
- [DeepSeek Model Card](https://huggingface.co/deepseek-ai/deepseek-r1-distill-llama-8b)

### Community Resources
- [Ollama Discord](https://discord.gg/ollama)
- [DeepSeek GitHub](https://github.com/deepseek-ai)

### Performance Benchmarks
- **Single Query**: ~2-5 seconds (8-core CPU)
- **Batch Processing**: ~10-50 queries/minute
- **Context Utilization**: Up to 128K tokens
- **Memory Usage**: 6-8GB RAM during inference

### Known Limitations
- Requires significant RAM for optimal performance
- Initial model load time: 10-30 seconds
- Context window truncation for very long conversations
- GPU acceleration limited to NVIDIA cards

## Conclusion

DeepSeek-R1 8B provides excellent reasoning capabilities for our Knowledge Graph Visualizer application. With proper installation and configuration, it delivers fast, accurate responses while maintaining data privacy through local execution.

For production deployment, ensure adequate hardware resources and implement proper monitoring and backup procedures. The MIT license allows for flexible commercial use without restrictions.

---

*Last updated: January 2025*
*Version: 1.0* 