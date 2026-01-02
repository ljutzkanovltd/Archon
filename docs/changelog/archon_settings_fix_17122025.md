# Implementation Plan: Azure OpenAI Settings Fix

**Date:** 2025-12-17
**Status:** Planning
**Type:** Bug Fix + Feature Enhancement
**Priority:** High
**Estimated Effort:** 2 hours 20 minutes

---

## Overview

This plan addresses critical issues with Azure OpenAI configuration in Archon that prevent users from successfully testing and using Azure OpenAI deployments for both chat (LLM) and embedding services.

**Problem Statement:**
Users experience "Testing failed: deployment gpt-4.1-mini not found" errors when configuring Azure OpenAI settings, despite having correct deployment names and endpoints configured in the UI. The same issue occurs for embedding models.

**Root Causes Identified:**
1. **Missing API Keys (Primary):** Azure OpenAI API returns 404 errors for authentication failures, which are misinterpreted as "deployment not found" errors
2. **Misleading Error Messages:** Current error handling cannot distinguish between authentication failures and actual missing deployments
3. **No Startup Validation:** Misconfiguration is only discovered when users manually test connections
4. **Cache Issues:** Recent configuration changes may not take effect without service restart

**Solution Approach:**
Comprehensive fix including immediate configuration resolution, improved error diagnostics, startup validation, and enhanced user guidance.

---

## Requirements Summary

### Functional Requirements
- ✅ Azure OpenAI chat completion API must work with correct credentials
- ✅ Azure OpenAI embedding API must work with correct credentials
- ✅ Test connection feature must accurately report configuration errors
- ✅ Users must receive actionable troubleshooting guidance

### Non-Functional Requirements
- ✅ Error messages must clearly distinguish authentication vs deployment issues
- ✅ Startup validation must catch common misconfigurations
- ✅ Configuration changes must take effect without requiring container restarts
- ✅ Backward compatibility with existing configurations
- ✅ No new external dependencies

### Constraints
- No migration script (manual reconfiguration acceptable)
- Must work with existing database schema
- Must maintain existing API contracts
- Changes should be additive (no breaking changes)

---

## Research Findings

### 1. Azure OpenAI API Behavior
**Source:** Code analysis + Azure OpenAI documentation

**Key Findings:**
- Azure OpenAI returns HTTP 404 for BOTH authentication failures AND missing deployments
- This is a security feature to avoid leaking information about deployment existence
- Requires client-side validation to distinguish between error types

**Impact on Archon:**
Current error handling at `providers_api.py:232-236` assumes 404 = "deployment not found", which is incorrect.

### 2. Recent Configuration Changes
**Source:** Git history analysis

**Commit b5c6260 (Dec 15, 2025):** "feat(azure): separate chat and embedding Azure OpenAI configurations"
- Changed from single `AZURE_OPENAI_API_KEY` to separate keys:
  - `AZURE_OPENAI_CHAT_API_KEY`
  - `AZURE_OPENAI_EMBEDDING_API_KEY`
  - Fallback to `AZURE_OPENAI_API_KEY` for backward compatibility
- Similar pattern for endpoints and deployments

**Migration Impact:**
Users who configured Azure before this change may have:
- ✅ Deployment names configured
- ✅ Endpoints configured
- ❌ API keys NOT migrated to new key names

**Commit ed31a45 (Dec 15, 2025):** "fix(embeddings): reduce chunk size from 5000 to 1200 chars"
- Fixed embedding model compatibility issues
- Unrelated to current authentication problem

### 3. Endpoint URL Normalization
**Source:** `RAGSettings.tsx` lines 200-219

**Fixed Dec 15, 2025:**
Users were saving full deployment paths instead of base URLs:
- ❌ Wrong: `https://{resource}.openai.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=...`
- ✅ Correct: `https://{resource}.openai.azure.com`

**Current Implementation:**
```typescript
// RAGSettings.tsx:200-219
const normalizeEndpoint = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return url;
  }
};
```

### 4. Credential Retrieval Pattern
**Source:** `credential_service.py` lines 503-532

**Current Logic:**
```python
async def _get_provider_api_key(self, provider: str, use_embedding_provider: bool = False):
    if provider == "azure-openai":
        if use_embedding_provider:
            # Try AZURE_OPENAI_EMBEDDING_API_KEY first
            key = await self.get_setting("AZURE_OPENAI_EMBEDDING_API_KEY")
            if key and key != "ollama":
                return key
        else:
            # Try AZURE_OPENAI_CHAT_API_KEY first
            key = await self.get_setting("AZURE_OPENAI_CHAT_API_KEY")
            if key and key != "ollama":
                return key

        # Fallback to shared key
        key = await self.get_setting("AZURE_OPENAI_API_KEY")
        if key and key != "ollama":
            return key
```

**Issue:** Method returns `None` if no keys configured, but calling code doesn't validate this.

### 5. Database Schema
**Source:** `migration/add_azure_openai_support.sql`

**Relevant Tables:**
- `archon_settings` - Stores all configuration key-value pairs
- Fields: `id`, `key`, `value`, `is_encrypted`, `created_at`, `updated_at`

