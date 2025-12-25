"""
Unit tests for task completion tracking functionality in TaskService.

Tests cover:
- get_completion_stats() method
- Aggregate statistics calculation
- Recently completed tasks retrieval
- Error handling and edge cases
"""

from unittest.mock import MagicMock, patch

import pytest

from src.server.services.projects.task_service import TaskService


@pytest.fixture
def task_service(mock_supabase_client):
    """Create a fresh TaskService instance with mocked Supabase client."""
    with patch("src.server.services.projects.task_service.get_supabase_client", return_value=mock_supabase_client):
        return TaskService(supabase_client=mock_supabase_client)


@pytest.fixture
def mock_completion_stats():
    """Mock completion statistics for a project."""
    return {
        "project_id": "project-1",
        "total_tasks": 31,
        "completed_tasks": 9,
        "in_progress_tasks": 5,
        "completion_rate": 29.03,
        "avg_completion_time_hours": 0.27
    }


@pytest.fixture
def mock_recently_completed():
    """Mock recently completed tasks list."""
    return [
        {
            "task_id": "task-3",
            "title": "Deploy Phase 0 enhancements",
            "project_id": "project-1",
            "completed_at": "2025-01-20T17:29:09Z",
            "completed_by": "User",
            "time_to_complete": "00:20:25"
        },
        {
            "task_id": "task-2",
            "title": "Write unit tests",
            "project_id": "project-1",
            "completed_at": "2025-01-20T16:15:30Z",
            "completed_by": "Archon",
            "time_to_complete": "01:15:00"
        },
        {
            "task_id": "task-1",
            "title": "Create database schema",
            "project_id": "project-1",
            "completed_at": "2025-01-20T15:00:00Z",
            "completed_by": "User",
            "time_to_complete": "00:45:30"
        }
    ]


def test_get_completion_stats_with_project_id(task_service, mock_supabase_client, mock_completion_stats, mock_recently_completed):
    """Test get_completion_stats with specific project ID."""
    # Mock stats RPC response
    mock_stats_execute = MagicMock()
    mock_stats_execute.data = mock_completion_stats

    # Mock recently completed RPC response
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = mock_recently_completed

    # Setup RPC to return different responses for different calls
    mock_supabase_client.rpc.return_value.execute.side_effect = [
        mock_stats_execute,
        mock_recent_execute
    ]

    # Call get_completion_stats
    success, result = task_service.get_completion_stats(project_id="project-1", days=7, limit=50)

    # Verify RPC calls
    assert mock_supabase_client.rpc.call_count == 2

    # Verify first call (stats)
    first_call = mock_supabase_client.rpc.call_args_list[0]
    assert first_call[0][0] == "get_project_completion_stats"
    assert first_call[0][1] == {"project_id_param": "project-1"}

    # Verify second call (recently completed)
    second_call = mock_supabase_client.rpc.call_args_list[1]
    assert second_call[0][0] == "get_recently_completed_tasks"
    assert second_call[0][1] == {
        "days_param": 7,
        "project_id_param": "project-1",
        "limit_param": 50
    }

    # Verify result
    assert success is True
    assert result["project_id"] == "project-1"
    assert result["days_range"] == 7
    assert result["stats"] == mock_completion_stats
    assert result["count"] == 3
    assert len(result["recently_completed"]) == 3


def test_get_completion_stats_without_project_id(task_service, mock_supabase_client, mock_recently_completed):
    """Test get_completion_stats without project ID (all projects)."""
    # Mock recently completed RPC response
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = mock_recently_completed
    mock_supabase_client.rpc.return_value.execute.return_value = mock_recent_execute

    # Call get_completion_stats without project_id
    success, result = task_service.get_completion_stats(days=30, limit=100)

    # Verify only recently completed RPC was called (no stats call)
    mock_supabase_client.rpc.assert_called_once_with(
        "get_recently_completed_tasks",
        {
            "days_param": 30,
            "project_id_param": None,
            "limit_param": 100
        }
    )

    # Verify result
    assert success is True
    assert result["project_id"] is None
    assert result["days_range"] == 30
    assert result["stats"] == {}  # Empty when no project_id
    assert len(result["recently_completed"]) == 3


def test_get_completion_stats_default_parameters(task_service, mock_supabase_client):
    """Test get_completion_stats with default parameters."""
    # Mock recently completed RPC response
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = []
    mock_supabase_client.rpc.return_value.execute.return_value = mock_recent_execute

    # Call get_completion_stats with defaults
    success, result = task_service.get_completion_stats()

    # Verify RPC was called with defaults
    mock_supabase_client.rpc.assert_called_once_with(
        "get_recently_completed_tasks",
        {
            "days_param": 7,  # Default
            "project_id_param": None,  # Default
            "limit_param": 50  # Default
        }
    )

    assert success is True
    assert result["days_range"] == 7
    assert result["project_id"] is None


