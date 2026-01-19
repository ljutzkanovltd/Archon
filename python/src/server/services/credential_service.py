"""
Credential management service for Archon backend

Handles loading, storing, and accessing credentials with encryption for sensitive values.
Credentials include API keys, service credentials, and application configuration.
"""

import base64
import os
import re
import time
from dataclasses import dataclass

# Removed direct logging import - using unified config
from typing import Any

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from supabase import Client, create_client

from ..config.logfire_config import get_logger

logger = get_logger(__name__)


@dataclass
class CredentialItem:
    """Represents a credential/setting item."""

    key: str
    value: str | None = None
    encrypted_value: str | None = None
    is_encrypted: bool = False
    category: str | None = None
    description: str | None = None




class CredentialService:
    """Service for managing application credentials and configuration."""

    def __init__(self):
        self._supabase: Client | None = None
        self._cache: dict[str, Any] = {}
        self._cache_initialized = False
        self._rag_settings_cache: dict[str, Any] | None = None
        self._rag_cache_timestamp: float | None = None
        self._rag_cache_ttl = 300  # 5 minutes TTL for RAG settings cache

    def _get_supabase_client(self) -> Client:
        """
        Get or create a properly configured Supabase client using environment variables.
        Uses the standard Supabase client initialization.
        """
        if self._supabase is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_KEY")

            if not url or not key:
                raise ValueError(
                    "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables"
                )

            try:
                # Initialize with standard Supabase client - no need for custom headers
                self._supabase = create_client(url, key)

                # Verify we're using service role key for proper permissions
                if hasattr(self._supabase, 'auth') and hasattr(self._supabase.auth, 'headers'):
                    auth_header = self._supabase.auth.headers.get('Authorization', '')
                    if 'Bearer' in auth_header:
                        # Service role keys are JWTs that start with eyJ
                        if 'eyJ' in auth_header:
                            logger.info("✓ Supabase client initialized with service role key")
                        else:
                            logger.warning("⚠️ Supabase client may not be using service role key")
                    else:
                        logger.warning("⚠️ No Authorization header found in Supabase client")
                else:
                    logger.debug("Could not verify Supabase authentication headers")

                # Extract project ID from URL for logging purposes only
                match = re.match(r"https://([^.]+)\.supabase\.co", url)
                if match:
                    project_id = match.group(1)
                    logger.debug(f"Supabase client initialized for project: {project_id}")
                else:
                    logger.debug("Supabase client initialized successfully")

            except Exception as e:
                logger.error(f"Error initializing Supabase client: {e}")
                raise

        return self._supabase

    def _get_encryption_key(self) -> bytes:
        """Generate encryption key from environment variables.

        Uses ENCRYPTION_KEY if available (recommended for stability), otherwise
        falls back to SUPABASE_SERVICE_KEY for backward compatibility.

        ENCRYPTION_KEY provides stable encryption independent of Supabase mode changes.
        """
        # Try dedicated encryption key first (stable, independent of Supabase mode)
        encryption_key_raw = os.getenv("ENCRYPTION_KEY")

        if encryption_key_raw:
            # Use dedicated encryption key (recommended)
            logger.debug("Using ENCRYPTION_KEY for credential encryption")
            source_key = encryption_key_raw
        else:
            # Fallback to Supabase service key (legacy behavior)
            logger.warning(
                "Using SUPABASE_SERVICE_KEY for encryption (legacy mode). "
                "Set ENCRYPTION_KEY in .env for stable encryption across Supabase mode changes."
            )
            source_key = os.getenv("SUPABASE_SERVICE_KEY", "default-key-for-development")

        # Generate a proper encryption key using PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"static_salt_for_credentials",  # In production, consider using a configurable salt
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(source_key.encode()))
        return key

    def _encrypt_value(self, value: str) -> str:
        """Encrypt a sensitive value using Fernet encryption."""
        if not value:
            return ""

        try:
            fernet = Fernet(self._get_encryption_key())
            encrypted_bytes = fernet.encrypt(value.encode("utf-8"))
            return base64.urlsafe_b64encode(encrypted_bytes).decode("utf-8")
        except Exception as e:
            logger.error(f"Error encrypting value: {e}")
            raise

    def _decrypt_value(self, encrypted_value: str) -> str:
        """Decrypt a sensitive value using Fernet encryption."""
        if not encrypted_value:
            return ""

        try:
            fernet = Fernet(self._get_encryption_key())
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_value.encode("utf-8"))
            decrypted_bytes = fernet.decrypt(encrypted_bytes)
            return decrypted_bytes.decode("utf-8")
        except Exception as e:
            logger.error(f"Error decrypting value: {e}")
            raise

    async def load_all_credentials(self) -> dict[str, Any]:
        """Load all credentials from database and cache them."""
        try:
            supabase = self._get_supabase_client()

            # Fetch all credentials
            result = supabase.table("archon_settings").select("*").execute()

            credentials = {}
            for item in result.data:
                key = item["key"]
                if item["is_encrypted"] and item["encrypted_value"]:
                    # For encrypted values, we store the encrypted version
                    # Decryption happens when the value is actually needed
                    credentials[key] = {
                        "encrypted_value": item["encrypted_value"],
                        "is_encrypted": True,
                        "category": item["category"],
                        "description": item["description"],
                    }
                else:
                    # Plain text values
                    credentials[key] = item["value"]

            self._cache = credentials
            self._cache_initialized = True
            logger.info(f"Loaded {len(credentials)} credentials from database")

            return credentials

        except Exception as e:
            logger.error(f"Error loading credentials: {e}")
            raise

    async def get_credential(self, key: str, default: Any = None, decrypt: bool = True) -> Any:
        """Get a credential value by key."""
        if not self._cache_initialized:
            await self.load_all_credentials()

        value = self._cache.get(key, default)

        # If it's an encrypted value and we want to decrypt it
        if isinstance(value, dict) and value.get("is_encrypted") and decrypt:
            encrypted_value = value.get("encrypted_value")
            if encrypted_value:
                try:
                    return self._decrypt_value(encrypted_value)
                except Exception as e:
                    logger.error(f"Failed to decrypt credential {key}: {e}")
                    return default

        return value

    async def get_encrypted_credential_raw(self, key: str) -> str | None:
        """Get the raw encrypted value for a credential (without decryption)."""
        if not self._cache_initialized:
            await self.load_all_credentials()

        value = self._cache.get(key)
        if isinstance(value, dict) and value.get("is_encrypted"):
            return value.get("encrypted_value")

        return None

    async def set_credential(
        self,
        key: str,
        value: str,
        is_encrypted: bool = False,
        category: str = None,
        description: str = None,
    ) -> bool:
        """Set a credential value."""
        try:
            supabase = self._get_supabase_client()

            if is_encrypted:
                encrypted_value = self._encrypt_value(value)
                data = {
                    "key": key,
                    "encrypted_value": encrypted_value,
                    "value": None,
                    "is_encrypted": True,
                    "category": category,
                    "description": description,
                }
                # Update cache with encrypted info
                self._cache[key] = {
                    "encrypted_value": encrypted_value,
                    "is_encrypted": True,
                    "category": category,
                    "description": description,
                }
            else:
                data = {
                    "key": key,
                    "value": value,
                    "encrypted_value": None,
                    "is_encrypted": False,
                    "category": category,
                    "description": description,
                }
                # Update cache with plain value
                self._cache[key] = value

            # Upsert to database with proper conflict handling
            # Since we validate service key at startup, permission errors here indicate actual database issues
            result = supabase.table("archon_settings").upsert(
                data,
                on_conflict="key",  # Specify the unique column for conflict resolution
            ).execute()

            # CRITICAL: Check if database write actually succeeded
            if hasattr(result, 'error') and result.error:
                error_msg = f"Database upsert failed for key '{key}': {result.error}"
                logger.error(error_msg)
                raise Exception(error_msg)

            if not result.data:
                error_msg = f"Database upsert returned no data for key '{key}' - write may have failed"
                logger.error(error_msg)
                raise Exception(error_msg)

            # Invalidate RAG settings cache if this is a rag_strategy setting
            if category == "rag_strategy":
                self._rag_settings_cache = None
                self._rag_cache_timestamp = None
                logger.debug(f"Invalidated RAG settings cache due to update of {key}")

                # Also invalidate provider service cache to ensure immediate effect
                try:
                    from .llm_provider_service import clear_provider_cache
                    clear_provider_cache()
                    logger.debug("Also cleared LLM provider service cache")
                except Exception as e:
                    logger.warning(f"Failed to clear provider service cache: {e}")

                # Also invalidate LLM provider service cache for provider config
                try:
                    from . import llm_provider_service
                    # Clear the provider config caches that depend on RAG settings
                    cache_keys_to_clear = ["provider_config_llm", "provider_config_embedding", "rag_strategy_settings"]
                    for cache_key in cache_keys_to_clear:
                        if cache_key in llm_provider_service._settings_cache:
                            del llm_provider_service._settings_cache[cache_key]
                            logger.debug(f"Invalidated LLM provider service cache key: {cache_key}")
                except ImportError:
                    logger.warning("Could not import llm_provider_service to invalidate cache")
                except Exception as e:
                    logger.error(f"Error invalidating LLM provider service cache: {e}")

            logger.info(
                f"Successfully {'encrypted and ' if is_encrypted else ''}stored credential: {key}"
            )
            return True

        except Exception as e:
            logger.error(f"Error setting credential {key}: {e}")
            return False

    async def delete_credential(self, key: str) -> bool:
        """Delete a credential."""
        try:
            supabase = self._get_supabase_client()

            # Since we validate service key at startup, we can directly execute
            supabase.table("archon_settings").delete().eq("key", key).execute()

            # Remove from cache
            if key in self._cache:
                del self._cache[key]

            # Invalidate RAG settings cache if this was a rag_strategy setting
            # We check the cache to see if the deleted key was in rag_strategy category
            if self._rag_settings_cache is not None and key in self._rag_settings_cache:
                self._rag_settings_cache = None
                self._rag_cache_timestamp = None
                logger.debug(f"Invalidated RAG settings cache due to deletion of {key}")

                # Also invalidate provider service cache to ensure immediate effect
                try:
                    from .llm_provider_service import clear_provider_cache
                    clear_provider_cache()
                    logger.debug("Also cleared LLM provider service cache")
                except Exception as e:
                    logger.warning(f"Failed to clear provider service cache: {e}")

                # Also invalidate LLM provider service cache for provider config
                try:
                    from . import llm_provider_service
                    # Clear the provider config caches that depend on RAG settings
                    cache_keys_to_clear = ["provider_config_llm", "provider_config_embedding", "rag_strategy_settings"]
                    for cache_key in cache_keys_to_clear:
                        if cache_key in llm_provider_service._settings_cache:
                            del llm_provider_service._settings_cache[cache_key]
                            logger.debug(f"Invalidated LLM provider service cache key: {cache_key}")
                except ImportError:
                    logger.warning("Could not import llm_provider_service to invalidate cache")
                except Exception as e:
                    logger.error(f"Error invalidating LLM provider service cache: {e}")

            logger.info(f"Successfully deleted credential: {key}")
            return True

        except Exception as e:
            logger.error(f"Error deleting credential {key}: {e}")
            return False

    async def get_credentials_by_category(self, category: str) -> dict[str, Any]:
        """Get all credentials for a specific category."""
        if not self._cache_initialized:
            await self.load_all_credentials()

        # Special caching for rag_strategy category to reduce database calls
        if category == "rag_strategy":
            current_time = time.time()

            # Check if we have valid cached data
            if (
                self._rag_settings_cache is not None
                and self._rag_cache_timestamp is not None
                and current_time - self._rag_cache_timestamp < self._rag_cache_ttl
            ):
                logger.debug("Using cached RAG settings")
                return self._rag_settings_cache

        try:
            supabase = self._get_supabase_client()
            result = (
                supabase.table("archon_settings").select("*").eq("category", category).execute()
            )

            credentials = {}
            for item in result.data:
                key = item["key"]
                if item["is_encrypted"]:
                    credentials[key] = {
                        "value": "[ENCRYPTED]",
                        "is_encrypted": True,
                        "description": item["description"],
                    }
                else:
                    credentials[key] = item["value"]

            # Cache rag_strategy results
            if category == "rag_strategy":
                self._rag_settings_cache = credentials
                self._rag_cache_timestamp = time.time()
                logger.debug(f"Cached RAG settings with {len(credentials)} items")

            return credentials

        except Exception as e:
            logger.error(f"Error getting credentials for category {category}: {e}")
            return {}

    async def list_all_credentials(self) -> list[CredentialItem]:
        """Get all credentials as a list of CredentialItem objects (for Settings UI)."""
        try:
            supabase = self._get_supabase_client()
            result = supabase.table("archon_settings").select("*").execute()

            credentials = []
            for item in result.data:
                if item["is_encrypted"] and item["encrypted_value"]:
                    cred = CredentialItem(
                        key=item["key"],
                        value="[ENCRYPTED]",
                        encrypted_value=None,
                        is_encrypted=item["is_encrypted"],
                        category=item["category"],
                        description=item["description"],
                    )
                else:
                    cred = CredentialItem(
                        key=item["key"],
                        value=item["value"],
                        encrypted_value=None,
                        is_encrypted=item["is_encrypted"],
                        category=item["category"],
                        description=item["description"],
                    )
                credentials.append(cred)

            return credentials

        except Exception as e:
            logger.error(f"Error listing credentials: {e}")
            return []

    def get_config_as_env_dict(self) -> dict[str, str]:
        """
        Get configuration as environment variable style dict.
        Note: This returns plain text values only, encrypted values need special handling.
        """
        if not self._cache_initialized:
            # Synchronous fallback - load from cache if available
            logger.warning("Credentials not loaded, returning empty config")
            return {}

        env_dict = {}
        for key, value in self._cache.items():
            if isinstance(value, dict) and value.get("is_encrypted"):
                # Skip encrypted values in env dict - they need to be handled separately
                continue
            else:
                env_dict[key] = str(value) if value is not None else ""

        return env_dict

    # Provider Management Methods
    async def get_active_provider(self, service_type: str = "llm") -> dict[str, Any]:
        """
        Get the currently active provider configuration.

        Args:
            service_type: Either 'llm' or 'embedding'

        Returns:
            Dict with provider, api_key, base_url, and models
        """
        try:
            # Get RAG strategy settings (where UI saves provider selection)
            rag_settings = await self.get_credentials_by_category("rag_strategy")

            # Get the selected provider based on service type
            if service_type == "embedding":
                # First check for explicit EMBEDDING_PROVIDER setting (new split provider approach)
                explicit_embedding_provider = rag_settings.get("EMBEDDING_PROVIDER")

                # Validate that embedding provider actually supports embeddings
                embedding_capable_providers = {"openai", "google", "openrouter", "ollama", "azure-openai"}

                if (explicit_embedding_provider and
                    explicit_embedding_provider != "" and
                    explicit_embedding_provider in embedding_capable_providers):
                    # Use the explicitly set embedding provider
                    provider = explicit_embedding_provider
                    logger.debug(f"Using explicit embedding provider: '{provider}'")
                else:
                    # Fall back to OpenAI as default embedding provider for backward compatibility
                    if explicit_embedding_provider and explicit_embedding_provider not in embedding_capable_providers:
                        logger.warning(f"Invalid embedding provider '{explicit_embedding_provider}' doesn't support embeddings, defaulting to OpenAI")
                    provider = "openai"
                    logger.debug(f"No explicit embedding provider set, defaulting to OpenAI for backward compatibility")
            else:
                provider = rag_settings.get("LLM_PROVIDER", "openai")
                # Ensure provider is a valid string, not a boolean or other type
                if not isinstance(provider, str) or provider.lower() in ("true", "false", "none", "null"):
                    provider = "openai"

            # Get API key for this provider
            api_key = await self._get_provider_api_key(provider)

            # Get base URL if needed
            base_url = self._get_provider_base_url(provider, rag_settings)

            # Get models with provider-specific fallback logic
            chat_model = rag_settings.get("MODEL_CHOICE", "")

            # If MODEL_CHOICE is empty, try provider-specific model settings
            if not chat_model and provider == "ollama":
                chat_model = rag_settings.get("OLLAMA_CHAT_MODEL", "")
                if chat_model:
                    logger.debug(f"Using OLLAMA_CHAT_MODEL: {chat_model}")

            embedding_model = rag_settings.get("EMBEDDING_MODEL", "")

            return {
                "provider": provider,
                "api_key": api_key,
                "base_url": base_url,
                "chat_model": chat_model,
                "embedding_model": embedding_model,
            }

        except Exception as e:
            logger.error(f"Error getting active provider for {service_type}: {e}")
            # Fallback to environment variable
            provider = os.getenv("LLM_PROVIDER", "openai")
            return {
                "provider": provider,
                "api_key": os.getenv("OPENAI_API_KEY"),
                "base_url": None,
                "chat_model": "",
                "embedding_model": "",
            }

    async def _get_provider_api_key(self, provider: str, use_embedding_provider: bool = False) -> str | None:
        """Get API key for a specific provider.

        Args:
            provider: Provider name (e.g., 'openai', 'azure-openai')
            use_embedding_provider: If True, use embedding-specific key; otherwise chat key

        Returns:
            API key string or None
        """
        from ..config.providers import requires_api_key, get_provider_key_names

        # Check if provider needs an API key
        if not requires_api_key(provider):
            return "ollama"  # Return placeholder for providers without auth

        # Get key names from centralized configuration
        primary_key, fallback_key = get_provider_key_names(provider, use_embedding=use_embedding_provider)

        # Try the specific key first (chat or embedding)
        if primary_key:
            api_key = await self.get_credential(primary_key)
            if api_key:
                return api_key

        # Fallback to legacy single key for backward compatibility
        if fallback_key:
            return await self.get_credential(fallback_key)

        return None

    def _get_provider_base_url(self, provider: str, rag_settings: dict) -> str | None:
        """Get base URL for provider."""
        from ..config.providers import get_provider_base_url

        if provider == "ollama":
            # Ollama uses custom instance URL from settings
            return rag_settings.get("LLM_BASE_URL", "http://host.docker.internal:11434/v1")
        elif provider == "azure-openai":
            # Azure uses azure_endpoint parameter, not base_url
            return None

        # Get base URL from centralized configuration
        return get_provider_base_url(provider)

    async def set_active_provider(self, provider: str, service_type: str = "llm") -> bool:
        """Set the active provider for a service type."""
        try:
            # For now, we'll update the RAG strategy settings
            return await self.set_credential(
                "LLM_PROVIDER",
                provider,
                category="rag_strategy",
                description=f"Active {service_type} provider",
            )
        except Exception as e:
            logger.error(f"Error setting active provider {provider} for {service_type}: {e}")
            return False

    async def get_azure_deployment_name(self, model_type: str = "chat") -> str:
        """
        Get Azure OpenAI deployment name for chat or embedding.

        Args:
            model_type: "chat" or "embedding"

        Returns:
            Deployment name from settings

        Raises:
            ValueError: If deployment not configured
        """
        # Force cache refresh for Azure deployment lookups to ensure latest config
        self._rag_settings_cache = None
        self._rag_cache_timestamp = None
        logger.debug(f"Force-cleared RAG settings cache for Azure {model_type} deployment lookup")

        # Also invalidate LLM provider service cache to ensure fresh deployment name
        try:
            from .llm_provider_service import invalidate_azure_deployment_cache
            invalidate_azure_deployment_cache()
            logger.debug(f"Also invalidated LLM provider service cache for Azure {model_type}")
        except Exception as e:
            logger.warning(f"Failed to invalidate LLM provider service cache: {e}")

        rag_settings = await self.get_credentials_by_category("rag_strategy")

        key = f"AZURE_OPENAI_{model_type.upper()}_DEPLOYMENT"
        deployment = rag_settings.get(key)

        if not deployment:
            raise ValueError(
                f"{key} not configured. Set this in Settings UI "
                f"(Settings > RAG Strategy > Azure Deployments)"
            )

        return deployment

    async def get_azure_chat_endpoint(self) -> str:
        """
        Get Azure OpenAI endpoint URL for chat/LLM.

        Returns:
            Azure OpenAI chat endpoint URL

        Raises:
            ValueError: If endpoint not configured
        """
        rag_settings = await self.get_credentials_by_category("rag_strategy")

        endpoint = rag_settings.get("AZURE_OPENAI_CHAT_ENDPOINT")

        if not endpoint:
            raise ValueError(
                "AZURE_OPENAI_CHAT_ENDPOINT not configured. Set this in Settings UI "
                "(Settings > RAG Strategy > Azure OpenAI Chat Configuration)"
            )

        return endpoint.strip()

    async def get_azure_chat_api_version(self) -> str:
        """
        Get Azure OpenAI API version for chat/LLM.

        Returns:
            Azure OpenAI chat API version (defaults to '2024-10-21' - latest stable)

        Note: Updated default from 2024-02-01 to 2024-10-21 (Dec 2024) to support
        newer models and deployments. Older API versions may return 404 errors
        for preview models or recent deployments.
        """
        rag_settings = await self.get_credentials_by_category("rag_strategy")
        return rag_settings.get("AZURE_OPENAI_CHAT_API_VERSION", "2024-10-21")

    async def get_azure_chat_deployment(self) -> str:
        """
        Get Azure OpenAI deployment name for chat/LLM.

        Returns:
            Azure OpenAI chat deployment name

        Raises:
            ValueError: If deployment not configured
        """
        # Force cache refresh for Azure deployment lookups to ensure latest config
        self._rag_settings_cache = None
        self._rag_cache_timestamp = None
        logger.debug("Force-cleared RAG settings cache for Azure chat deployment lookup")

        # Also invalidate LLM provider service cache to ensure fresh deployment name
        try:
            from .llm_provider_service import invalidate_azure_deployment_cache
            invalidate_azure_deployment_cache()
            logger.debug("Also invalidated LLM provider service cache for Azure chat")
        except Exception as e:
            logger.warning(f"Failed to invalidate LLM provider service cache: {e}")

        rag_settings = await self.get_credentials_by_category("rag_strategy")

        deployment = rag_settings.get("AZURE_OPENAI_CHAT_DEPLOYMENT")

        if not deployment:
            raise ValueError(
                "AZURE_OPENAI_CHAT_DEPLOYMENT not configured. Set this in Settings UI "
                "(Settings > RAG Strategy > Azure OpenAI Chat Configuration)"
            )

        return deployment.strip()

    async def get_azure_embedding_endpoint(self) -> str:
        """
        Get Azure OpenAI endpoint URL for embeddings.

        Returns:
            Azure OpenAI embedding endpoint URL

        Raises:
            ValueError: If endpoint not configured
        """
        # Check azure_config category first (where UI stores it), fallback to rag_strategy
        azure_settings = await self.get_credentials_by_category("azure_config")
        endpoint = azure_settings.get("AZURE_OPENAI_EMBEDDING_ENDPOINT")

        # Fallback to rag_strategy for backwards compatibility
        if not endpoint:
            rag_settings = await self.get_credentials_by_category("rag_strategy")
            endpoint = rag_settings.get("AZURE_OPENAI_EMBEDDING_ENDPOINT")

        if not endpoint:
            raise ValueError(
                "AZURE_OPENAI_EMBEDDING_ENDPOINT not configured. Set this in Settings UI "
                "(Settings > RAG Strategy > Azure OpenAI Embedding Configuration)"
            )

        return endpoint.strip()

    async def get_azure_embedding_api_version(self) -> str:
        """
        Get Azure OpenAI API version for embeddings.

        Returns:
            Azure OpenAI embedding API version (defaults to '2024-10-21' - latest stable)

        Note: Updated default from 2024-02-01 to 2024-10-21 (Dec 2024) to support
        newer models and deployments. Older API versions may return 404 errors
        for preview models or recent deployments.
        """
        # Check azure_config category first (where UI stores it), fallback to rag_strategy
        azure_settings = await self.get_credentials_by_category("azure_config")
        api_version = azure_settings.get("AZURE_OPENAI_EMBEDDING_API_VERSION")

        if not api_version:
            rag_settings = await self.get_credentials_by_category("rag_strategy")
            api_version = rag_settings.get("AZURE_OPENAI_EMBEDDING_API_VERSION")

        return api_version or "2024-10-21"

    async def get_azure_embedding_deployment(self) -> str:
        """
        Get Azure OpenAI deployment name for embeddings.

        Returns:
            Azure OpenAI embedding deployment name

        Raises:
            ValueError: If deployment not configured
        """
        # Force cache refresh for Azure deployment lookups to ensure latest config
        self._rag_settings_cache = None
        self._rag_cache_timestamp = None
        logger.debug("Force-cleared RAG settings cache for Azure embedding deployment lookup")

        # Also invalidate LLM provider service cache to ensure fresh deployment name
        try:
            from .llm_provider_service import invalidate_azure_deployment_cache
            invalidate_azure_deployment_cache()
            logger.debug("Also invalidated LLM provider service cache for Azure embedding")
        except Exception as e:
            logger.warning(f"Failed to invalidate LLM provider service cache: {e}")

        # Check azure_config category first (where UI stores it), fallback to rag_strategy
        azure_settings = await self.get_credentials_by_category("azure_config")
        deployment = azure_settings.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")

        # Fallback to rag_strategy for backwards compatibility
        if not deployment:
            rag_settings = await self.get_credentials_by_category("rag_strategy")
            deployment = rag_settings.get("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")

        if not deployment:
            raise ValueError(
                "AZURE_OPENAI_EMBEDDING_DEPLOYMENT not configured. Set this in Settings UI "
                "(Settings > RAG Strategy > Azure OpenAI Embedding Configuration)"
            )

        return deployment.strip()

    async def test_database_write(self) -> dict[str, Any]:
        """
        Test if we can write to archon_settings table.

        Useful for debugging database permission issues.
        Creates a test record, verifies it was created, then cleans up.

        Returns:
            dict with 'success' (bool) and 'message' or 'error' (str)
        """
        try:
            supabase = self._get_supabase_client()

            # Generate unique test key
            test_key = f"_test_write_{int(time.time() * 1000)}"
            test_data = {
                "key": test_key,
                "value": "test_value",
                "encrypted_value": None,
                "is_encrypted": False,
                "category": "test",
                "description": "Test write operation - will be deleted"
            }

            # Try to insert
            logger.info(f"Testing database write with key: {test_key}")
            result = supabase.table("archon_settings").insert(test_data).execute()

            # Check for errors
            if hasattr(result, 'error') and result.error:
                return {
                    "success": False,
                    "error": f"Database insert failed: {result.error}"
                }

            if not result.data:
                return {
                    "success": False,
                    "error": "Database insert returned no data"
                }

            logger.info(f"Test write successful, cleaning up test key: {test_key}")

            # Clean up test record
            delete_result = supabase.table("archon_settings").delete().eq("key", test_key).execute()

            if hasattr(delete_result, 'error') and delete_result.error:
                logger.warning(f"Test cleanup failed (record may remain): {delete_result.error}")

            return {
                "success": True,
                "message": "Database write test passed - can write and delete records",
                "test_key": test_key
            }

        except Exception as e:
            logger.error(f"Database write test failed with exception: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Global instance
credential_service = CredentialService()


async def get_credential(key: str, default: Any = None) -> Any:
    """Convenience function to get a credential."""
    return await credential_service.get_credential(key, default)


async def set_credential(
    key: str, value: str, is_encrypted: bool = False, category: str = None, description: str = None
) -> bool:
    """Convenience function to set a credential."""
    return await credential_service.set_credential(key, value, is_encrypted, category, description)


async def initialize_credentials() -> None:
    """Initialize the credential service by loading all credentials and setting environment variables."""
    await credential_service.load_all_credentials()

    # Only set infrastructure/startup credentials as environment variables
    # RAG settings will be looked up on-demand from the credential service
    infrastructure_credentials = [
        "OPENAI_API_KEY",  # Required for API client initialization
        "HOST",  # Server binding configuration
        "PORT",  # Server binding configuration
        "MCP_TRANSPORT",  # Server transport mode
        "LOGFIRE_ENABLED",  # Logging infrastructure setup
        "PROJECTS_ENABLED",  # Feature flag for module loading
    ]

    # LLM provider credentials (for sync client support)
    provider_credentials = [
        "GOOGLE_API_KEY",  # Google Gemini API key
        "LLM_PROVIDER",  # Selected provider
        "LLM_BASE_URL",  # Ollama base URL
        "EMBEDDING_MODEL",  # Custom embedding model
        "MODEL_CHOICE",  # Chat model for sync contexts
    ]

    # RAG settings that should NOT be set as env vars (will be looked up on demand):
    # - USE_CONTEXTUAL_EMBEDDINGS
    # - CONTEXTUAL_EMBEDDINGS_MAX_WORKERS
    # - USE_HYBRID_SEARCH
    # - USE_AGENTIC_RAG
    # - USE_RERANKING

    # Code extraction settings (loaded on demand, not set as env vars):
    # - MIN_CODE_BLOCK_LENGTH
    # - MAX_CODE_BLOCK_LENGTH
    # - ENABLE_COMPLETE_BLOCK_DETECTION
    # - ENABLE_LANGUAGE_SPECIFIC_PATTERNS
    # - ENABLE_PROSE_FILTERING
    # - MAX_PROSE_RATIO
    # - MIN_CODE_INDICATORS
    # - ENABLE_DIAGRAM_FILTERING
    # - ENABLE_CONTEXTUAL_LENGTH
    # - CODE_EXTRACTION_MAX_WORKERS
    # - CONTEXT_WINDOW_SIZE
    # - ENABLE_CODE_SUMMARIES

    # Set infrastructure credentials
    for key in infrastructure_credentials:
        try:
            value = await credential_service.get_credential(key, decrypt=True)
            if value:
                os.environ[key] = str(value)
                logger.info(f"Set environment variable: {key}")
        except Exception as e:
            logger.warning(f"Failed to set environment variable {key}: {e}")

    # Set provider credentials with proper environment variable names
    for key in provider_credentials:
        try:
            value = await credential_service.get_credential(key, decrypt=True)
            if value:
                # Map credential keys to environment variable names
                env_key = key.upper()  # Convert to uppercase for env vars
                os.environ[env_key] = str(value)
                logger.info(f"Set environment variable: {env_key}")
        except Exception:
            # This is expected for optional credentials
            logger.debug(f"Optional credential not set: {key}")

    logger.info("✅ Credentials loaded and environment variables set")
