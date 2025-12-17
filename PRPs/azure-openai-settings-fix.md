name: "Azure OpenAI Settings Fix & Validation Enhancement"
description: |
  Comprehensive fix for Azure OpenAI configuration issues including missing API keys,
  misleading error messages, startup validation, and UI/UX improvements.

---

## Goal

**Feature Goal**: Fix Azure OpenAI configuration issues and prevent "deployment not found" errors caused by missing API keys, while providing clear troubleshooting guidance to users.

**Deliverable**:
1. Enhanced error classification in provider test endpoint
2. Startup validation module for Azure OpenAI configuration
3. Improved UI with troubleshooting tips and tooltips
4. Clear, actionable error messages that distinguish authentication vs deployment issues

**Success Definition**:
- Users with correct Azure credentials can successfully test and use Azure OpenAI
- Error messages clearly indicate root cause (API key vs deployment vs network)
- Configuration issues are caught on startup with actionable warnings
- Users can troubleshoot issues without checking server logs

## User Persona

**Target User**: Archon administrators configuring Azure OpenAI for LLM/embedding services

**Use Case**: Setting up Azure OpenAI as the active provider for chat completions and embeddings

**User Journey**:
1. Navigate to Settings → Providers → Azure OpenAI
2. Enter Azure endpoint URL, deployment name, and API key
3. Click "Test Connection" to verify configuration
4. Save settings if test passes
5. Use Azure OpenAI for knowledge base operations

**Pain Points Addressed**:
- Misleading "deployment not found" errors when API key is missing/invalid
- No guidance on what to check when tests fail
- Configuration errors only discovered at runtime, not startup
- Unclear distinction between authentication failures and actual missing deployments
- Azure returns 404 for BOTH auth failures AND missing deployments (security by obscurity)

## Why

- **Business Value**: Archon supports multiple LLM providers, and Azure OpenAI is a critical enterprise option. Configuration must be reliable and troubleshooting must be straightforward.
- **Integration**: Azure OpenAI is used for both chat completions (LLM_PROVIDER) and embeddings (EMBEDDING_PROVIDER), requiring separate configurations with fallback support.
- **Problems Solved**:
  - Users cannot successfully configure Azure OpenAI due to misleading errors
  - Recent code changes separated chat/embedding API keys but users have incomplete configurations
  - No proactive validation catches misconfiguration before users attempt operations
  - Error messages don't provide actionable troubleshooting steps

## What

### User-Visible Behavior

**Before:**
- Test connection fails with "Deployment 'gpt-4.1-mini' not found" even when deployment exists
- No indication that API key is missing or invalid
- No troubleshooting guidance provided
- Configuration issues only discovered when users try to use the feature

**After:**
- Test connection clearly indicates:
  - ✅ Success with confirmation message
  - ❌ Authentication failure (missing/invalid API key) with specific remediation steps
  - ⚠️ Ambiguous 404 error with guidance to check BOTH API key AND deployment
  - ⏱️ Timeout errors with network troubleshooting steps
  - 🚦 Rate limit errors with quota guidance
- Startup validation logs warnings for missing/invalid configuration
- UI shows troubleshooting tips below failed tests
- Input fields have helpful tooltips with examples
- Error messages include specific guidance on where to find settings in Azure Portal

### Technical Requirements

1. **Error Classification**: Distinguish between auth, deployment, network, and rate limit errors
2. **Startup Validation**: Check Azure config if selected as active provider, log detailed warnings
3. **Non-Blocking Validation**: Allow app startup even with invalid config (users can fix via UI)
4. **Backward Compatibility**: Support both new (AZURE_OPENAI_CHAT_API_KEY) and legacy (AZURE_OPENAI_API_KEY) key patterns
5. **UI Enhancements**: Progressive disclosure of troubleshooting info (show only on failure)

### Success Criteria

- [ ] Azure OpenAI chat test succeeds with valid credentials
- [ ] Azure OpenAI embedding test succeeds with valid credentials
- [ ] Missing API key shows authentication error, not deployment error
- [ ] 404 errors show combined guidance for BOTH possible causes
- [ ] Startup validation catches and logs missing API keys, malformed endpoints
- [ ] Validation warnings are logged but don't prevent startup
- [ ] UI shows contextual troubleshooting tips on test failure
- [ ] Input fields have helpful tooltips with correct format examples
- [ ] All existing tests continue to pass
- [ ] No new external dependencies introduced