**Azure OpenAI Settings:**
```sql
-- Chat configuration
AZURE_OPENAI_CHAT_ENDPOINT
AZURE_OPENAI_CHAT_DEPLOYMENT
AZURE_OPENAI_CHAT_API_KEY

-- Embedding configuration
AZURE_OPENAI_EMBEDDING_ENDPOINT
AZURE_OPENAI_EMBEDDING_DEPLOYMENT
AZURE_OPENAI_EMBEDDING_API_KEY

-- Shared configuration (fallback)
AZURE_OPENAI_API_KEY
AZURE_OPENAI_API_VERSION

-- Provider selection
LLM_PROVIDER = "azure-openai"
EMBEDDING_PROVIDER = "azure-openai"
```

### 6. Existing Validation Gaps
**Source:** Codebase analysis

**Current State:**
- ❌ No startup validation of Azure configuration
- ❌ No API key presence check before API calls
- ❌ No endpoint format validation
- ❌ No deployment name validation
- ✅ Frontend validates input format (basic)
- ✅ Test endpoint exists but has misleading error messages

### 7. Cache Behavior
**Source:** `credential_service.py` + `llm_provider_service.py`

**Provider Cache:**
- TTL: 5 minutes (300 seconds)
- Invalidation: Automatic on credential updates (lines 239-265)
- Location: `llm_provider_service.clear_provider_cache()`

**Impact:**
Credential updates should invalidate cache immediately, but container restart may still be needed in some cases.

---

## Technology Decisions

### 1. Error Message Enhancement Approach
**Decision:** Client-side heuristic classification of Azure errors

**Rationale:**
- Azure API doesn't provide clear error codes
- Must infer error type from message content and status code
- Add multiple detection patterns for robustness

**Implementation:**
- Check for 401/"Unauthorized" → Auth error
- Check for 404/"NotFoundError" → Could be auth OR deployment
- Check for timeout → Network error
- Provide combined troubleshooting steps

### 2. Startup Validation Strategy
**Decision:** Non-blocking validation with warning logs

**Rationale:**
- Don't prevent Archon startup for configuration issues
- Allow users to fix config via UI even if invalid
- Provide clear actionable warnings in logs
- Support headless/automated deployments

**Implementation:**
- New module: `startup_checks.py`
- Called during app startup after DB init
- Logs warnings/errors but doesn't raise exceptions
- Validates: API keys, endpoints, deployments

### 3. UI Enhancement Pattern
**Decision:** Progressive disclosure of troubleshooting information

**Rationale:**
- Don't overwhelm users with information on success
- Show contextual help only on failures
- Provide specific guidance based on error type
- Use tooltips for proactive help

**Implementation:**
- Show troubleshooting tips below failed tests
- Add tooltip hints on input fields
- Use color coding (red for errors, yellow for warnings)

### 4. No Migration Script
**Decision:** Manual reconfiguration via UI is acceptable

**Rationale:**
- Small user base (development/internal use)
- UI provides clear configuration interface
- Migration complexity not justified
- Clear documentation can guide users

---

## Implementation Tasks

### Phase 1: Immediate Configuration Fix (15 minutes)
**Goal:** Get Azure OpenAI working right now

#### Task 1.1: Database Configuration Verification
**Description:** Query database to check current Azure configuration state

**Commands:**
```bash
# Check API keys
docker exec supabase-ai-db psql -U postgres -d postgres -c "
  SELECT key,
         CASE WHEN is_encrypted THEN '[ENCRYPTED]' ELSE value END as value,
         is_encrypted
  FROM archon_settings
  WHERE key LIKE 'AZURE_OPENAI%KEY'
  ORDER BY key;
"

# Check endpoints
docker exec supabase-ai-db psql -U postgres -d postgres -c "
  SELECT key, value FROM archon_settings
  WHERE key LIKE 'AZURE_OPENAI%ENDPOINT';
"

# Check deployments
docker exec supabase-ai-db psql -U postgres -d postgres -c "
  SELECT key, value FROM archon_settings
  WHERE key LIKE 'AZURE_OPENAI%DEPLOYMENT';
"

# Check active providers
docker exec supabase-ai-db psql -U postgres -d postgres -c "
  SELECT key, value FROM archon_settings
  WHERE key IN ('LLM_PROVIDER', 'EMBEDDING_PROVIDER');
"
```

**Expected Results:**
- API keys should show `[ENCRYPTED]` or actual values (not NULL)
- Endpoints should be base URLs only (no deployment paths)
- Deployments should match Azure Portal names exactly
- Providers should be "azure-openai"

**Files:** None (database query only)
**Dependencies:** Archon database running
**Estimated Effort:** 5 minutes

#### Task 1.2: UI Configuration
**Description:** Configure missing API keys via Archon dashboard

**Steps:**
1. Open http://localhost:3737
2. Navigate to Settings → Providers → Azure OpenAI
3. Enter API key in "Chat API Key" field (or "Shared API Key" if using same key)
4. Verify endpoint format is correct (base URL only)
5. Verify deployment names match Azure Portal
6. Click "Save Settings"
7. Click "Test Connection" for both Chat and Embeddings

**Files:** None (UI interaction)
**Dependencies:** Task 1.1 completed
**Estimated Effort:** 5 minutes

#### Task 1.3: Service Restart
**Description:** Restart archon-server to ensure cache is cleared

**Commands:**
```bash
cd ~/Documents/Projects/archon
docker compose restart archon-server

# Verify restart
docker ps | grep archon-server
docker logs archon-server --tail 50
```

