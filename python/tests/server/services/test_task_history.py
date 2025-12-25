"""
Unit tests for task history tracking functionality in TaskService.

Tests cover:
- get_task_history() method
- History filtering by field_name
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
def mock_task_history():
    """Mock task history response with multiple changes."""
    return [
        {
            "change_id": "change-3",
            "task_id": "task-1",
            "field_name": "status",
            "old_value": "doing",
            "new_value": "done",
            "changed_by": "User",
            "changed_at": "2025-01-20T15:30:00Z",
            "change_reason": None
        },
        {
            "change_id": "change-2",
            "task_id": "task-1",
            "field_name": "status",
            "old_value": "todo",
            "new_value": "doing",
            "changed_by": "User",
            "changed_at": "2025-01-20T14:00:00Z",
            "change_reason": None
        },
        {
            "change_id": "change-1",
            "task_id": "task-1",
            "field_name": "assignee",
            "old_value": "Archon",
            "new_value": "User",
            "changed_by": "Admin",
            "changed_at": "2025-01-20T13:00:00Z",
            "change_reason": "Reassignment"
        }
    ]


@pytest.fixture
def mock_status_history():
    """Mock task history filtered by status field."""
    return [
        {
            "change_id": "change-3",
            "task_id": "task-1",
            "field_name": "status",
            "old_value": "doing",
            "new_value": "done",
            "changed_by": "User",
            "changed_at": "2025-01-20T15:30:00Z",
            "change_reason": None
        },
        {
            "change_id": "change-2",
            "task_id": "task-1",
            "field_name": "status",
            "old_value": "todo",
            "new_value": "doing",
            "changed_by": "User",
            "changed_at": "2025-01-20T14:00:00Z",
            "change_reason": None
        }
    ]


def test_get_task_history_success(task_service, mock_supabase_client, mock_task_history):
    """Test successful retrieval of task history."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = mock_task_history
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history
    success, result = task_service.get_task_history("task-1")

    # Verify RPC was called correctly
    mock_supabase_client.rpc.assert_called_once_with(
        "get_task_history",
        {
            "task_id_param": "task-1",
            "field_name_param": None,
            "limit_param": 50
        }
    )

    # Verify result
    assert success is True
    assert result["task_id"] == "task-1"
    assert result["count"] == 3
    assert result["field_filter"] is None
    assert len(result["changes"]) == 3
    assert result["changes"][0]["change_id"] == "change-3"


def test_get_task_history_with_field_filter(task_service, mock_supabase_client, mock_status_history):
    """Test get_task_history with field_name filter."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = mock_status_history
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history with field filter
    success, result = task_service.get_task_history("task-1", field_name="status")

    # Verify RPC was called with field_name
    mock_supabase_client.rpc.assert_called_once_with(
        "get_task_history",
        {
            "task_id_param": "task-1",
            "field_name_param": "status",
            "limit_param": 50
        }
    )

    # Verify result
    assert success is True
    assert result["field_filter"] == "status"
    assert result["count"] == 2
    # All changes should be for status field
    for change in result["changes"]:
        assert change["field_name"] == "status"


def test_get_task_history_with_limit(task_service, mock_supabase_client, mock_task_history):
    """Test get_task_history with custom limit."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = mock_task_history[:2]  # Return only 2 changes
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history with limit
    success, result = task_service.get_task_history("task-1", limit=2)

    # Verify RPC was called with limit
    mock_supabase_client.rpc.assert_called_once_with(
        "get_task_history",
        {
            "task_id_param": "task-1",
            "field_name_param": None,
            "limit_param": 2
        }
    )

    # Verify result
    assert success is True
    assert result["count"] == 2


def test_get_task_history_no_changes(task_service, mock_supabase_client):
    """Test get_task_history for task with no changes."""
    # Mock RPC response with empty list
    mock_execute = MagicMock()
    mock_execute.data = []
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history
    success, result = task_service.get_task_history("new-task")

    # Verify result
    assert success is True
    assert result["count"] == 0
    assert result["changes"] == []


