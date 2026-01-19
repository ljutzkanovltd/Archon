"""
Project Service Module for Archon

This module provides core business logic for project operations that can be
shared between MCP tools and FastAPI endpoints. It follows the pattern of
separating business logic from transport-specific code.
"""

# Removed direct logging import - using unified config
from datetime import datetime
from typing import Any

from src.server.utils import get_supabase_client

from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class ProjectService:
    """Service class for project operations"""

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    def create_project(self, title: str, github_repo: str = None) -> tuple[bool, dict[str, Any]]:
        """
        Create a new project with optional PRD and GitHub repo.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate inputs
            if not title or not isinstance(title, str) or len(title.strip()) == 0:
                return False, {"error": "Project title is required and must be a non-empty string"}

            # Create project data
            project_data = {
                "title": title.strip(),
                "docs": [],  # Will add PRD document after creation
                "features": [],
                "data": [],
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            if github_repo and isinstance(github_repo, str) and len(github_repo.strip()) > 0:
                project_data["github_repo"] = github_repo.strip()

            # Insert project
            response = self.supabase_client.table("archon_projects").insert(project_data).execute()

            if not response.data:
                logger.error("Supabase returned empty data for project creation")
                return False, {"error": "Failed to create project - database returned no data"}

            project = response.data[0]
            project_id = project["id"]
            logger.info(f"Project created successfully with ID: {project_id}")

            return True, {
                "project": {
                    "id": project_id,
                    "title": project["title"],
                    "github_repo": project.get("github_repo"),
                    "created_at": project["created_at"],
                }
            }

        except Exception as e:
            logger.error(f"Error creating project: {e}")
            return False, {"error": f"Database error: {str(e)}"}

    async def list_projects(self, include_content: bool = True, include_archived: bool = False, user_id: str = None) -> tuple[bool, dict[str, Any]]:
        """
        List all projects, optionally filtered by user access.

        Args:
            include_content: If True (default), includes docs, features, data fields.
                           If False, returns lightweight metadata only with counts.
            include_archived: If True, includes archived projects. Default: False (only active projects)
            user_id: If provided, filters projects by user access. Admins see all projects.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Import here to avoid circular dependency
            from ..user_access_service import UserAccessService
            from uuid import UUID

            # Check if user access filtering should be applied
            accessible_project_ids = None
            if user_id:
                access_service = UserAccessService()

                # Check if user is admin
                success, is_admin = await access_service.is_user_admin(UUID(user_id))
                if success and is_admin:
                    logger.debug(f"list_projects: user_id={user_id} is admin, showing all projects")
                    # Admins see all projects - no filtering needed
                else:
                    # Get accessible project IDs for non-admin users
                    success, result = await access_service.get_user_accessible_project_ids(UUID(user_id))
                    if success:
                        accessible_project_ids = result
                        logger.debug(f"list_projects: user_id={user_id} has access to {len(accessible_project_ids)} projects")
                    else:
                        logger.error(f"list_projects: Failed to get accessible projects for user_id={user_id}: {result}")
                        # On error, show no projects (safe default)
                        accessible_project_ids = []

            if include_content:
                # Current behavior - maintain backward compatibility
                logger.debug(f"list_projects: include_content=True, include_archived={include_archived}, user_id={user_id}")
                query = self.supabase_client.table("archon_projects").select("*")

                # Filter archived projects by default
                if not include_archived:
                    query = query.eq("archived", False)

                response = query.order("created_at", desc=True).execute()
                logger.debug(f"list_projects: Fetched {len(response.data)} projects from database")

                # Apply user access filtering if needed
                if accessible_project_ids is not None:
                    response.data = [p for p in response.data if p["id"] in accessible_project_ids]
                    logger.debug(f"list_projects: After access filter, {len(response.data)} projects remain")

                # Batch fetch task counts for all projects (efficient single query)
                task_counts = self._get_task_counts_batch([p["id"] for p in response.data])
                logger.debug(f"list_projects: Got task_counts: {len(task_counts)} projects")

                # Batch fetch document counts for all projects (efficient single query)
                document_counts = self._get_document_counts_batch([p["id"] for p in response.data])

                projects = []
                for project in response.data:
                    project_id = project["id"]
                    projects.append({
                        "id": project_id,
                        "title": project["title"],
                        "github_repo": project.get("github_repo"),
                        "created_at": project["created_at"],
                        "updated_at": project["updated_at"],
                        "pinned": project.get("pinned", False),
                        "description": project.get("description", ""),
                        "docs": project.get("docs", []),
                        "features": project.get("features", []),
                        "data": project.get("data", []),
                        "archived": project.get("archived", False),
                        "archived_at": project.get("archived_at"),
                        "archived_by": project.get("archived_by"),
                        "task_count": task_counts.get(project_id, 0),
                        "document_count": document_counts.get(project_id, 0),
                    })
            else:
                # Lightweight response for MCP - fetch all data but only return metadata + stats
                # FIXED: N+1 query problem - now using single query
                logger.debug(f"list_projects: include_content=False, include_archived={include_archived}, user_id={user_id}")
                query = self.supabase_client.table("archon_projects").select("*")

                # Filter archived projects by default
                if not include_archived:
                    query = query.eq("archived", False)

                response = query.order("created_at", desc=True).execute()

                # Apply user access filtering if needed
                if accessible_project_ids is not None:
                    response.data = [p for p in response.data if p["id"] in accessible_project_ids]
                    logger.debug(f"list_projects: After access filter (lightweight), {len(response.data)} projects remain")

                # Batch fetch task counts for all projects (efficient single query)
                task_counts = self._get_task_counts_batch([p["id"] for p in response.data])

                # Batch fetch document counts for all projects (efficient single query)
                document_counts = self._get_document_counts_batch([p["id"] for p in response.data])

                projects = []
                for project in response.data:
                    project_id = project["id"]
                    # Calculate counts from fetched data (no additional queries)
                    docs_count = len(project.get("docs", []))
                    features_count = len(project.get("features", []))
                    has_data = bool(project.get("data", []))

                    # Return only metadata + stats, excluding large JSONB fields
                    projects.append({
                        "id": project_id,
                        "title": project["title"],
                        "github_repo": project.get("github_repo"),
                        "created_at": project["created_at"],
                        "updated_at": project["updated_at"],
                        "pinned": project.get("pinned", False),
                        "description": project.get("description", ""),
                        "archived": project.get("archived", False),
                        "archived_at": project.get("archived_at"),
                        "archived_by": project.get("archived_by"),
                        "task_count": task_counts.get(project_id, 0),
                        "document_count": document_counts.get(project_id, 0),
                        "stats": {
                            "docs_count": docs_count,
                            "features_count": features_count,
                            "has_data": has_data
                        }
                    })

            return True, {"projects": projects, "total_count": len(projects)}

        except Exception as e:
            logger.error(f"Error listing projects: {e}")
            return False, {"error": f"Error listing projects: {str(e)}"}

    def _get_task_counts_batch(self, project_ids: list[str]) -> dict[str, int]:
        """
        Batch fetch task counts for multiple projects (efficient single query).
        Only counts non-archived tasks.

        Args:
            project_ids: List of project UUIDs

        Returns:
            Dictionary mapping project_id -> task_count
        """
        if not project_ids:
            logger.debug("_get_task_counts_batch: No project IDs provided")
            return {}

        try:
            logger.debug(f"_get_task_counts_batch: Fetching task counts for {len(project_ids)} projects")

            # Query all non-archived tasks for given projects
            response = (
                self.supabase_client.table("archon_tasks")
                .select("project_id")
                .in_("project_id", project_ids)
                .or_("archived.is.null,archived.eq.false")
                .execute()
            )

            logger.debug(f"_get_task_counts_batch: Got {len(response.data) if response.data else 0} tasks")

            # Count tasks per project
            counts = {}
            for task in response.data:
                project_id = task["project_id"]
                counts[project_id] = counts.get(project_id, 0) + 1

            logger.debug(f"_get_task_counts_batch: Counted tasks for {len(counts)} projects")
            return counts

        except Exception as e:
            logger.error(f"Error fetching task counts: {e}")
            return {}

    def _get_document_counts_batch(self, project_ids: list[str]) -> dict[str, int]:
        """
        Batch fetch document counts for multiple projects (efficient single query).
        Counts document versions in archon_document_versions table.

        Args:
            project_ids: List of project UUIDs

        Returns:
            Dictionary mapping project_id -> document_count
        """
        if not project_ids:
            logger.debug("_get_document_counts_batch: No project IDs provided")
            return {}

        try:
            logger.debug(f"_get_document_counts_batch: Fetching document counts for {len(project_ids)} projects")

            # Query all document versions for given projects
            response = (
                self.supabase_client.table("archon_document_versions")
                .select("project_id")
                .in_("project_id", project_ids)
                .execute()
            )

            logger.debug(f"_get_document_counts_batch: Got {len(response.data) if response.data else 0} documents")

            # Count documents per project
            counts = {}
            for doc in response.data:
                project_id = doc["project_id"]
                counts[project_id] = counts.get(project_id, 0) + 1

            logger.debug(f"_get_document_counts_batch: Counted documents for {len(counts)} projects")
            return counts

        except Exception as e:
            logger.error(f"Error fetching document counts: {e}")
            return {}

    def get_project(self, project_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get a specific project by ID.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            response = (
                self.supabase_client.table("archon_projects")
                .select("*")
                .eq("id", project_id)
                .execute()
            )

            if response.data:
                project = response.data[0]

                # Get linked sources
                technical_sources = []
                business_sources = []

                try:
                    # Get source IDs from project_sources table
                    sources_response = (
                        self.supabase_client.table("archon_project_sources")
                        .select("source_id, notes")
                        .eq("project_id", project["id"])
                        .execute()
                    )

                    # Collect source IDs by type
                    technical_source_ids = []
                    business_source_ids = []

                    for source_link in sources_response.data:
                        if source_link.get("notes") == "technical":
                            technical_source_ids.append(source_link["source_id"])
                        elif source_link.get("notes") == "business":
                            business_source_ids.append(source_link["source_id"])

                    # Fetch full source objects
                    if technical_source_ids:
                        tech_sources_response = (
                            self.supabase_client.table("archon_sources")
                            .select("*")
                            .in_("source_id", technical_source_ids)
                            .execute()
                        )
                        technical_sources = tech_sources_response.data

                    if business_source_ids:
                        biz_sources_response = (
                            self.supabase_client.table("archon_sources")
                            .select("*")
                            .in_("source_id", business_source_ids)
                            .execute()
                        )
                        business_sources = biz_sources_response.data

                except Exception as e:
                    logger.warning(
                        f"Failed to retrieve linked sources for project {project['id']}: {e}"
                    )

                # Add sources to project data
                project["technical_sources"] = technical_sources
                project["business_sources"] = business_sources

                return True, {"project": project}
            else:
                return False, {"error": f"Project with ID {project_id} not found"}

        except Exception as e:
            logger.error(f"Error getting project: {e}")
            return False, {"error": f"Error getting project: {str(e)}"}

    def delete_project(self, project_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Delete a project and all its associated tasks.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # First, check if project exists
            check_response = (
                self.supabase_client.table("archon_projects")
                .select("id")
                .eq("id", project_id)
                .execute()
            )
            if not check_response.data:
                return False, {"error": f"Project with ID {project_id} not found"}

            # Get task count for reporting
            tasks_response = (
                self.supabase_client.table("archon_tasks")
                .select("id")
                .eq("project_id", project_id)
                .execute()
            )
            tasks_count = len(tasks_response.data) if tasks_response.data else 0

            # Delete the project (tasks will be deleted by cascade)
            response = (
                self.supabase_client.table("archon_projects")
                .delete()
                .eq("id", project_id)
                .execute()
            )

            # For DELETE operations, success is indicated by no error, not by response.data content
            # response.data will be empty list [] even on successful deletion
            return True, {
                "project_id": project_id,
                "deleted_tasks": tasks_count,
                "message": "Project deleted successfully",
            }

        except Exception as e:
            logger.error(f"Error deleting project: {e}")
            return False, {"error": f"Error deleting project: {str(e)}"}

    def get_project_features(self, project_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get features from a project's features JSONB field.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            response = (
                self.supabase_client.table("archon_projects")
                .select("features")
                .eq("id", project_id)
                .single()
                .execute()
            )

            if not response.data:
                return False, {"error": "Project not found"}

            features = response.data.get("features", [])

            # Extract feature labels for dropdown options
            feature_options = []
            for feature in features:
                if isinstance(feature, dict) and "data" in feature and "label" in feature["data"]:
                    feature_options.append({
                        "id": feature.get("id", ""),
                        "label": feature["data"]["label"],
                        "type": feature["data"].get("type", ""),
                        "feature_type": feature.get("type", "page"),
                    })

            return True, {"features": feature_options, "count": len(feature_options)}

        except Exception as e:
            # Check if it's a "no rows found" error from PostgREST
            error_message = str(e)
            if "The result contains 0 rows" in error_message or "PGRST116" in error_message:
                return False, {"error": "Project not found"}

            logger.error(f"Error getting project features: {e}")
            return False, {"error": f"Error getting project features: {str(e)}"}

    def update_project(
        self, project_id: str, update_fields: dict[str, Any]
    ) -> tuple[bool, dict[str, Any]]:
        """
        Update a project with specified fields.

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Build update data
            update_data = {"updated_at": datetime.now().isoformat()}

            # Add allowed fields
            allowed_fields = [
                "title",
                "description",
                "github_repo",
                "docs",
                "features",
                "data",
                "technical_sources",
                "business_sources",
                "pinned",
            ]

            for field in allowed_fields:
                if field in update_fields:
                    update_data[field] = update_fields[field]

            # Handle workflow_id separately with validation
            if "workflow_id" in update_fields:
                workflow_id = update_fields["workflow_id"]
                if workflow_id:  # Allow null to remove workflow
                    # Validate workflow exists
                    workflow_check = (
                        self.supabase_client.table("archon_workflows")
                        .select("id")
                        .eq("id", workflow_id)
                        .execute()
                    )
                    if not workflow_check.data:
                        return False, {"error": f"Workflow with ID {workflow_id} not found"}
                update_data["workflow_id"] = workflow_id

            # Handle pinning logic - only one project can be pinned at a time
            if update_fields.get("pinned") is True:
                # Unpin any other pinned projects first
                unpin_response = (
                    self.supabase_client.table("archon_projects")
                    .update({"pinned": False})
                    .neq("id", project_id)
                    .eq("pinned", True)
                    .execute()
                )
                logger.debug(f"Unpinned {len(unpin_response.data or [])} other projects before pinning {project_id}")

            # Update the target project
            response = (
                self.supabase_client.table("archon_projects")
                .update(update_data)
                .eq("id", project_id)
                .execute()
            )

            if response.data and len(response.data) > 0:
                project = response.data[0]
                return True, {"project": project, "message": "Project updated successfully"}
            else:
                # If update didn't return data, fetch the project to ensure it exists and get current state
                get_response = (
                    self.supabase_client.table("archon_projects")
                    .select("*")
                    .eq("id", project_id)
                    .execute()
                )
                if get_response.data and len(get_response.data) > 0:
                    project = get_response.data[0]
                    return True, {"project": project, "message": "Project updated successfully"}
                else:
                    return False, {"error": f"Project with ID {project_id} not found"}

        except Exception as e:
            logger.error(f"Error updating project: {e}")
            return False, {"error": f"Error updating project: {str(e)}"}

    def change_project_workflow(
        self, project_id: str, new_workflow_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Change a project's workflow and reassign tasks to compatible stages.

        This method:
        1. Validates the new workflow exists
        2. Gets current project workflow (if any)
        3. Maps current task stages to new workflow stages by stage_order
        4. Updates project workflow_id
        5. Reassigns all tasks to new workflow stages

        Args:
            project_id: UUID of the project
            new_workflow_id: UUID of the new workflow

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # 1. Validate new workflow exists and get its stages
            new_workflow_response = (
                self.supabase_client.table("archon_workflows")
                .select("id, name, project_type_id")
                .eq("id", new_workflow_id)
                .execute()
            )
            if not new_workflow_response.data:
                return False, {"error": f"Workflow with ID {new_workflow_id} not found"}

            new_workflow = new_workflow_response.data[0]

            # Get new workflow stages
            new_stages_response = (
                self.supabase_client.table("archon_workflow_stages")
                .select("id, name, stage_order")
                .eq("workflow_id", new_workflow_id)
                .order("stage_order")
                .execute()
            )
            if not new_stages_response.data:
                return False, {"error": f"No stages found for workflow {new_workflow_id}"}

            new_stages = new_stages_response.data

            # 2. Get current project data
            project_response = (
                self.supabase_client.table("archon_projects")
                .select("id, title, workflow_id")
                .eq("id", project_id)
                .execute()
            )
            if not project_response.data:
                return False, {"error": f"Project with ID {project_id} not found"}

            project = project_response.data[0]
            old_workflow_id = project.get("workflow_id")

            # 3. Get current project tasks
            tasks_response = (
                self.supabase_client.table("archon_tasks")
                .select("id, workflow_stage_id, workflow_stage:archon_workflow_stages!archon_tasks_workflow_stage_id_fkey(id, stage_order)")
                .eq("project_id", project_id)
                .eq("archived", False)
                .execute()
            )

            tasks_to_reassign = tasks_response.data if tasks_response.data else []

            # 4. Create stage mapping (by stage_order)
            stage_mapping = {}
            for task in tasks_to_reassign:
                current_stage = task.get("workflow_stage")
                if current_stage and "stage_order" in current_stage:
                    current_order = current_stage["stage_order"]
                    # Find new stage with same order (or closest lower order)
                    matching_stage = None
                    for new_stage in new_stages:
                        if new_stage["stage_order"] == current_order:
                            matching_stage = new_stage
                            break

                    # Fallback: use stage at same index or last stage
                    if not matching_stage:
                        if current_order < len(new_stages):
                            matching_stage = new_stages[current_order]
                        else:
                            matching_stage = new_stages[-1]  # Last stage

                    stage_mapping[task["workflow_stage_id"]] = matching_stage["id"]

            # 5. Update project workflow_id
            update_project_response = (
                self.supabase_client.table("archon_projects")
                .update({"workflow_id": new_workflow_id, "updated_at": datetime.now().isoformat()})
                .eq("id", project_id)
                .execute()
            )

            if not update_project_response.data:
                return False, {"error": "Failed to update project workflow"}

            # 6. Reassign tasks to new workflow stages
            tasks_updated = 0
            for task in tasks_to_reassign:
                old_stage_id = task["workflow_stage_id"]
                new_stage_id = stage_mapping.get(old_stage_id)

                if new_stage_id and new_stage_id != old_stage_id:
                    self.supabase_client.table("archon_tasks").update({
                        "workflow_stage_id": new_stage_id,
                        "updated_at": datetime.now().isoformat()
                    }).eq("id", task["id"]).execute()
                    tasks_updated += 1

            return True, {
                "message": f"Workflow changed successfully. {tasks_updated} tasks reassigned.",
                "project": update_project_response.data[0],
                "workflow": new_workflow,
                "tasks_reassigned": tasks_updated,
                "old_workflow_id": old_workflow_id,
                "new_workflow_id": new_workflow_id
            }

        except Exception as e:
            logger.error(f"Error changing project workflow: {e}")
            return False, {"error": f"Error changing project workflow: {str(e)}"}

    def create_subproject(
        self, parent_project_id: str, title: str, description: str = None,
        relationship_type: str = "subproject", github_repo: str = None
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a subproject under a parent project.

        This method:
        1. Validates parent project exists
        2. Creates new child project
        3. Creates hierarchy relationship in archon_project_hierarchy
        4. Inherits workflow from parent (if parent has one)

        Args:
            parent_project_id: UUID of the parent project
            title: Title for the new subproject
            description: Optional description
            relationship_type: Type of relationship (subproject/program/portfolio)
            github_repo: Optional GitHub repository URL

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate parent project exists
            parent_response = (
                self.supabase_client.table("archon_projects")
                .select("id, title, workflow_id")
                .eq("id", parent_project_id)
                .execute()
            )

            if not parent_response.data:
                return False, {"error": f"Parent project {parent_project_id} not found"}

            parent_project = parent_response.data[0]

            # Create child project
            child_data = {
                "title": title,
                "description": description or "",
                "github_repo": github_repo,
                "workflow_id": parent_project.get("workflow_id"),  # Inherit workflow
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            child_response = (
                self.supabase_client.table("archon_projects")
                .insert(child_data)
                .execute()
            )

            if not child_response.data:
                return False, {"error": "Failed to create child project"}

            child_project = child_response.data[0]

            # Create hierarchy relationship
            hierarchy_data = {
                "parent_project_id": parent_project_id,
                "child_project_id": child_project["id"],
                "relationship_type": relationship_type,
                "created_at": datetime.now().isoformat(),
            }

            hierarchy_response = (
                self.supabase_client.table("archon_project_hierarchy")
                .insert(hierarchy_data)
                .execute()
            )

            if not hierarchy_response.data:
                # Rollback: delete child project
                self.supabase_client.table("archon_projects").delete().eq(
                    "id", child_project["id"]
                ).execute()
                return False, {"error": "Failed to create hierarchy relationship"}

            logger.info(
                f"Created subproject '{title}' under parent '{parent_project['title']}'"
            )

            return True, {
                "message": f"Subproject created successfully",
                "subproject": child_project,
                "parent_project_id": parent_project_id,
                "relationship_type": relationship_type,
            }

        except Exception as e:
            logger.error(f"Error creating subproject: {e}")
            return False, {"error": f"Error creating subproject: {str(e)}"}

    def get_project_hierarchy(self, project_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Get the complete hierarchy tree for a project (parents, siblings, children).

        Returns:
        - parent: Direct parent project (if any)
        - children: Direct child projects
        - ancestors: All ancestor projects (ordered from root to immediate parent)
        - siblings: Projects with same parent

        Args:
            project_id: UUID of the project

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Validate project exists
            project_response = (
                self.supabase_client.table("archon_projects")
                .select("id, title, description, hierarchy_path, workflow_id")
                .eq("id", project_id)
                .execute()
            )

            if not project_response.data:
                return False, {"error": f"Project {project_id} not found"}

            project = project_response.data[0]

            # Get parent (if any)
            parent_response = (
                self.supabase_client.table("archon_project_hierarchy")
                .select("parent_project_id, relationship_type, parent:archon_projects!parent_project_id(id, title, description, workflow_id)")
                .eq("child_project_id", project_id)
                .execute()
            )

            parent = None
            if parent_response.data and len(parent_response.data) > 0:
                parent_data = parent_response.data[0]
                parent = {
                    "id": parent_data["parent"]["id"],
                    "title": parent_data["parent"]["title"],
                    "description": parent_data["parent"]["description"],
                    "workflow_id": parent_data["parent"]["workflow_id"],
                    "relationship_type": parent_data["relationship_type"]
                }

            # Get children
            children_response = (
                self.supabase_client.table("archon_project_hierarchy")
                .select("child_project_id, relationship_type, child:archon_projects!child_project_id(id, title, description, workflow_id)")
                .eq("parent_project_id", project_id)
                .execute()
            )

            children = []
            if children_response.data:
                for child_data in children_response.data:
                    children.append({
                        "id": child_data["child"]["id"],
                        "title": child_data["child"]["title"],
                        "description": child_data["child"]["description"],
                        "workflow_id": child_data["child"]["workflow_id"],
                        "relationship_type": child_data["relationship_type"]
                    })

            # Get siblings (projects with same parent)
            siblings = []
            if parent:
                siblings_response = (
                    self.supabase_client.table("archon_project_hierarchy")
                    .select("child_project_id, relationship_type, child:archon_projects!child_project_id(id, title, description, workflow_id)")
                    .eq("parent_project_id", parent["id"])
                    .neq("child_project_id", project_id)
                    .execute()
                )

                if siblings_response.data:
                    for sibling_data in siblings_response.data:
                        siblings.append({
                            "id": sibling_data["child"]["id"],
                            "title": sibling_data["child"]["title"],
                            "description": sibling_data["child"]["description"],
                            "workflow_id": sibling_data["child"]["workflow_id"],
                            "relationship_type": sibling_data["relationship_type"]
                        })

            logger.info(
                f"Retrieved hierarchy for project '{project['title']}': "
                f"{len(children)} children, {len(siblings)} siblings, "
                f"{'has parent' if parent else 'no parent'}"
            )

            return True, {
                "project": {
                    "id": project["id"],
                    "title": project["title"],
                    "description": project["description"],
                    "workflow_id": project["workflow_id"]
                },
                "parent": parent,
                "children": children,
                "siblings": siblings,
                "children_count": len(children),
                "siblings_count": len(siblings)
            }

        except Exception as e:
            logger.error(f"Error getting project hierarchy: {e}")
            return False, {"error": f"Error getting project hierarchy: {str(e)}"}

    def archive_project(self, project_id: str, archived_by: str = "User") -> tuple[bool, dict[str, Any]]:
        """
        Archive a project and all its associated tasks.

        Calls the PostgreSQL function archive_project_and_tasks() which:
        - Sets archived=true, archived_at=NOW(), archived_by on the project
        - Cascades archival to all associated tasks
        - Returns count of tasks archived

        Args:
            project_id: UUID of the project to archive
            archived_by: Username/identifier of who is archiving (default: "User")

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Call the database function via RPC
            response = self.supabase_client.rpc(
                "archive_project_and_tasks",
                {"project_id_param": project_id, "archived_by_param": archived_by}
            ).execute()

            if not response.data:
                logger.error("Database function returned empty data for project archival")
                return False, {"error": "Failed to archive project - database returned no data"}

            result = response.data

            # Check if the function returned a success indicator
            if isinstance(result, dict) and result.get("success") is False:
                error_message = result.get("message", "Project not found or already archived")
                return False, {"error": error_message}

            logger.info(f"Project {project_id} archived successfully by {archived_by}")

            return True, {
                "project_id": project_id,
                "message": "Project archived successfully",
                "tasks_archived": result.get("tasks_archived", 0) if isinstance(result, dict) else 0,
                "archived_by": archived_by
            }

        except Exception as e:
            logger.error(f"Error archiving project {project_id}: {e}")
            return False, {"error": f"Error archiving project: {str(e)}"}

    def unarchive_project(self, project_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Unarchive a project and all its associated tasks.

        Calls the PostgreSQL function unarchive_project_and_tasks() which:
        - Sets archived=false, clears archived_at and archived_by on the project
        - Cascades unarchival to all associated tasks
        - Returns count of tasks unarchived

        Args:
            project_id: UUID of the project to unarchive

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Call the database function via RPC
            response = self.supabase_client.rpc(
                "unarchive_project_and_tasks",
                {"project_id_param": project_id}
            ).execute()

            if not response.data:
                logger.error("Database function returned empty data for project unarchival")
                return False, {"error": "Failed to unarchive project - database returned no data"}

            result = response.data

            # Check if the function returned a success indicator
            if isinstance(result, dict) and result.get("success") is False:
                error_message = result.get("message", "Project not found")
                return False, {"error": error_message}

            logger.info(f"Project {project_id} unarchived successfully")

            return True, {
                "project_id": project_id,
                "message": "Project unarchived successfully",
                "tasks_unarchived": result.get("tasks_unarchived", 0) if isinstance(result, dict) else 0
            }

        except Exception as e:
            logger.error(f"Error unarchiving project {project_id}: {e}")
            return False, {"error": f"Error unarchiving project: {str(e)}"}
