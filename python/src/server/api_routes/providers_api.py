"""
Provider status API endpoints for testing connectivity

Handles server-side provider connectivity testing without exposing API keys to frontend.
"""

import httpx
from fastapi import APIRouter, HTTPException, Path

from ..config.logfire_config import logfire
from ..services.credential_service import credential_service
# Provider validation - simplified inline version

router = APIRouter(prefix="/api/providers", tags=["providers"])


async def test_openai_connection(api_key: str) -> bool:
    """Test OpenAI API connectivity"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            return response.status_code == 200
    except Exception as e:
        logfire.warning(f"OpenAI connectivity test failed: {e}")
        return False


async def test_google_connection(api_key: str) -> bool:
    """Test Google AI API connectivity"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://generativelanguage.googleapis.com/v1/models",
                headers={"x-goog-api-key": api_key}
            )
            return response.status_code == 200
    except Exception:
        logfire.warning("Google AI connectivity test failed")
        return False


async def test_anthropic_connection(api_key: str) -> bool:
    """Test Anthropic API connectivity"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01"
                }
            )
            return response.status_code == 200
    except Exception as e:
        logfire.warning(f"Anthropic connectivity test failed: {e}")
        return False


async def test_openrouter_connection(api_key: str) -> bool:
    """Test OpenRouter API connectivity"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            return response.status_code == 200
    except Exception as e:
        logfire.warning(f"OpenRouter connectivity test failed: {e}")
        return False


async def test_grok_connection(api_key: str) -> bool:
    """Test Grok API connectivity"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.x.ai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            return response.status_code == 200
    except Exception as e:
        logfire.warning(f"Grok connectivity test failed: {e}")
        return False


PROVIDER_TESTERS = {
    "openai": test_openai_connection,
    "google": test_google_connection,
    "anthropic": test_anthropic_connection,
    "openrouter": test_openrouter_connection,
    "grok": test_grok_connection,
}


@router.get("/{provider}/status")
async def get_provider_status(
    provider: str = Path(
        ...,
        description="Provider name to test connectivity for",
        regex="^[a-z0-9_]+$",
        max_length=20
    )
):
    """Test provider connectivity using server-side API key (secure)"""
    from ..config.providers import is_valid_provider, get_all_providers

    try:
        # Basic provider validation using centralized configuration
        if not is_valid_provider(provider):
            allowed = get_all_providers()
            raise HTTPException(
                status_code=400,
                detail=f"Invalid provider '{provider}'. Allowed providers: {sorted(allowed)}"
            )

        # Basic sanitization for logging
        safe_provider = provider[:20]  # Limit length
        logfire.info(f"Testing {safe_provider} connectivity server-side")

        if provider not in PROVIDER_TESTERS:
            raise HTTPException(
                status_code=400,
                detail=f"Provider '{provider}' not supported for connectivity testing"
            )

        # Get API key server-side (never expose to client)
        key_name = f"{provider.upper()}_API_KEY"
        api_key = await credential_service.get_credential(key_name, decrypt=True)

        if not api_key or not isinstance(api_key, str) or not api_key.strip():
            logfire.info(f"No API key configured for {safe_provider}")
            return {"ok": False, "reason": "no_key"}

        # Test connectivity using server-side key
        tester = PROVIDER_TESTERS[provider]
        is_connected = await tester(api_key)

        logfire.info(f"{safe_provider} connectivity test result: {is_connected}")
        return {
            "ok": is_connected,
            "reason": "connected" if is_connected else "connection_failed",
            "provider": provider  # Echo back validated provider name
        }

    except HTTPException:
        # Re-raise HTTP exceptions (they're already properly formatted)
        raise
    except Exception as e:
        # Basic error sanitization for logging
        safe_error = str(e)[:100]  # Limit length
        logfire.error(f"Error testing {provider[:20]} connectivity: {safe_error}")
        raise HTTPException(status_code=500, detail={"error": "Internal server error during connectivity test"})


async def test_azure_openai_credentials(
    api_key: str,
    config_type: str,
    cred_service
) -> dict:
    """
    Test Azure OpenAI credentials for chat or embedding configuration.

    Args:
        api_key: Azure OpenAI API key
        config_type: 'chat' or 'embedding'
        cred_service: Credential service instance

    Returns:
        dict with ok, reason, message, details
    """
    try:
        # Get Azure-specific configuration based on config type
        if config_type == "chat":
            endpoint = await cred_service.get_azure_chat_endpoint()
            api_version = await cred_service.get_azure_chat_api_version()
            deployment = await cred_service.get_azure_chat_deployment()
        else:  # embedding
            endpoint = await cred_service.get_azure_embedding_endpoint()
            api_version = await cred_service.get_azure_embedding_api_version()
            deployment = await cred_service.get_azure_embedding_deployment()

        # Log configuration (without API key) for debugging
        logfire.info(
            f"Testing Azure OpenAI {config_type} connection | "
            f"endpoint: {endpoint[:60]}... | "
            f"deployment: {deployment} | "
            f"api_version: {api_version}"
        )

        # Create Azure OpenAI client
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version,
            timeout=10.0
        )

        # Test with minimal API call
        if config_type == "chat":
            await client.chat.completions.create(
                model=deployment,
                messages=[{"role": "user", "content": "test"}],
                max_tokens=1
            )
        else:
            await client.embeddings.create(
                model=deployment,
                input="test"
            )

        await client.close()

        return {
            "ok": True,
            "reason": "connected",
            "message": f"✓ Successfully connected to Azure OpenAI {config_type} deployment '{deployment}'",
            "details": {"deployment": deployment, "endpoint": endpoint}
        }

    except ValueError as e:
        # Configuration missing or invalid
        return {
            "ok": False,
            "reason": "config_missing",
            "message": str(e)
        }
    except Exception as e:
        # API connection failed - provide helpful error messages
        error_msg = str(e)
        error_lower = error_msg.lower()

        # Authentication errors
        if "401" in error_msg or "unauthorized" in error_lower or "authentication" in error_lower:
            message = (
                f"❌ Authentication failed. "
                f"Please check that your API key is configured correctly. "
                f"Go to Settings → Providers → Azure OpenAI and verify: "
                f"1) '{config_type.capitalize()} API Key' or 'Shared API Key' is set, "
                f"2) Key is valid and not expired."
            )

        # CRITICAL: Azure returns 404 for BOTH auth failures AND missing deployments
        elif "404" in error_msg or "notfounderror" in error_lower:
            message = (
                f"⚠️  Deployment '{deployment}' not found OR authentication failed. "
                f"Azure returns this error for both scenarios. Please verify:\n\n"
                f"1. API Key Configuration:\n"
                f"   - Go to Settings → Providers → Azure OpenAI\n"
                f"   - Ensure '{config_type.capitalize()} API Key' or 'Shared API Key' is set\n"
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

        logfire.error(f"Azure OpenAI {config_type} test failed: {e}")
        return {
            "ok": False,
            "reason": "connection_failed",
            "message": message,
            "error_details": str(e)
        }


async def test_openai_detailed(api_key: str) -> dict:
    """Test OpenAI API key with detailed response"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )

            if response.status_code == 200:
                models = response.json().get("data", [])
                return {
                    "ok": True,
                    "reason": "connected",
                    "message": f"✓ Successfully connected to OpenAI ({len(models)} models available)",
                    "details": {"model_count": len(models)}
                }
            elif response.status_code == 401:
                return {
                    "ok": False,
                    "reason": "invalid_key",
                    "message": "Invalid API key. Please check your OpenAI API key."
                }
            else:
                return {
                    "ok": False,
                    "reason": "connection_failed",
                    "message": f"HTTP {response.status_code}: {response.text[:100]}"
                }

    except Exception as e:
        return {
            "ok": False,
            "reason": "connection_failed",
            "message": f"Connection failed: {str(e)}"
        }


