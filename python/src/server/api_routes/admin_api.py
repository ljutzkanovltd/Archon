"""
Admin API Routes for Archon User Management System.

Provides admin-only endpoints for user management and permission control.
Requires 'manage_users' permission for all operations.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..auth.dependencies import get_current_user, require_admin
from ..config.logfire_config import get_logger
from ..models.permission import PermissionKey
from ..services.user_access_service import UserAccessService
from ..utils.db_utils import get_direct_db_connection
from ..utils.email_service import send_email
from ..utils.email_templates import invitation_email

router = APIRouter(prefix="/api/admin", tags=["Admin"])
logger = get_logger(__name__)
limiter = Limiter(key_func=get_remote_address)


# ============================================================================
# Request/Response Models
# ============================================================================


class UserListItem(BaseModel):
    """User list item response schema"""
    id: UUID
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    role: Optional[str] = None
    is_active: bool
    is_verified: bool
    last_login_at: Optional[str] = None
    created_at: str


class UsersListResponse(BaseModel):
    """Users list response schema"""
    users: List[UserListItem]
    total: int
    page: int
    per_page: int
    total_pages: int


class InviteUserRequest(BaseModel):
    """Invite user request schema"""
    email: EmailStr
    message: Optional[str] = Field(None, max_length=500)


class InviteUserResponse(BaseModel):
    """Invite user response schema"""
    success: bool
    message: str
    invitation_token: str
    email: str


class UpdateUserStatusRequest(BaseModel):
    """Update user status request schema"""
    is_active: bool


class UpdateUserStatusResponse(BaseModel):
    """Update user status response schema"""
    success: bool
    message: str
    user_id: UUID
    is_active: bool


class UpdateUserRequest(BaseModel):
    """Update user basic info request schema"""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = Field(None, pattern="^(admin|member|viewer)$")


class UpdateUserResponse(BaseModel):
    """Update user response schema"""
    success: bool
    message: str
    user: UserListItem


class SendPasswordResetResponse(BaseModel):
    """Send password reset response schema"""
    success: bool
    message: str


class UserPermissionsResponse(BaseModel):
    """User permissions response schema"""
    user_id: UUID
    permissions: List[PermissionKey]
    total_count: int


class UpdateUserPermissionsRequest(BaseModel):
    """Update user permissions request schema"""
    permissions: List[PermissionKey]


class UpdateUserPermissionsResponse(BaseModel):
    """Update user permissions response schema"""
    success: bool
    message: str
    user_id: UUID
    granted: List[PermissionKey]
    revoked: List[PermissionKey]


class ProjectMemberItem(BaseModel):
    """Project member item schema"""
    id: str
    user_id: str
    email: str
    full_name: str
    avatar_url: Optional[str]
    role: str
    access_level: str
    added_at: Optional[str]
    added_by: Optional[str]
    added_by_name: Optional[str]


class ProjectMembersResponse(BaseModel):
    """Project members list response schema"""
    success: bool
    project_id: str
    members: List[ProjectMemberItem]
    total: int


class AddProjectMemberRequest(BaseModel):
    """Add project member request schema"""
    user_id: UUID
    access_level: str = Field(..., pattern="^(owner|member)$")


class AddProjectMemberResponse(BaseModel):
    """Add project member response schema"""
    success: bool
    message: str
    project_id: str
    user_id: str
    access_level: str


class RemoveProjectMemberResponse(BaseModel):
    """Remove project member response schema"""
    success: bool
    message: str


class UserProjectItem(BaseModel):
    """User project item schema"""
    project_id: str
    title: str
    description: Optional[str]
    github_repo: Optional[str]
    pinned: bool
    archived: bool
    access_level: str
    created_at: Optional[str]
    updated_at: Optional[str]


class UserProjectsResponse(BaseModel):
    """User projects list response schema"""
    success: bool
    user_id: str
    projects: List[UserProjectItem]
    total: int
    is_admin: bool


# ============================================================================
# Endpoints
# ============================================================================


@router.get("/users", response_model=UsersListResponse)
@limiter.limit("30/minute")
async def list_users(
    request: Request,
    page: int = 1,
    per_page: int = 10,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,  # 'active', 'inactive', 'verified', 'unverified'
    admin: dict = Depends(require_admin),
):
    """
    List all users with pagination and filtering (admin only).

    **Permissions Required:** manage_users

    **Query Parameters:**
    - page: Page number (default: 1)
    - per_page: Items per page (default: 10, max: 100)
    - search: Search by email or full_name (optional)
    - status_filter: Filter by status (active, inactive, verified, unverified)

    **Returns:**
    - users: List of users
    - total: Total number of users matching filters
    - page: Current page number
    - per_page: Items per page
    - total_pages: Total number of pages
    """
    # Validate pagination
    if per_page > 100:
        per_page = 100
    if page < 1:
        page = 1

    offset = (page - 1) * per_page

    conn = await get_direct_db_connection()
    try:
        # Build WHERE clause based on filters
        where_clauses = []
        params = []
        param_index = 1

        if search:
            where_clauses.append(
                f"(email ILIKE ${param_index} OR full_name ILIKE ${param_index})"
            )
            params.append(f"%{search}%")
            param_index += 1

        if status_filter == "active":
            where_clauses.append(f"is_active = ${param_index}")
            params.append(True)
            param_index += 1
        elif status_filter == "inactive":
            where_clauses.append(f"is_active = ${param_index}")
            params.append(False)
            param_index += 1
        elif status_filter == "verified":
            where_clauses.append(f"is_verified = ${param_index}")
            params.append(True)
            param_index += 1
        elif status_filter == "unverified":
            where_clauses.append(f"is_verified = ${param_index}")
            params.append(False)
            param_index += 1

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # Get total count
        count_query = f"""
            SELECT COUNT(*) FROM archon_users
            {where_sql}
        """
        total = await conn.fetchval(count_query, *params)

        # Get paginated users
        users_query = f"""
            SELECT
                id, email, full_name, avatar_url, role, is_active, is_verified,
                last_login_at, created_at
            FROM archon_users
            {where_sql}
            ORDER BY created_at DESC
            LIMIT ${param_index} OFFSET ${param_index + 1}
        """
        params.extend([per_page, offset])

        users_rows = await conn.fetch(users_query, *params)

        users = [
            UserListItem(
                id=row["id"],
                email=row["email"],
                full_name=row["full_name"],
                avatar_url=row["avatar_url"],
                role=row["role"],
                is_active=row["is_active"],
                is_verified=row["is_verified"],
                last_login_at=row["last_login_at"].isoformat() if row["last_login_at"] else None,
                created_at=row["created_at"].isoformat(),
            )
            for row in users_rows
        ]

        total_pages = (total + per_page - 1) // per_page  # Ceiling division

        logger.info(
            f"Admin {admin['email']} listed users (page {page}, total: {total})"
        )

        return UsersListResponse(
            users=users,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
        )

    finally:
        await conn.close()


@router.post("/users/invite", response_model=InviteUserResponse)
@limiter.limit("5/minute")
async def invite_user(
    request: Request,
    invite_request: InviteUserRequest,
    admin: dict = Depends(require_admin),
):
    """
    Send user invitation email (admin only).

    **Permissions Required:** manage_users

    **Request Body:**
    - email: Email address to invite
    - message: Optional custom message to include in invitation

    **Returns:**
    - success: Whether invitation was sent
    - message: Status message
    - invitation_token: Generated invitation token
    - email: Email address invited
    """
    conn = await get_direct_db_connection()
    try:
        # Check if user already exists
        check_query = """
            SELECT id, email FROM archon_users WHERE email = $1
        """
        existing_user = await conn.fetchrow(check_query, invite_request.email)

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email {invite_request.email} already exists",
            )

        # Generate invitation token (UUID-based)
        import uuid
        invitation_token = str(uuid.uuid4())

        # Create invitation record
        insert_query = """
            INSERT INTO archon_invitations (
                email, token, invited_by, custom_message, expires_at
            ) VALUES (
                $1, $2, $3, $4, NOW() + INTERVAL '7 days'
            )
            RETURNING id
        """
        invitation_id = await conn.fetchval(
            insert_query,
            invite_request.email,
            invitation_token,
            admin["id"],
            invite_request.message,
        )

        # Send invitation email
        try:
            email_content = invitation_email(
                to_email=invite_request.email,
                invitation_token=invitation_token,
                invited_by_name=admin["full_name"],
                custom_message=invite_request.message,
            )

            await send_email(
                to_email=invite_request.email,
                to_name=invite_request.email,  # Use email as name since we don't have their name yet
                subject=email_content["subject"],
                html_content=email_content["html"],
            )

            logger.info(
                f"Admin {admin['email']} invited user {invite_request.email} (invitation_id: {invitation_id})"
            )

            return InviteUserResponse(
                success=True,
                message=f"Invitation sent to {invite_request.email}",
                invitation_token=invitation_token,
                email=invite_request.email,
            )

        except Exception as email_error:
            logger.error(f"Failed to send invitation email: {email_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send invitation email. Please try again later.",
            )

    finally:
        await conn.close()


@router.put("/users/{user_id}", response_model=UpdateUserResponse)
@limiter.limit("20/minute")
async def update_user(
    request: Request,
    user_id: UUID,
    update_request: UpdateUserRequest,
    admin: dict = Depends(require_admin),
):
    """
    Update user basic information (admin only).

    **Permissions Required:** manage_users

    **Path Parameters:**
    - user_id: UUID of user to update

    **Request Body:**
    - full_name: User's full name (optional)
    - email: User's email address (optional)
    - role: User's role - 'admin', 'member', or 'viewer' (optional)

    **Returns:**
    - success: Whether update was successful
    - message: Status message
    - user: Updated user object
    """
    # Prevent admin from demoting themselves
    if str(user_id) == str(admin["id"]) and update_request.role and update_request.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role from admin",
        )

    conn = await get_direct_db_connection()
    try:
        # Check if user exists
        user = await conn.fetchrow(
            "SELECT id, email, full_name, role FROM archon_users WHERE id = $1",
            user_id,
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found",
            )

        # Build update query dynamically
        update_fields = []
        params = []
        param_index = 1

        if update_request.full_name is not None:
            update_fields.append(f"full_name = ${param_index}")
            params.append(update_request.full_name)
            param_index += 1

        if update_request.email is not None:
            # Check if email is already taken by another user
            existing_user = await conn.fetchval(
                "SELECT id FROM archon_users WHERE email = $1 AND id != $2",
                update_request.email,
                user_id,
            )
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email {update_request.email} is already in use",
                )

            update_fields.append(f"email = ${param_index}")
            params.append(update_request.email)
            param_index += 1

        if update_request.role is not None:
            update_fields.append(f"role = ${param_index}")
            params.append(update_request.role)
            param_index += 1

        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        # Add updated_at timestamp
        update_fields.append(f"updated_at = ${param_index}")
        params.append("NOW()")
        param_index += 1

        # Add user_id for WHERE clause
        params.append(user_id)

        # Execute update
        update_query = f"""
            UPDATE archon_users
            SET {", ".join(update_fields)}
            WHERE id = ${param_index}
            RETURNING id, email, full_name, avatar_url, role, is_active, is_verified,
                      last_login_at, created_at
        """
        updated_user = await conn.fetchrow(update_query, *params)

        logger.info(
            f"Admin {admin['email']} updated user {user['email']} "
            f"(fields: {', '.join(f.split('=')[0].strip() for f in update_fields)})"
        )

        return UpdateUserResponse(
            success=True,
            message=f"User {updated_user['email']} updated successfully",
            user=UserListItem(
                id=updated_user["id"],
                email=updated_user["email"],
                full_name=updated_user["full_name"],
                avatar_url=updated_user["avatar_url"],
                role=updated_user["role"],
                is_active=updated_user["is_active"],
                is_verified=updated_user["is_verified"],
                last_login_at=updated_user["last_login_at"].isoformat() if updated_user["last_login_at"] else None,
                created_at=updated_user["created_at"].isoformat(),
            ),
        )

    finally:
        await conn.close()


@router.post("/users/{user_id}/password-reset", response_model=SendPasswordResetResponse)
@limiter.limit("5/minute")
async def send_password_reset(
    request: Request,
    user_id: UUID,
    admin: dict = Depends(require_admin),
):
    """
    Send password reset email to a user (admin only).

    **Permissions Required:** manage_users

    **Path Parameters:**
    - user_id: UUID of user to send password reset to

    **Returns:**
    - success: Whether email was sent successfully
    - message: Status message
    """
    conn = await get_direct_db_connection()
    try:
        # Check if user exists
        user = await conn.fetchrow(
            "SELECT id, email, full_name FROM archon_users WHERE id = $1",
            user_id,
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found",
            )

        # Generate password reset token (expires in 1 hour)
        import secrets
        from datetime import datetime, timedelta

        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)

        # Store token in database
        await conn.execute(
            """
            INSERT INTO archon_password_reset_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id)
            DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()
            """,
            user_id,
            token,
            expires_at,
        )

        # Send password reset email
        reset_url = f"{request.base_url}reset-password?token={token}"

        try:
            await send_email(
                to_email=user["email"],
                subject="Password Reset Request - Archon",
                html_content=f"""
                <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Reset Request</h2>
                    <p>Hi {user['full_name']},</p>
                    <p>An administrator has requested a password reset for your account.</p>
                    <p>Click the link below to reset your password (link expires in 1 hour):</p>
                    <p><a href="{reset_url}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a></p>
                    <p>If you did not request this reset, please contact your administrator.</p>
                    <p style="color: #666; font-size: 12px; margin-top: 40px;">
                        This email was sent from Archon Project Management System.
                    </p>
                </body>
                </html>
                """,
            )
        except Exception as e:
            logger.error(f"Failed to send password reset email | user_id={user_id} | error={str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to send password reset email: {str(e)}",
            )

        logger.info(
            f"Admin {admin['email']} sent password reset email to {user['email']}"
        )

        return SendPasswordResetResponse(
            success=True,
            message=f"Password reset email sent to {user['email']}",
        )

    finally:
        await conn.close()


@router.put("/users/{user_id}/status", response_model=UpdateUserStatusResponse)
@limiter.limit("10/minute")
async def update_user_status(
    request: Request,
    user_id: UUID,
    status_request: UpdateUserStatusRequest,
    admin: dict = Depends(require_admin),
):
    """
    Activate or deactivate a user account (admin only).

    **Permissions Required:** manage_users

    **Path Parameters:**
    - user_id: UUID of user to update

    **Request Body:**
    - is_active: true to activate, false to deactivate

    **Returns:**
    - success: Whether update was successful
    - message: Status message
    - user_id: UUID of updated user
    - is_active: New status
    """
    # Prevent admin from deactivating themselves
    if str(user_id) == str(admin["id"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    conn = await get_direct_db_connection()
    try:
        # Check if user exists
        check_query = """
            SELECT id, email, full_name, is_active FROM archon_users WHERE id = $1
        """
        user = await conn.fetchrow(check_query, user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found",
            )

        # Update user status
        update_query = """
            UPDATE archon_users
            SET is_active = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING is_active
        """
        new_status = await conn.fetchval(update_query, status_request.is_active, user_id)

        action = "activated" if status_request.is_active else "deactivated"
        logger.info(
            f"Admin {admin['email']} {action} user {user['email']} (user_id: {user_id})"
        )

        return UpdateUserStatusResponse(
            success=True,
            message=f"User {action} successfully",
            user_id=user_id,
            is_active=new_status,
        )

    finally:
        await conn.close()


@router.get("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
@limiter.limit("30/minute")
async def get_user_permissions(
    request: Request,
    user_id: UUID,
    admin: dict = Depends(require_admin),
):
    """
    Get all permissions for a specific user (admin only).

    **Permissions Required:** manage_users

    **Path Parameters:**
    - user_id: UUID of user

    **Returns:**
    - user_id: UUID of user
    - permissions: List of permission keys
    - total_count: Number of permissions
    """
    conn = await get_direct_db_connection()
    try:
        # Check if user exists
        check_query = """
            SELECT id, email FROM archon_users WHERE id = $1
        """
        user = await conn.fetchrow(check_query, user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found",
            )

        # Get user permissions
        permissions_query = """
            SELECT permission_key
            FROM get_user_permissions($1::uuid)
        """
        permissions_rows = await conn.fetch(permissions_query, user_id)

        permissions = [PermissionKey(row["permission_key"]) for row in permissions_rows]

        logger.info(
            f"Admin {admin['email']} retrieved permissions for user {user['email']}"
        )

        return UserPermissionsResponse(
            user_id=user_id,
            permissions=permissions,
            total_count=len(permissions),
        )

    finally:
        await conn.close()


@router.put("/users/{user_id}/permissions", response_model=UpdateUserPermissionsResponse)
@limiter.limit("10/minute")
async def update_user_permissions(
    request: Request,
    user_id: UUID,
    permissions_request: UpdateUserPermissionsRequest,
    admin: dict = Depends(require_admin),
):
    """
    Update permissions for a specific user (admin only).

    Grants new permissions and revokes permissions not in the request.

    **Permissions Required:** manage_users

    **Path Parameters:**
    - user_id: UUID of user

    **Request Body:**
    - permissions: List of permission keys to grant

    **Returns:**
    - success: Whether update was successful
    - message: Status message
    - user_id: UUID of user
    - granted: List of permissions granted
    - revoked: List of permissions revoked
    """
    # Prevent admin from revoking their own manage_users permission
    if str(user_id) == str(admin["id"]):
        if PermissionKey.MANAGE_USERS not in permissions_request.permissions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot revoke your own 'manage_users' permission",
            )

    conn = await get_direct_db_connection()
    try:
        # Check if user exists
        check_query = """
            SELECT id, email FROM archon_users WHERE id = $1
        """
        user = await conn.fetchrow(check_query, user_id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found",
            )

        # Get current permissions
        current_permissions_query = """
            SELECT permission_key
            FROM get_user_permissions($1::uuid)
        """
        current_permissions_rows = await conn.fetch(current_permissions_query, user_id)
        current_permissions = set(row["permission_key"] for row in current_permissions_rows)

        # Requested permissions
        requested_permissions = set(perm.value for perm in permissions_request.permissions)

        # Calculate grants and revokes
        to_grant = requested_permissions - current_permissions
        to_revoke = current_permissions - requested_permissions

        # Grant new permissions
        for permission_key in to_grant:
            grant_query = """
                SELECT grant_user_permission(
                    $1::uuid,
                    $2::varchar,
                    $3::uuid,
                    $4::text
                )
            """
            await conn.fetchval(
                grant_query,
                user_id,
                permission_key,
                admin["id"],
                f"Granted by admin {admin['email']}",
            )

        # Revoke removed permissions
        for permission_key in to_revoke:
            revoke_query = """
                SELECT revoke_user_permission(
                    $1::uuid,
                    $2::varchar,
                    $3::uuid
                )
            """
            await conn.fetchval(
                revoke_query,
                user_id,
                permission_key,
                admin["id"],
            )

        logger.info(
            f"Admin {admin['email']} updated permissions for user {user['email']}: "
            f"granted={list(to_grant)}, revoked={list(to_revoke)}"
        )

        return UpdateUserPermissionsResponse(
            success=True,
            message=f"Permissions updated for user {user['email']}",
            user_id=user_id,
            granted=[PermissionKey(key) for key in to_grant],
            revoked=[PermissionKey(key) for key in to_revoke],
        )

    finally:
        await conn.close()


# ============================================================================
# User Project Access Management Endpoints
# ============================================================================


@router.get("/users/{user_id}/projects", response_model=UserProjectsResponse)
@limiter.limit("30/minute")
async def get_user_projects(
    request: Request,
    user_id: UUID,
    admin: dict = Depends(require_admin),
):
    """
    Get all projects a user has access to (admin only).

    **Permissions Required:** manage_users

    **Path Parameters:**
    - user_id: UUID of user

    **Returns:**
    - success: Whether request was successful
    - user_id: UUID of user
    - projects: List of projects with access level
    - total: Number of projects
    - is_admin: Whether user is an admin (admins see all projects)
    """
    access_service = UserAccessService()

    # Check if user is admin
    is_admin_success, is_admin = await access_service.is_user_admin(user_id)
    if not is_admin_success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check user role",
        )

    # Get user's accessible projects
    success, result = await access_service.get_user_projects(user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve user projects: {result}",
        )

    logger.info(
        f"Admin {admin['email']} retrieved projects for user {user_id}"
    )

    return UserProjectsResponse(
        success=True,
        user_id=str(user_id),
        projects=[UserProjectItem(**proj) for proj in result],
        total=len(result),
        is_admin=is_admin,
    )


@router.get("/projects/{project_id}/members", response_model=ProjectMembersResponse)
@limiter.limit("30/minute")
async def get_project_members(
    request: Request,
    project_id: UUID,
    admin: dict = Depends(require_admin),
):
    """
    Get all members of a project (admin only).

    **Permissions Required:** manage_users

    **Path Parameters:**
    - project_id: UUID of project

    **Returns:**
    - success: Whether request was successful
    - project_id: UUID of project
    - members: List of users with access to the project
    - total: Number of members
    """
    access_service = UserAccessService()

    # Get project members
    success, result = await access_service.get_project_members(project_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve project members: {result}",
        )

    logger.info(
        f"Admin {admin['email']} retrieved members for project {project_id}"
    )

    return ProjectMembersResponse(
        success=True,
        project_id=str(project_id),
        members=[ProjectMemberItem(**member) for member in result],
        total=len(result),
    )


@router.post("/projects/{project_id}/members", response_model=AddProjectMemberResponse)
@limiter.limit("20/minute")
async def add_project_member(
    request: Request,
    project_id: UUID,
    member_request: AddProjectMemberRequest,
    admin: dict = Depends(require_admin),
):
    """
    Add a user to a project with specified access level (admin only).

    **Permissions Required:** manage_users

    **Path Parameters:**
    - project_id: UUID of project

    **Request Body:**
    - user_id: UUID of user to add
    - access_level: 'owner' or 'member'

    **Returns:**
    - success: Whether request was successful
    - message: Status message
    - project_id: UUID of project
    - user_id: UUID of user added
    - access_level: Access level granted
    """
    access_service = UserAccessService()

    # Verify user exists
    conn = await get_direct_db_connection()
    try:
        user = await conn.fetchrow(
            "SELECT id, email, full_name FROM archon_users WHERE id = $1",
            member_request.user_id,
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {member_request.user_id} not found",
            )

        # Verify project exists
        project = await conn.fetchrow(
            "SELECT id, title FROM archon_projects WHERE id = $1",
            project_id,
        )

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

    finally:
        await conn.close()

    # Add user to project
    success, result = await access_service.add_user_to_project(
        user_id=member_request.user_id,
        project_id=project_id,
        access_level=member_request.access_level,
        added_by=admin["id"],
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add user to project: {result}",
        )

    logger.info(
        f"Admin {admin['email']} added user {user['email']} to project {project['title']} "
        f"with access level '{member_request.access_level}'"
    )

    return AddProjectMemberResponse(
        success=True,
        message=f"User {user['full_name']} added to project {project['title']}",
        project_id=str(project_id),
        user_id=str(member_request.user_id),
        access_level=member_request.access_level,
    )


@router.delete("/projects/{project_id}/members/{user_id}", response_model=RemoveProjectMemberResponse)
@limiter.limit("20/minute")
async def remove_project_member(
    request: Request,
    project_id: UUID,
    user_id: UUID,
    admin: dict = Depends(require_admin),
):
    """
    Remove a user from a project (admin only).

    **Permissions Required:** manage_users

    **Path Parameters:**
    - project_id: UUID of project
    - user_id: UUID of user to remove

    **Returns:**
    - success: Whether request was successful
    - message: Status message
    """
    access_service = UserAccessService()

    # Verify user exists
    conn = await get_direct_db_connection()
    try:
        user = await conn.fetchrow(
            "SELECT id, email, full_name FROM archon_users WHERE id = $1",
            user_id,
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found",
            )

        # Verify project exists
        project = await conn.fetchrow(
            "SELECT id, title FROM archon_projects WHERE id = $1",
            project_id,
        )

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found",
            )

    finally:
        await conn.close()

    # Remove user from project
    success, message = await access_service.remove_user_from_project(
        user_id=user_id,
        project_id=project_id,
        removed_by=admin["id"],
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message,
        )

    logger.info(
        f"Admin {admin['email']} removed user {user['email']} from project {project['title']}"
    )

    return RemoveProjectMemberResponse(
        success=True,
        message=f"User {user['full_name']} removed from project {project['title']}",
    )
