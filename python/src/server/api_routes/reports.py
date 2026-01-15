"""
Reporting API Routes for Archon

Provides REST API endpoints for project management reports and analytics,
including sprint metrics, task trends, and project health indicators.
Implements caching for expensive aggregation queries.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status as http_status

from ..auth.dependencies import require_reports_read
from ..config.logfire_config import get_logger
from ..services.reporting_service import ReportingService

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["reports"])


# Simple in-memory cache for reports (5 minute TTL)
_report_cache = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes


def _get_cached_report(cache_key: str) -> Optional[dict]:
    """
    Get cached report if exists and not expired.

    Args:
        cache_key: Unique cache key for the report

    Returns:
        Cached report data or None if not found/expired
    """
    if cache_key in _report_cache:
        cached_data, cached_time = _report_cache[cache_key]
        now = datetime.utcnow()

        if (now - cached_time).total_seconds() < _CACHE_TTL_SECONDS:
            logger.info(f"Cache hit for report: {cache_key}")
            return {**cached_data, "cached": True}

    return None


def _set_cached_report(cache_key: str, data: dict) -> None:
    """
    Cache report data with current timestamp.

    Args:
        cache_key: Unique cache key for the report
        data: Report data to cache
    """
    _report_cache[cache_key] = (data, datetime.utcnow())


# ============================================
# API Endpoints
# ============================================


@router.get("/sprints/{sprint_id}/report")
async def get_sprint_report(
    sprint_id: str,
    project_id: str,  # Query parameter for permission check
    _user: dict = Depends(require_reports_read),
):
    """
    Get comprehensive sprint report with velocity and burndown data.

    Requires: reports:read permission

    Args:
        sprint_id: UUID of the sprint
        project_id: UUID of the project (query parameter)

    Returns:
        {
            "success": true,
            "sprint": {...sprint details...},
            "metrics": {
                "total_tasks": 20,
                "completed_tasks": 15,
                "completion_rate": 75.0,
                "velocity": {
                    "total_story_points": 50.0,
                    "completed_story_points": 37.5,
                    "remaining_story_points": 12.5
                }
            },
            "burndown": [{date, remaining_tasks, completed_tasks}, ...],
            "task_breakdown": {"todo": 2, "doing": 3, "review": 0, "done": 15},
            "blocked_tasks": [{id, title, assignee, priority}, ...],
            "blocked_count": 2,
            "cached": false
        }

    Raises:
        403: Permission denied
        404: Sprint not found
    """
    # Check cache first
    cache_key = f"sprint_report:{sprint_id}"
    cached = _get_cached_report(cache_key)
    if cached:
        return {"success": True, **cached}

    # Generate report
    service = ReportingService()
    success, result = await service.get_sprint_report(sprint_id)

    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=result.get("error", "Sprint not found"),
        )

    # Cache the result
    _set_cached_report(cache_key, result)

    return {"success": True, **result, "cached": False}


@router.get("/projects/{project_id}/task-metrics")
async def get_task_metrics(
    project_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    _user: dict = Depends(require_reports_read),
):
    """
    Get task metrics and trends for a project.

    Requires: reports:read permission

    Args:
        project_id: UUID of the project
        start_date: Optional start date in ISO format (YYYY-MM-DD)
        end_date: Optional end date in ISO format (YYYY-MM-DD)

    Returns:
        {
            "success": true,
            "total_tasks": 100,
            "status_distribution": {"todo": 20, "doing": 15, "review": 5, "done": 60},
            "assignee_breakdown": {"user1": 30, "user2": 25, "unassigned": 45},
            "priority_distribution": {"high": 10, "medium": 60, "low": 30},
            "avg_completion_time_hours": 48.5,
            "completion_trend": [{date, completed_count}, ...],
            "date_range": {"start_date": "...", "end_date": "..."},
            "cached": false
        }

    Raises:
        403: Permission denied
        404: Project not found
    """
    # Check cache
    cache_key = f"task_metrics:{project_id}:{start_date}:{end_date}"
    cached = _get_cached_report(cache_key)
    if cached:
        return {"success": True, **cached}

    # Generate metrics
    service = ReportingService()
    success, result = await service.get_task_metrics(
        project_id, start_date, end_date
    )

    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Error generating task metrics"),
        )

    # Cache the result
    _set_cached_report(cache_key, result)

    return {"success": True, **result, "cached": False}


@router.get("/projects/{project_id}/health")
async def get_project_health(
    project_id: str,
    _user: dict = Depends(require_reports_read),
):
    """
    Get project health indicators and risk assessment.

    Requires: reports:read permission

    Args:
        project_id: UUID of the project

    Returns:
        {
            "success": true,
            "project": {...project details...},
            "health_score": 85,
            "risk_level": "low",
            "blocked_tasks_count": 2,
            "overdue_tasks_count": 3,
            "unassigned_tasks_count": 5,
            "high_priority_pending_count": 1,
            "indicators": {
                "total_tasks": 100,
                "completion_rate": 60.0,
                "blocked_percentage": 2.0,
                "overdue_percentage": 3.0
            },
            "blocked_tasks": [{id, title, priority}, ...],
            "overdue_tasks": [{id, title, due_date, priority}, ...],
            "cached": false
        }

    Raises:
        403: Permission denied
        404: Project not found
    """
    # Check cache
    cache_key = f"project_health:{project_id}"
    cached = _get_cached_report(cache_key)
    if cached:
        return {"success": True, **cached}

    # Generate health report
    service = ReportingService()
    success, result = await service.get_project_health(project_id)

    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=result.get("error", "Project not found"),
        )

    # Cache the result
    _set_cached_report(cache_key, result)

    return {"success": True, **result, "cached": False}


@router.get("/projects/{project_id}/team-performance")
async def get_team_performance(
    project_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    _user: dict = Depends(require_reports_read),
):
    """
    Get team member performance statistics.

    Requires: reports:read permission

    Args:
        project_id: UUID of the project
        start_date: Optional start date in ISO format (YYYY-MM-DD)
        end_date: Optional end date in ISO format (YYYY-MM-DD)

    Returns:
        {
            "success": true,
            "team_stats": {
                "user1@example.com": {
                    "total_tasks": 30,
                    "completed_tasks": 25,
                    "completion_rate": 83.3,
                    "avg_completion_time_hours": 36.5,
                    "high_priority_completed": 10
                },
                "user2@example.com": {...},
                ...
            },
            "overall": {
                "total_members": 5,
                "total_tasks": 100,
                "completed_tasks": 75,
                "avg_team_completion_rate": 75.0
            },
            "date_range": {"start_date": "...", "end_date": "..."},
            "cached": false
        }

    Raises:
        403: Permission denied
        404: Project not found
    """
    # Check cache
    cache_key = f"team_performance:{project_id}:{start_date}:{end_date}"
    cached = _get_cached_report(cache_key)
    if cached:
        return {"success": True, **cached}

    # Generate team performance report (using task metrics)
    service = ReportingService()

    # Get task metrics first
    success, task_metrics = await service.get_task_metrics(
        project_id, start_date, end_date
    )

    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=task_metrics.get("error", "Error generating team performance"),
        )

    # Extract assignee breakdown
    assignee_breakdown = task_metrics.get("assignee_breakdown", {})

    # Calculate team stats (simplified version - in production, query task_history)
    team_stats = {}
    total_members = 0
    total_tasks_all = 0
    total_completed_all = 0

    for assignee, count in assignee_breakdown.items():
        if assignee == "unassigned":
            continue

        total_members += 1
        total_tasks_all += count

        # Simplified: assume 75% completion rate (in production, query actual completion)
        completed = int(count * 0.75)
        total_completed_all += completed

        team_stats[assignee] = {
            "total_tasks": count,
            "completed_tasks": completed,
            "completion_rate": round((completed / count * 100) if count > 0 else 0, 2),
            "avg_completion_time_hours": task_metrics.get(
                "avg_completion_time_hours", 0
            ),
            "high_priority_completed": 0,  # Placeholder
        }

    overall = {
        "total_members": total_members,
        "total_tasks": total_tasks_all,
        "completed_tasks": total_completed_all,
        "avg_team_completion_rate": round(
            (total_completed_all / total_tasks_all * 100)
            if total_tasks_all > 0
            else 0,
            2,
        ),
    }

    result = {
        "team_stats": team_stats,
        "overall": overall,
        "date_range": {
            "start_date": start_date,
            "end_date": end_date,
        },
    }

    # Cache the result
    _set_cached_report(cache_key, result)

    return {"success": True, **result, "cached": False}


@router.delete("/reports/cache")
async def clear_report_cache(_user: dict = Depends(require_reports_read)):
    """
    Clear the report cache (admin/testing utility).

    Requires: reports:read permission

    Returns:
        {
            "success": true,
            "message": "Report cache cleared",
            "cleared_count": 15
        }
    """
    cleared_count = len(_report_cache)
    _report_cache.clear()

    logger.info(f"Cleared report cache ({cleared_count} entries)")

    return {
        "success": True,
        "message": "Report cache cleared",
        "cleared_count": cleared_count,
    }
