# Ollama Quick Start Guide

**Get Archon running with Ollama in under 10 minutes**

---

## Overview

This guide walks you through configuring Archon to use Ollama for:
- **Local LLM inference** (chat and completion)
- **Local embeddings** (semantic search)
- **Privacy-focused operation** (all data stays on your machine)
- **Cost-effective AI** (no API fees)

---

## Prerequisites

### 1. Ollama Installation

**Install Ollama**:
- **macOS/Linux**:
  ```bash
  curl -fsSL https://ollama.ai/install.sh | sh
  ```
- **Windows**: Download from https://ollama.ai/download
- **Docker**: Use official Ollama Docker image (see below)

**Verify Installation**:
```bash
ollama --version
# Should output: ollama version x.x.x
```

### 2. Start Ollama Server

```bash
ollama serve
```

**Default endpoint**: `http://localhost:11434`

**Verify Running**:
```bash
curl http://localhost:11434/api/tags
# Should return JSON with "models" array
```

---

## Step 1: Pull Models

### Chat/Completion Models

Choose one or more models based on your hardware:

```bash
# Recommended: Llama 3.2 (3B - Fast, good quality)
ollama pull llama3.2

# Alternative: Mistral (7B - Larger, higher quality)
ollama pull mistral

# Alternative: Qwen 2.5 (3B/7B - Great for coding)
ollama pull qwen2.5

# Alternative: Phi 3 (3.8B - Microsoft, efficient)
ollama pull phi3
```

**Hardware Recommendations**:
- **8GB RAM**: `llama3.2` (3B), `phi3` (3.8B)
- **16GB RAM**: `mistral` (7B), `qwen2.5:7b`
- **32GB+ RAM**: `llama3.1:70b`, `qwen2.5:32b`

### Embedding Models

Choose one embedding model:

```bash
# Recommended: Nomic Embed Text (768D, fast)
ollama pull nomic-embed-text

# Alternative: MXBai Embed Large (1024D, higher quality)
ollama pull mxbai-embed-large

# Alternative: Snowflake Arctic Embed (1024D)
ollama pull snowflake-arctic-embed
```

**Verify Models Pulled**:
```bash
ollama list
```

Expected output:
```
NAME                     ID              SIZE    MODIFIED
llama3.2:latest          a80c4f17acd5    2.0 GB  2 minutes ago
nomic-embed-text:latest  0a109f422b47    274 MB  1 minute ago
```

---

## Step 2: Configure Archon

### Option A: Settings UI (Recommended)

1. **Access Settings**: Navigate to `http://localhost:3737/settings`

2. **Configure LLM Provider**:
   - **LLM Provider**: Select `ollama` from dropdown
   - **LLM Base URL**: Enter `http://localhost:11434`
     - If running Archon in Docker: `http://host.docker.internal:11434`
   - **Chat Model**: Enter `llama3.2` (or the model you pulled)

3. **Configure Embedding Provider**:
   - **Embedding Model**: Enter `nomic-embed-text` (or your embedding model)
   - **Ollama Embedding URL** (optional): Leave blank to use same instance

4. **Save Settings**: Click "Save Settings" button

5. **Test Connection**: Click "Test Connection" to verify

### Option B: Database Configuration (Advanced)

```bash
# Access PostgreSQL database
docker exec -it supabase-ai-db psql -U postgres -d postgres

# Configure Ollama as provider
UPDATE archon_settings SET value = 'ollama' WHERE key = 'LLM_PROVIDER';

# Set Ollama base URL (adjust for your setup)
UPDATE archon_settings SET value = 'http://localhost:11434' WHERE key = 'LLM_BASE_URL';
# For Docker: UPDATE archon_settings SET value = 'http://host.docker.internal:11434' WHERE key = 'LLM_BASE_URL';

# Set chat model
UPDATE archon_settings SET value = 'llama3.2' WHERE key = 'MODEL_CHOICE';

# Set embedding model
UPDATE archon_settings SET value = 'nomic-embed-text' WHERE key = 'EMBEDDING_MODEL';

# Exit psql
\q
```

