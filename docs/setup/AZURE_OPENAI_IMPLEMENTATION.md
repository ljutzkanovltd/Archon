# Azure OpenAI Implementation Plan

**Status**: Implementation Spec
**Priority**: Medium
**Estimated Effort**: 2-3 days
**Target Version**: 1.1.0

---

## Overview

This document outlines the technical design and implementation plan for adding Azure OpenAI as a supported LLM provider in Archon.

### Motivation

- **Enterprise Requirements**: Many organizations require Azure-hosted models for compliance
- **Regional Availability**: Azure provides regional deployments for data residency
- **Cost Control**: Azure reservations can reduce costs vs. OpenAI direct
- **Integration**: Better integration with existing Azure infrastructure

---

## Current State

### Supported Providers

- ✅ OpenAI (api.openai.com)
- ✅ Ollama (self-hosted)
- ✅ Google Gemini
- ✅ OpenRouter
- ✅ Anthropic
- ✅ Grok
- ❌ Azure OpenAI (NOT YET SUPPORTED)

### Provider Service Architecture

```
python/src/server/services/
├── llm_provider_service.py       # Provider client creation
├── credential_service.py         # API key management
└── embeddings/embedding_service.py  # Embedding generation
```

---

## Azure OpenAI Differences

### Key Differences from OpenAI

| Feature | OpenAI | Azure OpenAI |
|---------|--------|--------------|
| **Base URL** | `https://api.openai.com/v1` | `https://{resource}.openai.azure.com/` |
| **API Version** | Not required | Required query parameter (e.g., `2024-02-15-preview`) |
| **Authentication** | Bearer token (`Authorization: Bearer sk-...`) | API key header (`api-key: ...`) |
| **Model Names** | Direct (e.g., `gpt-4o`) | Deployment names (custom, e.g., `my-gpt4-deployment`) |
| **Endpoint Structure** | `/v1/chat/completions` | `/openai/deployments/{deployment}/chat/completions?api-version=...` |

### Example API Call

**OpenAI**:
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [...]}'
```

**Azure OpenAI**:
```bash
curl "https://my-resource.openai.azure.com/openai/deployments/gpt4-deployment/chat/completions?api-version=2024-02-15-preview" \
  -H "api-key: abc123..." \
  -H "Content-Type: application/json" \
  -d '{"messages": [...]}'  # Note: no "model" field
```

---

## Design

### 1. Database Schema Changes

Add new settings to `archon_settings` table:

```sql
-- Provider selection
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('LLM_PROVIDER', 'azure-openai', false, 'rag_strategy', 'Set to azure-openai to use Azure OpenAI');

-- Azure-specific settings
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_ENDPOINT', NULL, false, 'rag_strategy',
 'Azure OpenAI endpoint (e.g., https://your-resource.openai.azure.com/)'),

('AZURE_OPENAI_API_VERSION', '2024-02-15-preview', false, 'rag_strategy',
 'Azure OpenAI API version (e.g., 2024-02-15-preview)'),

('AZURE_OPENAI_CHAT_DEPLOYMENT', NULL, false, 'rag_strategy',
 'Deployment name for chat/completion models'),

('AZURE_OPENAI_EMBEDDING_DEPLOYMENT', NULL, false, 'rag_strategy',
 'Deployment name for embedding models');

-- API key (encrypted)
INSERT INTO archon_settings (key, encrypted_value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_API_KEY', NULL, true, 'api_keys',
 'Azure OpenAI API key (from Azure Portal)');
```

### 2. Code Changes

#### File: `python/src/server/services/llm_provider_service.py`

Add Azure OpenAI provider support in `get_llm_client()` function:

```python
@asynccontextmanager
async def get_llm_client(...):
    # ... existing code ...

    elif provider_name == "azure-openai":
        if not api_key:
            raise ValueError("Azure OpenAI API key not found")

        # Get Azure-specific settings
        rag_settings = await credential_service.get_credentials_by_category("rag_strategy")

        azure_endpoint = rag_settings.get("AZURE_OPENAI_ENDPOINT")
        api_version = rag_settings.get("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

        if not azure_endpoint:
            raise ValueError("AZURE_OPENAI_ENDPOINT not configured")

        # Azure OpenAI uses different client initialization
        client = openai.AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=azure_endpoint,
            api_version=api_version
        )
        logger.info(f"Azure OpenAI client created successfully for {azure_endpoint}")
```

#### File: `python/src/server/services/credential_service.py`

Add method to get Azure deployment names:

```python
async def get_azure_deployment_name(self, model_type: str = "chat") -> str:
    """
    Get Azure OpenAI deployment name for chat or embedding.

    Args:
        model_type: "chat" or "embedding"

    Returns:
        Deployment name
    """
    rag_settings = await self.get_credentials_by_category("rag_strategy")

    if model_type == "chat":
        deployment = rag_settings.get("AZURE_OPENAI_CHAT_DEPLOYMENT")
        if not deployment:
            raise ValueError("AZURE_OPENAI_CHAT_DEPLOYMENT not configured")
        return deployment
    elif model_type == "embedding":
        deployment = rag_settings.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")
        if not deployment:
            raise ValueError("AZURE_OPENAI_EMBEDDING_DEPLOYMENT not configured")
        return deployment
    else:
        raise ValueError(f"Unknown model_type: {model_type}")
