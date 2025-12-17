# LLM Configuration Guide

**Version**: 1.0.0
**Last Updated**: 2025-12-10
**Audience**: Archon administrators and developers

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Supported Providers](#supported-providers)
4. [Configuration Methods](#configuration-methods)
5. [Provider-Specific Setup](#provider-specific-setup)
   - [OpenAI](#openai)
   - [Ollama](#ollama)
   - [Google Gemini](#google-gemini)
   - [OpenRouter](#openrouter)
   - [Anthropic](#anthropic)
   - [Grok (xAI)](#grok-xai)
6. [Embedding Configuration](#embedding-configuration)
7. [PydanticAI Integration](#pydanticai-integration)
8. [Advanced Configuration](#advanced-configuration)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Archon uses a flexible LLM provider system that allows you to configure different language models for various tasks:

- **Chat/Completion Models**: For code analysis, document processing, and AI agents
- **Embedding Models**: For semantic search and vector similarity
- **Multi-Provider Support**: Mix and match providers for different tasks

All configuration is centralized in the Supabase database (`archon_settings` table) and managed through:
- **Settings UI** (recommended): Web interface at `http://localhost:3737/settings`
- **Direct Database**: For advanced users and automation

---

## Architecture

### Configuration Storage

```
Supabase PostgreSQL Database
└── archon_settings table
    ├── key (unique): Setting name
    ├── value: Plain text configuration values
    ├── encrypted_value: Encrypted API keys (bcrypt)
    ├── is_encrypted: Boolean flag
    ├── category: Grouping (api_keys, rag_strategy, etc.)
    └── description: User-friendly description
```

### Key Settings

| Setting | Category | Type | Description |
|---------|----------|------|-------------|
| `LLM_PROVIDER` | rag_strategy | Plain | Provider for chat models: `openai`, `ollama`, `google` |
| `LLM_BASE_URL` | rag_strategy | Plain | Custom base URL (mainly for Ollama) |
| `EMBEDDING_MODEL` | rag_strategy | Plain | Model name for embeddings |
| `MODEL_CHOICE` | rag_strategy | Plain | LLM for summaries and contextual embeddings |
| `OPENAI_API_KEY` | api_keys | Encrypted | OpenAI API key |
| `GOOGLE_API_KEY` | api_keys | Encrypted | Google Gemini API key |
| `OLLAMA_EMBEDDING_URL` | rag_strategy | Plain | Separate Ollama instance for embeddings (optional) |

---

## Supported Providers

### 1. **OpenAI** (Default)
- **Models**: GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo, etc.
- **Embeddings**: text-embedding-3-small, text-embedding-3-large
- **Requirements**: OpenAI API key
- **Use Case**: Production-ready, high-quality responses

### 2. **Ollama** (Local/Self-Hosted)
- **Models**: Llama 3.2, Mistral, Qwen, Phi, etc.
- **Embeddings**: nomic-embed-text, mxbai-embed-large
- **Requirements**: Ollama server running locally
- **Use Case**: Privacy-focused, cost-effective, offline capability

### 3. **Google Gemini**
- **Models**: Gemini Pro, Gemini Flash
- **Embeddings**: text-embedding-004
- **Requirements**: Google API key
- **Use Case**: Multimodal capabilities, Google ecosystem integration

### 4. **OpenRouter**
- **Models**: Hosted community models
- **Requirements**: OpenRouter API key
- **Use Case**: Access to multiple providers through one API

### 5. **Anthropic**
- **Models**: Claude 3.5 Sonnet, Claude 3 Opus
- **Requirements**: Anthropic API key
- **Use Case**: Long context, advanced reasoning

### 6. **Grok (xAI)**
- **Models**: Grok models
- **Requirements**: Grok API key (starts with `xai-`)
- **Use Case**: xAI ecosystem integration

---

## Configuration Methods

### Method 1: Settings UI (Recommended)

1. **Access Settings**: Navigate to `http://localhost:3737/settings`
2. **Select Provider**: Choose your LLM provider from dropdown
3. **Configure Settings**:
   - Enter API key (if required)
   - Set base URL (for Ollama)
   - Choose embedding model
4. **Save**: Click "Save Settings"
5. **Test**: Use the "Test Connection" button to verify

**Advantages**:
- User-friendly interface
- Input validation
- Immediate feedback
- No database knowledge required

### Method 2: Direct Database Configuration

For advanced users and automation:

```bash
# Access PostgreSQL database
docker exec -it supabase-ai-db psql -U postgres -d postgres

# View all LLM settings
SELECT key, value, category FROM archon_settings WHERE category IN ('rag_strategy', 'api_keys');

# Update LLM provider
UPDATE archon_settings SET value = 'ollama' WHERE key = 'LLM_PROVIDER';

# Update Ollama base URL
UPDATE archon_settings SET value = 'http://localhost:11434' WHERE key = 'LLM_BASE_URL';

# Set API key (encrypted)
-- Use Settings UI for API keys to ensure proper encryption
```

**Caution**: API keys must be properly encrypted. Use Settings UI for credential management.

---

## Provider-Specific Setup

### OpenAI

#### Prerequisites
- OpenAI account
- API key from https://platform.openai.com/api-keys

#### Configuration

**Via Settings UI**:
1. Provider: `openai`
2. API Key: `sk-...` (your OpenAI API key)
3. Embedding Model: `text-embedding-3-small` (or `text-embedding-3-large`)
4. Chat Model: `gpt-4o` (recommended) or `gpt-4-turbo`

**Via Database**:
```sql
-- Set provider
UPDATE archon_settings SET value = 'openai' WHERE key = 'LLM_PROVIDER';

-- Set embedding model
UPDATE archon_settings SET value = 'text-embedding-3-small' WHERE key = 'EMBEDDING_MODEL';

-- Set chat model for contextual embeddings
UPDATE archon_settings SET value = 'gpt-4o-mini' WHERE key = 'MODEL_CHOICE';

-- API key must be set via Settings UI for encryption
```

#### PydanticAI Model String
```python
# In agent code
model = "openai:gpt-4o"
model = "openai:gpt-4-turbo"
model = "openai:gpt-3.5-turbo"
```

---

### Ollama

#### Prerequisites
1. **Install Ollama**: https://ollama.ai/download
2. **Pull Models**:
   ```bash
   # Chat models
   ollama pull llama3.2
   ollama pull mistral
   ollama pull qwen2.5

   # Embedding models
   ollama pull nomic-embed-text
   ollama pull mxbai-embed-large
   ```
3. **Start Ollama**:
   ```bash
   ollama serve
   # Default runs on http://localhost:11434
   ```

#### Configuration

**Via Settings UI**:
1. Provider: `ollama`
2. Base URL: `http://localhost:11434` (or `http://host.docker.internal:11434` in Docker)
3. Embedding Model: `nomic-embed-text`
4. Chat Model: `llama3.2` (or other pulled model)

**Via Database**:
```sql
-- Set provider
UPDATE archon_settings SET value = 'ollama' WHERE key = 'LLM_PROVIDER';

-- Set base URL
UPDATE archon_settings SET value = 'http://localhost:11434' WHERE key = 'LLM_BASE_URL';

-- Set embedding model
UPDATE archon_settings SET value = 'nomic-embed-text' WHERE key = 'EMBEDDING_MODEL';

-- Set chat model
UPDATE archon_settings SET value = 'llama3.2' WHERE key = 'MODEL_CHOICE';
```

#### Model Discovery

Archon automatically discovers available Ollama models:
- **Endpoint**: GET `/api/internal/ollama/models`
- **Features**: Automatic capability detection (chat vs embedding)
- **Caching**: 5-minute TTL for performance

#### PydanticAI Model String
```python
# In agent code
model = "ollama:llama3.2"
model = "ollama:mistral"
model = "ollama:qwen2.5:latest"
```

#### Separate Embedding Instance (Optional)

For performance, you can run a separate Ollama instance for embeddings:

```sql
-- Set separate embedding URL
INSERT INTO archon_settings (key, value, category, description)
VALUES ('OLLAMA_EMBEDDING_URL', 'http://localhost:11435', 'rag_strategy',
        'Separate Ollama instance for embedding operations')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

### Google Gemini

#### Prerequisites
- Google Cloud account or AI Studio account
- API key from https://aistudio.google.com/apikey

#### Configuration

**Via Settings UI**:
1. Provider: `google`
2. API Key: Your Google API key
3. Embedding Model: `text-embedding-004`
4. Chat Model: `gemini-1.5-pro` or `gemini-1.5-flash`

**Via Database**:
```sql
-- Set provider
UPDATE archon_settings SET value = 'google' WHERE key = 'LLM_PROVIDER';

-- Set embedding model
UPDATE archon_settings SET value = 'text-embedding-004' WHERE key = 'EMBEDDING_MODEL';

-- API key via Settings UI
```

#### PydanticAI Model String
```python
model = "google:gemini-1.5-pro"
model = "google:gemini-1.5-flash"
```

---

### OpenRouter

#### Prerequisites
- OpenRouter account
- API key from https://openrouter.ai/keys

#### Configuration

**Via Settings UI**:
1. Provider: `openrouter`
2. API Key: Your OpenRouter API key
3. Embedding Model: `text-embedding-3-small` (OpenAI compatible)

**Via Database**:
```sql
UPDATE archon_settings SET value = 'openrouter' WHERE key = 'LLM_PROVIDER';
-- API key via Settings UI
```

#### PydanticAI Model String
```python
model = "openrouter:anthropic/claude-3.5-sonnet"
model = "openrouter:openai/gpt-4-turbo"
```

---

### Anthropic

#### Prerequisites
- Anthropic account
- API key from https://console.anthropic.com/account/keys

#### Configuration

**Via Settings UI**:
1. Provider: `anthropic`
2. API Key: Your Anthropic API key
3. Embedding Model: `text-embedding-3-small` (uses OpenAI compatible)

**Via Database**:
```sql
UPDATE archon_settings SET value = 'anthropic' WHERE key = 'LLM_PROVIDER';
-- API key via Settings UI
```

#### PydanticAI Model String
```python
model = "anthropic:claude-3-5-sonnet-20241022"
model = "anthropic:claude-3-opus-20240229"
```

---

### Grok (xAI)

#### Prerequisites
- Grok account
- API key from https://console.x.ai/

#### Configuration

**Via Settings UI**:
1. Provider: `grok`
2. API Key: Your Grok API key (starts with `xai-`)
3. Embedding Model: `text-embedding-3-small` (compatible models)

**Via Database**:
```sql
UPDATE archon_settings SET value = 'grok' WHERE key = 'LLM_PROVIDER';
-- API key via Settings UI
```

#### PydanticAI Model String
```python
model = "grok:grok-2"
```

---

## Embedding Configuration

### Separate Embedding Provider

You can use a different provider for embeddings than for chat:

```sql
-- Example: Use Ollama for embeddings, OpenAI for chat
UPDATE archon_settings SET value = 'openai' WHERE key = 'LLM_PROVIDER';
UPDATE archon_settings SET value = 'nomic-embed-text' WHERE key = 'EMBEDDING_MODEL';
UPDATE archon_settings SET value = 'http://localhost:11434' WHERE key = 'LLM_BASE_URL';
```

### Supported Embedding Models by Provider

| Provider | Recommended Models | Dimensions |
|----------|-------------------|------------|
| OpenAI | `text-embedding-3-small` | 1536 |
| | `text-embedding-3-large` | 3072 |
| Ollama | `nomic-embed-text` | 768 |
| | `mxbai-embed-large` | 1024 |
| | `snowflake-arctic-embed` | 1024 |
| Google | `text-embedding-004` | 768 |
| | `text-multilingual-embedding-002` | 768 |

### Dimension Compatibility

Archon's database supports multiple embedding dimensions:
- 384D: Small embedding models
- 768D: Google, Ollama models
- 1024D: Ollama large models
- 1536D: OpenAI standard models
- 3072D: OpenAI large models

**Important**: Once you start using an embedding model, changing to a different dimension requires re-embedding all documents.

---

## PydanticAI Integration

### How Archon Uses PydanticAI

Archon uses PydanticAI for AI agent functionality. Models are specified using the format:

```
provider:model-name
```

### Agent Configuration

Agents inherit from `BaseAgent` class:

```python
# python/src/agents/base_agent.py
from pydantic_ai import Agent

class BaseAgent:
    def __init__(self, model: str = "openai:gpt-4o"):
        self.agent = Agent(
            model=model,
            # ... other configuration
        )
```

### Runtime Provider Selection

The `get_llm_client()` function dynamically selects providers based on database configuration:

```python
# python/src/server/services/llm_provider_service.py
async with get_llm_client(provider="ollama") as client:
    response = await client.chat.completions.create(
        model="llama3.2",
        messages=[{"role": "user", "content": "Hello"}]
    )
```

### Model String Examples

```python
# OpenAI
"openai:gpt-4o"
"openai:gpt-4-turbo"
"openai:gpt-3.5-turbo"

# Ollama
"ollama:llama3.2"
"ollama:mistral:latest"
"ollama:qwen2.5:7b"

# Google
"google:gemini-1.5-pro"
"google:gemini-1.5-flash"

# OpenRouter (with provider prefix)
"openrouter:anthropic/claude-3.5-sonnet"
"openrouter:openai/gpt-4"

# Anthropic
"anthropic:claude-3-5-sonnet-20241022"

# Grok
"grok:grok-2"
```

---

## Advanced Configuration

### RAG Strategy Settings

Fine-tune RAG behavior:

```sql
-- Enable/disable features
UPDATE archon_settings SET value = 'true' WHERE key = 'USE_CONTEXTUAL_EMBEDDINGS';
UPDATE archon_settings SET value = 'true' WHERE key = 'USE_HYBRID_SEARCH';
UPDATE archon_settings SET value = 'true' WHERE key = 'USE_AGENTIC_RAG';
UPDATE archon_settings SET value = 'true' WHERE key = 'USE_RERANKING';

-- Performance tuning
UPDATE archon_settings SET value = '3' WHERE key = 'CONTEXTUAL_EMBEDDINGS_MAX_WORKERS';
UPDATE archon_settings SET value = '200' WHERE key = 'EMBEDDING_BATCH_SIZE';
```

### Provider Cache Management

Archon caches provider configuration for 5 minutes. To force refresh:

```python
# In Python code
from src.server.services.llm_provider_service import clear_provider_cache

clear_provider_cache()  # Clears all cached provider configs
```

Or via API:
```bash
curl -X POST http://localhost:8181/api/internal/cache/clear
```

### Multi-Instance Ollama (Future)

Archon is designed to support multiple Ollama instances for load balancing:

```python
# Future feature - not yet implemented
instances = [
    "http://localhost:11434",  # Primary instance
    "http://localhost:11435",  # Secondary for embeddings
    "http://localhost:11436",  # Tertiary for scaling
]
```

---

## Troubleshooting

### Issue: "OpenAI API key not found"

**Symptoms**:
```
ValueError: OpenAI API key not found and Ollama fallback failed
```

**Solutions**:
1. **Set API Key**: Via Settings UI or database
2. **Configure Ollama Fallback**:
   ```sql
   UPDATE archon_settings SET value = 'http://localhost:11434' WHERE key = 'LLM_BASE_URL';
   ```
3. **Verify Settings**: Check that API key is encrypted in database

---

### Issue: "Ollama connection refused"

**Symptoms**:
```
Timeout connecting to Ollama instance at http://localhost:11434
```

**Solutions**:
1. **Check Ollama is Running**:
   ```bash
   curl http://localhost:11434/api/tags
   ```
2. **Docker Networking**: Use `http://host.docker.internal:11434` in Docker
3. **Firewall**: Ensure port 11434 is accessible
4. **Verify Base URL**: Check `LLM_BASE_URL` setting is correct

---

### Issue: "No models available on Ollama"

**Symptoms**:
```
Model {model_name} not found on instance
```

**Solutions**:
1. **Pull Model**:
   ```bash
   ollama pull llama3.2
   ollama pull nomic-embed-text
   ```
2. **List Available Models**:
   ```bash
   ollama list
   ```
3. **Check Model Discovery**:
   ```bash
   curl http://localhost:8181/api/internal/ollama/models
   ```

---

### Issue: "Embedding dimension mismatch"

**Symptoms**:
```
ERROR: Embedding dimension 768 does not match existing 1536
```

**Solutions**:
1. **Use Same Model**: Don't change embedding models mid-project
2. **Re-embed Documents**: Delete and re-crawl sources with new model
3. **Check Model Dimensions**:
   - OpenAI text-embedding-3-small: 1536
   - Ollama nomic-embed-text: 768

---

### Issue: "Google API key invalid"

**Symptoms**:
```
ValueError: Google API key not found
```

**Solutions**:
1. **Get API Key**: https://aistudio.google.com/apikey
2. **Set in Settings UI**: Provider = `google`, enter API key
3. **Verify Key Format**: Should be a long string (40+ characters)

---

### Issue: "Provider cache stale"

**Symptoms**: Changes in Settings UI not reflected in API calls

**Solutions**:
1. **Wait 5 Minutes**: Cache TTL is 5 minutes
2. **Force Clear Cache**:
   ```bash
   curl -X POST http://localhost:8181/api/internal/cache/clear
   ```
3. **Restart Services**:
   ```bash
   docker-compose restart archon-server archon-mcp
   ```

---

### Debug Mode

Enable detailed logging for LLM operations:

```bash
# In .env
LOG_LEVEL=DEBUG

# Restart services
docker-compose restart archon-server
```

View logs:
```bash
docker-compose logs -f archon-server | grep "LLM"
```

---

## Additional Resources

- **Ollama Quick Start**: See `OLLAMA_QUICKSTART.md`
- **Azure OpenAI Support**: See `AZURE_OPENAI_IMPLEMENTATION.md` (implementation plan)
- **API Documentation**: http://localhost:8181/docs (FastAPI Swagger UI)
- **MCP Tools**: See MCP page in Archon UI for available tools

---

## Support

For issues and questions:
- **GitHub Issues**: https://github.com/ljutzkanovltd/Archon/issues
- **Logs**: `docker-compose logs archon-server`
- **Health Check**: http://localhost:8181/health

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-10
**Maintainer**: Archon Team