## All Needed Context

### Context Completeness Check

✅ This PRP includes:
- Complete codebase analysis with file paths and line numbers
- Existing error handling patterns to follow
- Database schema and configuration key names
- UI component structure and state management patterns
- Service layer patterns and dependency injection
- Azure OpenAI API behavior documentation
- FastAPI lifecycle and validation best practices
- All necessary context for one-pass implementation

### Documentation & References

```yaml
# Azure OpenAI API Behavior
- url: https://learn.microsoft.com/en-us/answers/questions/2279089/error-404-in-azure-openai-services
  why: Understanding Azure 404 error ambiguity (auth vs deployment)
  critical: |
    Azure returns 404 for BOTH authentication failures AND missing deployments.
    This is intentional (security by obscurity). Client must check both scenarios.
    Authentication failures typically result in 403, but sometimes 404.

- url: https://learn.microsoft.com/en-us/answers/questions/1189176/how-do-i-resolve-error-deploymentnotfound-for-azur
  why: Common Azure OpenAI deployment configuration issues
  critical: |
    Must use deployment name (e.g., "gpt-4o-mini"), NOT model name.
    Deployment names are case-sensitive.
    Endpoint must be base URL only: https://{resource}.openai.azure.com

# FastAPI Lifecycle Patterns
- url: https://medium.com/@dynamicy/fastapi-starlette-lifecycle-guide-startup-order-pitfalls-best-practices-and-a-production-ready-53e29dcb9249
  why: Proper lifecycle management and startup validation patterns
  critical: |
    Use lifespan context manager for startup validation.
    Validation should be non-blocking (log warnings, don't raise).
    Heavy resources should be initialized in lifespan, not module import.

- url: https://github.com/zhanymkanov/fastapi-best-practices
  why: FastAPI best practices for 2025 (Pydantic v2, validation patterns)
  critical: |
    Use Pydantic for schema validation.
    Use dependencies for complex validations (DB calls, external services).
    Structure: API Route → Service → Database

# Codebase Patterns
- file: python/src/server/api_routes/providers_api.py
  lines: 220-244
  why: Existing error handling pattern for Azure OpenAI tests
  pattern: |
    try:
        # Azure API call
    except ValueError as e:
        return {"ok": False, "reason": "config_missing", "message": str(e)}
    except Exception as e:
        # Classify error by content
        error_msg = str(e)
        if "401" in error_msg or "Unauthorized" in error_msg:
            message = "Invalid API key..."
        elif "404" in error_msg or "NotFoundError" in error_msg:
            message = "Deployment not found..."
        # ...
        return {"ok": False, "reason": "connection_failed", "message": message}
  gotcha: |
    Current code incorrectly assumes 404 = deployment missing.
    Must update to show BOTH possible causes (auth OR deployment).

- file: python/src/server/services/credential_service.py
  lines: 503-532
  why: API key retrieval pattern with fallback logic
  pattern: |
    async def _get_provider_api_key(self, provider: str, use_embedding_provider: bool = False):
        # Try specific key first (chat or embedding)
        if use_embedding_provider:
            key = await self.get_setting("AZURE_OPENAI_EMBEDDING_API_KEY")
            if key and key != "ollama":
                return key
        else:
            key = await self.get_setting("AZURE_OPENAI_CHAT_API_KEY")
            if key and key != "ollama":
                return key

        # Fallback to shared key
        key = await self.get_setting("AZURE_OPENAI_API_KEY")
        if key and key != "ollama":
            return key

        return None  # ⚠️ No API key found
  gotcha: |
    Method returns None if no API key configured.
    Calling code must validate this before making API calls.

- file: python/src/server/main.py
  lines: 71-149
  why: Application lifespan pattern for startup/shutdown
  pattern: |
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Startup
        logger.info("🚀 Starting Archon backend...")
        await initialize_database_schema()
        await initialize_credentials()
        setup_logfire(service_name="archon-backend")
        await initialize_crawler()
        # ... more startup tasks

        yield  # Application runs here

        # Shutdown
        await cleanup_crawler()
  gotcha: |
    Use lifespan, not @app.on_event("startup") (deprecated in FastAPI 0.109+).
    Validation should be non-blocking (catch exceptions, log, don't raise).

- file: python/src/server/utils/__init__.py
  lines: 85-120
  why: Module export pattern for new utilities
  pattern: |
    from .migrations import (
        check_table_exists,
        ensure_schema_exists,
        initialize_database_schema,
        MigrationError,
    )

    __all__ = [
        "check_table_exists",
        "ensure_schema_exists",
        # ...
    ]
  gotcha: |
    Must add new functions to __all__ for proper module exports.

- file: archon-ui-main/src/components/settings/RAGSettings.tsx
  lines: 200-219
  why: Endpoint URL normalization pattern
  pattern: |
    const normalizeAzureEndpoint = (endpoint: string): string => {
      if (!endpoint) return '';
      let normalized = endpoint.trim();

      try {
        const url = new URL(normalized);
        return `${url.protocol}//${url.host}`;  // Base URL only
      } catch {
        // Fallback regex if URL parsing fails
        normalized = normalized.replace(/\/openai.*$/i, '');
        return normalized;
      }
    };
  gotcha: |
    Users often paste full API path instead of base URL.
    Must extract base URL (protocol + host only).
