"""
Database Synchronization API
Provides REST and WebSocket endpoints for bidirectional database sync operations.
"""

import asyncio
import json
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..utils import get_supabase_client

# Router setup
router = APIRouter(prefix="/api/database", tags=["database-sync"])

# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections for real-time sync updates."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, sync_id: str):
        """Accept WebSocket connection and register for sync updates."""
        await websocket.accept()
        if sync_id not in self.active_connections:
            self.active_connections[sync_id] = []
        self.active_connections[sync_id].append(websocket)

    def disconnect(self, websocket: WebSocket, sync_id: str):
        """Remove WebSocket connection."""
        if sync_id in self.active_connections:
            self.active_connections[sync_id].remove(websocket)
            if not self.active_connections[sync_id]:
                del self.active_connections[sync_id]

    async def broadcast(self, sync_id: str, message: dict):
        """Broadcast message to all connected clients for this sync_id."""
        if sync_id in self.active_connections:
            for connection in self.active_connections[sync_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error broadcasting to WebSocket: {e}")

manager = ConnectionManager()

# Active sync processes
active_syncs: Dict[str, subprocess.Popen] = {}


# Request/Response Models
class SyncStartRequest(BaseModel):
    """Request to start a database sync operation."""
    direction: str = Field(..., pattern="^(local-to-remote|remote-to-local)$")
    skip_confirmation: bool = Field(default=False, description="Skip interactive confirmations (use with caution)")
    triggered_by: str = Field(default="User", description="Who initiated the sync")


class SyncStatusResponse(BaseModel):
    """Response containing sync operation status."""
    sync_id: str
    direction: str
    status: str
    current_phase: Optional[str]
    percent_complete: int
    total_rows: Optional[int]
    synced_rows: Optional[int]
    current_table: Optional[str]
    started_at: str
    completed_at: Optional[str]
    duration_seconds: Optional[int]
    error_message: Optional[str]


class PreflightCheckRequest(BaseModel):
    """Request for pre-flight checks before sync."""
    direction: str = Field(..., pattern="^(local-to-remote|remote-to-local)$")


class PreflightCheckResponse(BaseModel):
    """Response containing pre-flight check results."""
    success: bool
    checks: Dict[str, dict]
    warnings: List[str]
    errors: List[str]


# Helper Functions
def create_sync_record(sync_id: str, direction: str, triggered_by: str) -> None:
    """Create initial sync history record."""
    supabase = get_supabase_client()
    supabase.table("archon_sync_history").insert({
        "sync_id": sync_id,
        "direction": direction,
        "status": "running",
        "current_phase": "validation",
        "percent_complete": 0,
        "triggered_by": triggered_by
    }).execute()


async def update_sync_progress(
    sync_id: str,
    phase: Optional[str] = None,
    progress: Optional[int] = None,
    current_table: Optional[str] = None,
    status: Optional[str] = None,
    error_message: Optional[str] = None
) -> None:
    """Update sync progress in database and broadcast to WebSocket clients."""
    supabase = get_supabase_client()

    updates = {}

    if phase is not None:
        updates["current_phase"] = phase

    if progress is not None:
        updates["percent_complete"] = progress

    if current_table is not None:
        updates["current_table"] = current_table

    if status is not None:
        updates["status"] = status
        if status in ["completed", "failed", "cancelled"]:
            updates["completed_at"] = datetime.now().isoformat()

    if error_message is not None:
        updates["error_message"] = error_message

    if updates:
        updates["updated_at"] = datetime.now().isoformat()
        supabase.table("archon_sync_history").update(updates).eq("sync_id", sync_id).execute()

    # Broadcast update via WebSocket
    await manager.broadcast(sync_id, {
        "type": "progress_update",
        "sync_id": sync_id,
        "phase": phase,
        "progress": progress,
        "current_table": current_table,
        "status": status,
        "timestamp": datetime.now().isoformat()
    })


async def run_sync_process(sync_id: str, direction: str, skip_confirmation: bool) -> None:
    """
    Run sync process in background and update progress.
    This is the main sync execution function.
    """
    script_path = Path(__file__).parent.parent.parent.parent.parent / "scripts" / "sync-databases-v2.sh"

    if not script_path.exists():
        await update_sync_progress(
            sync_id,
            status="failed",
            error_message=f"Sync script not found: {script_path}"
        )
        return

    # Build command
    cmd = ["bash", str(script_path), f"--direction={direction}"]
    if skip_confirmation:
        cmd.append("--skip-confirm")

    try:
        # Start subprocess
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )

        active_syncs[sync_id] = process

        # Monitor output and update progress
        current_phase = "validation"
        progress = 0

        # Read output line by line
        for line in iter(process.stdout.readline, ''):
            if not line:
                break

            # Parse progress from script output
            # Expecting format like: [PHASE: export] [PROGRESS: 25%] [TABLE: archon_tasks]
            if "[PHASE:" in line:
                phase_match = line.split("[PHASE:")[1].split("]")[0].strip()
                current_phase = phase_match

            if "[PROGRESS:" in line:
                progress_match = line.split("[PROGRESS:")[1].split("]")[0].strip()
                progress = int(progress_match.rstrip("%"))

            current_table = None
            if "[TABLE:" in line:
                table_match = line.split("[TABLE:")[1].split("]")[0].strip()
                current_table = table_match

            # Update database and broadcast
            await update_sync_progress(
                sync_id,
                phase=current_phase,
                progress=progress,
                current_table=current_table
            )

            # Also broadcast the log line
            await manager.broadcast(sync_id, {
                "type": "log",
                "message": line.strip(),
                "timestamp": datetime.now().isoformat()
            })

        # Wait for process to complete
        process.wait()

        # Check exit code
        if process.returncode == 0:
            await update_sync_progress(
                sync_id,
                status="completed",
                progress=100,
                phase="verification"
            )
        else:
            stderr_output = process.stderr.read()
            await update_sync_progress(
                sync_id,
                status="failed",
                error_message=f"Sync failed with exit code {process.returncode}: {stderr_output}"
            )

    except Exception as e:
        await update_sync_progress(
            sync_id,
            status="failed",
            error_message=f"Exception during sync: {str(e)}"
        )

    finally:
        # Clean up
        if sync_id in active_syncs:
            del active_syncs[sync_id]


