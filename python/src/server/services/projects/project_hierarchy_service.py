"""
Project Hierarchy Service Module for Archon

This module provides business logic for managing hierarchical relationships
between projects using PostgreSQL ltree extension for efficient tree queries.
Supports parent-child relationships with circular reference prevention.
"""

from typing import Any, Optional

from src.server.utils import get_supabase_client
from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class ProjectHierarchyService:
    """Service class for project hierarchy operations using ltree"""

    VALID_RELATIONSHIP_TYPES = ["portfolio", "program", "subproject"]

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    async def add_child_project(
        self,
        parent_id: str,
        child_id: str,
        relationship_type: str = "subproject",
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a parent-child project relationship.

        Args:
            parent_id: UUID of the parent project
            child_id: UUID of the child project
            relationship_type: Type of relationship (portfolio, program, subproject)

        Returns:
            Tuple of (success, result_dict)
            result_dict contains relationship data or error message
        """
        try:
            # Validate relationship type
            if relationship_type not in self.VALID_RELATIONSHIP_TYPES:
                return False, {
                    "error": f"Invalid relationship_type. Must be one of: {', '.join(self.VALID_RELATIONSHIP_TYPES)}"
                }

            # Validate projects exist
            parent_response = (
                self.supabase_client.table("archon_projects")
                .select("id, title")
                .eq("id", parent_id)
                .execute()
            )
            child_response = (
                self.supabase_client.table("archon_projects")
                .select("id, title")
                .eq("id", child_id)
                .execute()
            )

            if not parent_response.data:
                return False, {"error": f"Parent project {parent_id} not found"}
            if not child_response.data:
                return False, {"error": f"Child project {child_id} not found"}

            # Validate no circular reference (trigger will also check this)
            is_valid, validation_result = await self.validate_no_circular_reference(
                parent_id, child_id
            )
            if not is_valid:
                return False, validation_result

            # Create hierarchy relationship
            hierarchy_data = {
                "parent_project_id": parent_id,
                "child_project_id": child_id,
                "relationship_type": relationship_type,
            }

            hierarchy_response = (
                self.supabase_client.table("archon_project_hierarchy")
                .insert(hierarchy_data)
                .execute()
            )

            if not hierarchy_response.data:
                return False, {"error": "Failed to create project hierarchy"}

            relationship = hierarchy_response.data[0]
            logger.info(
                f"Created {relationship_type} relationship: {parent_response.data[0]['title']} -> {child_response.data[0]['title']}"
            )
            return True, {
                "relationship": relationship,
                "parent": parent_response.data[0],
                "child": child_response.data[0],
            }

        except Exception as e:
            error_msg = str(e)
            if "duplicate key" in error_msg.lower():
                return False, {"error": "Relationship already exists"}
            elif "circular reference" in error_msg.lower():
                return False, {"error": "Circular reference detected"}
            logger.error(f"Error creating project hierarchy: {error_msg}")
            return False, {"error": error_msg}

    async def remove_child_project(
        self, parent_id: str, child_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Remove a parent-child project relationship.

        Args:
            parent_id: UUID of the parent project
            child_id: UUID of the child project

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Delete hierarchy relationship
            delete_response = (
                self.supabase_client.table("archon_project_hierarchy")
                .delete()
                .eq("parent_project_id", parent_id)
                .eq("child_project_id", child_id)
                .execute()
            )

            if not delete_response.data:
                return False, {
                    "error": f"Relationship not found between {parent_id} and {child_id}"
                }

            logger.info(
                f"Removed project hierarchy relationship: {parent_id} -> {child_id}"
            )
            return True, {"message": "Relationship removed successfully"}

        except Exception as e:
            logger.error(f"Error removing project hierarchy: {str(e)}")
            return False, {"error": str(e)}

    async def get_project_children(
        self, project_id: str, direct_only: bool = True
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get child projects of a parent project.

        Args:
            project_id: UUID of the parent project
            direct_only: If True, only direct children; if False, all descendants

        Returns:
            Tuple of (success, result_dict)
            result_dict contains children list or error message
        """
        try:
            if direct_only:
                # Get direct children via archon_project_hierarchy
                hierarchy_response = (
                    self.supabase_client.table("archon_project_hierarchy")
                    .select("child_project_id, relationship_type")
                    .eq("parent_project_id", project_id)
                    .execute()
                )

                if not hierarchy_response.data:
                    return True, {"children": [], "count": 0}

                # Get full project details for children
                child_ids = [h["child_project_id"] for h in hierarchy_response.data]
                children_response = (
                    self.supabase_client.table("archon_projects")
                    .select("*")
                    .in_("id", child_ids)
                    .execute()
                )

                # Enrich with relationship type
                children_map = {c["id"]: c for c in children_response.data}
                enriched_children = []
                for h in hierarchy_response.data:
                    child = children_map.get(h["child_project_id"])
                    if child:
                        child["relationship_type"] = h["relationship_type"]
                        enriched_children.append(child)

                return True, {"children": enriched_children, "count": len(enriched_children)}
            else:
                # Get all descendants using ltree
                return await self.get_project_descendants(project_id)

        except Exception as e:
            logger.error(f"Error getting project children: {str(e)}")
            return False, {"error": str(e)}

    async def get_project_ancestors(
        self, project_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all ancestor projects using ltree path traversal.

        Args:
            project_id: UUID of the project

        Returns:
            Tuple of (success, result_dict)
            result_dict contains ancestors list ordered from root to immediate parent
        """
        try:
            # Get project's hierarchy_path
            project_response = (
                self.supabase_client.table("archon_projects")
                .select("hierarchy_path")
                .eq("id", project_id)
                .execute()
            )

            if not project_response.data:
                return False, {"error": f"Project {project_id} not found"}

            hierarchy_path = project_response.data[0].get("hierarchy_path")
            if not hierarchy_path:
                return True, {"ancestors": [], "count": 0}

            # Use ltree @> operator to find ancestors
            # All projects whose path is an ancestor of this project's path
            ancestors_response = (
                self.supabase_client.rpc(
                    "get_project_ancestors",
                    {"target_project_id": project_id}
                )
                .execute()
            )

            ancestors = ancestors_response.data or []
            return True, {"ancestors": ancestors, "count": len(ancestors)}

        except Exception as e:
            # Fallback if RPC doesn't exist - use hierarchy table
            try:
                # Traverse up using archon_project_hierarchy
                ancestors = []
                current_id = project_id

                while True:
                    parent_response = (
                        self.supabase_client.table("archon_project_hierarchy")
                        .select("parent_project_id")
                        .eq("child_project_id", current_id)
                        .limit(1)
                        .execute()
                    )

                    if not parent_response.data:
                        break

                    parent_id = parent_response.data[0]["parent_project_id"]
                    parent_project = (
                        self.supabase_client.table("archon_projects")
                        .select("*")
                        .eq("id", parent_id)
                        .execute()
                    )

                    if parent_project.data:
                        ancestors.insert(0, parent_project.data[0])  # Insert at beginning
                        current_id = parent_id
                    else:
                        break

                return True, {"ancestors": ancestors, "count": len(ancestors)}

            except Exception as fallback_error:
                logger.error(f"Error getting project ancestors: {str(fallback_error)}")
                return False, {"error": str(fallback_error)}

    async def get_project_descendants(
        self, project_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all descendant projects using ltree path traversal.

        Args:
            project_id: UUID of the project

        Returns:
            Tuple of (success, result_dict)
            result_dict contains descendants list with depth information
        """
        try:
            # Get project's hierarchy_path
            project_response = (
                self.supabase_client.table("archon_projects")
                .select("hierarchy_path")
                .eq("id", project_id)
                .execute()
            )

            if not project_response.data:
                return False, {"error": f"Project {project_id} not found"}

            hierarchy_path = project_response.data[0].get("hierarchy_path")
            if not hierarchy_path:
                return True, {"descendants": [], "count": 0}

            # Use ltree <@ operator to find descendants
            # All projects whose path is a descendant of this project's path
            descendants_response = (
                self.supabase_client.rpc(
                    "get_project_descendants",
                    {"target_project_id": project_id}
                )
                .execute()
            )

            descendants = descendants_response.data or []
            return True, {"descendants": descendants, "count": len(descendants)}

        except Exception as e:
            # Fallback - recursively traverse hierarchy table
            try:
                descendants = []

                async def collect_children(parent_id: str):
                    children_response = (
                        self.supabase_client.table("archon_project_hierarchy")
                        .select("child_project_id")
                        .eq("parent_project_id", parent_id)
                        .execute()
                    )

                    for child_rel in children_response.data or []:
                        child_id = child_rel["child_project_id"]
                        child_project = (
                            self.supabase_client.table("archon_projects")
                            .select("*")
                            .eq("id", child_id)
                            .execute()
                        )

                        if child_project.data:
                            descendants.append(child_project.data[0])
                            await collect_children(child_id)  # Recursive

                await collect_children(project_id)
                return True, {"descendants": descendants, "count": len(descendants)}

            except Exception as fallback_error:
                logger.error(f"Error getting project descendants: {str(fallback_error)}")
                return False, {"error": str(fallback_error)}

    async def validate_no_circular_reference(
        self, parent_id: str, child_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Validate that adding a parent-child relationship would not create a cycle.

        Args:
            parent_id: UUID of the proposed parent project
            child_id: UUID of the proposed child project

        Returns:
            Tuple of (success, result_dict)
            success is True if no circular reference detected
        """
        try:
            # Check 1: Parent and child cannot be the same
            if parent_id == child_id:
                return False, {"error": "Project cannot be its own parent"}

            # Check 2: Verify parent is not a descendant of child
            # If child has descendants, check if parent is among them
            is_descendant, descendants_result = await self.get_project_descendants(child_id)

            if is_descendant and descendants_result.get("descendants"):
                descendant_ids = [d["id"] for d in descendants_result["descendants"]]
                if parent_id in descendant_ids:
                    return False, {
                        "error": f"Circular reference detected: {parent_id} is already a descendant of {child_id}"
                    }

            # Check 3: Verify child is not an ancestor of parent
            is_ancestor, ancestors_result = await self.get_project_ancestors(parent_id)

            if is_ancestor and ancestors_result.get("ancestors"):
                ancestor_ids = [a["id"] for a in ancestors_result["ancestors"]]
                if child_id in ancestor_ids:
                    return False, {
                        "error": f"Circular reference detected: {child_id} is already an ancestor of {parent_id}"
                    }

            return True, {"valid": True}

        except Exception as e:
            logger.error(f"Error validating circular reference: {str(e)}")
            return False, {"error": str(e)}
