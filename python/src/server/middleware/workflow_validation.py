"""
Workflow Validation Middleware for Archon

This module provides middleware and dependency functions for validating
workflow stage transitions in task update operations.
"""

from typing import Optional

from fastapi import HTTPException, status

from ..config.logfire_config import get_logger
from ..services.projects import WorkflowService
from ..utils import get_supabase_client

logger = get_logger(__name__)


async def validate_workflow_stage_transition(
    task_id: str,
    new_stage_id: str,
    supabase_client=None
) -> dict:
    """
    Validate that a workflow stage transition is allowed.

    This middleware function:
    1. Fetches current task stage
    2. Validates transition is within same workflow
    3. Returns validation result with stage details

    Args:
        task_id: UUID of the task being updated
        new_stage_id: UUID of the target workflow stage
        supabase_client: Optional Supabase client (for testing)

    Returns:
        dict with from_stage, to_stage, and validation details

    Raises:
        HTTPException 404: If task or stages not found
        HTTPException 400: If transition is invalid (different workflows)
        HTTPException 500: If validation fails
    """
    try:
        client = supabase_client or get_supabase_client()

        # Get current task stage
        task_response = (
            client.table("archon_tasks")
            .select("workflow_stage_id")
            .eq("id", task_id)
            .execute()
        )

        if not task_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {task_id} not found"
            )

        current_stage_id = task_response.data[0].get("workflow_stage_id")

        if not current_stage_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task does not have a workflow stage assigned"
            )

        # Skip validation if stage hasn't changed
        if current_stage_id == new_stage_id:
            logger.debug(f"Stage unchanged for task {task_id}, skipping validation")
            return {"valid": True, "stage_unchanged": True}

        # Validate transition using WorkflowService
        workflow_service = WorkflowService(supabase_client=client)
        success, result = await workflow_service.validate_stage_transition(
            current_stage_id, new_stage_id
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            logger.warning(
                f"Stage transition validation failed | task={task_id} | "
                f"from={current_stage_id} | to={new_stage_id} | error={error_msg}"
            )

            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            if "different workflow" in error_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logger.info(
            f"Stage transition validated | task={task_id} | "
            f"from={result['from_stage']['name']} | to={result['to_stage']['name']}"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating stage transition: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stage transition validation error: {str(e)}"
        )


def validate_stage_in_update_data(
    update_data: dict,
    task_id: Optional[str] = None
) -> tuple[bool, Optional[str]]:
    """
    Check if workflow_stage_id is present in update data.

    Helper function to determine if stage transition validation is needed.

    Args:
        update_data: Dictionary of fields being updated
        task_id: Optional task ID for logging

    Returns:
        Tuple of (needs_validation, new_stage_id)
    """
    new_stage_id = update_data.get("workflow_stage_id")

    if new_stage_id:
        logger.debug(
            f"Workflow stage update detected | task={task_id} | new_stage={new_stage_id}"
        )
        return True, new_stage_id

    return False, None
