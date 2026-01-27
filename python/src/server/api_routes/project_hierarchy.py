"""
Project Hierarchy API endpoints for Archon

Handles:
- Parent-child project relationships
- Hierarchical navigation (ancestors, descendants)
- Project moving/reparenting
- Context inheritance queries
"""

from typing import Any, List
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi import status as http_status
from pydantic import BaseModel

from ..config.logfire_config import get_logger
from ..utils import get_supabase_client

logger = get_logger(__name__)

router = APIRouter(prefix="/api/projects", tags=["project-hierarchy"])


class ProjectSummary(BaseModel):
    """Minimal project info for hierarchy views"""

    id: str
    title: str
    description: str | None
    parent_project_id: str | None
    hierarchy_depth: int | None
    task_count: int | None
    archived: bool


class ProjectBreadcrumb(BaseModel):
    """Project info for breadcrumb navigation"""

    id: str
    title: str
    hierarchy_depth: int


class SetParentRequest(BaseModel):
    """Request to set/change project parent"""

    parent_project_id: str | None  # None to make root-level project


@router.get("/{project_id}/hierarchy")
async def get_project_hierarchy(project_id: UUID):
    """
    Get complete hierarchy information for a project.

    Returns:
        - project: Current project info
        - parent: Parent project (if exists)
        - children: Direct child projects
        - siblings: Projects with same parent
        - children_count: Number of direct children
        - siblings_count: Number of siblings
    """
    try:
        supabase = get_supabase_client()

        # Get current project via existing hierarchy table
        hierarchy_response = (
            supabase.table("archon_project_hierarchy")
            .select(
                """
                child_project:child_project_id(id, title, description, workflow_id),
                parent_project:parent_project_id(id, title, relationship_type),
                relationship_type
            """
            )
            .eq("child_project_id", str(project_id))
            .execute()
        )

        # Build response
        result: dict[str, Any] = {
            "project": None,
            "parent": None,
            "children": [],
            "siblings": [],
            "children_count": 0,
            "siblings_count": 0,
        }

        # Get project info
        project_response = (
            supabase.table("archon_projects")
            .select("id, title, description, workflow_id")
            .eq("id", str(project_id))
            .execute()
        )

        if project_response.data and len(project_response.data) > 0:
            result["project"] = project_response.data[0]

        # Get parent if exists
        if hierarchy_response.data and len(hierarchy_response.data) > 0:
            parent_data = hierarchy_response.data[0].get("parent_project")
            if parent_data:
                result["parent"] = {
                    "id": parent_data["id"],
                    "title": parent_data["title"],
                    "relationship_type": hierarchy_response.data[0].get(
                        "relationship_type", "subproject"
                    ),
                }

        # Get children (projects where this is the parent)
        children_response = (
            supabase.table("archon_project_hierarchy")
            .select(
                "child_project:child_project_id(id, title, description, workflow_id), relationship_type"
            )
            .eq("parent_project_id", str(project_id))
            .execute()
        )

        if children_response.data:
            result["children"] = [
                {
                    **child["child_project"],
                    "relationship_type": child.get("relationship_type", "subproject"),
                }
                for child in children_response.data
            ]
            result["children_count"] = len(children_response.data)

        # Get siblings (projects with same parent)
        if result["parent"]:
            siblings_response = (
                supabase.table("archon_project_hierarchy")
                .select("child_project:child_project_id(id, title), relationship_type")
                .eq("parent_project_id", result["parent"]["id"])
                .neq("child_project_id", str(project_id))
                .execute()
            )

            if siblings_response.data:
                result["siblings"] = [
                    {
                        "id": sib["child_project"]["id"],
                        "title": sib["child_project"]["title"],
                        "relationship_type": sib.get("relationship_type", "subproject"),
                    }
                    for sib in siblings_response.data
                ]
                result["siblings_count"] = len(siblings_response.data)

        return result

    except Exception as e:
        logger.error(f"Error fetching hierarchy for project {project_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch project hierarchy: {str(e)}",
        )


@router.get("/{project_id}/children", response_model=List[ProjectSummary])
async def get_project_children(
    project_id: UUID, include_archived: bool = False, recursive: bool = False
):
    """
    Get child projects.

    Args:
        project_id: Parent project UUID
        include_archived: Include archived children (default: False)
        recursive: Get entire subtree, not just direct children (default: False)

    Returns:
        List of child projects with summary info
    """
    try:
        supabase = get_supabase_client()

        if recursive:
            # Get entire subtree using recursive query
            # For now, just get direct children (recursive CTE would be complex with Supabase client)
            # TODO: Implement proper recursive query when needed
            logger.warning(
                "Recursive children fetch not yet implemented, returning direct children only"
            )

        # Get direct children via hierarchy table
        children_response = (
            supabase.table("archon_project_hierarchy")
            .select(
                """
                child_project:child_project_id(
                    id, title, description, archived,
                    task_count:archon_tasks(count)
                )
            """
            )
            .eq("parent_project_id", str(project_id))
            .execute()
        )

        if not children_response.data:
            return []

        # Transform to ProjectSummary format
        children = []
        for item in children_response.data:
            child = item["child_project"]
            if not include_archived and child.get("archived", False):
                continue

            children.append(
                ProjectSummary(
                    id=child["id"],
                    title=child["title"],
                    description=child.get("description"),
                    parent_project_id=str(project_id),
                    hierarchy_depth=1,  # Direct children are depth 1
                    task_count=len(child.get("task_count", [])),
                    archived=child.get("archived", False),
                )
            )

        return children

    except Exception as e:
        logger.error(f"Error fetching children for project {project_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch project children: {str(e)}",
        )