```

### Current Codebase Tree

```bash
python/src/server/
├── api_routes/
│   ├── providers_api.py          # Azure test endpoint (lines 220-244)
│   └── ...
├── services/
│   ├── credential_service.py     # API key retrieval (lines 503-532)
│   ├── llm_provider_service.py   # Provider initialization
│   └── ...
├── utils/
│   ├── __init__.py               # Module exports
│   ├── migrations.py             # DB schema initialization
│   └── ...
├── config/
│   ├── config.py                 # Configuration management
│   └── providers.py              # Provider configuration
└── main.py                       # Application lifespan (lines 71-149)

archon-ui-main/src/components/settings/
└── RAGSettings.tsx               # Settings UI (lines 200-239, 400-500)
```

### Desired Codebase Tree (Files to Add)

```bash
python/src/server/utils/
└── startup_checks.py             # NEW: Startup validation module
    ├── validate_azure_openai_config()
    ├── _validate_azure_chat_config()
    ├── _validate_azure_embedding_config()
    └── run_all_startup_checks()
```

### Known Gotchas & Library Quirks

```python
# CRITICAL: Azure OpenAI API Returns 404 for BOTH Auth Failures AND Missing Deployments
# This is a security feature (security by obscurity) to avoid leaking deployment info.
# Client MUST check BOTH scenarios when handling 404 errors.
#
# Example Azure errors:
# - 401 "Unauthorized" → Invalid/missing API key
# - 404 "DeploymentNotFound" → Could be:
#     1. Invalid/missing API key (Azure returns 404 instead of 401 sometimes)
#     2. Deployment doesn't exist
#     3. Deployment name is misspelled (case-sensitive)
# - 429 "RateLimitError" → Quota exceeded
# - Timeout → Network/firewall issues

# CRITICAL: FastAPI 0.109+ uses lifespan, not @app.on_event("startup")
# Old pattern (deprecated):
# @app.on_event("startup")
# async def startup_event():
#     pass
#
# New pattern (required):
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     # startup
#     yield
#     # shutdown

# CRITICAL: Startup validation must be non-blocking
# Don't raise exceptions for config issues - allow app to start so users can fix via UI
# Pattern:
# try:
#     await validate_config()
# except Exception as e:
#     logger.error(f"Config validation failed (non-fatal): {e}")
#     # Continue startup anyway

# CRITICAL: Azure endpoint format validation
# ✅ Correct: https://YOUR_RESOURCE.openai.azure.com
# ❌ Wrong: https://YOUR_RESOURCE.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=...
# Users often paste full API path from Azure Portal. Must extract base URL only.

# CRITICAL: Deployment name vs Model name
# Deployment name: User-defined in Azure Portal (e.g., "gpt-4o-mini", "my-embedding-model")
# Model name: OpenAI-defined (e.g., "gpt-4-0125-preview", "text-embedding-3-large")
# MUST use deployment name in API calls, NOT model name.

# CRITICAL: API key fallback logic
# New keys (Dec 15, 2025 change):
#   - AZURE_OPENAI_CHAT_API_KEY (for LLM)
#   - AZURE_OPENAI_EMBEDDING_API_KEY (for embeddings)
# Legacy key (backward compatibility):
#   - AZURE_OPENAI_API_KEY (shared for both)
# Fallback order:
#   1. Try specific key (chat or embedding)
#   2. Try shared/legacy key
#   3. Return None (no key configured)

