"""
Sprints API endpoints for Archon

Handles:
- Sprint lifecycle (create, start, complete)
- Sprint management (list, get details, velocity)
- Task assignment to sprints
"""

from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from pydantic import BaseModel, Field

from ..auth.dependencies import require_sprint_manage, require_task_assign
from ..config.logfire_config import get_logger, logfire
from ..services.projects import SprintService

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["sprints"])


async def get_sprint_project_id(sprint_id: str) -> str:
    """
    Helper to get project_id from sprint_id for permission checking.

    Args:
        sprint_id: UUID of the sprint

    Returns:
        Project UUID

    Raises:
        HTTPException 404: Sprint not found
    """
    sprint_service = SprintService()
    success, result = await sprint_service.get_sprint_by_id(sprint_id)

    if not success or not result.get("sprint"):
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Sprint {sprint_id} not found"
        )

    project_id = result["sprint"].get("project_id")
    if not project_id:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sprint has no associated project"
        )

    return project_id


async def get_task_project_id(task_id: str) -> str:
    """
    Helper to get project_id from task_id for permission checking.

    Args:
        task_id: UUID of the task

    Returns:
        Project UUID

    Raises:
        HTTPException 404: Task not found
    """
    from ..utils import get_supabase_client

    supabase_client = get_supabase_client()
    response = supabase_client.table("archon_tasks").select("project_id").eq("id", task_id).execute()

    if not response.data:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )

    project_id = response.data[0].get("project_id")
    if not project_id:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Task has no associated project"
        )

    return project_id


class CreateSprintRequest(BaseModel):
    """Request to create a new sprint"""
    name: str = Field(..., description="Sprint name (e.g., 'Sprint 1', 'Q1 2026 Sprint 3')")
    start_date: date = Field(..., description="Sprint start date")
    end_date: date = Field(..., description="Sprint end date (must be after start_date)")
    goal: Optional[str] = Field(None, description="Sprint goal/objective")


class AssignTaskToSprintRequest(BaseModel):
    """Request to assign task to sprint"""
    sprint_id: Optional[str] = Field(None, description="Sprint ID (null to remove from sprint)")


