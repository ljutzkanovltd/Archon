"""
Authentication API Routes for Archon User Management System.

Provides endpoints for user authentication (login, logout, registration).
"""

import re
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field

from ..auth.dependencies import get_current_user
from ..auth.jwt_utils import create_access_token, hash_password, verify_password
from ..models.organization import OrganizationMemberRole
from ..models.user import UserResponse
from ..utils.db_utils import get_direct_db_connection
from ..utils.email_validation import EmailValidationError, validate_email
from ..utils.password_validation import PasswordValidationError, validate_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


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


@router.post("/login")
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
                failed_login_attempts, locked_until
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
        if user["locked_until"] and user["locked_until"] > datetime.utcnow():
            remaining_seconds = int((user["locked_until"] - datetime.utcnow()).total_seconds())
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
                locked_until = datetime.utcnow() + timedelta(minutes=30)
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

        # Create JWT token
        access_token = create_access_token(
            data={
                "sub": str(user["id"]),
                "email": user["email"],
                "full_name": user["full_name"],
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
async def register(request: Request, data: RegisterRequest):
    """
    Register a new user account with automatic organization creation.

    Creates:
    1. New user account in archon_users
    2. User profile in archon_user_profiles
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
        # Step 6: Create User Profile
        # =====================================================================
        profile_query = """
            INSERT INTO archon_user_profiles (
                user_id, timezone, language, theme_preference, date_format,
                email_notifications, desktop_notifications,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING id
        """
        await conn.execute(
            profile_query,
            user_id,
            "UTC",  # Default timezone
            "en",  # Default language
            "system",  # Default theme (follows system preference)
            "YYYY-MM-DD",  # Default date format
            True,  # Email notifications enabled by default
            False,  # Desktop notifications disabled by default
        )

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
                name, slug, owner_id, is_active, max_members,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            RETURNING id, name, slug, owner_id, description, logo_url,
                     primary_color, secondary_color, is_active, max_members,
                     created_at, updated_at
        """
        organization = await conn.fetchrow(
            org_query,
            org_name,
            slug,
            user_id,
            True,  # is_active
            50,  # max_members default
        )

        org_id = organization["id"]

        # =====================================================================
        # Step 9: Create Organization Membership (Owner Role)
        # =====================================================================
        member_query = """
            INSERT INTO archon_organization_members (
                organization_id, user_id, role, invited_by, invited_at,
                joined_at, is_active, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, NOW(), NOW())
            RETURNING id
        """
        await conn.execute(
            member_query,
            org_id,
            user_id,
            OrganizationMemberRole.OWNER.value,
            user_id,  # Self-invited (initial setup)
            True,  # is_active
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
                "max_members": organization["max_members"],
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