# CRITICAL: OpenAI SDK AsyncAzureOpenAI client
# from openai import AsyncAzureOpenAI
# client = AsyncAzureOpenAI(
#     api_key=api_key,
#     azure_endpoint=endpoint,  # NOT base_url
#     api_version="2024-02-15-preview"
# )
#
# azure_endpoint must be base URL only (no /openai/deployments/ path)
```

## Implementation Blueprint

### Data Models and Structure

```python
# No new data models required - using existing database schema:
#
# Database: archon_settings table (already exists)
# Key settings for Azure OpenAI:
#   - LLM_PROVIDER = "azure-openai"
#   - EMBEDDING_PROVIDER = "azure-openai"
#   - AZURE_OPENAI_API_VERSION = "2024-02-15-preview"
#
#   Chat Configuration:
#   - AZURE_OPENAI_CHAT_ENDPOINT
#   - AZURE_OPENAI_CHAT_DEPLOYMENT
#   - AZURE_OPENAI_CHAT_API_KEY (encrypted)
#
#   Embedding Configuration:
#   - AZURE_OPENAI_EMBEDDING_ENDPOINT
#   - AZURE_OPENAI_EMBEDDING_DEPLOYMENT
#   - AZURE_OPENAI_EMBEDDING_API_KEY (encrypted)
#
#   Shared/Legacy:
#   - AZURE_OPENAI_API_KEY (encrypted, fallback)

# API Response Model (already exists in providers_api.py):
# {
#   "ok": bool,
#   "reason": str,  # "connected" | "invalid_key" | "connection_failed" | "config_missing"
#   "message": str,
#   "details": dict (optional)
# }
```

### Implementation Tasks (Ordered by Dependencies)

```yaml
Task 1: MODIFY python/src/server/api_routes/providers_api.py
  location: Lines 220-244 (Azure error handling in test endpoint)
  action: Enhance error classification and messaging
  changes:
    - Update 401/Unauthorized detection → "❌ Authentication failed" message
    - Update 404/NotFoundError detection → "⚠️ Deployment not found OR authentication failed" message
    - Add timeout detection → "⏱️ Connection timeout" message
    - Add 429/rate limit detection → "🚦 Rate limit exceeded" message
    - Add generic error fallback with common troubleshooting tips
    - Include error_details in response for debugging
  follow_pattern: Existing try/except structure (lines 220-244)
  naming: Keep existing function name and structure
  dependencies: None (standalone improvement)
  validation: |
    # Test with missing API key → should show auth error
    curl -X POST http://localhost:8181/api/test/provider/azure-openai \
      -H "Content-Type: application/json" \
      -d '{"config_type": "chat"}'

    # Should return:
    # {"ok": false, "reason": "connection_failed",
    #  "message": "❌ Authentication failed. Please check that your API key..."}

Task 2: CREATE python/src/server/utils/startup_checks.py
  action: New startup validation module
  implement:
    - validate_azure_openai_config() → Check if Azure is active, validate config
    - _validate_azure_chat_config(issues: list) → Validate chat API key, endpoint, deployment
    - _validate_azure_embedding_config(issues: list) → Validate embedding API key, endpoint, deployment
    - run_all_startup_checks() → Entry point for all startup validations
  follow_pattern: python/src/server/services/credential_service.py (async service methods)
  naming: |
    - Functions: snake_case (validate_*, _validate_*, run_*)
    - Private functions: prefix with _ (_validate_azure_chat_config)
    - Return types: Tuple[bool, list[str]] for validation results
  dependencies: credential_service for getting settings
  placement: python/src/server/utils/startup_checks.py (NEW FILE)
  validation: |
    # Test validation with missing API key
    uv run python -c "
    import asyncio
    from src.server.utils.startup_checks import run_all_startup_checks
    asyncio.run(run_all_startup_checks())
    "

    # Should log:
    # 🔍 Validating Azure OpenAI configuration...
    # ❌ Azure OpenAI configuration has 1 issue(s):
    #    1. Chat API key not configured. Set 'AZURE_OPENAI_CHAT_API_KEY'...

