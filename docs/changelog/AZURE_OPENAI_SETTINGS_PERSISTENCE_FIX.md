# Azure OpenAI Settings Persistence and Recrawl Fix

**Document Version:** 1.0.0
**Last Updated:** December 15, 2025
**Author:** Archon Development Team
**Related:** `azure_openai_configuration.md` (Configuration Guide)

---

## Overview

This document details two critical fixes implemented for Azure OpenAI integration:

1. **Settings Persistence Issue**: Azure configuration fields (endpoints, API versions, deployments) were not persisting across page reloads
2. **Recrawl Validation Error**: Knowledge item refresh/recrawl failed with "Invalid provider name" error for Azure OpenAI

Both issues have been resolved and tested successfully.

---

## Table of Contents

1. [Issue 1: Settings Persistence](#issue-1-settings-persistence)
   - [Problem Description](#problem-description)
   - [Root Cause Analysis](#root-cause-analysis)
   - [Solution Implemented](#solution-implemented)
   - [Testing Guide](#testing-guide-settings-persistence)
2. [Issue 2: Recrawl Validation](#issue-2-recrawl-validation)
   - [Problem Description](#problem-description-1)
   - [Root Cause Analysis](#root-cause-analysis-1)
   - [Solution Implemented](#solution-implemented-1)
   - [Testing Guide](#testing-guide-recrawl)
3. [Technical Deep Dive](#technical-deep-dive)
4. [Prevention Guidelines](#prevention-guidelines)

---

## Issue 1: Settings Persistence

### Problem Description

**Symptoms:**
- Azure API keys were persisting correctly ✅
- Azure configuration fields NOT persisting ❌:
  - Chat Endpoint URL
  - Chat API Version
  - Chat Deployment Name
  - Embedding Endpoint URL
  - Embedding API Version
  - Embedding Deployment Name
- Settings would save successfully (toast message shown)
- After page reload, all Azure config fields would be empty
- User would need to re-enter configuration every session

**User Impact:**
- Frustrating user experience requiring repeated configuration
- Unable to use Azure OpenAI reliably
- Settings appeared to save but didn't actually persist

### Root Cause Analysis

#### The Three-Part Persistence System

Archon's settings persistence relies on three interconnected parts:

1. **TypeScript Interface** (`RagSettings` interface)
   - Defines the types for all settings
   - Located in: `credentialsService.ts` lines 27-34

2. **String Whitelist** (loading filter)
   - Determines which database values can be loaded
   - Located in: `credentialsService.ts` lines 247-254

3. **Default Object** (initialization)
   - Provides initial values for all settings
   - Located in: `credentialsService.ts` lines 200-230
   - **CRITICAL**: Used by the `if (cred.key in settings)` check at line 234

#### The Bug

Azure OpenAI fields were present in parts 1 and 2, but **missing from part 3**:

```typescript
// ✅ Part 1: Interface (HAD Azure fields)
export interface RagSettings {
  AZURE_OPENAI_CHAT_ENDPOINT?: string;
  AZURE_OPENAI_CHAT_API_VERSION?: string;
  AZURE_OPENAI_CHAT_DEPLOYMENT?: string;
  // ... other Azure fields
}

// ✅ Part 2: String Whitelist (HAD Azure fields)
if ([
  "MODEL_CHOICE",
  "LLM_PROVIDER",
  "AZURE_OPENAI_CHAT_ENDPOINT",
  "AZURE_OPENAI_CHAT_API_VERSION",
  // ...
].includes(cred.key)) {
  (settings as any)[cred.key] = cred.value || "";
}

// ❌ Part 3: Default Object (MISSING Azure fields)
const settings: RagSettings = {
  USE_CONTEXTUAL_EMBEDDINGS: false,
  EMBEDDING_MODEL: "",
  // Azure fields were NOT here! ❌
  CRAWL_BATCH_SIZE: 50,
  // ...
};
```

#### The Critical Check

At line 234 of `credentialsService.ts`:

```typescript
// This check determines if a credential should be loaded
if (cred.key in settings) {
  // Load credential into settings object
}
```

**How it failed:**
1. User saves Azure config → Database stores correctly ✅
2. Page reloads → `getRagSettings()` runs
3. Loop iterates through database credentials
4. Check `"AZURE_OPENAI_CHAT_ENDPOINT" in settings` → **FALSE** ❌
   - Because default object didn't have this key
5. Azure field skipped, not loaded into settings
6. User sees empty Azure configuration

### Solution Implemented

**File:** `archon-ui-main/src/services/credentialsService.ts`
**Lines:** 214-220

Added all 6 Azure OpenAI configuration fields to the default object:

```typescript
const settings: RagSettings = {
  USE_CONTEXTUAL_EMBEDDINGS: false,
  // ... other defaults ...
  EMBEDDING_MODEL: "",

  // ✅ FIX: Added Azure OpenAI Configuration defaults
  AZURE_OPENAI_CHAT_ENDPOINT: "",
  AZURE_OPENAI_CHAT_API_VERSION: "",
  AZURE_OPENAI_CHAT_DEPLOYMENT: "",
  AZURE_OPENAI_EMBEDDING_ENDPOINT: "",
  AZURE_OPENAI_EMBEDDING_API_VERSION: "",
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT: "",

  // Crawling Performance Settings defaults
  CRAWL_BATCH_SIZE: 50,
  // ...
};
```

**Why this works:**
- Now `"AZURE_OPENAI_CHAT_ENDPOINT" in settings` → **TRUE** ✅
- The `if (cred.key in settings)` check at line 234 passes
- Azure fields are loaded from database correctly
- Settings persist across page reloads

### Testing Guide: Settings Persistence

#### Prerequisites
- Archon services running
- Azure OpenAI API key configured
- Browser with developer console access

#### Test Procedure

**Step 1: Clear Existing Azure Configuration**

```bash
# Connect to database
docker exec -i supabase-ai-db psql -U postgres -d postgres

# Delete existing Azure config (optional, for clean test)
DELETE FROM archon_settings
WHERE key IN (
  'AZURE_OPENAI_CHAT_ENDPOINT',
  'AZURE_OPENAI_CHAT_API_VERSION',
  'AZURE_OPENAI_CHAT_DEPLOYMENT',
  'AZURE_OPENAI_EMBEDDING_ENDPOINT',
  'AZURE_OPENAI_EMBEDDING_API_VERSION',
  'AZURE_OPENAI_EMBEDDING_DEPLOYMENT'
);
```

**Step 2: Configure Azure OpenAI via UI**

1. Open Archon Dashboard: `http://localhost:3737`
2. Navigate to **Settings** → **RAG Settings**
3. Under **LLM Provider Settings**, select:
   - **Chat: azure-openai**
   - **Embeddings: azure-openai**
4. Click the **Azure Config** button (teal/cyan colored)
5. Configure chat settings:
   - Chat Endpoint: `https://your-chat-resource.openai.azure.com`
   - Chat API Version: `2024-02-01`
   - Chat Deployment: `your-gpt-4o-deployment`
6. Switch to embedding tab and configure:
   - Embedding Endpoint: `https://your-embedding-resource.openai.azure.com`
   - Embedding API Version: `2024-02-01`
   - Embedding Deployment: `your-text-embedding-3-deployment`
7. Click **Save Settings**
8. Verify toast message: "RAG settings saved successfully"

**Step 3: Verify Database Storage**

```bash
docker exec -i supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT key, value FROM archon_settings
   WHERE key LIKE 'AZURE_OPENAI_%'
   ORDER BY key;"
```

**Expected Output:**
```
                       key                 |                value
-------------------------------------------+--------------------------------------
 AZURE_OPENAI_CHAT_API_VERSION            | 2024-02-01
 AZURE_OPENAI_CHAT_DEPLOYMENT             | your-gpt-4o-deployment
 AZURE_OPENAI_CHAT_ENDPOINT               | https://your-chat-resource.openai.azure.com
 AZURE_OPENAI_EMBEDDING_API_VERSION       | 2024-02-01
 AZURE_OPENAI_EMBEDDING_DEPLOYMENT        | your-text-embedding-3-deployment
 AZURE_OPENAI_EMBEDDING_ENDPOINT          | https://your-embedding-resource.openai.azure.com
(6 rows)
```

All 6 fields should be present with your values.

**Step 4: Test Persistence (Hard Reload)**

1. Open browser console (F12)
2. Navigate to Console tab
3. Hard reload: `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac)
4. Watch console for load messages:

**Expected Console Output:**
```
📥 [loadProviderApiKeys] Loading provider API keys...
📥 [loadProviderApiKeys] AZURE_OPENAI_CHAT_API_KEY -> azure-openai-chat: [CONFIGURED]
📥 [loadProviderApiKeys] AZURE_OPENAI_EMBEDDING_API_KEY -> azure-openai-embedding: [CONFIGURED]
✅ [loadProviderApiKeys] Provider API keys loaded successfully
```

5. Verify Azure configuration fields are still populated:
   - Chat Endpoint should show your URL
   - Chat API Version should show `2024-02-01`
   - Chat Deployment should show your deployment name
   - Switch to embeddings tab and verify embedding fields

**Step 5: Test Full Browser Restart**

1. Close browser completely
2. Reopen browser
3. Navigate to `http://localhost:3737/settings`
4. Check Azure configuration fields again
5. All 6 fields should still be populated ✅

#### Success Criteria

- ✅ All 6 Azure config fields save to database
- ✅ Console shows successful load of Azure credentials
- ✅ Fields remain populated after hard reload
- ✅ Fields remain populated after browser restart
- ✅ No need to re-enter configuration between sessions
- ✅ Provider status indicators show green (✅) or yellow (⚠️), not red (❌)

#### Troubleshooting

**Fields still empty after reload:**
1. Check browser console for errors
2. Verify database values: `SELECT key, value FROM archon_settings WHERE key LIKE 'AZURE_OPENAI_%';`
3. Ensure archon-ui container was restarted after fix
4. Clear browser cache completely

**Console shows errors:**
1. Check for TypeScript errors: `npx tsc --noEmit`
2. Restart archon-ui: `docker restart archon-ui`
3. Check container logs: `docker logs archon-ui --tail 50`

---

## Issue 2: Recrawl Validation

### Problem Description

**Symptoms:**
- User configured Azure OpenAI as embedding provider ✅
- Knowledge items were created successfully ✅
- Attempting to refresh/recrawl existing knowledge items failed ❌
- Error in UI: "Invalid provider name"
- HTTP 400 Bad Request from API
- Console error: `APIServiceError: Invalid provider name`

**User Impact:**
- Unable to refresh existing knowledge items with Azure OpenAI
- Forced to delete and re-crawl instead of updating
- Inconsistent experience (initial crawl works, refresh doesn't)

**Error Details:**
```
POST http://localhost:8181/api/knowledge-items/{id}/refresh
Status: 400 Bad Request
Response: {
  "error": "Invalid provider name",
  "message": "Provider 'azure-openai' not supported",
  "error_type": "validation_error"
}
```

### Root Cause Analysis

#### Provider Validation Architecture

When a knowledge item is refreshed, the backend:

1. Retrieves the knowledge item from database
2. Gets the stored `embedding_provider` value (e.g., "azure-openai")
3. **Validates** the provider against a hardcoded whitelist
4. Proceeds with embedding generation

**The Bug Location:** `python/src/server/api_routes/knowledge_api.py` line 72

```python
# BEFORE (missing azure-openai):
allowed_providers = {
    "openai",
    "ollama",
    "google",
    "openrouter",
    "anthropic",
    "grok"
}

if provider not in allowed_providers:
    raise HTTPException(
        status_code=400,
        detail={
            "error": "Invalid provider name",
            "message": f"Provider '{provider}' not supported",
            "error_type": "validation_error"
        }
    )
```

#### Why It Happened

**Azure OpenAI was fully supported everywhere except the validation list:**

✅ **Credential Service** (`credential_service.py`):
- `_get_provider_api_key()` method handles "azure-openai"
- Separate chat/embedding key resolution works
- `get_azure_embedding_endpoint()` method exists

✅ **Embedding Service** (`embedding_service.py`):
- Creates Azure OpenAI embedding client correctly
- Handles deployment name resolution
- Generates embeddings successfully

✅ **LLM Provider Service** (`llm_provider_service.py`):
- Creates `AsyncAzureOpenAI` client for embeddings
- Uses correct endpoint and API version
- Supports separated chat/embedding configurations

❌ **Knowledge API Validation** (`knowledge_api.py:72`):
- Hardcoded validation list missing "azure-openai"
- This was the ONLY place it wasn't supported

**The Sequence of Events:**

1. User creates knowledge item with Azure OpenAI → ✅ Works
   - Initial crawl bypasses this validation (different code path)
2. Database stores: `embedding_provider = "azure-openai"` → ✅ Stored
3. User clicks refresh → Retrieves `provider = "azure-openai"` from DB
4. Validation check: `"azure-openai" in allowed_providers` → **FALSE** ❌
5. Raises HTTPException → 400 Bad Request → User sees error

### Solution Implemented

**File:** `python/src/server/api_routes/knowledge_api.py`
**Line:** 72

Added "azure-openai" to the allowed_providers validation set:

```python
# AFTER (includes azure-openai):
allowed_providers = {
    "openai",
    "ollama",
    "google",
    "openrouter",
    "anthropic",
    "grok",
    "azure-openai"  # ✅ FIX: Added Azure OpenAI support
}

if provider not in allowed_providers:
    raise HTTPException(
        status_code=400,
        detail={
            "error": "Invalid provider name",
            "message": f"Provider '{provider}' not supported",
            "error_type": "validation_error"
        }
    )
```

**Why this works:**
- Now `"azure-openai" in allowed_providers` → **TRUE** ✅
- Validation passes
- Refresh proceeds to embedding generation
- Azure embedding service creates client correctly
- Knowledge item refreshes successfully

### Testing Guide: Recrawl

#### Prerequisites
- Archon services running with fix applied
- Azure OpenAI configured as embedding provider
- At least one knowledge source created with Azure OpenAI

#### Test Procedure

**Step 1: Create Knowledge Source with Azure OpenAI**

1. Navigate to Archon Dashboard → **Sources**
2. Click **Add Source**
3. Configure:
   - Source Type: **Website**
   - URL: `https://docs.python.org/3/tutorial/` (or any documentation site)
   - Name: "Test Azure Embedding Recrawl"
4. Under **Embedding Settings**, ensure:
   - Provider: **azure-openai**
   - Azure endpoint, API version, deployment are configured
5. Click **Start Crawl**
6. Wait for initial crawl to complete (status: ✅ Completed)

**Step 2: Verify Initial Crawl Success**

```bash
# Check knowledge items were created
docker exec -i supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT id, title, embedding_provider, status
   FROM sources
   WHERE name = 'Test Azure Embedding Recrawl';"
```

**Expected Output:**
```
                  id                  |          title           | embedding_provider | status
--------------------------------------+--------------------------+--------------------+----------
 550e8400-e29b-41d4-a716-446655440000 | Test Azure Embedding...  | azure-openai       | completed
```

**Step 3: Test Refresh/Recrawl**

1. In Sources list, locate "Test Azure Embedding Recrawl"
2. Click the **Refresh** button (↻ icon)
3. **CRITICAL**: Open browser console (F12) to monitor request

**Expected Console Output:**
```
POST http://localhost:8181/api/knowledge-items/{id}/refresh
Status: 200 OK
Response: {
  "success": true,
  "message": "Knowledge item refresh started"
}
```

4. Monitor crawl progress:
   - Status should change to "Crawling..."
   - Page count should increase
   - Chunk count should increase
   - Status eventually returns to "✅ Completed"

**Step 4: Verify Recrawl Completed Successfully**

```bash
# Check crawl status and chunk count
docker exec -i supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT s.id, s.name, s.status,
          COUNT(d.id) as chunk_count
   FROM sources s
   LEFT JOIN documents d ON s.id = d.source_id
   WHERE s.name = 'Test Azure Embedding Recrawl'
   GROUP BY s.id, s.name, s.status;"
```

**Expected Output:**
```
                  id                  |          name            | status    | chunk_count
--------------------------------------+--------------------------+-----------+-------------
 550e8400-e29b-41d4-a716-446655440000 | Test Azure Embedding...  | completed | 150
                                                                              (or similar count > 0)
```

**Step 5: Verify Embeddings Generated**

```bash
# Check that documents have embeddings
docker exec -i supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) as docs_with_embeddings
   FROM documents
   WHERE source_id = (
     SELECT id FROM sources WHERE name = 'Test Azure Embedding Recrawl'
   )
   AND embedding IS NOT NULL;"
```

**Expected Output:**
```
 docs_with_embeddings
----------------------
                  150
```

Should match chunk_count from Step 4.

**Step 6: Test Backend Logs**

```bash
docker logs archon-server --tail 100 | grep -i "azure\|embedding\|refresh"
```

**Expected Log Patterns:**
```
INFO - Azure OpenAI embedding client created successfully with endpoint: https://your-embedding-resource.openai.azure.com
INFO - Starting knowledge item refresh for source: {source_id}
INFO - Generated embedding for chunk {chunk_id} using azure-openai
INFO - Refresh completed successfully for source: {source_id}
```

**No errors** related to "Invalid provider name"

#### Success Criteria

- ✅ Refresh button triggers crawl without errors
- ✅ Console shows 200 OK response (not 400 Bad Request)
- ✅ No "Invalid provider name" error in UI or logs
- ✅ Crawl status updates correctly (Crawling → Completed)
- ✅ Chunk count increases or refreshes
- ✅ Documents have embeddings (`embedding IS NOT NULL`)
- ✅ Backend logs show successful Azure embedding client creation
- ✅ No HTTPException errors in archon-server logs

#### Troubleshooting

**Still getting "Invalid provider name" error:**
1. Verify fix was applied:
   ```bash
   docker exec -i archon-server cat /app/src/server/api_routes/knowledge_api.py | grep -A 2 "allowed_providers"
   ```
   Should show "azure-openai" in the set

2. Restart archon-server:
   ```bash
   docker restart archon-server
   docker logs archon-server --tail 50
   ```

3. Check container was rebuilt with latest code:
   ```bash
   docker compose down
   docker compose up -d --build
   ```

**Refresh starts but fails during crawl:**
1. Check Azure endpoint configuration is correct
2. Verify Azure deployment name exists in Azure Portal
3. Check rate limits in Azure Portal (not exceeded)
4. Review archon-server logs for specific error:
   ```bash
   docker logs archon-server --tail 200 | grep -i "error\|exception"
   ```

---

## Technical Deep Dive

### Settings Persistence Architecture

#### Data Flow Diagram

```
User Configures Settings
        ↓
Frontend (RAGSettings.tsx)
        ↓
handleSaveSettings()
        ↓
POST /api/rag/settings
        ↓
Backend (providers_api.py)
        ↓
save_credential(key, value)
        ↓
Database (archon_settings table)
        ↓ [Page Reload]
        ↓
Frontend (credentialsService.ts)
        ↓
getRagSettings()
        ↓
Loop through credentials:
  ↓
  if (cred.key in settings)  ← ⚠️ CRITICAL CHECK
    ↓ [TRUE = Load]
    settings[cred.key] = cred.value
    ↓
  [FALSE = Skip] ❌
        ↓
Return settings to UI
```

**The Bug**: `AZURE_OPENAI_CHAT_ENDPOINT` was not in the default `settings` object, so the check failed.

**The Fix**: Added all Azure fields to default object, check now passes.

#### Code References

**Frontend:**
- **Interface Definition**: `credentialsService.ts:27-34`
- **Default Object**: `credentialsService.ts:214-220` ← **FIX LOCATION**
- **String Whitelist**: `credentialsService.ts:247-254`
- **Critical Check**: `credentialsService.ts:234`

**Backend:**
- **Save Endpoint**: `providers_api.py` POST `/api/rag/settings`
- **Database Table**: `archon_settings` (category: `rag_strategy`)

### Recrawl Validation Architecture

#### Request Flow Diagram

```
User Clicks Refresh
        ↓
Frontend (KnowledgeBase.tsx)
        ↓
POST /api/knowledge-items/{id}/refresh
        ↓
Backend (knowledge_api.py)
        ↓
Get source from database
        ↓
Extract: provider = source.embedding_provider
        ↓
Validation Check (Line 72):
  if provider not in allowed_providers:  ← ⚠️ CRITICAL CHECK
    ↓ [NOT IN SET]
    raise HTTPException(400, "Invalid provider name") ❌
        ↓ [IN SET]
        ↓
Proceed to embedding generation
        ↓
embedding_service.generate_embeddings()
        ↓
llm_provider_service.create_client(provider="azure-openai")
        ↓
AsyncAzureOpenAI client created ✅
        ↓
Embeddings generated successfully
```

**The Bug**: "azure-openai" was not in the `allowed_providers` set at line 72.

**The Fix**: Added "azure-openai" to the validation set.

#### Code References

**Frontend:**
- **Refresh Trigger**: `KnowledgeBase.tsx` (refresh button click handler)
- **API Call**: `POST /api/knowledge-items/{id}/refresh`

**Backend:**
- **Validation Location**: `knowledge_api.py:72` ← **FIX LOCATION**
- **Embedding Service**: `embedding_service.py`
- **LLM Provider Service**: `llm_provider_service.py`
- **Credential Service**: `credential_service.py`

### Why Both Bugs Occurred

Both bugs share a common pattern: **Hardcoded validation/initialization missing new provider**

**Pattern 1: Frontend Settings Persistence**
- Azure fields added to interface ✅
- Azure fields added to whitelist ✅
- Azure fields **NOT** added to defaults ❌

**Pattern 2: Backend Provider Validation**
- Azure support added to credential service ✅
- Azure support added to embedding service ✅
- Azure support added to LLM provider service ✅
- Azure **NOT** added to validation list ❌

**Root Cause**: Lack of centralized provider configuration

---

## Prevention Guidelines

### For Future Provider Additions

When adding a new LLM provider (e.g., "cohere", "mistral"), ensure ALL of the following are updated:

#### Frontend Checklist

1. **TypeScript Interface** (`credentialsService.ts`):
   - [ ] Add provider-specific fields to `RagSettings` interface
   - [ ] Add separated chat/embedding keys if applicable

2. **Default Object** (`credentialsService.ts`):
   - [ ] Add ALL provider fields to default object with empty string defaults
   - [ ] Verify with: `"PROVIDER_FIELD" in settings` should be TRUE

3. **String Whitelist** (`credentialsService.ts`):
   - [ ] Add ALL provider fields to string whitelist array
   - [ ] Test loading from database works

4. **Provider UI** (`RAGSettings.tsx`):
   - [ ] Add provider to `ProviderKey` type
   - [ ] Add provider button to UI
   - [ ] Add provider-specific configuration panel
   - [ ] Implement context-aware validation

#### Backend Checklist

1. **Validation Lists** (`knowledge_api.py`, others):
   - [ ] Add provider to `allowed_providers` set in knowledge_api.py
   - [ ] Search codebase for other hardcoded provider lists: `git grep "allowed_providers\|provider.*set\|provider.*list"`
   - [ ] Update ALL validation lists found

2. **Credential Service** (`credential_service.py`):
   - [ ] Add provider to `_get_provider_api_key()` mappings
   - [ ] Add provider-specific credential methods if needed
   - [ ] Add fallback for legacy keys

3. **LLM Provider Service** (`llm_provider_service.py`):
   - [ ] Add provider client creation logic
   - [ ] Handle provider-specific configuration
   - [ ] Test client creation works

4. **Embedding Service** (`embedding_service.py`):
   - [ ] Add provider embedding generation logic
   - [ ] Handle provider-specific model names
   - [ ] Test embedding generation works

#### Database Checklist

1. **Migrations**:
   - [ ] Create migration SQL file
   - [ ] Add provider-specific settings to `archon_settings` table
   - [ ] Test migration runs without errors

2. **Verification**:
   - [ ] Verify settings exist: `SELECT key FROM archon_settings WHERE key LIKE 'PROVIDER_%';`
   - [ ] Test save/load cycle works

#### Testing Checklist

1. **Settings Persistence**:
   - [ ] Configure provider via UI
   - [ ] Save settings
   - [ ] Hard reload browser
   - [ ] Verify fields persist

2. **Initial Crawl**:
   - [ ] Create knowledge source with new provider
   - [ ] Verify crawl completes successfully
   - [ ] Check embeddings generated

3. **Recrawl**:
   - [ ] Refresh existing knowledge item
   - [ ] Verify no "Invalid provider name" error
   - [ ] Check embeddings regenerated

4. **API Tests**:
   - [ ] Test provider credentials endpoint
   - [ ] Test knowledge item refresh endpoint
   - [ ] Verify error handling

### Recommended: Centralized Provider Configuration

To prevent these issues, consider creating a centralized provider registry:

**File:** `python/src/server/config/providers.py`

```python
"""
Centralized provider configuration.

Single source of truth for all supported providers.
Update this file when adding new providers.
"""

from enum import Enum
from typing import List

class ProviderType(str, Enum):
    """Supported LLM providers."""
    OPENAI = "openai"
    AZURE_OPENAI = "azure-openai"
    GOOGLE = "google"
    ANTHROPIC = "anthropic"
    GROK = "grok"
    OPENROUTER = "openrouter"
    OLLAMA = "ollama"

def get_all_providers() -> List[str]:
    """Get list of all supported provider names."""
    return [provider.value for provider in ProviderType]

def get_embedding_capable_providers() -> List[str]:
    """Get list of providers that support embeddings."""
    return [
        ProviderType.OPENAI.value,
        ProviderType.AZURE_OPENAI.value,
        ProviderType.GOOGLE.value,
        # Add others as needed
    ]

# Use in knowledge_api.py:
# from src.server.config.providers import get_all_providers
# allowed_providers = set(get_all_providers())
```

Then update all validation locations to import from this central config:

```python
# knowledge_api.py
from src.server.config.providers import get_all_providers

allowed_providers = set(get_all_providers())
```

```typescript
// credentialsService.ts
import { SUPPORTED_PROVIDERS } from '@/config/providers';

const settings: RagSettings = {
  ...SUPPORTED_PROVIDERS.reduce((acc, provider) => ({
    ...acc,
    [`${provider}_CHAT_ENDPOINT`]: "",
    // ... other fields
  }), {}),
  // ... other settings
};
```

This ensures:
- ✅ Single update point when adding providers
- ✅ No possibility of forgetting validation lists
- ✅ Type-safe provider references
- ✅ Easier maintenance

---

## Summary

### What Was Fixed

1. **Settings Persistence**: Added 6 Azure OpenAI fields to default object in `credentialsService.ts:214-220`
2. **Recrawl Validation**: Added "azure-openai" to allowed_providers in `knowledge_api.py:72`

### Impact

- ✅ Azure OpenAI configuration now persists across sessions
- ✅ Knowledge items can be refreshed with Azure embeddings
- ✅ Consistent user experience for Azure OpenAI
- ✅ No more manual re-entry of configuration
- ✅ Reliable recrawling of existing knowledge sources

### Lessons Learned

1. **Three-part systems require three-part updates**: Interface + Whitelist + Defaults
2. **Validation lists are easy to forget**: Need centralized configuration
3. **Hardcoded lists are fragile**: Consider using enums or registries
4. **Test the full cycle**: Save → Reload → Refresh
5. **Search for similar patterns**: When fixing one validation list, search for others

### Next Steps

1. Consider implementing centralized provider configuration (see Prevention Guidelines)
2. Add integration tests for:
   - Settings persistence across reloads
   - Knowledge item refresh with all providers
3. Document provider addition process in contributor guide
4. Create checklist for PR reviews when adding providers

---

**End of Document**
