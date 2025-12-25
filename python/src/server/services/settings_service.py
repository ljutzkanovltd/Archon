"""
Settings management service for Archon backend

Handles structured settings management across 6 sections:
- general: Site configuration
- api_keys: API key management
- crawl: Crawl behavior settings
- display: UI preferences
- mcp: MCP integration settings
- notifications: Notification preferences
"""

import os
from typing import Any, Dict

from ..config.logfire_config import get_logger
from .credential_service import credential_service

logger = get_logger(__name__)


# Default settings for all sections
DEFAULT_SETTINGS = {
    "general": {
        "site_name": "Archon Dashboard",
        "site_url": "http://localhost:3737",
        "contact_email": "admin@archon.local",
        "timezone": "UTC",
        "language": "en",
    },
    "api_keys": {
        "openai_api_key": "",
        "openai_api_key_masked": "",
        "azure_openai_api_key": "",
        "azure_openai_api_key_masked": "",
        "azure_openai_endpoint": "",
        "azure_openai_api_version": "2024-10-21",
        "azure_openai_deployment": "",
        "supabase_url": os.getenv("SUPABASE_URL", ""),
        "supabase_service_key": "",
        "supabase_service_key_masked": "",
    },
    "crawl": {
        "max_depth": 3,
        "rate_limit": 10,
        "follow_external_links": False,
        "respect_robots_txt": True,
        "user_agent": "ArchonBot/1.0",
        "timeout": 30,
        "max_retries": 3,
    },
    "display": {
        "theme": "system",
        "items_per_page": 10,
        "show_animations": True,
        "compact_view": False,
        "sidebar_collapsed": False,
    },
    "mcp": {
        "mcp_enabled": True,
        "mcp_server_url": "http://localhost:8051",
        "mcp_timeout": 30,
        "mcp_auto_reconnect": True,
        "mcp_debug_mode": False,
    },
    "notifications": {
        "enable_notifications": True,
        "crawl_complete_notification": True,
        "error_notifications": True,
        "notification_sound": False,
    },
}

