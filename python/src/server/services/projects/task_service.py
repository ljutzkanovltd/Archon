"""
Task Service Module for Archon

This module provides core business logic for task operations that can be
shared between MCP tools and FastAPI endpoints.
"""

# Removed direct logging import - using unified config
from datetime import datetime
from typing import Any

from src.server.utils import get_supabase_client

from ...config.logfire_config import get_logger

logger = get_logger(__name__)

# Task updates are handled via polling - no broadcasting needed


class TaskService:
    """Service class for task operations"""

    # Default workflow ID for Standard Agile workflow
    DEFAULT_WORKFLOW_ID = "29d6341c-0352-46e7-95d3-c26ae27a1aff"

    # Default stage IDs for Standard Agile workflow (cached for performance)
    DEFAULT_STAGES = {
        "backlog": "36ff9fe9-4668-4472-a6b2-408ba5db06f7",      # stage_order 0
        "in_progress": "96c533b1-c1f7-479a-8e8c-f0d377a4e050",  # stage_order 1
        "review": "e9af2088-1c61-4634-8255-9955965fb1ee",       # stage_order 2
        "done": "6795f26d-7d47-4490-8b0b-ff65d212dbb4",         # stage_order 3
    }

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    def get_stage_id_by_name(self, stage_name: str, workflow_id: str = None) -> str | None:
        """
        Get workflow stage ID by name.

        Args:
            stage_name: Name of stage (backlog, in_progress, review, done)
            workflow_id: Optional workflow ID (defaults to Standard Agile)

        Returns:
            Stage UUID or None if not found
        """
        # Use cached default stages if using Standard Agile workflow
        if workflow_id is None or workflow_id == self.DEFAULT_WORKFLOW_ID:
            return self.DEFAULT_STAGES.get(stage_name.lower())

        # Query database for custom workflow stages
        try:
            response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("id")
                .eq("workflow_id", workflow_id)
                .ilike("name", stage_name)
                .limit(1)
                .execute()
            )
            if response.data:
                return response.data[0]["id"]
        except Exception as e:
            logger.error(f"Error fetching stage ID for {stage_name}: {e}")

        return None

    def validate_workflow_stage(self, stage_id: str, workflow_id: str = None) -> tuple[bool, str]:
        """
        Validate that a workflow_stage_id exists and optionally belongs to a workflow.

        Args:
            stage_id: UUID of the workflow stage
            workflow_id: Optional workflow UUID to validate against

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            query = self.supabase_client.table("archon_workflow_stages").select("id, name").eq("id", stage_id)

            if workflow_id:
                query = query.eq("workflow_id", workflow_id)

            response = query.limit(1).execute()

            if not response.data:
                return False, f"Invalid workflow_stage_id '{stage_id}'"

            return True, ""
        except Exception as e:
            logger.error(f"Error validating workflow stage: {e}")
            return False, f"Error validating workflow stage: {str(e)}"

    def validate_assignee(self, assignee: str) -> tuple[bool, str]:
        """Validate task assignee"""
        if not assignee or not isinstance(assignee, str) or len(assignee.strip()) == 0:
            return False, "Assignee must be a non-empty string"
        return True, ""

    def validate_priority(self, priority: str) -> tuple[bool, str]:
        """Validate task priority against allowed enum values"""
        VALID_PRIORITIES = ["low", "medium", "high", "critical"]
        if priority not in VALID_PRIORITIES:
            return (
                False,
                f"Invalid priority '{priority}'. Must be one of: {', '.join(VALID_PRIORITIES)}",
            )
        return True, ""

    async def create_task(
        self,
        project_id: str,
        title: str,
        description: str = "",
        assignee: str = "User",
        task_order: int = 0,
        priority: str = "medium",
        feature: str | None = None,
        sources: list[dict[str, Any]] = None,
        code_examples: list[dict[str, Any]] = None,
        workflow_stage_id: str | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a new task under a project with automatic reordering.

        Args:
            workflow_stage_id: Optional workflow stage ID. Defaults to "Backlog" stage.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate inputs
            if not title or not isinstance(title, str) or len(title.strip()) == 0:
                return False, {"error": "Task title is required and must be a non-empty string"}

            if not project_id or not isinstance(project_id, str):
                return False, {"error": "Project ID is required and must be a string"}

            # Validate assignee
            is_valid, error_msg = self.validate_assignee(assignee)
            if not is_valid:
                return False, {"error": error_msg}

            # Validate priority
            is_valid, error_msg = self.validate_priority(priority)
            if not is_valid:
                return False, {"error": error_msg}

            # Get or validate workflow_stage_id
            if workflow_stage_id:
                is_valid, error_msg = self.validate_workflow_stage(workflow_stage_id)
                if not is_valid:
                    return False, {"error": error_msg}
            else:
                # Default to "Backlog" stage
                workflow_stage_id = self.DEFAULT_STAGES["backlog"]

            # REORDERING LOGIC: If inserting at a specific position, increment existing tasks
            if task_order > 0:
                # Get all tasks in the same project and workflow stage with task_order >= new task's order
                existing_tasks_response = (
                    self.supabase_client.table("archon_tasks")
                    .select("id, task_order")
                    .eq("project_id", project_id)
                    .eq("workflow_stage_id", workflow_stage_id)
                    .gte("task_order", task_order)
                    .execute()
                )

                if existing_tasks_response.data:
                    logger.info(f"Reordering {len(existing_tasks_response.data)} existing tasks")

                    # Increment task_order for all affected tasks
                    for existing_task in existing_tasks_response.data:
                        new_order = existing_task["task_order"] + 1
                        self.supabase_client.table("archon_tasks").update({
                            "task_order": new_order,
                            "updated_at": datetime.now().isoformat(),
                        }).eq("id", existing_task["id"]).execute()

            task_data = {
                "project_id": project_id,
                "title": title,
                "description": description,
                "workflow_stage_id": workflow_stage_id,
                "assignee": assignee,
                "task_order": task_order,
                "priority": priority,
                "sources": sources or [],
                "code_examples": code_examples or [],
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            if feature:
                task_data["feature"] = feature

            response = self.supabase_client.table("archon_tasks").insert(task_data).execute()

            if response.data:
                task = response.data[0]

                return True, {
                    "task": {
                        "id": task["id"],
                        "project_id": task["project_id"],
                        "title": task["title"],
                        "description": task["description"],
                        "workflow_stage_id": task["workflow_stage_id"],
                        "assignee": task["assignee"],
                        "task_order": task["task_order"],
                        "priority": task["priority"],
                        "created_at": task["created_at"],
                    }
                }
            else:
                return False, {"error": "Failed to create task"}

        except Exception as e:
            logger.error(f"Error creating task: {e}")
            return False, {"error": f"Error creating task: {str(e)}"}

    def list_tasks(
        self,
        project_id: str = None,
        status: str = None,
        assignee: str = None,
        include_closed: bool = False,
        exclude_large_fields: bool = False,
        include_archived: bool = False,
        search_query: str = None,
        workflow_stage_id: str = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        List tasks with various filters.

        Args:
            project_id: Filter by project
            status: DEPRECATED - Map to workflow stage name (backlog/in_progress/review/done)
            assignee: Filter by assignee (User, planner, agents, etc.)
            include_closed: Include done tasks
            exclude_large_fields: If True, excludes sources and code_examples fields
            include_archived: If True, includes archived tasks
            search_query: Keyword search in title, description, and feature fields
            workflow_stage_id: Filter by workflow stage ID (preferred over status)

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Start with base query - join with workflow_stages to get stage info
            # Use explicit relationship name to avoid ambiguity
            if exclude_large_fields:
                # Select task fields + stage info
                query = self.supabase_client.table("archon_tasks").select(
                    "id, project_id, parent_task_id, title, description, "
                    "workflow_stage_id, assignee, task_order, priority, feature, archived, "
                    "archived_at, archived_by, created_at, updated_at, "
                    "sources, code_examples, "  # Still fetch for counting
                    "workflow_stage:archon_workflow_stages!archon_tasks_workflow_stage_id_fkey(id, name, stage_order, workflow_id)"
                )
            else:
                query = self.supabase_client.table("archon_tasks").select(
                    "*, workflow_stage:archon_workflow_stages!archon_tasks_workflow_stage_id_fkey(id, name, stage_order, workflow_id)"
                )

            # Track filters for debugging
            filters_applied = []

            # Apply filters
            if project_id:
                query = query.eq("project_id", project_id)
                filters_applied.append(f"project_id={project_id}")

            # Support both status (legacy) and workflow_stage_id (new)
            if workflow_stage_id:
                # Validate workflow stage
                is_valid, error_msg = self.validate_workflow_stage(workflow_stage_id)
                if not is_valid:
                    return False, {"error": error_msg}
                query = query.eq("workflow_stage_id", workflow_stage_id)
                filters_applied.append(f"workflow_stage_id={workflow_stage_id}")
            elif status:
                # Map legacy status to workflow stage name
                stage_id = self.get_stage_id_by_name(status)
                if not stage_id:
                    return False, {"error": f"Invalid status '{status}'. Must be one of: backlog, in_progress, review, done"}
                query = query.eq("workflow_stage_id", stage_id)
                filters_applied.append(f"status={status} (mapped to stage)")
            elif not include_closed:
                # Exclude "Done" stage tasks
                done_stage_id = self.DEFAULT_STAGES["done"]
                query = query.neq("workflow_stage_id", done_stage_id)
                filters_applied.append("exclude done tasks")

            if assignee:
                # Filter by assignee
                query = query.eq("assignee", assignee)
                filters_applied.append(f"assignee={assignee}")

            # Apply keyword search if provided
            if search_query:
                # Split search query into terms
                search_terms = search_query.lower().split()
                
                # Build the filter expression for AND-of-ORs
                # Each term must match in at least one field (OR), and all terms must match (AND)
                if len(search_terms) == 1:
                    # Single term: simple OR across fields
                    term = search_terms[0]
                    query = query.or_(
                        f"title.ilike.%{term}%,"
                        f"description.ilike.%{term}%,"
                        f"feature.ilike.%{term}%"
                    )
                else:
                    # Multiple terms: use text search for proper AND logic
                    # Note: This requires full-text search columns to be set up in the database
                    # For now, we'll search for the full phrase in any field
                    full_query = search_query.lower()
                    query = query.or_(
                        f"title.ilike.%{full_query}%,"
                        f"description.ilike.%{full_query}%,"
                        f"feature.ilike.%{full_query}%"
                    )
                filters_applied.append(f"search={search_query}")

            # Filter out archived tasks only if not including them
            if not include_archived:
                query = query.or_("archived.is.null,archived.is.false")
                filters_applied.append("exclude archived tasks (null or false)")
            else:
                filters_applied.append("include all tasks (including archived)")

            logger.debug(f"Listing tasks with filters: {', '.join(filters_applied)}")

            # Execute query and get raw response
            response = (
                query.order("task_order", desc=False).order("created_at", desc=False).execute()
            )

            # Debug: Log task workflow stage distribution
            if response.data:
                stage_counts = {}
                archived_counts = {"null": 0, "true": 0, "false": 0}

                for task in response.data:
                    workflow_stage = task.get("workflow_stage")
                    if workflow_stage:
                        stage_name = workflow_stage.get("name", "unknown")
                        stage_counts[stage_name] = stage_counts.get(stage_name, 0) + 1

                    # Check archived field
                    archived_value = task.get("archived")
                    if archived_value is None:
                        archived_counts["null"] += 1
                    elif archived_value is True:
                        archived_counts["true"] += 1
                    else:
                        archived_counts["false"] += 1

                logger.debug(
                    f"Retrieved {len(response.data)} tasks. Stage distribution: {stage_counts}"
                )
                logger.debug(f"Archived field distribution: {archived_counts}")
            else:
                logger.debug("No tasks found with current filters")

            tasks = []
            for task in response.data:
                workflow_stage = task.get("workflow_stage", {})

                task_data = {
                    "id": task["id"],
                    "project_id": task["project_id"],
                    "title": task["title"],
                    "description": task["description"],
                    "workflow_stage_id": task["workflow_stage_id"],
                    "workflow_stage": workflow_stage,  # Include stage details
                    "status": workflow_stage.get("name", "").lower().replace(" ", "_") if workflow_stage else "backlog",  # Legacy compatibility
                    "assignee": task.get("assignee", "User"),
                    "task_order": task.get("task_order", 0),
                    "priority": task.get("priority", "medium"),
                    "feature": task.get("feature"),
                    "created_at": task["created_at"],
                    "updated_at": task["updated_at"],
                    "archived": task.get("archived", False),
                }

                if not exclude_large_fields:
                    # Include full JSONB fields
                    task_data["sources"] = task.get("sources", [])
                    task_data["code_examples"] = task.get("code_examples", [])
                else:
                    # Add counts instead of full content
                    task_data["stats"] = {
                        "sources_count": len(task.get("sources", [])),
                        "code_examples_count": len(task.get("code_examples", []))
                    }

                tasks.append(task_data)

            filter_info = []
            if project_id:
                filter_info.append(f"project_id={project_id}")
            if workflow_stage_id:
                filter_info.append(f"workflow_stage_id={workflow_stage_id}")
            elif status:
                filter_info.append(f"status={status}")
            if not include_closed:
                filter_info.append("excluding closed tasks")

            return True, {
                "tasks": tasks,
                "total_count": len(tasks),
                "filters_applied": ", ".join(filter_info) if filter_info else "none",
                "include_closed": include_closed,
            }

        except Exception as e:
            logger.error(f"Error listing tasks: {e}")
            return False, {"error": f"Error listing tasks: {str(e)}"}

    def get_task(self, task_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get a specific task by ID with workflow stage information.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            response = (
                self.supabase_client.table("archon_tasks")
                .select("*, workflow_stage:archon_workflow_stages!archon_tasks_workflow_stage_id_fkey(id, name, stage_order, workflow_id)")
                .eq("id", task_id)
                .execute()
            )

            if response.data:
                task = response.data[0]
                # Add legacy status field for backward compatibility
                workflow_stage = task.get("workflow_stage", {})
                if workflow_stage:
                    task["status"] = workflow_stage.get("name", "").lower().replace(" ", "_")
                return True, {"task": task}
            else:
                return False, {"error": f"Task with ID {task_id} not found"}

        except Exception as e:
            logger.error(f"Error getting task: {e}")
            return False, {"error": f"Error getting task: {str(e)}"}

    async def update_task(
        self, task_id: str, update_fields: dict[str, Any]
    ) -> tuple[bool, dict[str, Any]]:
        """
        Update task with specified fields.

        Args:
            task_id: UUID of task to update
            update_fields: Dict of fields to update. Supports both status (legacy) and workflow_stage_id (new).

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Build update data
            update_data = {"updated_at": datetime.now().isoformat()}

            # Validate and add fields
            if "title" in update_fields:
                update_data["title"] = update_fields["title"]

            if "description" in update_fields:
                update_data["description"] = update_fields["description"]

            # Support both status (legacy) and workflow_stage_id (new)
            if "workflow_stage_id" in update_fields:
                stage_id = update_fields["workflow_stage_id"]
                is_valid, error_msg = self.validate_workflow_stage(stage_id)
                if not is_valid:
                    return False, {"error": error_msg}
                update_data["workflow_stage_id"] = stage_id
            elif "status" in update_fields:
                # Map legacy status to workflow stage
                stage_id = self.get_stage_id_by_name(update_fields["status"])
                if not stage_id:
                    return False, {"error": f"Invalid status '{update_fields['status']}'. Must be one of: backlog, in_progress, review, done"}
                update_data["workflow_stage_id"] = stage_id

            if "assignee" in update_fields:
                is_valid, error_msg = self.validate_assignee(update_fields["assignee"])
                if not is_valid:
                    return False, {"error": error_msg}
                update_data["assignee"] = update_fields["assignee"]

            if "priority" in update_fields:
                is_valid, error_msg = self.validate_priority(update_fields["priority"])
                if not is_valid:
                    return False, {"error": error_msg}
                update_data["priority"] = update_fields["priority"]

            if "task_order" in update_fields:
                update_data["task_order"] = update_fields["task_order"]

            if "feature" in update_fields:
                update_data["feature"] = update_fields["feature"]

            # Update task and return with workflow stage info
            response = (
                self.supabase_client.table("archon_tasks")
                .update(update_data)
                .eq("id", task_id)
                .execute()
            )

            if response.data:
                task = response.data[0]
                # Fetch full task with workflow stage info
                success, result = self.get_task(task_id)
                if success:
                    return True, {"task": result["task"], "message": "Task updated successfully"}
                else:
                    # Fallback to basic response
                    return True, {"task": task, "message": "Task updated successfully"}
            else:
                return False, {"error": f"Task with ID {task_id} not found"}

        except Exception as e:
            logger.error(f"Error updating task: {e}")
            return False, {"error": f"Error updating task: {str(e)}"}

    async def archive_task(
        self, task_id: str, archived_by: str = "mcp"
    ) -> tuple[bool, dict[str, Any]]:
        """
        Archive a task and all its subtasks (soft delete).

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # First, check if task exists and is not already archived
            task_response = (
                self.supabase_client.table("archon_tasks").select("*").eq("id", task_id).execute()
            )
            if not task_response.data:
                return False, {"error": f"Task with ID {task_id} not found"}

            task = task_response.data[0]
            if task.get("archived") is True:
                return False, {"error": f"Task with ID {task_id} is already archived"}

            # Archive the task
            archive_data = {
                "archived": True,
                "archived_at": datetime.now().isoformat(),
                "archived_by": archived_by,
                "updated_at": datetime.now().isoformat(),
            }

            # Archive the main task
            response = (
                self.supabase_client.table("archon_tasks")
                .update(archive_data)
                .eq("id", task_id)
                .execute()
            )

            if response.data:

                return True, {"task_id": task_id, "message": "Task archived successfully"}
            else:
                return False, {"error": f"Failed to archive task {task_id}"}

        except Exception as e:
            logger.error(f"Error archiving task: {e}")
            return False, {"error": f"Error archiving task: {str(e)}"}


    async def unarchive_task(
        self, task_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Unarchive a task (restore from soft delete).

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # First, check if task exists and is archived
            task_response = (
                self.supabase_client.table("archon_tasks").select("*").eq("id", task_id).execute()
            )
            if not task_response.data:
                return False, {"error": f"Task with ID {task_id} not found"}

            task = task_response.data[0]
            if task.get("archived") is not True:
                return False, {"error": f"Task with ID {task_id} is not archived"}

            # Unarchive the task
            unarchive_data = {
                "archived": False,
                "archived_at": None,
                "archived_by": None,
                "updated_at": datetime.now().isoformat(),
            }

            # Unarchive the main task
            response = (
                self.supabase_client.table("archon_tasks")
                .update(unarchive_data)
                .eq("id", task_id)
                .execute()
            )

            if response.data:
                return True, {"task_id": task_id, "message": "Task unarchived successfully"}
            else:
                return False, {"error": f"Failed to unarchive task {task_id}"}

        except Exception as e:
            logger.error(f"Error unarchiving task: {e}")
            return False, {"error": f"Error unarchiving task: {str(e)}"}

    def create_task_version(
        self,
        task_id: str,
        field_name: str,
        content: Any,
        change_summary: str = None,
        created_by: str = "system",
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a version snapshot for a task field (title, description, sources, code_examples).

        This is used to track significant changes to task content over time,
        separate from the granular history tracking in archon_task_history.

        Args:
            task_id: UUID of the task
            field_name: Name of the field being versioned
            content: Content to snapshot (will be stored as JSONB)
            change_summary: Optional description of what changed
            created_by: Who created this version (default: "system")

        Returns:
            Tuple of (success, result_dict with version_number)
        """
        try:
            # Get current highest version number for this task/field
            existing_versions = (
                self.supabase_client.table("archon_document_versions")
                .select("version_number")
                .eq("task_id", task_id)
                .eq("field_name", field_name)
                .order("version_number", desc=True)
                .limit(1)
                .execute()
            )

            next_version = 1
            if existing_versions.data:
                next_version = existing_versions.data[0]["version_number"] + 1

            # Create version record
            version_data = {
                "task_id": task_id,
                "field_name": field_name,
                "version_number": next_version,
                "content": content if isinstance(content, dict) else {"value": content},
                "change_summary": change_summary,
                "change_type": "update",
                "created_by": created_by,
            }

            response = (
                self.supabase_client.table("archon_document_versions")
                .insert(version_data)
                .execute()
            )

            if response.data:
                logger.info(
                    f"Created task version | task_id={task_id} | field={field_name} | version={next_version}"
                )
                return True, {
                    "version_number": next_version,
                    "task_id": task_id,
                    "field_name": field_name,
                    "created_at": response.data[0].get("created_at"),
                }
            else:
                return False, {"error": "Failed to create task version"}

        except Exception as e:
            logger.error(f"Error creating task version: {e}")
            return False, {"error": str(e)}

    def get_task_versions(
        self,
        task_id: str,
        field_name: str = None,
        limit: int = 10,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get version history for a task.

        Args:
            task_id: UUID of the task
            field_name: Optional filter for specific field
            limit: Maximum number of versions to return (default: 10)

        Returns:
            Tuple of (success, result_dict with versions list)
        """
        try:
            query = (
                self.supabase_client.table("archon_document_versions")
                .select("*")
                .eq("task_id", task_id)
                .order("created_at", desc=True)
                .limit(limit)
            )

            if field_name:
                query = query.eq("field_name", field_name)

            response = query.execute()

            versions = response.data if response.data else []

            return True, {
                "task_id": task_id,
                "versions": versions,
                "count": len(versions),
                "field_filter": field_name,
            }

        except Exception as e:
            logger.error(f"Error getting task versions: {e}")
            return False, {"error": str(e)}

    async def snapshot_task_significant_changes(
        self,
        task_id: str,
        old_task: dict[str, Any],
        new_task: dict[str, Any],
        changed_by: str = "system",
    ) -> tuple[bool, dict[str, Any]]:
        """
        Automatically create version snapshots for significant task changes.

        This should be called during task updates to capture important content changes.
        Not every field update triggers a version - only significant content fields.

        Versioned fields:
        - title: When changed
        - description: When changed significantly (>100 char diff)
        - sources: When modified
        - code_examples: When modified

        Args:
            task_id: UUID of the task
            old_task: Previous task state
            new_task: New task state
            changed_by: Who made the change

        Returns:
            Tuple of (success, result_dict with versions_created count)
        """
        try:
            versions_created = []

            # Check title changes
            if old_task.get("title") != new_task.get("title"):
                success, result = self.create_task_version(
                    task_id=task_id,
                    field_name="title",
                    content={"value": new_task.get("title")},
                    change_summary=f"Title changed from '{old_task.get('title')}' to '{new_task.get('title')}'",
                    created_by=changed_by,
                )
                if success:
                    versions_created.append("title")

            # Check description changes (only if significantly different)
            old_desc = old_task.get("description", "")
            new_desc = new_task.get("description", "")
            if old_desc != new_desc and abs(len(old_desc) - len(new_desc)) > 100:
                success, result = self.create_task_version(
                    task_id=task_id,
                    field_name="description",
                    content={"value": new_desc},
                    change_summary=f"Description updated ({len(new_desc)} chars)",
                    created_by=changed_by,
                )
                if success:
                    versions_created.append("description")

            # Check sources changes
            if old_task.get("sources") != new_task.get("sources"):
                success, result = self.create_task_version(
                    task_id=task_id,
                    field_name="sources",
                    content=new_task.get("sources", []),
                    change_summary="Sources updated",
                    created_by=changed_by,
                )
                if success:
                    versions_created.append("sources")

            # Check code_examples changes
            if old_task.get("code_examples") != new_task.get("code_examples"):
                success, result = self.create_task_version(
                    task_id=task_id,
                    field_name="code_examples",
                    content=new_task.get("code_examples", []),
                    change_summary="Code examples updated",
                    created_by=changed_by,
                )
                if success:
                    versions_created.append("code_examples")

            return True, {
                "task_id": task_id,
                "versions_created": versions_created,
                "count": len(versions_created),
            }

        except Exception as e:
            logger.error(f"Error snapshotting task changes: {e}")
            return False, {"error": str(e)}
    def get_all_project_task_counts(self) -> tuple[bool, dict[str, dict[str, int]]]:
        """
        Get task counts for all projects in a single optimized query.

        Returns task counts grouped by project_id and status (mapped from workflow stages).

        Returns:
            Tuple of (success, counts_dict) where counts_dict is:
            {"project-id": {"todo": 5, "doing": 2, "review": 3, "done": 10}}
        """
        try:
            logger.debug("Fetching task counts for all projects in batch")

            # Query all non-archived tasks with workflow stage information
            # Join with workflow stages to get stage name and properties
            response = (
                self.supabase_client.table("archon_tasks")
                .select("project_id, workflow_stage_id, archon_workflow_stages(name, is_initial, is_final, stage_order)")
                .or_("archived.is.null,archived.is.false")
                .execute()
            )

            if not response.data:
                logger.debug("No tasks found")
                return True, {}

            # Process results into counts by project and status
            counts_by_project = {}

            for task in response.data:
                project_id = task.get("project_id")
                stage_data = task.get("archon_workflow_stages")

                if not project_id or not stage_data:
                    continue

                # Map workflow stage to legacy status
                stage_name = stage_data.get("name", "").lower()
                is_initial = stage_data.get("is_initial", False)
                is_final = stage_data.get("is_final", False)
                stage_order = stage_data.get("stage_order", 0)

                # Determine legacy status based on stage properties and name
                if is_initial or stage_name in ["backlog", "planning", "literature review", "reported"]:
                    status = "todo"
                elif is_final or stage_name in ["done", "completed", "published", "resolved"]:
                    status = "done"
                elif "review" in stage_name or "testing" in stage_name:
                    status = "review"
                else:
                    # Middle stages default to "doing"
                    status = "doing"

                # Initialize project counts if not exists
                if project_id not in counts_by_project:
                    counts_by_project[project_id] = {
                        "todo": 0,
                        "doing": 0,
                        "review": 0,
                        "done": 0
                    }

                # Increment count for the mapped status
                counts_by_project[project_id][status] += 1

            logger.debug(f"Task counts fetched for {len(counts_by_project)} projects")

            return True, counts_by_project

        except Exception as e:
            logger.error(f"Error fetching task counts: {e}")
            return False, {"error": f"Error fetching task counts: {str(e)}"}

    def get_task_history(
        self,
        task_id: str,
        field_name: str | None = None,
        limit: int = 50
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get change history for a specific task from archon_task_history table.

        Calls the PostgreSQL function get_task_history() which returns all changes
        for the task, optionally filtered by field name, ordered by changed_at DESC.

        Args:
            task_id: UUID of the task
            field_name: Optional filter for specific field (e.g., "status", "assignee")
            limit: Maximum number of changes to return (default: 50)

        Returns:
            Tuple of (success, result_dict with changes array)
        """
        try:
            # Call the database function via RPC
            response = self.supabase_client.rpc(
                "get_task_history",
                {
                    "task_id_param": task_id,
                    "field_name_param": field_name,
                    "limit_param": limit
                }
            ).execute()

            if response.data is None:
                logger.warning(f"No history found for task {task_id}")
                return True, {"changes": [], "count": 0}

            changes = response.data if isinstance(response.data, list) else []

            logger.info(f"Retrieved {len(changes)} history records for task {task_id}")

            return True, {
                "task_id": task_id,
                "changes": changes,
                "count": len(changes),
                "field_filter": field_name
            }

        except Exception as e:
            logger.error(f"Error getting task history for {task_id}: {e}")
            return False, {"error": f"Error getting task history: {str(e)}"}

    def get_completion_stats(
        self,
        project_id: str | None = None,
        days: int = 7,
        limit: int = 50
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get task completion statistics and recently completed tasks.

        Calls PostgreSQL functions:
        - get_project_completion_stats() for aggregate metrics
        - get_recently_completed_tasks() for task list

        Args:
            project_id: Optional UUID to filter by project
            days: Number of days to look back (default: 7)
            limit: Maximum number of recently completed tasks (default: 50)

        Returns:
            Tuple of (success, result_dict with stats and recently_completed)
        """
        try:
            # Get aggregate stats if project_id provided
            stats = {}
            if project_id:
                stats_response = self.supabase_client.rpc(
                    "get_project_completion_stats",
                    {"project_id_param": project_id}
                ).execute()

                if stats_response.data:
                    stats = stats_response.data if isinstance(stats_response.data, dict) else {}

            # Get recently completed tasks
            recently_response = self.supabase_client.rpc(
                "get_recently_completed_tasks",
                {
                    "days_param": days,
                    "project_id_param": project_id,
                    "limit_param": limit
                }
            ).execute()

            recently_completed = recently_response.data if isinstance(recently_response.data, list) else []

            logger.info(f"Retrieved completion stats: {len(recently_completed)} tasks in last {days} days")

            return True, {
                "project_id": project_id,
                "days_range": days,
                "stats": stats,
                "recently_completed": recently_completed,
                "count": len(recently_completed)
            }

        except Exception as e:
            logger.error(f"Error getting completion stats: {e}")
            return False, {"error": f"Error getting completion stats: {str(e)}"}

    def purge_old_task_history(
        self,
        retention_days: int = 365,
        keep_archived: bool = True,
        dry_run: bool = False
    ) -> tuple[bool, dict[str, Any]]:
        """
        Purge old task history records based on retention policy.

        This calls the PostgreSQL function purge_old_task_history() which:
        - Deletes history older than retention_days
        - Preserves history for archived tasks (if keep_archived=true)
        - Preserves significant events (status→done, archived→true)

        Args:
            retention_days: Number of days to retain history (default: 365)
            keep_archived: Keep history for archived tasks indefinitely (default: true)
            dry_run: Preview mode - count what would be deleted without deleting (default: false)

        Returns:
            Tuple of (success, result_dict with deleted_count, oldest_deleted, newest_deleted)

        Example:
            # Dry run to preview what would be deleted
            success, result = task_service.purge_old_task_history(retention_days=365, dry_run=True)
            print(f"Would delete {result['deleted_count']} records")

            # Actually purge with 180-day retention
            success, result = task_service.purge_old_task_history(retention_days=180, dry_run=False)
        """
        try:
            logger.info(
                f"Purging task history | retention_days={retention_days} | "
                f"keep_archived={keep_archived} | dry_run={dry_run}"
            )

            # Call PostgreSQL function via Supabase RPC
            response = self.supabase_client.rpc(
                "purge_old_task_history",
                {
                    "retention_days": retention_days,
                    "keep_archived": keep_archived,
                    "dry_run": dry_run
                }
            ).execute()

            if not response.data:
                logger.warning("Purge function returned no data")
                return True, {
                    "deleted_count": 0,
                    "oldest_deleted": None,
                    "newest_deleted": None,
                    "retention_days": retention_days,
                    "keep_archived": keep_archived,
                    "dry_run": dry_run
                }

            # PostgreSQL function returns array with single row
            stats = response.data[0] if isinstance(response.data, list) else response.data

            deleted_count = stats.get("deleted_count", 0)
            oldest_deleted = stats.get("oldest_deleted")
            newest_deleted = stats.get("newest_deleted")

            log_msg = f"Task history purge {'preview' if dry_run else 'completed'} | deleted_count={deleted_count}"
            if deleted_count > 0:
                log_msg += f" | date_range={oldest_deleted} to {newest_deleted}"

            if dry_run:
                logger.info(log_msg)
            else:
                logger.warning(log_msg)  # Use warning level for actual deletions

            return True, {
                "deleted_count": deleted_count,
                "oldest_deleted": oldest_deleted,
                "newest_deleted": newest_deleted,
                "retention_days": retention_days,
                "keep_archived": keep_archived,
                "dry_run": dry_run,
                "message": f"{'Would delete' if dry_run else 'Deleted'} {deleted_count} task history records"
            }

        except Exception as e:
            logger.error(f"Error purging task history: {e}", exc_info=True)
            return False, {"error": f"Error purging task history: {str(e)}"}