Task 3: MODIFY python/src/server/main.py
  location: Lines 100-127 (lifespan startup section, after prompt service init)
  action: Integrate startup validation
  changes:
    - Import run_all_startup_checks from utils.startup_checks
    - Add try/except block to call run_all_startup_checks()
    - Log errors but don't raise (non-blocking validation)
  follow_pattern: Existing startup tasks (lines 100-127, e.g., prompt service init)
  placement: After prompt_service.load_prompts(), before _initialization_complete = True
  preserve: All existing startup tasks and error handling
  validation: |
    # Start Archon and check logs
    docker compose restart archon-server
    docker logs archon-server --tail 50

    # Should see:
    # 🚀 Starting Archon backend...
    # ✅ Credentials initialized
    # 🔍 Validating Azure OpenAI configuration...
    # ✅ All startup checks passed  (or ❌ issues if config invalid)
    # 🎉 Archon backend started successfully!

Task 4: MODIFY python/src/server/utils/__init__.py
  action: Export new startup validation functions
  changes:
    - Import run_all_startup_checks, validate_azure_openai_config from .startup_checks
    - Add to __all__ list
  follow_pattern: Existing migration function exports (lines 51-57, 114-119)
  placement: After migration imports, before Threading service section
  validation: |
    # Test import
    uv run python -c "from src.server.utils import run_all_startup_checks; print('✅ Import works')"

Task 5: MODIFY archon-ui-main/src/components/settings/RAGSettings.tsx
  location: Lines ~290-330 (test results display section)
  action: Add troubleshooting tips below failed test results
  changes:
    - Add conditional div below test result message
    - Show only when !testResults[key].ok (failure state)
    - Include bulleted list with specific troubleshooting steps
    - Mention relevant settings fields and Azure Portal locations
  follow_pattern: Existing test result rendering with conditional styling
  naming: Keep existing testResults state and handlers
  validation: |
    # Manual UI test:
    # 1. Open http://localhost:3737 → Settings → Providers → Azure OpenAI
    # 2. Remove API key, click "Test Connection"
    # 3. Should see troubleshooting tips below error message

Task 6: MODIFY archon-ui-main/src/components/settings/RAGSettings.tsx
  location: Lines ~400-500 (input field definitions)
  action: Add tooltip hints and help text to key input fields
  changes:
    - Add tooltip icon (ℹ️) next to "Chat API Key" label
    - Add help text below input: "Find this in Azure Portal → Azure OpenAI → Keys and Endpoint"
    - Add tooltip icon next to "Endpoint" label
    - Add help text with correct/incorrect format examples
    - Add tooltip icon next to "Deployment Name" label
    - Add help text: "Use your deployment name, not model name"
  follow_pattern: Existing input field structure with label/input/help text
  naming: Keep existing azureSettings state and setAzureSettings handler
  validation: |
    # Manual UI test:
    # 1. Hover over ℹ️ icons → should show tooltip
    # 2. Check that help text is visible below inputs
    # 3. Verify examples are clear and helpful

Task 7: VALIDATE all changes with comprehensive testing
  actions:
    - Run syntax/style checks: ruff check --fix, mypy, ruff format
    - Run backend unit tests: uv run pytest python/src/server/
    - Start Archon: docker compose up -d
    - Check startup logs for validation messages
    - Test Azure connection with valid credentials → should succeed
    - Test Azure connection with missing API key → should show auth error
    - Test Azure connection with wrong deployment → should show combined error
    - Verify UI shows troubleshooting tips on failures
    - Verify UI tooltips and help text are visible
  validation: All success criteria must pass (see Success Criteria section)
```

### Implementation Patterns & Key Details

```python
# Pattern 1: Enhanced Azure Error Classification
# File: python/src/server/api_routes/providers_api.py (lines 220-244)

async def test_azure_openai_config(config_type: str) -> dict:
    """Test Azure OpenAI configuration (chat or embedding)."""
    try:
        # ... existing API call logic ...

    except ValueError as e:
        # Configuration missing (no API key, endpoint, or deployment)
        return {
            "ok": False,
            "reason": "config_missing",
            "message": str(e)
        }
    except Exception as e:
        # ENHANCED: Classify error by content and status code
        error_msg = str(e)
        error_lower = error_msg.lower()

        # Authentication errors
        if "401" in error_msg or "unauthorized" in error_lower or "authentication" in error_lower:
            message = (
                f"❌ Authentication failed. "
                f"Please check that your API key is configured correctly. "
                f"Go to Settings → Providers → Azure OpenAI and verify: "
                f"1) 'Chat API Key' or 'Shared API Key' is set, "
                f"2) Key is valid and not expired."
            )

        # CRITICAL: Azure returns 404 for BOTH auth failures AND missing deployments
        elif "404" in error_msg or "notfounderror" in error_lower:
            deployment = "<deployment_name>"  # Get from config
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

        # Timeout errors
        elif "timeout" in error_lower or "timed out" in error_lower:
            message = (
                f"⏱️  Connection timeout. Please check:\n"
                f"1) Endpoint URL is correct and reachable\n"
                f"2) Network connectivity (firewall, proxy)\n"
                f"3) Azure service is operational"
            )

        # Rate limiting
        elif "429" in error_msg or "rate limit" in error_lower:
            message = (
                f"🚦 Rate limit exceeded. "
                f"Your Azure OpenAI deployment has reached its quota. "
                f"Please wait and try again, or check quota in Azure Portal."
            )

        # Generic error
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
            "reason": "connection_failed",
            "message": message,
            "error_details": str(e),  # For debugging
        }