def test_get_completion_stats_no_completed_tasks(task_service, mock_supabase_client):
    """Test get_completion_stats when no tasks are completed."""
    # Mock empty stats
    mock_stats_execute = MagicMock()
    mock_stats_execute.data = {
        "project_id": "project-1",
        "total_tasks": 10,
        "completed_tasks": 0,
        "in_progress_tasks": 3,
        "completion_rate": 0.0,
        "avg_completion_time_hours": None
    }

    # Mock empty recently completed
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = []

    mock_supabase_client.rpc.return_value.execute.side_effect = [
        mock_stats_execute,
        mock_recent_execute
    ]

    # Call get_completion_stats
    success, result = task_service.get_completion_stats(project_id="project-1")

    # Verify result
    assert success is True
    assert result["stats"]["completed_tasks"] == 0
    assert result["stats"]["completion_rate"] == 0.0
    assert result["count"] == 0
    assert result["recently_completed"] == []


def test_get_completion_stats_empty_stats_response(task_service, mock_supabase_client):
    """Test get_completion_stats when stats RPC returns non-dict."""
    # Mock stats response as list (unexpected)
    mock_stats_execute = MagicMock()
    mock_stats_execute.data = []  # List instead of dict

    # Mock recently completed
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = []

    mock_supabase_client.rpc.return_value.execute.side_effect = [
        mock_stats_execute,
        mock_recent_execute
    ]

    # Call get_completion_stats
    success, result = task_service.get_completion_stats(project_id="project-1")

    # Verify result handles unexpected response gracefully
    assert success is True
    assert result["stats"] == {}  # Empty dict fallback


def test_get_completion_stats_empty_recently_completed_response(task_service, mock_supabase_client, mock_completion_stats):
    """Test get_completion_stats when recently completed RPC returns non-list."""
    # Mock stats
    mock_stats_execute = MagicMock()
    mock_stats_execute.data = mock_completion_stats

    # Mock recently completed as dict (unexpected)
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = {"error": "some error"}  # Dict instead of list

    mock_supabase_client.rpc.return_value.execute.side_effect = [
        mock_stats_execute,
        mock_recent_execute
    ]

    # Call get_completion_stats
    success, result = task_service.get_completion_stats(project_id="project-1")

    # Verify result handles unexpected response gracefully
    assert success is True
    assert result["recently_completed"] == []  # Empty list fallback
    assert result["count"] == 0


def test_get_completion_stats_database_error_stats(task_service, mock_supabase_client):
    """Test get_completion_stats when stats RPC fails."""
    # Mock stats RPC to raise exception
    mock_supabase_client.rpc.side_effect = Exception("Database timeout")

    # Call get_completion_stats
    success, result = task_service.get_completion_stats(project_id="project-1")

    # Verify error handling
    assert success is False
    assert "error" in result
    assert "Database timeout" in result["error"]


def test_get_completion_stats_database_error_recently_completed(task_service, mock_supabase_client, mock_completion_stats):
    """Test get_completion_stats when recently completed RPC fails."""
    # Mock stats success
    mock_stats_execute = MagicMock()
    mock_stats_execute.data = mock_completion_stats

    # Mock recently completed to fail
    mock_supabase_client.rpc.return_value.execute.side_effect = [
        mock_stats_execute,
        Exception("Connection lost")
    ]

    # Call get_completion_stats
    success, result = task_service.get_completion_stats(project_id="project-1")

    # Verify error handling
    assert success is False
    assert "error" in result
    assert "Connection lost" in result["error"]


def test_get_completion_stats_completion_rate_calculation(task_service, mock_supabase_client):
    """Test completion rate calculation in stats."""
    # Mock stats with specific values
    mock_stats = {
        "project_id": "project-1",
        "total_tasks": 100,
        "completed_tasks": 25,
        "in_progress_tasks": 10,
        "completion_rate": 25.0,
        "avg_completion_time_hours": 1.5
    }
    mock_stats_execute = MagicMock()
    mock_stats_execute.data = mock_stats

    # Mock recently completed
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = []

    mock_supabase_client.rpc.return_value.execute.side_effect = [
        mock_stats_execute,
        mock_recent_execute
    ]

    # Call get_completion_stats
    success, result = task_service.get_completion_stats(project_id="project-1")

    # Verify completion rate
    assert success is True
    assert result["stats"]["completion_rate"] == 25.0
    assert result["stats"]["total_tasks"] == 100
    assert result["stats"]["completed_tasks"] == 25


