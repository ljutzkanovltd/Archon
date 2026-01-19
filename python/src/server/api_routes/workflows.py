"""
Workflows API endpoints for Archon

Handles:
- Workflow management (get workflows, stages)
- Task stage transitions
- Project type workflow lookup
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from pydantic import BaseModel

from ..auth.dependencies import require_permission
from ..config.logfire_config import get_logger, logfire
from ..services.projects import WorkflowService

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["workflows"])


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


class TransitionTaskRequest(BaseModel):
    """Request to transition task to new stage"""
    to_stage_id: str


@router.get("/workflows")
async def list_workflows():
    """
    Get all available workflows.

    Returns:
        Array of workflow objects with basic info (id, name, project_type_id)
    """
    try:
        logfire.debug("Listing all workflows")

        workflow_service = WorkflowService()
        success, result = await workflow_service.list_workflows()

        if not success:
            error_msg = result.get("error", "Unknown error")
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Retrieved {len(result['workflows'])} workflows")
        return {
            "workflows": result["workflows"],
            "count": len(result["workflows"])
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing workflows: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    """
    Get workflow details with all stages.

    Args:
        workflow_id: UUID of the workflow

    Returns:
        Workflow object with nested stages array
    """
    try:
        logfire.debug(f"Getting workflow {workflow_id}")

        workflow_service = WorkflowService()
        success, result = await workflow_service.get_workflow_by_id(workflow_id)

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

        logfire.debug(f"Workflow {workflow_id} retrieved successfully")
        return result["workflow"]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow {workflow_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/workflows/{workflow_id}/stages")
async def get_workflow_stages(workflow_id: str):
    """
    Get ordered list of stages for a workflow.

    Args:
        workflow_id: UUID of the workflow

    Returns:
        Array of workflow stages ordered by stage_order
    """
    try:
        logfire.debug(f"Getting stages for workflow {workflow_id}")

        workflow_service = WorkflowService()
        success, result = await workflow_service.get_workflow_stages(workflow_id)

        if not success:
            error_msg = result.get("error", "Unknown error")
            if "not found" in error_msg.lower() or "no stages" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Retrieved {len(result['stages'])} stages for workflow {workflow_id}")
        return {
            "stages": result["stages"],
            "count": len(result["stages"])
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stages for workflow {workflow_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/project-types/{type_id}/workflow")
async def get_project_type_workflow(type_id: str):
    """
    Get the default workflow for a project type.

    Args:
        type_id: UUID of the project type

    Returns:
        Default workflow object with nested stages
    """
    try:
        logfire.debug(f"Getting default workflow for project type {type_id}")

        workflow_service = WorkflowService()
        success, result = await workflow_service.get_workflow_by_project_type(type_id)

        if not success:
            error_msg = result.get("error", "Unknown error")
            if "not found" in error_msg.lower() or "no default" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Retrieved default workflow for project type {type_id}")
        return result["workflow"]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow for project type {type_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/tasks/{task_id}/transition")
async def transition_task(
    task_id: str,
    request: TransitionTaskRequest,
    project_id: str = Depends(get_task_project_id),
    _user: dict = Depends(require_permission("task", "write"))
):
    """
    Move task to a new workflow stage.

    Requires: task:write permission in the project

    This endpoint validates the transition is allowed before applying it.

    Args:
        task_id: UUID of the task
        request: Contains to_stage_id

    Returns:
        Success confirmation with from/to stage details
    """
    try:
        logfire.debug(f"Transitioning task {task_id} to stage {request.to_stage_id}")

        # Import TaskService and Supabase client
        from ..services.projects import TaskService
        from ..utils import get_supabase_client

        supabase_client = get_supabase_client()

        # Get current task to find current stage
        task_response = (
            supabase_client.table("archon_tasks")
            .select("workflow_stage_id")
            .eq("id", task_id)
            .execute()
        )

        if not task_response.data:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Task {task_id} not found"
            )

        current_stage_id = task_response.data[0].get("workflow_stage_id")

        if not current_stage_id:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Task does not have a workflow stage assigned"
            )

        # Validate transition
        workflow_service = WorkflowService()
        success, result = await workflow_service.validate_stage_transition(
            current_stage_id, request.to_stage_id
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            if "different workflow" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        # Apply transition
        update_response = (
            supabase_client.table("archon_tasks")
            .update({"workflow_stage_id": request.to_stage_id})
            .eq("id", task_id)
            .execute()
        )

        if not update_response.data:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update task stage"
            )

        logfire.debug(
            f"Task {task_id} transitioned from {result['from_stage']['name']} "
            f"to {result['to_stage']['name']}"
        )

        return {
            "success": True,
            "task_id": task_id,
            "from_stage": result["from_stage"],
            "to_stage": result["to_stage"],
            "task": update_response.data[0]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error transitioning task {task_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/workflow-stages/{stage_id}/transitions")
async def get_available_transitions(stage_id: str):
    """
    Get all possible next stages from the current stage.

    Args:
        stage_id: UUID of the current workflow stage

    Returns:
        Array of available stages to transition to
    """
    try:
        logfire.debug(f"Getting available transitions for stage {stage_id}")

        workflow_service = WorkflowService()
        success, result = await workflow_service.get_available_transitions(stage_id)

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

        logfire.debug(
            f"Found {len(result['available_stages'])} available transitions for stage {stage_id}"
        )
        return {
            "current_stage_id": result["current_stage_id"],
            "available_stages": result["available_stages"],
            "count": len(result["available_stages"])
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting transitions for stage {stage_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
