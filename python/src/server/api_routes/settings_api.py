"""
Settings API endpoints for Archon

Handles:
- OpenAI API key management
- Other credentials and configuration
- Settings storage and retrieval
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Import logging
from ..config.logfire_config import logfire
from ..services.credential_service import credential_service, initialize_credentials
from ..services.settings_service import settings_service
from ..utils import get_supabase_client

router = APIRouter(prefix="/api", tags=["settings"])


class CredentialRequest(BaseModel):
    key: str
    value: str
    is_encrypted: bool = False
    category: str | None = None
    description: str | None = None


class CredentialUpdateRequest(BaseModel):
    value: str
    is_encrypted: bool | None = None
    category: str | None = None
    description: str | None = None


class CredentialResponse(BaseModel):
    success: bool
    message: str


class SettingsUpdateRequest(BaseModel):
    section: str
    data: dict[str, Any]


class SettingsResetRequest(BaseModel):
    section: str | None = None


class ApiKeyTestRequest(BaseModel):
    provider: str
    api_key: str


# Credential Management Endpoints
@router.get("/credentials")
async def list_credentials(category: str | None = None):
    """List all credentials and their categories."""
    try:
        logfire.info(f"Listing credentials | category={category}")
        credentials = await credential_service.list_all_credentials()

        if category:
            # Filter by category
            credentials = [cred for cred in credentials if cred.category == category]

        result_count = len(credentials)
        logfire.info(
            f"Credentials listed successfully | count={result_count} | category={category}"
        )

        return [
            {
                "key": cred.key,
                "value": cred.value,
                "encrypted_value": cred.encrypted_value,
                "is_encrypted": cred.is_encrypted,
                "category": cred.category,
                "description": cred.description,
            }
            for cred in credentials
        ]
    except Exception as e:
        logfire.error(f"Error listing credentials | category={category} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/credentials/categories/{category}")
async def get_credentials_by_category(category: str):
    """Get all credentials for a specific category."""
    try:
        logfire.info(f"Getting credentials by category | category={category}")
        credentials = await credential_service.get_credentials_by_category(category)

        logfire.info(
            f"Credentials retrieved by category | category={category} | count={len(credentials)}"
        )

        return {"credentials": credentials}
    except Exception as e:
        logfire.error(
            f"Error getting credentials by category | category={category} | error={str(e)}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/credentials")
async def create_credential(request: CredentialRequest):
    """Create or update a credential."""
    try:
        logfire.info(
            f"Creating/updating credential | key={request.key} | is_encrypted={request.is_encrypted} | category={request.category}"
        )

        success = await credential_service.set_credential(
            key=request.key,
            value=request.value,
            is_encrypted=request.is_encrypted,
            category=request.category,
            description=request.description,
        )

        if success:
            logfire.info(
                f"Credential saved successfully | key={request.key} | is_encrypted={request.is_encrypted}"
            )

            return {
                "success": True,
                "message": f"Credential {request.key} {'encrypted and ' if request.is_encrypted else ''}saved successfully",
            }
        else:
            logfire.error(f"Failed to save credential | key={request.key}")
            raise HTTPException(status_code=500, detail={"error": "Failed to save credential"})

    except Exception as e:
        logfire.error(f"Error creating credential | key={request.key} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# Define optional settings with their default values
# These are user preferences that should return defaults instead of 404
# This prevents console errors in the frontend when settings haven't been explicitly set
# The frontend can check the 'is_default' flag to know if it's a default or user-set value
OPTIONAL_SETTINGS_WITH_DEFAULTS = {
    "DISCONNECT_SCREEN_ENABLED": "true",  # Show disconnect screen when server is unavailable
    "PROJECTS_ENABLED": "false",  # Enable project management features
    "LOGFIRE_ENABLED": "false",  # Enable Pydantic Logfire integration
}


@router.get("/credentials/{key}")
async def get_credential(key: str):
    """Get a specific credential by key."""
    try:
        logfire.info(f"Getting credential | key={key}")
        # Never decrypt - always get metadata only for encrypted credentials
        value = await credential_service.get_credential(key, decrypt=False)

        if value is None:
            # Check if this is an optional setting with a default value
            if key in OPTIONAL_SETTINGS_WITH_DEFAULTS:
                logfire.info(f"Returning default value for optional setting | key={key}")
                return {
                    "key": key,
                    "value": OPTIONAL_SETTINGS_WITH_DEFAULTS[key],
                    "is_default": True,
                    "category": "features",
                    "description": f"Default value for {key}",
                }

            logfire.warning(f"Credential not found | key={key}")
            raise HTTPException(status_code=404, detail={"error": f"Credential {key} not found"})

        logfire.info(f"Credential retrieved successfully | key={key}")

        if isinstance(value, dict) and value.get("is_encrypted"):
            return {
                "key": key,
                "value": "[ENCRYPTED]",
                "is_encrypted": True,
                "category": value.get("category"),
                "description": value.get("description"),
                "has_value": bool(value.get("encrypted_value")),
            }

        # For non-encrypted credentials, return the actual value
        return {"key": key, "value": value, "is_encrypted": False}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Error getting credential | key={key} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/credentials/{key}")
async def update_credential(key: str, request: dict[str, Any]):
    """Update an existing credential."""
    try:
        logfire.info(f"Updating credential | key={key}")

        # Handle both CredentialUpdateRequest and full Credential object formats
        if isinstance(request, dict):
            # If the request contains a 'value' field directly, use it
            value = request.get("value", "")
            is_encrypted = request.get("is_encrypted")
            category = request.get("category")
            description = request.get("description")
        else:
            value = request.value
            is_encrypted = request.is_encrypted
            category = request.category
            description = request.description

        # Get existing credential to preserve metadata if not provided
        existing_creds = await credential_service.list_all_credentials()
        existing = next((c for c in existing_creds if c.key == key), None)

        if existing is None:
            # If credential doesn't exist, create it
            is_encrypted = is_encrypted if is_encrypted is not None else False
            logfire.info(f"Creating new credential via PUT | key={key}")
        else:
            # Preserve existing values if not provided
            if is_encrypted is None:
                is_encrypted = existing.is_encrypted
            if category is None:
                category = existing.category
            if description is None:
                description = existing.description
            logfire.info(f"Updating existing credential | key={key} | category={category}")

        success = await credential_service.set_credential(
            key=key,
            value=value,
            is_encrypted=is_encrypted,
            category=category,
            description=description,
        )

        if success:
            logfire.info(
                f"Credential updated successfully | key={key} | is_encrypted={is_encrypted}"
            )

            return {"success": True, "message": f"Credential {key} updated successfully"}
        else:
            logfire.error(f"Failed to update credential | key={key}")
            raise HTTPException(status_code=500, detail={"error": "Failed to update credential"})

    except Exception as e:
        logfire.error(f"Error updating credential | key={key} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/credentials/{key}")
async def delete_credential(key: str):
    """Delete a credential."""
    try:
        logfire.info(f"Deleting credential | key={key}")
        success = await credential_service.delete_credential(key)

        if success:
            logfire.info(f"Credential deleted successfully | key={key}")

            return {"success": True, "message": f"Credential {key} deleted successfully"}
        else:
            logfire.error(f"Failed to delete credential | key={key}")
            raise HTTPException(status_code=500, detail={"error": "Failed to delete credential"})

    except Exception as e:
        logfire.error(f"Error deleting credential | key={key} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/credentials/initialize")
async def initialize_credentials_endpoint():
    """Reload credentials from database."""
    try:
        logfire.info("Reloading credentials from database")
        await initialize_credentials()

        logfire.info("Credentials reloaded successfully")

        return {"success": True, "message": "Credentials reloaded from database"}
    except Exception as e:
        logfire.error(f"Error reloading credentials | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/database/metrics")
async def database_metrics():
    """Get database metrics and statistics."""
    try:
        logfire.info("Getting database metrics")
        supabase_client = get_supabase_client()

        # Get various table counts
        tables_info = {}

        # Get projects count
        projects_response = (
            supabase_client.table("archon_projects").select("id", count="exact").execute()
        )
        tables_info["projects"] = (
            projects_response.count if projects_response.count is not None else 0
        )

        # Get tasks count
        tasks_response = supabase_client.table("archon_tasks").select("id", count="exact").execute()
        tables_info["tasks"] = tasks_response.count if tasks_response.count is not None else 0

        # Get crawled pages count
        pages_response = (
            supabase_client.table("archon_crawled_pages").select("id", count="exact").execute()
        )
        tables_info["crawled_pages"] = (
            pages_response.count if pages_response.count is not None else 0
        )

        # Get settings count
        settings_response = (
            supabase_client.table("archon_settings").select("id", count="exact").execute()
        )
        tables_info["settings"] = (
            settings_response.count if settings_response.count is not None else 0
        )

        total_records = sum(tables_info.values())
        logfire.info(
            f"Database metrics retrieved | total_records={total_records} | tables={tables_info}"
        )

        return {
            "status": "healthy",
            "database": "supabase",
            "tables": tables_info,
            "total_records": total_records,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        logfire.error(f"Error getting database metrics | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/settings/health")
async def settings_health():
    """Health check for settings API."""
    logfire.info("Settings health check requested")
    result = {"status": "healthy", "service": "settings"}

    return result


@router.post("/credentials/status-check")
async def check_credential_status(request: dict[str, list[str]]):
    """Check status of API credentials by actually decrypting and validating them.
    
    This endpoint is specifically for frontend status indicators and returns
    decrypted credential values for connectivity testing.
    """
    try:
        credential_keys = request.get("keys", [])
        logfire.info(f"Checking status for credentials: {credential_keys}")
        
        result = {}
        
        for key in credential_keys:
            try:
                # Get decrypted value for status checking
                decrypted_value = await credential_service.get_credential(key, decrypt=True)
                
                if decrypted_value and isinstance(decrypted_value, str) and decrypted_value.strip():
                    result[key] = {
                        "key": key,
                        "value": decrypted_value,
                        "has_value": True
                    }
                else:
                    result[key] = {
                        "key": key,
                        "value": None,
                        "has_value": False
                    }
                    
            except Exception as e:
                logfire.warning(f"Failed to get credential for status check: {key} | error={str(e)}")
                result[key] = {
                    "key": key,
                    "value": None,
                    "has_value": False,
                    "error": str(e)
                }
        
        logfire.info(f"Credential status check completed | checked={len(credential_keys)} | found={len([k for k, v in result.items() if v.get('has_value')])}")
        return result

    except Exception as e:
        logfire.error(f"Error in credential status check | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# Structured Settings Endpoints
@router.get("/settings")
async def get_settings():
    """Get all structured settings across all sections."""
    try:
        logfire.info("Getting all settings")
        settings = await settings_service.get_all_settings()

        logfire.info(f"Settings retrieved successfully | sections={len(settings)}")

        return {
            "success": True,
            "data": settings,
            "message": "Settings retrieved successfully"
        }
    except Exception as e:
        logfire.error(f"Error getting settings | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.patch("/settings")
async def update_settings(request: SettingsUpdateRequest):
    """Update settings for a specific section."""
    try:
        logfire.info(f"Updating settings | section={request.section}")

        success = await settings_service.update_settings(request.section, request.data)

        if success:
            logfire.info(f"Settings updated successfully | section={request.section}")
            return {
                "success": True,
                "message": f"Settings for section '{request.section}' updated successfully"
            }
        else:
            logfire.error(f"Failed to update settings | section={request.section}")
            raise HTTPException(
                status_code=500,
                detail={"error": f"Failed to update settings for section '{request.section}'"}
            )

    except Exception as e:
        logfire.error(f"Error updating settings | section={request.section} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/settings/reset")
async def reset_settings(request: SettingsResetRequest = None):
    """Reset settings to defaults."""
    try:
        section = request.section if request else None
        logfire.info(f"Resetting settings | section={section or 'all'}")

        success = await settings_service.reset_settings(section)

        if success:
            message = f"Settings for section '{section}' reset to defaults" if section else "All settings reset to defaults"
            logfire.info(f"Settings reset successfully | section={section or 'all'}")
            return {
                "success": True,
                "message": message
            }
        else:
            logfire.error(f"Failed to reset settings | section={section}")
            raise HTTPException(
                status_code=500,
                detail={"error": "Failed to reset settings"}
            )

    except Exception as e:
        logfire.error(f"Error resetting settings | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/settings/test-api-key")
async def test_api_key(request: ApiKeyTestRequest):
    """Test an API key for validity."""
    try:
        logfire.info(f"Testing API key | provider={request.provider}")

        result = await settings_service.test_api_key(request.provider, request.api_key)

        logfire.info(f"API key test completed | provider={request.provider} | valid={result.get('valid')}")

        return {
            "success": True,
            "data": result,
            "message": result.get("message", "API key tested")
        }
    except Exception as e:
        logfire.error(f"Error testing API key | provider={request.provider} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# RAG Settings Endpoints
@router.get("/rag-settings")
async def get_rag_settings():
    """Get RAG (Retrieval-Augmented Generation) settings."""
    try:
        logfire.info("Getting RAG settings")

        # Default RAG settings
        defaults = {
            "USE_CONTEXTUAL_EMBEDDINGS": False,
            "CONTEXTUAL_EMBEDDINGS_MAX_WORKERS": 3,
            "USE_HYBRID_SEARCH": True,
            "USE_AGENTIC_RAG": True,
            "USE_RERANKING": True,
            "MODEL_CHOICE": "gpt-4.1-nano",
            # Provider selection
            "LLM_PROVIDER": "openai",
            "EMBEDDING_PROVIDER": "openai",
            "EMBEDDING_MODEL": "text-embedding-3-small",
            # Ollama configuration
            "LLM_BASE_URL": "",
            "LLM_INSTANCE_NAME": "",
            "OLLAMA_EMBEDDING_URL": "",
            "OLLAMA_EMBEDDING_INSTANCE_NAME": "",
        }

        # Get RAG settings from credentials with category "rag_strategy"
        rag_credentials = await credential_service.get_credentials_by_category("rag_strategy")

        # Merge with defaults
        settings = defaults.copy()
        for key, value in rag_credentials.items():
            if key in defaults:
                # Convert string boolean values
                if value.lower() in ('true', 'false'):
                    settings[key] = value.lower() == 'true'
                # Convert numeric values
                elif value.isdigit():
                    settings[key] = int(value)
                else:
                    settings[key] = value

        logfire.info(f"RAG settings retrieved successfully | keys={len(settings)}")

        return settings

    except Exception as e:
        logfire.error(f"Error getting RAG settings | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/rag-settings")
async def update_rag_settings(settings: dict[str, Any]):
    """Update RAG settings."""
    try:
        logfire.info(f"Updating RAG settings | keys={len(settings)}")

        # Save each RAG setting as a credential with category "rag_strategy"
        for key, value in settings.items():
            await credential_service.set_credential(
                key=key,
                value=str(value),
                is_encrypted=False,
                category="rag_strategy",
                description=f"RAG setting: {key}"
            )

        logfire.info(f"RAG settings updated successfully | updated={len(settings)}")

        return {
            "success": True,
            "message": "RAG settings updated successfully"
        }

    except Exception as e:
        logfire.error(f"Error updating RAG settings | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# Code Extraction Settings Endpoints
@router.get("/code-extraction-settings")
async def get_code_extraction_settings():
    """Get code extraction settings."""
    try:
        logfire.info("Getting code extraction settings")

        # Default code extraction settings
        defaults = {
            "MIN_CODE_BLOCK_LENGTH": 250,
            "MAX_CODE_BLOCK_LENGTH": 5000,
            "ENABLE_COMPLETE_BLOCK_DETECTION": True,
            "ENABLE_LANGUAGE_SPECIFIC_PATTERNS": True,
            "ENABLE_PROSE_FILTERING": True,
            "MAX_PROSE_RATIO": 0.15,
            "MIN_CODE_INDICATORS": 3,
            "ENABLE_DIAGRAM_FILTERING": True,
            "ENABLE_CONTEXTUAL_LENGTH": True,
            "CODE_EXTRACTION_MAX_WORKERS": 3,
            "CONTEXT_WINDOW_SIZE": 1000,
            "ENABLE_CODE_SUMMARIES": True
        }

        # Get code extraction settings from credentials with category "code_extraction"
        code_credentials = await credential_service.get_credentials_by_category("code_extraction")

        # Merge with defaults
        settings = defaults.copy()
        for key, value in code_credentials.items():
            if key in defaults:
                # Convert string boolean values
                if isinstance(value, str) and value.lower() in ('true', 'false'):
                    settings[key] = value.lower() == 'true'
                # Convert numeric values
                elif isinstance(value, str) and value.replace('.', '').replace('-', '').isdigit():
                    # Check if float
                    if '.' in value:
                        settings[key] = float(value)
                    else:
                        settings[key] = int(value)
                else:
                    settings[key] = value

        logfire.info(f"Code extraction settings retrieved successfully | keys={len(settings)}")

        return settings

    except Exception as e:
        logfire.error(f"Error getting code extraction settings | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/code-extraction-settings")
async def update_code_extraction_settings(settings: dict[str, Any]):
    """Update code extraction settings."""
    try:
        logfire.info(f"Updating code extraction settings | keys={len(settings)}")

        # Save each code extraction setting as a credential with category "code_extraction"
        for key, value in settings.items():
            await credential_service.set_credential(
                key=key,
                value=str(value),
                is_encrypted=False,
                category="code_extraction",
                description=f"Code extraction setting: {key}"
            )

        logfire.info(f"Code extraction settings updated successfully | updated={len(settings)}")

        return {
            "success": True,
            "message": "Code extraction settings updated successfully"
        }

    except Exception as e:
        logfire.error(f"Error updating code extraction settings | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# Azure OpenAI Configuration Endpoints
@router.get("/azure-chat-config")
async def get_azure_chat_config():
    """Get Azure OpenAI chat configuration."""
    try:
        logfire.info("Getting Azure OpenAI chat configuration")

        # Get Azure chat credentials with category "azure_config"
        azure_credentials = await credential_service.get_credentials_by_category("azure_config")

        # Default Azure chat config
        config = {
            "AZURE_OPENAI_CHAT_ENDPOINT": "",
            "AZURE_OPENAI_CHAT_API_VERSION": "2024-02-01",
            "AZURE_OPENAI_CHAT_DEPLOYMENT": "",
        }

        # Update with saved values
        for key in config.keys():
            if key in azure_credentials:
                config[key] = azure_credentials[key]

        logfire.info("Azure chat configuration retrieved successfully")
        return config

    except Exception as e:
        logfire.error(f"Error getting Azure chat configuration | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/azure-chat-config")
async def update_azure_chat_config(config: dict[str, str]):
    """Update Azure OpenAI chat configuration."""
    try:
        logfire.info(f"Updating Azure chat configuration | keys={len(config)}")

        # Save each Azure chat config as a credential with category "azure_config"
        for key, value in config.items():
            if key.startswith("AZURE_OPENAI_CHAT_"):
                await credential_service.set_credential(
                    key=key,
                    value=value,
                    is_encrypted=False,
                    category="azure_config",
                    description=f"Azure chat config: {key}"
                )

        logfire.info(f"Azure chat configuration updated successfully | updated={len(config)}")
        return {"success": True, "message": "Azure chat configuration updated successfully"}

    except Exception as e:
        logfire.error(f"Error updating Azure chat configuration | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/azure-embedding-config")
async def get_azure_embedding_config():
    """Get Azure OpenAI embedding configuration."""
    try:
        logfire.info("Getting Azure OpenAI embedding configuration")

        # Get Azure embedding credentials with category "azure_config"
        azure_credentials = await credential_service.get_credentials_by_category("azure_config")

        # Default Azure embedding config
        config = {
            "AZURE_OPENAI_EMBEDDING_ENDPOINT": "",
            "AZURE_OPENAI_EMBEDDING_API_VERSION": "2024-02-01",
            "AZURE_OPENAI_EMBEDDING_DEPLOYMENT": "",
        }

        # Update with saved values
        for key in config.keys():
            if key in azure_credentials:
                config[key] = azure_credentials[key]

        logfire.info("Azure embedding configuration retrieved successfully")
        return config

    except Exception as e:
        logfire.error(f"Error getting Azure embedding configuration | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/azure-embedding-config")
async def update_azure_embedding_config(config: dict[str, str]):
    """Update Azure OpenAI embedding configuration."""
    try:
        logfire.info(f"Updating Azure embedding configuration | keys={len(config)}")

        # Save each Azure embedding config as a credential with category "azure_config"
        for key, value in config.items():
            if key.startswith("AZURE_OPENAI_EMBEDDING_"):
                await credential_service.set_credential(
                    key=key,
                    value=value,
                    is_encrypted=False,
                    category="azure_config",
                    description=f"Azure embedding config: {key}"
                )

        logfire.info(f"Azure embedding configuration updated successfully | updated={len(config)}")
        return {"success": True, "message": "Azure embedding configuration updated successfully"}

    except Exception as e:
        logfire.error(f"Error updating Azure embedding configuration | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# Test Provider Connection Endpoint
class TestProviderRequest(BaseModel):
    provider: str
    config_type: str  # 'chat' or 'embedding'
    config: dict[str, str]


@router.post("/test-provider-connection")
async def test_provider_connection(request: TestProviderRequest):
    """
    Test provider connection with given configuration.

    For Azure OpenAI, validates:
    - Endpoint is configured
    - API key exists
    - Deployment name exists
    - Makes a test API call (future enhancement)

    Returns:
        {"ok": bool, "message": str}
    """
    try:
        logfire.info(f"Testing provider connection | provider={request.provider} | type={request.config_type}")

        if request.provider == "azure-openai":
            # Validate Azure config
            endpoint = request.config.get("endpoint", "").strip()
            api_key = request.config.get("api_key", "").strip()
            deployment = request.config.get("deployment", "").strip()
            api_version = request.config.get("api_version", "2024-02-01").strip()

            # Check required fields
            missing = []
            if not endpoint:
                missing.append("endpoint")
            if not api_key or api_key == "[CONFIGURED]":
                missing.append("API key")
            if not deployment:
                missing.append("deployment")

            if missing:
                error_msg = f"Missing required configuration: {', '.join(missing)}"
                logfire.warn(f"Azure connection test failed | reason={error_msg}")
                return {"ok": False, "message": error_msg}

            # Validate endpoint format
            if not endpoint.startswith("https://"):
                logfire.warn("Azure connection test failed | reason=Invalid endpoint format")
                return {"ok": False, "message": "Endpoint must start with https://"}

            # All validation passed
            logfire.info(f"Azure {request.config_type} connection test passed")
            return {
                "ok": True,
                "message": f"Azure OpenAI ({request.config_type}) configuration validated successfully"
            }

        elif request.provider == "openai":
            # Validate OpenAI config
            api_key = request.config.get("api_key", "").strip()

            if not api_key or api_key == "[CONFIGURED]":
                logfire.warn("OpenAI connection test failed | reason=Missing API key")
                return {"ok": False, "message": "OpenAI API key is required"}

            if not api_key.startswith("sk-"):
                logfire.warn("OpenAI connection test failed | reason=Invalid API key format")
                return {"ok": False, "message": "Invalid OpenAI API key format (should start with 'sk-')"}

            logfire.info(f"OpenAI {request.config_type} connection test passed")
            return {
                "ok": True,
                "message": f"OpenAI ({request.config_type}) API key validated successfully"
            }

        elif request.provider == "google":
            # Validate Google config
            api_key = request.config.get("api_key", "").strip()

            if not api_key or api_key == "[CONFIGURED]":
                logfire.warn("Google connection test failed | reason=Missing API key")
                return {"ok": False, "message": "Google API key is required"}

            logfire.info(f"Google {request.config_type} connection test passed")
            return {
                "ok": True,
                "message": f"Google ({request.config_type}) API key validated successfully"
            }

        elif request.provider == "anthropic":
            # Validate Anthropic config
            api_key = request.config.get("api_key", "").strip()

            if not api_key or api_key == "[CONFIGURED]":
                logfire.warn("Anthropic connection test failed | reason=Missing API key")
                return {"ok": False, "message": "Anthropic API key is required"}

            if not api_key.startswith("sk-ant-"):
                logfire.warn("Anthropic connection test failed | reason=Invalid API key format")
                return {"ok": False, "message": "Invalid Anthropic API key format (should start with 'sk-ant-')"}

            logfire.info(f"Anthropic {request.config_type} connection test passed")
            return {
                "ok": True,
                "message": f"Anthropic ({request.config_type}) API key validated successfully"
            }

        else:
            # Unsupported provider
            logfire.warn(f"Unsupported provider for connection test | provider={request.provider}")
            return {
                "ok": False,
                "message": f"Provider '{request.provider}' connection testing not yet implemented"
            }

    except Exception as e:
        logfire.error(f"Error testing provider connection | error={str(e)}")
        return {"ok": False, "message": f"Connection test failed: {str(e)}"}
