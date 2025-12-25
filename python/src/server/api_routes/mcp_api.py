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
