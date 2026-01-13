"""
User and UserProfile models for Archon User Management System.

SQLAlchemy ORM models for archon_users and archon_user_profiles tables.
Pydantic schemas for API request/response validation.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, validator

# Note: This module uses asyncpg for database operations (via db_utils.py)
# SQLAlchemy models are commented out below for reference only


class UserBase(BaseModel):
    """Base user schema with common fields"""
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)


class UserCreate(UserBase):
    """Schema for creating a new user (password-based)"""
    password: str = Field(..., min_length=8, max_length=128)

    @validator('password')
    def validate_password_strength(cls, v):
        """Validate password meets minimum security requirements"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    avatar_url: Optional[str] = Field(None, max_length=500)


class UserResponse(BaseModel):
    """Schema for user data in API responses (safe fields only)"""
    id: UUID
    email: str
    full_name: str
    avatar_url: Optional[str]
    is_active: bool
    is_verified: bool
    email_verified_at: Optional[datetime]
    last_login_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True  # For SQLAlchemy ORM compatibility


class UserProfileBase(BaseModel):
    """Base user profile schema"""
    phone_number: Optional[str] = Field(None, max_length=20)
    bio: Optional[str] = None
    job_title: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=255)


class UserProfileUpdate(UserProfileBase):
    """Schema for updating user profile"""
    timezone: Optional[str] = Field(None, max_length=50)
    language: Optional[str] = Field(None, max_length=10)
    theme_preference: Optional[str] = Field(None, max_length=20)
    date_format: Optional[str] = Field(None, max_length=20)
    email_notifications: Optional[bool] = None
    desktop_notifications: Optional[bool] = None

    @validator('theme_preference')
    def validate_theme(cls, v):
        if v and v not in ['light', 'dark', 'system']:
            raise ValueError('Invalid theme preference')
        return v


class UserProfileResponse(UserProfileBase):
    """Schema for user profile data in API responses"""
    id: UUID
    user_id: UUID
    timezone: str
    language: str
    theme_preference: str
    date_format: str
    email_notifications: bool
    desktop_notifications: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserWithProfile(UserResponse):
    """Combined user + profile response"""
    profile: Optional[UserProfileResponse] = None

    class Config:
        from_attributes = True


# ============================================================================
# SQLAlchemy ORM Models
# ============================================================================
# NOTE: These models use raw table definitions that match the database schema.
# They are defined here for reference but actual database operations will use
# asyncpg for direct PostgreSQL access (see db_utils.py).
# ============================================================================

"""
Example SQLAlchemy model structure (for reference):

from sqlalchemy.ext.declarative import declarative_base
Base = declarative_base()

class User(Base):
    __tablename__ = "archon_users"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255))

    # OAuth provider fields
    oauth_provider = Column(String(50))
    oauth_provider_id = Column(String(255))
    oauth_access_token = Column(Text)
    oauth_refresh_token = Column(Text)
    oauth_token_expires_at = Column(DateTime(timezone=True))

    # Basic profile
    full_name = Column(String(255), nullable=False)
    avatar_url = Column(String(500))

    # Account status
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    email_verified_at = Column(DateTime(timezone=True))

    # Security
    last_login_at = Column(DateTime(timezone=True))
    last_login_ip = Column(INET)
    password_changed_at = Column(DateTime(timezone=True))
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True))

    # Two-Factor Authentication
    is_2fa_enabled = Column(Boolean, nullable=False, default=False)
    totp_secret = Column(String(32))

    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
    deleted_at = Column(DateTime(timezone=True))

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    organizations = relationship("OrganizationMember", back_populates="user")


class UserProfile(Base):
    __tablename__ = "archon_user_profiles"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(PG_UUID(as_uuid=True), nullable=False, unique=True)

    # Contact information
    phone_number = Column(String(20))

    # Profile fields
    bio = Column(Text)
    job_title = Column(String(100))
    website = Column(String(500))
    location = Column(String(255))

    # User preferences
    timezone = Column(String(50), nullable=False, default='UTC')
    language = Column(String(10), nullable=False, default='en')
    theme_preference = Column(String(20), nullable=False, default='system')
    date_format = Column(String(20), nullable=False, default='YYYY-MM-DD')

    # Notification preferences
    email_notifications = Column(Boolean, nullable=False, default=True)
    desktop_notifications = Column(Boolean, nullable=False, default=False)

    # Metadata
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("NOW()"))

    # Relationships
    user = relationship("User", back_populates="profile")
"""
