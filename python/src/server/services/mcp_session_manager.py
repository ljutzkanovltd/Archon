"""
MCP Session Manager

This module provides session management for MCP server connections with:
- Client detection and metadata tracking
- PostgreSQL persistence for sessions and requests
- Token usage and cost tracking
- Support for session resume after server restarts
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

# Removed direct logging import - using unified config
from ..config.logfire_config import get_logger
from .client_manager import get_supabase_client
from . import token_counter

logger = get_logger(__name__)


class SimplifiedSessionManager:
    """
    Enhanced MCP session manager with database persistence and client tracking.

    Features:
    - In-memory cache for fast validation
    - PostgreSQL persistence for session resume after restarts
    - Client metadata extraction and storage
    - Request tracking with token usage and cost estimation
    """

    def __init__(self, timeout: int = 3600, use_database: bool = True):
        """
        Initialize session manager

        Args:
            timeout: Session expiration time in seconds (default: 1 hour)
            use_database: Whether to persist sessions to PostgreSQL (default: True)
        """
        self.sessions: dict[str, datetime] = {}  # session_id -> last_seen (in-memory cache)
        self.timeout = timeout
        self.use_database = use_database
        self._db_client = None

        # Initialize database client if enabled
        if self.use_database:
            try:
                self._db_client = get_supabase_client()
                logger.info("Session manager initialized with database persistence")
            except Exception as e:
                logger.warning(f"Failed to initialize database client: {e}. Falling back to in-memory only.")
                self.use_database = False

    def create_session(self, client_info: Optional[dict[str, Any]] = None) -> str:
        """
        Create a new session and return its ID.

        Args:
            client_info: Optional client metadata from MCP initialize request
                        Expected fields: name, version, capabilities

        Returns:
            Session ID (UUID string)
        """
        session_id = str(uuid.uuid4())
        now = datetime.now()
        self.sessions[session_id] = now

        # Extract client type from client_info
        client_type = "Unknown"
        client_version = None
        client_capabilities = None

        if client_info:
            # Parse client name (e.g., "Claude Code", "Cursor", "Windsurf")
            client_type = self._detect_client_type(client_info.get("name", "Unknown"))
            client_version = client_info.get("version")
            client_capabilities = client_info.get("capabilities")

        # Persist to database if enabled
        if self.use_database and self._db_client:
            try:
                self._db_client.table("archon_mcp_sessions").insert({
                    "session_id": session_id,
                    "client_type": client_type,
                    "client_version": client_version,
                    "client_capabilities": client_capabilities,
                    "connected_at": now.isoformat(),
                    "last_activity": now.isoformat(),
                    "status": "active",
                    "metadata": client_info or {}
                }).execute()
                logger.info(f"Created session {session_id} with client {client_type} (persisted to DB)")
            except Exception as e:
                logger.error(f"Failed to persist session to database: {e}. Session will be in-memory only.")
        else:
            logger.info(f"Created new session: {session_id} (in-memory only)")

        return session_id

    def _detect_client_type(self, client_name: str) -> str:
        """
        Detect client type from client name string.

        Args:
            client_name: Client name from MCP initialize request

        Returns:
            Standardized client type name
        """
        client_name_lower = client_name.lower()

        # Map of client identifiers to standardized names
        client_patterns = {
            "claude": "Claude Code",
            "cursor": "Cursor",
            "windsurf": "Windsurf",
            "cline": "Cline",
            "kiro": "KiRo",
            "augment": "Augment",
            "gemini": "Gemini",
        }

        for pattern, client_type in client_patterns.items():
            if pattern in client_name_lower:
                return client_type

        return client_name or "Unknown"

    def validate_session(self, session_id: str) -> bool:
        """
        Validate a session ID and update last activity time.

        Args:
            session_id: Session UUID to validate

        Returns:
            True if session is valid and active, False otherwise
        """
        now = datetime.now()

        # Check in-memory cache first
        if session_id not in self.sessions:
            # Try to load from database if enabled
            if self.use_database and self._db_client:
                try:
                    result = self._db_client.table("archon_mcp_sessions")\
                        .select("*")\
                        .eq("session_id", session_id)\
                        .execute()

                    if result.data and len(result.data) > 0:
                        session = result.data[0]
                        # Check if session is not disconnected
                        if session.get("disconnected_at") is None:
                            # Add to in-memory cache
                            self.sessions[session_id] = now
                            logger.info(f"Session {session_id} loaded from database")
                        else:
                            logger.info(f"Session {session_id} is disconnected")
                            return False
                    else:
                        return False
                except Exception as e:
                    logger.error(f"Failed to load session from database: {e}")
                    return False
            else:
                return False

        last_seen = self.sessions[session_id]
        if now - last_seen > timedelta(seconds=self.timeout):
            # Session expired, mark as disconnected
            self._disconnect_session(session_id)
            return False

        # Update last activity time
        self.sessions[session_id] = now

        # Update database if enabled (async fire-and-forget)
        if self.use_database and self._db_client:
            try:
                self._db_client.table("archon_mcp_sessions")\
                    .update({"last_activity": now.isoformat()})\
                    .eq("session_id", session_id)\
                    .execute()
            except Exception as e:
                logger.debug(f"Failed to update session last_activity in database: {e}")

        return True

    def _disconnect_session(self, session_id: str) -> None:
        """Mark a session as disconnected."""
        # Remove from in-memory cache
        if session_id in self.sessions:
            del self.sessions[session_id]

        # Update database if enabled
        if self.use_database and self._db_client:
            try:
                self._db_client.table("archon_mcp_sessions")\
                    .update({
                        "disconnected_at": datetime.now().isoformat(),
                        "status": "disconnected"
                    })\
                    .eq("session_id", session_id)\
                    .execute()
                logger.info(f"Session {session_id} marked as disconnected in database")
            except Exception as e:
                logger.error(f"Failed to mark session as disconnected in database: {e}")

        logger.info(f"Session {session_id} expired and removed")

    def track_request(
        self,
        session_id: str,
        method: str,
        tool_name: Optional[str] = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        prompt_text: Optional[str] = None,
        completion_text: Optional[str] = None,
        model: str = "claude-3-5-sonnet-20241022",
        duration_ms: Optional[int] = None,
        status: str = "success",
        error_message: Optional[str] = None
    ) -> None:
        """
        Track an MCP request with automatic token counting and cost estimation.

        Args:
            session_id: Session UUID making the request
            method: MCP method called (e.g., "tools/call", "resources/read")
            tool_name: Name of tool if method is "tools/call"
            prompt_tokens: Number of input tokens (if already known)
            completion_tokens: Number of output tokens (if already known)
            prompt_text: Prompt text to count tokens from (if tokens not provided)
            completion_text: Completion text to count tokens from (if tokens not provided)
            model: Model name for token counting and pricing lookup
            duration_ms: Request duration in milliseconds
            status: Request status ("success", "error", "timeout")
            error_message: Error details if status is "error"
        """
        if not self.use_database or not self._db_client:
            # Skip tracking if database is not enabled
            return

        try:
            # Count tokens if text provided but counts not provided
            if prompt_text and prompt_tokens == 0:
                try:
                    prompt_tokens = token_counter.count_tokens(prompt_text, model)
                except Exception as e:
                    logger.warning(f"Failed to count prompt tokens: {e}")
                    prompt_tokens = 0

            if completion_text and completion_tokens == 0:
                try:
                    completion_tokens = token_counter.count_tokens(completion_text, model)
                except Exception as e:
                    logger.warning(f"Failed to count completion tokens: {e}")
                    completion_tokens = 0

            # Calculate estimated cost using pricing from database
            estimated_cost = 0.0
            try:
                # Detect provider from model name
                provider = "Anthropic" if model.startswith("claude") else "OpenAI"

                pricing = token_counter.get_pricing_from_db(
                    self._db_client,
                    model,
                    provider
                )

                if pricing:
                    estimated_cost = token_counter.estimate_cost(
                        prompt_tokens,
                        completion_tokens,
                        model,
                        pricing["input_price_per_1k"],
                        pricing["output_price_per_1k"]
                    )
                else:
                    logger.debug(f"No pricing data found for {provider}:{model}")
            except Exception as e:
                logger.warning(f"Failed to calculate cost: {e}")
                estimated_cost = 0.0

            # Insert request record
            self._db_client.table("archon_mcp_requests").insert({
                "session_id": session_id,
                "method": method,
                "tool_name": tool_name,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "estimated_cost": estimated_cost,
                "timestamp": datetime.now().isoformat(),
                "duration_ms": duration_ms,
                "status": status,
                "error_message": error_message
            }).execute()

            logger.debug(
                f"Tracked request: {method} (tool: {tool_name}, "
                f"tokens: {prompt_tokens + completion_tokens}, cost: ${estimated_cost:.6f})"
            )
        except Exception as e:
            logger.error(f"Failed to track request: {e}")

    def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions and return count of removed sessions"""
        now = datetime.now()
        expired = []

        for session_id, last_seen in self.sessions.items():
            if now - last_seen > timedelta(seconds=self.timeout):
                expired.append(session_id)

        for session_id in expired:
            del self.sessions[session_id]
            logger.info(f"Cleaned up expired session: {session_id}")

        return len(expired)

    def get_active_session_count(self) -> int:
        """Get count of active sessions"""
        # Clean up expired sessions first
        self.cleanup_expired_sessions()
        return len(self.sessions)


# Global session manager instance
_session_manager: SimplifiedSessionManager | None = None


def get_session_manager() -> SimplifiedSessionManager:
    """Get the global session manager instance"""
    global _session_manager
    if _session_manager is None:
        _session_manager = SimplifiedSessionManager()
    return _session_manager
