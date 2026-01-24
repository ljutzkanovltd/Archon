"""
Project Document Service Module for Archon

This module provides business logic for project-scoped document operations.
Supports project-private documents with optional promotion to global knowledge base,
drag-and-drop upload integration, and RAG processing pipeline.
"""

from datetime import datetime
from typing import Any, Optional
import os

from src.server.utils import get_supabase_client
from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class ProjectDocumentService:
    """
    Service class for project document operations

    Handles:
    - Document upload with project scoping
    - Privacy model (project-private vs global KB)
    - Document promotion workflow
    - RAG processing integration
    """

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    async def upload_document(
        self,
        project_id: str,
        url: str,
        title: Optional[str] = None,
        is_project_private: bool = True,
        source_display_name: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Upload a document to a project with privacy controls.

        Args:
            project_id: UUID of the project
            url: Document URL or file path
            title: Document title (defaults to filename from URL)
            is_project_private: Privacy flag (default: True for project-private)
            source_display_name: Display name for the source
            metadata: Optional metadata dictionary

        Returns:
            Tuple of (success, result_dict)
            result_dict contains document data or error message
        """
        try:
            # Validate project exists
            project_response = (
                self.supabase_client.table("archon_projects")
                .select("id")
                .eq("id", project_id)
                .execute()
            )

            if not project_response.data:
                return False, {"error": f"Project {project_id} not found"}

            # Generate source_id from URL (use URL as unique identifier)
            source_id = url

            # Extract title from URL if not provided
            if not title:
                title = os.path.basename(url)

            # Prepare document data
            document_data = {
                "source_id": source_id,
                "source_url": url,
                "title": title,
                "source_display_name": source_display_name or title,
                "project_id": project_id,
                "is_project_private": is_project_private,
                "metadata": metadata or {},
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }

            # Insert document
            document_response = (
                self.supabase_client.table("archon_sources")
                .insert(document_data)
                .execute()
            )

            if not document_response.data:
                return False, {"error": "Failed to create document"}

            document = document_response.data[0]
            logger.info(
                f"Uploaded document '{title}' to project {project_id} "
                f"(private: {is_project_private})"
            )

            return True, {"document": document}

        except Exception as e:
            logger.error(f"Error uploading document: {str(e)}")
            return False, {"error": str(e)}

    async def list_project_documents(
        self,
        project_id: str,
        include_private: bool = True,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[bool, dict[str, Any]]:
        """
        List documents for a project with privacy filtering.

        Args:
            project_id: UUID of the project
            include_private: Include private documents (default: True)
            limit: Maximum number of results (default: 100)
            offset: Pagination offset (default: 0)

        Returns:
            Tuple of (success, result_dict)
            result_dict contains documents array and count
        """
        try:
            # Build query
            query = (
                self.supabase_client.table("archon_sources")
                .select("*")
                .eq("project_id", project_id)
            )

            # Apply privacy filter
            if not include_private:
                query = query.eq("is_project_private", False)

            # Execute query with pagination
            documents_response = (
                query.order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )

            documents = documents_response.data or []
            logger.info(
                f"Retrieved {len(documents)} documents for project {project_id} "
                f"(include_private: {include_private})"
            )

            return True, {
                "documents": documents,
                "count": len(documents),
                "project_id": project_id,
            }

        except Exception as e:
            logger.error(f"Error listing project documents: {str(e)}")
            return False, {"error": str(e)}

    async def promote_to_knowledge_base(
        self,
        source_id: str,
        promoted_by: str,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Promote a project-private document to global knowledge base.

        This action:
        1. Sets is_project_private = False
        2. Records promoted_to_kb_at timestamp
        3. Records promoted_by user identifier

        Args:
            source_id: Document source ID
            promoted_by: User identifier performing the promotion

        Returns:
            Tuple of (success, result_dict)
            result_dict contains updated document or error message
        """
        try:
            # Fetch current document
            document_response = (
                self.supabase_client.table("archon_sources")
                .select("*")
                .eq("source_id", source_id)
                .execute()
            )

            if not document_response.data:
                return False, {"error": f"Document {source_id} not found"}

            document = document_response.data[0]

            # Validate can promote
            if not document.get("is_project_private"):
                return False, {"error": "Document is already in global knowledge base"}

            # Update document with promotion metadata
            update_data = {
                "is_project_private": False,
                "promoted_to_kb_at": datetime.utcnow().isoformat(),
                "promoted_by": promoted_by,
                "updated_at": datetime.utcnow().isoformat(),
            }

            update_response = (
                self.supabase_client.table("archon_sources")
                .update(update_data)
                .eq("source_id", source_id)
                .execute()
            )

            if not update_response.data:
                return False, {"error": "Failed to promote document"}

            updated_document = update_response.data[0]
            logger.info(
                f"Promoted document '{document.get('title')}' to global KB "
                f"(promoted_by: {promoted_by})"
            )

            return True, {"document": updated_document}

        except Exception as e:
            logger.error(f"Error promoting document: {str(e)}")
            return False, {"error": str(e)}

    async def delete_document(
        self,
        source_id: str,
        project_id: Optional[str] = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Delete a document.

        Args:
            source_id: Document source ID
            project_id: Optional project ID for validation

        Returns:
            Tuple of (success, result_dict)
            result_dict contains success message or error
        """
        try:
            # Build delete query
            query = self.supabase_client.table("archon_sources").delete().eq(
                "source_id", source_id
            )

            # Add project_id filter for security
            if project_id:
                query = query.eq("project_id", project_id)

            delete_response = query.execute()

            if not delete_response.data:
                return False, {
                    "error": f"Document {source_id} not found or permission denied"
                }

            logger.info(f"Deleted document {source_id}")
            return True, {"message": "Document deleted successfully"}

        except Exception as e:
            logger.error(f"Error deleting document: {str(e)}")
            return False, {"error": str(e)}

    async def get_document(
        self, source_id: str, project_id: Optional[str] = None
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get document details.

        Args:
            source_id: Document source ID
            project_id: Optional project ID for filtering

        Returns:
            Tuple of (success, result_dict)
            result_dict contains document data or error message
        """
        try:
            query = (
                self.supabase_client.table("archon_sources")
                .select("*")
                .eq("source_id", source_id)
            )

            if project_id:
                query = query.eq("project_id", project_id)

            document_response = query.execute()

            if not document_response.data:
                return False, {"error": f"Document {source_id} not found"}

            document = document_response.data[0]
            return True, {"document": document}

        except Exception as e:
            logger.error(f"Error getting document: {str(e)}")
            return False, {"error": str(e)}