async def test_google_detailed(api_key: str) -> dict:
    """Test Google AI API key with detailed response"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://generativelanguage.googleapis.com/v1/models",
                headers={"x-goog-api-key": api_key}
            )

            if response.status_code == 200:
                models = response.json().get("models", [])
                return {
                    "ok": True,
                    "reason": "connected",
                    "message": f"✓ Successfully connected to Google AI ({len(models)} models available)",
                    "details": {"model_count": len(models)}
                }
            elif response.status_code == 401 or response.status_code == 403:
                return {
                    "ok": False,
                    "reason": "invalid_key",
                    "message": "Invalid API key. Please check your Google AI API key."
                }
            else:
                return {
                    "ok": False,
                    "reason": "connection_failed",
                    "message": f"HTTP {response.status_code}"
                }

    except Exception as e:
        return {
            "ok": False,
            "reason": "connection_failed",
            "message": f"Connection failed: {str(e)}"
        }


async def test_anthropic_detailed(api_key: str) -> dict:
    """Test Anthropic API key with detailed response"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01"
                }
            )

            if response.status_code == 200:
                return {
                    "ok": True,
                    "reason": "connected",
                    "message": "✓ Successfully connected to Anthropic",
                    "details": {}
                }
            elif response.status_code == 401:
                return {
                    "ok": False,
                    "reason": "invalid_key",
                    "message": "Invalid API key. Please check your Anthropic API key."
                }
            else:
                return {
                    "ok": False,
                    "reason": "connection_failed",
                    "message": f"HTTP {response.status_code}"
                }

    except Exception as e:
        return {
            "ok": False,
            "reason": "connection_failed",
            "message": f"Connection failed: {str(e)}"
        }