**Files:** None (container management)
**Dependencies:** Task 1.2 completed
**Estimated Effort:** 5 minutes

---

### Phase 2: Error Message Improvements (30 minutes)
**Goal:** Distinguish authentication failures from deployment issues

#### Task 2.1: Enhance Azure Error Detection
**Description:** Update error handling in test endpoint to classify Azure errors accurately

**File:** `python/src/server/api_routes/providers_api.py`
**Location:** Lines ~226-236 (Azure OpenAI error handling)

**Changes:**
```python
# Current code (simplified):
except Exception as e:
    error_msg = str(e)
    if "404" in error_msg or "NotFoundError" in error_msg:
        message = f"Deployment '{deployment}' not found. Verify deployment name in Azure Portal."
    else:
        message = f"Connection failed: {error_msg}"

# Enhanced code:
except Exception as e:
    error_msg = str(e)
    error_lower = error_msg.lower()

    # Check for authentication errors
    if "401" in error_msg or "unauthorized" in error_lower or "authentication" in error_lower:
        message = (
            f"❌ Authentication failed. "
            f"Please check that your API key is configured correctly. "
            f"Go to Settings → Providers → Azure OpenAI and verify: "
            f"1) 'Chat API Key' or 'Shared API Key' is set, "
            f"2) Key is valid and not expired."
        )

    # Azure returns 404 for BOTH auth failures AND missing deployments
    elif "404" in error_msg or "notfounderror" in error_lower:
        message = (
            f"⚠️  Deployment '{deployment}' not found OR authentication failed. "
            f"Azure returns this error for both scenarios. Please verify:\n\n"
            f"1. API Key Configuration:\n"
            f"   - Go to Settings → Providers → Azure OpenAI\n"
            f"   - Ensure 'Chat API Key' or 'Shared API Key' is set\n"
            f"   - Verify key is valid in Azure Portal\n\n"
            f"2. Deployment Configuration:\n"
            f"   - Check deployment name '{deployment}' exists in Azure Portal\n"
            f"   - Deployment name is case-sensitive\n"
            f"   - Use deployment name, NOT model name\n\n"
            f"3. Endpoint Configuration:\n"
            f"   - Verify endpoint URL is correct\n"
            f"   - Should be base URL only (no /openai/deployments/ path)"
        )

    # Check for timeout errors
    elif "timeout" in error_lower or "timed out" in error_lower:
        message = (
            f"⏱️  Connection timeout. Please check:\n"
            f"1) Endpoint URL is correct and reachable\n"
            f"2) Network connectivity (firewall, proxy)\n"
            f"3) Azure service is operational"
        )

    # Check for rate limiting
    elif "429" in error_msg or "rate limit" in error_lower:
        message = (
            f"🚦 Rate limit exceeded. "
            f"Your Azure OpenAI deployment has reached its quota. "
            f"Please wait and try again, or check quota in Azure Portal."
        )

    # Generic error with helpful context
    else:
        message = (
            f"❌ Connection failed: {error_msg}\n\n"
            f"Common issues:\n"
            f"- API key not configured or invalid\n"
            f"- Endpoint URL incorrect\n"
            f"- Deployment name mismatch\n"
            f"- Network connectivity issues"
        )

    return {
        "ok": False,
        "message": message,
        "error_details": str(e),  # Include raw error for debugging
        "timestamp": datetime.now().isoformat()
    }
```

**Dependencies:** None
**Estimated Effort:** 20 minutes (implementation + testing)

#### Task 2.2: Add Embedding Error Handling
**Description:** Apply same error classification to embedding endpoint test

**File:** `python/src/server/api_routes/providers_api.py`
**Location:** Embedding test endpoint (if separate from LLM test)

**Changes:** Same pattern as Task 2.1, adapted for embedding context

**Dependencies:** Task 2.1 completed
**Estimated Effort:** 10 minutes

---

### Phase 3: Startup Validation (45 minutes)
**Goal:** Catch configuration issues on startup, not at runtime

#### Task 3.1: Create Startup Validation Module
**Description:** New module to validate Azure OpenAI configuration

**File:** `python/src/server/utils/startup_checks.py` (NEW FILE)