# Pattern 2: Startup Validation Module
# File: python/src/server/utils/startup_checks.py (NEW)

"""Startup validation checks for Archon configuration."""

import logging
from typing import Tuple

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
        # Check if Azure OpenAI is active
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
            # Check for malformed endpoint
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
    # Similar structure to _validate_azure_chat_config
    # Check API key, deployment, endpoint for embedding provider


async def run_all_startup_checks() -> dict:
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


# Pattern 3: Lifespan Integration
# File: python/src/server/main.py (add after line 119, before line 126)

# Add import at top of file
from .utils.startup_checks import run_all_startup_checks

# In lifespan function, after prompt service initialization:
try:
    from .services.prompt_service import prompt_service
    await prompt_service.load_prompts()
    api_logger.info("✅ Prompt service initialized")
except Exception as e:
    api_logger.warning(f"Could not initialize prompt service: {e}")

# NEW: Run configuration validation (non-blocking)
try:
    api_logger.info("Running configuration validation checks...")
    await run_all_startup_checks()
except Exception as e:
    api_logger.error(f"Startup validation failed (non-fatal): {e}")
    # Don't raise - allow startup to continue

# Mark initialization as complete
_initialization_complete = True
api_logger.info("🎉 Archon backend started successfully!")


# Pattern 4: UI Troubleshooting Tips
# File: archon-ui-main/src/components/settings/RAGSettings.tsx (lines ~290)

{testResults[key] && (
  <div className={`mt-2 p-3 rounded ${
    testResults[key].ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }`}>
    <div className="flex items-center">
      {testResults[key].ok ? '✅' : '❌'}
      <span className="ml-2">{testResults[key].message}</span>
    </div>

    {/* NEW: Troubleshooting tips on failure */}
    {!testResults[key].ok && (
      <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-yellow-800">
        <div className="font-semibold mb-2">💡 Troubleshooting Tips:</div>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>API Key:</strong> Verify you've entered your Azure OpenAI API key
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
          <strong>Still having issues?</strong> Check the server logs:
          <code className="ml-1 px-2 py-1 bg-gray-200 rounded">docker logs archon-server --tail 50</code>
        </div>
      </div>
    )}
  </div>
)}


# Pattern 5: UI Input Field Tooltips
# File: archon-ui-main/src/components/settings/RAGSettings.tsx (lines ~400-500)

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

### Integration Points

```yaml
DATABASE:
  - No schema changes required
  - Uses existing archon_settings table
  - Keys: AZURE_OPENAI_CHAT_API_KEY, AZURE_OPENAI_EMBEDDING_API_KEY, etc.

CONFIG:
  - No new config required
  - Uses existing credential_service for settings retrieval

SERVICES:
  - credential_service: Retrieve Azure settings (API keys, endpoints, deployments)
  - llm_provider_service: Provider cache invalidation (already implemented)

API ROUTES:
  - providers_api.py: Enhanced error messages in test endpoint
  - No new routes required

UI COMPONENTS:
  - RAGSettings.tsx: Enhanced with troubleshooting tips and tooltips
  - No new components required

STARTUP:
  - main.py lifespan: Call run_all_startup_checks() after other initialization
  - Non-blocking validation (log warnings, don't raise exceptions)
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after each file modification
cd python

# Format code
ruff format src/server/utils/startup_checks.py
ruff format src/server/api_routes/providers_api.py
ruff format src/server/main.py
ruff format src/server/utils/__init__.py

# Lint with auto-fix
ruff check src/server/utils/startup_checks.py --fix
ruff check src/server/api_routes/providers_api.py --fix
ruff check src/server/main.py --fix
ruff check src/server/utils/__init__.py --fix

# Type checking
mypy src/server/utils/startup_checks.py
mypy src/server/api_routes/providers_api.py
mypy src/server/main.py

# Project-wide validation
ruff check src/ --fix
mypy src/
ruff format src/

# Expected: Zero errors. If errors exist, READ output and fix before proceeding.
```

