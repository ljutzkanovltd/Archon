"""
Projects API endpoints for Archon

Handles:
- Project management (CRUD operations)
- Task management with hierarchical structure
- Streaming project creation with DocumentAgent integration
- HTTP polling for progress updates
"""

import json
from datetime import datetime, timezone
from email.utils import format_datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi import status as http_status
from pydantic import BaseModel

# Removed direct logging import - using unified config
# Set up standard logger for background tasks
from ..config.logfire_config import get_logger, logfire
from ..utils import get_supabase_client
from ..utils.etag_utils import check_etag, generate_etag

logger = get_logger(__name__)

# Service imports
from ..services.projects import (
    ProjectCreationService,
    ProjectService,
    SourceLinkingService,
    TaskService,
)
from ..services.projects.document_service import DocumentService
from ..services.projects.versioning_service import VersioningService

# Using HTTP polling for real-time updates

router = APIRouter(prefix="/api", tags=["projects"])


class CreateProjectRequest(BaseModel):
    title: str
    description: str | None = None
    github_repo: str | None = None
    docs: list[Any] | None = None
    features: list[Any] | None = None
    data: list[Any] | None = None
    technical_sources: list[str] | None = None  # List of knowledge source IDs
    business_sources: list[str] | None = None  # List of knowledge source IDs
    pinned: bool | None = None  # Whether this project should be pinned to top


class UpdateProjectRequest(BaseModel):
    title: str | None = None
    description: str | None = None  # Add description field
    github_repo: str | None = None
    docs: list[Any] | None = None
    features: list[Any] | None = None
    data: list[Any] | None = None
    technical_sources: list[str] | None = None  # List of knowledge source IDs
    business_sources: list[str] | None = None  # List of knowledge source IDs
    pinned: bool | None = None  # Whether this project is pinned to top


class CreateTaskRequest(BaseModel):
    project_id: str
    title: str
    description: str | None = None
    status: str | None = "todo"
    assignee: str | None = "User"
    task_order: int | None = 0
    priority: str | None = "medium"
    feature: str | None = None


@router.get("/projects")
async def list_projects(
    response: Response,
    include_content: bool = True,
    if_none_match: str | None = Header(None)
):
    """
    List all projects.
    
    Args:
        include_content: If True (default), returns full project content.
                        If False, returns lightweight metadata with statistics.
    """
    try:
        logfire.debug(f"Listing all projects | include_content={include_content}")

        # Use ProjectService to get projects with include_content parameter
        project_service = ProjectService()
        success, result = project_service.list_projects(include_content=include_content)

        if not success:
            raise HTTPException(status_code=500, detail=result)

        # Only format with sources if we have full content
        if include_content:
            # Use SourceLinkingService to format projects with sources
            source_service = SourceLinkingService()
            formatted_projects = source_service.format_projects_with_sources(result["projects"])
        else:
            # Lightweight response doesn't need source formatting
            formatted_projects = result["projects"]

        # Monitor response size for optimization validation
        response_json = json.dumps(formatted_projects)
        response_size = len(response_json)

        # Log response metrics
        logfire.debug(
            f"Projects listed successfully | count={len(formatted_projects)} | "
            f"size_bytes={response_size} | include_content={include_content}"
        )

        # Log large responses at debug level (>100KB is worth noting, but normal for project data)
        if response_size > 100000:
            logfire.debug(
                f"Large response size | size_bytes={response_size} | "
                f"include_content={include_content} | project_count={len(formatted_projects)}"
            )

        # Generate ETag from stable data (excluding timestamp)
        etag_data = {
            "projects": formatted_projects,
            "count": len(formatted_projects)
        }
        current_etag = generate_etag(etag_data)

        # Generate response with timestamp for polling
        response_data = {
            "projects": formatted_projects,
            "timestamp": datetime.utcnow().isoformat(),
            "count": len(formatted_projects)
        }

        # Check if client's ETag matches
        if check_etag(if_none_match, current_etag):
            response.status_code = http_status.HTTP_304_NOT_MODIFIED
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            return None

        # Set headers
        response.headers["ETag"] = current_etag
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()
        response.headers["Cache-Control"] = "no-cache, must-revalidate"

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list projects | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects")
async def create_project(request: CreateProjectRequest):
    """Create a new project with streaming progress."""
    # Validate title
    if not request.title:
        raise HTTPException(status_code=422, detail="Title is required")

    if not request.title.strip():
        raise HTTPException(status_code=422, detail="Title cannot be empty")

    try:
        logfire.info(
            f"Creating new project | title={request.title} | github_repo={request.github_repo}"
        )

        # Prepare kwargs for additional project fields
        kwargs = {}
        if request.pinned is not None:
            kwargs["pinned"] = request.pinned
        if request.features:
            kwargs["features"] = request.features
        if request.data:
            kwargs["data"] = request.data

        # Create project directly with AI assistance
        project_service = ProjectCreationService()
        success, result = await project_service.create_project_with_ai(
            progress_id="direct",  # No progress tracking needed
            title=request.title,
            description=request.description,
            github_repo=request.github_repo,
            **kwargs,
        )

        if success:
            logfire.info(f"Project created successfully | project_id={result['project_id']}")
            return {
                "project_id": result["project_id"],
                "project": result.get("project"),
                "status": "completed",
                "message": f"Project '{request.title}' created successfully",
            }
        else:
            raise HTTPException(status_code=500, detail=result)

    except Exception as e:
        logfire.error(f"Failed to start project creation | error={str(e)} | title={request.title}")
        raise HTTPException(status_code=500, detail={"error": str(e)})