**Implementation:**
```python
"""
Startup validation checks for Archon configuration.

Validates provider configurations on application startup to catch
common misconfigurations early.
"""

import logging
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)


async def validate_azure_openai_config() -> Tuple[bool, list[str]]:
    """
    Validate Azure OpenAI configuration if selected as active provider.

    Returns:
        Tuple of (is_valid, list_of_issues)
    """
    from ..services.credential_service import credential_service

    issues = []

    try:
        # Check if Azure OpenAI is the active LLM provider
        llm_provider_config = await credential_service.get_active_provider("llm")
        embedding_provider_config = await credential_service.get_active_provider("embedding")

        llm_is_azure = llm_provider_config.get("provider") == "azure-openai"
        embedding_is_azure = embedding_provider_config.get("provider") == "azure-openai"

        if not llm_is_azure and not embedding_is_azure:
            # Azure not in use, skip validation
            return True, []

        logger.info("🔍 Validating Azure OpenAI configuration...")

        # Validate LLM configuration if Azure is selected
        if llm_is_azure:
            await _validate_azure_chat_config(issues)

        # Validate embedding configuration if Azure is selected
        if embedding_is_azure:
            await _validate_azure_embedding_config(issues)

        # Report results
        if issues:
            logger.error(f"❌ Azure OpenAI configuration has {len(issues)} issue(s):")
            for i, issue in enumerate(issues, 1):
                logger.error(f"   {i}. {issue}")
            logger.error("   Fix these issues in Settings → Providers → Azure OpenAI")
            return False, issues
        else:
            logger.info("✅ Azure OpenAI configuration is valid")
            return True, []

    except Exception as e:
        logger.error(f"⚠️  Error during Azure configuration validation: {e}")
        return False, [f"Validation error: {str(e)}"]


async def _validate_azure_chat_config(issues: list[str]) -> None:
    """Validate Azure chat/LLM configuration."""
    from ..services.credential_service import credential_service

    # Check API key
    try:
        api_key = await credential_service._get_provider_api_key("azure-openai", use_embedding_provider=False)
        if not api_key or api_key == "ollama":
            issues.append(
                "Chat API key not configured. "
                "Set 'AZURE_OPENAI_CHAT_API_KEY' or 'AZURE_OPENAI_API_KEY' in Settings UI."
            )
    except Exception as e:
        issues.append(f"Error retrieving chat API key: {e}")

    # Check deployment name
    try:
        deployment = await credential_service.get_azure_chat_deployment()
        if not deployment:
            issues.append("Chat deployment name not configured. Set 'AZURE_OPENAI_CHAT_DEPLOYMENT'.")
        else:
            logger.info(f"   Chat deployment: {deployment}")
    except ValueError as e:
        issues.append(f"Chat deployment error: {e}")

    # Check endpoint
    try:
        endpoint = await credential_service.get_azure_chat_endpoint()
        if not endpoint:
            issues.append("Chat endpoint not configured. Set 'AZURE_OPENAI_CHAT_ENDPOINT'.")
        else:
            # Check for malformed endpoint (contains deployment path)
            if "/openai/deployments/" in endpoint or "/chat/completions" in endpoint:
                issues.append(
                    f"Chat endpoint contains deployment path (should be base URL only): {endpoint}. "
                    f"Correct format: https://YOUR_RESOURCE.openai.azure.com"
                )
            else:
                logger.info(f"   Chat endpoint: {endpoint[:60]}...")
    except ValueError as e:
        issues.append(f"Chat endpoint error: {e}")


async def _validate_azure_embedding_config(issues: list[str]) -> None:
    """Validate Azure embedding configuration."""
    from ..services.credential_service import credential_service

    # Check API key
    try:
        api_key = await credential_service._get_provider_api_key("azure-openai", use_embedding_provider=True)
        if not api_key or api_key == "ollama":
            issues.append(
                "Embedding API key not configured. "
                "Set 'AZURE_OPENAI_EMBEDDING_API_KEY' or 'AZURE_OPENAI_API_KEY' in Settings UI."
            )
    except Exception as e:
        issues.append(f"Error retrieving embedding API key: {e}")

    # Check deployment name
    try:
        deployment = await credential_service.get_azure_embedding_deployment()
        if not deployment:
            issues.append("Embedding deployment name not configured. Set 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT'.")
        else:
            logger.info(f"   Embedding deployment: {deployment}")
    except ValueError as e:
        issues.append(f"Embedding deployment error: {e}")

    # Check endpoint
    try:
        endpoint = await credential_service.get_azure_embedding_endpoint()
        if not endpoint:
            issues.append("Embedding endpoint not configured. Set 'AZURE_OPENAI_EMBEDDING_ENDPOINT'.")
        else:
            # Check for malformed endpoint
            if "/openai/deployments/" in endpoint or "/embeddings" in endpoint:
                issues.append(
                    f"Embedding endpoint contains deployment path (should be base URL only): {endpoint}. "
                    f"Correct format: https://YOUR_RESOURCE.openai.azure.com"
                )
            else:
                logger.info(f"   Embedding endpoint: {endpoint[:60]}...")
    except ValueError as e:
        issues.append(f"Embedding endpoint error: {e}")


async def run_all_startup_checks() -> Dict[str, Any]:
    """
    Run all startup validation checks.

    Returns:
        Dictionary with check results and any issues found.
    """
    logger.info("🚀 Running startup validation checks...")

    results = {
        "azure_openai": {
            "valid": True,
            "issues": []
        }
    }

    # Azure OpenAI validation
    is_valid, issues = await validate_azure_openai_config()
    results["azure_openai"]["valid"] = is_valid
    results["azure_openai"]["issues"] = issues

    # Summary
    total_issues = sum(len(check["issues"]) for check in results.values())
    if total_issues == 0:
        logger.info("✅ All startup checks passed")
    else:
        logger.warning(f"⚠️  Startup checks found {total_issues} issue(s)")

    return results
```

**Dependencies:** None
**Estimated Effort:** 30 minutes

#### Task 3.2: Integrate Startup Checks into Main App
**Description:** Call validation during application startup

**File:** `python/src/server/main.py`

**Location:** After database initialization, before starting server

**Changes:**
```python
# Add import at top
from .utils.startup_checks import run_all_startup_checks

# Find the app startup event (look for @app.on_event("startup") or lifespan)
# Add validation call:

@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    logger.info("Starting Archon server...")

    # Existing startup code (database init, etc.)
    # ...

    # NEW: Run configuration validation
    try:
        logger.info("Running configuration validation checks...")
        await run_all_startup_checks()
    except Exception as e:
        logger.error(f"Startup validation failed (non-fatal): {e}")
        # Don't prevent startup, just log the error

    logger.info("Archon server started successfully")
```

