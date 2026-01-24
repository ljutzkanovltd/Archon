"""
Projects Services Package

This package contains all services related to project management,
including project CRUD operations, task management, document management,
versioning, progress tracking, source linking, and AI-assisted project creation.
"""

from .document_service import ProjectDocumentService
from .project_creation_service import ProjectCreationService
from .project_service import ProjectService
from .source_linking_service import SourceLinkingService
from .sprint_service import SprintService
from .task_service import TaskService
from .versioning_service import VersioningService
from .workflow_service import WorkflowService

# Alias for backward compatibility
DocumentService = ProjectDocumentService

__all__ = [
    "ProjectService",
    "TaskService",
    "DocumentService",
    "ProjectDocumentService",
    "VersioningService",
    "ProjectCreationService",
    "SourceLinkingService",
    "WorkflowService",
    "SprintService",
]
