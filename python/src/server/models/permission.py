"""
User Permission models for Archon RBAC System.

Pydantic schemas for user permission API request/response validation.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PermissionKey(str, Enum):
    """Available permission keys for RBAC system"""

    VIEW_PROJECTS = "view_projects"
    VIEW_TASKS = "view_tasks"
    VIEW_KNOWLEDGE_BASE = "view_knowledge_base"
    VIEW_MCP_INSPECTOR = "view_mcp_inspector"
    VIEW_TEST_FOUNDATION = "view_test_foundation"
    VIEW_AGENT_WORK_ORDERS = "view_agent_work_orders"
    MANAGE_DATABASE_SYNC = "manage_database_sync"
    MANAGE_USERS = "manage_users"
    EDIT_SETTINGS = "edit_settings"


class UserPermissionBase(BaseModel):
    """Base permission schema"""

    permission_key: PermissionKey
    notes: Optional[str] = Field(None, max_length=1000)


class UserPermissionCreate(UserPermissionBase):
    """Schema for granting a permission to a user"""

    user_id: UUID
    granted_by: Optional[UUID] = None


class UserPermissionRevoke(BaseModel):
    """Schema for revoking a permission from a user"""

    user_id: UUID
    permission_key: PermissionKey
    revoked_by: Optional[UUID] = None


class UserPermissionResponse(BaseModel):
    """Schema for permission data in API responses"""

    id: UUID
    user_id: UUID
    permission_key: PermissionKey
    granted_at: datetime
    granted_by: Optional[UUID]
    revoked_at: Optional[datetime]
    revoked_by: Optional[UUID]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserPermissionCheck(BaseModel):
    """Schema for checking if user has permission"""

    user_id: UUID
    permission_key: PermissionKey


class UserPermissionCheckResponse(BaseModel):
    """Response for permission check"""

    has_permission: bool
    permission_key: PermissionKey


class UserPermissionsListResponse(BaseModel):
    """Response for listing user's active permissions"""

    user_id: UUID
    permissions: list[PermissionKey]
    total_count: int


class PermissionAuditEntry(BaseModel):
    """Audit trail entry for permission changes"""

    permission_key: PermissionKey
    granted_at: datetime
    granted_by: Optional[UUID]
    revoked_at: Optional[datetime] = None
    revoked_by: Optional[UUID] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True