**Dependencies:** Task 3.1 completed
**Estimated Effort:** 10 minutes

#### Task 3.3: Update Python Package Exports
**Description:** Ensure new module is importable

**File:** `python/src/server/utils/__init__.py`

**Changes:**
```python
# Add to existing imports
from .startup_checks import run_all_startup_checks, validate_azure_openai_config

__all__ = [
    # ... existing exports ...
    "run_all_startup_checks",
    "validate_azure_openai_config",
]
```

**Dependencies:** Task 3.1 completed
**Estimated Effort:** 5 minutes

---

### Phase 4: UI Enhancements (30 minutes)
**Goal:** Help users troubleshoot in the dashboard

#### Task 4.1: Add Troubleshooting Tips to Test Results
**Description:** Show contextual help when connection tests fail

**File:** `archon-ui-main/src/components/settings/RAGSettings.tsx`
**Location:** Test results display section (around line 290)

**Changes:**
```typescript
// Find the test results display section
{testResults[key] && (
  <div className={`mt-2 p-3 rounded ${
    testResults[key].ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }`}>
    <div className="flex items-center">
      {testResults[key].ok ? '✅' : '❌'}
      <span className="ml-2">{testResults[key].message}</span>
    </div>

    {/* NEW: Add troubleshooting tips on failure */}
    {!testResults[key].ok && (
      <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-yellow-800">
        <div className="font-semibold mb-2">💡 Troubleshooting Tips:</div>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>API Key:</strong> Verify that you've entered your Azure OpenAI API key
            in the "Chat API Key" field (or "Shared API Key" if using the same key for both)
          </li>
          <li>
            <strong>Deployment Name:</strong> Check that "{azureSettings.chatDeployment || azureSettings.embeddingDeployment}"
            exists in your Azure Portal → Azure OpenAI → Deployments
          </li>
          <li>
            <strong>Endpoint URL:</strong> Should be base URL only (e.g., https://YOUR_RESOURCE.openai.azure.com),
            not the full API path
          </li>
          <li>
            <strong>API Version:</strong> Default is {azureSettings.apiVersion || '2024-02-15-preview'}
            - verify this version is supported by your deployment
          </li>
        </ul>
        <div className="mt-2 text-xs">
          <strong>Still having issues?</strong> Check the server logs with:
          <code className="ml-1 px-2 py-1 bg-gray-200 rounded">docker logs archon-server --tail 50</code>
        </div>
      </div>
    )}
  </div>
)}
```

**Dependencies:** None
**Estimated Effort:** 15 minutes

#### Task 4.2: Add Tooltip Hints on Input Fields
**Description:** Provide proactive guidance for configuration fields

**File:** `archon-ui-main/src/components/settings/RAGSettings.tsx`
**Location:** Input field definitions (around lines 400-500)

**Changes:**
```typescript
// Add tooltips to key input fields

{/* Chat API Key field */}
<div className="relative">
  <label className="flex items-center gap-2">
    Chat API Key
    <span className="text-xs text-gray-500" title="Your Azure OpenAI API key from Azure Portal">
      ℹ️
    </span>
  </label>
  <input
    type="password"
    value={azureSettings.chatApiKey || ''}
    onChange={(e) => setAzureSettings({...azureSettings, chatApiKey: e.target.value})}
    placeholder="Enter your Azure OpenAI API key"
    className="w-full px-3 py-2 border rounded"
  />
  <div className="text-xs text-gray-500 mt-1">
    Find this in Azure Portal → Azure OpenAI → Keys and Endpoint
  </div>
</div>

{/* Endpoint field */}
<div className="relative">
  <label className="flex items-center gap-2">
    Endpoint
    <span className="text-xs text-gray-500" title="Base URL only, no deployment path">
      ℹ️
    </span>
  </label>
  <input
    type="text"
    value={azureSettings.chatEndpoint || ''}
    onChange={(e) => setAzureSettings({...azureSettings, chatEndpoint: e.target.value})}
    placeholder="https://YOUR_RESOURCE.openai.azure.com"
    className="w-full px-3 py-2 border rounded"
  />
  <div className="text-xs text-gray-500 mt-1">
    ✅ Correct: https://YOUR_RESOURCE.openai.azure.com<br/>
    ❌ Wrong: https://YOUR_RESOURCE.openai.azure.com/openai/deployments/...
  </div>
</div>

{/* Deployment field */}
<div className="relative">
  <label className="flex items-center gap-2">
    Deployment Name
    <span className="text-xs text-gray-500" title="Your deployment name from Azure Portal">
      ℹ️
    </span>
  </label>
  <input
    type="text"
    value={azureSettings.chatDeployment || ''}
    onChange={(e) => setAzureSettings({...azureSettings, chatDeployment: e.target.value})}
    placeholder="gpt-4o-mini"
    className="w-full px-3 py-2 border rounded"
  />
  <div className="text-xs text-gray-500 mt-1">
    Use your deployment name (e.g., "gpt-4o-mini"), not the model name.
    Find this in Azure Portal → Azure OpenAI → Deployments
  </div>
</div>
```

**Dependencies:** None
**Estimated Effort:** 15 minutes

---

