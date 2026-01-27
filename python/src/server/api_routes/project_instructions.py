"""
Project Instructions API endpoints for Archon

Handles:
- Project instructions CRUD operations
- Rich text content management (BlockNote JSONB)
- Auto-versioning on updates
- Version history and restoration
"""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi import status as http_status
from pydantic import BaseModel

from ..config.logfire_config import get_logger
from ..utils import get_supabase_client

logger = get_logger(__name__)

router = APIRouter(prefix="/api/projects", tags=["project-instructions"])


class InstructionsUpdateRequest(BaseModel):
    """Request model for updating project instructions"""

    content: dict[str, Any]  # JSONB with sections: {overview: [], agent_instructions: [], context: []}
    updated_by: str = "system"


class InstructionsResponse(BaseModel):
    """Response model for project instructions"""

    id: str
    project_id: str
    content: dict[str, Any]
    created_by: str
    updated_by: str | None
    created_at: str
    updated_at: str


class VersionResponse(BaseModel):
    """Response model for instruction version"""

    id: str
    instruction_id: str
    version: int
    content: dict[str, Any]
    change_summary: str | None
    created_by: str
    created_at: str


@router.get("/{project_id}/instructions", response_model=InstructionsResponse | None)
async def get_project_instructions(project_id: UUID):
    """
    Get current project instructions for all sections.

    Returns:
        InstructionsResponse with JSONB content for all sections, or None if not found.
    """
    try:
        supabase = get_supabase_client()

        # Query instructions
        response = (
            supabase.table("archon_project_instructions")
            .select("*")
            .eq("project_id", str(project_id))
            .execute()
        )

        if not response.data or len(response.data) == 0:
            return None

        return InstructionsResponse(**response.data[0])

    except Exception as e:
        logger.error(f"Error fetching instructions for project {project_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch project instructions: {str(e)}",
        )


@router.put("/{project_id}/instructions", response_model=InstructionsResponse)
async def update_project_instructions(
    project_id: UUID, data: InstructionsUpdateRequest
):
    """
    Update project instructions with auto-versioning.

    Process:
    1. Check if instructions exist for project
    2. If exists: Trigger will auto-create version from OLD content
    3. Update with new content
    4. Return updated instructions

    Note: Auto-versioning is handled by database trigger (create_instruction_version).
    """
    try:
        supabase = get_supabase_client()

        # Check if instructions exist
        existing_response = (
            supabase.table("archon_project_instructions")
            .select("id")
            .eq("project_id", str(project_id))
            .execute()
        )

        if existing_response.data and len(existing_response.data) > 0:
            # Update existing instructions (trigger will create version)
            update_data = {
                "content": data.content,
                "updated_by": data.updated_by,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            response = (
                supabase.table("archon_project_instructions")
                .update(update_data)
                .eq("project_id", str(project_id))
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update instructions",
                )

            return InstructionsResponse(**response.data[0])
        else:
            # Create new instructions
            insert_data = {
                "project_id": str(project_id),
                "content": data.content,
                "created_by": data.updated_by,
                "updated_by": data.updated_by,
            }

            response = (
                supabase.table("archon_project_instructions")
                .insert(insert_data)
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create instructions",
                )

            return InstructionsResponse(**response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating instructions for project {project_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update project instructions: {str(e)}",
        )


@router.get("/{project_id}/instructions/history", response_model=list[VersionResponse])
async def get_instruction_history(project_id: UUID, limit: int = 10):
    """
    Get version history for project instructions.

    Args:
        project_id: UUID of the project
        limit: Maximum number of versions to return (default: 10)

    Returns:
        List of VersionResponse objects, ordered by version descending
    """
    try:
        supabase = get_supabase_client()

        # Get instruction ID for this project
        instruction_response = (
            supabase.table("archon_project_instructions")
            .select("id")
            .eq("project_id", str(project_id))
            .execute()
        )

        if not instruction_response.data or len(instruction_response.data) == 0:
            return []

        instruction_id = instruction_response.data[0]["id"]

        # Get version history
        versions_response = (
            supabase.table("archon_project_instruction_versions")
            .select("*")
            .eq("instruction_id", instruction_id)
            .order("version", desc=True)
            .limit(limit)
            .execute()
        )

        return [VersionResponse(**version) for version in versions_response.data]

    except Exception as e:
        logger.error(f"Error fetching instruction history for project {project_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch instruction history: {str(e)}",
        )


@router.post("/{project_id}/instructions/restore/{version}", response_model=InstructionsResponse)
async def restore_instruction_version(project_id: UUID, version: int, restored_by: str = "system"):
    """
    Restore project instructions to a specific version.

    Process:
    1. Fetch version content from archon_project_instruction_versions
    2. Update current instructions with version content
    3. Trigger will auto-create new version from OLD content
    4. Return restored instructions

    Args:
        project_id: UUID of the project
        version: Version number to restore
        restored_by: User/agent performing the restoration

    Returns:
        Updated InstructionsResponse after restoration
    """
    try:
        supabase = get_supabase_client()

        # Get instruction ID for this project
        instruction_response = (
            supabase.table("archon_project_instructions")
            .select("id")
            .eq("project_id", str(project_id))
            .execute()
        )

        if not instruction_response.data or len(instruction_response.data) == 0:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"No instructions found for project {project_id}",
            )

        instruction_id = instruction_response.data[0]["id"]

        # Get version content
        version_response = (
            supabase.table("archon_project_instruction_versions")
            .select("content")
            .eq("instruction_id", instruction_id)
            .eq("version", version)
            .execute()
        )

        if not version_response.data or len(version_response.data) == 0:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Version {version} not found for project {project_id}",
            )

        # Restore version content (trigger will auto-version the old content)
        update_data = {
            "content": version_response.data[0]["content"],
            "updated_by": restored_by,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        restore_response = (
            supabase.table("archon_project_instructions")
            .update(update_data)
            .eq("project_id", str(project_id))
            .execute()
        )

        if not restore_response.data:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to restore version",
            )

        logger.info(f"Restored instructions for project {project_id} to version {version}")
        return InstructionsResponse(**restore_response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring version for project {project_id}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restore instruction version: {str(e)}",
        )
