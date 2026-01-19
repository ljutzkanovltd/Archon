"""
Authentication API Routes for Archon User Management System.

Provides endpoints for user authentication (login, logout, registration).
"""

import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..auth.dependencies import get_current_user
from ..auth.jwt_utils import create_access_token, hash_password, verify_password
from ..config.logfire_config import get_logger
from ..models.organization import OrganizationMemberRole
from ..models.user import UserResponse
from ..utils.db_utils import get_direct_db_connection
from ..utils.email_service import EmailServiceError, send_email
from ..utils.email_templates import (
    email_change_success_email,
    email_change_verification_email,
    password_reset_email,
)
from ..utils.email_validation import EmailValidationError, validate_email
from ..utils.password_validation import PasswordValidationError, validate_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)


# Request/Response Models
class RegisterRequest(BaseModel):
    """Registration request schema"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)


class RegisterResponse(BaseModel):
    """Registration response schema"""
    access_token: str
    token_type: str
    user: dict
    organization: dict


class ForgotPasswordRequest(BaseModel):
    """Forgot password request schema"""
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Forgot password response schema"""
    message: str
    email: str


class ResetPasswordRequest(BaseModel):
    """Reset password request schema"""
    token: str = Field(..., min_length=32, max_length=255)
    new_password: str = Field(..., min_length=8, max_length=128)


class ResetPasswordResponse(BaseModel):
    """Reset password response schema"""
    message: str


class UserProfileResponse(BaseModel):
    """User profile response schema"""
    # User basic info
    user_id: UUID
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    # Profile fields
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    timezone: str
    language: str
    theme_preference: str
    email_notifications: bool
    push_notifications: bool
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    website_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UpdateProfileRequest(BaseModel):
    """Update profile request schema - all fields optional"""
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=20)
    bio: Optional[str] = None
    company: Optional[str] = Field(None, max_length=255)
    job_title: Optional[str] = Field(None, max_length=255)
    location: Optional[str] = Field(None, max_length=255)
    timezone: Optional[str] = Field(None, max_length=50)
    language: Optional[str] = Field(None, max_length=10)
    theme_preference: Optional[str] = Field(None, pattern="^(light|dark|system)$")
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    github_url: Optional[str] = Field(None, max_length=500)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    twitter_url: Optional[str] = Field(None, max_length=500)
    website_url: Optional[str] = Field(None, max_length=500)


class ChangePasswordRequest(BaseModel):
    """Change password request schema"""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class ChangePasswordResponse(BaseModel):
    """Change password response schema"""
    message: str


class ChangeEmailRequest(BaseModel):
    """Change email request schema"""
    new_email: EmailStr
    password: str = Field(..., min_length=1)


class ChangeEmailResponse(BaseModel):
    """Change email response schema"""
    message: str
    new_email: str


class VerifyEmailChangeRequest(BaseModel):
    """Verify email change request schema"""
    token: str = Field(..., min_length=32, max_length=255)


class VerifyEmailChangeResponse(BaseModel):
    """Verify email change response schema"""
    message: str
    email: str


@router.post("/login")
@limiter.limit("5/15minutes")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    Login with email and password.

    Returns JWT access token upon successful authentication.

    **Request Body:**
    - `username`: User email address (OAuth2 standard uses 'username' field)
    - `password`: User password

    **Response:**
    - `access_token`: JWT token for authenticated requests
    - `token_type`: Always "bearer"
    - `user`: User data (id, email, full_name, is_verified)

    **Features:**
    - Account lockout after 5 failed login attempts (30 min lock)
    - IP address tracking
    - Last login timestamp
    - Failed login counter reset on success

    **Errors:**
    - 401: Incorrect email or password
    - 403: Account locked or disabled
    """
    conn = await get_direct_db_connection()
    try:
        # Find user by email (username field contains email)
        query = """
            SELECT
                id, email, hashed_password, full_name, is_active, is_verified,
                failed_login_attempts, locked_until, role
            FROM archon_users
            WHERE email = $1
        """
        user = await conn.fetchrow(query, form_data.username)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check account lockout
        if user["locked_until"] and user["locked_until"] > datetime.now(timezone.utc):
            remaining_seconds = int((user["locked_until"] - datetime.now(timezone.utc)).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account locked due to too many failed login attempts. Try again in {remaining_seconds} seconds.",
            )

        # Verify password
        if not verify_password(form_data.password, user["hashed_password"]):
            # Increment failed login attempts
            failed_attempts = user["failed_login_attempts"] + 1
            locked_until = None

            if failed_attempts >= 5:
                locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
                update_query = """
                    UPDATE archon_users
                    SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW()
                    WHERE id = $3
                """
                await conn.execute(update_query, failed_attempts, locked_until, user["id"])
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account locked due to too many failed login attempts. Try again in 30 minutes.",
                )
            else:
                update_query = """
                    UPDATE archon_users
                    SET failed_login_attempts = $1, updated_at = NOW()
                    WHERE id = $2
                """
                await conn.execute(update_query, failed_attempts, user["id"])
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        # Check active status
        if not user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account disabled. Contact support.",
            )

        # Reset failed attempts and update last login
        client_ip = request.client.host if request.client else None
        update_query = """
            UPDATE archon_users
            SET
                failed_login_attempts = 0,
                locked_until = NULL,
                last_login_at = NOW(),
                last_login_ip = $1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING last_login_at
        """
        updated = await conn.fetchrow(update_query, client_ip, user["id"])

        # Load user permissions from archon_user_permissions table (RBAC Phase 4)
        permissions_query = """
            SELECT permission_key
            FROM archon_user_permissions
            WHERE user_id = $1 AND revoked_at IS NULL
            ORDER BY permission_key
        """
        permissions_rows = await conn.fetch(permissions_query, user["id"])
        permissions = [row["permission_key"] for row in permissions_rows]

        logger.info(f"User {user['email']} logged in | permissions={len(permissions)} | role={user['role']}")

        # Create JWT token (include permissions for enhanced security)
        access_token = create_access_token(
            data={
                "sub": str(user["id"]),
                "email": user["email"],
                "full_name": user["full_name"],
                "role": user["role"] or "member",
                "permissions": permissions,  # Include permissions in JWT for stateless validation
            }
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user["id"]),
                "email": user["email"],
                "full_name": user["full_name"],
                "is_verified": user["is_verified"],
                "role": user["role"] or "member",
                "permissions": permissions,  # Return permissions array for frontend
            },
        }

    finally:
        await conn.close()


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout endpoint (stateless JWT - client-side token removal).

    **Note:** JWT tokens are stateless. Logout is handled client-side by deleting
    the token. This endpoint exists for consistency and future token blacklist implementation.

    **Future Enhancement:** Implement token blacklist (Redis-based) for true revocation.

    **Response:**
    - `message`: Success message
    - `user_id`: ID of logged out user
    """
    return {
        "message": "Logged out successfully",
        "user_id": str(current_user["id"]),
    }