@router.get("/{project_id}/ancestors", response_model=List[ProjectBreadcrumb])
async def get_project_ancestors(project_id: UUID):
    """
    Get hierarchy path from root to this project.

    Returns breadcrumb trail: [root, ..., grandparent, parent, current]
    Used for breadcrumb navigation in UI.

    Returns:
        List of projects from root to current, ordered by hierarchy depth
    """
    try:
        supabase = get_supabase_client()

        # Build ancestor chain by following parent links
        ancestors = []
        current_id = str(project_id)
        depth = 0
        max_depth = 10  # Prevent infinite loops

        while current_id and depth < max_depth:
            # Get current project
            project_response = (
                supabase.table("archon_projects")
                .select("id, title")
                .eq("id", current_id)
                .execute()
            )

            if not project_response.data or len(project_response.data) == 0:
                break

            project = project_response.data[0]
            ancestors.insert(
                0,
                ProjectBreadcrumb(id=project["id"], title=project["title"], hierarchy_depth=depth),
            )

            # Get parent from hierarchy table
            parent_response = (
                supabase.table("archon_project_hierarchy")
                .select("parent_project_id")
                .eq("child_project_id", current_id)
                .execute()
            )

            if not parent_response.data or len(parent_response.data) == 0:
                break  # Reached root

            current_id = parent_response.data[0]["parent_project_id"]
            depth += 1

        return ancestors

    except Exception as e:
        logger.error(f"Error fetching ancestors for project {project_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch project ancestors: {str(e)}",
        )


@router.post("/{project_id}/set-parent")
async def set_project_parent(project_id: UUID, request: SetParentRequest):
    """
    Set or change the parent of a project.

    Args:
        project_id: Project to reparent
        request.parent_project_id: New parent UUID (or None to make root-level)

    Returns:
        Success message

    Raises:
        400: If circular reference would be created
        404: If project or parent not found
    """
    try:
        supabase = get_supabase_client()

        # Validate project exists
        project_check = (
            supabase.table("archon_projects").select("id").eq("id", str(project_id)).execute()
        )

        if not project_check.data or len(project_check.data) == 0:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

        # If setting a parent, validate it exists and prevent circular reference
        if request.parent_project_id:
            parent_check = (
                supabase.table("archon_projects")
                .select("id")
                .eq("id", request.parent_project_id)
                .execute()
            )

            if not parent_check.data or len(parent_check.data) == 0:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=f"Parent project {request.parent_project_id} not found",
                )

            # Check for circular reference (project can't be its own ancestor)
            if str(project_id) == request.parent_project_id:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="Project cannot be its own parent",
                )

            # TODO: Add more sophisticated circular reference check traversing ancestors

        # Remove existing parent relationship
        delete_response = (
            supabase.table("archon_project_hierarchy")
            .delete()
            .eq("child_project_id", str(project_id))
            .execute()
        )

        # Add new parent relationship if provided
        if request.parent_project_id:
            insert_response = (
                supabase.table("archon_project_hierarchy")
                .insert(
                    {
                        "parent_project_id": request.parent_project_id,
                        "child_project_id": str(project_id),
                        "relationship_type": "subproject",
                    }
                )
                .execute()
            )

            if not insert_response.data:
                raise HTTPException(
                    status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create parent relationship",
                )

        logger.info(
            f"Updated parent for project {project_id} to {request.parent_project_id or 'root'}"
        )

        return {
            "success": True,
            "message": f"Project parent updated to {request.parent_project_id or 'root-level'}",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting parent for project {project_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set project parent: {str(e)}",
        )


@router.post("/{project_id}/move")
async def move_project(project_id: UUID, request: SetParentRequest):
    """
    Move a project to a new parent (alias for set_parent).

    This is a convenience endpoint that does the same as set_parent.
    Provided for better API semantics in UI code.

    Args:
        project_id: Project to move
        request.parent_project_id: New parent UUID (or None for root)

    Returns:
        Success message
    """
    return await set_project_parent(project_id, request)


@router.get("/{project_id}/context")
async def get_project_context(
    project_id: UUID,
    include_instructions: bool = True,
    include_memory: bool = True,
    include_knowledge: bool = True,
):
    """
    Get inherited context for a project from its ancestor chain.

    This endpoint combines context from all ancestor projects:
    - Instructions: Child overrides parent (merge with child priority)
    - Memory: Child + parent (combined, no override)
    - Linked Knowledge: Child + parent (union)

    Args:
        project_id: Project UUID
        include_instructions: Include project instructions (default: True)
        include_memory: Include project memory (default: True, future feature)
        include_knowledge: Include linked knowledge items (default: True)

    Returns:
        ProjectContext with merged context from ancestors
    """
    try:
        from ..services.project_context_service import get_context_service

        context_service = get_context_service()
        context = await context_service.get_inherited_context(
            project_id=project_id,
            include_instructions=include_instructions,
            include_memory=include_memory,
            include_knowledge=include_knowledge,
        )

        return context.to_dict()

    except Exception as e:
        logger.error(f"Error fetching context for project {project_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch project context: {str(e)}",
        )
