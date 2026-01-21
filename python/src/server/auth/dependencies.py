"""
FastAPI Dependencies for JWT Authentication and RBAC.

Provides dependency injection for route protection, user authentication,
and Casbin-based permission checking.
"""

from typing import Callable, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

# Optional Casbin import - RBAC features will be disabled if not available
try:
    from ..services.casbin_service import CasbinService
    CASBIN_AVAILABLE = True
except ImportError:
    CASBIN_AVAILABLE = False
    CasbinService = None  # type: ignore

from ..utils.db_utils import get_direct_db_connection
from .jwt_utils import verify_token

# OAuth2 password bearer for token extraction from Authorization header
# auto_error=False allows optional authentication (get_current_user_optional dependency)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Dependency to get current authenticated user from JWT token.

    Validates JWT token and fetches user from database.
    Returns user data as a dictionary.

    Args:
        token: JWT token from Authorization header

    Returns:
        User data dictionary

    Raises:
        HTTPException 401: Invalid or expired token
        HTTPException 401: User not found
        HTTPException 403: User account is inactive

    Example:
        @app.get("/protected")
        async def protected_route(current_user: dict = Depends(get_current_user)):
            return {"user_id": current_user["id"]}
    """
    # Verify and decode token
    try:
        payload = verify_token(token)
        user_id_str: str = payload.get("sub")

        if user_id_str is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Validate UUID format
        try:
            user_id = UUID(user_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: malformed user ID",
                headers={"WWW-Authenticate": "Bearer"},
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    conn = await get_direct_db_connection()
    try:
        query = """
            SELECT
                id, email, full_name, avatar_url, is_active, is_verified,
                email_verified_at, last_login_at, created_at, updated_at, role
            FROM archon_users
            WHERE id = $1
        """
        user_row = await conn.fetchrow(query, user_id)

        if user_row is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Convert to dictionary
        user = dict(user_row)

        # Check if user account is active
        if not user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive",
            )

        # Load user permissions (RBAC Phase 4)
        permissions_query = """
            SELECT permission_key
            FROM archon_user_permissions
            WHERE user_id = $1 AND revoked_at IS NULL
            ORDER BY permission_key
        """
        permissions_rows = await conn.fetch(permissions_query, user_id)
        user["permissions"] = [row["permission_key"] for row in permissions_rows]

        return user

    finally:
        await conn.close()


async def get_current_verified_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency to require verified email.

    Builds on get_current_user but additionally checks email verification status.

    Args:
        current_user: User data from get_current_user dependency

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: Email not verified

    Example:
        @app.get("/verified-only")
        async def verified_route(user: dict = Depends(get_current_verified_user)):
            return {"message": "Email verified"}
    """
    if not current_user["is_verified"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email to access this resource.",
        )

    return current_user


