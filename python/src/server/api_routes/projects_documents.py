"""
Project Documents API endpoints for Archon

Handles:
- Document upload with project scoping
- Document listing with privacy filtering
- Document promotion to global knowledge base
- Document deletion
"""

import asyncio
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, UploadFile
from fastapi import status as http_status
from pydantic import BaseModel, Field

from ..auth.dependencies import require_document_manage
from ..config.logfire_config import get_logger, logfire, safe_logfire_error, safe_logfire_info
from ..services.projects.document_service import ProjectDocumentService
from ..services.storage.storage_services import DocumentStorageService
from ..utils import get_supabase_client
from ..utils.document_processing import extract_text_from_document
from ..utils.progress.progress_tracker import ProgressTracker

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["project-documents"])

# Active upload tasks for tracking and cancellation
active_upload_tasks: dict[str, asyncio.Task] = {}


class UploadDocumentRequest(BaseModel):
    """Request to upload a document to a project"""
    url: str = Field(..., description="Document URL or file path")
    title: Optional[str] = Field(None, description="Document title (defaults to filename)")
    is_project_private: bool = Field(True, description="Whether document is project-private (default: True)")
    source_display_name: Optional[str] = Field(None, description="Display name for the source")
    metadata: Optional[dict] = Field(None, description="Optional metadata dictionary")


class PromoteDocumentRequest(BaseModel):
    """Request to promote a document to global knowledge base"""
    promoted_by: str = Field(..., description="User identifier performing the promotion")


