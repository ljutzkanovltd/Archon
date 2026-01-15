"""
Sprint Service Module for Archon

This module provides business logic for sprint operations.
Sprints are time-boxed iterations for agile project management,
with support for velocity tracking, task assignment, and sprint lifecycle.
"""

from datetime import datetime, date
from typing import Any, Optional

from src.server.utils import get_supabase_client
from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class SprintService:
    """Service class for sprint operations"""

    VALID_STATUSES = ["planned", "active", "completed", "cancelled"]

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    async def create_sprint(
        self,
        project_id: str,
        name: str,
        start_date: date,
        end_date: date,
        goal: Optional[str] = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a new sprint for a project.

        Args:
            project_id: UUID of the project
            name: Sprint name (e.g., "Sprint 1", "Q1 2026 Sprint 3")
            start_date: Sprint start date
            end_date: Sprint end date
            goal: Optional sprint goal/objective

        Returns:
            Tuple of (success, result_dict)
            result_dict contains sprint data or error message
        """
        try:
            # Validate dates
            if end_date <= start_date:
                return False, {"error": "Sprint end_date must be after start_date"}

            # Create sprint
            sprint_data = {
                "project_id": project_id,
                "name": name,
                "goal": goal,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "status": "planned",
            }

            sprint_response = (
                self.supabase_client.table("archon_sprints")
                .insert(sprint_data)
                .execute()
            )

            if not sprint_response.data:
                return False, {"error": "Failed to create sprint"}

            sprint = sprint_response.data[0]
            logger.info(
                f"Created sprint '{name}' for project {project_id} ({start_date} to {end_date})"
            )
            return True, {"sprint": sprint}

        except Exception as e:
            logger.error(f"Error creating sprint: {str(e)}")
            return False, {"error": str(e)}

    async def start_sprint(self, sprint_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Activate a sprint, validating only one active sprint per project.

        Args:
            sprint_id: UUID of the sprint to activate

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get sprint to find project_id
            sprint_response = (
                self.supabase_client.table("archon_sprints")
                .select("*")
                .eq("id", sprint_id)
                .execute()
            )

            if not sprint_response.data:
                return False, {"error": f"Sprint {sprint_id} not found"}

            sprint = sprint_response.data[0]
            project_id = sprint["project_id"]

            # Check if sprint is already completed or cancelled
            if sprint["status"] in ["completed", "cancelled"]:
                return False, {
                    "error": f"Cannot start sprint with status '{sprint['status']}'"
                }

            # Check for other active sprints in this project
            active_sprints_response = (
                self.supabase_client.table("archon_sprints")
                .select("id, name")
                .eq("project_id", project_id)
                .eq("status", "active")
                .execute()
            )

            if active_sprints_response.data:
                other_active = active_sprints_response.data[0]
                return False, {
                    "error": f"Project already has an active sprint: '{other_active['name']}' ({other_active['id']})",
                    "conflict_sprint_id": other_active["id"],
                }

            # Activate the sprint
            update_response = (
                self.supabase_client.table("archon_sprints")
                .update({"status": "active", "updated_at": datetime.utcnow().isoformat()})
                .eq("id", sprint_id)
                .execute()
            )

            if not update_response.data:
                return False, {"error": "Failed to activate sprint"}

            logger.info(f"Activated sprint '{sprint['name']}' ({sprint_id})")
            return True, {"sprint": update_response.data[0]}

        except Exception as e:
            logger.error(f"Error starting sprint {sprint_id}: {str(e)}")
            return False, {"error": str(e)}

    async def complete_sprint(self, sprint_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Close a sprint and calculate its velocity.

        Args:
            sprint_id: UUID of the sprint to complete

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Get sprint details
            sprint_response = (
                self.supabase_client.table("archon_sprints")
                .select("*")
                .eq("id", sprint_id)
                .execute()
            )

            if not sprint_response.data:
                return False, {"error": f"Sprint {sprint_id} not found"}

            sprint = sprint_response.data[0]

            # Check if sprint can be completed
            if sprint["status"] not in ["planned", "active"]:
                return False, {
                    "error": f"Cannot complete sprint with status '{sprint['status']}'"
                }

            # Calculate velocity
            success, result = await self.calculate_sprint_velocity(sprint_id)
            if not success:
                logger.warning(
                    f"Could not calculate velocity for sprint {sprint_id}: {result.get('error')}"
                )
                velocity = 0
            else:
                velocity = result.get("velocity", 0)

            # Update sprint
            update_response = (
                self.supabase_client.table("archon_sprints")
                .update({
                    "status": "completed",
                    "velocity": velocity,
                    "completed_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                })
                .eq("id", sprint_id)
                .execute()
            )

            if not update_response.data:
                return False, {"error": "Failed to complete sprint"}

            logger.info(
                f"Completed sprint '{sprint['name']}' ({sprint_id}) with velocity {velocity}"
            )
            return True, {"sprint": update_response.data[0], "velocity": velocity}

        except Exception as e:
            logger.error(f"Error completing sprint {sprint_id}: {str(e)}")
            return False, {"error": str(e)}

    async def move_task_to_sprint(
        self, task_id: str, sprint_id: Optional[str]
    ) -> tuple[bool, dict[str, Any]]:
        """
        Assign a task to a sprint (or remove from sprint if sprint_id is None).

        Args:
            task_id: UUID of the task
            sprint_id: UUID of the sprint (None to remove from sprint)

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # If sprint_id provided, validate it exists
            if sprint_id:
                sprint_response = (
                    self.supabase_client.table("archon_sprints")
                    .select("id, name, project_id, status")
                    .eq("id", sprint_id)
                    .execute()
                )

                if not sprint_response.data:
                    return False, {"error": f"Sprint {sprint_id} not found"}

                sprint = sprint_response.data[0]

                # Optionally validate task belongs to same project
                task_response = (
                    self.supabase_client.table("archon_tasks")
                    .select("project_id")
                    .eq("id", task_id)
                    .execute()
                )

                if not task_response.data:
                    return False, {"error": f"Task {task_id} not found"}

                task = task_response.data[0]

                if task["project_id"] != sprint["project_id"]:
                    return False, {
                        "error": "Task and sprint must belong to the same project"
                    }

            # Update task
            update_response = (
                self.supabase_client.table("archon_tasks")
                .update({"sprint_id": sprint_id, "updated_at": datetime.utcnow().isoformat()})
                .eq("id", task_id)
                .execute()
            )

            if not update_response.data:
                return False, {"error": "Failed to assign task to sprint"}

            action = f"assigned to sprint {sprint_id}" if sprint_id else "removed from sprint"
            logger.info(f"Task {task_id} {action}")
            return True, {"task": update_response.data[0]}

        except Exception as e:
            logger.error(
                f"Error moving task {task_id} to sprint {sprint_id}: {str(e)}"
            )
            return False, {"error": str(e)}

    async def get_sprint_tasks(self, sprint_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get all tasks in a sprint.

        Args:
            sprint_id: UUID of the sprint

        Returns:
            Tuple of (success, result_dict)
            result_dict contains tasks array or error message
        """
        try:
            # Verify sprint exists
            sprint_response = (
                self.supabase_client.table("archon_sprints")
                .select("id, name")
                .eq("id", sprint_id)
                .execute()
            )

            if not sprint_response.data:
                return False, {"error": f"Sprint {sprint_id} not found"}

            # Get tasks
            tasks_response = (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("sprint_id", sprint_id)
                .order("task_order")
                .execute()
            )

            logger.info(
                f"Retrieved {len(tasks_response.data)} tasks for sprint {sprint_id}"
            )
            return True, {"tasks": tasks_response.data, "count": len(tasks_response.data)}

        except Exception as e:
            logger.error(f"Error getting tasks for sprint {sprint_id}: {str(e)}")
            return False, {"error": str(e)}

    async def calculate_sprint_velocity(
        self, sprint_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Calculate sprint velocity (sum of completed story points).

        Args:
            sprint_id: UUID of the sprint

        Returns:
            Tuple of (success, result_dict)
            result_dict contains velocity value or error message
        """
        try:
            # Get all tasks in sprint with their workflow stages
            tasks_response = (
                self.supabase_client.table("archon_tasks")
                .select("story_points, workflow_stage_id")
                .eq("sprint_id", sprint_id)
                .execute()
            )

            if not tasks_response.data:
                logger.info(f"No tasks found for sprint {sprint_id}, velocity = 0")
                return True, {"velocity": 0}

            # Get final stage IDs (where is_final = TRUE)
            final_stages_response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("id")
                .eq("is_final", True)
                .execute()
            )

            final_stage_ids = {stage["id"] for stage in final_stages_response.data}

            # Sum story points for tasks in final stages
            velocity = 0
            for task in tasks_response.data:
                if task["workflow_stage_id"] in final_stage_ids and task["story_points"]:
                    velocity += task["story_points"]

            logger.info(f"Calculated velocity {velocity} for sprint {sprint_id}")
            return True, {"velocity": velocity}

        except Exception as e:
            logger.error(f"Error calculating velocity for sprint {sprint_id}: {str(e)}")
            return False, {"error": str(e)}

    async def get_active_sprint(
        self, project_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get the currently active sprint for a project.

        Args:
            project_id: UUID of the project

        Returns:
            Tuple of (success, result_dict)
            result_dict contains sprint data or None if no active sprint
        """
        try:
            sprint_response = (
                self.supabase_client.table("archon_sprints")
                .select("*")
                .eq("project_id", project_id)
                .eq("status", "active")
                .execute()
            )

            if not sprint_response.data:
                logger.info(f"No active sprint found for project {project_id}")
                return True, {"sprint": None}

            sprint = sprint_response.data[0]
            logger.info(f"Retrieved active sprint '{sprint['name']}' for project {project_id}")
            return True, {"sprint": sprint}

        except Exception as e:
            logger.error(f"Error getting active sprint for project {project_id}: {str(e)}")
            return False, {"error": str(e)}

    async def get_sprint_by_id(self, sprint_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get sprint by ID with details.

        Args:
            sprint_id: UUID of the sprint

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            sprint_response = (
                self.supabase_client.table("archon_sprints")
                .select("*")
                .eq("id", sprint_id)
                .execute()
            )

            if not sprint_response.data:
                return False, {"error": f"Sprint {sprint_id} not found"}

            return True, {"sprint": sprint_response.data[0]}

        except Exception as e:
            logger.error(f"Error getting sprint {sprint_id}: {str(e)}")
            return False, {"error": str(e)}

    async def list_sprints(
        self, project_id: str, include_cancelled: bool = False
    ) -> tuple[bool, dict[str, Any]]:
        """
        List all sprints for a project.

        Args:
            project_id: UUID of the project
            include_cancelled: Whether to include cancelled sprints

        Returns:
            Tuple of (success, result_dict)
            result_dict contains sprints array or error message
        """
        try:
            query = (
                self.supabase_client.table("archon_sprints")
                .select("*")
                .eq("project_id", project_id)
                .order("start_date", desc=True)
            )

            if not include_cancelled:
                query = query.neq("status", "cancelled")

            sprints_response = query.execute()

            logger.info(
                f"Retrieved {len(sprints_response.data)} sprints for project {project_id}"
            )
            return True, {"sprints": sprints_response.data, "count": len(sprints_response.data)}

        except Exception as e:
            logger.error(f"Error listing sprints for project {project_id}: {str(e)}")
            return False, {"error": str(e)}