# Mapping of settings keys to database credential keys
# This defines how structured settings map to flat archon_settings table
SETTINGS_KEY_MAPPING = {
    # General settings
    "general.site_name": {"key": "SITE_NAME", "category": "general", "encrypted": False},
    "general.site_url": {"key": "SITE_URL", "category": "general", "encrypted": False},
    "general.contact_email": {"key": "CONTACT_EMAIL", "category": "general", "encrypted": False},
    "general.timezone": {"key": "TIMEZONE", "category": "general", "encrypted": False},
    "general.language": {"key": "LANGUAGE", "category": "general", "encrypted": False},

    # API Keys (encrypted)
    "api_keys.openai_api_key": {"key": "OPENAI_API_KEY", "category": "api_keys", "encrypted": True},
    "api_keys.azure_openai_api_key": {"key": "AZURE_OPENAI_API_KEY", "category": "api_keys", "encrypted": True},
    "api_keys.azure_openai_endpoint": {"key": "AZURE_OPENAI_ENDPOINT", "category": "api_keys", "encrypted": False},
    "api_keys.azure_openai_api_version": {"key": "AZURE_OPENAI_API_VERSION", "category": "api_keys", "encrypted": False},
    "api_keys.azure_openai_deployment": {"key": "AZURE_OPENAI_DEPLOYMENT", "category": "api_keys", "encrypted": False},
    "api_keys.supabase_url": {"key": "SUPABASE_URL", "category": "api_keys", "encrypted": False},
    "api_keys.supabase_service_key": {"key": "SUPABASE_SERVICE_KEY", "category": "api_keys", "encrypted": True},

    # Crawl settings
    "crawl.max_depth": {"key": "CRAWL_MAX_DEPTH", "category": "crawl", "encrypted": False},
    "crawl.rate_limit": {"key": "CRAWL_RATE_LIMIT", "category": "crawl", "encrypted": False},
    "crawl.follow_external_links": {"key": "CRAWL_FOLLOW_EXTERNAL", "category": "crawl", "encrypted": False},
    "crawl.respect_robots_txt": {"key": "CRAWL_RESPECT_ROBOTS", "category": "crawl", "encrypted": False},
    "crawl.user_agent": {"key": "CRAWL_USER_AGENT", "category": "crawl", "encrypted": False},
    "crawl.timeout": {"key": "CRAWL_TIMEOUT", "category": "crawl", "encrypted": False},
    "crawl.max_retries": {"key": "CRAWL_MAX_RETRIES", "category": "crawl", "encrypted": False},

    # Display settings
    "display.theme": {"key": "DISPLAY_THEME", "category": "display", "encrypted": False},
    "display.items_per_page": {"key": "DISPLAY_ITEMS_PER_PAGE", "category": "display", "encrypted": False},
    "display.show_animations": {"key": "DISPLAY_ANIMATIONS", "category": "display", "encrypted": False},
    "display.compact_view": {"key": "DISPLAY_COMPACT_VIEW", "category": "display", "encrypted": False},
    "display.sidebar_collapsed": {"key": "DISPLAY_SIDEBAR_COLLAPSED", "category": "display", "encrypted": False},

    # MCP settings
    "mcp.mcp_enabled": {"key": "MCP_ENABLED", "category": "mcp", "encrypted": False},
    "mcp.mcp_server_url": {"key": "MCP_SERVER_URL", "category": "mcp", "encrypted": False},
    "mcp.mcp_timeout": {"key": "MCP_TIMEOUT", "category": "mcp", "encrypted": False},
    "mcp.mcp_auto_reconnect": {"key": "MCP_AUTO_RECONNECT", "category": "mcp", "encrypted": False},
    "mcp.mcp_debug_mode": {"key": "MCP_DEBUG_MODE", "category": "mcp", "encrypted": False},

    # Notification settings
    "notifications.enable_notifications": {"key": "NOTIFICATIONS_ENABLED", "category": "notifications", "encrypted": False},
    "notifications.crawl_complete_notification": {"key": "NOTIFICATIONS_CRAWL_COMPLETE", "category": "notifications", "encrypted": False},
    "notifications.error_notifications": {"key": "NOTIFICATIONS_ERRORS", "category": "notifications", "encrypted": False},
    "notifications.notification_sound": {"key": "NOTIFICATIONS_SOUND", "category": "notifications", "encrypted": False},
}


