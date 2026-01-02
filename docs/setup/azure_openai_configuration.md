# Azure OpenAI Configuration Guide

**Document Version:** 2.0.0
**Last Updated:** December 12, 2025
**Author:** Archon Development Team

---

## Overview

This guide explains how to configure Archon to use Azure OpenAI as an alternative LLM and embedding provider. Azure OpenAI offers the same powerful models as standard OpenAI but with additional enterprise features, data residency options, and dedicated capacity.

**Version 2.0.0 Highlights:**
- **Separated Chat and Embedding Configurations**: Chat and embedding providers can now use different Azure OpenAI resources, endpoints, API versions, and deployments
- **Context-Aware UI**: Configuration interface automatically shows relevant fields based on whether you're configuring chat or embeddings
- **Independent Scaling**: Different rate limits and resources for chat vs embeddings
- **Backward Compatible**: Existing configurations automatically migrated to new structure

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure Portal Setup](#azure-portal-setup)
3. [Archon Configuration](#archon-configuration)
4. [Separated Configuration Benefits](#separated-configuration-benefits)
5. [Key Differences: Azure vs Standard OpenAI](#key-differences-azure-vs-standard-openai)
6. [Testing Your Configuration](#testing-your-configuration)
7. [Troubleshooting](#troubleshooting)
8. [API Reference](#api-reference)

---

## Prerequisites

### Required Azure Resources

Before configuring Archon, you must have:

1. **Azure Subscription** with access to Azure OpenAI Service
2. **Azure OpenAI Resource(s)** created in Azure Portal
   - Can use a single resource for both chat and embeddings
   - Or separate resources for chat and embeddings (recommended for production)
3. **At least one model deployment** (chat or embedding)
4. **API Key** from your Azure OpenAI resource(s)

### Required Archon Components

- Archon version 2.0.0 or higher
- Database migrations applied:
  - `add_azure_openai_support.sql` (v1.0)
  - `separate_azure_openai_configs.sql` (v2.0)
- Archon services running (archon-server, archon-mcp, archon-ui)

---

## Azure Portal Setup

### Step 1: Create Azure OpenAI Resource(s)

You can use either:
- **Single Resource**: One Azure OpenAI resource for both chat and embeddings
- **Separate Resources**: Different resources for chat and embeddings (better for production)

#### Create Azure OpenAI Resource

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Search for "Azure OpenAI" in the search bar
3. Click **Create** to create a new Azure OpenAI resource
4. Fill in required details:
   - **Subscription**: Your Azure subscription
   - **Resource Group**: Create new or select existing
   - **Region**: Choose your preferred region (e.g., East US, West Europe)
   - **Name**: Your resource name (e.g., `my-archon-chat-openai` or `my-archon-embedding-openai`)
   - **Pricing Tier**: Select appropriate tier
5. Click **Review + Create**, then **Create**

**For Production**: Repeat this process to create separate resources for chat and embeddings.

### Step 2: Create Model Deployments

Azure OpenAI requires you to create "deployments" - instances of models with custom names.

#### Create Chat Deployment

1. Navigate to your Azure OpenAI chat resource
2. Go to **Resource Management** → **Model deployments**
3. Click **Create new deployment**
4. Configure deployment:
   - **Model**: Select model (e.g., `gpt-4o`, `gpt-4`, `gpt-35-turbo`)
   - **Deployment name**: Choose a name (e.g., `gpt-4o-deployment`, `my-chat-model`)
   - **Model version**: Select latest version
   - **Deployment type**: Standard
   - **Tokens per Minute Rate Limit**: Set according to your needs
5. Click **Create**

#### Create Embedding Deployment

1. Navigate to your Azure OpenAI embedding resource (can be the same or different resource)
2. Go to **Resource Management** → **Model deployments**
3. Click **Create new deployment**
4. Configure deployment:
   - **Model**: Select embedding model (e.g., `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`)
   - **Deployment name**: Choose a name (e.g., `text-embedding-3-deployment`)
   - **Model version**: Select latest version
   - **Deployment type**: Standard
   - **Tokens per Minute Rate Limit**: Set according to your needs
5. Click **Create**

**Important Notes:**
- **Deployment names are custom** - you choose them, they are NOT the model names
- You can name deployments anything (e.g., "my-gpt4-prod", "embedding-v1")
- Remember these names - you'll need them for Archon configuration

### Step 3: Get API Credentials

For each Azure OpenAI resource you're using:

1. In your Azure OpenAI resource
2. Navigate to **Resource Management** → **Keys and Endpoint**
3. You'll see:
   - **Endpoint**: URL like `https://your-resource-name.openai.azure.com`
   - **Key 1**: Your primary API key
   - **Key 2**: Your secondary API key (backup)
   - **Region**: Your resource region
4. **Copy** the Endpoint URL and either Key 1 or Key 2

**Note:** If using separate resources, you can use the same API key if they're in the same subscription, or different keys if needed.

---

## Archon Configuration

### Step 1: Apply Database Migrations

If not already applied, run both Azure OpenAI migrations:

```bash
cd /home/ljutzkanov/Documents/Projects/archon

# Initial Azure OpenAI support (v1.0)
docker exec -i supabase-ai-db psql -U postgres -d postgres < migration/add_azure_openai_support.sql

# Separated chat/embedding configs (v2.0)
docker exec -i supabase-ai-db psql -U postgres -d postgres < migration/separate_azure_openai_configs.sql
```

**Expected Output:**
```
INSERT 0 1
INSERT 0 1
INSERT 0 1
...
SUCCESS: All 6 new Azure OpenAI settings created successfully
```

**Verify Migration:**
```bash
docker exec -i supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT key FROM archon_settings WHERE key LIKE 'AZURE_OPENAI_%' ORDER BY key;"
```

**Expected Result (v2.0):**
```
                       key
-------------------------------------------------
 AZURE_OPENAI_API_KEY
 AZURE_OPENAI_API_VERSION                [DEPRECATED]
 AZURE_OPENAI_CHAT_API_VERSION
 AZURE_OPENAI_CHAT_DEPLOYMENT
 AZURE_OPENAI_CHAT_ENDPOINT
 AZURE_OPENAI_EMBEDDING_API_VERSION
 AZURE_OPENAI_EMBEDDING_DEPLOYMENT
 AZURE_OPENAI_EMBEDDING_ENDPOINT
 AZURE_OPENAI_ENDPOINT                   [DEPRECATED]
(9 rows)
```

### Step 2: Configure API Key

1. Open Archon Dashboard: `http://localhost:3737`
2. Navigate to **Settings** → **API Keys**
3. Click **Add Credential**
4. Configure:
   - **Key Name**: `AZURE_OPENAI_API_KEY`
   - **Value**: Paste your Azure API key (from Azure Portal)
   - **Encrypted**: Yes (automatically encrypted)
5. Click **Save**

**Note:** If using separate resources with different API keys, use the same `AZURE_OPENAI_API_KEY` credential. The separated endpoint URLs will route requests to the correct resource.

**Verification:**
- You should see `AZURE_OPENAI_API_KEY` with masked value (`••••••••••`)

### Step 3: Configure Chat Provider (Separated Configuration)

1. In Archon Dashboard, navigate to **Settings** → **RAG Settings**
2. Under **LLM Provider Settings**, select **Chat: azure-openai**
3. Click the **Azure Config** button (teal/cyan colored)
4. The UI will show **Chat Provider Configuration** (blue-tinted)
5. Fill in chat-specific configuration:

   **Required Fields:**
   - **Chat Endpoint URL** `*`:
     ```
     https://your-chat-resource.openai.azure.com
     ```
     Copy from: Azure Portal → Your Chat Resource → Keys and Endpoint

   - **Chat API Version**:
     ```
     2024-02-01
     ```
     Default value (usually no need to change)

   - **Chat Deployment Name** `*`:
     ```
     your-gpt-4o-deployment
     ```
     The custom name YOU created in Azure Portal → Deployments

6. Click **Save Settings**

### Step 4: Configure Embedding Provider (Separated Configuration)

1. Still in **Settings** → **RAG Settings**
2. Under **LLM Provider Settings**, select **Embeddings: azure-openai**
3. Click the **Azure Config** button again
4. The UI will now show **Embedding Provider Configuration** (purple-tinted)
5. Fill in embedding-specific configuration:

   **Required Fields:**
   - **Embedding Endpoint URL** `*`:
     ```
     https://your-embedding-resource.openai.azure.com
     ```
     Copy from: Azure Portal → Your Embedding Resource → Keys and Endpoint
     (Can be the same as chat endpoint if using single resource)

   - **Embedding API Version**:
     ```
     2024-02-01
     ```
     Default value (usually no need to change)

   - **Embedding Deployment Name** `*`:
     ```
     your-text-embedding-3-deployment
     ```
     The custom name YOU created in Azure Portal → Deployments

6. Click **Save Settings**

### Step 5: Verify Configuration

After saving, check provider status:

1. Provider indicators should change from red (❌) to green (✅)
2. If partial/yellow (⚠️), check that:
   - API key is set
   - Endpoint URLs are correct
   - Deployment names are configured
3. Toggle between Chat and Embeddings tabs to verify both are properly configured

---

## Separated Configuration Benefits

### Independent Resource Management

Version 2.0.0 allows you to use different Azure OpenAI resources for chat and embeddings:

#### Use Case 1: Different Regions
```
Chat Resource:      https://my-chat-eastus.openai.azure.com
Embedding Resource: https://my-embed-westeu.openai.azure.com
```
**Benefit**: Deploy chat near users, embeddings near document storage

#### Use Case 2: Different Subscription/Quotas
```
Chat Resource:      Premium subscription with high TPM limits
Embedding Resource: Standard subscription with moderate TPM limits
```
**Benefit**: Allocate budget and quotas independently

#### Use Case 3: Different API Versions
```
Chat API Version:       2024-02-01 (latest features)
Embedding API Version:  2023-12-01 (stable, proven)
```
**Benefit**: Adopt new features gradually without disrupting embeddings

#### Use Case 4: Development vs Production
```
Chat Resource:      dev-archon-chat.openai.azure.com (test deployments)
Embedding Resource: prod-archon-embed.openai.azure.com (stable)
```
**Benefit**: Test chat models without affecting production embeddings

### Context-Aware UI

The Archon UI automatically shows relevant fields based on your current selection:

- **When configuring Chat**: Shows chat endpoint, chat API version, chat deployment
- **When configuring Embeddings**: Shows embedding endpoint, embedding API version, embedding deployment

This prevents confusion and makes it clear which resource you're configuring.

### Backward Compatibility

Existing Azure OpenAI configurations are automatically migrated:
- Old shared `AZURE_OPENAI_ENDPOINT` copied to both chat and embedding endpoints
- Old shared `AZURE_OPENAI_API_VERSION` copied to both API versions
- Deployment names remain unchanged
- No action required from users

---

## Key Differences: Azure vs Standard OpenAI

### Authentication

| Aspect | Standard OpenAI | Azure OpenAI |
|--------|----------------|--------------|
| **API Key** | Single key from OpenAI | Key from Azure resource |
| **Endpoint** | `api.openai.com` | Custom Azure endpoint(s) |
| **API Version** | Not required | Required parameter (e.g., `2024-02-01`) |

### Model Access

| Aspect | Standard OpenAI | Azure OpenAI |
|--------|----------------|--------------|
| **Model Names** | Standard names (e.g., `gpt-4o`) | Custom deployment names (e.g., `my-gpt4-deployment`) |
| **Model Selection** | Choose from OpenAI's catalog | Deploy models from Azure's catalog |
| **Rate Limits** | Per-account limits | Per-deployment configurable limits |

### Code Implementation

**Standard OpenAI Client:**
```python
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key="sk-xxx"
)

response = await client.chat.completions.create(
    model="gpt-4o",  # Standard model name
    messages=[...]
)
```

**Azure OpenAI Client (v2.0 - Separated):**
```python
from openai import AsyncAzureOpenAI

# Chat client (uses chat-specific configuration)
chat_client = AsyncAzureOpenAI(
    api_key=api_key,
    azure_endpoint=chat_endpoint,      # e.g., https://my-chat.openai.azure.com
    api_version=chat_api_version        # e.g., 2024-02-01
)

chat_response = await chat_client.chat.completions.create(
    model=chat_deployment_name,         # e.g., my-gpt4-deployment
    messages=[...]
)

# Embedding client (uses embedding-specific configuration)
embedding_client = AsyncAzureOpenAI(
    api_key=api_key,
    azure_endpoint=embedding_endpoint,  # e.g., https://my-embed.openai.azure.com
    api_version=embedding_api_version   # e.g., 2024-02-01
)

embedding_response = await embedding_client.embeddings.create(
    model=embedding_deployment_name,    # e.g., text-embedding-3-deployment
    input="..."
)
```

### Configuration Settings

**Standard OpenAI:**
```
Settings needed:
- OPENAI_API_KEY
```

**Azure OpenAI v1.0 (Shared - Deprecated):**
```
Settings needed:
- AZURE_OPENAI_API_KEY
- AZURE_OPENAI_ENDPOINT                [DEPRECATED]
- AZURE_OPENAI_API_VERSION             [DEPRECATED]
- AZURE_OPENAI_CHAT_DEPLOYMENT
- AZURE_OPENAI_EMBEDDING_DEPLOYMENT
```

**Azure OpenAI v2.0 (Separated - Current):**
```
Settings needed:
- AZURE_OPENAI_API_KEY

Chat-specific:
- AZURE_OPENAI_CHAT_ENDPOINT
- AZURE_OPENAI_CHAT_API_VERSION
- AZURE_OPENAI_CHAT_DEPLOYMENT

Embedding-specific:
- AZURE_OPENAI_EMBEDDING_ENDPOINT
- AZURE_OPENAI_EMBEDDING_API_VERSION
- AZURE_OPENAI_EMBEDDING_DEPLOYMENT
```

---

## Testing Your Configuration

### Test Chat Functionality

1. Navigate to Archon Dashboard → Knowledge Base
2. Try asking a question in the chat interface
3. If configured correctly:
   - Response should be generated using your Azure chat deployment
   - Check Archon logs for confirmation:
     ```bash
     docker logs archon-server --tail 50 | grep -i "azure\|provider\|chat"
     ```
   - Expected log: `Azure OpenAI chat client created successfully with endpoint: https://...`

### Test Embedding Functionality

1. Navigate to Archon Dashboard → Sources
2. Try crawling a documentation source
3. Monitor progress:
   - Embeddings should be generated using your Azure embedding deployment
   - Check embedding count increases after crawl completes
4. Check logs:
   ```bash
   docker logs archon-server --tail 100 | grep -i "embedding\|azure"
   ```
   - Expected log: `Azure OpenAI embedding client created successfully with endpoint: https://...`

### Verify Separated Configuration

1. Check that chat and embedding use different endpoints (if configured):
   ```bash
   docker exec -i supabase-ai-db psql -U postgres -d postgres -c \
     "SELECT key, value FROM archon_settings WHERE key IN (
       'AZURE_OPENAI_CHAT_ENDPOINT',
       'AZURE_OPENAI_EMBEDDING_ENDPOINT'
     );"
   ```

2. Expected output showing different endpoints:
   ```
                       key                 |                value
   ------------------------------------------+--------------------------------------
    AZURE_OPENAI_CHAT_ENDPOINT              | https://my-chat.openai.azure.com
    AZURE_OPENAI_EMBEDDING_ENDPOINT         | https://my-embed.openai.azure.com
   ```

### Verify with API Test

Test via Archon's REST API:

```bash
# Test provider configuration
curl -X GET http://localhost:8181/api/rag/settings \
  -H "Content-Type: application/json"

# Should return separated configuration
```

---

## Troubleshooting

### Issue: Azure OpenAI Button Not Visible

**Symptoms:**
- Azure OpenAI provider button missing from provider selection
- Only 6 provider buttons visible (OpenAI, Google, OpenRouter, Ollama, Anthropic, Grok)

**Causes:**
- Frontend not rebuilt after code changes
- Browser cache showing old version

**Solutions:**

1. **Rebuild Frontend:**
   ```bash
   cd /home/ljutzkanov/Documents/Projects/archon/archon-ui-main

   # Stop the UI container
   docker stop archon-ui

   # Rebuild the container
   docker compose up -d --build archon-ui

   # Or restart with fresh build
   docker compose down
   docker compose up -d --build
   ```

2. **Clear Browser Cache:**
   - Hard refresh: `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely
   - Try incognito/private window

3. **Check Frontend Logs:**
   ```bash
   docker logs archon-ui --tail 50
   ```
   Look for build errors or TypeScript compilation errors

### Issue: "API Key Not Configured" Error

**Symptoms:**
- Provider status shows red (❌)
- Error message: "Azure OpenAI API key not configured"

**Solutions:**

1. Verify API key is set:
   ```bash
   docker exec -i supabase-ai-db psql -U postgres -d postgres -c \
     "SELECT key, is_encrypted FROM archon_settings WHERE key = 'AZURE_OPENAI_API_KEY';"
   ```

2. If missing, add via UI:
   - Settings → API Keys → Add Credential
   - Key Name: `AZURE_OPENAI_API_KEY`
   - Value: Your Azure API key
   - Save

3. Restart Archon services:
   ```bash
   docker restart archon-server archon-mcp
   ```

### Issue: "Deployment Not Found" Error

**Symptoms:**
- Error: "The API deployment for this resource does not exist"
- 404 errors in logs

**Causes:**
- Deployment name doesn't match what's in Azure Portal
- Typo in deployment name
- Deployment not created in Azure
- Wrong endpoint URL (chat deployment on embedding endpoint or vice versa)

**Solutions:**

1. Verify deployment names in Azure Portal:
   - Go to Azure Portal → Your Resource → Model deployments
   - Copy EXACT deployment names (case-sensitive)

2. Ensure correct endpoint/deployment pairing:
   - Chat deployment must exist on chat endpoint resource
   - Embedding deployment must exist on embedding endpoint resource

3. Update Archon configuration:
   - Settings → RAG Settings
   - Select Chat or Embeddings
   - Click Azure Config
   - Paste exact deployment name
   - Save Settings

4. Check deployment exists:
   ```bash
   # List deployments via Azure CLI
   az cognitiveservices account deployment list \
     --name your-resource-name \
     --resource-group your-resource-group
   ```

### Issue: Configurations Overwriting Each Other

**Symptoms (v1.0 only):**
- Setting chat endpoint changes embedding endpoint
- Shared configuration causing conflicts

**Solution:**
**Upgrade to v2.0** which has fully separated configurations:
```bash
docker exec -i supabase-ai-db psql -U postgres -d postgres < migration/separate_azure_openai_configs.sql
```

After migration, configure chat and embedding independently as described above.

### Issue: "Invalid API Version" Error

**Symptoms:**
- Error: "Unsupported API version"
- 400 Bad Request errors

**Solution:**

Use supported API version (as of December 2025):
- **Recommended**: `2024-02-01`
- Also supported: `2023-12-01`, `2023-05-15`

Update in Settings → RAG Settings → Select provider → Azure Config → API Version

### Issue: Rate Limit Errors

**Symptoms:**
- Error: "Rate limit exceeded"
- 429 status codes in logs

**Solutions:**

1. Check your deployment rate limits in Azure Portal
2. Increase TPM (Tokens Per Minute) for your deployment:
   - Azure Portal → Model deployments → Edit deployment
   - Increase "Tokens per Minute Rate Limit"
3. If using separate resources, allocate TPM appropriately:
   - Chat deployments typically need higher TPM
   - Embedding deployments can use lower TPM
4. Reduce concurrent requests in Archon:
   - Settings → RAG Settings → Crawling Settings
   - Reduce "Max Concurrent Requests"
   - Reduce "Batch Size"

### Issue: Connection Timeout

**Symptoms:**
- Timeout errors
- No response from Azure API

**Solutions:**

1. Verify endpoint URLs are correct:
   - Must start with `https://`
   - Must end with `.openai.azure.com`
   - No trailing slash
   - Chat and embedding endpoints can be different

2. Check network connectivity:
   ```bash
   curl -v https://your-chat-resource.openai.azure.com/
   curl -v https://your-embedding-resource.openai.azure.com/
   ```

3. Verify firewall rules in Azure:
   - Azure Portal → Your Resource → Networking
   - Ensure Archon server IP is allowed (for both resources if using separate)

---

## API Reference

### Database Schema (v2.0)

**Table:** `archon_settings`

```sql
-- Azure OpenAI configuration settings (v2.0)
key                                  | type    | required | encrypted | default
-------------------------------------|---------|----------|-----------|------------
AZURE_OPENAI_API_KEY                 | string  | yes      | yes       | NULL
-- Chat-specific configuration
AZURE_OPENAI_CHAT_ENDPOINT           | string  | yes*     | no        | NULL
AZURE_OPENAI_CHAT_API_VERSION        | string  | no       | no        | 2024-02-01
AZURE_OPENAI_CHAT_DEPLOYMENT         | string  | yes*     | no        | NULL
-- Embedding-specific configuration
AZURE_OPENAI_EMBEDDING_ENDPOINT      | string  | yes**    | no        | NULL
AZURE_OPENAI_EMBEDDING_API_VERSION   | string  | no       | no        | 2024-02-01
AZURE_OPENAI_EMBEDDING_DEPLOYMENT    | string  | yes**    | no        | NULL
-- Deprecated (kept for rollback)
AZURE_OPENAI_ENDPOINT                | string  | no       | no        | NULL [DEPRECATED]
AZURE_OPENAI_API_VERSION             | string  | no       | no        | NULL [DEPRECATED]

* Required when using Azure OpenAI as chat provider
** Required when using Azure OpenAI as embedding provider
```

### Backend Code References

**File:** `python/src/server/services/credential_service.py`

```python
# New separated credential methods (v2.0)

async def get_azure_chat_endpoint(self) -> str:
    """Get Azure OpenAI endpoint URL for chat/LLM."""
    rag_settings = await self.get_credentials_by_category("rag_strategy")
    endpoint = rag_settings.get("AZURE_OPENAI_CHAT_ENDPOINT")
    if not endpoint:
        raise ValueError(
            "AZURE_OPENAI_CHAT_ENDPOINT not configured. Set this in Settings UI"
        )
    return endpoint.strip()

async def get_azure_chat_api_version(self) -> str:
    """Get Azure OpenAI API version for chat/LLM."""
    rag_settings = await self.get_credentials_by_category("rag_strategy")
    return rag_settings.get("AZURE_OPENAI_CHAT_API_VERSION", "2024-02-01")

async def get_azure_chat_deployment(self) -> str:
    """Get Azure OpenAI deployment name for chat/LLM."""
    rag_settings = await self.get_credentials_by_category("rag_strategy")
    deployment = rag_settings.get("AZURE_OPENAI_CHAT_DEPLOYMENT")
    if not deployment:
        raise ValueError(
            "AZURE_OPENAI_CHAT_DEPLOYMENT not configured. Set this in Settings UI"
        )
    return deployment.strip()

# Similar methods for embeddings:
# - get_azure_embedding_endpoint()
# - get_azure_embedding_api_version()
# - get_azure_embedding_deployment()
```

**File:** `python/src/server/services/llm_provider_service.py`

```python
# Context-aware Azure client creation (v2.0)
elif provider_name == "azure-openai":
    if not api_key:
        raise ValueError("Azure OpenAI API key not found")

    # Get Azure-specific configuration based on whether this is for embeddings or chat
    if use_embedding_provider:
        # Use embedding-specific Azure configuration
        azure_endpoint = await credential_service.get_azure_embedding_endpoint()
        azure_api_version = await credential_service.get_azure_embedding_api_version()
        config_type = "embedding"
    else:
        # Use chat-specific Azure configuration
        azure_endpoint = await credential_service.get_azure_chat_endpoint()
        azure_api_version = await credential_service.get_azure_chat_api_version()
        config_type = "chat"

    client = AsyncAzureOpenAI(
        api_key=api_key,
        azure_endpoint=azure_endpoint,
        api_version=azure_api_version,
    )
    logger.info(
        f"Azure OpenAI {config_type} client created successfully"
    )
```

### Frontend Code References

**File:** `archon-ui-main/src/components/settings/RAGSettings.tsx`

```typescript
// Provider type definition includes azure-openai
type ProviderKey = 'openai' | 'azure-openai' | 'google' | 'ollama' | 'anthropic' | 'grok' | 'openrouter';

// Separated Azure configuration interface (v2.0)
interface RAGSettingsProps {
  // ... other settings

  // Azure OpenAI Chat Configuration (separate from embeddings)
  AZURE_OPENAI_CHAT_ENDPOINT?: string;
  AZURE_OPENAI_CHAT_API_VERSION?: string;
  AZURE_OPENAI_CHAT_DEPLOYMENT?: string;

  // Azure OpenAI Embedding Configuration (separate from chat)
  AZURE_OPENAI_EMBEDDING_ENDPOINT?: string;
  AZURE_OPENAI_EMBEDDING_API_VERSION?: string;
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT?: string;
}

// Context-aware provider status validation (v2.0)
case 'azure-openai':
  const hasAzureKey = hasApiCredential('AZURE_OPENAI_API_KEY');

  // Context-aware validation based on activeSelection
  if (activeSelection === 'chat') {
    // Validate chat-specific Azure configuration
    const hasChatEndpoint = Boolean(ragSettings.AZURE_OPENAI_CHAT_ENDPOINT?.trim());
    const hasChatDeployment = Boolean(ragSettings.AZURE_OPENAI_CHAT_DEPLOYMENT?.trim());

    if (!hasAzureKey || !hasChatEndpoint) return 'missing';
    if (!hasChatDeployment) return 'partial';
    // ... connection status check
  } else {
    // Validate embedding-specific Azure configuration
    const hasEmbeddingEndpoint = Boolean(ragSettings.AZURE_OPENAI_EMBEDDING_ENDPOINT?.trim());
    const hasEmbeddingDeployment = Boolean(ragSettings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT?.trim());

    if (!hasAzureKey || !hasEmbeddingEndpoint) return 'missing';
    if (!hasEmbeddingDeployment) return 'partial';
    // ... connection status check
  }

// Context-aware Azure Config panel rendering (v2.0)
{activeSelection === 'chat' ? (
  <>
    {/* Chat-Specific Azure Configuration */}
    <Input
      value={ragSettings.AZURE_OPENAI_CHAT_ENDPOINT || ''}
      onChange={(e) => setRagSettings({
        ...ragSettings,
        AZURE_OPENAI_CHAT_ENDPOINT: e.target.value
      })}
      placeholder="https://your-chat-resource.openai.azure.com"
    />
    {/* ... chat API version and deployment fields */}
  </>
) : (
  <>
    {/* Embedding-Specific Azure Configuration */}
    <Input
      value={ragSettings.AZURE_OPENAI_EMBEDDING_ENDPOINT || ''}
      onChange={(e) => setRagSettings({
        ...ragSettings,
        AZURE_OPENAI_EMBEDDING_ENDPOINT: e.target.value
      })}
      placeholder="https://your-embedding-resource.openai.azure.com"
    />
    {/* ... embedding API version and deployment fields */}
  </>
)}
```

### REST API Endpoints

**Get RAG Settings (v2.0):**
```bash
GET http://localhost:8181/api/rag/settings

Response:
{
  "LLM_PROVIDER": "azure-openai",
  "EMBEDDING_PROVIDER": "azure-openai",
  "AZURE_OPENAI_CHAT_ENDPOINT": "https://my-chat.openai.azure.com",
  "AZURE_OPENAI_CHAT_API_VERSION": "2024-02-01",
  "AZURE_OPENAI_CHAT_DEPLOYMENT": "gpt-4o-deployment",
  "AZURE_OPENAI_EMBEDDING_ENDPOINT": "https://my-embed.openai.azure.com",
  "AZURE_OPENAI_EMBEDDING_API_VERSION": "2024-02-01",
  "AZURE_OPENAI_EMBEDDING_DEPLOYMENT": "text-embedding-3-deployment"
}
```

**Update RAG Settings (v2.0):**
```bash
POST http://localhost:8181/api/rag/settings
Content-Type: application/json

{
  "LLM_PROVIDER": "azure-openai",
  "EMBEDDING_PROVIDER": "azure-openai",
  "AZURE_OPENAI_CHAT_ENDPOINT": "https://my-chat.openai.azure.com",
  "AZURE_OPENAI_CHAT_API_VERSION": "2024-02-01",
  "AZURE_OPENAI_CHAT_DEPLOYMENT": "my-chat-deployment",
  "AZURE_OPENAI_EMBEDDING_ENDPOINT": "https://my-embed.openai.azure.com",
  "AZURE_OPENAI_EMBEDDING_API_VERSION": "2024-02-01",
  "AZURE_OPENAI_EMBEDDING_DEPLOYMENT": "my-embedding-deployment"
}
```

---

## Migration Scripts

### Initial Azure OpenAI Support (v1.0)

**Location:** `/home/ljutzkanov/Documents/Projects/archon/migration/add_azure_openai_support.sql`

**Purpose:** Adds basic Azure OpenAI support with shared endpoint configuration

### Separated Chat/Embedding Configs (v2.0)

**Location:** `/home/ljutzkanov/Documents/Projects/archon/migration/separate_azure_openai_configs.sql`

**Purpose:** Separates Azure OpenAI configuration into independent chat and embedding settings

**Key Changes:**
- Creates 6 new separated settings (3 for chat, 3 for embeddings)
- Migrates existing shared settings to both new endpoints
- Marks old shared settings as [DEPRECATED]
- Maintains backward compatibility

**Run Migration:**
```bash
docker exec -i supabase-ai-db psql -U postgres -d postgres < migration/separate_azure_openai_configs.sql
```

---

## Best Practices

### Security

1. **Never commit API keys** to version control
2. **Rotate keys regularly** in Azure Portal
3. **Use separate deployments** for dev/staging/prod
4. **Monitor usage** via Azure Portal metrics
5. **Set rate limits** on deployments to prevent overuse

### Performance

1. **Choose appropriate regions** - select Azure region closest to your Archon deployment
2. **Configure rate limits** - balance between performance and cost
3. **Use separate resources** for chat and embeddings in production for independent scaling
4. **Monitor latency** - check Azure metrics for response times

### Cost Optimization

1. **Use appropriate models** - don't use GPT-4 where GPT-3.5 would suffice
2. **Set token limits** - configure max tokens per request
3. **Monitor usage** - check Azure Cost Management regularly
4. **Use quotas** - set deployment-level quotas to prevent runaway costs
5. **Separate resources** - allocate budget independently for chat vs embeddings

### Resource Architecture

**For Production:**
```
Architecture: Separate Resources
├── Chat Resource
│   ├── Endpoint: https://prod-chat.openai.azure.com
│   ├── Region: East US (near users)
│   ├── Deployment: gpt-4o-prod (high TPM limit)
│   └── Quota: $1000/month
└── Embedding Resource
    ├── Endpoint: https://prod-embed.openai.azure.com
    ├── Region: West Europe (near document storage)
    ├── Deployment: text-embedding-3-large (moderate TPM)
    └── Quota: $500/month
```

**For Development:**
```
Architecture: Single Resource
├── Resource: dev-archon.openai.azure.com
├── Chat Deployment: gpt-35-turbo-dev
├── Embedding Deployment: text-embedding-ada-002-dev
└── Quota: $100/month
```

---

## Additional Resources

### Azure Documentation

- [Azure OpenAI Service Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Azure OpenAI API Reference](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference)
- [Azure OpenAI Quotas and Limits](https://learn.microsoft.com/en-us/azure/ai-services/openai/quotas-limits)
- [Azure AI Foundry Model Catalog](https://learn.microsoft.com/en-us/azure/ai-studio/how-to/model-catalog)

### Archon Documentation

- [Main Configuration Guide](./configuration.md)
- [LLM Provider Guide](./llm_providers.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Architecture Documentation](./ARCHITECTURE.md)

### Support

For issues specific to:
- **Azure OpenAI Service**: Open support ticket in Azure Portal
- **Archon Integration**: Open issue on [Archon GitHub](https://github.com/coleam00/archon)

---

## Changelog

### Version 2.0.0 (December 12, 2025)

**Major Changes:**
- **Separated Configuration Architecture**: Chat and embedding providers now have independent configuration
- **6 New Database Settings**: 3 for chat (endpoint, API version, deployment), 3 for embeddings
- **Context-Aware UI**: Configuration interface automatically shows relevant fields based on selection
- **Backend Service Updates**: 6 new credential service methods for separated configs
- **Independent Scaling**: Different Azure resources, endpoints, and rate limits for chat vs embeddings
- **Backward Compatible Migration**: Automatic migration of existing shared configurations

**Deprecated:**
- `AZURE_OPENAI_ENDPOINT` (replaced by separated chat/embedding endpoints)
- `AZURE_OPENAI_API_VERSION` (replaced by separated chat/embedding API versions)

**Files Modified:**
- `migration/separate_azure_openai_configs.sql` - Database migration
- `python/src/server/services/credential_service.py` - 6 new methods
- `python/src/server/services/llm_provider_service.py` - Context-aware client creation
- `archon-ui-main/src/components/settings/RAGSettings.tsx` - Context-aware UI

### Version 1.0.0 (December 12, 2025)

**Initial Release:**
- Initial Azure OpenAI integration
- Added 5 configuration settings (shared architecture)
- Implemented `AsyncAzureOpenAI` client support
- Added deployment name resolution
- Created frontend UI for Azure configuration
- Added provider validation logic

---

**Document End**