### Level 2: Unit Tests (Component Validation)

```bash
# Test specific modules
uv run pytest python/src/server/tests/ -v -k "azure"
uv run pytest python/src/server/tests/ -v -k "provider"

# Run all backend tests
uv run pytest python/src/server/ -v

# Expected: All tests pass. If failing, debug and fix implementation.
```

### Level 3: Integration Testing (System Validation)

```bash
# Start Archon services
cd ~/Documents/Projects/archon
docker compose up -d

# Wait for startup
sleep 10

# Check startup logs for validation messages
docker logs archon-server --tail 100 | grep -E "🔍|✅|❌"

# Expected output:
# 🚀 Starting Archon backend...
# 🔍 Validating Azure OpenAI configuration...
# ✅ All startup checks passed (or ❌ issues if config invalid)
# 🎉 Archon backend started successfully!

# Test Azure connection endpoint (manual)
# 1. Open http://localhost:3737
# 2. Navigate to Settings → Providers → Azure OpenAI
# 3. Configure endpoint, deployment, API key
# 4. Click "Test Connection"
# 5. Verify error messages are clear and actionable

# Test with missing API key
# 1. Remove API key from settings
# 2. Click "Test Connection"
# 3. Expected: "❌ Authentication failed..." message with troubleshooting tips

# Test with wrong deployment
# 1. Enter non-existent deployment name
# 2. Click "Test Connection"
# 3. Expected: "⚠️ Deployment not found OR authentication failed..." message

# Health check
curl -f http://localhost:8181/health || echo "Health check failed"

# Backend API availability
curl http://localhost:8181/api/settings/active-providers | jq .

# Expected: All services running, no connection errors
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Manual User Journey Testing
echo "
USER JOURNEY TEST PLAN:
1. Fresh Installation Scenario:
   - Clear all Azure settings
   - Start Archon
   - Check startup logs → should skip Azure validation (not active)

2. Configuration Scenario:
   - Set LLM_PROVIDER to 'azure-openai'
   - Restart Archon
   - Check startup logs → should show validation warnings (missing config)

3. Partial Configuration Scenario:
   - Add endpoint and deployment, but no API key
   - Restart Archon
   - Check startup logs → should show 'Chat API key not configured'

4. Full Configuration Scenario:
   - Add valid API key, endpoint, deployment
   - Restart Archon
   - Check startup logs → should show '✅ Azure OpenAI configuration is valid'
   - Test connection in UI → should succeed

5. Error Recovery Scenario:
   - Remove API key (simulate config issue)
   - Test connection → should show auth error with tips
   - Add API key back
   - Test connection → should succeed
   - Verify no restart needed (cache invalidation works)
"

# UI/UX Validation
echo "
UI/UX TEST PLAN:
1. Tooltip Visibility:
   - Hover over ℹ️ icons on API Key, Endpoint, Deployment fields
   - Verify tooltips appear

2. Help Text Clarity:
   - Read help text below each input field
   - Verify examples are clear and correct

3. Error Message Actionability:
   - Trigger each error type (auth, 404, timeout, rate limit)
   - Verify each shows specific troubleshooting steps

4. Troubleshooting Tips Display:
   - Test connection with invalid config
   - Verify yellow troubleshooting box appears
   - Verify tips are relevant to the specific error

5. Mobile Responsiveness:
   - Resize browser to mobile width
   - Verify troubleshooting tips don't overflow
   - Verify tooltips still work on mobile
"

# Log Analysis
docker logs archon-server 2>&1 | grep -A 5 "Validating Azure OpenAI"

# Performance baseline
# Test connection response time (should be < 5 seconds)
time curl -X POST http://localhost:8181/api/test/provider/azure-openai \
  -H "Content-Type: application/json" \
  -d '{"config_type": "chat"}'

# Expected: Response within 5 seconds
```

## Final Validation Checklist

### Technical Validation