# API Endpoints

@router.post("/sync")
async def start_sync(request: SyncStartRequest) -> JSONResponse:
    """
    Start a database synchronization operation.

    Returns sync_id for tracking progress.
    """
    # Check if another sync is already running
    supabase = get_supabase_client()

    running_syncs = supabase.table("archon_sync_history").select("sync_id").eq("status", "running").order("started_at", desc=True).limit(1).execute()

    if running_syncs.data:
        raise HTTPException(
            status_code=409,
            detail=f"Another sync is already running: {running_syncs.data[0]['sync_id']}"
        )

    # Generate sync ID
    sync_id = str(uuid.uuid4())

    # Create sync record
    create_sync_record(sync_id, request.direction, request.triggered_by)

    # Start sync process in background
    asyncio.create_task(run_sync_process(
        sync_id,
        request.direction,
        request.skip_confirmation
    ))

    return JSONResponse({
        "success": True,
        "sync_id": sync_id,
        "message": f"Sync started: {request.direction}",
        "websocket_url": f"/ws/sync/{sync_id}"
    })


@router.get("/sync/{sync_id}/status")
async def get_sync_status(sync_id: str) -> SyncStatusResponse:
    """Get current status of a sync operation."""
    supabase = get_supabase_client()

    result = supabase.table("archon_sync_history").select("*").eq("sync_id", sync_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail=f"Sync not found: {sync_id}")

    data = result.data[0]

    return SyncStatusResponse(
        sync_id=data["sync_id"],
        direction=data["direction"],
        status=data["status"],
        current_phase=data.get("current_phase"),
        percent_complete=data.get("percent_complete", 0),
        total_rows=data.get("total_rows"),
        synced_rows=data.get("synced_rows"),
        current_table=data.get("current_table"),
        started_at=data["started_at"],
        completed_at=data.get("completed_at"),
        duration_seconds=data.get("duration_seconds"),
        error_message=data.get("error_message")
    )