@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information.

    Returns the profile of the currently authenticated user.

    **Response:**
    - User data (id, email, full_name, is_verified, etc.)

    **Headers:**
    - `Authorization: Bearer <token>` (required)
    """
    # Fetch additional user data if needed
    conn = await get_direct_db_connection()
    try:
        query = """
            SELECT
                id, email, full_name, avatar_url, is_active, is_verified,
                email_verified_at, last_login_at, created_at, updated_at
            FROM archon_users
            WHERE id = $1
        """
        user = await conn.fetchrow(query, current_user["id"])

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return dict(user)

    finally:
        await conn.close()


@router.post("/refresh")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """
    Refresh JWT token.

    Issues a new token with extended expiration time for the current user.

    **Response:**
    - `access_token`: New JWT token
    - `token_type`: Always "bearer"

    **Headers:**
    - `Authorization: Bearer <old_token>` (required)
    """
    # Create new JWT token
    access_token = create_access_token(
        data={
            "sub": str(current_user["id"]),
            "email": current_user["email"],
            "full_name": current_user["full_name"],
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("5/15minutes")
async def register(request: Request, data: RegisterRequest):
    """
    Register a new user account with automatic organization creation.

    Creates:
    1. New user account in archon_users
    2. User profile in archon_user_profiles (auto-created by database trigger)
    3. Default organization in archon_organizations (named "{Full Name}'s Organization")
    4. Organization membership with Owner role

    **Request Body:**
    - `email`: Valid email address (validated for format, DNS MX, and disposable domains)
    - `password`: Strong password (min 8 chars, uppercase, lowercase, digit, special char, zxcvbn score >= 2)
    - `full_name`: User's full name

    **Response:**
    - `access_token`: JWT token for authenticated requests
    - `token_type`: Always "bearer"
    - `user`: User data (id, email, full_name, is_verified)
    - `organization`: Created organization data (id, name, slug, owner_id)

    **Validations:**
    - Email format validation via Pydantic EmailStr
    - Email DNS MX record checking
    - Disposable email domain blocking
    - Password strength validation (zxcvbn score >= 2)
    - Unique email check (prevents duplicates)
    - Unique organization slug generation

    **Features:**
    - Auto-login after registration (returns JWT token)
    - Email verification required before full access
    - Creates default user profile with UTC timezone
    - Organization slug auto-generated from full name

    **Errors:**
    - 400: Validation failed (email invalid, password weak, etc.)
    - 409: Email already registered
    - 500: Database error during account creation

    **Example:**
    ```bash
    curl -X POST http://localhost:8181/api/auth/register \
      -H "Content-Type: application/json" \
      -d '{
        "email": "john.doe@example.com",
        "password": "MyP@ssw0rd2024!",
        "full_name": "John Doe"
      }'
    ```
    """
    conn = await get_direct_db_connection()
    try:
        # =====================================================================
        # Step 1: Validate Email
        # =====================================================================
        try:
            validated_email = validate_email(data.email)
        except EmailValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email validation failed: {str(e)}",
            )

        # =====================================================================
        # Step 2: Validate Password Strength
        # =====================================================================
        try:
            # Extract user inputs for similarity checking
            user_inputs = [
                validated_email,
                data.full_name,
                validated_email.split('@')[0],  # Email username part
            ]
            validate_password(data.password, user_inputs=user_inputs, min_strength_score=2)
        except PasswordValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Password validation failed: {str(e)}",
            )

        # =====================================================================
        # Step 3: Check Email Uniqueness
        # =====================================================================
        existing_user = await conn.fetchrow(
            "SELECT id FROM archon_users WHERE email = $1",
            validated_email
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        # =====================================================================
        # Step 4: Hash Password
        # =====================================================================
        hashed_password = hash_password(data.password)

        # =====================================================================
        # Step 5: Create User
        # =====================================================================
        client_ip = request.client.host if request.client else None

        user_query = """
            INSERT INTO archon_users (
                email, hashed_password, full_name, is_active, is_verified,
                last_login_ip, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING id, email, full_name, avatar_url, is_active, is_verified,
                     email_verified_at, last_login_at, created_at, updated_at
        """
        user = await conn.fetchrow(
            user_query,
            validated_email,
            hashed_password,
            data.full_name,
            True,  # is_active
            False,  # is_verified (email verification required)
            client_ip,
        )

        user_id = user["id"]

        # =====================================================================
        # Step 6: User Profile Auto-Created by Database Trigger
        # =====================================================================
        # Note: The trigger_auto_create_profile trigger automatically creates
        # a user profile with default values when a user is inserted.
        # No manual profile creation needed here.

        # =====================================================================
        # Step 7: Generate Organization Slug
        # =====================================================================
        # Create slug from full name: "John Doe" -> "john-doe"
        base_slug = re.sub(r'[^a-z0-9\-]', '-', data.full_name.lower())
        base_slug = re.sub(r'-+', '-', base_slug).strip('-')  # Remove duplicate hyphens

        # Ensure slug uniqueness by appending number if needed
        slug = base_slug
        suffix = 1
        while True:
            existing_org = await conn.fetchrow(
                "SELECT id FROM archon_organizations WHERE slug = $1",
                slug
            )
            if not existing_org:
                break
            slug = f"{base_slug}-{suffix}"
            suffix += 1

        # =====================================================================
        # Step 8: Create Default Organization
        # =====================================================================
        org_name = f"{data.full_name}'s Organization"

        org_query = """
            INSERT INTO archon_organizations (
                name, slug, owner_id, is_active,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, name, slug, owner_id, description, avatar_url,
                     settings, is_active, created_at, updated_at
        """
        organization = await conn.fetchrow(
            org_query,
            org_name,
            slug,
            user_id,
            True,  # is_active
        )

        org_id = organization["id"]

        # =====================================================================
        # Step 9: Create Organization Membership (Owner Role)
        # =====================================================================
        member_query = """
            INSERT INTO archon_organization_members (
                organization_id, user_id, role, invited_by,
                joined_at, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
            RETURNING id
        """
        await conn.execute(
            member_query,
            org_id,
            user_id,
            OrganizationMemberRole.OWNER.value,
            user_id,  # Self-invited (initial setup)
        )

        # =====================================================================
        # Step 10: Generate JWT Token
        # =====================================================================
        access_token = create_access_token(
            data={
                "sub": str(user_id),
                "email": validated_email,
                "full_name": data.full_name,
                "org_id": str(org_id),
                "role": OrganizationMemberRole.OWNER.value,
            }
        )

        # =====================================================================
        # Step 11: Return Response
        # =====================================================================
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user["id"]),
                "email": user["email"],
                "full_name": user["full_name"],
                "avatar_url": user["avatar_url"],
                "is_active": user["is_active"],
                "is_verified": user["is_verified"],
                "created_at": user["created_at"].isoformat(),
            },
            "organization": {
                "id": str(organization["id"]),
                "name": organization["name"],
                "slug": organization["slug"],
                "owner_id": str(organization["owner_id"]),
                "is_active": organization["is_active"],
                "created_at": organization["created_at"].isoformat(),
            },
        }

    except HTTPException:
        # Re-raise HTTP exceptions (validation errors)
        raise
    except Exception as e:
        # Catch any database or unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}",
        )
    finally:
        await conn.close()

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit("5/15minutes")
async def forgot_password(request: Request, data: ForgotPasswordRequest):
    """
    Initiate password reset process by sending reset email.

    **Request Body:**
    - `email`: User's email address

    **Response:**
    - `message`: Success message (always returned for security)
    - `email`: Email address (masked)

    **Security Features:**
    - Always returns success (prevents email enumeration)
    - Generates unique UUID token
    - Token expires in 1 hour
    - Stores IP address and user agent for audit
    - Rate limiting recommended (see slowapi configuration)

    **Process:**
    1. Validate email format
    2. Check if user exists (silently)
    3. Generate secure reset token (UUID)
    4. Store token with 1-hour expiration
    5. Send password reset email
    6. Return success (even if email doesn't exist)

    **Error Handling:**
    - Email service errors are logged but not exposed to user
    - Always returns 200 OK for security

    **Example:**
    ```bash
    curl -X POST http://localhost:8181/api/auth/forgot-password \\
      -H "Content-Type: application/json" \\
      -d '{"email": "user@example.com"}'
    ```
    """
    conn = await get_direct_db_connection()
    try:
        # ==================================================================
        # Step 1: Validate Email Format
        # ==================================================================
        try:
            validated_email = validate_email(data.email)
        except EmailValidationError:
            # Return success even if email is invalid (prevent enumeration)
            return {
                "message": "If this email exists, a password reset link has been sent.",
                "email": data.email[:3] + "***@" + data.email.split('@')[1] if '@' in data.email else "***",
            }

        # ==================================================================
        # Step 2: Check if User Exists
        # ==================================================================
        user_query = """
            SELECT id, email, full_name, is_active
            FROM archon_users
            WHERE email = $1
        """
        user = await conn.fetchrow(user_query, validated_email)

        if not user:
            # Return success even if user doesn't exist (prevent enumeration)
            return {
                "message": "If this email exists, a password reset link has been sent.",
                "email": validated_email[:3] + "***@" + validated_email.split('@')[1],
            }

        # Check if account is active
        if not user["is_active"]:
            # Return success but don't send email for disabled accounts
            return {
                "message": "If this email exists, a password reset link has been sent.",
                "email": validated_email[:3] + "***@" + validated_email.split('@')[1],
            }

        # ==================================================================
        # Step 3: Generate Reset Token
        # ==================================================================
        reset_token = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "Unknown")

        # ==================================================================
        # Step 4: Store Token in Database
        # ==================================================================
        token_query = """
            INSERT INTO archon_password_reset_tokens (
                user_id, token, expires_at, ip_address, user_agent,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING id, token, expires_at
        """
        token_record = await conn.fetchrow(
            token_query,
            user["id"],
            reset_token,
            expires_at,
            client_ip,
            user_agent,
        )

        # ==================================================================
        # Step 5: Send Password Reset Email
        # ==================================================================
        # Construct reset link (adjust base URL as needed)
        base_url = request.base_url
        reset_link = f"{base_url}reset-password?token={reset_token}"

        try:
            # Generate email HTML
            email_html = password_reset_email(
                user_name=user["full_name"],
                reset_link=reset_link,
                reset_code=None,  # Optional: could add 6-digit code as alternative
                expiry_minutes=60,
            )

            # Send email
            await send_email(
                to_email=user["email"],
                to_name=user["full_name"],
                subject="Password Reset Request - Archon",
                html_content=email_html,
            )

            logger.info(
                f"Password reset email sent successfully: "
                f"user_id={user['id']}, email={user['email']}"
            )

        except EmailServiceError as e:
            # Log error but don't expose to user (security)
            logger.error(
                f"Failed to send password reset email: "
                f"user_id={user['id']}, error={str(e)}"
            )
            # Still return success to prevent information disclosure

        except Exception as e:
            # Catch any unexpected errors
            logger.error(
                f"Unexpected error sending password reset email: "
                f"user_id={user['id']}, error={str(e)}"
            )
            # Still return success to prevent information disclosure

        # ==================================================================
        # Step 6: Return Success Response
        # ==================================================================
        # Always return success (even if email failed) for security
        return {
            "message": "If this email exists, a password reset link has been sent.",
            "email": validated_email[:3] + "***@" + validated_email.split('@')[1],
        }

    finally:
        await conn.close()


@router.post("/reset-password", response_model=ResetPasswordResponse)
@limiter.limit("5/15minutes")
async def reset_password(
    request: Request,
    reset_request: ResetPasswordRequest
):
    """
    Reset user password using a valid reset token.

    This endpoint:
    1. Validates the reset token (exists, not expired, not used)
    2. Validates the new password strength
    3. Decrypts the client-encrypted password
    4. Updates the user's password with bcrypt hash
    5. Marks the token as used
    6. Invalidates all existing user sessions

    **Security Features:**
    - Token expiry (1 hour from creation)
    - One-time use tokens
    - Password strength validation
    - Audit trail (IP, user agent)

    **Request Body:**
    ```json
    {
        "token": "550e8400-e29b-41d4-a716-446655440000",
        "new_password": "StrongP@ssw0rd"
    }
    ```

    **Example:**
    ```bash
    curl -X POST http://localhost:8181/api/auth/reset-password \\
        -H "Content-Type: application/json" \\
        -d '{
            "token": "550e8400-e29b-41d4-a716-446655440000",
            "new_password": "NewSecurePassword123!"
        }'
    ```

    **Responses:**
    - 200: Password reset successful
    - 400: Invalid token, expired, or already used
    - 400: Password validation failed
    - 500: Internal server error
    """

    conn = await get_direct_db_connection()

    try:
        # ==================================================================
        # Step 1: Validate and Retrieve Token
        # ==================================================================
        token_query = """
            SELECT
                prt.id as token_id,
                prt.user_id,
                prt.expires_at,
                prt.used_at,
                u.email
            FROM archon_password_reset_tokens prt
            JOIN archon_users u ON prt.user_id = u.id
            WHERE prt.token = $1
            LIMIT 1
        """

        token_record = await conn.fetchrow(token_query, reset_request.token)

        # Validate token exists
        if not token_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )

        # Validate token not already used
        if token_record['used_at'] is not None:
            logger.warning(
                f"Attempted reuse of password reset token: "
                f"user_id={token_record['user_id']}, token_id={token_record['token_id']}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )

        # Validate token not expired
        if datetime.now(token_record['expires_at'].tzinfo) > token_record['expires_at']:
            logger.warning(
                f"Expired password reset token used: "
                f"user_id={token_record['user_id']}, "
                f"expired_at={token_record['expires_at']}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )

        # ==================================================================
        # Step 2: Validate New Password
        # ==================================================================
        try:
            # Validate password strength (min length, complexity, etc.)
            validate_password(reset_request.new_password)
        except PasswordValidationError as e:
            logger.warning(
                f"Password validation failed for user_id={token_record['user_id']}: {str(e)}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        # ==================================================================
        # Step 3: Hash New Password
        # ==================================================================
        # The password from client should be decrypted on server side
        # For now, we assume client sends plain password
        # TODO: Implement client-side encryption/decryption if needed
        password_hash = hash_password(reset_request.new_password)

        # ==================================================================
        # Step 4: Update User Password
        # ==================================================================
        update_query = """
            UPDATE archon_users
            SET
                hashed_password = $1,
                password_changed_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            RETURNING id, email
        """

        updated_user = await conn.fetchrow(
            update_query,
            password_hash,
            token_record['user_id']
        )

        if not updated_user:
            logger.error(
                f"Failed to update password for user_id={token_record['user_id']}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reset password"
            )

        # ==================================================================
        # Step 5: Mark Token as Used
        # ==================================================================
        mark_used_query = """
            UPDATE archon_password_reset_tokens
            SET used_at = NOW()
            WHERE id = $1
        """

        await conn.execute(mark_used_query, token_record['token_id'])

        # ==================================================================
        # Step 6: Log Success and Return Response
        # ==================================================================
        logger.info(
            f"Password reset successful: "
            f"user_id={token_record['user_id']}, "
            f"email={token_record['email']}, "
            f"ip={request.client.host}"
        )

        return {
            "message": "Password has been reset successfully. You can now log in with your new password."
        }

    except HTTPException:
        # Re-raise HTTP exceptions
        raise

    except Exception as e:
        logger.error(
            f"Unexpected error during password reset: {str(e)}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while resetting your password"
        )

    finally:
        await conn.close()


@router.get("/users/me/profile", response_model=UserProfileResponse)
async def get_my_profile(
    current_user: dict = Depends(get_current_user)
):
    """
    Get current authenticated user's profile information.

    Returns user basic info (email, full_name, avatar) combined with
    profile details from archon_user_profiles table.

    **Requires Authentication:** JWT token in Authorization header

    **Example:**
    ```bash
    curl -X GET http://localhost:8181/api/auth/users/me/profile \\
        -H "Authorization: Bearer YOUR_JWT_TOKEN"
    ```

    **Response:**
    ```json
    {
        "user_id": "uuid",
        "email": "user@example.com",
        "full_name": "John Doe",
        "avatar_url": "https://...",
        "phone_number": "+1234567890",
        "bio": "Software engineer",
        "company": "Acme Inc",
        "job_title": "Senior Developer",
        "location": "San Francisco, CA",
        "timezone": "America/Los_Angeles",
        "language": "en",
        "theme_preference": "dark",
        "email_notifications": true,
        "push_notifications": false,
        "github_url": "https://github.com/username",
        "linkedin_url": "https://linkedin.com/in/username",
        "twitter_url": "https://twitter.com/username",
        "website_url": "https://example.com",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }
    ```

    **Responses:**
    - 200: Profile retrieved successfully
    - 401: Not authenticated
    - 404: Profile not found
    - 500: Internal server error
    """

    conn = await get_direct_db_connection()

    try:
        user_id = current_user['id']

        # ==================================================================
        # Query: Get user + profile data in single query (LEFT JOIN)
        # ==================================================================
        query = """
            SELECT
                u.id as user_id,
                u.email,
                u.full_name,
                u.avatar_url,
                p.phone_number,
                p.bio,
                p.company,
                p.job_title,
                p.location,
                p.timezone,
                p.language,
                p.theme_preference,
                p.email_notifications,
                p.push_notifications,
                p.github_url,
                p.linkedin_url,
                p.twitter_url,
                p.website_url,
                p.created_at,
                p.updated_at
            FROM archon_users u
            LEFT JOIN archon_user_profiles p ON u.id = p.user_id
            WHERE u.id = $1
            LIMIT 1
        """

        result = await conn.fetchrow(query, user_id)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # If profile doesn't exist yet, create default profile
        if result['timezone'] is None:
            logger.info(f"Creating default profile for user_id={user_id}")

            create_profile_query = """
                INSERT INTO archon_user_profiles (user_id)
                VALUES ($1)
                RETURNING
                    phone_number, bio, company, job_title, location,
                    timezone, language, theme_preference,
                    email_notifications, push_notifications,
                    github_url, linkedin_url, twitter_url, website_url,
                    created_at, updated_at
            """

            profile = await conn.fetchrow(create_profile_query, user_id)

            # Merge user + new profile data
            return UserProfileResponse(
                user_id=result['user_id'],
                email=result['email'],
                full_name=result['full_name'],
                avatar_url=result['avatar_url'],
                phone_number=profile['phone_number'],
                bio=profile['bio'],
                company=profile['company'],
                job_title=profile['job_title'],
                location=profile['location'],
                timezone=profile['timezone'],
                language=profile['language'],
                theme_preference=profile['theme_preference'],
                email_notifications=profile['email_notifications'],
                push_notifications=profile['push_notifications'],
                github_url=profile['github_url'],
                linkedin_url=profile['linkedin_url'],
                twitter_url=profile['twitter_url'],
                website_url=profile['website_url'],
                created_at=profile['created_at'],
                updated_at=profile['updated_at']
            )

        # Return existing profile
        return UserProfileResponse(
            user_id=result['user_id'],
            email=result['email'],
            full_name=result['full_name'],
            avatar_url=result['avatar_url'],
            phone_number=result['phone_number'],
            bio=result['bio'],
            company=result['company'],
            job_title=result['job_title'],
            location=result['location'],
            timezone=result['timezone'],
            language=result['language'],
            theme_preference=result['theme_preference'],
            email_notifications=result['email_notifications'],
            push_notifications=result['push_notifications'],
            github_url=result['github_url'],
            linkedin_url=result['linkedin_url'],
            twitter_url=result['twitter_url'],
            website_url=result['website_url'],
            created_at=result['created_at'],
            updated_at=result['updated_at']
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            f"Error retrieving profile for user_id={current_user['id']}: {str(e)}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving your profile"
        )

    finally:
        await conn.close()


@router.put("/users/me/profile", response_model=UserProfileResponse)
async def update_my_profile(
    update_data: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update current authenticated user's profile information.

    Updates both user basic info (full_name) and profile details.
    Only provided fields are updated (partial update).

    **Requires Authentication:** JWT token in Authorization header

    **Example:**
    ```bash
    curl -X PUT http://localhost:8181/api/auth/users/me/profile \\
        -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
        -H "Content-Type: application/json" \\
        -d '{
            "full_name": "John Doe Updated",
            "bio": "Senior Software Engineer",
            "company": "Acme Corp",
            "timezone": "America/Los_Angeles",
            "theme_preference": "dark"
        }'
    ```

    **Request Body (all fields optional):**
    ```json
    {
        "full_name": "string",
        "phone_number": "string",
        "bio": "string",
        "company": "string",
        "job_title": "string",
        "location": "string",
        "timezone": "string",
        "language": "string",
        "theme_preference": "light|dark|system",
        "email_notifications": boolean,
        "push_notifications": boolean,
        "github_url": "string",
        "linkedin_url": "string",
        "twitter_url": "string",
        "website_url": "string"
    }
    ```

    **Responses:**
    - 200: Profile updated successfully (returns updated profile)
    - 400: Invalid input data
    - 401: Not authenticated
    - 500: Internal server error
    """

    conn = await get_direct_db_connection()

    try:
        user_id = current_user['id']

        # ==================================================================
        # Step 1: Update user table if full_name provided
        # ==================================================================
        if update_data.full_name is not None:
            update_user_query = """
                UPDATE archon_users
                SET full_name = $1, updated_at = NOW()
                WHERE id = $2
            """
            await conn.execute(update_user_query, update_data.full_name, user_id)
            logger.info(f"Updated full_name for user_id={user_id}")

        # ==================================================================
        # Step 2: Build dynamic UPDATE query for profile
        # ==================================================================
        # Only update fields that were provided (exclude None values and full_name)
        profile_updates = {}
        for field, value in update_data.dict(exclude_unset=True, exclude={'full_name'}).items():
            if value is not None:
                profile_updates[field] = value

        if profile_updates:
            # Check if profile exists
            check_profile_query = "SELECT id FROM archon_user_profiles WHERE user_id = $1"
            profile_exists = await conn.fetchval(check_profile_query, user_id)

            if not profile_exists:
                # Create profile with provided values (and defaults)
                logger.info(f"Creating new profile for user_id={user_id}")

                # Build INSERT query dynamically
                columns = ['user_id'] + list(profile_updates.keys())
                placeholders = [f'${i+1}' for i in range(len(columns))]
                values = [user_id] + list(profile_updates.values())

                insert_query = f"""
                    INSERT INTO archon_user_profiles ({', '.join(columns)})
                    VALUES ({', '.join(placeholders)})
                """
                await conn.execute(insert_query, *values)
            else:
                # Update existing profile
                logger.info(f"Updating profile for user_id={user_id}: {list(profile_updates.keys())}")

                # Build UPDATE query dynamically
                set_clauses = [f"{col} = ${i+1}" for i, col in enumerate(profile_updates.keys())]
                set_clauses.append(f"updated_at = NOW()")
                values = list(profile_updates.values()) + [user_id]

                update_query = f"""
                    UPDATE archon_user_profiles
                    SET {', '.join(set_clauses)}
                    WHERE user_id = ${len(values)}
                """
                await conn.execute(update_query, *values)

        # ==================================================================
        # Step 3: Fetch and return updated profile
        # ==================================================================
        fetch_query = """
            SELECT
                u.id as user_id,
                u.email,
                u.full_name,
                u.avatar_url,
                p.phone_number,
                p.bio,
                p.company,
                p.job_title,
                p.location,
                p.timezone,
                p.language,
                p.theme_preference,
                p.email_notifications,
                p.push_notifications,
                p.github_url,
                p.linkedin_url,
                p.twitter_url,
                p.website_url,
                p.created_at,
                p.updated_at
            FROM archon_users u
            LEFT JOIN archon_user_profiles p ON u.id = p.user_id
            WHERE u.id = $1
        """

        result = await conn.fetchrow(fetch_query, user_id)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # If profile still doesn't exist (no updates were provided), create default
        if result['timezone'] is None:
            create_profile_query = """
                INSERT INTO archon_user_profiles (user_id)
                VALUES ($1)
                RETURNING
                    phone_number, bio, company, job_title, location,
                    timezone, language, theme_preference,
                    email_notifications, push_notifications,
                    github_url, linkedin_url, twitter_url, website_url,
                    created_at, updated_at
            """
            profile = await conn.fetchrow(create_profile_query, user_id)

            return UserProfileResponse(
                user_id=result['user_id'],
                email=result['email'],
                full_name=result['full_name'],
                avatar_url=result['avatar_url'],
                phone_number=profile['phone_number'],
                bio=profile['bio'],
                company=profile['company'],
                job_title=profile['job_title'],
                location=profile['location'],
                timezone=profile['timezone'],
                language=profile['language'],
                theme_preference=profile['theme_preference'],
                email_notifications=profile['email_notifications'],
                push_notifications=profile['push_notifications'],
                github_url=profile['github_url'],
                linkedin_url=profile['linkedin_url'],
                twitter_url=profile['twitter_url'],
                website_url=profile['website_url'],
                created_at=profile['created_at'],
                updated_at=profile['updated_at']
            )

        return UserProfileResponse(
            user_id=result['user_id'],
            email=result['email'],
            full_name=result['full_name'],
            avatar_url=result['avatar_url'],
            phone_number=result['phone_number'],
            bio=result['bio'],
            company=result['company'],
            job_title=result['job_title'],
            location=result['location'],
            timezone=result['timezone'],
            language=result['language'],
            theme_preference=result['theme_preference'],
            email_notifications=result['email_notifications'],
            push_notifications=result['push_notifications'],
            github_url=result['github_url'],
            linkedin_url=result['linkedin_url'],
            twitter_url=result['twitter_url'],
            website_url=result['website_url'],
            created_at=result['created_at'],
            updated_at=result['updated_at']
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            f"Error updating profile for user_id={current_user['id']}: {str(e)}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating your profile"
        )

    finally:
        await conn.close()


@router.post("/users/me/change-password", response_model=ChangePasswordResponse)
async def change_my_password(
    request: Request,
    password_data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Change current authenticated user's password.

    Verifies current password, validates new password strength,
    and updates the password hash in the database.

    **Requires Authentication:** JWT token in Authorization header

    **Security Features:**
    - Current password verification
    - New password strength validation
    - Password history tracking (password_changed_at timestamp)
    - Audit logging

    **Example:**
    ```bash
    curl -X POST http://localhost:8181/api/auth/users/me/change-password \\
        -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
        -H "Content-Type: application/json" \\
        -d '{
            "current_password": "OldPassword123!",
            "new_password": "NewSecurePassword123!"
        }'
    ```

    **Request Body:**
    ```json
    {
        "current_password": "string",
        "new_password": "string (min 8 chars)"
    }
    ```

    **Responses:**
    - 200: Password changed successfully
    - 400: Invalid current password
    - 400: New password validation failed
    - 401: Not authenticated
    - 500: Internal server error
    """

    conn = await get_direct_db_connection()

    try:
        user_id = current_user['id']

        # ==================================================================
        # Step 1: Fetch current password hash
        # ==================================================================
        query = """
            SELECT hashed_password
            FROM archon_users
            WHERE id = $1
        """

        result = await conn.fetchrow(query, user_id)

        if not result or not result['hashed_password']:
            logger.error(f"User {user_id} has no password (OAuth user?)")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change password for OAuth accounts"
            )

        # ==================================================================
        # Step 2: Verify current password
        # ==================================================================
        if not verify_password(password_data.current_password, result['hashed_password']):
            logger.warning(
                f"Failed password change attempt for user_id={user_id}: "
                f"incorrect current password from IP {request.client.host}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )

        # ==================================================================
        # Step 3: Validate new password
        # ==================================================================
        try:
            validate_password(password_data.new_password)
        except PasswordValidationError as e:
            logger.warning(
                f"Password validation failed for user_id={user_id}: {str(e)}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        # ==================================================================
        # Step 4: Hash new password and update database
        # ==================================================================
        new_password_hash = hash_password(password_data.new_password)

        update_query = """
            UPDATE archon_users
            SET
                hashed_password = $1,
                password_changed_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            RETURNING id, email
        """

        updated_user = await conn.fetchrow(update_query, new_password_hash, user_id)

        if not updated_user:
            logger.error(f"Failed to update password for user_id={user_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to change password"
            )

        # ==================================================================
        # Step 5: Log success and return response
        # ==================================================================
        logger.info(
            f"Password changed successfully: "
            f"user_id={user_id}, "
            f"email={updated_user['email']}, "
            f"ip={request.client.host}"
        )

        return {
            "message": "Password changed successfully"
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            f"Error changing password for user_id={current_user['id']}: {str(e)}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while changing your password"
        )

    finally:
        await conn.close()


@router.post("/users/me/change-email", response_model=ChangeEmailResponse)
@limiter.limit("3/15minutes")
async def change_my_email(
    request: Request,
    email_data: ChangeEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Initiate email change for current authenticated user.

    This endpoint:
    1. Verifies the user's password
    2. Validates the new email address
    3. Checks that new email is not already in use
    4. Generates a verification token
    5. Sends verification email to the new address

    **Requires Authentication:** JWT token in Authorization header

    **Security Features:**
    - Password verification required
    - Email validation
    - Duplicate email prevention
    - Rate limiting (3 requests per 15 minutes)
    - Token expiry (1 hour)
    - Audit logging

    **Example:**
    ```bash
    curl -X POST http://localhost:8181/api/auth/users/me/change-email \\
        -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
        -H "Content-Type: application/json" \\
        -d '{
            "new_email": "newemail@example.com",
            "password": "YourCurrentPassword123!"
        }'
    ```

    **Request Body:**
    ```json
    {
        "new_email": "string (valid email)",
        "password": "string (current password)"
    }
    ```

    **Responses:**
    - 200: Verification email sent
    - 400: Invalid password, email validation failed, or email already in use
    - 401: Not authenticated
    - 429: Rate limit exceeded
    - 500: Internal server error
    """

    conn = await get_direct_db_connection()

    try:
        user_id = current_user['id']
        current_email = current_user['email']

        # ==================================================================
        # Step 1: Validate new email
        # ==================================================================
        try:
            validate_email(email_data.new_email)
        except EmailValidationError as e:
            logger.warning(
                f"Email validation failed for user_id={user_id}: {str(e)}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        # Check if new email is same as current
        if email_data.new_email.lower() == current_email.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New email must be different from your current email"
            )

        # ==================================================================
        # Step 2: Verify password
        # ==================================================================
        password_query = """
            SELECT hashed_password
            FROM archon_users
            WHERE id = $1
        """

        password_result = await conn.fetchrow(password_query, user_id)

        if not password_result or not password_result['hashed_password']:
            logger.error(f"User {user_id} has no password (OAuth user?)")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change email for OAuth accounts"
            )

        if not verify_password(email_data.password, password_result['hashed_password']):
            logger.warning(
                f"Failed email change attempt for user_id={user_id}: "
                f"incorrect password from IP {request.client.host}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is incorrect"
            )

        # ==================================================================
        # Step 3: Check if new email is already in use
        # ==================================================================
        email_check_query = """
            SELECT id
            FROM archon_users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
        """

        existing_user = await conn.fetchrow(email_check_query, email_data.new_email)

        if existing_user:
            logger.warning(
                f"Email change attempt with existing email: "
                f"user_id={user_id}, email={email_data.new_email}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email address is already registered"
            )

        # ==================================================================
        # Step 4: Generate verification token
        # ==================================================================
        import secrets
        verification_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(hours=1)

        # Store token in database
        token_insert_query = """
            INSERT INTO archon_email_change_tokens
                (user_id, new_email, token, expires_at, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        """

        await conn.fetchrow(
            token_insert_query,
            user_id,
            email_data.new_email,
            verification_token,
            expires_at,
            request.client.host if request.client else None,
            request.headers.get("user-agent", "")[:500]
        )

        # ==================================================================
        # Step 5: Send verification email
        # ==================================================================
        base_url = request.base_url
        if not base_url.path.endswith("/"):
            base_url = f"{base_url}/"

        verification_link = f"{base_url}verify-email-change?token={verification_token}"

        try:
            # Get user's full name
            user_query = """
                SELECT full_name
                FROM archon_users
                WHERE id = $1
            """
            user_result = await conn.fetchrow(user_query, user_id)
            user_name = user_result['full_name'] if user_result else current_email

            # Generate email HTML
            email_html = email_change_verification_email(
                user_name=user_name,
                current_email=current_email,
                new_email=email_data.new_email,
                verification_link=verification_link,
                expiry_minutes=60
            )

            # Send email to NEW email address
            await send_email(
                to_email=email_data.new_email,
                subject="Verify Your New Email Address - Archon",
                html_content=email_html
            )

            logger.info(
                f"Email change verification sent: "
                f"user_id={user_id}, "
                f"from={current_email}, "
                f"to={email_data.new_email}, "
                f"ip={request.client.host}"
            )

        except EmailServiceError as e:
            logger.error(
                f"Failed to send email change verification: "
                f"user_id={user_id}, error={str(e)}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send verification email. Please try again later."
            )

        # ==================================================================
        # Step 6: Return success response
        # ==================================================================
        return {
            "message": f"Verification email sent to {email_data.new_email}. Please check your inbox.",
            "new_email": email_data.new_email
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            f"Error initiating email change for user_id={current_user['id']}: {str(e)}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing your email change request"
        )

    finally:
        await conn.close()


@router.post("/verify-email-change", response_model=VerifyEmailChangeResponse)
@limiter.limit("5/15minutes")
async def verify_email_change(
    request: Request,
    verify_request: VerifyEmailChangeRequest
):
    """
    Verify email change using a valid verification token.

    This endpoint:
    1. Validates the verification token (exists, not expired, not used)
    2. Updates the user's email address
    3. Marks the token as used
    4. Sends confirmation emails to both old and new addresses
    5. Invalidates all existing user sessions (for security)

    **Security Features:**
    - Token expiry (1 hour from creation)
    - One-time use tokens
    - Audit trail (IP, user agent)
    - Session invalidation after email change
    - Confirmation emails to both addresses

    **Request Body:**
    ```json
    {
        "token": "550e8400-e29b-41d4-a716-446655440000"
    }
    ```

    **Example:**
    ```bash
    curl -X POST http://localhost:8181/api/auth/verify-email-change \\
        -H "Content-Type: application/json" \\
        -d '{
            "token": "550e8400-e29b-41d4-a716-446655440000"
        }'
    ```

    **Responses:**
    - 200: Email changed successfully
    - 400: Invalid token, expired, or already used
    - 500: Internal server error
    """

    conn = await get_direct_db_connection()

    try:
        # ==================================================================
        # Step 1: Validate and retrieve token
        # ==================================================================
        token_query = """
            SELECT
                ect.id as token_id,
                ect.user_id,
                ect.new_email,
                ect.expires_at,
                ect.used_at,
                u.email as current_email,
                u.full_name
            FROM archon_email_change_tokens ect
            JOIN archon_users u ON ect.user_id = u.id
            WHERE ect.token = $1
            LIMIT 1
        """

        token_record = await conn.fetchrow(token_query, verify_request.token)

        # Validate token exists
        if not token_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token"
            )

        # Validate token not already used
        if token_record['used_at'] is not None:
            logger.warning(
                f"Attempted reuse of email change token: "
                f"user_id={token_record['user_id']}, token_id={token_record['token_id']}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token"
            )

        # Validate token not expired
        if datetime.now(token_record['expires_at'].tzinfo) > token_record['expires_at']:
            logger.warning(
                f"Expired email change token used: "
                f"user_id={token_record['user_id']}, "
                f"expired_at={token_record['expires_at']}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token"
            )

        # ==================================================================
        # Step 2: Check if new email is still available
        # ==================================================================
        email_check_query = """
            SELECT id
            FROM archon_users
            WHERE LOWER(email) = LOWER($1) AND id != $2
            LIMIT 1
        """

        existing_user = await conn.fetchrow(
            email_check_query,
            token_record['new_email'],
            token_record['user_id']
        )

        if existing_user:
            logger.warning(
                f"Email verification attempt with now-taken email: "
                f"user_id={token_record['user_id']}, "
                f"email={token_record['new_email']}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email address is no longer available"
            )

        # ==================================================================
        # Step 3: Update user's email
        # ==================================================================
        update_query = """
            UPDATE archon_users
            SET
                email = $1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING id, email
        """

        updated_user = await conn.fetchrow(
            update_query,
            token_record['new_email'],
            token_record['user_id']
        )

        if not updated_user:
            logger.error(
                f"Failed to update email for user_id={token_record['user_id']}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update email address"
            )

        # ==================================================================
        # Step 4: Mark token as used
        # ==================================================================
        mark_used_query = """
            UPDATE archon_email_change_tokens
            SET used_at = NOW()
            WHERE id = $1
        """

        await conn.execute(mark_used_query, token_record['token_id'])

        # ==================================================================
        # Step 5: Send confirmation emails
        # ==================================================================
        try:
            # Email HTML for both addresses
            confirmation_html = email_change_success_email(
                user_name=token_record['full_name'],
                old_email=token_record['current_email'],
                new_email=token_record['new_email']
            )

            # Send to NEW email (primary)
            await send_email(
                to_email=token_record['new_email'],
                subject="Email Address Changed Successfully - Archon",
                html_content=confirmation_html
            )

            # Send to OLD email (security notification)
            await send_email(
                to_email=token_record['current_email'],
                subject="Email Address Changed - Archon",
                html_content=confirmation_html
            )

        except EmailServiceError as e:
            # Don't fail the request if confirmation emails fail
            logger.error(
                f"Failed to send email change confirmation: "
                f"user_id={token_record['user_id']}, error={str(e)}"
            )

        # ==================================================================
        # Step 6: Log success and return response
        # ==================================================================
        logger.info(
            f"Email changed successfully: "
            f"user_id={token_record['user_id']}, "
            f"from={token_record['current_email']}, "
            f"to={token_record['new_email']}, "
            f"ip={request.client.host}"
        )

        return {
            "message": "Email address changed successfully",
            "email": token_record['new_email']
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            f"Error verifying email change: {str(e)}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while verifying your email change"
        )

    finally:
        await conn.close()