### Phase 5: Testing & Verification (20 minutes)
**Goal:** Ensure all scenarios work correctly

#### Task 5.1: Test Successful Configuration
**Description:** Verify Azure OpenAI works with correct credentials

**Test Cases:**
1. Configure valid API key, endpoint, deployment for chat
2. Test connection → should succeed with ✅ message
3. Configure valid API key, endpoint, deployment for embeddings
4. Test connection → should succeed with ✅ message
5. Verify startup logs show ✅ validation passed

**Expected Results:**
- Test connections succeed
- No errors in logs
- Startup validation passes

**Files:** None (manual testing)
**Dependencies:** All phases completed
**Estimated Effort:** 10 minutes

#### Task 5.2: Test Error Scenarios
**Description:** Verify error messages are clear and actionable

**Test Cases:**
1. Remove API key → Test connection → Should show auth error with troubleshooting tips
2. Use wrong deployment name → Should show combined auth/deployment error
3. Use malformed endpoint (with deployment path) → Should show endpoint format error in startup logs
4. Test with rate-limited deployment → Should show rate limit message

**Expected Results:**
- Errors are clearly categorized
- Troubleshooting tips are shown
- Startup validation catches malformed endpoints

**Files:** None (manual testing)
**Dependencies:** Task 5.1 completed
**Estimated Effort:** 10 minutes

---

## Codebase Integration Points

### Files to Modify

1. **`python/src/server/api_routes/providers_api.py`**
   - Lines ~226-236: Azure error handling in test endpoint
   - **Changes:** Enhanced error classification and messaging
   - **Risk:** Low (improves existing error handling)

2. **`python/src/server/main.py`**
   - Startup event handler
   - **Changes:** Add call to `run_all_startup_checks()`
   - **Risk:** Low (validation is non-blocking)

3. **`archon-ui-main/src/components/settings/RAGSettings.tsx`**
   - Lines ~290: Test results display
   - Lines ~400-500: Input field definitions
   - **Changes:** Add troubleshooting tips and tooltip hints
   - **Risk:** Low (UI improvements only)

4. **`python/src/server/utils/__init__.py`**
   - Module exports
   - **Changes:** Add exports for new startup_checks module
   - **Risk:** Low (standard Python package pattern)

### New Files to Create

1. **`python/src/server/utils/startup_checks.py`** (NEW)
   - **Purpose:** Validation module for Azure OpenAI configuration
   - **Exports:** `run_all_startup_checks()`, `validate_azure_openai_config()`
   - **Size:** ~200 lines
   - **Dependencies:** `credential_service`

### Existing Patterns to Follow

1. **Error Handling Pattern** (from `providers_api.py`)
   ```python
   try:
       # API call
   except Exception as e:
       return {"ok": False, "message": str(e)}
   ```

2. **Logging Pattern** (from existing modules)
   ```python
   import logging
   logger = logging.getLogger(__name__)
   logger.info("✅ Success message")
   logger.error("❌ Error message")
   ```

3. **Settings Retrieval Pattern** (from `credential_service.py`)
   ```python
   await credential_service.get_setting("KEY_NAME")
   await credential_service.get_active_provider("llm")
   ```

4. **React State Pattern** (from `RAGSettings.tsx`)
   ```typescript
   const [settings, setSettings] = useState({});
   setSettings({...settings, key: value});
   ```

---

## Technical Design

### Architecture: Startup Validation Flow

```
Application Startup
       ↓
main.py: startup_event()
       ↓
startup_checks.run_all_startup_checks()
       ↓
startup_checks.validate_azure_openai_config()
       ↓
       ├─→ Get active providers (LLM, Embedding)
       ├─→ If Azure selected for LLM:
       │   └─→ _validate_azure_chat_config()
       │       ├─→ Check API key exists
       │       ├─→ Check deployment name
       │       └─→ Check endpoint format
       └─→ If Azure selected for Embedding:
           └─→ _validate_azure_embedding_config()
               ├─→ Check API key exists
               ├─→ Check deployment name
               └─→ Check endpoint format
       ↓
Log results (✅ pass / ❌ issues)
       ↓
Continue startup (non-blocking)
```

### Error Handling Flow: Test Connection

```
User clicks "Test Connection"
       ↓
RAGSettings.tsx: handleTestConnection()
       ↓
API: POST /api/test/provider/azure-openai
       ↓
providers_api.py: test_azure_connection()
       ↓
Create AsyncAzureOpenAI client
       ↓
Try: client.chat.completions.create()
       ↓
       ├─→ Success: Return {"ok": true, "message": "✅"}
       │
       └─→ Exception:
           ├─→ Classify error type:
           │   ├─→ 401/"unauthorized" → Auth error
           │   ├─→ 404/"notfound" → Auth OR deployment error
           │   ├─→ timeout → Network error
           │   ├─→ 429/"rate limit" → Quota error
           │   └─→ other → Generic error
           │
           └─→ Return {"ok": false, "message": "❌ [detailed guidance]"}
       ↓
Frontend displays result + troubleshooting tips
```

### Configuration Storage

