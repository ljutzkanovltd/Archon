"""
Knowledge Links API Routes for Archon

Provides REST API endpoints for linking knowledge base items
(documents, code examples, RAG pages) to projects, tasks, and sprints.
Includes AI-powered knowledge suggestions.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status as http_status
from pydantic import BaseModel, Field

from ..auth.dependencies import (
    get_current_user,
    require_knowledge_manage,
    require_knowledge_read,
)
from ..config.logfire_config import get_logger
from ..services.knowledge_linking_service import KnowledgeLinkingService

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["knowledge-links"])


# ============================================
# Request/Response Models
# ============================================


class LinkKnowledgeRequest(BaseModel):
    """Request model for linking knowledge items"""

    knowledge_type: str = Field(
        ...,
        description="Type of knowledge item: document, code_example, or rag_page",
    )
    knowledge_id: str = Field(..., description="UUID of the knowledge item")
    relevance_score: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Optional relevance score (0.00-1.00)"
    )


# ============================================
# API Endpoints
# ============================================


@router.post("/projects/{project_id}/knowledge")
async def link_knowledge_to_project(
    project_id: str,
    request: LinkKnowledgeRequest,
    current_user: dict = Depends(require_knowledge_manage),
):
    """
    Link a knowledge item to a project.

    Requires: knowledge:manage permission

    Args:
        project_id: UUID of the project
        request: LinkKnowledgeRequest with knowledge_type, knowledge_id, relevance_score

    Returns:
        {
            "success": true,
            "link": {...link object...},
            "knowledge_item": {...full knowledge item details...}
        }

    Raises:
        400: Invalid knowledge_type or relevance_score
        403: Permission denied
        404: Project or knowledge item not found
        409: Link already exists
    """
    user_id = current_user.get("email") or str(current_user.get("id"))

    service = KnowledgeLinkingService()
    success, result = await service.link_knowledge(
        source_type="project",
        source_id=project_id,
        knowledge_type=request.knowledge_type,
        knowledge_id=request.knowledge_id,
        created_by=user_id,
        relevance_score=request.relevance_score,
    )

    if not success:
        error_msg = result.get("error", "Unknown error")

        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        elif "already exists" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=error_msg,
            )
        elif "invalid" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )

    return {"success": True, **result}


@router.post("/tasks/{task_id}/knowledge")
async def link_knowledge_to_task(
    task_id: str,
    project_id: str,  # Query parameter for permission check
    request: LinkKnowledgeRequest,
    current_user: dict = Depends(require_knowledge_manage),
):
    """
    Link a knowledge item to a task.

    Requires: knowledge:manage permission

    Args:
        task_id: UUID of the task
        project_id: UUID of the project (query parameter)
        request: LinkKnowledgeRequest with knowledge_type, knowledge_id, relevance_score

    Returns:
        {
            "success": true,
            "link": {...link object...},
            "knowledge_item": {...full knowledge item details...}
        }
    """
    user_id = current_user.get("email") or str(current_user.get("id"))

    service = KnowledgeLinkingService()
    success, result = await service.link_knowledge(
        source_type="task",
        source_id=task_id,
        knowledge_type=request.knowledge_type,
        knowledge_id=request.knowledge_id,
        created_by=user_id,
        relevance_score=request.relevance_score,
    )

    if not success:
        error_msg = result.get("error", "Unknown error")

        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        elif "already exists" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=error_msg,
            )
        elif "invalid" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )

    return {"success": True, **result}


@router.post("/sprints/{sprint_id}/knowledge")
async def link_knowledge_to_sprint(
    sprint_id: str,
    project_id: str,  # Query parameter for permission check
    request: LinkKnowledgeRequest,
    current_user: dict = Depends(require_knowledge_manage),
):
    """
    Link a knowledge item to a sprint.

    Requires: knowledge:manage permission

    Args:
        sprint_id: UUID of the sprint
        project_id: UUID of the project (query parameter)
        request: LinkKnowledgeRequest with knowledge_type, knowledge_id, relevance_score

    Returns:
        {
            "success": true,
            "link": {...link object...},
            "knowledge_item": {...full knowledge item details...}
        }
    """
    user_id = current_user.get("email") or str(current_user.get("id"))

    service = KnowledgeLinkingService()
    success, result = await service.link_knowledge(
        source_type="sprint",
        source_id=sprint_id,
        knowledge_type=request.knowledge_type,
        knowledge_id=request.knowledge_id,
        created_by=user_id,
        relevance_score=request.relevance_score,
    )

    if not success:
        error_msg = result.get("error", "Unknown error")

        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        elif "already exists" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=error_msg,
            )
        elif "invalid" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )

    return {"success": True, **result}


@router.delete("/knowledge-links/{link_id}")
async def unlink_knowledge(
    link_id: str,
    project_id: str,  # Query parameter for permission check
    _user: dict = Depends(require_knowledge_manage),
):
    """
    Remove a knowledge link.

    Requires: knowledge:manage permission

    Args:
        link_id: UUID of the knowledge link
        project_id: UUID of the project (query parameter)

    Returns:
        {
            "success": true,
            "message": "Knowledge link removed successfully"
        }

    Raises:
        403: Permission denied
        404: Link not found
    """
    service = KnowledgeLinkingService()
    success, result = await service.unlink_knowledge(link_id)

    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=result.get("error", "Link not found"),
        )

    return {"success": True, **result}


@router.get("/projects/{project_id}/knowledge")
async def get_project_knowledge(
    project_id: str,
    _user: dict = Depends(require_knowledge_read),
):
    """
    Get all knowledge items linked to a project.

    Requires: knowledge:read permission

    Args:
        project_id: UUID of the project

    Returns:
        {
            "success": true,
            "links": [{...link with full knowledge_item...}, ...],
            "count": 5
        }

    Raises:
        403: Permission denied
        404: Project not found
    """
    service = KnowledgeLinkingService()
    success, result = await service.get_linked_knowledge("project", project_id)

    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Unknown error"),
        )

    return {"success": True, **result}


@router.get("/tasks/{task_id}/knowledge")
async def get_task_knowledge(
    task_id: str,
    project_id: str,  # Query parameter for permission check
    _user: dict = Depends(require_knowledge_read),
):
    """
    Get all knowledge items linked to a task.

    Requires: knowledge:read permission

    Args:
        task_id: UUID of the task
        project_id: UUID of the project (query parameter)

    Returns:
        {
            "success": true,
            "links": [{...link with full knowledge_item...}, ...],
            "count": 5
        }
    """
    service = KnowledgeLinkingService()
    success, result = await service.get_linked_knowledge("task", task_id)

    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Unknown error"),
        )

    return {"success": True, **result}


@router.get("/sprints/{sprint_id}/knowledge")
async def get_sprint_knowledge(
    sprint_id: str,
    project_id: str,  # Query parameter for permission check
    _user: dict = Depends(require_knowledge_read),
):
    """
    Get all knowledge items linked to a sprint.

    Requires: knowledge:read permission

    Args:
        sprint_id: UUID of the sprint
        project_id: UUID of the project (query parameter)

    Returns:
        {
            "success": true,
            "links": [{...link with full knowledge_item...}, ...],
            "count": 5
        }
    """
    service = KnowledgeLinkingService()
    success, result = await service.get_linked_knowledge("sprint", sprint_id)

    if not success:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Unknown error"),
        )

    return {"success": True, **result}


@router.get("/projects/{project_id}/knowledge/suggestions")
async def get_project_knowledge_suggestions(
    project_id: str,
    limit: int = 5,
    include_linked: bool = False,
    _user: dict = Depends(require_knowledge_read),
):
    """
    Get AI-powered knowledge suggestions for a project.

    Uses RAG search to suggest relevant documents and code examples
    based on project title and description. Results are cached for 1 hour.

    Phase 1.4: Enhanced AI Suggestions with include_linked parameter

    Requires: knowledge:read permission

    Args:
        project_id: UUID of the project
        limit: Maximum number of suggestions (default: 5, max: 20)
        include_linked: If true, include already-linked items with is_linked flag (default: false)

    Returns:
        {
            "success": true,
            "suggestions": [{
                "knowledge_id": "...",
                "knowledge_type": "rag_page",
                "title": "...",
                "url": "...",
                "relevance_score": 0.85,
                "content_preview": "...",
                "source_id": "...",
                "is_linked": true,  // NEW FIELD
                "linked_at": "timestamp"  // NEW FIELD (if linked)
            }, ...],
            "count": 5,
            "cached": false
        }

    Raises:
        400: Invalid limit parameter
        403: Permission denied
        404: Project not found
    """
    if limit > 20:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Limit cannot exceed 20",
        )

    service = KnowledgeLinkingService()
    success, result = await service.suggest_knowledge(
        source_type="project",
        source_id=project_id,
        limit=limit,
        include_linked=include_linked,
    )

    if not success:
        error_msg = result.get("error", "Unknown error")

        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )

    return {"success": True, **result}


@router.get("/tasks/{task_id}/knowledge/suggestions")
async def get_task_knowledge_suggestions(
    task_id: str,
    project_id: str,  # Query parameter for permission check
    limit: int = 5,
    include_linked: bool = False,
    _user: dict = Depends(require_knowledge_read),
):
    """
    Get AI-powered knowledge suggestions for a task.

    Uses RAG search to suggest relevant documents and code examples
    based on task title and description. Results are cached for 1 hour.

    Phase 1.4: Enhanced AI Suggestions with include_linked parameter

    Requires: knowledge:read permission

    Args:
        task_id: UUID of the task
        project_id: UUID of the project (query parameter)
        limit: Maximum number of suggestions (default: 5, max: 20)
        include_linked: If true, include already-linked items with is_linked flag (default: false)

    Returns:
        {
            "success": true,
            "suggestions": [{
                "is_linked": true,
                "linked_at": "timestamp"
            }, ...],
            "count": 5,
            "cached": false
        }
    """
    if limit > 20:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Limit cannot exceed 20",
        )

    service = KnowledgeLinkingService()
    success, result = await service.suggest_knowledge(
        source_type="task",
        source_id=task_id,
        limit=limit,
        include_linked=include_linked,
    )

    if not success:
        error_msg = result.get("error", "Unknown error")

        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )

    return {"success": True, **result}


@router.get("/knowledge/{knowledge_type}/{knowledge_id}/sources")
async def get_knowledge_sources(
    knowledge_type: str,
    knowledge_id: str,
    _user: dict = Depends(get_current_user),  # Any authenticated user can view
):
    """
    Get all source entities (projects, tasks, sprints) linked to a knowledge item.

    Reverse lookup: find all entities that reference this knowledge item.

    Args:
        knowledge_type: Type of knowledge item (document, code_example, rag_page)
        knowledge_id: UUID of the knowledge item

    Returns:
        {
            "success": true,
            "sources": {
                "projects": [{...project with link metadata...}, ...],
                "tasks": [{...task with link metadata...}, ...],
                "sprints": [{...sprint with link metadata...}, ...]
            },
            "total_count": 10
        }

    Raises:
        400: Invalid knowledge_type
        404: Knowledge item not found
    """
    service = KnowledgeLinkingService()
    success, result = await service.get_knowledge_sources(knowledge_type, knowledge_id)

    if not success:
        error_msg = result.get("error", "Unknown error")

        if "invalid" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )

    return {"success": True, **result}


# ============================================
# Phase 1.2-1.4: KB Source Bidirectional Linking Endpoints
# ============================================


class LinkBySourceRequest(BaseModel):
    """Request model for linking KB source to project"""

    linked_by: Optional[str] = Field(default="User", description="User who created the link")


@router.get("/knowledge/sources/{source_id}/projects")
async def get_source_linked_projects(
    source_id: str,
    _user: dict = Depends(get_current_user),
):
    """
    Get all projects linked to a specific KB source (backlinks).

    Phase 1.2: Backlinks Endpoint

    Args:
        source_id: ID of the knowledge source (from archon_sources)

    Returns:
        {
            "success": true,
            "source_id": "...",
            "linked_projects": [
                {
                    "project_id": "uuid",
                    "project_title": "string",
                    "linked_at": "timestamp",
                    "linked_by": "string"
                }
            ],
            "total_links": 10
        }

    Raises:
        404: Source not found
    """
    service = KnowledgeLinkingService()
    success, result = await service.get_source_linked_projects(source_id)

    if not success:
        error_msg = result.get("error", "Unknown error")

        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )

    return {"success": True, **result}


@router.post("/projects/{project_id}/knowledge/sources/{source_id}/link")
async def link_source_to_project(
    project_id: str,
    source_id: str,
    request: LinkBySourceRequest = LinkBySourceRequest(),
    current_user: dict = Depends(require_knowledge_manage),
):
    """
    Manually link a KB source to a project (reverse direction).

    Phase 1.3: Link Endpoint

    This creates links for ALL pages in the source to the project.

    Args:
        project_id: UUID of the project
        source_id: ID of the knowledge source
        request: LinkBySourceRequest with linked_by (optional)

    Returns:
        {
            "success": true,
            "links_created": 5,
            "source": {...source details...}
        }

    Raises:
        404: Project or source not found
        409: Links already exist
    """
    user_id = current_user.get("email") or str(current_user.get("id"))
    linked_by = request.linked_by or user_id

    service = KnowledgeLinkingService()
    success, result = await service.link_source_to_project(
        project_id=project_id,
        source_id=source_id,
        linked_by=linked_by,
    )

    if not success:
        error_msg = result.get("error", "Unknown error")

        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        elif "already exist" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )

    return {"success": True, **result}


@router.delete("/projects/{project_id}/knowledge/sources/{source_id}/link")
async def unlink_source_from_project(
    project_id: str,
    source_id: str,
    _user: dict = Depends(require_knowledge_manage),
):
    """
    Remove link between KB source and project.

    Phase 1.3: Unlink Endpoint

    This removes ALL links for pages in this source from the project.

    Args:
        project_id: UUID of the project
        source_id: ID of the knowledge source

    Returns:
        {
            "success": true,
            "links_removed": 5,
            "message": "Links removed successfully"
        }

    Raises:
        404: Project or source not found, or no links exist
    """
    service = KnowledgeLinkingService()
    success, result = await service.unlink_source_from_project(
        project_id=project_id,
        source_id=source_id,
    )

    if not success:
        error_msg = result.get("error", "Unknown error")

        if "not found" in error_msg.lower() or "no links" in error_msg.lower():
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg,
            )

    return {"success": True, **result}
