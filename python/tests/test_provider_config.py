"""
Tests for centralized provider configuration.

This test file verifies that the centralized provider configuration
works correctly and provides consistent results across the codebase.
"""

import pytest
from src.server.config.providers import (
    ProviderType,
    get_all_providers,
    get_embedding_capable_providers,
    get_multi_model_providers,
    requires_api_key,
    is_valid_provider,
    supports_embeddings,
    get_provider_key_names,
    get_provider_base_url,
)


def test_all_providers_returned():
    """Test that all providers are returned."""
    providers = get_all_providers()

    assert isinstance(providers, list)
    assert len(providers) > 0
    assert "openai" in providers
    assert "azure-openai" in providers
    assert "ollama" in providers


def test_embedding_capable_providers():
    """Test that embedding-capable providers are correctly identified."""
    providers = get_embedding_capable_providers()

    assert isinstance(providers, list)
    assert "openai" in providers
    assert "azure-openai" in providers
    # All current providers support embeddings
    assert len(providers) == len(get_all_providers())


def test_multi_model_providers():
    """Test that multi-model providers are correctly identified."""
    providers = get_multi_model_providers()

    assert isinstance(providers, list)
    assert "openrouter" in providers
    assert "anthropic" in providers
    assert "grok" in providers
    # OpenAI and Azure are not multi-model
    assert "openai" not in providers
    assert "azure-openai" not in providers


def test_requires_api_key():
    """Test API key requirement check."""
    # Ollama doesn't need API key
    assert requires_api_key("ollama") is False

    # Others need API keys
    assert requires_api_key("openai") is True
    assert requires_api_key("azure-openai") is True
    assert requires_api_key("google") is True
    assert requires_api_key("anthropic") is True
    assert requires_api_key("grok") is True
    assert requires_api_key("openrouter") is True

    # Unknown provider (assume needs key)
    assert requires_api_key("unknown-provider") is True


def test_is_valid_provider():
    """Test provider validation."""
    # Valid providers
    assert is_valid_provider("openai") is True
    assert is_valid_provider("azure-openai") is True
    assert is_valid_provider("ollama") is True

    # Invalid providers
    assert is_valid_provider("unknown") is False
    assert is_valid_provider("") is False
    assert is_valid_provider("fake-provider") is False


def test_supports_embeddings():
    """Test embedding support check."""
    # All current providers support embeddings
    for provider in get_all_providers():
        assert supports_embeddings(provider) is True

    # Unknown provider
    assert supports_embeddings("unknown") is False


def test_get_provider_key_names():
    """Test provider key name generation."""
    # Test OpenAI embedding keys
    primary, fallback = get_provider_key_names("openai", use_embedding=True)
    assert primary == "OPENAI_EMBEDDING_API_KEY"
    assert fallback == "OPENAI_API_KEY"

    # Test OpenAI chat keys
    primary, fallback = get_provider_key_names("openai", use_embedding=False)
    assert primary == "OPENAI_CHAT_API_KEY"
    assert fallback == "OPENAI_API_KEY"

    # Test Azure OpenAI with hyphens
    primary, fallback = get_provider_key_names("azure-openai", use_embedding=True)
    assert primary == "AZURE_OPENAI_EMBEDDING_API_KEY"
    assert fallback == "AZURE_OPENAI_API_KEY"

    # Test Ollama (no keys)
    primary, fallback = get_provider_key_names("ollama")
    assert primary is None
    assert fallback is None


def test_get_provider_base_url():
    """Test provider base URL retrieval."""
    # Providers with custom base URLs
    assert get_provider_base_url("google") == "https://generativelanguage.googleapis.com/v1beta/openai/"
    assert get_provider_base_url("openrouter") == "https://openrouter.ai/api/v1"
    assert get_provider_base_url("anthropic") == "https://api.anthropic.com/v1"
    assert get_provider_base_url("grok") == "https://api.x.ai/v1"

    # Providers without custom base URLs (use default)
    assert get_provider_base_url("openai") is None
    assert get_provider_base_url("azure-openai") is None
    assert get_provider_base_url("ollama") is None


def test_provider_enum_coverage():
    """Test that ProviderType enum covers all expected providers."""
    expected_providers = {
        "openai",
        "azure-openai",
        "google",
        "anthropic",
        "grok",
        "openrouter",
        "ollama",
    }

    enum_providers = {provider.value for provider in ProviderType}

    assert enum_providers == expected_providers


def test_consistency_between_functions():
    """Test consistency between different provider functions."""
    all_providers = get_all_providers()
    embedding_providers = get_embedding_capable_providers()
    multi_model = get_multi_model_providers()

    # All embedding-capable providers should be in all providers
    for provider in embedding_providers:
        assert provider in all_providers

    # All multi-model providers should be in all providers
    for provider in multi_model:
        assert provider in all_providers

    # All valid providers should be validatable
    for provider in all_providers:
        assert is_valid_provider(provider) is True


def test_backwards_compatibility():
    """Test that new config maintains backwards compatibility patterns."""
    # Key naming pattern should be consistent
    for provider in ["openai", "google", "anthropic", "grok", "openrouter"]:
        # Chat keys
        primary, fallback = get_provider_key_names(provider, use_embedding=False)
        assert primary.endswith("_CHAT_API_KEY")
        assert fallback.endswith("_API_KEY")

        # Embedding keys
        primary, fallback = get_provider_key_names(provider, use_embedding=True)
        assert primary.endswith("_EMBEDDING_API_KEY")
        assert fallback.endswith("_API_KEY")

    # Azure with hyphens handled correctly
    primary, _ = get_provider_key_names("azure-openai", use_embedding=False)
    assert "AZURE_OPENAI" in primary  # Hyphens converted to underscores