```
Database: archon_settings table
┌──────────────────────────────────────────┐
│ key                              value   │
├──────────────────────────────────────────┤
│ LLM_PROVIDER                     azure-openai
│ EMBEDDING_PROVIDER               azure-openai
│ AZURE_OPENAI_API_VERSION         2024-02-15-preview
│
│ Chat Configuration:
│ AZURE_OPENAI_CHAT_ENDPOINT       https://*.openai.azure.com
│ AZURE_OPENAI_CHAT_DEPLOYMENT     gpt-4.1-mini
│ AZURE_OPENAI_CHAT_API_KEY        [ENCRYPTED]
│
│ Embedding Configuration:
│ AZURE_OPENAI_EMBEDDING_ENDPOINT  https://*.openai.azure.com
│ AZURE_OPENAI_EMBEDDING_DEPLOYMENT text-embedding-3-large
│ AZURE_OPENAI_EMBEDDING_API_KEY   [ENCRYPTED]
│
│ Shared/Fallback:
│ AZURE_OPENAI_API_KEY             [ENCRYPTED]
└──────────────────────────────────────────┘
```

### API Key Retrieval Logic

```python
# From credential_service.py

def _get_provider_api_key(provider, use_embedding_provider):
    if provider == "azure-openai":
        if use_embedding_provider:
            # Embedding priority
            key = get_setting("AZURE_OPENAI_EMBEDDING_API_KEY")
            if key and key != "ollama":
                return key
        else:
            # Chat priority
            key = get_setting("AZURE_OPENAI_CHAT_API_KEY")
            if key and key != "ollama":
                return key

        # Fallback to shared key
        key = get_setting("AZURE_OPENAI_API_KEY")
        if key and key != "ollama":
            return key

    return None  # ⚠️ This is the problem - no validation!
```

---

## Dependencies and Libraries

### Existing Dependencies (No New Packages Needed)
- ✅ `openai==1.71.0` - Includes `AsyncAzureOpenAI` client
- ✅ `fastapi` - Web framework for API routes
- ✅ `sqlalchemy` - Database ORM
- ✅ `pydantic` - Data validation
- ✅ `logging` - Python standard library

### Frontend Dependencies (Already Installed)
- ✅ React 18
- ✅ TypeScript
- ✅ Tailwind CSS (for styling)

---

## Testing Strategy

### Unit Tests (Future Enhancement - Not in This Plan)
**Coverage:**
- `startup_checks.py` validation functions
- `providers_api.py` error classification logic

**Example:**
```python
@pytest.mark.asyncio
async def test_validate_azure_chat_config_missing_api_key():
    issues = []
    # Mock credential_service to return None for API key
    await _validate_azure_chat_config(issues)
    assert len(issues) > 0
    assert "Chat API key not configured" in issues[0]
```

### Integration Tests (Manual for This Release)
**Test Cases:**
1. ✅ Valid configuration → All tests pass
2. ❌ Missing API key → Auth error shown
3. ❌ Wrong deployment → Combined error shown
4. ❌ Malformed endpoint → Startup warning logged
5. ✅ Rate limit → Rate limit message shown

### Edge Cases to Cover
1. **Empty/null configuration values** - Should show "not configured" errors
2. **Whitespace in values** - Should be trimmed automatically (verify)
3. **Mixed provider selection** - Azure for LLM, Ollama for embedding (should validate correctly)
4. **API key value = "ollama"** - Should be treated as missing (current code does this)
5. **Very long error messages** - Should not break UI layout
6. **Special characters in deployment names** - Should be passed through correctly

### Performance Considerations
- Startup validation adds ~1-2 seconds to startup time (acceptable)
- Error classification adds negligible latency to test API calls (<10ms)
- UI changes have no performance impact

---

## Success Criteria

### Functional Success
- [ ] Azure OpenAI chat completions work with correct configuration
- [ ] Azure OpenAI embeddings work with correct configuration
- [ ] Test connection accurately reports configuration status
- [ ] Users can fix issues without needing to check logs

### Error Messaging Success
- [ ] Authentication errors clearly indicate API key issues
- [ ] 404 errors explain both possible causes (auth AND deployment)
- [ ] Timeout errors provide network troubleshooting steps
- [ ] Rate limit errors direct users to Azure Portal quota

### Validation Success
- [ ] Startup logs show Azure configuration validation results
- [ ] Missing API keys are detected and logged on startup
- [ ] Malformed endpoint URLs are detected and logged on startup
- [ ] Validation doesn't prevent application startup

### UI/UX Success
- [ ] Troubleshooting tips appear on test failures
- [ ] Input fields have helpful tooltips and examples
- [ ] Error messages are actionable (tell user what to do)
- [ ] Configuration workflow is clear and intuitive

### Code Quality Success
- [ ] New code follows existing patterns
- [ ] Logging is consistent with existing code
- [ ] No new external dependencies introduced
- [ ] Changes are backward compatible

---

## Rollback Plan

### If Issues Arise
1. **Revert startup validation** (if it blocks startup):
   - Comment out `run_all_startup_checks()` call in `main.py`
   - Restart archon-server

2. **Revert error message changes** (if messages are incorrect):
   - Restore original `providers_api.py` error handling
   - Restart archon-server

3. **Revert UI changes** (if UI breaks):
   - Restore original `RAGSettings.tsx`
   - Rebuild frontend: `cd archon-ui-main && npm run build`
   - Restart archon-server

### Git Revert Commands
```bash
# If entire implementation needs rollback
git log --oneline  # Find commit hash before changes
git revert <commit-hash>  # Creates new commit undoing changes

# Or reset (destructive)
git reset --hard <commit-hash>  # Use with caution
```

