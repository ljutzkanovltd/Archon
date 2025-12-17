# Ollama Configuration Test Results

**Date**: 2025-12-10
**Test Duration**: 45 minutes
**Status**: ✅ Partial Success (Chat Working, Embeddings Issue)

---

## Summary

Successfully configured Archon to use Ollama/llama.cpp for LLM inference. **Chat functionality is working**, but embeddings require additional configuration due to your multi-instance llama-server setup.

---

## ✅ What's Working

### 1. Ollama Chat Model Integration
- **Model**: Qwen3-32B-Q4_K_M.gguf
- **Endpoint**: http://localhost:11434 (llama.cpp server)
- **Status**: ✅ **WORKING**
- **Test Results**:
  - Connection: ✅ Successful
  - Model Discovery: ✅ Successful
  - Chat Completion: ✅ Successful
  - Response Time**: ~11 seconds (acceptable for 32B model)

### 2. Archon Configuration
- **Provider**: `ollama`
- **Base URL**: `http://host.docker.internal:11434/v1`
- **Chat Model**: `/models/Qwen3-32B-Q4_K_M.gguf`
- **Embedding Model**: `nomic-embed-text` (configured but not accessible - see issue below)

### 3. Service Health
- **Archon Backend**: ✅ Healthy
- **Archon MCP**: ✅ Running
- **Supabase**: ✅ Connected
- **Docker**: ✅ All containers running

---

## ⚠️ Issue Found: Embedding Model Not Accessible

### Problem Description

You have multiple llama-server instances running:

```
PORT 8080 Instances:
1. Qwen2.5-Coder-32B-Instruct (chat)
2. Qwen3-32B (chat)
3. Qwen2.5-VL-7B-Instruct (chat)
4. nomic-embed-text-v1.5 (embeddings) ← This is what we need!

PORT 11434:
- Only exposes Qwen3-32B
- Does NOT expose nomic-embed-text
```

**Impact**:
- ❌ Cannot generate embeddings for documents
- ❌ Cannot use semantic search
- ❌ Cannot upload documents to knowledge base
- ✅ Chat completions still work

---

## 🔧 Solutions

### Option 1: Expose Embedding Model on Port 11434 (Recommended)

If you're using a load balancer or proxy for port 11434, configure it to route `/api/embeddings` requests to the nomic-embed-text instance on port 8080.

**Steps**:
1. Check what service is listening on port 11434:
   ```bash
   lsof -i :11434
   ```
2. Configure routing for embedding endpoint:
   - If using Nginx/HAProxy: Add route for `/api/embeddings`
   - If using custom proxy: Update configuration

**After Fix - Test**:
```bash
curl -s http://localhost:11434/api/embeddings \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "prompt": "test"}' | head -20
```

Expected: Should return `{"embedding": [0.123, -0.456, ...]}` with ~768 values

---

### Option 2: Configure Separate Embedding URL in Archon

Configure Archon to use a different URL for embeddings:

```sql
docker exec supabase-ai-db psql -U postgres -d postgres << 'EOF'
-- Add separate embedding URL (port 8080 where nomic-embed-text runs)
INSERT INTO archon_settings (key, value, category, description)
VALUES ('OLLAMA_EMBEDDING_URL', 'http://host.docker.internal:8080', 'rag_strategy',
        'Separate URL for embedding model instance')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verify
SELECT key, value FROM archon_settings
WHERE key IN ('LLM_BASE_URL', 'OLLAMA_EMBEDDING_URL');
EOF
```

**Then restart Archon**:
```bash
cd /home/ljutzkanov/Documents/Projects/archon
docker compose restart archon-server archon-mcp
```

---

### Option 3: Use OpenAI for Embeddings, Ollama for Chat (Hybrid)

Keep using Qwen3 for chat but use OpenAI for embeddings:

```sql
docker exec supabase-ai-db psql -U postgres -d postgres << 'EOF'
-- Keep Ollama for chat
UPDATE archon_settings SET value = 'ollama' WHERE key = 'LLM_PROVIDER';

-- Use OpenAI embedding model
UPDATE archon_settings SET value = 'text-embedding-3-small' WHERE key = 'EMBEDDING_MODEL';

-- Set OpenAI API key (via Settings UI for encryption)
EOF
```

**Cost**: OpenAI embeddings are ~$0.02 per 1M tokens (very affordable)

**Benefit**: Best of both worlds - local chat, cloud embeddings

---

## 📊 Test Results Detail

### Model Discovery Test
```json
{
  "total_models": 1,
  "chat_models": [
    {
      "name": "/models/Qwen3-32B-Q4_K_M.gguf",
      "instance_url": "http://host.docker.internal:11434",
      "capabilities": ["chat", "function_calling", "structured_output"]
    }
  ],
  "embedding_models": [],  // ← Empty - this is the problem
  "host_status": {
    "http://host.docker.internal:11434": {
      "status": "online",
      "models_count": "1"
    }
  }
}
```