class SettingsService:
    """Service for managing structured application settings."""

    async def get_all_settings(self) -> Dict[str, Any]:
        """
        Get all settings across all sections.

        Returns structured settings with defaults for missing values.
        """
        try:
            logger.info("Fetching all settings")

            # Start with defaults
            settings = DEFAULT_SETTINGS.copy()

            # Override with database values
            for section_key, section_defaults in DEFAULT_SETTINGS.items():
                for setting_key in section_defaults.keys():
                    full_key = f"{section_key}.{setting_key}"

                    if full_key in SETTINGS_KEY_MAPPING:
                        mapping = SETTINGS_KEY_MAPPING[full_key]
                        db_key = mapping["key"]
                        is_encrypted = mapping["encrypted"]

                        # Get value from credential service
                        value = await credential_service.get_credential(db_key, decrypt=False)

                        if value is not None:
                            if is_encrypted:
                                # For encrypted values, check if they have a value
                                if isinstance(value, dict) and value.get("is_encrypted"):
                                    has_value = bool(value.get("encrypted_value"))
                                    settings[section_key][setting_key] = "[ENCRYPTED]" if has_value else ""
                                    settings[section_key][f"{setting_key}_masked"] = "[ENCRYPTED]" if has_value else ""
                                else:
                                    settings[section_key][setting_key] = value
                            else:
                                # Plain text value
                                # Convert string booleans to actual booleans
                                if isinstance(value, str):
                                    if value.lower() == "true":
                                        value = True
                                    elif value.lower() == "false":
                                        value = False
                                    elif value.isdigit():
                                        value = int(value)

                                settings[section_key][setting_key] = value

            logger.info(f"Successfully fetched settings for {len(settings)} sections")
            return settings

        except Exception as e:
            logger.error(f"Error fetching settings: {e}")
            # Return defaults on error
            return DEFAULT_SETTINGS.copy()

    async def update_settings(self, section: str, data: Dict[str, Any]) -> bool:
        """
        Update settings for a specific section.

        Args:
            section: Section name (e.g., "general", "api_keys")
            data: Dictionary of settings to update

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"Updating settings for section: {section}")

            if section not in DEFAULT_SETTINGS:
                logger.error(f"Invalid settings section: {section}")
                return False

            # Update each setting in the section
            for setting_key, value in data.items():
                full_key = f"{section}.{setting_key}"

                # Skip masked fields (they're read-only)
                if setting_key.endswith("_masked"):
                    continue

                if full_key in SETTINGS_KEY_MAPPING:
                    mapping = SETTINGS_KEY_MAPPING[full_key]
                    db_key = mapping["key"]
                    is_encrypted = mapping["encrypted"]
                    category = mapping["category"]

                    # Convert booleans to strings for storage
                    if isinstance(value, bool):
                        value = "true" if value else "false"
                    elif isinstance(value, int):
                        value = str(value)

                    # Set credential
                    success = await credential_service.set_credential(
                        key=db_key,
                        value=str(value),
                        is_encrypted=is_encrypted,
                        category=category,
                        description=f"Setting: {setting_key}"
                    )

                    if not success:
                        logger.error(f"Failed to update setting: {full_key}")
                        return False

            logger.info(f"Successfully updated {len(data)} settings in section: {section}")
            return True

        except Exception as e:
            logger.error(f"Error updating settings for section {section}: {e}")
            return False

    async def reset_settings(self, section: str = None) -> bool:
        """
        Reset settings to defaults.

        Args:
            section: Optional section name. If None, resets all settings.

        Returns:
            True if successful, False otherwise
        """
        try:
            if section:
                logger.info(f"Resetting settings for section: {section}")

                if section not in DEFAULT_SETTINGS:
                    logger.error(f"Invalid settings section: {section}")
                    return False

                # Reset specific section
                success = await self.update_settings(section, DEFAULT_SETTINGS[section])

                # Reload credential cache after reset
                if success:
                    await credential_service.load_all_credentials()
                    logger.info(f"Reloaded credential cache after resetting section: {section}")

                return success
            else:
                logger.info("Resetting all settings to defaults")

                # Reset all sections
                for section_name, section_data in DEFAULT_SETTINGS.items():
                    success = await self.update_settings(section_name, section_data)
                    if not success:
                        logger.error(f"Failed to reset section: {section_name}")
                        return False

                # Reload credential cache after reset
                await credential_service.load_all_credentials()
                logger.info("Reloaded credential cache after resetting all settings")
                logger.info("Successfully reset all settings")
                return True

        except Exception as e:
            logger.error(f"Error resetting settings: {e}")
            return False

    async def test_api_key(self, provider: str, api_key: str) -> Dict[str, Any]:
        """
        Test an API key for validity.

        Args:
            provider: Provider name ("openai" or "azure")
            api_key: API key to test

        Returns:
            Dictionary with test results
        """
        try:
            logger.info(f"Testing API key for provider: {provider}")

            if provider == "openai":
                # Test OpenAI API key
                import httpx

                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        "https://api.openai.com/v1/models",
                        headers={"Authorization": f"Bearer {api_key}"},
                        timeout=10.0
                    )

                    if response.status_code == 200:
                        logger.info("OpenAI API key is valid")
                        return {"valid": True, "message": "API key is valid"}
                    else:
                        logger.warning(f"OpenAI API key test failed: {response.status_code}")
                        return {"valid": False, "message": f"Invalid API key (status: {response.status_code})"}

            elif provider == "azure":
                # For Azure, we need endpoint and deployment too
                # For now, just check if key is not empty
                if api_key and len(api_key) > 10:
                    logger.info("Azure API key format appears valid")
                    return {"valid": True, "message": "API key format is valid (full test requires endpoint)"}
                else:
                    logger.warning("Azure API key format invalid")
                    return {"valid": False, "message": "API key format is invalid"}

            else:
                logger.error(f"Unknown provider: {provider}")
                return {"valid": False, "message": f"Unknown provider: {provider}"}

        except Exception as e:
            logger.error(f"Error testing API key for {provider}: {e}")
            return {"valid": False, "message": f"Error: {str(e)}"}


# Global instance
settings_service = SettingsService()