---

## Step 3: Verify Configuration

### Test via Archon API

```bash
# Test chat completion
curl -X POST http://localhost:8181/api/internal/test-llm \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, how are you?"}'

# Check model discovery
curl http://localhost:8181/api/internal/ollama/models
```

Expected output:
```json
{
  "total_models": 2,
  "chat_models": [
    {
      "name": "llama3.2:latest",
      "capabilities": ["chat", "structured_output"]
    }
  ],
  "embedding_models": [
    {
      "name": "nomic-embed-text:latest",
      "dimensions": 768
    }
  ]
}
```

### Test Knowledge Base

1. **Navigate to Knowledge Base**: `http://localhost:3737/knowledge`
2. **Upload a Document**: Click "Upload Document" and upload a PDF/text file
3. **Wait for Processing**: Archon will use Ollama to generate embeddings
4. **Test Search**: Enter a search query to test semantic search

---

## Docker Setup (Optional)

### Running Ollama in Docker

```bash
# Pull Ollama Docker image
docker pull ollama/ollama:latest

# Run Ollama container
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama-data:/root/.ollama \
  ollama/ollama

# Pull models inside container
docker exec -it ollama ollama pull llama3.2
docker exec -it ollama ollama pull nomic-embed-text

# Verify models
docker exec -it ollama ollama list
```

**Archon Configuration for Docker Ollama**:
- **LLM Base URL**: `http://ollama:11434` (if on same Docker network)
- Or: `http://host.docker.internal:11434` (from Docker to host)

---

## Multi-Instance Setup (Advanced)

For better performance, run separate Ollama instances for chat and embeddings:

### Setup

```bash
# Terminal 1: Chat instance (port 11434)
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# Terminal 2: Embedding instance (port 11435)
OLLAMA_HOST=0.0.0.0:11435 ollama serve

# Pull chat models on instance 1
OLLAMA_HOST=localhost:11434 ollama pull llama3.2

# Pull embedding models on instance 2
OLLAMA_HOST=localhost:11435 ollama pull nomic-embed-text
```

### Configure Archon

```sql
-- Set chat instance
UPDATE archon_settings SET value = 'http://localhost:11434' WHERE key = 'LLM_BASE_URL';

-- Set separate embedding instance
INSERT INTO archon_settings (key, value, category, description)
VALUES ('OLLAMA_EMBEDDING_URL', 'http://localhost:11435', 'rag_strategy',
        'Separate Ollama instance for embedding operations')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## Performance Tuning

### Ollama Configuration

Create `~/.ollama/config.json`:

```json
{
  "num_parallel": 4,
  "num_gpu": 1,
  "gpu_layers": 32,
  "num_thread": 8
}
```

**Key Settings**:
- `num_parallel`: Concurrent requests (default: 4)
- `num_gpu`: Number of GPUs to use
- `gpu_layers`: Layers to offload to GPU
- `num_thread`: CPU threads for inference

### Archon RAG Settings

```sql
-- Increase embedding batch size for faster processing
UPDATE archon_settings SET value = '200' WHERE key = 'EMBEDDING_BATCH_SIZE';

-- Adjust contextual embeddings workers
UPDATE archon_settings SET value = '3' WHERE key = 'CONTEXTUAL_EMBEDDINGS_MAX_WORKERS';

