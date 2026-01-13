"""
FastAPI Dependencies for JWT Authentication.

Provides dependency injection for route protection and user authentication.
"""

from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from ..utils.db_utils import get_direct_db_connection
from .jwt_utils import verify_token

# OAuth2 password bearer for token extraction from Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


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
                email_verified_at, last_login_at, created_at, updated_at
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
    Dependency to require admin role (placeholder for future RBAC).

    Currently checks if user is active and verified.
    In Phase 3, this will check organization admin/owner roles.

    Args:
        current_user: User data from get_current_user dependency

    Returns:
        User data dictionary

    Raises:
        HTTPException 403: User is not admin

    Example:
        @app.delete("/admin/users/{user_id}")
        async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
            # Admin-only operation
            pass
    """
    # TODO: Implement proper RBAC check in Phase 3
    # For now, just ensure user is verified
    if not current_user["is_verified"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required. Email verification needed.",
        )

    return current_user