### Capability Test
```json
{
  "model_name": "/models/Qwen3-32B-Q4_K_M.gguf",
  "test_results": {
    "function_calling": {"supported": false},
    "structured_output": {"supported": false}
  },
  "compatibility_assessment": {
    "level": "limited",
    "features": ["Local Processing", "Text Generation", "MCP Integration", "Streaming"],
    "limitations": ["No function calling", "Limited structured output"]
  },
  "test_duration_seconds": 11.25
}
```

**Interpretation**: Basic chat works well. Advanced features (function calling) not supported by this model variant.

---

## 🚀 Next Steps

### Immediate Actions

1. **Choose a Solution**:
   - [ ] Option 1: Expose embeddings on port 11434
   - [ ] Option 2: Configure separate embedding URL
   - [ ] Option 3: Use OpenAI for embeddings

2. **After Fixing**:
   ```bash
   # Test embedding generation
   curl -X POST "http://localhost:8181/api/ollama/models/test-capabilities" \
     -H "Content-Type: application/json" \
     -d '{
       "instance_url": "http://host.docker.internal:11434",
       "model_name": "nomic-embed-text",
       "test_embedding": true
     }'
   ```

3. **Test Knowledge Base**:
   - Upload a small document via UI (http://localhost:3737/knowledge)
   - Verify embeddings are generated
   - Test semantic search

### Recommended Configuration

For your setup with multiple llama-servers on port 8080, I recommend **Option 2**:
- Simple to configure
- Works with your existing infrastructure
- No external dependencies
- Fully local and private

---

## 📝 Current Configuration

```sql
-- Current Archon Settings (Verified)
LLM_PROVIDER: ollama
LLM_BASE_URL: http://host.docker.internal:11434/v1
MODEL_CHOICE: /models/Qwen3-32B-Q4_K_M.gguf
EMBEDDING_MODEL: nomic-embed-text
```

### Database Connection
```
postgres://postgres@supabase-ai-db:5432/postgres
```

### Service Status
```
✅ archon-server: Running (port 8181)
✅ archon-mcp: Running (port 8051)
✅ supabase-ai-db: Running (port 5432)
✅ Archon UI: Available (port 3737)
```

---

## 🧪 How to Verify Full Functionality

After fixing embeddings:

```bash
# 1. Check health
curl http://localhost:8181/health

# 2. Discover models (should show embedding model)
curl "http://localhost:8181/api/ollama/models?instance_urls=http://host.docker.internal:11434"

# 3. Test chat (should work now)
# Via UI: http://localhost:3737

# 4. Test knowledge base (upload PDF/text file)
# Via UI: http://localhost:3737/knowledge → Upload Document

# 5. Test search (after uploading content)
# Via UI: Enter search query
```

---

## 📚 Documentation Created

During this session, the following comprehensive documentation was created in `/archon/docs/`:

1. **LLM_CONFIGURATION_GUIDE.md** (~16KB)
   - Complete reference for all LLM providers
   - Provider-specific setup guides
   - Troubleshooting section

2. **OLLAMA_QUICKSTART.md** (~10KB)
   - Quick setup guide for Ollama
   - Model recommendations
   - Performance tuning

3. **AZURE_OPENAI_IMPLEMENTATION.md** (~10KB)
   - Technical spec for Azure OpenAI support
   - Implementation plan (2-3 days)

4. **FEATURES_AND_USAGE.md** (~12KB)
   - High-level overview of Archon features
   - Quick start guide
   - User documentation

---

## 🎯 Success Criteria

- ✅ Archon configured for Ollama provider
- ✅ Chat model working (Qwen3-32B)
- ✅ Model discovery functional
- ✅ Health checks passing
- ⚠️ **Embedding model needs configuration** (see solutions above)
- ⏳ Knowledge base fully functional (after embedding fix)

---

## 💡 Recommendations

1. **Immediate**: Implement Option 2 (separate embedding URL) - easiest fix
2. **Short-term**: Test knowledge base with a sample document
3. **Long-term**: Consider consolidating llama-servers or using Ollama standard distribution for easier management

---

## 🔗 Resources

- **Archon UI**: http://localhost:3737
- **Archon API**: http://localhost:8181
- **API Docs**: http://localhost:8181/docs
- **MCP Server**: http://localhost:8051

- **Documentation**: `/home/ljutzkanov/Documents/Projects/archon/docs/`
- **Configuration**: Database table `archon_settings`

---

## 📞 Support

If you encounter issues:

```bash
# Check logs
docker compose logs -f archon-server

# Check database
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT key, value FROM archon_settings WHERE category = 'rag_strategy';"

# Restart services
cd /home/ljutzkanov/Documents/Projects/archon
docker compose restart archon-server archon-mcp
```

---

**Test Completed**: 2025-12-10 18:15 UTC
**Status**: ✅ Chat Working, ⚠️ Embeddings Need Configuration
**Next Action**: Implement one of the three solutions above