@router.post("/projects/{project_id}/documents")
async def upload_document(
    project_id: str,
    request: UploadDocumentRequest,
    _user: dict = Depends(require_document_manage)
):
    """
    Upload a document to a project with privacy controls.

    Requires: document:manage permission

    Args:
        project_id: UUID of the project
        request: Document details (url, title, privacy settings)

    Returns:
        Created document object
    """
    try:
        logfire.debug(
            f"Uploading document '{request.url}' to project {project_id} " +
            f"(private: {request.is_project_private})"
        )

        document_service = ProjectDocumentService()
        success, result = await document_service.upload_document(
            project_id=project_id,
            url=request.url,
            title=request.title,
            is_project_private=request.is_project_private,
            source_display_name=request.source_display_name,
            metadata=request.metadata
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            # Return 404 if project not found
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Document '{request.title or request.url}' uploaded successfully")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/projects/{project_id}/documents/upload")
async def upload_project_document(
    project_id: str = Path(..., description="Project UUID"),
    file: UploadFile = File(..., description="Document file to upload"),
    tags: str | None = Form(None, description="Comma-separated tags or JSON array"),
    knowledge_type: str = Form("technical", description="Knowledge type: technical or business"),
    extract_code_examples: bool = Form(True, description="Extract and index code examples"),
    is_project_private: bool = Form(True, description="Keep document private to project (default: True)"),
    send_to_kb: bool = Form(False, description="Immediately promote to global knowledge base"),
    _user: dict = Depends(require_document_manage)
):
    """
    Upload a document file to a project with progress tracking and knowledge base integration.

    This endpoint:
    1. Validates project exists and user has permissions
    2. Reads file content and extracts text
    3. Processes document in background with progress tracking
    4. Stores in knowledge base with project scoping
    5. Optionally extracts code examples
    6. Can be immediately promoted to global KB or kept project-private

    Requires: document:manage permission

    Args:
        project_id: UUID of the project
        file: Document file (PDF, DOCX, TXT, MD, etc.)
        tags: Comma-separated tags or JSON array of tags
        knowledge_type: "technical" (code/APIs) or "business" (guides/policies)
        extract_code_examples: Whether to extract and index code snippets
        is_project_private: True = project-only, False = global KB
        send_to_kb: True = immediately promote to KB (overrides is_project_private)

    Returns:
        {
            "success": true,
            "progressId": "uuid",
            "message": "Document upload started",
            "filename": "example.pdf"
        }
    """
    try:
        safe_logfire_info(
            f"📁 PROJECT UPLOAD: Starting | project_id={project_id} | filename={file.filename} | "
            f"content_type={file.content_type} | is_project_private={is_project_private} | send_to_kb={send_to_kb}"
        )

        # Verify project exists
        supabase = get_supabase_client()
        project_check = supabase.table("archon_projects").select("id, title").eq("id", project_id).execute()

        if not project_check.data:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )

        project_title = project_check.data[0].get("title", "Unknown")
        safe_logfire_info(f"✅ Project verified | project_id={project_id} | title={project_title}")

        # Parse tags (support both comma-separated string and JSON array)
        tag_list = []
        if tags:
            # Try JSON first
            try:
                parsed = json.loads(tags)
                if isinstance(parsed, list) and all(isinstance(t, str) for t in parsed):
                    tag_list = parsed
                else:
                    raise ValueError("Invalid JSON array")
            except (json.JSONDecodeError, ValueError):
                # Fall back to comma-separated
                tag_list = [t.strip() for t in tags.split(",") if t.strip()]

        safe_logfire_info(f"📋 Tags parsed | count={len(tag_list)} | tags={tag_list}")

        # Generate unique progress ID
        progress_id = str(uuid.uuid4())

        # CRITICAL: Read file content IMMEDIATELY before background task
        file_content = await file.read()
        file_metadata = {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(file_content),
        }

        safe_logfire_info(
            f"📄 File read | filename={file.filename} | size={len(file_content)} bytes | "
            f"content_type={file.content_type}"
        )

        # Initialize progress tracker IMMEDIATELY (before background task)
        tracker = ProgressTracker(progress_id, operation_type="upload")
        await tracker.start({
            "filename": file.filename,
            "project_id": project_id,
            "project_title": project_title,
            "is_project_private": is_project_private,
            "send_to_kb": send_to_kb,
            "status": "initializing",
            "progress": 0,
            "log": f"Starting upload for {file.filename} to project {project_title}"
        })

        safe_logfire_info(f"📊 Progress tracker initialized | progress_id={progress_id}")

        # Extract user ID from JWT token for audit trail
        user_id = _user.get("id") or _user.get("sub", "system")

        # Start background upload task
        upload_task = asyncio.create_task(
            _perform_project_upload_with_progress(
                progress_id=progress_id,
                project_id=project_id,
                file_content=file_content,
                file_metadata=file_metadata,
                tag_list=tag_list,
                knowledge_type=knowledge_type,
                extract_code_examples=extract_code_examples,
                is_project_private=is_project_private,
                send_to_kb=send_to_kb,
                tracker=tracker,
                user_id=user_id,
            )
        )

        # Track task for cancellation support
        active_upload_tasks[progress_id] = upload_task

        safe_logfire_info(
            f"✅ Project document upload started | progress_id={progress_id} | "
            f"project_id={project_id} | filename={file.filename}"
        )

        return {
            "success": True,
            "progressId": progress_id,
            "message": f"Document upload started for project {project_title}",
            "filename": file.filename,
            "project_id": project_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        safe_logfire_error(
            f"❌ Failed to start project document upload | error={str(e)} | "
            f"filename={file.filename if file else 'unknown'} | error_type={type(e).__name__}"
        )
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": str(e)}
        )


