"""
Session Event Broadcaster

Broadcasts real-time session events to connected WebSocket clients.
Used for instant dashboard updates instead of polling.
"""

import asyncio
from typing import Set
from fastapi import WebSocket
from ..config.logfire_config import get_logger

logger = get_logger(__name__)


class SessionEventBroadcaster:
    """
    Broadcast session events to WebSocket clients.

    Events:
    - session_created: New session established
    - session_updated: Session activity (heartbeat, tool call)
    - session_disconnected: Session ended
    """

    def __init__(self):
        """Initialize broadcaster with empty connection set."""
        self.connections: Set[WebSocket] = set()
        logger.info("Session event broadcaster initialized")

    async def connect(self, websocket: WebSocket):
        """
        Add new WebSocket connection.

        Args:
            websocket: WebSocket connection to add
        """
        await websocket.accept()
        self.connections.add(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.connections)}")

    async def disconnect(self, websocket: WebSocket):
        """
        Remove WebSocket connection.

        Args:
            websocket: WebSocket connection to remove
        """
        self.connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.connections)}")

    async def broadcast_event(self, event: dict):
        """
        Broadcast event to all connected clients.

        Args:
            event: Event dictionary with type, session_id, and data

        Example:
            {
                "type": "session_created",
                "session_id": "abc-123",
                "data": {...}
            }
        """
        if not self.connections:
            return  # No clients connected

        logger.debug(f"Broadcasting {event['type']} to {len(self.connections)} clients")

        # Send to all connected clients
        disconnected = set()
        for connection in self.connections:
            try:
                await connection.send_json(event)
            except Exception as e:
                logger.warning(f"Failed to send event to client: {e}")
                disconnected.add(connection)

        # Remove failed connections
        self.connections -= disconnected

        if disconnected:
            logger.info(f"Removed {len(disconnected)} failed connections")

    async def broadcast_session_created(self, session_id: str, client_type: str):
        """
        Broadcast session creation event.

        Args:
            session_id: Session UUID
            client_type: Client type string
        """
        await self.broadcast_event({
            "type": "session_created",
            "session_id": session_id,
            "data": {
                "client_type": client_type,
                "status": "active"
            }
        })

    async def broadcast_session_updated(self, session_id: str, update_type: str = "heartbeat"):
        """
        Broadcast session update event.

        Args:
            session_id: Session UUID
            update_type: Type of update (heartbeat, tool_call, etc.)
        """
        await self.broadcast_event({
            "type": "session_updated",
            "session_id": session_id,
            "data": {
                "update_type": update_type
            }
        })

    async def broadcast_session_disconnected(self, session_id: str, reason: str):
        """
        Broadcast session disconnection event.

        Args:
            session_id: Session UUID
            reason: Disconnect reason
        """
        await self.broadcast_event({
            "type": "session_disconnected",
            "session_id": session_id,
            "data": {
                "reason": reason,
                "status": "disconnected"
            }
        })


# Global broadcaster instance
_broadcaster: SessionEventBroadcaster | None = None


def get_broadcaster() -> SessionEventBroadcaster:
    """Get or create global broadcaster instance."""
    global _broadcaster
    if _broadcaster is None:
        _broadcaster = SessionEventBroadcaster()
    return _broadcaster
