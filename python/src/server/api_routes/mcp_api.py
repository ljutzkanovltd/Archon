"""
MCP API endpoints for Archon

Provides status, configuration, and analytics endpoints for the MCP service.
Includes client detection, usage tracking, token analytics, and cost estimation.

Status monitoring uses HTTP health checks by default (secure, portable).
Docker socket mode available via ENABLE_DOCKER_SOCKET_MONITORING (legacy, security risk).
"""

import os
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

# Import unified logging
from ..config.config import get_mcp_monitoring_config
from ..config.logfire_config import api_logger, safe_set_attribute, safe_span
from ..config.service_discovery import get_mcp_url
from ..services.client_manager import get_supabase_client

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


async def get_container_status_http() -> dict[str, Any]:
    """Get MCP server status via HTTP health check endpoint.

    This is the secure, recommended approach that doesn't require Docker socket.
    Works across all deployment environments (Docker, Kubernetes, bare metal).

    Returns:
        Status dict: {"status": str, "uptime": int|None, "logs": []}
    """
    config = get_mcp_monitoring_config()
    mcp_url = get_mcp_url()

    try:
        # Use async context manager for proper connection cleanup
        async with httpx.AsyncClient(timeout=config.health_check_timeout) as client:
            response = await client.get(f"{mcp_url}/health")
            response.raise_for_status()

            # MCP health endpoint returns: {"success": bool, "uptime_seconds": int, "health": {...}}
            data = response.json()

            # Transform to expected API contract
            uptime_value = data.get("uptime_seconds")
            return {
                "status": "running" if data.get("success") else "unhealthy",
                "uptime": int(uptime_value) if uptime_value is not None else None,
                "logs": [],  # Historical artifact, kept for API compatibility
            }

    except httpx.ConnectError:
        # MCP container not running or unreachable
        api_logger.warning("MCP server unreachable via HTTP health check")
        return {
            "status": "unreachable",
            "uptime": None,
            "logs": [],
        }
    except httpx.TimeoutException:
        # MCP responding too slowly
        api_logger.warning(f"MCP server health check timed out after {config.health_check_timeout}s")
        return {
            "status": "unhealthy",
            "uptime": None,
            "logs": [],
        }
    except Exception:
        # Unexpected error
        api_logger.error("Failed to check MCP server health via HTTP", exc_info=True)
        return {
            "status": "error",
            "uptime": None,
            "logs": [],
        }


def get_container_status_docker() -> dict[str, Any]:
    """Get MCP container status via Docker socket (legacy mode).

    SECURITY WARNING: Requires Docker socket mounted, granting root-equivalent host access.
    Only enable this mode if you specifically need Docker container status details.
    Set ENABLE_DOCKER_SOCKET_MONITORING=true to use this mode.

    Returns:
        Status dict: {"status": str, "uptime": int|None, "logs": []}
    """
    import docker
    from docker.errors import NotFound

    docker_client = None
    try:
        docker_client = docker.from_env()
        container = docker_client.containers.get("archon-mcp")

        # Get container status
        container_status = container.status

        # Map Docker statuses to simple statuses
        if container_status == "running":
            status = "running"
            # Try to get uptime from container info
            try:
                from datetime import datetime

                started_at = container.attrs["State"]["StartedAt"]
                started_time = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                uptime = int((datetime.now(started_time.tzinfo) - started_time).total_seconds())
            except Exception:
                uptime = None
        else:
            status = "stopped"
            uptime = None

        return {
            "status": status,
            "uptime": uptime,
            "logs": [],  # No log streaming anymore
        }

    except NotFound:
        api_logger.warning("MCP container not found via Docker socket")
        return {
            "status": "not_found",
            "uptime": None,
            "logs": [],
            "message": "MCP container not found. Run: docker compose up -d archon-mcp",
        }
    except Exception as e:
        api_logger.error("Failed to get MCP container status via Docker", exc_info=True)
        return {
            "status": "error",
            "uptime": None,
            "logs": [],
            "error": str(e),
        }
    finally:
        # CRITICAL: Always close Docker client to prevent connection leaks
        if docker_client is not None:
            try:
                docker_client.close()
            except Exception:
                pass


async def get_container_status() -> dict[str, Any]:
    """Get MCP server status using configured monitoring strategy.

    Routes to HTTP health check (secure, default) or Docker socket (legacy).

    Returns:
        Status dict: {"status": str, "uptime": int|None, "logs": []}
    """
    config = get_mcp_monitoring_config()

    if config.enable_docker_socket:
        api_logger.info("Using Docker socket monitoring (ENABLE_DOCKER_SOCKET_MONITORING=true)")
        # Docker mode is synchronous
        return get_container_status_docker()
    else:
        # HTTP mode is asynchronous (default)
        return await get_container_status_http()