@router.get("/projects/{project_id}/documents")
async def list_project_documents(
    project_id: str,
    include_private: bool = True,
    limit: int = 100,
    offset: int = 0,
    _user: dict = Depends(require_document_manage)
):
    """
    List documents for a project with privacy filtering.

    Requires: document:manage permission

    Args:
        project_id: UUID of the project
        include_private: Include private documents (default: True)
        limit: Maximum number of results (default: 100)
        offset: Pagination offset (default: 0)

    Returns:
        Array of document objects with count
    """
    try:
        logfire.debug(
            f"Listing documents for project {project_id} " +
            f"(include_private: {include_private}, limit: {limit}, offset: {offset})"
        )

        document_service = ProjectDocumentService()
        success, result = await document_service.list_project_documents(
            project_id=project_id,
            include_private=include_private,
            limit=limit,
            offset=offset
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Retrieved {result['count']} documents for project {project_id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/documents/{source_id}/promote")
async def promote_document(
    source_id: str,
    request: PromoteDocumentRequest,
    project_id: str,  # Required for RBAC permission check
    _user: dict = Depends(require_document_manage)
):
    """
    Promote a project-private document to global knowledge base.

    This action:
    1. Sets is_project_private = False
    2. Records promoted_to_kb_at timestamp
    3. Records promoted_by user identifier

    Requires: document:manage permission

    Args:
        source_id: Document source ID
        request: Promotion details (promoted_by)
        project_id: Project UUID (required for RBAC check)

    Returns:
        Updated document object
    """
    try:
        logfire.debug(f"Promoting document {source_id} to global KB (promoted_by: {request.promoted_by})")

        document_service = ProjectDocumentService()
        success, result = await document_service.promote_to_knowledge_base(
            source_id=source_id,
            promoted_by=request.promoted_by
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            
            # Return 404 if document not found
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            
            # Return 400 if already in global KB
            if "already in global knowledge base" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )
            
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Document {source_id} promoted to global KB successfully")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error promoting document: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/projects/{project_id}/documents/{source_id}")
async def delete_document(
    project_id: str,
    source_id: str,
    _user: dict = Depends(require_document_manage)
):
    """
    Delete a project document.

    Requires: document:manage permission

    Args:
        project_id: UUID of the project
        source_id: Document source ID

    Returns:
        Success message
    """
    try:
        logfire.debug(f"Deleting document {source_id} from project {project_id}")

        document_service = ProjectDocumentService()
        success, result = await document_service.delete_document(
            source_id=source_id,
            project_id=project_id
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            if "not found" in error_msg.lower() or "permission denied" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Document {source_id} deleted successfully")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/documents/{source_id}")
async def get_document(
    source_id: str,
    project_id: Optional[str] = None,
    _user: dict = Depends(require_document_manage)
):
    """
    Get document details.

    Requires: document:manage permission

    Args:
        source_id: Document source ID
        project_id: Optional project UUID for filtering

    Returns:
        Document object
    """
    try:
        logfire.debug(
            f"Getting document {source_id}" +
            (f" for project {project_id}" if project_id else "")
        )

        document_service = ProjectDocumentService()
        success, result = await document_service.get_document(
            source_id=source_id,
            project_id=project_id
        )

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

        logfire.debug(f"Retrieved document {source_id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================================
# Background Upload Processing
# ============================================================================


async def _perform_project_upload_with_progress(
    progress_id: str,
    project_id: str,
    file_content: bytes,
    file_metadata: dict,
    tag_list: list[str],
    knowledge_type: str,
    extract_code_examples: bool,
    is_project_private: bool,
    send_to_kb: bool,
    tracker: ProgressTracker,
    user_id: str = "system",
):
    """
    Perform project document upload with progress tracking.

    This function runs as a background task and:
    1. Extracts text from the document
    2. Uses DocumentStorageService to process and store
    3. Updates archon_sources with project scoping
    4. Optionally promotes to global KB
    5. Tracks progress throughout

    Args:
        progress_id: Unique progress tracking ID
        project_id: Project UUID
        file_content: Raw file bytes
        file_metadata: Dict with filename, content_type, size
        tag_list: List of tags to apply
        knowledge_type: "technical" or "business"
        extract_code_examples: Whether to extract code snippets
        is_project_private: Keep document private to project
        send_to_kb: Immediately promote to global KB
        tracker: ProgressTracker instance
    """

    # Cancellation check function
    def check_upload_cancellation():
        """Check if upload task has been cancelled."""
        task = active_upload_tasks.get(progress_id)
        if task and task.cancelled():
            raise asyncio.CancelledError("Document upload was cancelled by user")

    # Import ProgressMapper to prevent progress from going backwards
    from ..services.crawling.progress_mapper import ProgressMapper
    progress_mapper = ProgressMapper()

    try:
        filename = file_metadata["filename"]
        content_type = file_metadata["content_type"]
        file_size = file_metadata["size"]

        safe_logfire_info(
            f"🚀 Background upload started | progress_id={progress_id} | "
            f"project_id={project_id} | filename={filename} | size={file_size} bytes"
        )

        # Phase 1: Extract text from document
        mapped_progress = progress_mapper.map_progress("processing", 50)
        await tracker.update(
            status="processing",
            progress=mapped_progress,
            log=f"Extracting text from {filename}",
            phase="text_extraction",
        )

        try:
            extracted_text = extract_text_from_document(file_content, filename, content_type)
            safe_logfire_info(
                f"✅ Text extracted | filename={filename} | length={len(extracted_text)} chars | "
                f"content_type={content_type}"
            )
        except ValueError as ex:
            # ValueError indicates unsupported format or empty file - user error
            logger.warning(f"Document validation failed: {filename} - {str(ex)}")
            await tracker.error(str(ex))
            return
        except Exception as ex:
            # Other exceptions are system errors
            logger.error(f"Failed to extract text from document: {filename}", exc_info=True)
            await tracker.error(f"Failed to extract text: {str(ex)}")
            return

        # Phase 2: Generate source_id with project context
        # Format: project_{project_id}_file_{filename}_{random}
        safe_filename = filename.replace(" ", "_").replace(".", "_")
        source_id = f"project_{project_id}_file_{safe_filename}_{uuid.uuid4().hex[:8]}"

        safe_logfire_info(
            f"🔖 Source ID generated | source_id={source_id} | project_id={project_id}"
        )

        # Phase 3: Use DocumentStorageService to process document
        mapped_progress = progress_mapper.map_progress("storing", 10)
        await tracker.update(
            status="storing",
            progress=mapped_progress,
            log=f"Processing and storing document in knowledge base",
            phase="document_storage",
            source_id=source_id,
        )

        doc_storage_service = DocumentStorageService(get_supabase_client())

        # Create progress callback for DocumentStorageService
        async def document_progress_callback(message: str, percentage: int, batch_info: dict = None):
            """Progress callback for document storage operations"""
            # Map storage progress (0-100) to overall progress range (storing stage)
            mapped_percentage = progress_mapper.map_progress("storing", percentage)

            await tracker.update(
                status="storing",
                progress=mapped_percentage,
                log=message,
                phase="document_storage",
                batch_info=batch_info,
            )

        # Upload document using DocumentStorageService
        success, result = await doc_storage_service.upload_document(
            file_content=extracted_text,
            filename=filename,
            source_id=source_id,
            knowledge_type=knowledge_type,
            tags=tag_list,
            extract_code_examples=extract_code_examples,
            progress_callback=document_progress_callback,
            cancellation_check=check_upload_cancellation,
        )

        if not success:
            error_msg = result.get("error", "Document storage failed")
            logger.error(f"Document storage failed: {error_msg}")
            await tracker.error(error_msg)
            return

        safe_logfire_info(
            f"✅ Document stored | source_id={source_id} | chunks={result.get('chunks_stored', 0)}"
        )

        # Phase 4: Update archon_sources with project scoping
        mapped_progress = progress_mapper.map_progress("storing", 90)
        await tracker.update(
            status="storing",
            progress=mapped_progress,
            log="Applying project scoping to document",
            phase="project_scoping",
        )

        try:
            supabase = get_supabase_client()

            # Determine final privacy settings
            final_is_private = False if send_to_kb else is_project_private
            promoted_at = None if final_is_private else "now()"

            # Update archon_sources with project_id and privacy flags
            update_data = {
                "project_id": project_id,
                "is_project_private": final_is_private,
            }

            # Add promoted_to_kb_at if sending to KB
            if send_to_kb:
                from datetime import datetime, timezone
                update_data["promoted_to_kb_at"] = datetime.now(timezone.utc).isoformat()
                update_data["promoted_by"] = user_id

            source_update = (
                supabase.table("archon_sources")
                .update(update_data)
                .eq("source_id", source_id)
                .execute()
            )

            if not source_update.data:
                logger.warning(
                    f"⚠️ Source update returned no data | source_id={source_id} | "
                    f"This may indicate the source doesn't exist yet"
                )

            safe_logfire_info(
                f"✅ Project scoping applied | source_id={source_id} | project_id={project_id} | "
                f"is_private={final_is_private} | send_to_kb={send_to_kb}"
            )

        except Exception as ex:
            logger.error(f"Failed to apply project scoping: {str(ex)}", exc_info=True)
            # Don't fail the entire upload - document is stored, just missing project link
            await tracker.update(
                status="storing",
                progress=mapped_progress,
                log=f"Warning: Project scoping partially failed - {str(ex)}",
                phase="project_scoping",
            )

        # Phase 5: Complete
        await tracker.complete({
            "source_id": source_id,
            "project_id": project_id,
            "filename": filename,
            "chunks_stored": result.get("chunks_stored", 0),
            "total_word_count": result.get("total_word_count", 0),
            "code_examples_extracted": result.get("code_examples_count", 0),
            "is_project_private": final_is_private,
            "promoted_to_kb": send_to_kb,
            "log": f"Document upload completed successfully for {filename}",
        })

        safe_logfire_info(
            f"🎉 Upload completed | progress_id={progress_id} | source_id={source_id} | "
            f"project_id={project_id} | filename={filename}"
        )

    except asyncio.CancelledError:
        safe_logfire_info(f"🛑 Upload cancelled | progress_id={progress_id}")
        await tracker.update(
            status="cancelled",
            progress=tracker.state.get("progress", 0),
            log="Upload cancelled by user",
        )
        raise

    except Exception as e:
        logger.error(f"Upload failed with error: {str(e)}", exc_info=True)
        safe_logfire_error(
            f"❌ Upload failed | progress_id={progress_id} | error={str(e)} | "
            f"error_type={type(e).__name__}"
        )
        await tracker.error(f"Upload failed: {str(e)}")

    finally:
        # CRITICAL: Always clean up task from registry
        if progress_id in active_upload_tasks:
            del active_upload_tasks[progress_id]
            safe_logfire_info(f"🧹 Task cleaned up from registry | progress_id={progress_id}")


# ============================================================================
# URL Crawling for Projects
# ============================================================================


@router.post("/projects/{project_id}/documents/crawl")
async def crawl_url_for_project(
    project_id: str = Path(..., description="Project UUID"),
    url: str = Form(..., description="URL to crawl"),
    max_depth: int = Form(1, description="Maximum crawl depth (1-5)"),
    tags: str | None = Form(None, description="Comma-separated tags or JSON array"),
    knowledge_type: str = Form("technical", description="Knowledge type: technical or business"),
    extract_code_examples: bool = Form(True, description="Extract and index code examples"),
    is_project_private: bool = Form(True, description="Keep document private to project (default: True)"),
    send_to_kb: bool = Form(False, description="Immediately promote to global knowledge base"),
    _user: dict = Depends(require_document_manage)
):
    """
    Crawl a URL and add its content to project documents with progress tracking.

    This endpoint:
    1. Validates project exists and user has permissions
    2. Validates URL format (http/https)
    3. Initializes ProgressTracker for real-time progress updates
    4. Starts background crawl task using CrawlingService
    5. Applies project scoping (project_id, is_project_private)
    6. Optionally promotes to global knowledge base
    7. Returns progressId for polling via /api/progress/{progressId}

    Requires: document:manage permission

    Args:
        project_id: UUID of the project
        url: URL to crawl (must be http:// or https://)
        max_depth: Maximum crawl depth (1-5, default: 1)
        tags: Comma-separated tags or JSON array of tags
        knowledge_type: "technical" (code/APIs) or "business" (guides/policies)
        extract_code_examples: Whether to extract and index code snippets
        is_project_private: True = project-only, False = global KB
        send_to_kb: True = immediately promote to KB (overrides is_project_private)

    Returns:
        {
            "success": true,
            "progressId": "uuid",
            "message": "URL crawl started",
            "url": "https://example.com",
            "max_depth": 1
        }

    Progress Tracking:
        Poll GET /api/progress/{progressId} for real-time updates:
        - status: "starting" | "crawling" | "storing" | "completed" | "error"
        - progress: 0-100 percentage
        - log: Latest status message
        - currentUrl: Currently processing URL (for crawls)
    """
    try:
        safe_logfire_info(
            f"🔗 PROJECT CRAWL: Starting | project_id={project_id} | url={url} | "
            f"max_depth={max_depth} | is_project_private={is_project_private} | send_to_kb={send_to_kb}"
        )

        # Step 1: Verify project exists
        supabase = get_supabase_client()
        project_check = supabase.table("archon_projects").select("id, title").eq("id", project_id).execute()

        if not project_check.data:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )

        project_title = project_check.data[0].get("title", "Unknown")
        safe_logfire_info(f"✅ Project verified | project_id={project_id} | title={project_title}")

        # Step 2: Validate URL format
        from urllib.parse import urlparse

        if not url:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="URL is required"
            )

        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid URL format - must include protocol and domain"
            )
        if parsed.scheme not in ["http", "https"]:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="URL must be http or https"
            )

        safe_logfire_info(f"✅ URL validated | url={url}")

        # Step 3: Validate max_depth range
        if not (1 <= max_depth <= 5):
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="max_depth must be between 1 and 5"
            )

        # Step 4: Parse tags (support both comma-separated string and JSON array)
        tag_list = []
        if tags:
            # Try JSON first
            try:
                parsed_tags = json.loads(tags)
                if isinstance(parsed_tags, list) and all(isinstance(t, str) for t in parsed_tags):
                    tag_list = parsed_tags
                else:
                    raise ValueError("Invalid JSON array")
            except (json.JSONDecodeError, ValueError):
                # Fall back to comma-separated
                tag_list = [t.strip() for t in tags.split(",") if t.strip()]

        safe_logfire_info(f"📋 Tags parsed | count={len(tag_list)} | tags={tag_list}")

        # Step 5: Generate unique progress ID
        progress_id = str(uuid.uuid4())

        # Step 6: Initialize progress tracker IMMEDIATELY (before background task)
        tracker = ProgressTracker(progress_id, operation_type="crawl")
        await tracker.start({
            "url": url,
            "current_url": url,
            "max_depth": max_depth,
            "project_id": project_id,
            "project_title": project_title,
            "is_project_private": is_project_private,
            "send_to_kb": send_to_kb,
            "crawl_type": "project_crawl",
            "status": "initializing",
            "progress": 0,
            "log": f"Starting crawl for {url} in project {project_title}"
        })

        safe_logfire_info(f"📊 Progress tracker initialized | progress_id={progress_id}")

        # Step 7: Extract user ID from JWT token for audit trail
        user_id = _user.get("id") or _user.get("sub", "system")

        # Step 8: Start background crawl task
        crawl_task = asyncio.create_task(
            _perform_project_crawl_with_progress(
                progress_id=progress_id,
                project_id=project_id,
                url=url,
                max_depth=max_depth,
                tag_list=tag_list,
                knowledge_type=knowledge_type,
                extract_code_examples=extract_code_examples,
                is_project_private=is_project_private,
                send_to_kb=send_to_kb,
                tracker=tracker,
                user_id=user_id,
            )
        )

        # Track task for cancellation support
        active_upload_tasks[progress_id] = crawl_task

        safe_logfire_info(
            f"✅ Project URL crawl started | progress_id={progress_id} | "
            f"project_id={project_id} | url={url}"
        )

        return {
            "success": True,
            "progressId": progress_id,
            "message": f"URL crawl started for project {project_title}",
            "url": url,
            "max_depth": max_depth,
            "project_id": project_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        safe_logfire_error(
            f"❌ Failed to start project URL crawl | error={str(e)} | "
            f"url={url} | error_type={type(e).__name__}"
        )
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": str(e)}
        )


