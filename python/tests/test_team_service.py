"""
Unit tests for TeamService

Tests cover:
- create_team - team creation with/without project association
- add_team_member - adding users to teams with roles
- remove_team_member - removing users from teams
- get_team_members - retrieving team roster
- get_user_teams - finding user's team memberships
- update_member_role - changing user roles
- delete_team - cascade deletion with members
"""

from unittest.mock import MagicMock

import pytest

from src.server.services.projects.team_service import TeamService


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client for testing"""
    return MagicMock()


@pytest.fixture
def team_service(mock_supabase_client):
    """Create TeamService instance with mocked client"""
    return TeamService(supabase_client=mock_supabase_client)


@pytest.mark.asyncio
async def test_create_team_success(team_service, mock_supabase_client):
    """Test create_team successfully creates team"""
    # Mock team creation
    mock_team_response = MagicMock()
    mock_team_response.data = [{
        "id": "team-123",
        "name": "Backend Team",
        "description": "Backend developers",
        "project_id": None,
        "created_at": "2026-01-15T12:00:00Z"
    }]

    mock_table = MagicMock()
    mock_insert = MagicMock()
    mock_insert.return_value.execute.return_value = mock_team_response
    mock_table.insert = mock_insert

    mock_supabase_client.table.return_value = mock_table

    success, result = await team_service.create_team(
        name="Backend Team",
        description="Backend developers"
    )

    assert success is True
    assert result["team"]["id"] == "team-123"
    assert result["team"]["name"] == "Backend Team"
    assert result["team"]["member_count"] == 0  # New team


@pytest.mark.asyncio
async def test_create_team_with_project(team_service, mock_supabase_client):
    """Test create_team with project association"""
    # Mock project exists
    mock_project_response = MagicMock()
    mock_project_response.data = [{"id": "project-456", "title": "My Project"}]

    # Mock team creation
    mock_team_response = MagicMock()
    mock_team_response.data = [{
        "id": "team-123",
        "name": "Project Team",
        "description": "Project-specific team",
        "project_id": "project-456",
        "created_at": "2026-01-15T12:00:00Z"
    }]

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        mock_table = MagicMock()
        if call_count[0] == 1:  # First call: check project exists
            mock_select = MagicMock()
            mock_select.return_value.eq.return_value.execute.return_value = mock_project_response
            mock_table.select.return_value = mock_select
        else:  # Second call: create team
            mock_insert = MagicMock()
            mock_insert.return_value.execute.return_value = mock_team_response
            mock_table.insert = mock_insert
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    success, result = await team_service.create_team(
        name="Project Team",
        description="Project-specific team",
        project_id="project-456"
    )

    assert success is True
    assert result["team"]["project_id"] == "project-456"


@pytest.mark.asyncio
async def test_create_team_project_not_found(team_service, mock_supabase_client):
    """Test create_team fails when project doesn't exist"""
    # Mock project not found
    mock_project_response = MagicMock()
    mock_project_response.data = []

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.return_value.eq.return_value.execute.return_value = mock_project_response
    mock_table.select.return_value = mock_select

    mock_supabase_client.table.return_value = mock_table

    success, result = await team_service.create_team(
        name="Project Team",
        project_id="project-999"
    )

    assert success is False
    assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_add_team_member_success(team_service, mock_supabase_client):
    """Test add_team_member successfully adds member"""
    # Mock team exists
    mock_team_response = MagicMock()
    mock_team_response.data = [{"id": "team-123", "name": "Backend Team"}]

    # Mock member creation
    mock_member_response = MagicMock()
    mock_member_response.data = [{
        "id": "member-789",
        "team_id": "team-123",
        "user_id": "user@example.com",
        "role": "member",
        "joined_at": "2026-01-15T12:00:00Z"
    }]

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        mock_table = MagicMock()
        if call_count[0] == 1:  # First call: check team exists
            mock_select = MagicMock()
            mock_select.return_value.eq.return_value.execute.return_value = mock_team_response
            mock_table.select.return_value = mock_select
        else:  # Second call: add member
            mock_insert = MagicMock()
            mock_insert.return_value.execute.return_value = mock_member_response
            mock_table.insert = mock_insert
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    success, result = await team_service.add_team_member(
        team_id="team-123",
        user_id="user@example.com",
        role="member"
    )

    assert success is True
    assert result["member"]["user_id"] == "user@example.com"
    assert result["member"]["role"] == "member"
    assert result["team"]["name"] == "Backend Team"


@pytest.mark.asyncio
async def test_add_team_member_invalid_role(team_service):
    """Test add_team_member rejects invalid roles"""
    success, result = await team_service.add_team_member(
        team_id="team-123",
        user_id="user@example.com",
        role="invalid_role"
    )

    assert success is False
    assert "invalid role" in result["error"].lower()