def test_get_task_history_empty_response(task_service, mock_supabase_client):
    """Test get_task_history with None response data."""
    # Mock RPC response with None
    mock_execute = MagicMock()
    mock_execute.data = None
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history
    success, result = task_service.get_task_history("task-1")

    # Verify result (should handle None gracefully)
    assert success is True
    assert result["count"] == 0
    assert result["changes"] == []


def test_get_task_history_database_error(task_service, mock_supabase_client):
    """Test get_task_history handling database errors."""
    # Mock RPC to raise exception
    mock_supabase_client.rpc.side_effect = Exception("Database connection timeout")

    # Call get_task_history
    success, result = task_service.get_task_history("task-1")

    # Verify error handling
    assert success is False
    assert "error" in result
    assert "Database connection timeout" in result["error"]


def test_get_task_history_invalid_task_id(task_service, mock_supabase_client):
    """Test get_task_history with invalid task ID."""
    # Mock RPC to raise exception for invalid UUID
    mock_supabase_client.rpc.side_effect = Exception("invalid input syntax for type uuid")

    # Call get_task_history
    success, result = task_service.get_task_history("invalid-uuid")

    # Verify error handling
    assert success is False
    assert "error" in result


def test_get_task_history_response_order(task_service, mock_supabase_client, mock_task_history):
    """Test that task history is ordered by changed_at DESC (most recent first)."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = mock_task_history
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history
    success, result = task_service.get_task_history("task-1")

    # Verify result
    assert success is True
    changes = result["changes"]
    assert len(changes) == 3

    # Verify order (most recent first)
    assert changes[0]["changed_at"] == "2025-01-20T15:30:00Z"
    assert changes[1]["changed_at"] == "2025-01-20T14:00:00Z"
    assert changes[2]["changed_at"] == "2025-01-20T13:00:00Z"


def test_get_task_history_multiple_field_types(task_service, mock_supabase_client, mock_task_history):
    """Test task history containing changes to different fields."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = mock_task_history
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history
    success, result = task_service.get_task_history("task-1")

    # Verify result
    assert success is True
    changes = result["changes"]

    # Verify different field types are present
    field_names = {change["field_name"] for change in changes}
    assert "status" in field_names
    assert "assignee" in field_names


def test_get_task_history_with_change_reason(task_service, mock_supabase_client, mock_task_history):
    """Test task history with change_reason field populated."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = mock_task_history
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history
    success, result = task_service.get_task_history("task-1")

    # Verify result
    assert success is True
    changes = result["changes"]

    # Find change with reason
    reassignment_change = next(c for c in changes if c["field_name"] == "assignee")
    assert reassignment_change["change_reason"] == "Reassignment"

    # Status changes have no reason
    status_changes = [c for c in changes if c["field_name"] == "status"]
    for change in status_changes:
        assert change["change_reason"] is None


def test_get_task_history_default_limit(task_service, mock_supabase_client, mock_task_history):
    """Test that default limit of 50 is used when not specified."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = mock_task_history
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history without limit
    task_service.get_task_history("task-1")

    # Verify default limit was used
    mock_supabase_client.rpc.assert_called_once_with(
        "get_task_history",
        {
            "task_id_param": "task-1",
            "field_name_param": None,
            "limit_param": 50  # Default
        }
    )


def test_get_task_history_large_limit(task_service, mock_supabase_client):
    """Test get_task_history with very large limit."""
    # Mock RPC response
    mock_execute = MagicMock()
    mock_execute.data = []
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history with large limit
    success, result = task_service.get_task_history("task-1", limit=1000)

    # Verify RPC was called with large limit
    mock_supabase_client.rpc.assert_called_once_with(
        "get_task_history",
        {
            "task_id_param": "task-1",
            "field_name_param": None,
            "limit_param": 1000
        }
    )

    assert success is True


def test_get_task_history_dict_response_handling(task_service, mock_supabase_client):
    """Test handling when RPC returns dict instead of list."""
    # Mock RPC response with dict
    mock_execute = MagicMock()
    mock_execute.data = {"error": "some error"}  # Dict instead of list
    mock_supabase_client.rpc.return_value.execute.return_value = mock_execute

    # Call get_task_history
    success, result = task_service.get_task_history("task-1")

    # Verify it handles dict gracefully
    assert success is True
    assert result["changes"] == []  # Empty list fallback
    assert result["count"] == 0
