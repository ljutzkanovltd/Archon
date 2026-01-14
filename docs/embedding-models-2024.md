# Latest 2024 Embedding Models

## Overview

Archon now supports the latest 2024 embedding models with significant quality improvements over the baseline `text-embedding-3-small` (MTEB: 62.3):

| Model | Dimension | Provider | MTEB Score | Improvement | Release |
|-------|-----------|----------|------------|-------------|---------|
| **gte-qwen2-7b-instruct** | 3584 | Ollama | **67.3** | **+8%** | Nov 2024 |
| **jina-embeddings-v3** | 1024 | Jina AI | **66.3** | **+6%** | Sep 2024 |
| text-embedding-3-large | 3072 | OpenAI | 64.6 | +4% | Jan 2024 |
| text-embedding-3-small | 1536 | OpenAI | 62.3 | baseline | Jan 2024 |

---

## GTE-Qwen2-7B-instruct (BEST QUALITY)

**Highest quality embedding model available** with instruction-following capabilities.

### Features
- **MTEB Score**: 67.3 (+8% vs baseline)
- **Dimensions**: 3584
- **Context Window**: 8192 tokens
- **Provider**: Ollama (local) or OpenRouter (cloud)
- **Cost**: Free (Ollama) or per-token (OpenRouter)
- **Release**: November 2024

### Setup with Ollama (Recommended)

1. **Pull the model**:
   ```bash
   ollama pull gte-qwen2-7b-instruct
   ```

2. **Configure in Archon Settings UI**:
   - Go to Settings → RAG Strategy
   - Set `EMBEDDING_MODEL` to: `gte-qwen2-7b-instruct`
   - Set `LLM_PROVIDER` to: `ollama`
   - Set `EMBEDDING_DIMENSIONS` to: `3584`

3. **Verify**:
   ```bash
   curl http://localhost:11434/api/embeddings \
     -d '{"model":"gte-qwen2-7b-instruct","prompt":"test"}'
   ```

### Database Migration

The 3584-dimensional column is automatically added when you run migrations:

```bash
cd ~/Documents/Projects/archon
# Migration runs automatically on startup
# Or manually:
docker exec -it supabase-ai-db psql -U postgres -d postgres \
  -f /path/to/migration/0.4.0/001_add_3584d_embedding_support.sql
```

---

## Jina Embeddings v3 (BEST OPEN-SOURCE)

**Best open-source embedding model** with late chunking support for improved context.

### Features
- **MTEB Score**: 66.3 (+6% vs baseline)
- **Dimensions**: 1024
- **Context Window**: 8192 tokens
- **Provider**: Jina AI (cloud) or Ollama (if available)
- **Cost**: Free tier available, $0.02/1M tokens for paid
- **Release**: September 2024

### Setup with Jina AI (Cloud)

1. **Get API key**:
   - Visit: https://jina.ai/embeddings
   - Sign up and copy your API key

2. **Configure in Archon**:

   **Option A - Via Settings UI**:
   - Go to Settings → Credentials
   - Add `JINA_API_KEY` with your key
   - Go to Settings → RAG Strategy
   - Set `EMBEDDING_MODEL` to: `jina-embeddings-v3`
   - Set `LLM_PROVIDER` to: `jina`
   - Set `EMBEDDING_DIMENSIONS` to: `1024`

   **Option B - Via Environment Variable**:
   ```bash
   # Add to .env file
   JINA_API_KEY=jsk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   EMBEDDING_MODEL=jina-embeddings-v3
   LLM_PROVIDER=jina
   EMBEDDING_DIMENSIONS=1024
   ```

3. **Verify**:
   ```bash
   curl https://api.jina.ai/v1/embeddings \
     -H "Authorization: Bearer $JINA_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"jina-embeddings-v3","input":"test"}'
   ```

### Setup with Ollama (If Available)

```bash
# Check if available
ollama list | grep jina

# If available, pull
ollama pull jina-embeddings-v3

# Configure in Archon
# Set EMBEDDING_MODEL=jina-embeddings-v3
# Set LLM_PROVIDER=ollama
# Set EMBEDDING_DIMENSIONS=1024
```

---

## Comparison with Current Models

### Quality Comparison (MTEB Scores)

```
gte-qwen2-7b-instruct  67.3 ███████████████████ (+8.0%)
jina-embeddings-v3     66.3 ██████████████████▌ (+6.4%)
text-embedding-3-large 64.6 █████████████████▌  (+3.7%)
text-embedding-004     62.7 █████████████████   (+0.6%)
text-embedding-3-small 62.3 ████████████████▊   (baseline)
nomic-embed-text       62.4 ████████████████▊   (+0.2%)
mxbai-embed-large      64.6 █████████████████▌  (+3.7%)
text-embedding-ada-002 60.9 ████████████████    (-2.2%)
```

### Dimension & Index Support

| Dimension | Models | Vector Index | Notes |
|-----------|--------|--------------|-------|
| 384 | all-minilm | ✅ IVFFlat | Lightweight, fast |
| 768 | nomic-embed, Google, text-embedding-004 | ✅ IVFFlat | Good balance |
| 1024 | mxbai, **jina-v3** | ✅ IVFFlat | High quality |
| 1536 | OpenAI text-embedding-3-small | ✅ IVFFlat | OpenAI standard |
| 3072 | OpenAI text-embedding-3-large | ⚠️ No index | pgvector 2000D limit |
| **3584** | **gte-qwen2-7b** | ✅ IVFFlat | **Highest quality** |