@pytest.mark.asyncio
async def test_remove_team_member_success(team_service, mock_supabase_client):
    """Test remove_team_member successfully removes member"""
    # Mock delete response
    mock_delete_response = MagicMock()
    mock_delete_response.data = [{"id": "member-789"}]

    mock_table = MagicMock()
    mock_delete = MagicMock()
    mock_delete.return_value.eq.return_value.eq.return_value.execute.return_value = mock_delete_response
    mock_table.delete.return_value = mock_delete

    mock_supabase_client.table.return_value = mock_table

    success, result = await team_service.remove_team_member(
        team_id="team-123",
        user_id="user@example.com"
    )

    assert success is True
    assert "removed successfully" in result["message"].lower()


@pytest.mark.asyncio
async def test_get_team_members_success(team_service, mock_supabase_client):
    """Test get_team_members returns team roster"""
    # Mock team exists
    mock_team_response = MagicMock()
    mock_team_response.data = [{"id": "team-123", "name": "Backend Team"}]

    # Mock members response
    mock_members_response = MagicMock()
    mock_members_response.data = [
        {"id": "m-1", "user_id": "user1@example.com", "role": "lead"},
        {"id": "m-2", "user_id": "user2@example.com", "role": "member"},
        {"id": "m-3", "user_id": "user3@example.com", "role": "member"}
    ]

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        mock_table = MagicMock()
        if call_count[0] == 1:  # First call: check team
            mock_select = MagicMock()
            mock_select.return_value.eq.return_value.execute.return_value = mock_team_response
            mock_table.select.return_value = mock_select
        else:  # Second call: get members
            mock_select = MagicMock()
            mock_select.return_value.eq.return_value.order.return_value.execute.return_value = mock_members_response
            mock_table.select.return_value = mock_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    success, result = await team_service.get_team_members(team_id="team-123")

    assert success is True
    assert result["count"] == 3
    assert len(result["members"]) == 3
    assert result["team"]["member_count"] == 3


@pytest.mark.asyncio
async def test_get_user_teams_success(team_service, mock_supabase_client):
    """Test get_user_teams returns user's team memberships"""
    # Mock memberships response
    mock_memberships_response = MagicMock()
    mock_memberships_response.data = [
        {"team_id": "team-1", "role": "lead", "joined_at": "2026-01-01"},
        {"team_id": "team-2", "role": "member", "joined_at": "2026-01-10"}
    ]

    # Mock teams response
    mock_teams_response = MagicMock()
    mock_teams_response.data = [
        {"id": "team-1", "name": "Team Alpha"},
        {"id": "team-2", "name": "Team Beta"}
    ]

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        mock_table = MagicMock()
        if call_count[0] == 1:  # First call: get memberships
            mock_select = MagicMock()
            mock_select.return_value.eq.return_value.execute.return_value = mock_memberships_response
            mock_table.select.return_value = mock_select
        else:  # Second call: get teams
            mock_select = MagicMock()
            mock_select.return_value.in_.return_value.execute.return_value = mock_teams_response
            mock_table.select.return_value = mock_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    success, result = await team_service.get_user_teams(user_id="user@example.com")

    assert success is True
    assert result["count"] == 2
    assert len(result["teams"]) == 2
    assert result["teams"][0]["user_role"] == "lead"


@pytest.mark.asyncio
async def test_update_member_role_success(team_service, mock_supabase_client):
    """Test update_member_role successfully changes role"""
    # Mock update response
    mock_update_response = MagicMock()
    mock_update_response.data = [{
        "id": "member-789",
        "team_id": "team-123",
        "user_id": "user@example.com",
        "role": "lead"  # Updated role
    }]

    mock_table = MagicMock()
    mock_update = MagicMock()
    mock_update.return_value.eq.return_value.eq.return_value.execute.return_value = mock_update_response
    mock_table.update.return_value = mock_update

    mock_supabase_client.table.return_value = mock_table

    success, result = await team_service.update_member_role(
        team_id="team-123",
        user_id="user@example.com",
        new_role="lead"
    )

    assert success is True
    assert result["member"]["role"] == "lead"


@pytest.mark.asyncio
async def test_update_member_role_invalid_role(team_service):
    """Test update_member_role rejects invalid roles"""
    success, result = await team_service.update_member_role(
        team_id="team-123",
        user_id="user@example.com",
        new_role="superadmin"
    )

    assert success is False
    assert "invalid role" in result["error"].lower()


@pytest.mark.asyncio
async def test_delete_team_success(team_service, mock_supabase_client):
    """Test delete_team cascades deletion"""
    # Mock delete response
    mock_delete_response = MagicMock()
    mock_delete_response.data = [{"id": "team-123"}]

    mock_table = MagicMock()
    mock_delete = MagicMock()
    mock_delete.return_value.eq.return_value.execute.return_value = mock_delete_response
    mock_table.delete.return_value = mock_delete

    mock_supabase_client.table.return_value = mock_table

    success, result = await team_service.delete_team(team_id="team-123")

    assert success is True
    assert "deleted successfully" in result["message"].lower()