```

Add provider validation:

```python
def _is_valid_provider(provider: str) -> bool:
    """Basic provider validation."""
    if not provider or not isinstance(provider, str):
        return False
    return provider.lower() in {
        "openai", "ollama", "google", "openrouter",
        "anthropic", "grok", "azure-openai"  # Add Azure
    }
```

#### File: `python/src/server/services/embeddings/embedding_service.py`

Update embedding generation for Azure:

```python
async def generate_embeddings(...):
    # ... existing code ...

    if provider == "azure-openai":
        deployment_name = await credential_service.get_azure_deployment_name("embedding")

        async with get_llm_client(provider="azure-openai") as client:
            response = await client.embeddings.create(
                model=deployment_name,  # Azure uses deployment name
                input=texts,
                **embedding_params
            )
```

### 3. PydanticAI Integration

Update agent model strings to support Azure:

```python
# Current format
model = "openai:gpt-4o"
model = "ollama:llama3.2"

# New format for Azure
model = "azure-openai:gpt4-deployment"  # Uses deployment name
```

### 4. Frontend Changes

#### File: `archon-ui-main/src/features/settings/components/SettingsForm.tsx`

Add Azure OpenAI provider option and configuration fields:

```typescript
// Add to provider dropdown
const providers = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'azure-openai', label: 'Azure OpenAI' },  // New
  { value: 'ollama', label: 'Ollama' },
  { value: 'google', label: 'Google Gemini' },
  // ... others
];

// Conditional fields for Azure OpenAI
{provider === 'azure-openai' && (
  <>
    <Input
      label="Azure Endpoint"
      name="azureEndpoint"
      placeholder="https://your-resource.openai.azure.com/"
      required
    />
    <Input
      label="API Version"
      name="azureApiVersion"
      defaultValue="2024-02-15-preview"
      required
    />
    <Input
      label="Chat Deployment Name"
      name="azureChatDeployment"
      placeholder="gpt4-deployment"
      required
    />
    <Input
      label="Embedding Deployment Name"
      name="azureEmbeddingDeployment"
      placeholder="text-embedding-deployment"
      required
    />
  </>
)}
```

---

## Implementation Tasks

### Phase 1: Backend Implementation (1-1.5 days)

- [ ] **Database Migration**:
  - Create migration file: `migration/add_azure_openai_support.sql`
  - Add Azure-specific settings to `archon_settings`
  - Test migration on clean database

- [ ] **Update `llm_provider_service.py`**:
  - Add `azure-openai` provider to `get_llm_client()`
  - Implement `AsyncAzureOpenAI` client initialization
  - Add deployment name resolution logic
  - Update provider validation

- [ ] **Update `credential_service.py`**:
  - Add `get_azure_deployment_name()` method
  - Add Azure API key validation
  - Update `get_active_provider()` for Azure

- [ ] **Update `embedding_service.py`**:
  - Add Azure OpenAI embedding generation
  - Handle deployment names vs model names

- [ ] **Testing**:
  - Unit tests for provider service
  - Integration tests with mock Azure API
  - Test deployment name resolution

### Phase 2: Frontend Implementation (0.5-1 day)

- [ ] **Settings UI**:
  - Add Azure OpenAI to provider dropdown
  - Add conditional Azure configuration fields
  - Form validation for required fields
  - Save/update Azure settings

- [ ] **Types**:
  - Update provider types to include `azure-openai`
  - Add Azure-specific setting types

- [ ] **Testing**:
  - Manual testing of Settings UI
  - E2E tests for Azure configuration flow

### Phase 3: Documentation & Testing (0.5 day)

- [ ] **User Documentation**:
  - Update `LLM_CONFIGURATION_GUIDE.md` with Azure section
  - Create Azure setup tutorial with screenshots
  - Add troubleshooting section

- [ ] **Developer Documentation**:
  - Update API documentation
  - Document Azure-specific code paths

- [ ] **Integration Testing**:
  - Test with real Azure OpenAI deployment
  - Test chat completions
  - Test embeddings
  - Test error handling

---

## Configuration Example

### Via Settings UI

1. Navigate to Settings (`http://localhost:3737/settings`)
2. Select Provider: `Azure OpenAI`
3. Enter Configuration:
   - **Azure Endpoint**: `https://my-org.openai.azure.com/`
   - **API Key**: `abc123...` (from Azure Portal)
   - **API Version**: `2024-02-15-preview` (default)
   - **Chat Deployment**: `gpt-4o-deployment` (your deployment name)
   - **Embedding Deployment**: `text-embedding-3-small-deployment`
4. Save Settings
5. Test Connection

### Via Database

