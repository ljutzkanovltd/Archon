"""
Invitation model for Archon User Management System.

SQLAlchemy ORM model for archon_invitations table.
Pydantic schemas for API request/response validation.
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class InvitationStatus(str, Enum):
    """Invitation status enum"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    REVOKED = "revoked"


class InvitationCreate(BaseModel):
    """Schema for creating an invitation"""
    organization_id: UUID
    email: EmailStr
    role: str = Field("member", max_length=20)
    expires_in_days: int = Field(7, ge=1, le=30)


class InvitationResponse(BaseModel):
    """Schema for invitation data in API responses"""
    id: UUID
    organization_id: UUID
    invited_by: UUID
    email: str
    token: str
    role: str
    status: str
    expires_at: datetime
    accepted_at: Optional[datetime]
    accepted_by: Optional[UUID]
    revoked_at: Optional[datetime]
    revoked_by: Optional[UUID]
    revocation_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class InvitationAccept(BaseModel):
    """Schema for accepting an invitation"""
    token: str = Field(..., min_length=64, max_length=64)
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    # Password only required if user doesn't exist


class InvitationRevoke(BaseModel):
    """Schema for revoking an invitation"""
    reason: Optional[str] = Field(None, max_length=500)


# ============================================================================
# SQLAlchemy ORM Model (for reference)
# ============================================================================

"""
from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Invitation(Base):
    __tablename__ = "archon_invitations"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    organization_id = Column(PG_UUID(as_uuid=True), nullable=False)
    invited_by = Column(PG_UUID(as_uuid=True), nullable=False)
    email = Column(String(255), nullable=False)
    token = Column(String(64), unique=True, nullable=False)
    role = Column(String(20), nullable=False, default='member')
    status = Column(String(20), nullable=False, default='pending')
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True))
    accepted_by = Column(PG_UUID(as_uuid=True))
    revoked_at = Column(DateTime(timezone=True))
    revoked_by = Column(PG_UUID(as_uuid=True))
    revocation_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
"""
