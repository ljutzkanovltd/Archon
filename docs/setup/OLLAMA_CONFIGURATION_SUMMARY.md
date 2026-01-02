# Archon Ollama Configuration Summary

**Date:** 2025-12-11
**Status:** ✅ Configured and Working

## Overview

Archon has been successfully configured to use your local Ollama/llama-server instances for both chat and embeddings without requiring any API keys.

## What Was Fixed

### Problem Discovered
The `OLLAMA_EMBEDDING_URL` was pointing to the wrong port. Initially it was set to:
- ❌ `http://host.docker.internal:11434/v1` (same as chat)
- ❌ Then briefly to port 8080 (which wasn't listening)

### Solution Applied
Updated the embedding URL to the correct port where the nomic-embed-text model is actually running:
- ✅ `http://host.docker.internal:11437/v1`

## Final Configuration

| Setting | Value | Port | Model/Provider |
|---------|-------|------|----------------|
| **LLM Provider** | `ollama` | - | Provider type |
| **Chat Base URL** | `http://host.docker.internal:11434/v1` | 11434 | Qwen3-32B |
| **Chat Model** | `/models/Qwen3-32B-Q4_K_M.gguf` | 11434 | Chat/completion |
| **Embedding URL** | `http://host.docker.internal:11437/v1` | 11437 | nomic-embed-text |
| **Embedding Model** | `/models/nomic-embed-text-v1.5.Q4_K_M.gguf` | 11437 | Embeddings |
| **API Key** | (empty) | - | Not required for Ollama |

## Your Ollama Instance Layout

You have 4 llama-server instances running on different ports:

| Port | Model | Type | Purpose |
|------|-------|------|---------|
| **11434** | Qwen3-32B-Q4_K_M.gguf | Chat | General text generation |
| **11435** | Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf | Vision | Visual understanding |
| **11436** | Qwen2.5-Coder-32B-Instruct-Q4_K_M.gguf | Code | Code generation |
| **11437** | nomic-embed-text-v1.5.Q4_K_M.gguf | Embeddings | Vector search |

This matches the recommended setup from `.env.example`:
```bash
# LLM API endpoints (Ollama/llama.cpp - OpenAI-compatible):
#   - General LLM:     http://host.docker.internal:11434
#   - Vision LLM:      http://host.docker.internal:11435
#   - Coder LLM:       http://host.docker.internal:11436
#   - Embeddings API:  http://host.docker.internal:11437
```

## About the API Key Field

### In the Database
The `OLLAMA_API_KEY` field is **empty** (which is correct). Ollama doesn't use API keys for local instances.

### In the UI
If you see an "OLLAMA_API_KEY" field in the Archon UI at http://localhost:3737/settings:

**Option 1 - Leave it empty** (recommended)
- The backend code explicitly ignores this field for Ollama
- From `credential_service.py:503-517`:
  ```python
  key_mapping = {
      "ollama": None,  # NO API KEY NEEDED
  }
  return "ollama" if provider == "ollama" else None
  ```

**Option 2 - Use a placeholder**
- Enter any value like `"ollama"`, `"not-required"`, or `"local"`
- Archon will ignore it when making requests to Ollama

**Why you might see it:**
- The UI might show a generic "API Key" field for all providers
- It's required for OpenAI, Google, etc., but not Ollama
- The backend handles this correctly by ignoring it for Ollama

## Verification Tests

### Chat Model (Port 11434) ✅
```bash
curl -s -X POST "http://localhost:8181/api/ollama/models/test-capabilities" \
  -H "Content-Type: application/json" \
  -d '{
    "instance_url": "http://host.docker.internal:11434",
    "model_name": "/models/Qwen3-32B-Q4_K_M.gguf",
    "test_chat": true
  }'
```

**Result:** Chat working ✅
- Features: Local Processing, Text Generation, MCP Integration, Streaming
- Status: Operational

### Embedding Model (Port 11437) ✅
```bash
curl -s -X POST "http://localhost:11437/v1/embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "/models/nomic-embed-text-v1.5.Q4_K_M.gguf",
    "input": "This is a test embedding"
  }'
```

**Result:** Embeddings working ✅
- Embedding dimension: 768
- Status: Operational

## How Archon Uses These Settings

### Chat Requests
```
Archon Chat → LLM_BASE_URL (11434) → Qwen3-32B → Response
```

### Embedding/RAG Requests
```
Archon Search → OLLAMA_EMBEDDING_URL (11437) → nomic-embed-text → Vector
→ Supabase pgvector → Similar documents
```

### No Authentication
```
Archon → Check provider ("ollama") → Skip API key → Direct connection
```

## Troubleshooting

### If chat doesn't work:
1. Check Qwen3-32B is running: `curl http://localhost:11434/v1/models`
2. Verify LLM_BASE_URL in database: Should be `http://host.docker.internal:11434/v1`
3. Check Archon logs: `docker logs archon-server`

### If embeddings don't work:
1. Check nomic-embed-text is running: `curl http://localhost:11437/v1/models`
2. Verify OLLAMA_EMBEDDING_URL: Should be `http://host.docker.internal:11437/v1`
3. Test embeddings directly (see verification test above)

### If you see "API key required" errors:
1. Verify LLM_PROVIDER is set to `ollama` (not `openai` or other)
2. Check database: `docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT key, value FROM archon_settings WHERE key = 'LLM_PROVIDER';"`
3. Restart Archon services: `./stop-archon.sh && ./start-archon.sh`

## Next Steps

### Optional: Switch to Different Models
If you want to use the Coder model instead of Qwen3-32B for chat:

```bash
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "UPDATE archon_settings SET value = 'http://host.docker.internal:11436/v1' WHERE key = 'LLM_BASE_URL';"

docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "UPDATE archon_settings SET value = '/models/Qwen2.5-Coder-32B-Instruct-Q4_K_M.gguf' WHERE key = 'MODEL_CHOICE';"
```

### Test RAG Functionality
Try using Archon's search features in the UI:
1. Navigate to http://localhost:3737
2. Use the search functionality to query your knowledge base
3. Verify that semantic search is working with embeddings

### MCP Integration
Test Archon MCP integration with Claude Code:
1. Ensure MCP server is running: `curl http://localhost:8051/health`
2. Use MCP tools to search knowledge base
3. Verify embeddings are being used for semantic search

## Summary

✅ **All systems configured and operational**

- **Chat Model:** Qwen3-32B on port 11434 - Working
- **Embedding Model:** nomic-embed-text-v1.5 on port 11437 - Working
- **API Key:** Not required (empty) - Correct
- **Configuration:** Stored in Supabase database - Persistent

**No further action required** unless you want to customize model selection or test specific features.

---

**Reference Documentation:**
- Quick Start: `/docs/OLLAMA_QUICKSTART.md`
- Full LLM Guide: `/docs/LLM_CONFIGURATION_GUIDE.md`
- Test Results: `/docs/OLLAMA_CONFIGURATION_TEST_RESULTS.md`
- Features Guide: `/docs/FEATURES_AND_USAGE.md`