```sql
-- Set provider
UPDATE archon_settings SET value = 'azure-openai' WHERE key = 'LLM_PROVIDER';

-- Set Azure endpoint
UPDATE archon_settings SET value = 'https://my-org.openai.azure.com/'
WHERE key = 'AZURE_OPENAI_ENDPOINT';

-- Set API version
UPDATE archon_settings SET value = '2024-02-15-preview'
WHERE key = 'AZURE_OPENAI_API_VERSION';

-- Set deployment names
UPDATE archon_settings SET value = 'gpt-4o-deployment'
WHERE key = 'AZURE_OPENAI_CHAT_DEPLOYMENT';

UPDATE archon_settings SET value = 'text-embedding-deployment'
WHERE key = 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT';

-- Set API key via Settings UI (for encryption)
```

---

## Testing Checklist

### Unit Tests

- [ ] Provider service: Azure client creation
- [ ] Provider service: Deployment name resolution
- [ ] Provider service: Error handling (missing config)
- [ ] Credential service: Azure API key retrieval
- [ ] Credential service: Deployment name retrieval

### Integration Tests

- [ ] Chat completion with Azure deployment
- [ ] Embedding generation with Azure deployment
- [ ] Multi-turn conversation
- [ ] Streaming responses (if supported)
- [ ] Error handling (invalid API key, invalid endpoint)

### E2E Tests

- [ ] Settings UI: Configure Azure provider
- [ ] Settings UI: Validate required fields
- [ ] Settings UI: Test connection button
- [ ] Knowledge Base: Upload document with Azure embeddings
- [ ] RAG Search: Query with Azure models

---

## Migration Guide (for Existing OpenAI Users)

### Step 1: Create Azure Resources

1. **Azure Portal**: Create an Azure OpenAI resource
2. **Deploy Models**:
   - Deploy `gpt-4o` (or desired chat model)
   - Deploy `text-embedding-3-small` (or desired embedding model)
3. **Get Credentials**:
   - Copy endpoint URL (e.g., `https://my-org.openai.azure.com/`)
   - Copy API key from "Keys and Endpoint" section

### Step 2: Update Archon Configuration

```sql
-- Change provider from openai to azure-openai
UPDATE archon_settings SET value = 'azure-openai' WHERE key = 'LLM_PROVIDER';

-- Add Azure endpoint
UPDATE archon_settings SET value = 'https://my-org.openai.azure.com/'
WHERE key = 'AZURE_OPENAI_ENDPOINT';

-- Set deployment names (from Azure Portal)
UPDATE archon_settings SET value = 'my-gpt4-deployment'
WHERE key = 'AZURE_OPENAI_CHAT_DEPLOYMENT';

UPDATE archon_settings SET value = 'my-embedding-deployment'
WHERE key = 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT';

-- Update API key via Settings UI
```

### Step 3: Test

```bash
# Test chat
curl -X POST http://localhost:8181/api/internal/test-llm \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello from Azure!"}'

# Test embeddings (upload a document via UI)
```

---

## Potential Issues & Solutions

### Issue: "Invalid deployment name"

**Solution**: Verify deployment names in Azure Portal match configuration

### Issue: "API version not supported"

**Solution**: Check Azure documentation for latest supported API version

### Issue: "Embeddings dimension mismatch"

**Solution**: If switching from OpenAI to Azure mid-project, ensure same embedding model dimension

---

## Dependencies

### Required Packages

```toml
# pyproject.toml (already included in openai package)
dependencies = [
    "openai>=1.0.0",  # Includes Azure OpenAI support
]
```

No additional packages required - `openai` library v1.0+ includes `AsyncAzureOpenAI` client.

---

## Security Considerations

1. **API Key Storage**: Continue using encrypted storage in `archon_settings`
2. **Endpoint Validation**: Validate endpoint format (must be `https://` Azure domain)
3. **API Version**: Use latest stable API version by default
4. **Deployment Names**: Validate deployment names exist before use

---

## Future Enhancements

1. **Multi-Region Support**: Allow multiple Azure endpoints for different regions
2. **Auto-Discovery**: Automatically discover available deployments
3. **Cost Tracking**: Track token usage per deployment for cost allocation
4. **Fallback**: Automatic fallback to OpenAI if Azure unavailable

---

## References

- **Azure OpenAI Documentation**: https://learn.microsoft.com/azure/ai-services/openai/
- **OpenAI Python Library**: https://github.com/openai/openai-python
- **Azure OpenAI Quickstart**: https://learn.microsoft.com/azure/ai-services/openai/quickstart
- **API Reference**: https://learn.microsoft.com/azure/ai-services/openai/reference

---

## Acceptance Criteria

- [ ] Azure OpenAI can be selected as provider in Settings UI
- [ ] All Azure-specific configuration fields are available
- [ ] API key is securely stored (encrypted)
- [ ] Chat completions work with Azure deployments
- [ ] Embeddings work with Azure deployments
- [ ] Error messages are clear and actionable
- [ ] Documentation is complete and accurate
- [ ] Migration path from OpenAI is documented
- [ ] All tests pass

---

**Document Version**: 1.0.0
**Status**: Implementation Spec
**Next Steps**: Create tracking issue in GitHub, assign to developer
**Estimated Release**: Version 1.1.0