@router.get("/projects/health")
async def projects_health():
    """Health check for projects API and database schema validation."""
    try:
        logfire.info("Projects health check requested")
        supabase_client = get_supabase_client()

        # Check if projects table exists by testing ProjectService
        try:
            project_service = ProjectService(supabase_client)
            # Try to list projects with limit 1 to test table access
            success, _ = project_service.list_projects()
            projects_table_exists = success
            if success:
                logfire.info("Projects table detected successfully")
            else:
                logfire.warning("Projects table access failed")
        except Exception as e:
            projects_table_exists = False
            logfire.warning(f"Projects table not found | error={str(e)}")

        # Check if tasks table exists by testing TaskService
        try:
            task_service = TaskService(supabase_client)
            # Try to list tasks with limit 1 to test table access
            success, _ = task_service.list_tasks(include_closed=True)
            tasks_table_exists = success
            if success:
                logfire.info("Tasks table detected successfully")
            else:
                logfire.warning("Tasks table access failed")
        except Exception as e:
            tasks_table_exists = False
            logfire.warning(f"Tasks table not found | error={str(e)}")

        schema_valid = projects_table_exists and tasks_table_exists

        result = {
            "status": "healthy" if schema_valid else "schema_missing",
            "service": "projects",
            "schema": {
                "projects_table": projects_table_exists,
                "tasks_table": tasks_table_exists,
                "valid": schema_valid,
            },
        }

        logfire.info(
            f"Projects health check completed | status={result['status']} | schema_valid={schema_valid}"
        )

        return result

    except Exception as e:
        logfire.error(f"Projects health check failed | error={str(e)}")
        return {
            "status": "error",
            "service": "projects",
            "error": str(e),
            "schema": {"projects_table": False, "tasks_table": False, "valid": False},
        }


