# Centralized Provider Configuration

**Document Version:** 1.0.0
**Last Updated:** December 15, 2025
**Author:** Archon Development Team
**Related:** `AZURE_OPENAI_SETTINGS_PERSISTENCE_FIX.md` (Prevention Implementation)

---

## Overview

This document describes the centralized provider configuration system that eliminates hardcoded provider lists scattered across the codebase. This system provides a single source of truth for all supported LLM providers, preventing bugs like the "Invalid provider name" error that occurred when Azure OpenAI was missing from validation lists.

**Benefits:**
- Single update point when adding new providers
- Type-safe provider references via enum
- Impossible to forget validation lists
- Consistent provider behavior across codebase
- Easier maintenance and testing

---

## Table of Contents

1. [Architecture](#architecture)
2. [Usage Guide](#usage-guide)
3. [Adding New Providers](#adding-new-providers)
4. [Migration from Hardcoded Lists](#migration-from-hardcoded-lists)
5. [API Reference](#api-reference)
6. [Testing](#testing)

---

## Architecture

### File Structure

```
python/src/server/config/
├── __init__.py
├── providers.py         # ← NEW: Centralized provider configuration
├── config.py
├── service_discovery.py
└── version.py
```

### Core Components

**File:** `python/src/server/config/providers.py`

```python
class ProviderType(str, Enum):
    """All supported LLM providers."""
    OPENAI = "openai"
    AZURE_OPENAI = "azure-openai"
    GOOGLE = "google"
    ANTHROPIC = "anthropic"
    GROK = "grok"
    OPENROUTER = "openrouter"
    OLLAMA = "ollama"

# Provider capability sets
EMBEDDING_CAPABLE_PROVIDERS = {...}
MULTI_MODEL_SUPPORT_PROVIDERS = {...}
NO_API_KEY_PROVIDERS = {...}

# Helper functions
def get_all_providers() -> list[str]
def is_valid_provider(provider: str) -> bool
def requires_api_key(provider: str) -> bool
def supports_embeddings(provider: str) -> bool
def get_provider_key_names(provider: str, use_embedding: bool) -> tuple
def get_provider_base_url(provider: str) -> str | None
```

### Files Updated to Use Centralized Config

1. **`api_routes/knowledge_api.py`** - Provider validation for knowledge item refresh
2. **`api_routes/providers_api.py`** - Provider validation for API tests (2 locations)
3. **`services/llm_provider_service.py`** - Multi-model provider checks (2 locations)
4. **`services/credential_service.py`** - API key name generation and base URL retrieval

---

## Usage Guide

### Validating Providers

**BEFORE (hardcoded):**
```python
# ❌ BAD: Hardcoded list, easy to forget updating
allowed_providers = {"openai", "ollama", "google", "openrouter", "anthropic", "grok"}
if provider not in allowed_providers:
    raise HTTPException(...)
```

**AFTER (centralized):**
```python
# ✅ GOOD: Single source of truth
from ..config.providers import is_valid_provider, get_all_providers

if not is_valid_provider(provider):
    allowed = get_all_providers()
    raise HTTPException(
        status_code=400,
        detail=f"Invalid provider '{provider}'. Allowed: {sorted(allowed)}"
    )
```

### Checking Provider Capabilities

**Example: Embedding Support**
```python
from ..config.providers import supports_embeddings

if not supports_embeddings(provider):
    raise HTTPException(
        status_code=400,
        detail=f"Provider '{provider}' cannot generate embeddings"
    )
```

**Example: Multi-Model Support**
```python
from ..config.providers import get_multi_model_providers

if provider_lower in get_multi_model_providers():
    # This provider supports both OpenAI and Google model formats
    return openai_models + google_models
```

### Getting API Key Names

**BEFORE (hardcoded mappings):**
```python
# ❌ BAD: Separate mappings for each function
if use_embedding_provider:
    key_mapping = {
        "openai": "OPENAI_EMBEDDING_API_KEY",
        "azure-openai": "AZURE_OPENAI_EMBEDDING_API_KEY",
        # ... 6 providers × 2 key types = 12+ lines
    }
```

**AFTER (centralized):**
```python
# ✅ GOOD: Single function handles all providers
from ..config.providers import get_provider_key_names

primary_key, fallback_key = get_provider_key_names(
    provider,
    use_embedding=use_embedding_provider
)
```

### Getting Base URLs

**BEFORE (hardcoded URLs):**
```python
# ❌ BAD: URL strings scattered in multiple files
if provider == "google":
    return "https://generativelanguage.googleapis.com/v1beta/openai/"
elif provider == "openrouter":
    return "https://openrouter.ai/api/v1"
# ... etc
```

**AFTER (centralized):**
```python
# ✅ GOOD: URLs managed in one place
from ..config.providers import get_provider_base_url

base_url = get_provider_base_url(provider)
```

---

## Adding New Providers

### Step-by-Step Guide

When adding a new LLM provider (e.g., "cohere"), follow this checklist:

#### 1. Update Provider Configuration

**File:** `python/src/server/config/providers.py`

```python
class ProviderType(str, Enum):
    # ... existing providers ...
    COHERE = "cohere"  # ← ADD NEW PROVIDER

# Add to capability sets
EMBEDDING_CAPABLE_PROVIDERS = {
    # ... existing providers ...
    ProviderType.COHERE,  # ← ADD IF SUPPORTS EMBEDDINGS
}

# Add base URL if needed
def get_provider_base_url(provider: str) -> str | None:
    base_urls = {
        # ... existing URLs ...
        "cohere": "https://api.cohere.ai/v1",  # ← ADD BASE URL
    }
    return base_urls.get(provider)
```

#### 2. Update Tests

**File:** `python/tests/test_provider_config.py`

```python
def test_provider_enum_coverage():
    expected_providers = {
        # ... existing providers ...
        "cohere",  # ← ADD TO EXPECTED SET
    }
    # ...
```

#### 3. Run Tests

```bash
docker exec archon-server pytest tests/test_provider_config.py -v
```

**Expected:** All tests should pass, including new provider.

#### 4. Add Provider-Specific Logic (if needed)

Only add provider-specific logic in service files if the provider has unique requirements:

**File:** `services/llm_provider_service.py`

```python
elif provider_lower == "cohere":
    # Cohere-specific configuration
    client = CohereClient(api_key=api_key)
```

#### 5. Test Integration

1. Add API key via UI: Settings → API Keys → `COHERE_API_KEY`
2. Select provider in Settings → RAG Settings
3. Test connectivity
4. Verify knowledge item refresh works
5. Test embedding generation

---

## Migration from Hardcoded Lists

### Files Migrated

**✅ Completed Migration:**

1. `knowledge_api.py:72` - Provider validation for refresh
2. `providers_api.py:111` - Provider validation for status endpoint
3. `providers_api.py:463` - Provider validation for test endpoint
4. `llm_provider_service.py:785` - Multi-model provider check
5. `llm_provider_service.py:835` - Multi-model embedding models
6. `credential_service.py:503-570` - API key name generation
7. `credential_service.py:534-546` - Base URL retrieval

### Before/After Comparison

**Lines of Code Reduced:**
- `knowledge_api.py`: 9 lines → 4 lines (import + validation)
- `providers_api.py`: 6 lines → 3 lines (per location)
- `credential_service.py`: 67 lines → 20 lines (key mappings eliminated)

**Total:** ~90 lines of hardcoded provider logic → ~30 lines of centralized configuration

**Maintenance Burden:**
- Before: Update 7 locations when adding provider
- After: Update 1 location (providers.py)

---

## API Reference

### Core Functions

#### `get_all_providers() -> list[str]`

Returns list of all supported provider names.

```python
>>> get_all_providers()
['openai', 'azure-openai', 'google', 'anthropic', 'grok', 'openrouter', 'ollama']
```

---

#### `is_valid_provider(provider: str) -> bool`

Validates if provider name is supported.

```python
>>> is_valid_provider('openai')
True
>>> is_valid_provider('unknown-provider')
False
```

**Use Case:** Endpoint validation before processing requests.

---

#### `supports_embeddings(provider: str) -> bool`

Checks if provider can generate embeddings.

```python
>>> supports_embeddings('openai')
True
```

**Use Case:** Validate embedding provider selection.

---

#### `requires_api_key(provider: str) -> bool`

Checks if provider needs an API key.

```python
>>> requires_api_key('ollama')
False
>>> requires_api_key('openai')
True
```

**Use Case:** Skip authentication checks for providers like Ollama.

---

#### `get_provider_key_names(provider: str, use_embedding: bool) -> tuple[str | None, str | None]`

Returns (primary_key_name, fallback_key_name) for a provider.

```python
>>> get_provider_key_names('openai', use_embedding=True)
('OPENAI_EMBEDDING_API_KEY', 'OPENAI_API_KEY')

>>> get_provider_key_names('azure-openai', use_embedding=False)
('AZURE_OPENAI_CHAT_API_KEY', 'AZURE_OPENAI_API_KEY')

>>> get_provider_key_names('ollama')
(None, None)
```

**Use Case:** Fetch correct API key from database.

---

#### `get_provider_base_url(provider: str) -> str | None`

Returns base URL for provider API.

```python
>>> get_provider_base_url('openrouter')
'https://openrouter.ai/api/v1'

>>> get_provider_base_url('openai')
None  # Uses default
```

**Use Case:** Configure HTTP client with correct endpoint.

---

#### `get_embedding_capable_providers() -> list[str]`

Returns providers that support embeddings.

```python
>>> providers = get_embedding_capable_providers()
>>> 'azure-openai' in providers
True
```

---

#### `get_multi_model_providers() -> list[str]`

Returns providers that support multiple model formats (OpenAI + Google).

```python
>>> get_multi_model_providers()
['openrouter', 'anthropic', 'grok']
```

**Use Case:** Determine if provider can use both OpenAI and Google embedding models.

---

### Provider Capability Sets

#### `EMBEDDING_CAPABLE_PROVIDERS`

Set of providers that support embedding generation.

**Current Members:** All 7 providers (OpenAI, Azure OpenAI, Google, Anthropic, Grok, OpenRouter, Ollama)

---

#### `MULTI_MODEL_SUPPORT_PROVIDERS`

Providers that act as universal gateways supporting multiple model formats.

**Current Members:** OpenRouter, Anthropic, Grok

---

#### `NO_API_KEY_PROVIDERS`

Providers that don't require API keys.

**Current Members:** Ollama

---

## Testing

### Running Tests

```bash
# Run provider configuration tests
docker exec archon-server pytest tests/test_provider_config.py -v

# Run all tests
docker exec archon-server pytest -v
```

### Test Coverage

**File:** `tests/test_provider_config.py`

**Test Cases:**
1. ✅ `test_all_providers_returned` - Verifies all providers are listed
2. ✅ `test_embedding_capable_providers` - Checks embedding support
3. ✅ `test_multi_model_providers` - Validates multi-model providers
4. ✅ `test_requires_api_key` - Tests API key requirements
5. ✅ `test_is_valid_provider` - Validates provider names
6. ✅ `test_supports_embeddings` - Checks embedding support per provider
7. ✅ `test_get_provider_key_names` - Verifies key name generation
8. ✅ `test_get_provider_base_url` - Validates base URLs
9. ✅ `test_provider_enum_coverage` - Ensures enum completeness
10. ✅ `test_consistency_between_functions` - Cross-function consistency
11. ✅ `test_backwards_compatibility` - Verifies legacy key patterns

**Test Results (December 15, 2025):**
```
11 passed, 1 warning in 0.15s
```

### Adding Tests for New Providers

When adding a new provider, update tests:

```python
def test_provider_enum_coverage():
    expected_providers = {
        # ... existing ...
        "new-provider",  # ← ADD NEW PROVIDER
    }
```

Run tests to verify integration.

---

## Benefits Demonstrated

### Before Centralization

**Problem:** Azure OpenAI was added as a provider, but validation lists were updated inconsistently:

- ✅ `knowledge_api.py:72` - Had azure-openai
- ❌ `providers_api.py:111` - Missing azure-openai
- ✅ `providers_api.py:463` - Had azure-openai (but missing ollama!)
- N/A Multi-model providers listed separately

**Result:** Users got "Invalid provider name" errors when trying to refresh knowledge items with Azure OpenAI.

### After Centralization

**Solution:** Single source of truth ensures consistency:

1. Add provider to `ProviderType` enum
2. All validation automatically includes new provider
3. No possibility of forgetting validation lists
4. Type-safe provider references

**Result:** Adding providers is now a 1-step process instead of 7+ steps.

---

## Best Practices

### DO ✅

1. **Always use centralized functions** for provider validation
2. **Import from config.providers** instead of hardcoding lists
3. **Update tests** when adding new providers
4. **Use ProviderType enum** for type safety in new code
5. **Check capability sets** (embeddings, multi-model) before assuming support

### DON'T ❌

1. **Don't create new hardcoded provider lists** in service files
2. **Don't assume all providers have same capabilities** - check first
3. **Don't duplicate provider validation logic** - use centralized functions
4. **Don't forget to update capability sets** when adding providers
5. **Don't skip running tests** after provider changes

---

## Future Enhancements

### Potential Improvements

1. **Dynamic Provider Registration:**
   ```python
   # Allow plugins to register new providers at runtime
   ProviderRegistry.register("custom-provider", CustomProvider)
   ```

2. **Provider Configuration Validation:**
   ```python
   # Validate provider-specific settings at startup
   validate_provider_config("azure-openai")
   ```

3. **Provider Health Monitoring:**
   ```python
   # Track provider uptime and performance
   get_provider_health("openai")  # → {"status": "healthy", "latency": 120ms}
   ```

4. **Provider Feature Matrix:**
   ```python
   # Query specific provider capabilities
   supports_feature("openai", "function-calling")  # → True
   supports_feature("ollama", "vision")  # → False
   ```

---

## Related Documentation

- **Azure OpenAI Settings Persistence Fix:** `AZURE_OPENAI_SETTINGS_PERSISTENCE_FIX.md` - The issue that motivated this implementation
- **LLM Configuration Guide:** `LLM_CONFIGURATION_GUIDE.md` - General LLM provider configuration
- **Azure OpenAI Configuration:** `azure_openai_configuration.md` - Azure-specific setup

---

## Changelog

### Version 1.0.0 (December 15, 2025)

**Initial Implementation:**
- Created centralized provider configuration module
- Migrated 7 files to use centralized config
- Added comprehensive test suite (11 tests)
- Reduced hardcoded provider logic by ~60 lines

**Files Created:**
- `python/src/server/config/providers.py` - Core configuration
- `python/tests/test_provider_config.py` - Test suite
- `docs/CENTRALIZED_PROVIDER_CONFIGURATION.md` - This document

**Files Updated:**
- `api_routes/knowledge_api.py` - Provider validation
- `api_routes/providers_api.py` - Provider validation (2 locations)
- `services/llm_provider_service.py` - Multi-model checks (2 locations)
- `services/credential_service.py` - Key names and base URLs

**Benefits:**
- Single source of truth for providers
- Impossible to forget validation lists
- Type-safe provider references
- Easier maintenance

---

**End of Document**