---

## Notes and Considerations

### Important Behavioral Notes

1. **Azure 404 Ambiguity**
   - Azure returns 404 for BOTH auth failures AND missing deployments
   - This is intentional (security by obscurity)
   - Our error messages must account for this ambiguity
   - Users must manually verify both API key AND deployment

2. **Credential Migration Path**
   - No automated migration from old single-key format
   - Users upgrading from old Archon versions must manually reconfigure
   - This is acceptable due to small user base

3. **Non-Blocking Validation**
   - Startup validation logs warnings but doesn't prevent startup
   - This allows users to fix issues via UI even if config is invalid
   - Critical for headless/automated deployments

4. **Cache Behavior**
   - Provider configuration is cached for 5 minutes
   - Cache is invalidated on credential updates (already implemented)
   - Container restart may still be needed in some edge cases

### Potential Challenges

1. **Azure API Instability**
   - Azure OpenAI API can have regional outages
   - Error messages may change between API versions
   - We classify based on current error format (may need updates)

2. **Deployment Name Variations**
   - Users may confuse deployment name with model name
   - Deployment names are user-defined (e.g., "gpt-4.1-mini")
   - Model names are OpenAI-defined (e.g., "gpt-4o-mini")
   - UI should clarify this distinction

3. **Endpoint URL Formats**
   - Multiple valid Azure endpoint formats exist
   - Government clouds have different domains
   - Validation should be flexible (base URL check only)

4. **API Version Compatibility**
   - Different Azure OpenAI API versions have different features
   - Default version (2024-02-15-preview) works for most cases
   - Users may need to adjust based on deployment capabilities

### Future Enhancements (Not in This Plan)

1. **Automated API Key Testing**
   - Validate API key format (starts with "sk-", correct length)
   - Test API key without making actual API calls (if possible)

2. **Deployment Name Auto-Discovery**
   - Use Azure Management API to list available deployments
   - Provide dropdown instead of text input
   - Requires Azure subscription credentials

3. **Health Check Dashboard**
   - Real-time status of Azure OpenAI connectivity
   - Historical success/failure rate
   - Quota usage monitoring

4. **Configuration Import/Export**
   - Export Azure settings to file
   - Import settings from file
   - Useful for multi-environment deployments

5. **Unit Test Coverage**
   - Add pytest tests for startup validation
   - Add pytest tests for error classification
   - Mock Azure API responses for testing

### Documentation Updates Needed

After implementation:
1. Update `README.md` with Azure configuration instructions
2. Update `docs/AZURE_OPENAI_IMPLEMENTATION.md` with new validation details
3. Add troubleshooting section to documentation
4. Document the startup validation feature

### Monitoring Recommendations

Post-deployment monitoring:
1. Check startup logs for validation warnings across all instances
2. Monitor error rates from Azure test endpoint
3. Track user support requests related to Azure configuration
4. Review error message effectiveness (user feedback)

---

## Implementation Checklist

### Pre-Implementation
- [ ] Review this plan with team
- [ ] Verify Archon database is backed up
- [ ] Check that test Azure credentials are available
- [ ] Ensure development environment is set up

### Phase 1: Immediate Fix
- [ ] Task 1.1: Verify database configuration
- [ ] Task 1.2: Configure API keys via UI
- [ ] Task 1.3: Restart services and verify

### Phase 2: Error Messages
- [ ] Task 2.1: Enhance Azure error detection in providers_api.py
- [ ] Task 2.2: Apply same pattern to embedding endpoint
- [ ] Test error message improvements

### Phase 3: Startup Validation
- [ ] Task 3.1: Create startup_checks.py module
- [ ] Task 3.2: Integrate into main.py
- [ ] Task 3.3: Update __init__.py exports
- [ ] Test startup validation

### Phase 4: UI Enhancements
- [ ] Task 4.1: Add troubleshooting tips to RAGSettings.tsx
- [ ] Task 4.2: Add tooltip hints to input fields
- [ ] Test UI improvements

### Phase 5: Testing
- [ ] Task 5.1: Test successful configuration scenarios
- [ ] Task 5.2: Test error scenarios
- [ ] Verify all success criteria

### Post-Implementation
- [ ] Update documentation
- [ ] Create PRP document from this plan
- [ ] Announce fix to users (if applicable)
- [ ] Monitor for issues in production

---

## Time Estimates Summary

| Phase | Description | Time |
|-------|-------------|------|
| 1 | Immediate Configuration Fix | 15 min |
| 2 | Error Message Improvements | 30 min |
| 3 | Startup Validation | 45 min |
| 4 | UI Enhancements | 30 min |
| 5 | Testing & Verification | 20 min |
| **Total** | **All phases** | **2h 20min** |

---

## Next Steps

1. **Review this plan** - Get team approval before proceeding
2. **Create PRP** - Use this document to create formal Project Requirements & Planning document
3. **Set up test environment** - Ensure Azure test credentials are available
4. **Begin Phase 1** - Start with immediate configuration fix
5. **Proceed sequentially** - Complete each phase before moving to next

---

**Plan Status:** ✅ Ready for PRP creation and implementation
**Document Created:** 2025-12-17
**Next Action:** Create formal PRP document and begin Phase 1

---

*This plan follows the structure from `archon-example-workflow/.claude/commands/create-plan.md`*