async def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[dict]:
    """
    Dependency for optional authentication.

    Returns user data if valid token provided, None otherwise.
    Does not raise HTTPException for missing/invalid tokens.

    Args:
        token: Optional JWT token from Authorization header

    Returns:
        User data dictionary or None

    Example:
        @app.get("/public-or-private")
        async def mixed_route(user: Optional[dict] = Depends(get_current_user_optional)):
            if user:
                return {"message": f"Hello {user['full_name']}"}
            return {"message": "Hello guest"}
    """
    if not token:
        return None

    try:
        return await get_current_user(token)
    except HTTPException:
        return None


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency to require admin permissions (RBAC Phase 3A).

    Checks if user has 'manage_users' permission in archon_user_permissions table.

    Args:
        current_user: User data from get_current_user dependency

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: User does not have admin permissions

    Example:
        @app.delete("/admin/users/{user_id}")
        async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
            # Admin-only operation
            pass
    """
    user_id = current_user["id"]

    # Check if user has 'manage_users' permission
    conn = await get_direct_db_connection()
    try:
        query = """
            SELECT user_has_permission($1::uuid, 'manage_users')
        """
        has_permission = await conn.fetchval(query, user_id)

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required. You do not have permission to manage users.",
            )

        return current_user

    finally:
        await conn.close()


# ============================================
# Casbin RBAC Permission Dependencies
# ============================================


def require_permission(resource: str, action: str) -> Callable:
    """
    Factory function to create permission check dependencies.

    Creates a FastAPI dependency that checks if the current user has
    permission to perform an action on a resource in a specific project.

    Args:
        resource: Resource type (e.g., "project", "task", "sprint", "team")
        action: Action to perform (e.g., "read", "write", "manage", "assign")

    Returns:
        FastAPI dependency function

    Example:
        @app.post("/api/sprints/{sprint_id}/start")
        async def start_sprint(
            sprint_id: str,
            user: dict = Depends(require_permission("sprint", "manage"))
        ):
            # User is authorized to manage sprints
            pass
    """

    async def permission_checker(
        project_id: str,  # Expected as path/query parameter
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        """
        Check if user has permission for the requested operation.

        Args:
            project_id: Project UUID (from path or query parameter)
            current_user: Authenticated user from get_current_user dependency

        Returns:
            User data dictionary if permission granted

        Raises:
            HTTPException 403: Permission denied
        """
        user_id = current_user.get("email") or str(current_user.get("id"))

        # If Casbin is not available, allow all authenticated users (development mode)
        if not CASBIN_AVAILABLE:
            # TODO: Remove this bypass in production - implement proper RBAC
            return current_user

        # Initialize Casbin service
        casbin_service = CasbinService()

        # Check permission
        allowed, result = await casbin_service.enforce(
            user_id=user_id,
            project_id=project_id,
            resource=resource,
            action=action,
        )

        if not allowed:
            # Get user's roles for detailed error message
            roles_success, roles_result = await casbin_service.get_user_roles(
                user_id, project_id
            )
            user_roles = roles_result.get("roles", []) if roles_success else []

            detail = (
                f"Permission denied: {resource}:{action} requires appropriate role. "
                f"Your current roles in this project: {', '.join(user_roles) if user_roles else 'none'}"
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail,
            )

        return current_user

    return permission_checker


# Convenience dependencies for common permissions
async def require_sprint_manage(
    project_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency to require sprint:manage permission.

    Use this for sprint lifecycle operations (start, complete, cancel).

    Args:
        project_id: Project UUID (from path or query parameter)
        current_user: Authenticated user

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: User cannot manage sprints in this project

    Example:
        @app.post("/api/sprints/{sprint_id}/start")
        async def start_sprint(
            sprint_id: str,
            project_id: str,
            user: dict = Depends(require_sprint_manage)
        ):
            pass
    """
    checker = require_permission("sprint", "manage")
    return await checker(project_id, current_user)


async def require_task_assign(
    project_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency to require task:assign permission.

    Use this for assigning tasks to users or moving tasks between sprints.

    Args:
        project_id: Project UUID
        current_user: Authenticated user

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: User cannot assign tasks in this project
    """
    checker = require_permission("task", "assign")
    return await checker(project_id, current_user)


async def require_project_write(
    project_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency to require project:write permission.

    Use this for modifying project settings, hierarchy, or team membership.

    Args:
        project_id: Project UUID
        current_user: Authenticated user

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: User cannot modify this project
    """
    checker = require_permission("project", "write")
    return await checker(project_id, current_user)


async def require_team_manage(
    project_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency to require team:manage permission.

    Use this for creating/deleting teams or modifying team membership.

    Args:
        project_id: Project UUID
        current_user: Authenticated user

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: User cannot manage teams in this project
    """
    checker = require_permission("team", "manage")
    return await checker(project_id, current_user)


async def require_hierarchy_manage(
    project_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency to require hierarchy:manage permission.

    Use this for creating/removing parent-child project relationships.

    Args:
        project_id: Project UUID
        current_user: Authenticated user

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: User cannot manage project hierarchy
    """
    checker = require_permission("hierarchy", "manage")
    return await checker(project_id, current_user)


async def require_knowledge_manage(
    project_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency to require knowledge:manage permission.

    Use this for linking/unlinking knowledge items to projects/tasks/sprints.

    Args:
        project_id: Project UUID
        current_user: Authenticated user

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: User cannot manage knowledge links in this project
    """
    checker = require_permission("knowledge", "manage")
    return await checker(project_id, current_user)


async def require_knowledge_read(
    project_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency to require knowledge:read permission.

    Use this for viewing linked knowledge items and AI suggestions.

    Args:
        project_id: Project UUID
        current_user: Authenticated user

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: User cannot read knowledge links in this project
    """
    checker = require_permission("knowledge", "read")
    return await checker(project_id, current_user)


async def require_reports_read(
    project_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency to require reports:read permission.

    Use this for viewing project reports, metrics, and analytics.

    Args:
        project_id: Project UUID
        current_user: Authenticated user

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: User cannot read reports in this project
    """
    checker = require_permission("reports", "read")
    return await checker(project_id, current_user)