def test_get_completion_stats_avg_completion_time(task_service, mock_supabase_client):
    """Test average completion time calculation in stats."""
    # Mock stats with avg completion time
    mock_stats = {
        "project_id": "project-1",
        "total_tasks": 50,
        "completed_tasks": 20,
        "in_progress_tasks": 5,
        "completion_rate": 40.0,
        "avg_completion_time_hours": 2.75  # 2 hours 45 minutes
    }
    mock_stats_execute = MagicMock()
    mock_stats_execute.data = mock_stats

    # Mock recently completed
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = []

    mock_supabase_client.rpc.return_value.execute.side_effect = [
        mock_stats_execute,
        mock_recent_execute
    ]

    # Call get_completion_stats
    success, result = task_service.get_completion_stats(project_id="project-1")

    # Verify average completion time
    assert success is True
    assert result["stats"]["avg_completion_time_hours"] == 2.75


def test_get_completion_stats_recently_completed_order(task_service, mock_supabase_client, mock_recently_completed):
    """Test that recently completed tasks are ordered by completed_at DESC."""
    # Mock recently completed
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = mock_recently_completed
    mock_supabase_client.rpc.return_value.execute.return_value = mock_recent_execute

    # Call get_completion_stats
    success, result = task_service.get_completion_stats()

    # Verify result
    assert success is True
    tasks = result["recently_completed"]
    assert len(tasks) == 3

    # Verify order (most recent first)
    assert tasks[0]["completed_at"] == "2025-01-20T17:29:09Z"
    assert tasks[1]["completed_at"] == "2025-01-20T16:15:30Z"
    assert tasks[2]["completed_at"] == "2025-01-20T15:00:00Z"


def test_get_completion_stats_time_to_complete_field(task_service, mock_supabase_client, mock_recently_completed):
    """Test that time_to_complete field is present in recently completed tasks."""
    # Mock recently completed
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = mock_recently_completed
    mock_supabase_client.rpc.return_value.execute.return_value = mock_recent_execute

    # Call get_completion_stats
    success, result = task_service.get_completion_stats()

    # Verify result
    assert success is True
    tasks = result["recently_completed"]

    # Verify time_to_complete field
    for task in tasks:
        assert "time_to_complete" in task
        assert isinstance(task["time_to_complete"], str)


def test_get_completion_stats_completed_by_field(task_service, mock_supabase_client, mock_recently_completed):
    """Test that completed_by field is present in recently completed tasks."""
    # Mock recently completed
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = mock_recently_completed
    mock_supabase_client.rpc.return_value.execute.return_value = mock_recent_execute

    # Call get_completion_stats
    success, result = task_service.get_completion_stats()

    # Verify result
    assert success is True
    tasks = result["recently_completed"]

    # Verify completed_by field
    completed_by_values = {task["completed_by"] for task in tasks}
    assert "User" in completed_by_values
    assert "Archon" in completed_by_values


def test_get_completion_stats_custom_days_range(task_service, mock_supabase_client):
    """Test get_completion_stats with custom days parameter."""
    # Mock recently completed
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = []
    mock_supabase_client.rpc.return_value.execute.return_value = mock_recent_execute

    # Call get_completion_stats with custom days
    success, result = task_service.get_completion_stats(days=14)

    # Verify RPC was called with custom days
    mock_supabase_client.rpc.assert_called_once_with(
        "get_recently_completed_tasks",
        {
            "days_param": 14,
            "project_id_param": None,
            "limit_param": 50
        }
    )

    assert success is True
    assert result["days_range"] == 14


def test_get_completion_stats_custom_limit(task_service, mock_supabase_client):
    """Test get_completion_stats with custom limit parameter."""
    # Mock recently completed
    mock_recent_execute = MagicMock()
    mock_recent_execute.data = []
    mock_supabase_client.rpc.return_value.execute.return_value = mock_recent_execute

    # Call get_completion_stats with custom limit
    success, result = task_service.get_completion_stats(limit=20)

    # Verify RPC was called with custom limit
    mock_supabase_client.rpc.assert_called_once_with(
        "get_recently_completed_tasks",
        {
            "days_param": 7,
            "project_id_param": None,
            "limit_param": 20
        }
    )

    assert success is True


def test_get_completion_stats_none_response_handling(task_service, mock_supabase_client):
    """Test get_completion_stats when RPC returns None."""
    # Mock None responses
    mock_execute = MagicMock()
    mock_execute.data = None
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_completion_stats
    success, result = task_service.get_completion_stats()

    # Verify result handles None gracefully
    assert success is True
    assert result["recently_completed"] == []
    assert result["count"] == 0