**Note**: pgvector's HNSW index has a 2000-dimension limit, but IVFFlat supports up to 16k dimensions.

---

## Migration Guide

### From text-embedding-3-small to jina-embeddings-v3

**Benefit**: +6% quality improvement, similar cost/performance

1. Configure Jina API key (see setup above)
2. Update settings:
   ```
   EMBEDDING_MODEL=jina-embeddings-v3
   LLM_PROVIDER=jina
   EMBEDDING_DIMENSIONS=1024
   ```
3. Re-index your knowledge base:
   - New content will use jina-embeddings-v3 automatically
   - For existing content, delete and re-crawl sources to regenerate embeddings

### From text-embedding-3-small to gte-qwen2-7b-instruct

**Benefit**: +8% quality improvement, FREE with Ollama

1. Pull model: `ollama pull gte-qwen2-7b-instruct`
2. Update settings:
   ```
   EMBEDDING_MODEL=gte-qwen2-7b-instruct
   LLM_PROVIDER=ollama
   EMBEDDING_DIMENSIONS=3584
   ```
3. Re-index knowledge base (delete and re-crawl sources)

---

## Performance Considerations

### Token Limits
- All new models: 8192 tokens (vs 8191 for OpenAI)
- No practical difference for most use cases

### API Costs
| Provider | Model | Price per 1M tokens |
|----------|-------|---------------------|
| Jina AI | jina-embeddings-v3 | $0.02 |
| OpenAI | text-embedding-3-small | $0.02 |
| OpenAI | text-embedding-3-large | $0.13 |
| Ollama | gte-qwen2-7b-instruct | **FREE** |
| Ollama | Any model | **FREE** |

### Speed
- **Jina AI (cloud)**: ~500-1000 embeddings/sec
- **Ollama (local)**: ~100-500 embeddings/sec (depends on hardware)
- **OpenAI**: ~500-1000 embeddings/sec

---

## Troubleshooting

### Jina API Issues

**Error: "API key not found"**
```bash
# Verify API key is set
curl http://localhost:8181/api/settings | jq '.JINA_API_KEY'
# Should return: {"value": "jsk-xxx..."}

# If null, add via Settings UI or environment variable
```

**Error: "Invalid API key"**
- Check key starts with `jsk-`
- Verify key is active: https://jina.ai/embeddings/dashboard

### Ollama Model Not Found

**Error: "model not found: gte-qwen2-7b-instruct"**
```bash
# List available models
ollama list

# Pull if missing
ollama pull gte-qwen2-7b-instruct

# Verify model exists
ollama show gte-qwen2-7b-instruct
```

### Database Column Missing

**Error: "column embedding_3584 does not exist"**
```bash
# Run migration
cd ~/Documents/Projects/archon
./stop-archon.sh
./start-archon.sh
# Migrations run automatically on startup

# Or manually apply
docker exec -it supabase-ai-db psql -U postgres -d postgres \
  -f migration/0.4.0/001_add_3584d_embedding_support.sql
```

---

## Best Practices

### Choosing a Model

**For Highest Quality** (research, production):
- Use `gte-qwen2-7b-instruct` (MTEB: 67.3)
- Best retrieval accuracy
- FREE with Ollama

**For Best Balance** (development, cost-sensitive):
- Use `jina-embeddings-v3` (MTEB: 66.3)
- Great quality, affordable
- Easy cloud deployment

**For Baseline** (compatibility, testing):
- Use `text-embedding-3-small` (MTEB: 62.3)
- OpenAI standard
- Widely supported

### Re-indexing Strategy

**When to Re-index**:
- Switching models (dimension changes require re-indexing)
- Quality improvements (optional, but recommended for +6-8% gains)

**How to Re-index**:
1. Go to Archon Dashboard → Sources
2. Delete existing sources
3. Re-crawl or re-upload documents
4. New embeddings generated automatically with new model

### Mixing Models

**Can I use multiple models?**
- ✅ YES - Archon supports multi-dimensional embeddings
- Each column (384D, 768D, 1024D, 1536D, 3072D, 3584D) is independent
- Search uses the dimension matching your configured model

**Example: Using both OpenAI and Jina**:
```
# Index with OpenAI first
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
# Crawl sources → Creates embedding_1536 vectors

# Add Jina embeddings later
EMBEDDING_MODEL=jina-embeddings-v3
EMBEDDING_DIMENSIONS=1024
# Re-crawl same sources → Creates embedding_1024 vectors

# Both embeddings stored, search uses active dimension
```

---

## References

- **Jina AI**: https://jina.ai/embeddings
- **GTE-Qwen2**: https://huggingface.co/Alibaba-NLP/gte-Qwen2-7B-instruct
- **MTEB Leaderboard**: https://huggingface.co/spaces/mteb/leaderboard
- **Ollama Models**: https://ollama.com/library
- **pgvector Documentation**: https://github.com/pgvector/pgvector

---

**Last Updated**: 2026-01-14
**Archon Version**: 0.4.0+