async def test_grok_detailed(api_key: str) -> dict:
    """Test Grok API key with detailed response"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.x.ai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )

            if response.status_code == 200:
                models = response.json().get("data", [])
                return {
                    "ok": True,
                    "reason": "connected",
                    "message": f"✓ Successfully connected to Grok ({len(models)} models available)",
                    "details": {"model_count": len(models)}
                }
            elif response.status_code == 401:
                return {
                    "ok": False,
                    "reason": "invalid_key",
                    "message": "Invalid API key. Please check your Grok API key."
                }
            else:
                return {
                    "ok": False,
                    "reason": "connection_failed",
                    "message": f"HTTP {response.status_code}"
                }

    except Exception as e:
        return {
            "ok": False,
            "reason": "connection_failed",
            "message": f"Connection failed: {str(e)}"
        }


async def test_openrouter_detailed(api_key: str) -> dict:
    """Test OpenRouter API key with detailed response"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )

            if response.status_code == 200:
                models = response.json().get("data", [])
                return {
                    "ok": True,
                    "reason": "connected",
                    "message": f"✓ Successfully connected to OpenRouter ({len(models)} models available)",
                    "details": {"model_count": len(models)}
                }
            elif response.status_code == 401:
                return {
                    "ok": False,
                    "reason": "invalid_key",
                    "message": "Invalid API key. Please check your OpenRouter API key."
                }
            else:
                return {
                    "ok": False,
                    "reason": "connection_failed",
                    "message": f"HTTP {response.status_code}"
                }

    except Exception as e:
        return {
            "ok": False,
            "reason": "connection_failed",
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/test-credentials")
async def test_provider_credentials(request: dict):
    """
    Test provider credentials (API key + configuration).
    Supports testing both saved and unsaved API keys.

    Request body:
        {
            "provider": "openai" | "azure-openai" | "google" | "anthropic" | "grok" | "openrouter",
            "config_type": "chat" | "embedding" (for azure-openai only),
            "api_key": "sk-..." (optional, if not saved yet)
        }

    Returns:
        {
            "ok": bool,
            "reason": str,
            "message": str,
            "details": dict (optional)
        }
    """
    from ..config.providers import is_valid_provider, get_all_providers

    provider = request.get("provider", "").lower()
    config_type = request.get("config_type", "chat").lower()
    test_api_key = request.get("api_key", "").strip()

    try:
        # Validate provider using centralized configuration
        if not is_valid_provider(provider):
            allowed = get_all_providers()
            return {
                "ok": False,
                "reason": "invalid_provider",
                "message": f"Invalid provider '{provider}'. Allowed: {', '.join(sorted(allowed))}"
            }

        logfire.info(f"Testing {provider} credentials (config_type: {config_type})")

        # Get API key (use test key if provided, else fetch from database)
        if test_api_key:
            api_key = test_api_key
        else:
            # Fetch saved API key from database
            # All providers now support separate chat and embedding keys
            provider_upper = provider.upper().replace('-', '_')

            if config_type == "chat":
                # Try chat-specific key first
                key_name = f"{provider_upper}_CHAT_API_KEY"
                api_key = await credential_service.get_credential(key_name, decrypt=True)

                # Fallback to legacy single key for backward compatibility
                if not api_key:
                    key_name = f"{provider_upper}_API_KEY"
                    api_key = await credential_service.get_credential(key_name, decrypt=True)

            elif config_type == "embedding":
                # Try embedding-specific key first
                key_name = f"{provider_upper}_EMBEDDING_API_KEY"
                api_key = await credential_service.get_credential(key_name, decrypt=True)

                # Fallback to legacy single key for backward compatibility
                if not api_key:
                    key_name = f"{provider_upper}_API_KEY"
                    api_key = await credential_service.get_credential(key_name, decrypt=True)
            else:
                # No config_type specified, use legacy single key
                key_name = f"{provider_upper}_API_KEY"
                api_key = await credential_service.get_credential(key_name, decrypt=True)

            if not api_key or not isinstance(api_key, str) or not api_key.strip():
                return {
                    "ok": False,
                    "reason": "no_api_key",
                    "message": f"{provider} API key not configured. Please enter it in the settings."
                }

        # Test based on provider
        if provider == "azure-openai":
            result = await test_azure_openai_credentials(api_key, config_type, credential_service)
        elif provider == "openai":
            result = await test_openai_detailed(api_key)
        elif provider == "google":
            result = await test_google_detailed(api_key)
        elif provider == "anthropic":
            result = await test_anthropic_detailed(api_key)
        elif provider == "grok":
            result = await test_grok_detailed(api_key)
        elif provider == "openrouter":
            result = await test_openrouter_detailed(api_key)
        else:
            result = {
                "ok": False,
                "reason": "unsupported_provider",
                "message": f"Testing not supported for {provider}"
            }

        logfire.info(f"{provider} credential test result: {result['ok']}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Error testing {provider} credentials: {e}")
        return {
            "ok": False,
            "reason": "test_failed",
            "message": f"Test failed: {str(e)[:100]}"
        }
