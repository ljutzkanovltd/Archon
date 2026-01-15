"""
Workflow Service Module for Archon

This module provides business logic for workflow and workflow stage operations.
Workflows define the task lifecycle stages (todo, doing, review, done, etc.)
and are associated with project types.
"""

from datetime import datetime
from typing import Any, Optional

from src.server.utils import get_supabase_client
from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class WorkflowService:
    """Service class for workflow operations"""

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()
        self._workflow_cache = {}  # In-memory cache for workflows (they rarely change)

    async def get_workflow_by_project_type(
        self, project_type_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get the default workflow for a given project type.

        Args:
            project_type_id: UUID of the project type

        Returns:
            Tuple of (success, result_dict)
            result_dict contains workflow with stages or error message
        """
        try:
            # Check cache first
            cache_key = f"type_{project_type_id}"
            if cache_key in self._workflow_cache:
                logger.info(
                    f"Returning cached workflow for project type {project_type_id}"
                )
                return True, {"workflow": self._workflow_cache[cache_key]}

            # Query database for default workflow
            workflow_response = (
                self.supabase_client.table("archon_workflows")
                .select("*")
                .eq("project_type_id", project_type_id)
                .eq("is_default", True)
                .execute()
            )

            if not workflow_response.data:
                return False, {
                    "error": f"No default workflow found for project type {project_type_id}"
                }

            workflow = workflow_response.data[0]

            # Fetch stages for this workflow
            stages_response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("*")
                .eq("workflow_id", workflow["id"])
                .order("stage_order")
                .execute()
            )

            workflow["stages"] = stages_response.data

            # Cache the workflow
            self._workflow_cache[cache_key] = workflow

            logger.info(
                f"Retrieved workflow {workflow['name']} with {len(workflow['stages'])} stages"
            )
            return True, {"workflow": workflow}

        except Exception as e:
            logger.error(
                f"Error getting workflow for project type {project_type_id}: {str(e)}"
            )
            return False, {"error": str(e)}

    async def get_workflow_by_id(self, workflow_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get workflow by ID with all stages.

        Args:
            workflow_id: UUID of the workflow

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Check cache first
            cache_key = f"workflow_{workflow_id}"
            if cache_key in self._workflow_cache:
                logger.info(f"Returning cached workflow {workflow_id}")
                return True, {"workflow": self._workflow_cache[cache_key]}

            # Query database
            workflow_response = (
                self.supabase_client.table("archon_workflows")
                .select("*")
                .eq("id", workflow_id)
                .execute()
            )

            if not workflow_response.data:
                return False, {"error": f"Workflow {workflow_id} not found"}

            workflow = workflow_response.data[0]

            # Fetch stages
            stages_response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("*")
                .eq("workflow_id", workflow_id)
                .order("stage_order")
                .execute()
            )

            workflow["stages"] = stages_response.data

            # Cache the workflow
            self._workflow_cache[cache_key] = workflow

            return True, {"workflow": workflow}

        except Exception as e:
            logger.error(f"Error getting workflow {workflow_id}: {str(e)}")
            return False, {"error": str(e)}

    async def get_workflow_stages(
        self, workflow_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get ordered list of stages for a workflow.

        Args:
            workflow_id: UUID of the workflow

        Returns:
            Tuple of (success, result_dict)
            result_dict contains stages array or error message
        """
        try:
            stages_response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("*")
                .eq("workflow_id", workflow_id)
                .order("stage_order")
                .execute()
            )

            if not stages_response.data:
                return False, {
                    "error": f"No stages found for workflow {workflow_id}"
                }

            logger.info(
                f"Retrieved {len(stages_response.data)} stages for workflow {workflow_id}"
            )
            return True, {"stages": stages_response.data}

        except Exception as e:
            logger.error(
                f"Error getting stages for workflow {workflow_id}: {str(e)}"
            )
            return False, {"error": str(e)}

    async def validate_stage_transition(
        self, from_stage_id: str, to_stage_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Validate if a transition from one stage to another is allowed.

        For now, we allow all transitions within the same workflow.
        Future enhancement: Add transition rules to workflow_stages table.

        Args:
            from_stage_id: Current stage UUID
            to_stage_id: Target stage UUID

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Fetch both stages
            from_stage_response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("workflow_id, name, stage_order")
                .eq("id", from_stage_id)
                .execute()
            )

            to_stage_response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("workflow_id, name, stage_order")
                .eq("id", to_stage_id)
                .execute()
            )

            if not from_stage_response.data:
                return False, {"error": f"Source stage {from_stage_id} not found"}

            if not to_stage_response.data:
                return False, {"error": f"Target stage {to_stage_id} not found"}

            from_stage = from_stage_response.data[0]
            to_stage = to_stage_response.data[0]

            # Check if both stages belong to the same workflow
            if from_stage["workflow_id"] != to_stage["workflow_id"]:
                return False, {
                    "error": "Cannot transition between stages from different workflows"
                }

            # All transitions within same workflow are allowed
            logger.info(
                f"Validated transition from '{from_stage['name']}' to '{to_stage['name']}'"
            )
            return True, {
                "valid": True,
                "from_stage": from_stage,
                "to_stage": to_stage,
            }

        except Exception as e:
            logger.error(
                f"Error validating transition from {from_stage_id} to {to_stage_id}: {str(e)}"
            )
            return False, {"error": str(e)}

    async def get_available_transitions(
        self, current_stage_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all possible next stages from the current stage.

        Args:
            current_stage_id: UUID of the current stage

        Returns:
            Tuple of (success, result_dict)
            result_dict contains available_stages array or error message
        """
        try:
            # Get current stage to find workflow
            current_stage_response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("workflow_id, stage_order")
                .eq("id", current_stage_id)
                .execute()
            )

            if not current_stage_response.data:
                return False, {"error": f"Stage {current_stage_id} not found"}

            current_stage = current_stage_response.data[0]
            workflow_id = current_stage["workflow_id"]

            # Get all stages in the workflow
            all_stages_response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("*")
                .eq("workflow_id", workflow_id)
                .order("stage_order")
                .execute()
            )

            # For now, allow transition to any stage in the workflow
            # Future: Implement transition rules (e.g., only to next stage, only forward, etc.)
            available_stages = [
                stage
                for stage in all_stages_response.data
                if stage["id"] != current_stage_id
            ]

            logger.info(
                f"Found {len(available_stages)} available transitions from stage {current_stage_id}"
            )
            return True, {
                "current_stage_id": current_stage_id,
                "available_stages": available_stages,
            }

        except Exception as e:
            logger.error(
                f"Error getting available transitions for stage {current_stage_id}: {str(e)}"
            )
            return False, {"error": str(e)}

    async def get_initial_stage(self, workflow_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get the initial stage of a workflow (where new tasks start).

        Args:
            workflow_id: UUID of the workflow

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            stage_response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("*")
                .eq("workflow_id", workflow_id)
                .eq("is_initial", True)
                .execute()
            )

            if not stage_response.data:
                # Fallback: return first stage by order
                stage_response = (
                    self.supabase_client.table("archon_workflow_stages")
                    .select("*")
                    .eq("workflow_id", workflow_id)
                    .order("stage_order")
                    .limit(1)
                    .execute()
                )

            if not stage_response.data:
                return False, {
                    "error": f"No initial stage found for workflow {workflow_id}"
                }

            initial_stage = stage_response.data[0]
            logger.info(
                f"Retrieved initial stage '{initial_stage['name']}' for workflow {workflow_id}"
            )
            return True, {"initial_stage": initial_stage}

        except Exception as e:
            logger.error(
                f"Error getting initial stage for workflow {workflow_id}: {str(e)}"
            )
            return False, {"error": str(e)}

    async def clear_cache(self):
        """Clear the workflow cache (useful for testing or after workflow updates)"""
        self._workflow_cache.clear()
        logger.info("Workflow cache cleared")