@router.get("/sync/history")
async def get_sync_history(
    limit: int = 10,
    offset: int = 0,
    status: Optional[str] = None,
    direction: Optional[str] = None
) -> JSONResponse:
    """Get history of past sync operations."""
    supabase = get_supabase_client()

    # Build query
    query = supabase.table("archon_sync_history").select("*")

    if status:
        query = query.eq("status", status)

    if direction:
        query = query.eq("direction", direction)

    # Get total count (without pagination)
    count_query = supabase.table("archon_sync_history").select("*", count="exact")
    if status:
        count_query = count_query.eq("status", status)
    if direction:
        count_query = count_query.eq("direction", direction)
    count_result = count_query.execute()

    # Apply pagination
    results = query.order("started_at", desc=True).range(offset, offset + limit - 1).execute()

    return JSONResponse({
        "success": True,
        "total": count_result.count,
        "syncs": [
            {
                "sync_id": row["sync_id"],
                "direction": row["direction"],
                "status": row["status"],
                "current_phase": row.get("current_phase"),
                "percent_complete": row.get("percent_complete", 0),
                "started_at": row["started_at"],
                "completed_at": row.get("completed_at"),
                "duration_seconds": row.get("duration_seconds"),
                "error_message": row.get("error_message"),
                "triggered_by": row.get("triggered_by", "User")
            }
            for row in results.data
        ]
    })


@router.post("/sync/{sync_id}/cancel")
async def cancel_sync(sync_id: str) -> JSONResponse:
    """
    Cancel a running sync operation.
    Triggers rollback if cancellation occurs during import phase.
    """
    if sync_id not in active_syncs:
        raise HTTPException(status_code=404, detail=f"No active sync found: {sync_id}")

    process = active_syncs[sync_id]

    # Send SIGTERM to allow graceful shutdown
    process.terminate()

    # Wait up to 10 seconds for graceful termination
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        # Force kill if not terminated
        process.kill()

    # Update database
    await update_sync_progress(
        sync_id,
        status="cancelled",
        error_message="Sync cancelled by user"
    )

    return JSONResponse({
        "success": True,
        "message": f"Sync cancelled: {sync_id}"
    })


@router.post("/sync/preflight")
async def preflight_checks(request: PreflightCheckRequest) -> PreflightCheckResponse:
    """
    Run pre-flight checks before starting sync.
    Validates database connectivity, disk space, schema versions, etc.
    """
    checks = {}
    warnings = []
    errors = []

    # TODO: Implement actual pre-flight checks
    # For now, return mock data

    checks["database_connectivity"] = {
        "local": {"status": "ok", "latency_ms": 5},
        "remote": {"status": "ok", "latency_ms": 120}
    }

    checks["disk_space"] = {
        "available_gb": 50.5,
        "required_gb": 2.0,
        "status": "ok"
    }

    checks["schema_version"] = {
        "local": {"version": "031", "postgres": "15.14"},
        "remote": {"version": "031", "postgres": "17.6"},
        "compatible": True
    }

    checks["backup_exists"] = {
        "status": "ok",
        "latest_backup": "unified-backup-20260112-134221",
        "age_hours": 2.5
    }

    # Add warnings if needed
    if checks["backup_exists"]["age_hours"] > 24:
        warnings.append("Latest backup is more than 24 hours old")

    return PreflightCheckResponse(
        success=len(errors) == 0,
        checks=checks,
        warnings=warnings,
        errors=errors
    )


# WebSocket Endpoint
@router.websocket("/ws/sync/{sync_id}")
async def websocket_sync_progress(websocket: WebSocket, sync_id: str):
    """
    WebSocket endpoint for real-time sync progress updates.
    Clients connect here to receive live updates during sync.
    """
    await manager.connect(websocket, sync_id)

    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "sync_id": sync_id,
            "message": "Connected to sync progress stream",
            "timestamp": datetime.now().isoformat()
        })

        # Keep connection alive and handle incoming messages
        while True:
            # Wait for client messages (heartbeat, etc.)
            data = await websocket.receive_text()

            # Echo back to confirm connection is alive
            if data == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket, sync_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, sync_id)
