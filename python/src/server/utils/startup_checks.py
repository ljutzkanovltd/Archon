"""
Startup validation checks for Archon configuration.

Validates provider configurations on application startup to catch
common misconfigurations early.
"""

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
        else:
            logger.info("   Chat API key: configured ✓")
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
        else:
            logger.info("   Embedding API key: configured ✓")
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
