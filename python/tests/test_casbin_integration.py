"""
Unit tests for CasbinService (RBAC Integration)

Tests cover:
- enforce - permission checking with domain-based RBAC
- assign_role - assigning roles to users in projects
- remove_role - removing role assignments
- get_user_roles - retrieving user's roles in projects
- get_users_with_role - finding users by role
- has_permission - convenience permission checker
"""

from unittest.mock import MagicMock, patch

import pytest

from src.server.services.casbin_service import CasbinService


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client for testing"""
    return MagicMock()


@pytest.fixture
def casbin_service(mock_supabase_client):
    """Create CasbinService instance with mocked client"""
    return CasbinService(supabase_client=mock_supabase_client)


@pytest.fixture
def mock_enforcer():
    """Mock Casbin enforcer"""
    return MagicMock()


@pytest.mark.asyncio
async def test_enforce_permission_granted(casbin_service, mock_enforcer):
    """Test enforce grants permission when user has role"""
    # Mock enforcer allows access
    mock_enforcer.enforce.return_value = True

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        success, result = await casbin_service.enforce(
            user_id="user@example.com",
            project_id="project-123",
            resource="task",
            action="write"
        )

    assert success is True
    assert result["allowed"] is True
    assert result["user_id"] == "user@example.com"
    assert result["project_id"] == "project-123"
    assert result["resource"] == "task"
    assert result["action"] == "write"

    # Verify enforcer was called correctly
    mock_enforcer.enforce.assert_called_once_with(
        "user@example.com", "project-123", "task", "write"
    )


@pytest.mark.asyncio
async def test_enforce_permission_denied(casbin_service, mock_enforcer):
    """Test enforce denies permission when user lacks role"""
    # Mock enforcer denies access
    mock_enforcer.enforce.return_value = False

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        success, result = await casbin_service.enforce(
            user_id="user@example.com",
            project_id="project-123",
            resource="sprint",
            action="manage"
        )

    assert success is False
    assert result["allowed"] is False
    assert "permission denied" in result["error"].lower()


@pytest.mark.asyncio
async def test_assign_role_success(casbin_service, mock_enforcer):
    """Test assign_role successfully assigns role to user"""
    # Mock enforcer accepts role assignment
    mock_enforcer.add_grouping_policy.return_value = True

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        success, result = await casbin_service.assign_role(
            user_id="user@example.com",
            role="manager",
            project_id="project-123"
        )

    assert success is True
    assert result["user_id"] == "user@example.com"
    assert result["role"] == "manager"
    assert result["project_id"] == "project-123"

    # Verify enforcer was called correctly
    mock_enforcer.add_grouping_policy.assert_called_once_with(
        "user@example.com", "manager", "project-123"
    )


@pytest.mark.asyncio
async def test_assign_role_invalid_role(casbin_service):
    """Test assign_role rejects invalid roles"""
    success, result = await casbin_service.assign_role(
        user_id="user@example.com",
        role="superadmin",  # Not in VALID_ROLES
        project_id="project-123"
    )

    assert success is False
    assert "invalid role" in result["error"].lower()


@pytest.mark.asyncio
async def test_assign_role_already_exists(casbin_service, mock_enforcer):
    """Test assign_role handles duplicate assignments"""
    # Mock enforcer rejects duplicate
    mock_enforcer.add_grouping_policy.return_value = False

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        success, result = await casbin_service.assign_role(
            user_id="user@example.com",
            role="member",
            project_id="project-123"
        )

    assert success is False
    assert "already exists" in result["error"].lower()


@pytest.mark.asyncio
async def test_remove_role_success(casbin_service, mock_enforcer):
    """Test remove_role successfully removes role assignment"""
    # Mock enforcer removes role
    mock_enforcer.remove_grouping_policy.return_value = True

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        success, result = await casbin_service.remove_role(
            user_id="user@example.com",
            role="member",
            project_id="project-123"
        )

    assert success is True
    assert "removed successfully" in result["message"].lower()

    # Verify enforcer was called correctly
    mock_enforcer.remove_grouping_policy.assert_called_once_with(
        "user@example.com", "member", "project-123"
    )


@pytest.mark.asyncio
async def test_remove_role_not_found(casbin_service, mock_enforcer):
    """Test remove_role handles non-existent role assignments"""
    # Mock enforcer can't find role
    mock_enforcer.remove_grouping_policy.return_value = False

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        success, result = await casbin_service.remove_role(
            user_id="user@example.com",
            role="admin",
            project_id="project-123"
        )

    assert success is False
    assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_get_user_roles_all_projects(casbin_service, mock_enforcer):
    """Test get_user_roles returns all roles across projects"""
    # Mock enforcer returns roles
    mock_enforcer.get_roles_for_user.return_value = ["admin", "manager"]

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        success, result = await casbin_service.get_user_roles(
            user_id="user@example.com"
        )

    assert success is True
    assert result["roles"] == ["admin", "manager"]
    assert result["count"] == 2

    mock_enforcer.get_roles_for_user.assert_called_once_with("user@example.com")


@pytest.mark.asyncio
async def test_get_user_roles_specific_project(casbin_service, mock_enforcer):
    """Test get_user_roles filters by project"""
    # Mock enforcer returns roles for specific project
    mock_enforcer.get_roles_for_user_in_domain.return_value = ["member"]

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        success, result = await casbin_service.get_user_roles(
            user_id="user@example.com",
            project_id="project-123"
        )

    assert success is True
    assert result["roles"] == ["member"]
    assert result["project_id"] == "project-123"

    mock_enforcer.get_roles_for_user_in_domain.assert_called_once_with(
        "user@example.com", "project-123"
    )


@pytest.mark.asyncio
async def test_get_users_with_role_specific_project(casbin_service, mock_enforcer):
    """Test get_users_with_role returns users with role in project"""
    # Mock enforcer returns users
    mock_enforcer.get_users_for_role_in_domain.return_value = [
        "user1@example.com",
        "user2@example.com"
    ]

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        success, result = await casbin_service.get_users_with_role(
            role="manager",
            project_id="project-123"
        )

    assert success is True
    assert result["users"] == ["user1@example.com", "user2@example.com"]
    assert result["count"] == 2

    mock_enforcer.get_users_for_role_in_domain.assert_called_once_with(
        "manager", "project-123"
    )


@pytest.mark.asyncio
async def test_get_users_with_role_invalid_role(casbin_service):
    """Test get_users_with_role rejects invalid roles"""
    success, result = await casbin_service.get_users_with_role(
        role="unknown",
        project_id="project-123"
    )

    assert success is False
    assert "invalid role" in result["error"].lower()


@pytest.mark.asyncio
async def test_has_permission_convenience_method(casbin_service, mock_enforcer):
    """Test has_permission convenience method parses permission string"""
    # Mock enforcer allows access
    mock_enforcer.enforce.return_value = True

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        success, result = await casbin_service.has_permission(
            user_id="user@example.com",
            project_id="project-123",
            permission="task:write"
        )

    assert success is True
    assert result["allowed"] is True

    # Verify enforcer was called with split permission
    mock_enforcer.enforce.assert_called_once_with(
        "user@example.com", "project-123", "task", "write"
    )


@pytest.mark.asyncio
async def test_has_permission_invalid_format(casbin_service):
    """Test has_permission rejects invalid permission format"""
    success, result = await casbin_service.has_permission(
        user_id="user@example.com",
        project_id="project-123",
        permission="invalid_format"
    )

    assert success is False
    assert "invalid permission format" in result["error"].lower()


@pytest.mark.asyncio
async def test_role_hierarchy_admin_has_all_permissions(casbin_service, mock_enforcer):
    """Test admin role has all permissions (via policy)"""
    # Mock enforcer grants admin all permissions
    mock_enforcer.enforce.return_value = True

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        # Test admin can delete projects
        success1, _ = await casbin_service.enforce(
            user_id="admin@example.com",
            project_id="project-123",
            resource="project",
            action="delete"
        )

        # Test admin can manage sprints
        success2, _ = await casbin_service.enforce(
            user_id="admin@example.com",
            project_id="project-123",
            resource="sprint",
            action="manage"
        )

    assert success1 is True
    assert success2 is True


@pytest.mark.asyncio
async def test_viewer_role_read_only(casbin_service, mock_enforcer):
    """Test viewer role has read-only access"""
    # Mock enforcer allows read, denies write
    def enforce_side_effect(user, domain, resource, action):
        return action == "read"

    mock_enforcer.enforce.side_effect = enforce_side_effect

    with patch.object(casbin_service, '_get_enforcer', return_value=mock_enforcer):
        # Viewer can read
        success_read, result_read = await casbin_service.enforce(
            user_id="viewer@example.com",
            project_id="project-123",
            resource="task",
            action="read"
        )

        # Viewer cannot write
        success_write, result_write = await casbin_service.enforce(
            user_id="viewer@example.com",
            project_id="project-123",
            resource="task",
            action="write"
        )

    assert success_read is True
    assert result_read["allowed"] is True

    assert success_write is False
    assert result_write["allowed"] is False