-- Increase document storage batch size
UPDATE archon_settings SET value = '100' WHERE key = 'DOCUMENT_STORAGE_BATCH_SIZE';
```

---

## Model Recommendations

### Best Chat Models for Different Use Cases

| Use Case | Model | Size | RAM | Notes |
|----------|-------|------|-----|-------|
| **Fast responses** | `llama3.2` | 3B | 8GB | Recommended for most users |
| **Coding tasks** | `qwen2.5` | 7B | 16GB | Excellent for code generation |
| **High quality** | `llama3.1:70b` | 70B | 64GB | Best quality, slow |
| **Low memory** | `phi3` | 3.8B | 8GB | Microsoft, efficient |
| **Balanced** | `mistral` | 7B | 16GB | Good quality/speed balance |

### Best Embedding Models

| Model | Dimensions | Size | Use Case |
|-------|-----------|------|----------|
| `nomic-embed-text` | 768 | 274MB | **Recommended**, fast, good quality |
| `mxbai-embed-large` | 1024 | 669MB | Higher quality, slower |
| `snowflake-arctic-embed` | 1024 | 669MB | Multilingual support |

**Important**: Once you choose an embedding model, don't change it (requires re-embedding all documents).

---

## Troubleshooting

### Issue: "Connection refused to localhost:11434"

**Solutions**:
1. **Check Ollama is running**:
   ```bash
   curl http://localhost:11434/api/tags
   ```
2. **Start Ollama**:
   ```bash
   ollama serve
   ```
3. **Check firewall**: Ensure port 11434 is open

---

### Issue: "Model not found"

**Solutions**:
1. **Pull the model**:
   ```bash
   ollama pull llama3.2
   ```
2. **List available models**:
   ```bash
   ollama list
   ```
3. **Use exact model name** in Archon settings

---

### Issue: "Docker: host.docker.internal not resolving"

**Solutions**:
1. **Linux Docker**: Add to `docker-compose.yml`:
   ```yaml
   extra_hosts:
     - "host.docker.internal:host-gateway"
   ```
2. **Use container name**: If Ollama in Docker, use `http://ollama:11434`
3. **Network mode**: Use Docker network bridge

---

### Issue: "Slow embedding generation"

**Solutions**:
1. **Use GPU**: Ensure Ollama detects your GPU
   ```bash
   ollama show llama3.2 | grep -i gpu
   ```
2. **Reduce batch size**: Lower `EMBEDDING_BATCH_SIZE`
3. **Disable contextual embeddings**: Set `USE_CONTEXTUAL_EMBEDDINGS` to `false`
4. **Use smaller embedding model**: Switch to `nomic-embed-text` (768D)

---

### Issue: "Out of memory errors"

**Solutions**:
1. **Use smaller models**:
   - `llama3.2` (3B) instead of `mistral` (7B)
2. **Reduce context window**:
   ```bash
   ollama run llama3.2 --ctx-size 2048
   ```
3. **Close other applications**: Free up RAM
4. **Monitor usage**:
   ```bash
   docker stats ollama  # If using Docker
   ```

---

## Advanced: Custom Models

### Import GGUF Models

```bash
# Create Modelfile
cat > Modelfile <<EOF
FROM /path/to/model.gguf
TEMPLATE """[INST] {{ .Prompt }} [/INST]"""
PARAMETER temperature 0.7
PARAMETER top_p 0.9
EOF

# Create custom model
ollama create my-custom-model -f Modelfile

# Use in Archon
# Set MODEL_CHOICE to 'my-custom-model'
```

---

## Next Steps

1. **✅ Test with Knowledge Base**: Upload documents and test search
2. **✅ Try Different Models**: Experiment with model quality/speed trade-offs
3. **✅ Enable RAG Features**: Configure contextual embeddings, hybrid search
4. **✅ Monitor Performance**: Check logs for processing times

**Full Documentation**: See `LLM_CONFIGURATION_GUIDE.md` for comprehensive reference

---

## Quick Reference

### Essential Commands

```bash
# Ollama
ollama serve                          # Start server
ollama list                           # List pulled models
ollama pull <model>                   # Pull a model
ollama rm <model>                     # Remove a model
ollama show <model>                   # Show model info
curl http://localhost:11434/api/tags  # Test endpoint

# Archon
docker-compose restart archon-server  # Restart after config changes
docker-compose logs -f archon-server  # View logs
curl http://localhost:8181/health     # Check health
```

### URLs

- **Ollama API**: http://localhost:11434
- **Archon UI**: http://localhost:3737
- **Archon Settings**: http://localhost:3737/settings
- **Archon API**: http://localhost:8181
- **API Docs**: http://localhost:8181/docs

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-10
**For**: Archon + Ollama Setup