@router.get("/status")
async def get_status():
    """Get MCP server status.

    Returns container/server status, uptime, and logs (empty).
    Monitoring strategy controlled by ENABLE_DOCKER_SOCKET_MONITORING env var.
    """
    with safe_span("api_mcp_status") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/status")
        safe_set_attribute(span, "method", "GET")

        try:
            status = await get_container_status()
            api_logger.debug(f"MCP server status checked - status={status.get('status')}")
            safe_set_attribute(span, "status", status.get("status"))
            safe_set_attribute(span, "uptime", status.get("uptime"))
            return status
        except Exception as e:
            api_logger.error(f"MCP server status API failed - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/config")
async def get_mcp_config():
    """Get MCP server configuration."""
    with safe_span("api_get_mcp_config") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/config")
        safe_set_attribute(span, "method", "GET")

        try:
            api_logger.info("Getting MCP server configuration")

            # Get actual MCP port from environment or use default
            mcp_port = int(os.getenv("ARCHON_MCP_PORT", "8051"))

            # Configuration for streamable-http mode with actual port
            config = {
                "host": os.getenv("ARCHON_HOST", "localhost"),
                "port": mcp_port,
                "transport": "streamable-http",
            }

            # Get only model choice from database (simplified)
            try:
                from ..services.credential_service import credential_service

                model_choice = await credential_service.get_credential("MODEL_CHOICE", "gpt-4o-mini")
                config["model_choice"] = model_choice
            except Exception:
                # Fallback to default model
                config["model_choice"] = "gpt-4o-mini"

            api_logger.info("MCP configuration (streamable-http mode)")
            safe_set_attribute(span, "host", config["host"])
            safe_set_attribute(span, "port", config["port"])
            safe_set_attribute(span, "transport", "streamable-http")
            safe_set_attribute(span, "model_choice", config.get("model_choice", "gpt-4o-mini"))

            return config
        except Exception as e:
            api_logger.error("Failed to get MCP configuration", exc_info=True)
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail={"error": str(e)}) from e