- [ ] All 4 validation levels completed successfully
- [ ] All tests pass: `uv run pytest python/src/server/ -v`
- [ ] No linting errors: `ruff check python/src/server/`
- [ ] No type errors: `mypy python/src/server/`
- [ ] No formatting issues: `ruff format python/src/server/ --check`
- [ ] Backend starts without errors: `docker compose up -d && docker logs archon-server`
- [ ] Frontend builds without errors: `cd archon-ui-main && npm run build`

### Feature Validation

- [ ] Azure OpenAI chat test succeeds with valid credentials
- [ ] Azure OpenAI embedding test succeeds with valid credentials
- [ ] Missing API key shows "❌ Authentication failed" error
- [ ] Wrong deployment shows "⚠️ Deployment not found OR authentication failed" error
- [ ] Timeout shows "⏱️ Connection timeout" error
- [ ] Rate limit shows "🚦 Rate limit exceeded" error
- [ ] Startup validation catches missing API keys
- [ ] Startup validation catches malformed endpoints
- [ ] Startup validation is non-blocking (app starts even with invalid config)
- [ ] UI shows troubleshooting tips below failed tests
- [ ] UI input fields have helpful tooltips
- [ ] UI help text shows correct format examples

### User Experience Validation

- [ ] User can successfully configure Azure OpenAI from scratch
- [ ] User can troubleshoot issues without checking server logs
- [ ] Error messages clearly indicate what to check/fix
- [ ] Troubleshooting tips are specific to the error type
- [ ] Tooltips provide proactive guidance
- [ ] Help text shows correct vs incorrect examples
- [ ] Configuration changes take effect without restart (cache invalidation)

### Code Quality Validation

- [ ] New code follows existing patterns (lifespan, service methods, error handling)
- [ ] File placement matches desired codebase tree
- [ ] Logging is consistent with existing code (emoji prefixes, log levels)
- [ ] Error handling is appropriate (non-blocking validation, detailed errors)
- [ ] No new external dependencies introduced
- [ ] Changes are backward compatible (fallback key support)

### Documentation & Deployment

- [ ] Implementation plan document updated (this file)
- [ ] Code is self-documenting with clear function names
- [ ] Logs provide actionable information
- [ ] No new environment variables needed

---

## Anti-Patterns to Avoid

- ❌ Don't assume 404 errors are always deployment issues (could be auth)
- ❌ Don't block startup on validation failures (must be non-blocking)
- ❌ Don't raise exceptions in startup validation (log warnings instead)
- ❌ Don't add new dependencies for this feature (use existing libraries)
- ❌ Don't use @app.on_event("startup") (deprecated, use lifespan)
- ❌ Don't skip cache invalidation (credential_service already handles this)
- ❌ Don't hardcode error messages (make them contextual and informative)
- ❌ Don't forget to export new functions in utils/__init__.py
- ❌ Don't test in production first (validate locally with all 4 levels)
- ❌ Don't overwhelm users with information (progressive disclosure - show tips only on failure)

---

## PRP Quality Score

**Confidence Level for One-Pass Implementation: 9/10**

**Strengths:**
- ✅ Complete codebase analysis with exact file paths and line numbers
- ✅ All existing patterns documented with code examples
- ✅ External documentation (Azure API behavior, FastAPI best practices)
- ✅ Clear task breakdown with dependencies and validation steps
- ✅ Executable validation commands at each level
- ✅ Comprehensive context for AI agent implementation
- ✅ Known gotchas and library quirks documented

**Minor Gaps (reducing score from 10 to 9):**
- ⚠️ Frontend component testing is manual (no automated UI tests specified)
- ⚠️ No unit tests for new startup_checks.py module (Task 7 mentions testing but no test file created)
- ⚠️ Exact line numbers for UI changes may shift (specified as ~290, ~400-500)

**Mitigation:**
- Manual UI testing plan provided in Level 4 validation
- Integration testing covers startup validation functionality
- Line number ranges provided with context (function names, section descriptions)

**Overall Assessment:**
This PRP provides comprehensive context for one-pass implementation. An AI agent with access to this document and the codebase should be able to implement all changes successfully without additional research.

---

**Created:** 2025-12-17
**Feature File Source:** `/home/ljutzkanov/Documents/Projects/archon/docs/archon_settings_fix_17122025.md`
**Template Used:** `PRPs/templates/prp_base.md` (v3)
**Estimated Implementation Time:** 2 hours 20 minutes (from feature file)
