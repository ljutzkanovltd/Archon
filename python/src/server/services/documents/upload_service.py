"""
Document Upload Service

Handles file upload validation, storage, and metadata extraction.
Supports multipart/form-data uploads with comprehensive validation.
"""

import os
import mimetypes
from pathlib import Path
from typing import Optional, Tuple
from uuid import UUID

from fastapi import UploadFile, HTTPException
from ...config.logfire_config import get_logger
from ...utils import get_supabase_client
from ..user_access_service import UserAccessService

logger = get_logger(__name__)

# Allowed file extensions and their MIME types
ALLOWED_EXTENSIONS = {
    '.pdf': ['application/pdf'],
    '.md': ['text/markdown', 'text/plain'],
    '.txt': ['text/plain'],
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.py': ['text/x-python', 'text/plain'],
    '.js': ['application/javascript', 'text/javascript', 'text/plain'],
    '.ts': ['application/typescript', 'text/plain'],
    '.tsx': ['application/typescript', 'text/plain'],
    '.jsx': ['application/javascript', 'text/plain'],
}

# Maximum file size: 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024


class DocumentUploadService:
    """Service for handling document uploads with validation and storage."""

    def __init__(self, supabase_client=None, access_service=None):
        """
        Initialize upload service.

        Args:
            supabase_client: Optional Supabase client instance
            access_service: Optional UserAccessService instance
        """
        self.supabase_client = supabase_client or get_supabase_client()
        self.access_service = access_service or UserAccessService()

    async def validate_upload(
        self,
        file: UploadFile,
        user_id: UUID,
        project_id: UUID,
    ) -> Tuple[bool, str]:
        """
        Validate file upload against security and access requirements.

        Args:
            file: Uploaded file
            user_id: User UUID performing upload
            project_id: Target project UUID

        Returns:
            Tuple of (is_valid: bool, error_message: str)
            If valid, error_message is empty string

        Raises:
            HTTPException: For validation failures
        """
        try:
            # 1. Check file extension
            if not file.filename:
                raise HTTPException(
                    status_code=400,
                    detail="Filename is required"
                )

            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in ALLOWED_EXTENSIONS:
                allowed = ', '.join(ALLOWED_EXTENSIONS.keys())
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type: {file_ext}. Allowed: {allowed}"
                )

            # 2. Check MIME type
            content_type = file.content_type or 'application/octet-stream'
            allowed_mimes = ALLOWED_EXTENSIONS[file_ext]

            # Be lenient with MIME type detection (some browsers send generic types)
            if content_type not in allowed_mimes and content_type not in [
                'application/octet-stream',  # Generic binary
                'text/plain',  # Generic text
            ]:
                logger.warning(
                    f"MIME type mismatch | filename={file.filename} | "
                    f"content_type={content_type} | expected={allowed_mimes}"
                )
                # Don't fail, just warn (MIME detection is unreliable)

            # 3. Check file size
            # Read file to get size (FastAPI doesn't expose size directly)
            file_content = await file.read()
            file_size = len(file_content)

            # Reset file pointer for subsequent reads
            await file.seek(0)

            if file_size > MAX_FILE_SIZE:
                max_mb = MAX_FILE_SIZE / (1024 * 1024)
                actual_mb = file_size / (1024 * 1024)
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large: {actual_mb:.2f}MB (max: {max_mb:.0f}MB)"
                )

            if file_size == 0:
                raise HTTPException(
                    status_code=400,
                    detail="File is empty"
                )

            # 4. Check user permission
            has_access, reason = await self.access_service.has_project_access(
                user_id, project_id
            )

            if not has_access:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access denied to project: {reason}"
                )

            # Check if user is admin or owner
            success, is_admin = await self.access_service.is_user_admin(user_id)
            if not success or not is_admin:
                # Check if user is project owner/member
                # For now, any access is sufficient (can be refined later)
                pass

            logger.info(
                f"Upload validation passed | user_id={user_id} | "
                f"project_id={project_id} | filename={file.filename} | "
                f"size={file_size} bytes | ext={file_ext}"
            )

            return True, ""

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Upload validation error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Validation failed: {str(e)}"
            )

    async def store_file(
        self,
        file: UploadFile,
        project_id: UUID,
        user_id: UUID,
        storage_path: Optional[str] = None,
    ) -> Tuple[bool, dict]:
        """
        Store uploaded file in Supabase Storage or local filesystem.

        Args:
            file: Uploaded file
            project_id: Target project UUID
            user_id: User UUID performing upload
            storage_path: Optional custom storage path

        Returns:
            Tuple of (success: bool, result: dict)
            result contains file_path, metadata, or error message

        Raises:
            HTTPException: For storage failures
        """
        try:
            # Generate storage path if not provided
            if not storage_path:
                file_ext = Path(file.filename).suffix.lower()
                safe_filename = self._sanitize_filename(file.filename)
                storage_path = f"projects/{project_id}/documents/{safe_filename}"

            # Read file content
            file_content = await file.read()
            file_size = len(file_content)

            # Try Supabase Storage first
            try:
                storage_result = await self._store_in_supabase_storage(
                    file_content=file_content,
                    storage_path=storage_path,
                    content_type=file.content_type or 'application/octet-stream',
                )

                if storage_result['success']:
                    logger.info(
                        f"File stored in Supabase | path={storage_path} | "
                        f"size={file_size} bytes"
                    )
                    return True, {
                        'file_path': storage_path,
                        'storage_type': 'supabase',
                        'size': file_size,
                        'url': storage_result.get('url'),
                        'metadata': {
                            'filename': file.filename,
                            'content_type': file.content_type,
                            'size': file_size,
                            'project_id': str(project_id),
                            'uploaded_by': str(user_id),
                        }
                    }
            except Exception as supabase_error:
                logger.warning(
                    f"Supabase storage failed, falling back to local: {supabase_error}"
                )

            # Fallback to local filesystem storage
            local_result = await self._store_in_local_filesystem(
                file_content=file_content,
                storage_path=storage_path,
                project_id=project_id,
            )

            if local_result['success']:
                logger.info(
                    f"File stored locally | path={local_result['file_path']} | "
                    f"size={file_size} bytes"
                )
                return True, {
                    'file_path': local_result['file_path'],
                    'storage_type': 'local',
                    'size': file_size,
                    'metadata': {
                        'filename': file.filename,
                        'content_type': file.content_type,
                        'size': file_size,
                        'project_id': str(project_id),
                        'uploaded_by': str(user_id),
                    }
                }

            raise HTTPException(
                status_code=500,
                detail="Storage failed for both Supabase and local filesystem"
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"File storage error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Storage failed: {str(e)}"
            )

    async def _store_in_supabase_storage(
        self,
        file_content: bytes,
        storage_path: str,
        content_type: str,
    ) -> dict:
        """
        Store file in Supabase Storage.

        Args:
            file_content: File content bytes
            storage_path: Storage path
            content_type: MIME type

        Returns:
            dict with success status and storage details
        """
        try:
            # Supabase storage bucket (ensure it exists)
            bucket_name = os.getenv('SUPABASE_STORAGE_BUCKET', 'documents')

            # Upload file
            response = self.supabase_client.storage.from_(bucket_name).upload(
                path=storage_path,
                file=file_content,
                file_options={
                    'content-type': content_type,
                    'upsert': 'true'  # Overwrite if exists
                }
            )

            # Get public URL
            public_url = self.supabase_client.storage.from_(bucket_name).get_public_url(
                storage_path
            )

            return {
                'success': True,
                'path': storage_path,
                'url': public_url,
            }

        except Exception as e:
            logger.error(f"Supabase storage error: {str(e)}")
            return {'success': False, 'error': str(e)}

    async def _store_in_local_filesystem(
        self,
        file_content: bytes,
        storage_path: str,
        project_id: UUID,
    ) -> dict:
        """
        Store file in local filesystem as fallback.

        Args:
            file_content: File content bytes
            storage_path: Relative storage path
            project_id: Project UUID

        Returns:
            dict with success status and file path
        """
        try:
            # Base storage directory (configurable via env)
            base_dir = os.getenv('LOCAL_STORAGE_PATH', '/tmp/archon-uploads')
            full_path = Path(base_dir) / storage_path

            # Create directories
            full_path.parent.mkdir(parents=True, exist_ok=True)

            # Write file
            with open(full_path, 'wb') as f:
                f.write(file_content)

            return {
                'success': True,
                'file_path': str(full_path),
            }

        except Exception as e:
            logger.error(f"Local filesystem storage error: {str(e)}")
            return {'success': False, 'error': str(e)}

    def _sanitize_filename(self, filename: str) -> str:
        """
        Sanitize filename to prevent path traversal attacks.

        Args:
            filename: Original filename

        Returns:
            Sanitized filename
        """
        # Remove path components
        filename = os.path.basename(filename)

        # Remove or replace dangerous characters
        safe_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-')
        sanitized = ''.join(c if c in safe_chars else '_' for c in filename)

        # Ensure filename is not empty
        if not sanitized or sanitized.startswith('.'):
            sanitized = 'uploaded_file' + Path(filename).suffix

        return sanitized
