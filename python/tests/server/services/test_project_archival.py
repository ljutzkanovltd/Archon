"""
Unit tests for project archival functionality in ProjectService.

Tests cover:
- archive_project() method
- unarchive_project() method
- list_projects() with archived filtering
"""

from unittest.mock import MagicMock, patch

import pytest

from src.server.services.projects.project_service import ProjectService


@pytest.fixture
def project_service(mock_supabase_client):
    """Create a fresh ProjectService instance with mocked Supabase client."""
    with patch("src.server.services.projects.project_service.get_supabase_client", return_value=mock_supabase_client):
        return ProjectService(supabase_client=mock_supabase_client)


@pytest.fixture
def mock_archive_response():
    """Mock successful archive RPC response."""
    return {
        "success": True,
        "tasks_archived": 8,
        "message": "Project archived successfully"
    }


@pytest.fixture
def mock_unarchive_response():
    """Mock successful unarchive RPC response."""
    return {
        "success": True,
        "tasks_unarchived": 8,
        "message": "Project unarchived successfully"
    }


@pytest.fixture
def mock_projects_list():
    """Mock projects list response."""
    return [
        {
            "id": "project-1",
            "title": "Active Project",
            "archived": False,
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z",
            "docs": [],
            "features": [],
            "data": []
        },
        {
            "id": "project-2",
            "title": "Archived Project",
            "archived": True,
            "archived_at": "2025-01-15T00:00:00Z",
            "archived_by": "User",
            "created_at": "2024-12-01T00:00:00Z",
            "updated_at": "2025-01-15T00:00:00Z",
            "docs": [],
            "features": [],
            "data": []
        }
    ]


def test_archive_project_success(project_service, mock_supabase_client, mock_archive_response):
    """Test successful project archival."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = mock_archive_response
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call archive_project
    success, result = project_service.archive_project("project-1", "TestUser")

    # Verify RPC was called correctly
    mock_supabase_client.rpc.assert_called_once_with(
        "archive_project_and_tasks",
        {"project_id_param": "project-1", "archived_by_param": "TestUser"}
    )

    # Verify result
    assert success is True
    assert result["project_id"] == "project-1"
    assert result["message"] == "Project archived successfully"
    assert result["tasks_archived"] == 8
    assert result["archived_by"] == "TestUser"


def test_archive_project_default_archived_by(project_service, mock_supabase_client, mock_archive_response):
    """Test archive_project with default archived_by parameter."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = mock_archive_response
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call archive_project without archived_by
    success, result = project_service.archive_project("project-1")

    # Verify default "User" was used
    mock_supabase_client.rpc.assert_called_once_with(
        "archive_project_and_tasks",
        {"project_id_param": "project-1", "archived_by_param": "User"}
    )

    assert success is True
    assert result["archived_by"] == "User"


def test_archive_project_not_found(project_service, mock_supabase_client):
    """Test archiving non-existent project."""
    # Mock RPC response indicating failure
    mock_execute = MagicMock()
    mock_execute.data = {
        "success": False,
        "message": "Project not found"
    }
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call archive_project
    success, result = project_service.archive_project("non-existent")

    # Verify failure
    assert success is False
    assert "error" in result
    assert "not found" in result["error"].lower()


def test_archive_project_empty_response(project_service, mock_supabase_client):
    """Test archive_project with empty database response."""
    # Mock empty RPC response
    mock_execute = MagicMock()
    mock_execute.data = None
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call archive_project
    success, result = project_service.archive_project("project-1")

    # Verify failure
    assert success is False
    assert "error" in result
    assert "no data" in result["error"].lower()


def test_archive_project_database_error(project_service, mock_supabase_client):
    """Test archive_project handling database errors."""
    # Mock RPC to raise exception
    mock_supabase_client.rpc.side_effect = Exception("Database connection failed")

    # Call archive_project
    success, result = project_service.archive_project("project-1")

    # Verify error handling
    assert success is False
    assert "error" in result
    assert "Database connection failed" in result["error"]


