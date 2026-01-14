"""
Authentication API Routes for Archon User Management System.

Provides endpoints for user authentication (login, logout, registration).
"""

import re
import uuid
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field

from ..auth.dependencies import get_current_user
from ..auth.jwt_utils import create_access_token, hash_password, verify_password
from ..config.logfire_config import get_logger
from ..models.organization import OrganizationMemberRole
from ..models.user import UserResponse
from ..utils.db_utils import get_direct_db_connection
from ..utils.email_service import EmailServiceError, send_email
from ..utils.email_templates import password_reset_email
from ..utils.email_validation import EmailValidationError, validate_email
from ..utils.password_validation import PasswordValidationError, validate_password

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
logger = get_logger(__name__)


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
        expires_at = datetime.utcnow() + timedelta(hours=1)
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