@router.post("/projects/{project_id}/sprints")
async def create_sprint(
    project_id: str,
    request: CreateSprintRequest,
    _user: dict = Depends(require_sprint_manage)
):
    """
    Create a new sprint for a project.

    Requires: sprint:manage permission in the project

    Args:
        project_id: UUID of the project
        request: Sprint details (name, dates, goal)

    Returns:
        Created sprint object
    """
    try:
        logfire.debug(
            f"Creating sprint '{request.name}' for project {project_id} "
            f"({request.start_date} to {request.end_date})"
        )

        # Validate dates
        if request.end_date <= request.start_date:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Sprint end_date must be after start_date"
            )

        sprint_service = SprintService()
        success, result = await sprint_service.create_sprint(
            project_id=project_id,
            name=request.name,
            start_date=request.start_date,
            end_date=request.end_date,
            goal=request.goal
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Sprint '{request.name}' created successfully")
        return result["sprint"]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating sprint for project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/sprints/{sprint_id}/start")
async def start_sprint(
    sprint_id: str,
    project_id: str = Depends(get_sprint_project_id),
    _user: dict = Depends(require_sprint_manage)
):
    """
    Activate a sprint (validate only one active sprint per project).

    Requires: sprint:manage permission in the project

    Args:
        sprint_id: UUID of the sprint to activate

    Returns:
        Updated sprint object
    """
    try:
        logfire.debug(f"Starting sprint {sprint_id}")

        sprint_service = SprintService()
        success, result = await sprint_service.start_sprint(sprint_id)

        if not success:
            error_msg = result.get("error", "Unknown error")

            # Return 409 Conflict if another sprint is active
            if "already has an active sprint" in error_msg:
                raise HTTPException(
                    status_code=http_status.HTTP_409_CONFLICT,
                    detail=error_msg
                )

            # Return 404 if sprint not found
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )

            # Return 400 for invalid status transitions
            if "cannot start" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )

            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Sprint {sprint_id} started successfully")
        return result["sprint"]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting sprint {sprint_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/sprints/{sprint_id}/complete")
async def complete_sprint(
    sprint_id: str,
    project_id: str = Depends(get_sprint_project_id),
    _user: dict = Depends(require_sprint_manage)
):
    """
    Close a sprint and calculate its velocity.

    Requires: sprint:manage permission in the project

    Args:
        sprint_id: UUID of the sprint to complete

    Returns:
        Updated sprint object with calculated velocity
    """
    try:
        logfire.debug(f"Completing sprint {sprint_id}")

        sprint_service = SprintService()
        success, result = await sprint_service.complete_sprint(sprint_id)

        if not success:
            error_msg = result.get("error", "Unknown error")

            # Return 404 if sprint not found
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )

            # Return 400 for invalid status transitions
            if "cannot complete" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )

            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Sprint {sprint_id} completed with velocity {result['velocity']}")
        return {
            "sprint": result["sprint"],
            "velocity": result["velocity"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing sprint {sprint_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/projects/{project_id}/sprints")
async def list_sprints(project_id: str, include_cancelled: bool = False):
    """
    List all sprints for a project.

    Args:
        project_id: UUID of the project
        include_cancelled: Whether to include cancelled sprints (default: False)

    Returns:
        Array of sprint objects
    """
    try:
        logfire.debug(f"Listing sprints for project {project_id}")

        sprint_service = SprintService()
        success, result = await sprint_service.list_sprints(
            project_id=project_id,
            include_cancelled=include_cancelled
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Retrieved {result['count']} sprints for project {project_id}")
        return {
            "sprints": result["sprints"],
            "count": result["count"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing sprints for project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/sprints/{sprint_id}")
async def get_sprint(sprint_id: str, include_tasks: bool = True):
    """
    Get sprint details, optionally with tasks.

    Args:
        sprint_id: UUID of the sprint
        include_tasks: Whether to include sprint tasks (default: True)

    Returns:
        Sprint object with optional tasks array
    """
    try:
        logfire.debug(f"Getting sprint {sprint_id} (include_tasks={include_tasks})")

        sprint_service = SprintService()

        # Get sprint details
        success, result = await sprint_service.get_sprint_by_id(sprint_id)

        if not success:
            error_msg = result.get("error", "Unknown error")
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        sprint = result["sprint"]

        # Get tasks if requested
        if include_tasks:
            tasks_success, tasks_result = await sprint_service.get_sprint_tasks(sprint_id)
            if tasks_success:
                sprint["tasks"] = tasks_result["tasks"]
                sprint["task_count"] = tasks_result["count"]
            else:
                logger.warning(f"Could not fetch tasks for sprint {sprint_id}")
                sprint["tasks"] = []
                sprint["task_count"] = 0

        logfire.debug(f"Retrieved sprint {sprint_id}")
        return sprint

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sprint {sprint_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/sprints/{sprint_id}/velocity")
async def get_sprint_velocity(sprint_id: str):
    """
    Get sprint velocity (sum of completed story points).

    Args:
        sprint_id: UUID of the sprint

    Returns:
        Velocity metrics and breakdown
    """
    try:
        logfire.debug(f"Calculating velocity for sprint {sprint_id}")

        sprint_service = SprintService()
        success, result = await sprint_service.calculate_sprint_velocity(sprint_id)

        if not success:
            error_msg = result.get("error", "Unknown error")
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        # Also get task count
        tasks_success, tasks_result = await sprint_service.get_sprint_tasks(sprint_id)
        task_count = tasks_result.get("count", 0) if tasks_success else 0

        logfire.debug(f"Sprint {sprint_id} velocity: {result['velocity']}")
        return {
            "sprint_id": sprint_id,
            "velocity": result["velocity"],
            "task_count": task_count
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating velocity for sprint {sprint_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/tasks/{task_id}/sprint")
async def assign_task_to_sprint(
    task_id: str,
    request: AssignTaskToSprintRequest,
    project_id: str = Depends(get_task_project_id),
    _user: dict = Depends(require_task_assign)
):
    """
    Assign a task to a sprint (or remove from sprint).

    Requires: task:assign permission in the project

    Args:
        task_id: UUID of the task
        request: Contains sprint_id (null to remove from sprint)

    Returns:
        Updated task object
    """
    try:
        action = "assigning to sprint" if request.sprint_id else "removing from sprint"
        logfire.debug(f"Task {task_id}: {action}")

        sprint_service = SprintService()
        success, result = await sprint_service.move_task_to_sprint(
            task_id=task_id,
            sprint_id=request.sprint_id
        )

        if not success:
            error_msg = result.get("error", "Unknown error")

            # Return 404 if task or sprint not found
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )

            # Return 400 for validation errors (different project)
            if "same project" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )

            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Task {task_id} {action} successfully")
        return result["task"]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning task {task_id} to sprint: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/projects/{project_id}/sprints/active")
async def get_active_sprint(project_id: str):
    """
    Get the currently active sprint for a project.

    Args:
        project_id: UUID of the project

    Returns:
        Active sprint object or null if no active sprint
    """
    try:
        logfire.debug(f"Getting active sprint for project {project_id}")

        sprint_service = SprintService()
        success, result = await sprint_service.get_active_sprint(project_id)

        if not success:
            error_msg = result.get("error", "Unknown error")
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        sprint = result.get("sprint")

        if sprint:
            logfire.debug(f"Active sprint found: {sprint['name']}")
        else:
            logfire.debug(f"No active sprint for project {project_id}")

        return {
            "project_id": project_id,
            "sprint": sprint
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting active sprint for project {project_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