def test_unarchive_project_success(project_service, mock_supabase_client, mock_unarchive_response):
    """Test successful project unarchival."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = mock_unarchive_response
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call unarchive_project
    success, result = project_service.unarchive_project("project-2")

    # Verify RPC was called correctly
    mock_supabase_client.rpc.assert_called_once_with(
        "unarchive_project_and_tasks",
        {"project_id_param": "project-2"}
    )

    # Verify result
    assert success is True
    assert result["project_id"] == "project-2"
    assert result["message"] == "Project unarchived successfully"
    assert result["tasks_unarchived"] == 8


def test_unarchive_project_not_found(project_service, mock_supabase_client):
    """Test unarchiving non-existent project."""
    # Mock RPC response indicating failure
    mock_execute = MagicMock()
    mock_execute.data = {
        "success": False,
        "message": "Project not found"
    }
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call unarchive_project
    success, result = project_service.unarchive_project("non-existent")

    # Verify failure
    assert success is False
    assert "error" in result
    assert "not found" in result["error"].lower()


def test_unarchive_project_empty_response(project_service, mock_supabase_client):
    """Test unarchive_project with empty database response."""
    # Mock empty RPC response
    mock_execute = MagicMock()
    mock_execute.data = None
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call unarchive_project
    success, result = project_service.unarchive_project("project-2")

    # Verify failure
    assert success is False
    assert "error" in result
    assert "no data" in result["error"].lower()


def test_unarchive_project_database_error(project_service, mock_supabase_client):
    """Test unarchive_project handling database errors."""
    # Mock RPC to raise exception
    mock_supabase_client.rpc.side_effect = Exception("Database timeout")

    # Call unarchive_project
    success, result = project_service.unarchive_project("project-2")

    # Verify error handling
    assert success is False
    assert "error" in result
    assert "Database timeout" in result["error"]


def test_list_projects_exclude_archived_default(project_service, mock_supabase_client, mock_projects_list):
    """Test that list_projects excludes archived by default."""
    # Mock select query response
    mock_query = MagicMock()
    mock_execute = MagicMock()
    mock_execute.data = [mock_projects_list[0]]  # Only active project

    mock_query.order.return_value.execute.return_value = mock_execute
    mock_query.eq.return_value = mock_query
    mock_supabase_client.table.return_value.select.return_value = mock_query

    # Call list_projects (default include_archived=False)
    success, result = project_service.list_projects()

    # Verify archived filter was applied
    mock_query.eq.assert_called_once_with("archived", False)

    # Verify result contains only active project
    assert success is True
    assert len(result["projects"]) == 1
    assert result["projects"][0]["id"] == "project-1"
    # Note: archived field not included in list_projects response
    # Filtering is done at query level, not in response


def test_list_projects_include_archived(project_service, mock_supabase_client, mock_projects_list):
    """Test list_projects with include_archived=True."""
    # Mock select query response
    mock_query = MagicMock()
    mock_execute = MagicMock()
    mock_execute.data = mock_projects_list  # Both active and archived

    mock_query.order.return_value.execute.return_value = mock_execute
    mock_query.eq.return_value = mock_query
    mock_supabase_client.table.return_value.select.return_value = mock_query

    # Call list_projects with include_archived=True
    success, result = project_service.list_projects(include_archived=True)

    # Verify archived filter was NOT applied
    mock_query.eq.assert_not_called()

    # Verify result contains both projects
    assert success is True
    assert len(result["projects"]) == 2


def test_list_projects_lightweight_mode(project_service, mock_supabase_client, mock_projects_list):
    """Test list_projects with include_content=False (lightweight mode)."""
    # Mock select query response
    mock_query = MagicMock()
    mock_execute = MagicMock()
    mock_execute.data = [mock_projects_list[0]]

    mock_query.order.return_value.execute.return_value = mock_execute
    mock_query.eq.return_value = mock_query
    mock_supabase_client.table.return_value.select.return_value = mock_query

    # Call list_projects with include_content=False
    success, result = project_service.list_projects(include_content=False)

    # Verify result has stats instead of full content
    assert success is True
    assert len(result["projects"]) == 1
    project = result["projects"][0]
    assert "stats" in project
    assert "docs_count" in project["stats"]
    assert "features_count" in project["stats"]
    assert "has_data" in project["stats"]
    # Verify large fields are excluded in lightweight mode
    # (In lightweight mode, docs/features/data are not in the result)


def test_list_projects_error_handling(project_service, mock_supabase_client):
    """Test list_projects handling database errors."""
    # Mock table operation to raise exception
    mock_supabase_client.table.side_effect = Exception("Connection timeout")

    # Call list_projects
    success, result = project_service.list_projects()

    # Verify error handling
    assert success is False
    assert "error" in result
    assert "Connection timeout" in result["error"]


def test_archive_project_zero_tasks(project_service, mock_supabase_client):
    """Test archiving project with no associated tasks."""
    # Mock RPC response with zero tasks
    mock_execute = MagicMock()
    mock_execute.data = {
        "success": True,
        "tasks_archived": 0,
        "message": "Project archived successfully"
    }
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call archive_project
    success, result = project_service.archive_project("empty-project")

    # Verify result
    assert success is True
    assert result["tasks_archived"] == 0


def test_unarchive_project_zero_tasks(project_service, mock_supabase_client):
    """Test unarchiving project with no associated tasks."""
    # Mock RPC response with zero tasks
    mock_execute = MagicMock()
    mock_execute.data = {
        "success": True,
        "tasks_unarchived": 0,
        "message": "Project unarchived successfully"
    }
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call unarchive_project
    success, result = project_service.unarchive_project("empty-project")

    # Verify result
    assert success is True
    assert result["tasks_unarchived"] == 0