async def _perform_project_crawl_with_progress(
    progress_id: str,
    project_id: str,
    url: str,
    max_depth: int,
    tag_list: list[str],
    knowledge_type: str,
    extract_code_examples: bool,
    is_project_private: bool,
    send_to_kb: bool,
    tracker: ProgressTracker,
    user_id: str = "system",
):
    """
    Perform project URL crawl with progress tracking in background.

    This function runs as a background task and:
    1. Uses CrawlingService to crawl URL (reuses existing logic)
    2. Generates source_id with project context
    3. Updates archon_sources with project scoping
    4. Optionally promotes to global KB
    5. Tracks progress throughout
    6. Handles cancellation and cleanup

    Args:
        progress_id: Unique progress tracking ID
        project_id: Project UUID
        url: URL to crawl
        max_depth: Maximum crawl depth (1-5)
        tag_list: List of tags to apply
        knowledge_type: "technical" or "business"
        extract_code_examples: Whether to extract code snippets
        is_project_private: Keep document private to project
        send_to_kb: Immediately promote to global KB
        tracker: ProgressTracker instance
        user_id: User ID for audit trail
    """

    # Cancellation check function
    def check_crawl_cancellation():
        """Check if crawl task has been cancelled."""
        task = active_upload_tasks.get(progress_id)
        if task and task.cancelled():
            raise asyncio.CancelledError("URL crawl was cancelled by user")

    try:
        safe_logfire_info(
            f"🚀 Background crawl started | progress_id={progress_id} | "
            f"project_id={project_id} | url={url} | max_depth={max_depth}"
        )

        # Phase 1: Get crawler and initialize CrawlingService
        from ..services.crawler_manager import get_crawler
        from ..services.crawling.crawling_service import CrawlingService

        # Get crawler from CrawlerManager
        try:
            crawler = await get_crawler()
            if crawler is None:
                raise Exception("Crawler not available - initialization may have failed")
        except Exception as e:
            safe_logfire_error(f"Failed to get crawler | error={str(e)}")
            await tracker.error(f"Failed to initialize crawler: {str(e)}")
            return

        supabase = get_supabase_client()
        crawl_service = CrawlingService(crawler, supabase)

        # Phase 2: Generate source_id with project context
        # Format: project_{project_id}_url_{domain}_{random}
        from urllib.parse import urlparse
        parsed_url = urlparse(url)
        sanitized_domain = parsed_url.netloc.replace(".", "_").replace("-", "_")
        source_id = f"project_{project_id}_url_{sanitized_domain}_{uuid.uuid4().hex[:8]}"

        safe_logfire_info(
            f"🔖 Source ID generated | source_id={source_id} | project_id={project_id} | domain={parsed_url.netloc}"
        )

        # Phase 3: Create progress callback for CrawlingService
        async def crawl_progress_callback(message: str, percentage: int, current_url: str = None):
            """Progress callback for crawl operations"""
            update_data = {
                "status": "crawling",
                "progress": min(100, max(0, percentage)),  # Ensure 0-100
                "log": message,
            }
            if current_url:
                update_data["current_url"] = current_url

            await tracker.update(**update_data)

        # Phase 4: Perform crawl using CrawlingService
        await tracker.update(
            status="crawling",
            progress=5,
            log=f"Starting crawl of {url}",
            current_url=url,
        )

        # Set progress_id on crawl service for tracking
        crawl_service.set_progress_id(progress_id)

        # Build request dict for CrawlingService.orchestrate_crawl
        crawl_request = {
            "url": url,
            "knowledge_type": knowledge_type,
            "tags": tag_list,
            "max_depth": max_depth,
            "extract_code_examples": extract_code_examples,
            "generate_summary": True,
            "_source_id_override": source_id,  # Use our project-scoped source_id
        }

        # Call CrawlingService.orchestrate_crawl (reuses existing logic)
        # This returns immediately with a task reference
        orchestrate_result = await crawl_service.orchestrate_crawl(crawl_request)

        # Get the actual crawl task for proper tracking
        crawl_task = orchestrate_result.get("task")
        if crawl_task:
            # Store the actual crawl task (overwrites the wrapper task)
            active_upload_tasks[progress_id] = crawl_task
            safe_logfire_info(
                f"Stored actual crawl task | progress_id={progress_id} | task_name={crawl_task.get_name()}"
            )

            # Wait for crawl task to complete
            try:
                await crawl_task
                safe_logfire_info(
                    f"✅ Crawl completed successfully | source_id={source_id} | progress_id={progress_id}"
                )
            except asyncio.CancelledError:
                safe_logfire_info(f"Crawl task cancelled | progress_id={progress_id}")
                raise
            except Exception as crawl_ex:
                error_msg = f"Crawl failed: {str(crawl_ex)}"
                logger.error(error_msg, exc_info=True)
                await tracker.error(error_msg)
                return
        else:
            error_msg = "No task returned from orchestrate_crawl"
            logger.error(error_msg)
            await tracker.error(error_msg)
            return

        # Phase 5: Update archon_sources with project scoping
        await tracker.update(
            status="storing",
            progress=90,
            log="Applying project scoping to crawled content",
        )

        try:
            # Determine final privacy settings
            final_is_private = False if send_to_kb else is_project_private

            # Update archon_sources with project_id and privacy flags
            update_data = {
                "project_id": project_id,
                "is_project_private": final_is_private,
            }

            # Add promoted_to_kb_at if sending to KB
            if send_to_kb:
                from datetime import datetime, timezone
                update_data["promoted_to_kb_at"] = datetime.now(timezone.utc).isoformat()
                update_data["promoted_by"] = user_id

            source_update = (
                supabase.table("archon_sources")
                .update(update_data)
                .eq("source_id", source_id)
                .execute()
            )

            if not source_update.data:
                logger.warning(
                    f"⚠️ Source update returned no data | source_id={source_id} | "
                    f"This may indicate the source doesn't exist yet"
                )

            safe_logfire_info(
                f"✅ Project scoping applied | source_id={source_id} | project_id={project_id} | "
                f"is_private={final_is_private} | send_to_kb={send_to_kb}"
            )

        except Exception as ex:
            logger.error(f"Failed to apply project scoping: {str(ex)}", exc_info=True)
            # Don't fail the entire crawl - content is stored, just missing project link
            await tracker.update(
                status="storing",
                progress=90,
                log=f"Warning: Project scoping partially failed - {str(ex)}",
            )

        # Phase 6: Complete
        await tracker.complete({
            "source_id": source_id,
            "project_id": project_id,
            "url": url,
            "pages_crawled": result.get("pages_crawled", 0),
            "chunks_stored": result.get("chunks_stored", 0),
            "code_examples_extracted": result.get("code_examples_count", 0),
            "is_project_private": final_is_private,
            "promoted_to_kb": send_to_kb,
            "log": f"URL crawl completed successfully for {url}",
        })

        safe_logfire_info(
            f"🎉 Crawl completed | progress_id={progress_id} | source_id={source_id} | "
            f"project_id={project_id} | url={url}"
        )

    except asyncio.CancelledError:
        safe_logfire_info(f"🛑 Crawl cancelled | progress_id={progress_id}")
        await tracker.update(
            status="cancelled",
            progress=tracker.state.get("progress", 0),
            log="Crawl cancelled by user",
        )
        raise

    except Exception as e:
        logger.error(f"Crawl failed with error: {str(e)}", exc_info=True)
        safe_logfire_error(
            f"❌ Crawl failed | progress_id={progress_id} | error={str(e)} | "
            f"error_type={type(e).__name__}"
        )
        await tracker.error(f"Crawl failed: {str(e)}")

    finally:
        # CRITICAL: Always clean up task from registry
        if progress_id in active_upload_tasks:
            del active_upload_tasks[progress_id]
            safe_logfire_info(f"🧹 Task cleaned up from registry | progress_id={progress_id}")