@router.get("/projects/task-counts")
async def get_all_task_counts(
    request: Request,
    response: Response,
):
    """
    Get task counts for all projects in a single batch query.
    Optimized endpoint to avoid N+1 query problem.
    
    Returns counts grouped by project_id with todo, doing, and done counts.
    Review status is included in doing count to match frontend logic.
    """
    try:
        # Get If-None-Match header for ETag comparison
        if_none_match = request.headers.get("If-None-Match")

        logfire.debug(f"Getting task counts for all projects | etag={if_none_match}")

        # Use TaskService to get batch task counts
        # Get client explicitly to ensure mocking works in tests
        supabase_client = get_supabase_client()
        task_service = TaskService(supabase_client)
        success, result = task_service.get_all_project_task_counts()

        if not success:
            logfire.error(f"Failed to get task counts | error={result.get('error')}")
            raise HTTPException(status_code=500, detail=result)

        # Generate ETag from counts data
        etag_data = {
            "counts": result,
            "count": len(result)
        }
        current_etag = generate_etag(etag_data)

        # Check if client's ETag matches (304 Not Modified)
        if check_etag(if_none_match, current_etag):
            response.status_code = 304
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            logfire.debug(f"Task counts unchanged, returning 304 | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["Last-Modified"] = datetime.utcnow().isoformat()

        logfire.debug(
            f"Task counts retrieved | project_count={len(result)} | etag={current_etag}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get task counts | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Get a specific project."""
    try:
        logfire.info(f"Getting project | project_id={project_id}")

        # Use ProjectService to get the project
        project_service = ProjectService()
        success, result = project_service.get_project(project_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                logfire.warning(f"Project not found | project_id={project_id}")
                raise HTTPException(status_code=404, detail=result)
            else:
                raise HTTPException(status_code=500, detail=result)

        project = result["project"]

        logfire.info(
            f"Project retrieved successfully | project_id={project_id} | title={project['title']}"
        )

        # The ProjectService already includes sources, so just add any missing fields
        return {
            **project,
            "description": project.get("description", ""),
            "docs": project.get("docs", []),
            "features": project.get("features", []),
            "data": project.get("data", []),
            "pinned": project.get("pinned", False),
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get project | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/projects/{project_id}")
async def update_project(project_id: str, request: UpdateProjectRequest):
    """Update a project with comprehensive Logfire monitoring."""
    try:
        supabase_client = get_supabase_client()

        # Build update fields from request
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.description is not None:
            update_fields["description"] = request.description
        if request.github_repo is not None:
            update_fields["github_repo"] = request.github_repo
        if request.docs is not None:
            update_fields["docs"] = request.docs
        if request.features is not None:
            update_fields["features"] = request.features
        if request.data is not None:
            update_fields["data"] = request.data
        if request.pinned is not None:
            update_fields["pinned"] = request.pinned

        # Create version snapshots for JSONB fields before updating
        if update_fields:
            try:
                from ..services.projects.versioning_service import VersioningService

                versioning_service = VersioningService(supabase_client)

                # Get current project for comparison
                project_service = ProjectService(supabase_client)
                success, current_result = project_service.get_project(project_id)

                if success and current_result.get("project"):
                    current_project = current_result["project"]
                    version_count = 0

                    # Create versions for updated JSONB fields
                    for field_name in ["docs", "features", "data"]:
                        if field_name in update_fields:
                            current_content = current_project.get(field_name, {})
                            new_content = update_fields[field_name]

                            # Only create version if content actually changed
                            if current_content != new_content:
                                v_success, _ = versioning_service.create_version(
                                    project_id=project_id,
                                    field_name=field_name,
                                    content=current_content,
                                    change_summary=f"Updated {field_name} via API",
                                    change_type="update",
                                    created_by="api_user",
                                )
                                if v_success:
                                    version_count += 1

                    logfire.info(f"Created {version_count} version snapshots before update")
            except ImportError:
                logfire.warning("VersioningService not available - skipping version snapshots")
            except Exception as e:
                logfire.warning(f"Failed to create version snapshots: {e}")
                # Don't fail the update, just log the warning

        # Use ProjectService to update the project
        project_service = ProjectService(supabase_client)
        success, result = project_service.update_project(project_id, update_fields)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(
                    status_code=404, detail={"error": f"Project with ID {project_id} not found"}
                )
            else:
                raise HTTPException(status_code=500, detail=result)

        project = result["project"]

        # Handle source updates using SourceLinkingService
        source_service = SourceLinkingService(supabase_client)

        if request.technical_sources is not None or request.business_sources is not None:
            source_success, source_result = source_service.update_project_sources(
                project_id=project_id,
                technical_sources=request.technical_sources,
                business_sources=request.business_sources,
            )

            if source_success:
                logfire.info(
                    f"Project sources updated | project_id={project_id} | technical_success={source_result.get('technical_success', 0)} | technical_failed={source_result.get('technical_failed', 0)} | business_success={source_result.get('business_success', 0)} | business_failed={source_result.get('business_failed', 0)}"
                )
            else:
                logfire.warning(f"Failed to update some sources: {source_result}")

        # Format project response with sources using SourceLinkingService
        formatted_project = source_service.format_project_with_sources(project)

        logfire.info(
            f"Project updated successfully | project_id={project_id} | title={project.get('title')} | technical_sources={len(formatted_project.get('technical_sources', []))} | business_sources={len(formatted_project.get('business_sources', []))}"
        )

        return formatted_project

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Project update failed | project_id={project_id} | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project and all its tasks."""
    try:
        logfire.info(f"Deleting project | project_id={project_id}")

        # Use ProjectService to delete the project
        project_service = ProjectService()
        success, result = project_service.delete_project(project_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result)
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Project deleted successfully | project_id={project_id} | deleted_tasks={result.get('deleted_tasks', 0)}"
        )

        return {
            "message": "Project deleted successfully",
            "deleted_tasks": result.get("deleted_tasks", 0),
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to delete project | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}/features")
async def get_project_features(project_id: str):
    """Get features from a project's features JSONB field."""
    try:
        logfire.info(f"Getting project features | project_id={project_id}")

        # Use ProjectService to get features
        project_service = ProjectService()
        success, result = project_service.get_project_features(project_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                logfire.warning(f"Project not found for features | project_id={project_id}")
                raise HTTPException(status_code=404, detail=result)
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Project features retrieved | project_id={project_id} | feature_count={result.get('count', 0)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get project features | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}/tasks")
async def list_project_tasks(
    project_id: str,
    request: Request,
    response: Response,
    include_archived: bool = False,
    exclude_large_fields: bool = False
):
    """List all tasks for a specific project with ETag support for efficient polling."""
    try:
        # Get If-None-Match header for ETag comparison
        if_none_match = request.headers.get("If-None-Match")

        logfire.debug(
            f"Listing project tasks | project_id={project_id} | include_archived={include_archived} | exclude_large_fields={exclude_large_fields} | etag={if_none_match}"
        )

        # Use TaskService to list tasks
        task_service = TaskService()
        success, result = task_service.list_tasks(
            project_id=project_id,
            include_closed=True,  # Get all tasks, including done
            exclude_large_fields=exclude_large_fields,
            include_archived=include_archived,  # Pass the flag down to service
        )

        if not success:
            raise HTTPException(status_code=500, detail=result)

        tasks = result.get("tasks", [])

        # Generate ETag from task data (includes description and updated_at to drive polling invalidation)
        etag_tasks: list[dict[str, object]] = []
        last_modified_dt: datetime | None = None

        for task in tasks:
            raw_updated = task.get("updated_at")
            parsed_updated: datetime | None = None
            if isinstance(raw_updated, datetime):
                parsed_updated = raw_updated
            elif isinstance(raw_updated, str):
                try:
                    parsed_updated = datetime.fromisoformat(raw_updated.replace("Z", "+00:00"))
                except ValueError:
                    parsed_updated = None

            if parsed_updated is not None:
                parsed_updated = parsed_updated.astimezone(timezone.utc)
                if last_modified_dt is None or parsed_updated > last_modified_dt:
                    last_modified_dt = parsed_updated

            etag_tasks.append(
                {
                    "id": task.get("id") or "",
                    "title": task.get("title") or "",
                    "status": task.get("status") or "",
                    "task_order": task.get("task_order") or 0,
                    "assignee": task.get("assignee") or "",
                    "priority": task.get("priority") or "",
                    "feature": task.get("feature") or "",
                    "description": task.get("description") or "",
                    "updated_at": (
                        parsed_updated.isoformat()
                        if parsed_updated is not None
                        else (str(raw_updated) if raw_updated else "")
                    ),
                }
            )

        etag_data = {"tasks": etag_tasks, "project_id": project_id, "count": len(tasks)}
        current_etag = generate_etag(etag_data)

        # Check if client's ETag matches (304 Not Modified)
        if check_etag(if_none_match, current_etag):
            response.status_code = 304
            response.headers["ETag"] = current_etag
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
            response.headers["Last-Modified"] = format_datetime(
                last_modified_dt or datetime.now(timezone.utc)
            )
            logfire.debug(f"Tasks unchanged, returning 304 | project_id={project_id} | etag={current_etag}")
            return None

        # Set ETag headers for successful response
        response.headers["ETag"] = current_etag
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["Last-Modified"] = format_datetime(
            last_modified_dt or datetime.now(timezone.utc)
        )

        logfire.debug(
            f"Project tasks retrieved | project_id={project_id} | task_count={len(tasks)} | etag={current_etag}"
        )

        return tasks

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list project tasks | project_id={project_id}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": str(e)})


# Remove the complex /tasks endpoint - it's not needed and breaks things


@router.post("/tasks")
async def create_task(request: CreateTaskRequest):
    """Create a new task with automatic reordering."""
    try:
        # Use TaskService to create the task
        task_service = TaskService()
        success, result = await task_service.create_task(
            project_id=request.project_id,
            title=request.title,
            description=request.description or "",
            assignee=request.assignee or "User",
            task_order=request.task_order or 0,
            priority=request.priority or "medium",
            feature=request.feature,
        )

        if not success:
            raise HTTPException(status_code=400, detail=result)

        created_task = result["task"]

        logfire.info(
            f"Task created successfully | task_id={created_task['id']} | project_id={request.project_id}"
        )

        return {"message": "Task created successfully", "task": created_task}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create task | error={str(e)} | project_id={request.project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/tasks")
async def list_tasks(
    status: str | None = None,
    project_id: str | None = None,
    assignee: str | None = None,
    include_closed: bool = True,
    page: int = 1,
    per_page: int = 10,
    exclude_large_fields: bool = False,
    q: str | None = None,  # Search query parameter
):
    """List tasks with optional filters including status, project, assignee, and keyword search."""
    try:
        logfire.info(
            f"Listing tasks | status={status} | project_id={project_id} | assignee={assignee} | include_closed={include_closed} | page={page} | per_page={per_page} | q={q}"
        )

        # Use TaskService to list tasks
        task_service = TaskService()
        success, result = task_service.list_tasks(
            project_id=project_id,
            status=status,
            assignee=assignee,
            include_closed=include_closed,
            exclude_large_fields=exclude_large_fields,
            search_query=q,  # Pass search query to service
        )

        if not success:
            raise HTTPException(status_code=500, detail=result)

        tasks = result.get("tasks", [])

        # If exclude_large_fields is True, remove large fields from tasks
        if exclude_large_fields:
            for task in tasks:
                # Remove potentially large fields
                task.pop("sources", None)
                task.pop("code_examples", None)
                task.pop("messages", None)

        # Apply pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_tasks = tasks[start_idx:end_idx]

        # Prepare response
        response = {
            "tasks": paginated_tasks,
            "pagination": {
                "total": len(tasks),
                "page": page,
                "per_page": per_page,
                "pages": (len(tasks) + per_page - 1) // per_page,
            },
        }

        # Monitor response size for optimization validation
        response_json = json.dumps(response)
        response_size = len(response_json)

        # Log response metrics
        logfire.info(
            f"Tasks listed successfully | count={len(paginated_tasks)} | "
            f"size_bytes={response_size} | exclude_large_fields={exclude_large_fields}"
        )

        # Warning for large responses (>10KB)
        if response_size > 10000:
            logfire.warning(
                f"Large task response size | size_bytes={response_size} | "
                f"exclude_large_fields={exclude_large_fields} | task_count={len(paginated_tasks)}"
            )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list tasks | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/tasks/completion-stats")
async def get_completion_stats(
    project_id: str | None = None,
    days: int = 7,
    limit: int = 50
):
    """
    Get task completion statistics and recently completed tasks.

    Provides project completion rate, average completion time, and list
    of recently completed tasks from the last N days.

    Args:
        project_id: Optional project UUID to filter by project
        days: Number of days to look back (default: 7)
        limit: Maximum number of recently completed tasks (default: 50)

    Returns:
        Object with stats (if project_id provided) and recently_completed array
    """
    try:
        logfire.debug(
            f"Getting completion stats | project_id={project_id} | days={days} | limit={limit}"
        )

        task_service = TaskService()
        success, result = task_service.get_completion_stats(project_id, days, limit)

        if not success:
            error_msg = result.get("error", "Failed to get completion stats")
            logfire.error(f"Completion stats retrieval failed | error={error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)

        logfire.info(
            f"Completion stats retrieved | completed_tasks_count={result.get('count', 0)} | days={days}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get completion stats | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/v1/active-users")
async def get_active_users():
    """
    Get list of active users based on task activity in the last 24 hours.

    Returns unique assignees who have tasks that were updated in the last 24 hours,
    along with their last activity timestamp.

    Returns:
        {
            "count": int,
            "users": [
                {
                    "name": str,
                    "last_activity": str (ISO datetime)
                }
            ]
        }
    """
    try:
        from datetime import timedelta

        logfire.debug("Getting active users from last 24 hours")

        # Calculate 24 hours ago
        twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)

        # Query tasks updated in last 24 hours
        supabase = get_supabase_client()
        response = (
            supabase.table("archon_tasks")
            .select("assignee, updated_at")
            .gte("updated_at", twenty_four_hours_ago.isoformat())
            .eq("archived", False)
            .execute()
        )

        if not response.data:
            logfire.info("No active users found in last 24 hours")
            return {"count": 0, "users": []}

        # Group by assignee and get latest activity
        users_dict = {}
        for task in response.data:
            assignee = task.get("assignee", "Unknown")
            updated_at = task.get("updated_at")

            if assignee not in users_dict or (updated_at and updated_at > users_dict[assignee]):
                users_dict[assignee] = updated_at

        # Format result
        users = [
            {"name": name, "last_activity": activity}
            for name, activity in users_dict.items()
        ]

        # Sort by last activity (most recent first)
        users.sort(key=lambda x: x["last_activity"], reverse=True)

        logfire.info(f"Active users retrieved | count={len(users)}")

        return {
            "count": len(users),
            "users": users
        }

    except Exception as e:
        logfire.error(f"Failed to get active users | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """Get a specific task by ID."""
    try:
        # Use TaskService to get the task
        task_service = TaskService()
        success, result = task_service.get_task(task_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        task = result["task"]

        logfire.info(
            f"Task retrieved successfully | task_id={task_id} | project_id={task.get('project_id')}"
        )

        return task

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get task | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


class UpdateTaskRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    assignee: str | None = None
    task_order: int | None = None
    priority: str | None = None
    feature: str | None = None


class CreateDocumentRequest(BaseModel):
    document_type: str
    title: str
    content: dict[str, Any] | None = None
    tags: list[str] | None = None
    author: str | None = None


class UpdateDocumentRequest(BaseModel):
    title: str | None = None
    content: dict[str, Any] | None = None
    tags: list[str] | None = None
    author: str | None = None


class CreateVersionRequest(BaseModel):
    field_name: str
    content: dict[str, Any]
    change_summary: str | None = None
    change_type: str | None = "update"
    document_id: str | None = None
    created_by: str | None = "system"


class RestoreVersionRequest(BaseModel):
    restored_by: str | None = "system"


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, request: UpdateTaskRequest):
    """Update a task."""
    try:
        # Build update fields dictionary
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.description is not None:
            update_fields["description"] = request.description
        if request.status is not None:
            update_fields["status"] = request.status
        if request.assignee is not None:
            update_fields["assignee"] = request.assignee
        if request.task_order is not None:
            update_fields["task_order"] = request.task_order
        if request.priority is not None:
            update_fields["priority"] = request.priority
        if request.feature is not None:
            update_fields["feature"] = request.feature

        # Use TaskService to update the task
        task_service = TaskService()
        success, result = await task_service.update_task(task_id, update_fields)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        updated_task = result["task"]

        logfire.info(
            f"Task updated successfully | task_id={task_id} | project_id={updated_task.get('project_id')} | updated_fields={list(update_fields.keys())}"
        )

        return {"message": "Task updated successfully", "task": updated_task}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to update task | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """Archive a task (soft delete)."""
    try:
        # Use TaskService to archive the task
        task_service = TaskService()
        success, result = await task_service.archive_task(task_id, archived_by="api")

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            elif "already archived" in result.get("error", "").lower():
                raise HTTPException(status_code=409, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Task archived successfully | task_id={task_id}")

        return {"message": result.get("message", "Task archived successfully")}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to archive task | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# MCP endpoints for task operations


@router.put("/mcp/tasks/{task_id}/status")
async def mcp_update_task_status(task_id: str, status: str):
    """Update task status via MCP tools."""
    try:
        logfire.info(f"MCP task status update | task_id={task_id} | status={status}")

        # Use TaskService to update the task
        task_service = TaskService()
        success, result = await task_service.update_task(
            task_id=task_id, update_fields={"status": status}
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
            else:
                raise HTTPException(status_code=500, detail=result)

        updated_task = result["task"]
        project_id = updated_task["project_id"]

        logfire.info(
            f"Task status updated | task_id={task_id} | project_id={project_id} | status={status}"
        )

        return {"message": "Task status updated successfully", "task": updated_task}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to update task status | error={str(e)} | task_id={task_id}"
        )
        raise HTTPException(status_code=500, detail=str(e))


# Progress tracking via HTTP polling - see /api/progress endpoints

# ==================== DOCUMENT MANAGEMENT ENDPOINTS ====================


@router.get("/projects/{project_id}/docs")
async def list_project_documents(project_id: str, include_content: bool = False):
    """
    List all documents for a specific project.
    
    Args:
        project_id: Project UUID
        include_content: If True, includes full document content.
                        If False (default), returns metadata only.
    """
    try:
        logfire.info(
            f"Listing documents for project | project_id={project_id} | include_content={include_content}"
        )

        # Use DocumentService to list documents
        document_service = DocumentService()
        success, result = document_service.list_documents(project_id, include_content=include_content)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Documents listed successfully | project_id={project_id} | count={result.get('total_count', 0)} | lightweight={not include_content}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list documents | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/docs")
async def create_project_document(project_id: str, request: CreateDocumentRequest):
    """Create a new document for a project."""
    try:
        logfire.info(
            f"Creating document for project | project_id={project_id} | title={request.title}"
        )

        # Use DocumentService to create document
        document_service = DocumentService()
        success, result = document_service.add_document(
            project_id=project_id,
            document_type=request.document_type,
            title=request.title,
            content=request.content,
            tags=request.tags,
            author=request.author,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result)

        logfire.info(
            f"Document created successfully | project_id={project_id} | doc_id={result['document']['id']}"
        )

        return {"message": "Document created successfully", "document": result["document"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create document | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}/docs/{doc_id}")
async def get_project_document(project_id: str, doc_id: str):
    """Get a specific document from a project."""
    try:
        logfire.info(f"Getting document | project_id={project_id} | doc_id={doc_id}")

        # Use DocumentService to get document
        document_service = DocumentService()
        success, result = document_service.get_document(project_id, doc_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Document retrieved successfully | project_id={project_id} | doc_id={doc_id}")

        return result["document"]

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to get document | error={str(e)} | project_id={project_id} | doc_id={doc_id}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.put("/projects/{project_id}/docs/{doc_id}")
async def update_project_document(project_id: str, doc_id: str, request: UpdateDocumentRequest):
    """Update a document in a project."""
    try:
        logfire.info(f"Updating document | project_id={project_id} | doc_id={doc_id}")

        # Build update fields
        update_fields = {}
        if request.title is not None:
            update_fields["title"] = request.title
        if request.content is not None:
            update_fields["content"] = request.content
        if request.tags is not None:
            update_fields["tags"] = request.tags
        if request.author is not None:
            update_fields["author"] = request.author

        # Use DocumentService to update document
        document_service = DocumentService()
        success, result = document_service.update_document(project_id, doc_id, update_fields)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Document updated successfully | project_id={project_id} | doc_id={doc_id}")

        return {"message": "Document updated successfully", "document": result["document"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to update document | error={str(e)} | project_id={project_id} | doc_id={doc_id}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.delete("/projects/{project_id}/docs/{doc_id}")
async def delete_project_document(project_id: str, doc_id: str):
    """Delete a document from a project."""
    try:
        logfire.info(f"Deleting document | project_id={project_id} | doc_id={doc_id}")

        # Use DocumentService to delete document
        document_service = DocumentService()
        success, result = document_service.delete_document(project_id, doc_id)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(f"Document deleted successfully | project_id={project_id} | doc_id={doc_id}")

        return {"message": "Document deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to delete document | error={str(e)} | project_id={project_id} | doc_id={doc_id}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ==================== VERSION MANAGEMENT ENDPOINTS ====================


@router.get("/projects/{project_id}/versions")
async def list_project_versions(project_id: str, field_name: str = None):
    """List version history for a project's JSONB fields."""
    try:
        logfire.info(
            f"Listing versions for project | project_id={project_id} | field_name={field_name}"
        )

        # Use VersioningService to list versions
        versioning_service = VersioningService()
        success, result = versioning_service.list_versions(project_id, field_name)

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Versions listed successfully | project_id={project_id} | count={result.get('total_count', 0)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to list versions | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/versions")
async def create_project_version(project_id: str, request: CreateVersionRequest):
    """Create a version snapshot for a project's JSONB field."""
    try:
        logfire.info(
            f"Creating version for project | project_id={project_id} | field_name={request.field_name}"
        )

        # Use VersioningService to create version
        versioning_service = VersioningService()
        success, result = versioning_service.create_version(
            project_id=project_id,
            field_name=request.field_name,
            content=request.content,
            change_summary=request.change_summary,
            change_type=request.change_type,
            document_id=request.document_id,
            created_by=request.created_by,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=400, detail=result)

        logfire.info(
            f"Version created successfully | project_id={project_id} | version_number={result['version_number']}"
        )

        return {"message": "Version created successfully", "version": result["version"]}

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to create version | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/projects/{project_id}/versions/{field_name}/{version_number}")
async def get_project_version(project_id: str, field_name: str, version_number: int):
    """Get a specific version's content."""
    try:
        logfire.info(
            f"Getting version | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        # Use VersioningService to get version content
        versioning_service = VersioningService()
        success, result = versioning_service.get_version_content(
            project_id, field_name, version_number
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Version retrieved successfully | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to get version | error={str(e)} | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/versions/{field_name}/{version_number}/restore")
async def restore_project_version(
    project_id: str, field_name: str, version_number: int, request: RestoreVersionRequest
):
    """Restore a project's JSONB field to a specific version."""
    try:
        logfire.info(
            f"Restoring version | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        # Use VersioningService to restore version
        versioning_service = VersioningService()
        success, result = versioning_service.restore_version(
            project_id=project_id,
            field_name=field_name,
            version_number=version_number,
            restored_by=request.restored_by,
        )

        if not success:
            if "not found" in result.get("error", "").lower():
                raise HTTPException(status_code=404, detail=result.get("error"))
            else:
                raise HTTPException(status_code=500, detail=result)

        logfire.info(
            f"Version restored successfully | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )

        return {
            "message": f"Successfully restored {field_name} to version {version_number}",
            **result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(
            f"Failed to restore version | error={str(e)} | project_id={project_id} | field_name={field_name} | version_number={version_number}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})


class ArchiveProjectRequest(BaseModel):
    archived_by: str = "User"


@router.post("/projects/{project_id}/archive")
async def archive_project(project_id: str, request: ArchiveProjectRequest):
    """
    Archive a project and all its associated tasks.

    This endpoint calls the PostgreSQL function archive_project_and_tasks()
    which automatically cascades the archival to all tasks.

    Args:
        project_id: UUID of the project to archive
        request: Contains archived_by field (default: "User")

    Returns:
        Success message with count of tasks archived
    """
    try:
        logfire.debug(f"Archiving project | project_id={project_id} | archived_by={request.archived_by}")

        project_service = ProjectService()
        success, result = project_service.archive_project(project_id, request.archived_by)

        if not success:
            error_msg = result.get("error", "Failed to archive project")
            logfire.error(f"Project archival failed | project_id={project_id} | error={error_msg}")
            raise HTTPException(status_code=404 if "not found" in error_msg.lower() else 500, detail=error_msg)

        logfire.info(
            f"Project archived successfully | project_id={project_id} | tasks_archived={result.get('tasks_archived', 0)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to archive project | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/projects/{project_id}/unarchive")
async def unarchive_project(project_id: str):
    """
    Unarchive a project and all its associated tasks.

    This endpoint calls the PostgreSQL function unarchive_project_and_tasks()
    which automatically cascades the unarchival to all tasks.

    Args:
        project_id: UUID of the project to unarchive

    Returns:
        Success message with count of tasks unarchived
    """
    try:
        logfire.debug(f"Unarchiving project | project_id={project_id}")

        project_service = ProjectService()
        success, result = project_service.unarchive_project(project_id)

        if not success:
            error_msg = result.get("error", "Failed to unarchive project")
            logfire.error(f"Project unarchival failed | project_id={project_id} | error={error_msg}")
            raise HTTPException(status_code=404 if "not found" in error_msg.lower() else 500, detail=error_msg)

        logfire.info(
            f"Project unarchived successfully | project_id={project_id} | tasks_unarchived={result.get('tasks_unarchived', 0)}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to unarchive project | error={str(e)} | project_id={project_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


class ArchiveTaskRequest(BaseModel):
    archived_by: str = "User"


@router.post("/tasks/{task_id}/archive")
async def archive_task(task_id: str, request: ArchiveTaskRequest):
    """
    Archive a specific task.
    
    Args:
        task_id: UUID of the task to archive
        request: Contains archived_by field (default: "User")
    
    Returns:
        Success message with task details
    """
    try:
        logfire.debug(f"Archiving task | task_id={task_id} | archived_by={request.archived_by}")
        
        task_service = TaskService()
        success, result = await task_service.archive_task(task_id, request.archived_by)
        
        if not success:
            error_msg = result.get("error", "Failed to archive task")
            logfire.error(f"Task archival failed | task_id={task_id} | error={error_msg}")
            
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            elif "already archived" in error_msg.lower():
                raise HTTPException(status_code=409, detail=error_msg)
            else:
                raise HTTPException(status_code=500, detail=error_msg)
        
        logfire.info(f"Task archived successfully | task_id={task_id}")
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to archive task | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.post("/tasks/{task_id}/unarchive")
async def unarchive_task(task_id: str):
    """
    Unarchive a specific task.
    
    Args:
        task_id: UUID of the task to unarchive
    
    Returns:
        Success message with task details
    """
    try:
        logfire.debug(f"Unarchiving task | task_id={task_id}")
        
        task_service = TaskService()
        success, result = await task_service.unarchive_task(task_id)
        
        if not success:
            error_msg = result.get("error", "Failed to unarchive task")
            logfire.error(f"Task unarchival failed | task_id={task_id} | error={error_msg}")
            
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            elif "not archived" in error_msg.lower():
                raise HTTPException(status_code=409, detail=error_msg)
            else:
                raise HTTPException(status_code=500, detail=error_msg)
        
        logfire.info(f"Task unarchived successfully | task_id={task_id}")
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to unarchive task | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})



@router.get("/tasks/{task_id}/history")
async def get_task_history(
    task_id: str,
    field_name: str | None = None,
    limit: int = 50
):
    """
    Get change history for a specific task.

    Returns chronological list of all field changes for the task,
    automatically logged by the archon_task_history trigger.

    Args:
        task_id: UUID of the task
        field_name: Optional filter for specific field (status, assignee, priority, etc.)
        limit: Maximum number of changes to return (default: 50)

    Returns:
        Array of changes with old/new values, changed_by, and timestamps
    """
    try:
        logfire.debug(f"Getting task history | task_id={task_id} | field_name={field_name} | limit={limit}")

        task_service = TaskService()
        success, result = task_service.get_task_history(task_id, field_name, limit)

        if not success:
            error_msg = result.get("error", "Failed to get task history")
            logfire.error(f"Task history retrieval failed | task_id={task_id} | error={error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)

        logfire.info(f"Task history retrieved | task_id={task_id} | changes_count={result.get('count', 0)}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get task history | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/tasks/{task_id}/versions")
async def get_task_versions(
    task_id: str,
    field_name: str | None = None,
    limit: int = 10
):
    """
    Get version history for a task's fields.
    
    Returns snapshots of significant field changes over time.
    
    Args:
        task_id: UUID of the task
        field_name: Optional filter for specific field (title, description, sources, code_examples)
        limit: Maximum number of versions to return (default: 10)
    
    Returns:
        JSON with versions list containing version snapshots
    """
    try:
        logfire.debug(f"Getting task versions | task_id={task_id} | field_name={field_name} | limit={limit}")
        
        task_service = TaskService()
        success, result = task_service.get_task_versions(task_id, field_name, limit)
        
        if not success:
            error_msg = result.get("error", "Failed to get task versions")
            logfire.error(f"Task versions retrieval failed | task_id={task_id} | error={error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        
        logfire.info(f"Task versions retrieved | task_id={task_id} | count={result.get('count', 0)}")
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to get task versions | error={str(e)} | task_id={task_id}")
        raise HTTPException(status_code=500, detail={"error": str(e)})


# ============================================================================
# ADMIN ENDPOINTS - Data Retention and Maintenance
# ============================================================================


class PurgeTaskHistoryRequest(BaseModel):
    """Request model for purging old task history"""
    retention_days: int = 365
    keep_archived: bool = True
    dry_run: bool = False


@router.post("/admin/purge-task-history")
async def purge_task_history(request: PurgeTaskHistoryRequest):
    """
    Purge old task history records based on retention policy.

    This is an admin endpoint that cleans up old task_history records while
    preserving important history (archived tasks, completion events, archival events).

    Args:
        retention_days: Number of days to retain history (default: 365)
        keep_archived: Keep history for archived tasks indefinitely (default: true)
        dry_run: Preview mode - count what would be deleted without deleting (default: false)

    Returns:
        JSON with purge statistics:
        - deleted_count: Number of records deleted (or would be deleted if dry_run)
        - oldest_deleted: Timestamp of oldest deleted record
        - newest_deleted: Timestamp of newest deleted record
        - retention_days: Retention policy used
        - keep_archived: Whether archived task history was preserved
        - dry_run: Whether this was a preview run
        - message: Human-readable summary

    Examples:
        # Dry run (preview)
        POST /api/admin/purge-task-history
        {
            "retention_days": 365,
            "keep_archived": true,
            "dry_run": true
        }

        # Actually purge with 180-day retention
        POST /api/admin/purge-task-history
        {
            "retention_days": 180,
            "keep_archived": true,
            "dry_run": false
        }

    Notes:
        - Always preserves: task completion events (status→done), archival events (archived→true)
        - If keep_archived=true: preserves ALL history for archived tasks
        - Use dry_run=true first to preview impact before actual purge
        - Recommended to run during low-traffic periods
        - Consider backing up database before large purges
    """
    try:
        logfire.info(
            f"Admin purge task history request | retention_days={request.retention_days} | "
            f"keep_archived={request.keep_archived} | dry_run={request.dry_run}"
        )

        task_service = TaskService()
        success, result = task_service.purge_old_task_history(
            retention_days=request.retention_days,
            keep_archived=request.keep_archived,
            dry_run=request.dry_run
        )

        if not success:
            error_msg = result.get("error", "Failed to purge task history")
            logfire.error(f"Task history purge failed | error={error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)

        deleted_count = result.get("deleted_count", 0)
        log_msg = (
            f"Task history purge {'preview' if request.dry_run else 'completed'} | "
            f"deleted_count={deleted_count} | retention_days={request.retention_days}"
        )

        if request.dry_run:
            logfire.info(log_msg)
        else:
            logfire.warning(log_msg)  # Use warning level for actual deletions

        return result

    except HTTPException:
        raise
    except Exception as e:
        logfire.error(f"Failed to purge task history | error={str(e)}")
        raise HTTPException(status_code=500, detail={"error": str(e)})
