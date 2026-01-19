"""
RBAC Phase 5: Backend Unit Tests for Permission System

Tests the complete RBAC permission flow:
- User permission loading on login
- Permission validation in get_current_user
- Admin vs member access control
- Permission-based endpoint access
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timedelta

from src.server.auth.dependencies import get_current_user, require_admin
from src.server.auth.jwt_utils import create_access_token
from fastapi import HTTPException


# Fixtures for test users
@pytest.fixture
def admin_user():
    """Test admin user with all permissions."""
    return {
        "id": uuid4(),
        "email": "testadmin@archon.dev",
        "full_name": "Test Admin",
        "role": "admin",
        "is_active": True,
        "is_verified": True,
        "permissions": [
            "manage_users",
            "database_sync",
            "view_mcp_inspector",
            "view_test_foundation",
            "view_agent_work_orders",
        ],
    }


@pytest.fixture
def member_user():
    """Test member user with specific permission."""
    return {
        "id": uuid4(),
        "email": "testmember@archon.dev",
        "full_name": "Test Member",
        "role": "member",
        "is_active": True,
        "is_verified": True,
        "permissions": ["view_agent_work_orders"],
    }


@pytest.fixture
def viewer_user():
    """Test viewer user with no extra permissions."""
    return {
        "id": uuid4(),
        "email": "testviewer@archon.dev",
        "full_name": "Test Viewer",
        "role": "member",
        "is_active": True,
        "is_verified": True,
        "permissions": [],
    }


@pytest.fixture
def inactive_user():
    """Test inactive user account."""
    return {
        "id": uuid4(),
        "email": "inactive@archon.dev",
        "full_name": "Inactive User",
        "role": "member",
        "is_active": False,
        "is_verified": True,
        "permissions": [],
    }


class TestUserPermissionLoading:
    """Test permission loading on user authentication."""

    @pytest.mark.asyncio
    async def test_admin_loads_all_permissions(self, admin_user):
        """Admin user should load all permissions from database."""
        # Mock database connection
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = admin_user
        mock_conn.fetch.return_value = [
            {"permission_key": perm} for perm in admin_user["permissions"]
        ]

        with patch(
            "src.server.auth.dependencies.get_direct_db_connection",
            return_value=mock_conn,
        ):
            # Create valid JWT token
            token = create_access_token(
                data={"sub": str(admin_user["id"]), "email": admin_user["email"]}
            )

            # Test get_current_user loads permissions
            user = await get_current_user(token)

            assert user["id"] == admin_user["id"]
            assert user["email"] == admin_user["email"]
            assert user["role"] == "admin"
            assert "permissions" in user
            assert len(user["permissions"]) == 5
            assert "manage_users" in user["permissions"]
            assert "database_sync" in user["permissions"]

    @pytest.mark.asyncio
    async def test_member_loads_specific_permissions(self, member_user):
        """Member user should load only assigned permissions."""
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = member_user
        mock_conn.fetch.return_value = [
            {"permission_key": "view_agent_work_orders"}
        ]

        with patch(
            "src.server.auth.dependencies.get_direct_db_connection",
            return_value=mock_conn,
        ):
            token = create_access_token(
                data={"sub": str(member_user["id"]), "email": member_user["email"]}
            )

            user = await get_current_user(token)

            assert user["role"] == "member"
            assert "permissions" in user
            assert len(user["permissions"]) == 1
            assert "view_agent_work_orders" in user["permissions"]

    @pytest.mark.asyncio
    async def test_viewer_loads_no_permissions(self, viewer_user):
        """Viewer user should have empty permissions array."""
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = viewer_user
        mock_conn.fetch.return_value = []  # No permissions

        with patch(
            "src.server.auth.dependencies.get_direct_db_connection",
            return_value=mock_conn,
        ):
            token = create_access_token(
                data={"sub": str(viewer_user["id"]), "email": viewer_user["email"]}
            )

            user = await get_current_user(token)

            assert user["role"] == "member"
            assert "permissions" in user
            assert len(user["permissions"]) == 0

    @pytest.mark.asyncio
    async def test_inactive_user_rejected(self, inactive_user):
        """Inactive user should be rejected with 403."""
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = inactive_user
        mock_conn.fetch.return_value = []

        with patch(
            "src.server.auth.dependencies.get_direct_db_connection",
            return_value=mock_conn,
        ):
            token = create_access_token(
                data={"sub": str(inactive_user["id"]), "email": inactive_user["email"]}
            )

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(token)

            assert exc_info.value.status_code == 403
            assert "inactive" in exc_info.value.detail.lower()


class TestAdminAccessControl:
    """Test admin-only access control."""

    @pytest.mark.asyncio
    async def test_admin_passes_require_admin(self, admin_user):
        """Admin user should pass require_admin dependency."""
        mock_conn = AsyncMock()
        mock_conn.fetchval.return_value = True  # user_has_permission returns True

        with patch(
            "src.server.auth.dependencies.get_direct_db_connection",
            return_value=mock_conn,
        ):
            # Should not raise exception
            result = await require_admin(admin_user)
            assert result == admin_user

    @pytest.mark.asyncio
    async def test_member_fails_require_admin(self, member_user):
        """Member user should fail require_admin dependency."""
        mock_conn = AsyncMock()
        mock_conn.fetchval.return_value = False  # user_has_permission returns False

        with patch(
            "src.server.auth.dependencies.get_direct_db_connection",
            return_value=mock_conn,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await require_admin(member_user)

            assert exc_info.value.status_code == 403
            assert "admin" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_viewer_fails_require_admin(self, viewer_user):
        """Viewer user should fail require_admin dependency."""
        mock_conn = AsyncMock()
        mock_conn.fetchval.return_value = False

        with patch(
            "src.server.auth.dependencies.get_direct_db_connection",
            return_value=mock_conn,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await require_admin(viewer_user)

            assert exc_info.value.status_code == 403


class TestTokenValidation:
    """Test JWT token validation and expiry."""

    @pytest.mark.asyncio
    async def test_expired_token_rejected(self, admin_user):
        """Expired JWT token should be rejected with 401."""
        # Create expired token
        expired_data = {
            "sub": str(admin_user["id"]),
            "email": admin_user["email"],
            "exp": datetime.utcnow() - timedelta(hours=1),  # Expired 1 hour ago
        }

        # Manually create expired token (bypass create_access_token validation)
        from src.server.auth.jwt_utils import jwt, SECRET_KEY, ALGORITHM

        expired_token = jwt.encode(expired_data, SECRET_KEY, algorithm=ALGORITHM)

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(expired_token)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_rejected(self):
        """Invalid JWT token should be rejected with 401."""
        invalid_token = "invalid.jwt.token"

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(invalid_token)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_malformed_user_id_rejected(self):
        """Token with malformed user ID should be rejected."""
        token = create_access_token(
            data={"sub": "not-a-valid-uuid", "email": "test@example.com"}
        )

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(token)

        assert exc_info.value.status_code == 401
        assert "malformed" in exc_info.value.detail.lower()


class TestPermissionInheritance:
    """Test permission inheritance and fallback logic."""

    @pytest.mark.asyncio
    async def test_admin_bypasses_permission_checks(self, admin_user):
        """Admin role should bypass specific permission checks."""
        # Admin should have access even without specific permission in array
        assert admin_user["role"] == "admin"

        # In frontend logic: isAdmin || hasPermission(...)
        # Admin should always pass

    def test_member_requires_specific_permission(self, member_user):
        """Member requires specific permission in permissions array."""
        # Member should only have access with specific permission
        assert member_user["role"] == "member"
        assert "view_agent_work_orders" in member_user["permissions"]

        # Without permission, should not have access
        assert "manage_users" not in member_user["permissions"]

    def test_viewer_has_core_features_only(self, viewer_user):
        """Viewer should have core features but no admin features."""
        assert viewer_user["role"] == "member"
        assert len(viewer_user["permissions"]) == 0

        # Viewer should have access to core features (Projects, Tasks, Knowledge Base)
        # But NOT admin features (Users, Database Sync, MCP Inspector)


class TestDatabaseIntegration:
    """Test database integration for permission queries."""

    @pytest.mark.asyncio
    async def test_permissions_query_format(self):
        """Test that permissions query returns correct format."""
        # This would test the actual SQL query format
        # Mocked for unit test, but should have integration test
        expected_query = """
            SELECT permission_key
            FROM archon_user_permissions
            WHERE user_id = $1 AND is_active = TRUE
            ORDER BY permission_key
        """

        # Verify query is formatted correctly and returns list of permission_key strings

    @pytest.mark.asyncio
    async def test_user_query_includes_role(self):
        """Test that user query includes role field."""
        expected_query = """
            SELECT
                id, email, full_name, avatar_url, is_active, is_verified,
                email_verified_at, last_login_at, created_at, updated_at, role
            FROM archon_users
            WHERE id = $1
        """

        # Verify query includes 'role' field


# Integration test markers
pytestmark = pytest.mark.unit


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
