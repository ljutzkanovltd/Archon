"""
Centralized provider configuration.

This module provides a single source of truth for all supported LLM providers.
Update this file when adding new providers to ensure consistency across the codebase.

Pattern: Adding a new provider
1. Add provider to ProviderType enum
2. Add to appropriate capability sets (EMBEDDING_CAPABLE, MULTI_MODEL_SUPPORT, etc.)
3. Add API key mappings to get_provider_key_names() if needed
4. Add base URL to get_provider_base_url() if applicable
5. Run tests to ensure integration works
"""

from enum import Enum


class ProviderType(str, Enum):
    """Supported LLM providers.

    Each provider represents an LLM service that can be used for:
    - Chat/completion generation
    - Embedding generation (if embedding-capable)
    - Or both
    """

    OPENAI = "openai"
    AZURE_OPENAI = "azure-openai"
    GOOGLE = "google"
    ANTHROPIC = "anthropic"
    GROK = "grok"
    OPENROUTER = "openrouter"
    OLLAMA = "ollama"


# Providers that support embedding generation
EMBEDDING_CAPABLE_PROVIDERS = {
    ProviderType.OPENAI,
    ProviderType.AZURE_OPENAI,
    ProviderType.GOOGLE,
    ProviderType.ANTHROPIC,
    ProviderType.GROK,
    ProviderType.OPENROUTER,
    ProviderType.OLLAMA,
}

# Providers that support both OpenAI and Google model formats
# These providers act as universal gateways
MULTI_MODEL_SUPPORT_PROVIDERS = {
    ProviderType.OPENROUTER,
    ProviderType.ANTHROPIC,
    ProviderType.GROK,
}

# Providers that don't require API keys
NO_API_KEY_PROVIDERS = {
    ProviderType.OLLAMA,
}


def get_all_providers() -> list[str]:
    """Get list of all supported provider names.

    Returns:
        List of provider name strings (e.g., ['openai', 'azure-openai', ...])

    Example:
        >>> providers = get_all_providers()
        >>> 'openai' in providers
        True
    """
    return [provider.value for provider in ProviderType]


def get_embedding_capable_providers() -> list[str]:
    """Get list of providers that support embeddings.

    Returns:
        List of embedding-capable provider names

    Example:
        >>> providers = get_embedding_capable_providers()
        >>> 'azure-openai' in providers
        True
    """
    return [provider.value for provider in EMBEDDING_CAPABLE_PROVIDERS]


def get_multi_model_providers() -> list[str]:
    """Get providers that support both OpenAI and Google model formats.

    These providers can route requests to multiple underlying model providers.

    Returns:
        List of multi-model provider names

    Example:
        >>> providers = get_multi_model_providers()
        >>> 'openrouter' in providers
        True
    """
    return [provider.value for provider in MULTI_MODEL_SUPPORT_PROVIDERS]


def requires_api_key(provider: str) -> bool:
    """Check if provider requires an API key.

    Args:
        provider: Provider name (e.g., 'openai', 'ollama')

    Returns:
        False if provider doesn't need API key (like Ollama), True otherwise

    Example:
        >>> requires_api_key('ollama')
        False
        >>> requires_api_key('openai')
        True
    """
    try:
        provider_enum = ProviderType(provider)
        return provider_enum not in NO_API_KEY_PROVIDERS
    except ValueError:
        # Unknown provider, assume it needs a key
        return True


def is_valid_provider(provider: str) -> bool:
    """Validate if provider name is supported.

    Args:
        provider: Provider name to validate

    Returns:
        True if provider is supported, False otherwise

    Example:
        >>> is_valid_provider('openai')
        True
        >>> is_valid_provider('unknown-provider')
        False
    """
    try:
        ProviderType(provider)
        return True
    except ValueError:
        return False


def supports_embeddings(provider: str) -> bool:
    """Check if provider supports embedding generation.

    Args:
        provider: Provider name

    Returns:
        True if provider can generate embeddings, False otherwise

    Example:
        >>> supports_embeddings('openai')
        True
    """
    try:
        provider_enum = ProviderType(provider)
        return provider_enum in EMBEDDING_CAPABLE_PROVIDERS
    except ValueError:
        return False


def get_provider_key_names(provider: str, use_embedding: bool = False) -> tuple[str | None, str | None]:
    """Get the primary and fallback API key names for a provider.

    Args:
        provider: Provider name
        use_embedding: True for embedding-specific key, False for chat key

    Returns:
        Tuple of (primary_key_name, fallback_key_name)
        Returns (None, None) if provider doesn't need keys

    Example:
        >>> get_provider_key_names('openai', use_embedding=True)
        ('OPENAI_EMBEDDING_API_KEY', 'OPENAI_API_KEY')
        >>> get_provider_key_names('ollama')
        (None, None)
    """
    if provider == "ollama":
        return (None, None)

    # Convert to uppercase with underscores for key names
    provider_upper = provider.upper().replace('-', '_')

    if use_embedding:
        primary = f"{provider_upper}_EMBEDDING_API_KEY"
        fallback = f"{provider_upper}_API_KEY"
    else:
        primary = f"{provider_upper}_CHAT_API_KEY"
        fallback = f"{provider_upper}_API_KEY"

    return (primary, fallback)


def get_provider_base_url(provider: str) -> str | None:
    """Get the base URL for a provider.

    Args:
        provider: Provider name

    Returns:
        Base URL string, or None if provider uses default/custom endpoint

    Example:
        >>> get_provider_base_url('openrouter')
        'https://openrouter.ai/api/v1'
        >>> get_provider_base_url('openai')
        None
    """
    base_urls = {
        "google": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "openrouter": "https://openrouter.ai/api/v1",
        "anthropic": "https://api.anthropic.com/v1",
        "grok": "https://api.x.ai/v1",
    }

    return base_urls.get(provider)
