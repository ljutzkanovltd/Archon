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
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

# Removed direct logging import - using unified config
from ..config.logfire_config import get_logger
from .client_manager import get_supabase_client
from . import token_counter

# JWT support for session reconnection
from jose import jwt, JWTError

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

    def __init__(self, timeout: int = 300, use_database: bool = True):
        """
        Initialize session manager

        Args:
            timeout: Session expiration time in seconds (default: 5 minutes)
            use_database: Whether to persist sessions to PostgreSQL (default: True)
        """
        self.sessions: dict[str, datetime] = {}  # session_id -> last_seen (in-memory cache)
        self.timeout = timeout
        self.use_database = use_database
        self._db_client = None

        # JWT secret for session reconnection tokens
        self.jwt_secret = os.getenv("MCP_SESSION_SECRET", secrets.token_urlsafe(32))
        self.token_expiry_minutes = int(os.getenv("MCP_RECONNECT_TOKEN_EXPIRY", "15"))

        # Initialize database client if enabled
        if self.use_database:
            try:
                self._db_client = get_supabase_client()
                logger.info("Session manager initialized with database persistence")
            except Exception as e:
                logger.warning(f"Failed to initialize database client: {e}. Falling back to in-memory only.")
                self.use_database = False

    def create_session(
        self,
        client_info: Optional[dict[str, Any]] = None,
        user_context: Optional[dict[str, Any]] = None
    ) -> str:
        """
        Create a new session and return its ID.

        Args:
            client_info: Optional client metadata from MCP initialize request
                        Expected fields: name, version, capabilities
            user_context: Optional user identification for multi-user support
                         Expected fields: user_id, user_email, user_name
                         Example: {"user_id": "uuid", "user_email": "user@example.com", "user_name": "John Doe"}

        Returns:
            Session ID (UUID string)
        """
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
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

        # Extract user context (optional, for multi-user support)
        user_id = None
        user_email = None
        user_name = None

        if user_context:
            user_id = user_context.get("user_id")
            user_email = user_context.get("user_email")
            user_name = user_context.get("user_name")

        # Persist to database if enabled
        if self.use_database and self._db_client:
            try:
                session_data = {
                    "session_id": session_id,
                    "client_type": client_type,
                    "client_version": client_version,
                    "client_capabilities": client_capabilities,
                    "connected_at": now.isoformat(),
                    "last_activity": now.isoformat(),
                    "status": "active",
                    "metadata": client_info or {}
                }

                # Add user context if provided
                if user_id:
                    session_data["user_id"] = user_id
                if user_email:
                    session_data["user_email"] = user_email
                if user_name:
                    session_data["user_name"] = user_name

                self._db_client.table("archon_mcp_sessions").insert(session_data).execute()

                log_message = f"Created session {session_id} with client {client_type}"
                if user_email:
                    log_message += f" for user {user_email}"
                log_message += " (persisted to DB)"
                logger.info(log_message)

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
        now = datetime.now(timezone.utc)

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

    def update_session(self, session_id: str) -> bool:
        """
        Update session's last_activity timestamp (heartbeat).

        This method is called by the heartbeat tool to keep sessions alive.

        Args:
            session_id: Session UUID to update

        Returns:
            True if updated successfully, False otherwise
        """
        if session_id not in self.sessions:
            logger.warning(f"Cannot update unknown session: {session_id}")
            return False

        now = datetime.now(timezone.utc)
        self.sessions[session_id] = now

        # Update database
        if self.use_database and self._db_client:
            try:
                self._db_client.table("archon_mcp_sessions")\
                    .update({"last_activity": now.isoformat()})\
                    .eq("session_id", session_id)\
                    .execute()
                logger.debug(f"Session {session_id} activity updated (heartbeat)")
                return True
            except Exception as e:
                logger.error(f"Failed to update session last_activity in database: {e}")
                return False

        return True

    def mark_disconnected(self, session_id: str, reason: str = "client_disconnect") -> bool:
        """
        Mark a session as disconnected immediately (for disconnect detection).

        This is used when we detect a client has disconnected without
        waiting for the timeout period.

        Args:
            session_id: Session UUID to mark as disconnected
            reason: Reason for disconnect (e.g., "client_disconnect", "error", "timeout")

        Returns:
            True if successfully marked as disconnected
        """
        if session_id not in self.sessions:
            logger.warning(f"Cannot mark unknown session as disconnected: {session_id}")
            return False

        # Remove from in-memory cache
        del self.sessions[session_id]

        # Update database
        if self.use_database and self._db_client:
            try:
                now = datetime.now(timezone.utc)
                self._db_client.table("archon_mcp_sessions").update({
                    "status": "disconnected",
                    "disconnected_at": now.isoformat(),
                    "disconnect_reason": reason
                }).eq("session_id", session_id).execute()
                logger.info(f"Session {session_id} marked as disconnected (reason: {reason})")
                return True
            except Exception as e:
                logger.error(f"Failed to mark session {session_id} as disconnected: {e}")
                return False

        return True

    def session_exists(self, session_id: str) -> bool:
        """
        Check if a session exists (in-memory or database).

        Args:
            session_id: Session UUID to check

        Returns:
            True if session exists and is active
        """
        # Check in-memory first
        if session_id in self.sessions:
            return True

        # Check database
        if self.use_database and self._db_client:
            try:
                result = self._db_client.table("archon_mcp_sessions")\
                    .select("session_id, status")\
                    .eq("session_id", session_id)\
                    .eq("status", "active")\
                    .execute()
                return len(result.data) > 0
            except Exception as e:
                logger.error(f"Error checking session existence: {e}")
                return False

        return False

    def generate_session_token(self, session_id: str, expires_minutes: Optional[int] = None) -> str:
        """
        Generate JWT token for session reconnection.

        Args:
            session_id: Session UUID
            expires_minutes: Token expiration time (default: from config)

        Returns:
            JWT token string
        """
        if expires_minutes is None:
            expires_minutes = self.token_expiry_minutes

        now = datetime.now(timezone.utc)
        payload = {
            "session_id": session_id,
            "exp": now + timedelta(minutes=expires_minutes),
            "iat": now,
            "purpose": "session_reconnect"
        }

        token = jwt.encode(payload, self.jwt_secret, algorithm="HS256")

        # Store token hash in database for verification
        if self.use_database and self._db_client:
            try:
                token_hash = hashlib.sha256(token.encode()).hexdigest()
                self._db_client.table("archon_mcp_sessions").update({
                    "reconnect_token_hash": token_hash,
                    "reconnect_expires_at": (now + timedelta(minutes=expires_minutes)).isoformat()
                }).eq("session_id", session_id).execute()
                logger.debug(f"Generated reconnection token for session {session_id}")
            except Exception as e:
                logger.error(f"Failed to store token hash: {e}")

        return token

    def reconnect_session(self, session_id: str, token: str) -> dict:
        """
        Reconnect to existing session using session_id and token.

        Args:
            session_id: Session UUID
            token: JWT reconnection token

        Returns:
            {"success": bool, "reason": str, "session_id": str}
        """
        try:
            # Decode and verify JWT
            payload = jwt.decode(token, self.jwt_secret, algorithms=["HS256"])

            # Verify session_id matches
            if payload.get("session_id") != session_id:
                logger.warning(f"Session ID mismatch in reconnection attempt for {session_id}")
                return {"success": False, "reason": "session_id_mismatch"}

            # Verify purpose
            if payload.get("purpose") != "session_reconnect":
                logger.warning(f"Invalid token purpose for session {session_id}")
                return {"success": False, "reason": "invalid_token_purpose"}

            # Check if session exists in database
            if self.use_database and self._db_client:
                result = self._db_client.table("archon_mcp_sessions")\
                    .select("*")\
                    .eq("session_id", session_id)\
                    .execute()

                if not result.data:
                    logger.warning(f"Session not found for reconnection: {session_id}")
                    return {"success": False, "reason": "session_not_found"}

                session = result.data[0]

                # Verify token hash
                token_hash = hashlib.sha256(token.encode()).hexdigest()
                if session.get("reconnect_token_hash") != token_hash:
                    logger.warning(f"Token hash mismatch for session {session_id}")
                    return {"success": False, "reason": "token_mismatch"}

                # Check if session already disconnected
                if session["status"] == "disconnected":
                    logger.warning(f"Attempted reconnection to disconnected session: {session_id}")
                    return {"success": False, "reason": "session_already_disconnected"}

                # Update last_activity to prevent timeout
                now = datetime.now(timezone.utc)
                self.sessions[session_id] = now

                reconnect_count = session.get("reconnect_count", 0) + 1

                self._db_client.table("archon_mcp_sessions").update({
                    "last_activity": now.isoformat(),
                    "reconnect_count": reconnect_count
                }).eq("session_id", session_id).execute()

                logger.info(f"✅ Session reconnected: {session_id} (reconnect #{reconnect_count})")
                return {
                    "success": True,
                    "reason": "reconnected",
                    "session_id": session_id,
                    "reconnect_count": reconnect_count
                }

            return {"success": False, "reason": "database_unavailable"}

        except jwt.ExpiredSignatureError:
            logger.warning(f"Expired token for session {session_id}")
            return {"success": False, "reason": "token_expired"}
        except jwt.JWTError as e:
            logger.warning(f"Invalid token for session {session_id}: {e}")
            return {"success": False, "reason": "invalid_token"}
        except Exception as e:
            logger.error(f"Error reconnecting session {session_id}: {e}")
            return {"success": False, "reason": "internal_error", "error": str(e)}

    def close_session(self, session_id: str, reason: str = "client_disconnect") -> None:
        """
        Close a session gracefully and calculate total duration.

        Args:
            session_id: Session UUID to close
            reason: Reason for closure ('client_disconnect', 'timeout', 'server_shutdown')
        """
        # Remove from in-memory cache
        if session_id in self.sessions:
            del self.sessions[session_id]

        # Update database with disconnect time and duration
        if self.use_database and self._db_client:
            try:
                # Get session start time from database
                response = self._db_client.table("archon_mcp_sessions")\
                    .select("connected_at, status")\
                    .eq("session_id", session_id)\
                    .execute()

                if response.data and len(response.data) > 0:
                    session_data = response.data[0]

                    # Only close if not already disconnected
                    if session_data.get("status") == "active":
                        connected_at = datetime.fromisoformat(session_data["connected_at"])
                        disconnected_at = datetime.now(timezone.utc)
                        total_duration = int((disconnected_at - connected_at).total_seconds())

                        # Update session with disconnect time and duration
                        self._db_client.table("archon_mcp_sessions")\
                            .update({
                                "disconnected_at": disconnected_at.isoformat(),
                                "total_duration": total_duration,
                                "status": "disconnected",
                                "disconnect_reason": reason
                            })\
                            .eq("session_id", session_id)\
                            .execute()

                        logger.info(f"Session {session_id} closed gracefully (duration: {total_duration}s, reason: {reason})")
                    else:
                        logger.debug(f"Session {session_id} already disconnected, skipping close")
                else:
                    logger.warning(f"Session {session_id} not found in database")

            except Exception as e:
                logger.error(f"Failed to close session {session_id} in database: {e}")
        else:
            logger.info(f"Session {session_id} closed (in-memory only, reason: {reason})")

    def _disconnect_session(self, session_id: str) -> None:
        """
        Mark a session as disconnected (legacy method for timeout-based cleanup).
        For explicit disconnects, use close_session() instead.
        """
        # Remove from in-memory cache
        if session_id in self.sessions:
            del self.sessions[session_id]

        # Update database if enabled
        if self.use_database and self._db_client:
            try:
                self._db_client.table("archon_mcp_sessions")\
                    .update({
                        "disconnected_at": datetime.now(timezone.utc).isoformat(),
                        "status": "disconnected",
                        "disconnect_reason": "timeout"
                    })\
                    .eq("session_id", session_id)\
                    .execute()
                logger.info(f"Session {session_id} marked as disconnected in database (timeout)")
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
            # CRITICAL FIX: Cast duration_ms to int - database column is INTEGER type
            duration_ms_int = int(duration_ms) if duration_ms is not None else None

            self._db_client.table("archon_mcp_requests").insert({
                "session_id": session_id,
                "method": method,
                "tool_name": tool_name,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "estimated_cost": estimated_cost,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "duration_ms": duration_ms_int,
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
        """
        Remove expired sessions and return count of removed sessions.

        This cleanup runs every 60 seconds and marks sessions as disconnected
        if they haven't had activity within the timeout period (5 minutes).

        Returns:
            Number of sessions cleaned up
        """
        now = datetime.now(timezone.utc)
        expired = []

        # Check in-memory sessions first
        for session_id, last_seen in self.sessions.items():
            if now - last_seen > timedelta(seconds=self.timeout):
                expired.append(session_id)

        # Also check database for sessions not in memory (crashed/restarted server)
        if self.use_database and self._db_client:
            try:
                cutoff_time = (now - timedelta(seconds=self.timeout)).isoformat()
                result = self._db_client.table("archon_mcp_sessions")\
                    .select("session_id")\
                    .eq("status", "active")\
                    .lt("last_activity", cutoff_time)\
                    .execute()

                for session in result.data:
                    sid = session["session_id"]
                    if sid not in expired:
                        expired.append(sid)

            except Exception as e:
                logger.error(f"Error checking database for expired sessions: {e}")

        # Process expired sessions
        disconnected_count = 0
        for session_id in expired:
            # Remove from in-memory cache
            if session_id in self.sessions:
                del self.sessions[session_id]

            # Mark as disconnected in database
            if self.use_database and self._db_client:
                try:
                    self._db_client.table("archon_mcp_sessions").update({
                        "status": "disconnected",
                        "disconnected_at": now.isoformat(),
                        "disconnect_reason": "timeout_no_activity"
                    }).eq("session_id", session_id).execute()
                    disconnected_count += 1
                    logger.debug(f"Session {session_id} marked as disconnected (timeout)")
                except Exception as e:
                    logger.error(f"Failed to mark session {session_id} as disconnected: {e}")
            else:
                disconnected_count += 1
                logger.debug(f"Cleaned up expired session: {session_id} (in-memory only)")

        if disconnected_count > 0:
            logger.info(f"🧹 Cleaned up {disconnected_count} inactive sessions")

        return disconnected_count

    def get_active_session_count(self) -> int:
        """Get count of active sessions"""
        # Clean up expired sessions first
        self.cleanup_expired_sessions()
        return len(self.sessions)

    def recover_active_sessions(self) -> list[str]:
        """
        Load active sessions from database into in-memory cache.
        Called on server startup to prevent session fragmentation after restart.

        Returns:
            List of recovered session IDs
        """
        if not self.use_database or not self._db_client:
            logger.warning("Database not available, skipping session recovery")
            return []

        try:
            # Query active sessions from last timeout period
            cutoff_time = (datetime.now(timezone.utc) - timedelta(seconds=self.timeout)).isoformat()

            result = self._db_client.table("archon_mcp_sessions")\
                .select("session_id, last_activity")\
                .eq("status", "active")\
                .gte("last_activity", cutoff_time)\
                .execute()

            recovered = []
            for session in result.data:
                session_id = session["session_id"]
                last_activity = datetime.fromisoformat(session["last_activity"])

                # Add to in-memory cache
                self.sessions[session_id] = last_activity
                recovered.append(session_id)

            if recovered:
                logger.info(f"✅ Recovered {len(recovered)} active sessions from database after restart")
            else:
                logger.info("No active sessions to recover from database")

            return recovered

        except Exception as e:
            logger.error(f"Failed to recover sessions from database: {e}")
            logger.error(traceback.format_exc())
            return []


# Global session manager instance
_session_manager: SimplifiedSessionManager | None = None


def get_session_manager() -> SimplifiedSessionManager:
    """Get the global session manager instance"""
    global _session_manager
    if _session_manager is None:
        _session_manager = SimplifiedSessionManager()
    return _session_manager