@router.get("/clients")
async def get_mcp_clients(
    status_filter: Optional[str] = Query(None, description="Filter by status: active, idle, all")
):
    """
    Get connected MCP clients with type detection from database.

    Args:
        status_filter: Filter by status (active, idle, or all)

    Returns:
        List of connected clients with metadata
    """
    with safe_span("api_mcp_clients") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/clients")
        safe_set_attribute(span, "method", "GET")

        try:
            db_client = get_supabase_client()

            # Build query - get active sessions (not disconnected)
            query = db_client.table("archon_mcp_sessions")\
                .select("*")\
                .is_("disconnected_at", "null")\
                .order("last_activity", desc=True)

            # Apply status filter if provided
            if status_filter and status_filter != "all":
                query = query.eq("status", status_filter)

            result = query.execute()

            # Transform to frontend format
            clients = []
            for session in result.data:
                clients.append({
                    "session_id": session["session_id"],
                    "client_type": session["client_type"],
                    "client_version": session.get("client_version"),
                    "connected_at": session["connected_at"],
                    "last_activity": session["last_activity"],
                    "status": session["status"],
                    "disconnected_at": session.get("disconnected_at"),
                    "total_duration": session.get("total_duration"),
                    "disconnect_reason": session.get("disconnect_reason"),
                    "user_id": session.get("user_id"),
                    "user_email": session.get("user_email"),
                    "user_name": session.get("user_name"),
                })

            api_logger.debug(f"Getting MCP clients - found {len(clients)} active clients")
            safe_set_attribute(span, "client_count", len(clients))

            return {"clients": clients, "total": len(clients)}

        except Exception as e:
            api_logger.error(f"Failed to get MCP clients - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            return {"clients": [], "total": 0, "error": str(e)}


@router.get("/sessions")
async def get_mcp_sessions():
    """Get MCP session information with active session count from database."""
    with safe_span("api_mcp_sessions") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/sessions")
        safe_set_attribute(span, "method", "GET")

        try:
            db_client = get_supabase_client()

            # Count active sessions (not disconnected)
            result = db_client.table("archon_mcp_sessions")\
                .select("session_id", count="exact")\
                .is_("disconnected_at", "null")\
                .in_("status", ["active", "idle"])\
                .execute()

            active_count = result.count if hasattr(result, 'count') else len(result.data)

            status = await get_container_status()

            session_info = {
                "active_sessions": active_count,
                "session_timeout": 3600,  # 1 hour default
            }

            # Add uptime if server is running
            if status.get("status") == "running" and status.get("uptime"):
                session_info["server_uptime_seconds"] = status["uptime"]

            api_logger.debug(f"MCP session info - sessions={active_count}")
            safe_set_attribute(span, "active_sessions", active_count)

            return session_info
        except Exception as e:
            api_logger.error(f"Failed to get MCP sessions - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/sessions/health")
async def get_session_health():
    """
    Get comprehensive session health metrics for dashboard monitoring.

    Returns:
        - status_breakdown: Count by status (active, disconnected)
        - age_distribution: Sessions grouped by age (healthy, aging, stale)
        - connection_health: Average duration, sessions per hour, disconnect rate
        - recent_activity: Latest session activities
    """
    with safe_span("api_mcp_session_health") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/sessions/health")

        try:
            db_client = get_supabase_client()
            now = datetime.utcnow()

            # Status breakdown
            active_result = db_client.table("archon_mcp_sessions")\
                .select("session_id", count="exact")\
                .eq("status", "active")\
                .execute()

            disconnected_result = db_client.table("archon_mcp_sessions")\
                .select("session_id", count="exact")\
                .eq("status", "disconnected")\
                .execute()

            status_breakdown = {
                "active": active_result.count if hasattr(active_result, 'count') else len(active_result.data),
                "disconnected": disconnected_result.count if hasattr(disconnected_result, 'count') else len(disconnected_result.data),
                "total": (active_result.count if hasattr(active_result, 'count') else len(active_result.data)) +
                        (disconnected_result.count if hasattr(disconnected_result, 'count') else len(disconnected_result.data))
            }

            # Age distribution (for active sessions)
            active_sessions = db_client.table("archon_mcp_sessions")\
                .select("session_id, last_activity, connected_at")\
                .eq("status", "active")\
                .execute()

            age_distribution = {
                "healthy": 0,  # < 5 min since last activity
                "aging": 0,    # 5-10 min since last activity
                "stale": 0     # > 10 min since last activity
            }

            for session in active_sessions.data:
                last_activity = datetime.fromisoformat(session["last_activity"].replace("Z", "+00:00"))
                age_minutes = (now - last_activity.replace(tzinfo=None)).total_seconds() / 60

                if age_minutes < 5:
                    age_distribution["healthy"] += 1
                elif age_minutes < 10:
                    age_distribution["aging"] += 1
                else:
                    age_distribution["stale"] += 1

            # Connection health (last 24 hours)
            cutoff_24h = now - timedelta(hours=24)
            recent_sessions = db_client.table("archon_mcp_sessions")\
                .select("session_id, connected_at, disconnected_at, status")\
                .gte("connected_at", cutoff_24h.isoformat())\
                .execute()

            total_duration = 0
            disconnected_count = 0

            for session in recent_sessions.data:
                connected_at = datetime.fromisoformat(session["connected_at"].replace("Z", "+00:00"))

                if session.get("disconnected_at"):
                    disconnected_at = datetime.fromisoformat(session["disconnected_at"].replace("Z", "+00:00"))
                    duration = (disconnected_at - connected_at).total_seconds()
                    total_duration += duration
                    disconnected_count += 1
                elif session["status"] == "active":
                    # Active session - calculate current duration
                    duration = (now - connected_at.replace(tzinfo=None)).total_seconds()
                    total_duration += duration

            sessions_count = len(recent_sessions.data)
            avg_duration = int(total_duration / sessions_count) if sessions_count > 0 else 0
            sessions_per_hour = round(sessions_count / 24, 2)
            disconnect_rate = round((disconnected_count / sessions_count * 100), 1) if sessions_count > 0 else 0

            connection_health = {
                "avg_duration_seconds": avg_duration,
                "sessions_per_hour": sessions_per_hour,
                "disconnect_rate_percent": disconnect_rate,
                "total_sessions_24h": sessions_count
            }

            # Recent activity (last 10 sessions)
            recent_activity = db_client.table("archon_mcp_sessions")\
                .select("session_id, client_type, last_activity, status, connected_at")\
                .order("last_activity", desc=True)\
                .limit(10)\
                .execute()

            recent_list = []
            for session in recent_activity.data:
                last_activity = datetime.fromisoformat(session["last_activity"].replace("Z", "+00:00"))
                connected_at = datetime.fromisoformat(session["connected_at"].replace("Z", "+00:00"))
                age_minutes = int((now - last_activity.replace(tzinfo=None)).total_seconds() / 60)
                uptime_minutes = int((now - connected_at.replace(tzinfo=None)).total_seconds() / 60)

                recent_list.append({
                    "session_id": session["session_id"][:8] + "...",  # Truncated for display
                    "client_type": session.get("client_type", "unknown"),
                    "status": session["status"],
                    "age_minutes": age_minutes,
                    "uptime_minutes": uptime_minutes
                })

            return {
                "status_breakdown": status_breakdown,
                "age_distribution": age_distribution,
                "connection_health": connection_health,
                "recent_activity": recent_list,
                "timestamp": now.isoformat()
            }

        except Exception as e:
            api_logger.error(f"Failed to get session health - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/sessions/disconnected")
async def get_disconnected_sessions(
    days: int = Query(7, ge=1, le=30, description="Number of days to look back (default: 7)"),
    limit: int = Query(50, le=200, description="Maximum number of sessions to return")
):
    """
    Get disconnected sessions with duration and disconnect reason statistics.

    Shows recently disconnected sessions for debugging and monitoring purposes.
    Useful for understanding why clients disconnect and session duration patterns.
    """
    with safe_span("api_mcp_disconnected_sessions") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/sessions/disconnected")
        safe_set_attribute(span, "days", days)
        safe_set_attribute(span, "limit", limit)

        try:
            db_client = get_supabase_client()

            # Calculate date range
            end_dt = datetime.utcnow()
            start_dt = end_dt - timedelta(days=days)

            # Get disconnected sessions
            result = db_client.table("archon_mcp_sessions")\
                .select("*")\
                .eq("status", "disconnected")\
                .gte("disconnected_at", start_dt.isoformat())\
                .order("disconnected_at", desc=True)\
                .limit(limit)\
                .execute()

            sessions = result.data

            # Get request counts for each session
            for session in sessions:
                requests_result = db_client.table("archon_mcp_requests")\
                    .select("request_id", count="exact")\
                    .eq("session_id", session["session_id"])\
                    .execute()

                session["total_requests"] = requests_result.count if hasattr(requests_result, 'count') else 0

            # Calculate statistics
            if sessions:
                disconnect_reasons = {}
                total_duration = 0
                durations = []

                for session in sessions:
                    # Count disconnect reasons
                    reason = session.get("disconnect_reason", "unknown")
                    disconnect_reasons[reason] = disconnect_reasons.get(reason, 0) + 1

                    # Calculate duration stats
                    if session.get("total_duration"):
                        total_duration += session["total_duration"]
                        durations.append(session["total_duration"])

                stats = {
                    "total_disconnected": len(sessions),
                    "disconnect_reasons": disconnect_reasons,
                    "avg_duration_seconds": round(total_duration / len(sessions), 2) if sessions else 0,
                    "max_duration_seconds": max(durations) if durations else 0,
                    "min_duration_seconds": min(durations) if durations else 0,
                }
            else:
                stats = {
                    "total_disconnected": 0,
                    "disconnect_reasons": {},
                    "avg_duration_seconds": 0,
                    "max_duration_seconds": 0,
                    "min_duration_seconds": 0,
                }

            api_logger.debug(f"Retrieved {len(sessions)} disconnected sessions")
            safe_set_attribute(span, "session_count", len(sessions))

            return {
                "sessions": sessions,
                "statistics": stats,
                "period": {
                    "start": start_dt.isoformat(),
                    "end": end_dt.isoformat(),
                    "days": days
                }
            }

        except Exception as e:
            api_logger.error(f"Failed to get disconnected sessions - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/sessions/{session_id}")
async def get_session_details(session_id: str):
    """
    Get detailed information for a specific MCP session.

    Includes session metadata, request history, token usage, and cost breakdown.
    """
    with safe_span("api_mcp_session_details") as span:
        safe_set_attribute(span, "endpoint", f"/api/mcp/sessions/{session_id}")
        safe_set_attribute(span, "session_id", session_id)

        try:
            db_client = get_supabase_client()

            # Get session details
            session_result = db_client.table("archon_mcp_sessions")\
                .select("*")\
                .eq("session_id", session_id)\
                .execute()

            if not session_result.data:
                raise HTTPException(status_code=404, detail="Session not found")

            session = session_result.data[0]

            # Get request history for this session
            requests_result = db_client.table("archon_mcp_requests")\
                .select("*")\
                .eq("session_id", session_id)\
                .order("timestamp", desc=True)\
                .limit(100)\
                .execute()

            requests = requests_result.data

            # Calculate usage summary
            total_requests = len(requests)
            total_prompt_tokens = sum(r.get("prompt_tokens", 0) for r in requests)
            total_completion_tokens = sum(r.get("completion_tokens", 0) for r in requests)
            total_cost = sum(float(r.get("estimated_cost", 0)) for r in requests)

            return {
                "session": session,
                "requests": requests,
                "summary": {
                    "total_requests": total_requests,
                    "total_prompt_tokens": total_prompt_tokens,
                    "total_completion_tokens": total_completion_tokens,
                    "total_tokens": total_prompt_tokens + total_completion_tokens,
                    "total_cost": round(total_cost, 6),
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            api_logger.error(f"Failed to get session details - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/usage/summary")
async def get_usage_summary(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    days: Optional[int] = Query(30, description="Number of days to look back (default: 30)")
):
    """
    Get aggregated MCP usage statistics.

    Returns total tokens, cost, request counts, and breakdowns by tool.
    """
    with safe_span("api_mcp_usage_summary") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/usage/summary")

        try:
            db_client = get_supabase_client()

            # Calculate date range
            if start_date and end_date:
                start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            else:
                end_dt = datetime.now()
                start_dt = end_dt - timedelta(days=days)

            # Get all requests in date range
            requests_result = db_client.table("archon_mcp_requests")\
                .select("*")\
                .gte("timestamp", start_dt.isoformat())\
                .lte("timestamp", end_dt.isoformat())\
                .eq("status", "success")\
                .execute()

            requests = requests_result.data

            # Calculate aggregates
            total_requests = len(requests)
            total_prompt_tokens = sum(r.get("prompt_tokens", 0) for r in requests)
            total_completion_tokens = sum(r.get("completion_tokens", 0) for r in requests)
            total_cost = sum(float(r.get("estimated_cost", 0)) for r in requests)

            # Get unique sessions
            unique_sessions = len(set(r["session_id"] for r in requests))

            # Group by tool
            tool_usage = {}
            for req in requests:
                tool = req.get("tool_name") or req.get("method", "unknown")
                if tool not in tool_usage:
                    tool_usage[tool] = {
                        "count": 0,
                        "tokens": 0,
                        "cost": 0.0
                    }
                tool_usage[tool]["count"] += 1
                tool_usage[tool]["tokens"] += req.get("total_tokens", 0)
                tool_usage[tool]["cost"] += float(req.get("estimated_cost", 0))

            # Sort by count descending
            tool_usage_sorted = dict(sorted(
                tool_usage.items(),
                key=lambda x: x[1]["count"],
                reverse=True
            ))

            return {
                "period": {
                    "start": start_dt.isoformat(),
                    "end": end_dt.isoformat(),
                    "days": days
                },
                "summary": {
                    "total_requests": total_requests,
                    "total_prompt_tokens": total_prompt_tokens,
                    "total_completion_tokens": total_completion_tokens,
                    "total_tokens": total_prompt_tokens + total_completion_tokens,
                    "total_cost": round(total_cost, 6),
                    "unique_sessions": unique_sessions
                },
                "by_tool": tool_usage_sorted
            }

        except Exception as e:
            api_logger.error(f"Failed to get usage summary - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/pricing")
async def get_llm_pricing(
    provider: Optional[str] = Query(None, description="Filter by provider (OpenAI, Anthropic)"),
    model: Optional[str] = Query(None, description="Filter by model name")
):
    """
    Get current LLM pricing data.

    Returns pricing per 1K tokens for input and output.
    """
    with safe_span("api_mcp_pricing") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/pricing")

        try:
            db_client = get_supabase_client()

            # Build query
            query = db_client.table("archon_llm_pricing")\
                .select("*")\
                .order("provider")\
                .order("model_name")

            # Apply filters
            if provider:
                query = query.eq("provider", provider)
            if model:
                query = query.ilike("model_name", f"%{model}%")

            result = query.execute()

            return {
                "pricing": result.data,
                "total": len(result.data),
                "note": "Prices are per 1,000 tokens in USD"
            }

        except Exception as e:
            api_logger.error(f"Failed to get pricing data - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/errors")
async def get_mcp_errors(
    severity: str = Query("all", description="Filter by severity: error | timeout | all"),
    limit: int = Query(50, le=200, description="Maximum number of errors to return"),
    session_id: Optional[str] = Query(None, description="Filter by session ID")
):
    """
    Get recent MCP errors and timeouts with summary statistics.

    Returns error logs with session context and tool names for debugging.
    Supports filtering by severity and session.
    """
    with safe_span("api_mcp_errors") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/errors")
        safe_set_attribute(span, "severity_filter", severity)
        safe_set_attribute(span, "limit", limit)

        try:
            db_client = get_supabase_client()

            # Build base query for errors
            query = db_client.table("archon_mcp_requests")\
                .select("*")\
                .order("timestamp", desc=True)\
                .limit(limit)

            # Apply severity filter
            if severity == "error":
                query = query.eq("status", "error")
            elif severity == "timeout":
                query = query.eq("status", "timeout")
            elif severity == "all":
                query = query.in_("status", ["error", "timeout"])
            else:
                # Invalid severity, default to all
                query = query.in_("status", ["error", "timeout"])

            # Apply session filter if provided
            if session_id:
                query = query.eq("session_id", session_id)
                safe_set_attribute(span, "session_id", session_id)

            result = query.execute()
            errors = result.data

            # Calculate error summary statistics
            error_count = len([e for e in errors if e.get("status") == "error"])
            timeout_count = len([e for e in errors if e.get("status") == "timeout"])
            last_error = errors[0] if errors else None

            # Calculate error rate (need total requests for context)
            # Get total requests in same time period as oldest error
            error_rate_percent = 0.0
            if errors and len(errors) > 0:
                oldest_error_time = errors[-1].get("timestamp")

                # Count total requests since oldest error
                total_result = db_client.table("archon_mcp_requests")\
                    .select("request_id", count="exact")\
                    .gte("timestamp", oldest_error_time)\
                    .execute()

                total_requests = total_result.count if hasattr(total_result, 'count') else 0
                if total_requests > 0:
                    error_rate_percent = round((len(errors) / total_requests) * 100, 2)

            summary = {
                "error_count": error_count,
                "timeout_count": timeout_count,
                "last_error_at": last_error.get("timestamp") if last_error else None,
                "error_rate_percent": error_rate_percent
            }

            api_logger.debug(f"Retrieved {len(errors)} MCP errors - severity={severity}")
            safe_set_attribute(span, "error_count", len(errors))
            safe_set_attribute(span, "error_rate", error_rate_percent)

            return {
                "errors": errors,
                "summary": summary,
                "total": len(errors)
            }

        except Exception as e:
            api_logger.error(f"Failed to get MCP errors - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/analytics")
async def get_mcp_analytics(
    days: int = Query(30, ge=1, le=90, description="Number of days to analyze"),
    compare: bool = Query(True, description="Include comparison with previous period")
):
    """
    Get comprehensive MCP analytics including:
    - Time-series tool usage trends
    - Success/failure ratios
    - Average response times by tool
    - Peak usage times by hour
    - Period comparison (current vs previous)
    """
    with safe_span("api_mcp_analytics") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/analytics")
        safe_set_attribute(span, "days", days)
        safe_set_attribute(span, "compare", compare)

        try:
            db_client = get_supabase_client()

            # Calculate time ranges
            current_end = datetime.utcnow()
            current_start = current_end - timedelta(days=days)
            previous_end = current_start
            previous_start = previous_end - timedelta(days=days)

            # Query current period requests
            current_query = db_client.table("archon_mcp_requests")\
                .select("*")\
                .gte("timestamp", current_start.isoformat())\
                .lte("timestamp", current_end.isoformat())\
                .order("timestamp", desc=False)

            current_result = current_query.execute()
            current_requests = current_result.data

            # Query previous period requests (for comparison)
            previous_requests = []
            if compare:
                previous_query = db_client.table("archon_mcp_requests")\
                    .select("*")\
                    .gte("timestamp", previous_start.isoformat())\
                    .lte("timestamp", previous_end.isoformat())\
                    .order("timestamp", desc=False)

                previous_result = previous_query.execute()
                previous_requests = previous_result.data

            # Calculate analytics
            analytics = _calculate_analytics(current_requests, previous_requests if compare else None, days)

            safe_set_attribute(span, "total_requests", len(current_requests))
            safe_set_attribute(span, "previous_requests", len(previous_requests))

            return analytics

        except Exception as e:
            api_logger.error(f"Failed to get MCP analytics - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


def _calculate_analytics(current_requests: list, previous_requests: Optional[list], days: int) -> dict:
    """Calculate comprehensive analytics from request data."""
    from collections import defaultdict

    # Initialize analytics structure
    analytics = {
        "period": {
            "days": days,
            "start": (datetime.utcnow() - timedelta(days=days)).isoformat(),
            "end": datetime.utcnow().isoformat()
        },
        "trends": {
            "daily": [],  # [{date, requests, tokens, cost, success_rate}]
            "hourly": []  # [{hour, requests, avg_duration}] for peak times
        },
        "ratios": {
            "success": 0,
            "error": 0,
            "timeout": 0,
            "success_rate": 0.0
        },
        "response_times": {
            "by_tool": [],  # [{tool, avg_ms, min_ms, max_ms, count}]
            "overall_avg": 0.0,
            "p50": 0.0,
            "p95": 0.0,
            "p99": 0.0
        },
        "comparison": None  # {requests: {current, previous, change_percent}, ...}
    }

    if not current_requests:
        return analytics

    # Calculate daily trends
    daily_data = defaultdict(lambda: {"requests": 0, "tokens": 0, "cost": 0.0, "successes": 0})
    for req in current_requests:
        date = req["timestamp"][:10]  # YYYY-MM-DD
        daily_data[date]["requests"] += 1
        daily_data[date]["tokens"] += req.get("total_tokens", 0)
        daily_data[date]["cost"] += req.get("estimated_cost", 0.0)
        if req.get("status") == "success":
            daily_data[date]["successes"] += 1

    analytics["trends"]["daily"] = [
        {
            "date": date,
            "requests": data["requests"],
            "tokens": data["tokens"],
            "cost": round(data["cost"], 6),
            "success_rate": round((data["successes"] / data["requests"]) * 100, 1) if data["requests"] > 0 else 0.0
        }
        for date, data in sorted(daily_data.items())
    ]

    # Calculate hourly patterns (peak usage times)
    hourly_data = defaultdict(lambda: {"requests": 0, "total_duration": 0.0, "count_with_duration": 0})
    for req in current_requests:
        try:
            hour = datetime.fromisoformat(req["timestamp"].replace("Z", "+00:00")).hour
            hourly_data[hour]["requests"] += 1
            if req.get("duration_ms") is not None:
                hourly_data[hour]["total_duration"] += req["duration_ms"]
                hourly_data[hour]["count_with_duration"] += 1
        except Exception:
            continue

    analytics["trends"]["hourly"] = [
        {
            "hour": hour,
            "requests": data["requests"],
            "avg_duration": round(data["total_duration"] / data["count_with_duration"], 2) if data["count_with_duration"] > 0 else 0.0
        }
        for hour, data in sorted(hourly_data.items())
    ]

    # Calculate success/failure ratios
    status_counts = defaultdict(int)
    for req in current_requests:
        status_counts[req.get("status", "unknown")] += 1

    total_requests = len(current_requests)
    analytics["ratios"] = {
        "success": status_counts["success"],
        "error": status_counts["error"],
        "timeout": status_counts["timeout"],
        "success_rate": round((status_counts["success"] / total_requests) * 100, 1) if total_requests > 0 else 0.0
    }

    # Calculate response times by tool
    tool_times = defaultdict(list)
    all_durations = []
    for req in current_requests:
        if req.get("duration_ms") is not None and req.get("tool_name"):
            tool_times[req["tool_name"]].append(req["duration_ms"])
            all_durations.append(req["duration_ms"])

    analytics["response_times"]["by_tool"] = [
        {
            "tool": tool,
            "avg_ms": round(sum(durations) / len(durations), 2),
            "min_ms": min(durations),
            "max_ms": max(durations),
            "count": len(durations)
        }
        for tool, durations in sorted(tool_times.items(), key=lambda x: sum(x[1]) / len(x[1]))
    ]

    # Calculate overall percentiles
    if all_durations:
        all_durations.sort()
        n = len(all_durations)
        analytics["response_times"]["overall_avg"] = round(sum(all_durations) / n, 2)
        analytics["response_times"]["p50"] = all_durations[int(n * 0.50)]
        analytics["response_times"]["p95"] = all_durations[int(n * 0.95)] if n > 1 else all_durations[0]
        analytics["response_times"]["p99"] = all_durations[int(n * 0.99)] if n > 1 else all_durations[0]

    # Calculate comparison with previous period
    if previous_requests is not None:
        prev_status_counts = defaultdict(int)
        prev_total_tokens = 0
        prev_total_cost = 0.0

        for req in previous_requests:
            prev_status_counts[req.get("status", "unknown")] += 1
            prev_total_tokens += req.get("total_tokens", 0)
            prev_total_cost += req.get("estimated_cost", 0.0)

        curr_total_tokens = sum(req.get("total_tokens", 0) for req in current_requests)
        curr_total_cost = sum(req.get("estimated_cost", 0.0) for req in current_requests)

        def calc_change(current, previous):
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return round(((current - previous) / previous) * 100, 1)

        analytics["comparison"] = {
            "requests": {
                "current": total_requests,
                "previous": len(previous_requests),
                "change_percent": calc_change(total_requests, len(previous_requests))
            },
            "success_rate": {
                "current": analytics["ratios"]["success_rate"],
                "previous": round((prev_status_counts["success"] / len(previous_requests)) * 100, 1) if len(previous_requests) > 0 else 0.0,
                "change_percent": calc_change(
                    analytics["ratios"]["success_rate"],
                    (prev_status_counts["success"] / len(previous_requests)) * 100 if len(previous_requests) > 0 else 0
                )
            },
            "tokens": {
                "current": curr_total_tokens,
                "previous": prev_total_tokens,
                "change_percent": calc_change(curr_total_tokens, prev_total_tokens)
            },
            "cost": {
                "current": round(curr_total_cost, 6),
                "previous": round(prev_total_cost, 6),
                "change_percent": calc_change(curr_total_cost, prev_total_cost)
            }
        }

    return analytics


@router.get("/logs")
async def get_mcp_logs(
    level: Optional[str] = Query(None, description="Filter by log level: info | warning | error | all"),
    search: Optional[str] = Query(None, description="Search in tool name or error message"),
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    limit: int = Query(100, le=1000, description="Maximum number of logs to return"),
    offset: int = Query(0, ge=0, description="Number of logs to skip")
):
    """
    Get MCP request logs with filtering and search.

    Log levels are mapped from request status:
    - info: successful requests (status = success)
    - warning: timeout requests (status = timeout)
    - error: failed requests (status = error)
    """
    with safe_span("api_mcp_logs") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/logs")
        safe_set_attribute(span, "level", level or "all")
        safe_set_attribute(span, "search", search or "")
        safe_set_attribute(span, "limit", limit)
        safe_set_attribute(span, "offset", offset)

        try:
            db_client = get_supabase_client()

            # Build query
            query = db_client.table("archon_mcp_requests")\
                .select("*")\
                .order("timestamp", desc=True)

            # Apply level filter (map to status)
            if level and level != "all":
                if level == "info":
                    query = query.eq("status", "success")
                elif level == "warning":
                    query = query.eq("status", "timeout")
                elif level == "error":
                    query = query.eq("status", "error")

            # Apply session filter
            if session_id:
                query = query.eq("session_id", session_id)

            # Apply search filter (tool name or error message)
            if search:
                # Supabase doesn't support OR in a single query easily,
                # so we'll fetch and filter in Python
                pass  # Will filter after fetch

            # Get total count before pagination
            count_query = db_client.table("archon_mcp_requests").select("*", count="exact")
            if level and level != "all":
                if level == "info":
                    count_query = count_query.eq("status", "success")
                elif level == "warning":
                    count_query = count_query.eq("status", "timeout")
                elif level == "error":
                    count_query = count_query.eq("status", "error")
            if session_id:
                count_query = count_query.eq("session_id", session_id)

            count_result = count_query.execute()
            total_count = count_result.count if hasattr(count_result, 'count') else len(count_result.data)

            # Apply pagination
            query = query.range(offset, offset + limit - 1)

            # Execute query
            result = query.execute()
            logs = result.data

            # Apply search filter in Python if needed
            if search:
                search_lower = search.lower()
                logs = [
                    log for log in logs
                    if (log.get("tool_name") and search_lower in log["tool_name"].lower()) or
                       (log.get("error_message") and search_lower in log["error_message"].lower())
                ]

            # Map status to log level for each log
            for log in logs:
                status = log.get("status", "unknown")
                if status == "success":
                    log["level"] = "info"
                elif status == "timeout":
                    log["level"] = "warning"
                elif status == "error":
                    log["level"] = "error"
                else:
                    log["level"] = "debug"

            safe_set_attribute(span, "total_logs", len(logs))
            safe_set_attribute(span, "total_count", total_count)

            return {
                "logs": logs,
                "pagination": {
                    "total": total_count,
                    "limit": limit,
                    "offset": offset,
                    "has_more": (offset + len(logs)) < total_count
                }
            }

        except Exception as e:
            api_logger.error(f"Failed to get MCP logs - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/health")
async def mcp_health():
    """Health check for MCP API - used by bug report service and tests."""
    with safe_span("api_mcp_health") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/health")
        safe_set_attribute(span, "method", "GET")

        # Simple health check - no logging to reduce noise
        result = {"status": "healthy", "service": "mcp"}
        safe_set_attribute(span, "status", "healthy")

        return result
