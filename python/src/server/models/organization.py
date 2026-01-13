"""
Organization and OrganizationMember models for Archon User Management System.

SQLAlchemy ORM models for archon_organizations and archon_organization_members tables.
Pydantic schemas for API request/response validation.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, validator


class OrganizationMemberRole(str, Enum):
    """Organization member role enum"""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class OrganizationBase(BaseModel):
    """Base organization schema"""
    name: str = Field(..., min_length=3, max_length=255)
    slug: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = None

    @validator('slug')
    def validate_slug(cls, v):
        """Validate slug format (lowercase, hyphens only)"""
        if not v.islower():
            raise ValueError('Slug must be lowercase')
        if not all(c.isalnum() or c == '-' for c in v):
            raise ValueError('Slug can only contain lowercase letters, numbers, and hyphens')
        return v


class OrganizationCreate(OrganizationBase):
    """Schema for creating a new organization"""
    logo_url: Optional[str] = Field(None, max_length=500)
    primary_color: Optional[str] = Field(None, max_length=7)
    secondary_color: Optional[str] = Field(None, max_length=7)
    max_members: int = Field(50, ge=1, le=10000)

    @validator('primary_color', 'secondary_color')
    def validate_color(cls, v):
        """Validate hex color format"""
        if v and not v.startswith('#'):
            raise ValueError('Color must start with #')
        if v and len(v) != 7:
            raise ValueError('Color must be in #RRGGBB format')
        return v


class OrganizationUpdate(BaseModel):
    """Schema for updating organization"""
    name: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = Field(None, max_length=500)
    primary_color: Optional[str] = Field(None, max_length=7)
    secondary_color: Optional[str] = Field(None, max_length=7)
    max_members: Optional[int] = Field(None, ge=1, le=10000)


class OrganizationResponse(BaseModel):
    """Schema for organization data in API responses"""
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    owner_id: UUID
    logo_url: Optional[str]
    primary_color: Optional[str]
    secondary_color: Optional[str]
    is_active: bool
    max_members: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationMemberBase(BaseModel):
    """Base organization member schema"""
    role: OrganizationMemberRole = OrganizationMemberRole.MEMBER


class OrganizationMemberCreate(OrganizationMemberBase):
    """Schema for adding a member to an organization"""
    user_id: UUID
    organization_id: UUID


class OrganizationMemberUpdate(BaseModel):
    """Schema for updating member role/status"""
    role: Optional[OrganizationMemberRole] = None
    is_active: Optional[bool] = None


class OrganizationMemberResponse(BaseModel):
    """Schema for organization member data in API responses"""
    id: UUID
    organization_id: UUID
    user_id: UUID
    role: str
    invited_by: Optional[UUID]
    invited_at: datetime
    joined_at: Optional[datetime]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationWithMembers(OrganizationResponse):
    """Organization with member count"""
    member_count: int

    class Config:
        from_attributes = True


# ============================================================================
# SQLAlchemy ORM Models (for reference)
# ============================================================================

"""
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Organization(Base):
    __tablename__ = "archon_organizations"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    owner_id = Column(PG_UUID(as_uuid=True), nullable=False)
    logo_url = Column(String(500))
    primary_color = Column(String(7))
    secondary_color = Column(String(7))
    is_active = Column(Boolean, nullable=False, default=True)
    max_members = Column(Integer, nullable=False, default=50)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
    deleted_at = Column(DateTime(timezone=True))


class OrganizationMember(Base):
    __tablename__ = "archon_organization_members"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(PG_UUID(as_uuid=True), nullable=False)
    user_id = Column(PG_UUID(as_uuid=True), nullable=False)
    role = Column(String(20), nullable=False, default='member')
    invited_by = Column(PG_UUID(as_uuid=True))
    invited_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
    joined_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
"""
