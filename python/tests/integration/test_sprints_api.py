"""
Integration tests for Sprints API endpoints.

Tests cover:
- POST /api/projects/{project_id}/sprints - create sprint
- POST /api/sprints/{sprint_id}/start - activate sprint
- POST /api/sprints/{sprint_id}/complete - close sprint
- GET /api/projects/{project_id}/sprints - list sprints
- GET /api/sprints/{sprint_id} - get sprint details
- GET /api/sprints/{sprint_id}/velocity - get velocity metrics
- PUT /api/tasks/{task_id}/sprint - assign task to sprint
- GET /api/projects/{project_id}/sprints/active - get active sprint
- Error responses (404, 400, 409)
- Date validation
- OpenAPI schema validation
"""

from unittest.mock import MagicMock, patch
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_sprint_service():
    """Mock SprintService for API testing."""
    with patch("src.server.api_routes.sprints.SprintService") as mock:
        yield mock.return_value


@pytest.fixture
def client():
    """Create test client."""
    from src.server.main import app
    return TestClient(app)


@pytest.fixture
def mock_sprint():
    """Mock sprint object."""
    return {
        "id": "sprint-123",
        "project_id": "project-456",
        "name": "Sprint 1",
        "goal": "Implement user authentication",
        "start_date": "2026-01-20",
        "end_date": "2026-02-03",
        "status": "planned",
        "velocity": None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


@pytest.fixture
def mock_tasks():
    """Mock sprint tasks."""
    return [
        {"id": "task-1", "title": "Implement login", "story_points": 5},
        {"id": "task-2", "title": "Add password reset", "story_points": 3},
        {"id": "task-3", "title": "Write tests", "story_points": 2},
    ]


def test_create_sprint_success(client, mock_sprint_service, mock_sprint):
    """Test POST /api/projects/{project_id}/sprints creates sprint."""
    # Mock service response
    mock_sprint_service.create_sprint.return_value = (True, {"sprint": mock_sprint})

    # Make request
    response = client.post(
        "/api/projects/project-456/sprints",
        json={
            "name": "Sprint 1",
            "start_date": "2026-01-20",
            "end_date": "2026-02-03",
            "goal": "Implement user authentication"
        }
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "sprint-123"
    assert data["name"] == "Sprint 1"
    assert data["status"] == "planned"
    assert data["goal"] == "Implement user authentication"


def test_create_sprint_invalid_dates(client, mock_sprint_service):
    """Test POST /api/projects/{project_id}/sprints validates dates."""
    # Make request with end_date before start_date
    response = client.post(
        "/api/projects/project-456/sprints",
        json={
            "name": "Sprint 1",
            "start_date": "2026-02-03",
            "end_date": "2026-01-20",  # Before start!
            "goal": "Test"
        }
    )

    # Assertions
    assert response.status_code == 400
    data = response.json()
    assert "after start_date" in data["detail"]


def test_start_sprint_success(client, mock_sprint_service, mock_sprint):
    """Test POST /api/sprints/{sprint_id}/start activates sprint."""
    active_sprint = {**mock_sprint, "status": "active"}
    mock_sprint_service.start_sprint.return_value = (True, {"sprint": active_sprint})

    # Make request
    response = client.post("/api/sprints/sprint-123/start")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    mock_sprint_service.start_sprint.assert_called_once_with("sprint-123")


def test_start_sprint_conflict(client, mock_sprint_service):
    """Test POST /api/sprints/{sprint_id}/start returns 409 when another sprint active."""
    # Mock conflict response
    mock_sprint_service.start_sprint.return_value = (
        False,
        {"error": "Project already has an active sprint: 'Sprint 0' (sprint-999)"}
    )

    # Make request
    response = client.post("/api/sprints/sprint-123/start")

    # Assertions
    assert response.status_code == 409
    data = response.json()
    assert "already has an active sprint" in data["detail"]


def test_start_sprint_not_found(client, mock_sprint_service):
    """Test POST /api/sprints/{sprint_id}/start returns 404."""
    # Mock not found response
    mock_sprint_service.start_sprint.return_value = (
        False,
        {"error": "Sprint sprint-999 not found"}
    )

    # Make request
    response = client.post("/api/sprints/sprint-999/start")

    # Assertions
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_complete_sprint_success(client, mock_sprint_service, mock_sprint):
    """Test POST /api/sprints/{sprint_id}/complete closes sprint."""
    completed_sprint = {**mock_sprint, "status": "completed", "velocity": 8}
    mock_sprint_service.complete_sprint.return_value = (
        True,
        {"sprint": completed_sprint, "velocity": 8}
    )

    # Make request
    response = client.post("/api/sprints/sprint-123/complete")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["sprint"]["status"] == "completed"
    assert data["velocity"] == 8
    mock_sprint_service.complete_sprint.assert_called_once_with("sprint-123")


def test_complete_sprint_invalid_status(client, mock_sprint_service):
    """Test POST /api/sprints/{sprint_id}/complete returns 400 for invalid status."""
    # Mock invalid status response
    mock_sprint_service.complete_sprint.return_value = (
        False,
        {"error": "Cannot complete sprint with status 'completed'"}
    )

    # Make request
    response = client.post("/api/sprints/sprint-123/complete")

    # Assertions
    assert response.status_code == 400
    data = response.json()
    assert "cannot complete" in data["detail"].lower()


def test_list_sprints_success(client, mock_sprint_service):
    """Test GET /api/projects/{project_id}/sprints lists all sprints."""
    sprints = [
        {"id": "sprint-3", "name": "Sprint 3", "status": "planned"},
        {"id": "sprint-2", "name": "Sprint 2", "status": "active"},
        {"id": "sprint-1", "name": "Sprint 1", "status": "completed"},
    ]
    mock_sprint_service.list_sprints.return_value = (
        True,
        {"sprints": sprints, "count": 3}
    )

    # Make request
    response = client.get("/api/projects/project-456/sprints")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 3
    assert len(data["sprints"]) == 3
    mock_sprint_service.list_sprints.assert_called_once_with(
        project_id="project-456",
        include_cancelled=False
    )


def test_list_sprints_with_cancelled(client, mock_sprint_service):
    """Test GET /api/projects/{project_id}/sprints includes cancelled when requested."""
    sprints = [
        {"id": "sprint-3", "name": "Sprint 3", "status": "planned"},
        {"id": "sprint-2", "name": "Sprint 2", "status": "cancelled"},
    ]
    mock_sprint_service.list_sprints.return_value = (
        True,
        {"sprints": sprints, "count": 2}
    )

    # Make request
    response = client.get("/api/projects/project-456/sprints?include_cancelled=true")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2
    mock_sprint_service.list_sprints.assert_called_once_with(
        project_id="project-456",
        include_cancelled=True
    )


def test_get_sprint_success(client, mock_sprint_service, mock_sprint, mock_tasks):
    """Test GET /api/sprints/{sprint_id} returns sprint with tasks."""
    # Mock service responses
    mock_sprint_service.get_sprint_by_id.return_value = (True, {"sprint": mock_sprint})
    mock_sprint_service.get_sprint_tasks.return_value = (True, {"tasks": mock_tasks, "count": 3})

    # Make request
    response = client.get("/api/sprints/sprint-123?include_tasks=true")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "sprint-123"
    assert data["tasks"] == mock_tasks
    assert data["task_count"] == 3
    mock_sprint_service.get_sprint_by_id.assert_called_once_with("sprint-123")
    mock_sprint_service.get_sprint_tasks.assert_called_once_with("sprint-123")


def test_get_sprint_without_tasks(client, mock_sprint_service, mock_sprint):
    """Test GET /api/sprints/{sprint_id} without tasks."""
    # Mock service response
    mock_sprint_service.get_sprint_by_id.return_value = (True, {"sprint": mock_sprint})

    # Make request
    response = client.get("/api/sprints/sprint-123?include_tasks=false")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "sprint-123"
    assert "tasks" not in data or data.get("tasks") is None
    # Should not have called get_sprint_tasks
    mock_sprint_service.get_sprint_tasks.assert_not_called()


def test_get_sprint_not_found(client, mock_sprint_service):
    """Test GET /api/sprints/{sprint_id} returns 404."""
    # Mock not found response
    mock_sprint_service.get_sprint_by_id.return_value = (
        False,
        {"error": "Sprint sprint-999 not found"}
    )

    # Make request
    response = client.get("/api/sprints/sprint-999")

    # Assertions
    assert response.status_code == 404


def test_get_sprint_velocity_success(client, mock_sprint_service):
    """Test GET /api/sprints/{sprint_id}/velocity returns velocity metrics."""
    # Mock service responses
    mock_sprint_service.calculate_sprint_velocity.return_value = (True, {"velocity": 8})
    mock_sprint_service.get_sprint_tasks.return_value = (True, {"tasks": [], "count": 10})

    # Make request
    response = client.get("/api/sprints/sprint-123/velocity")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["sprint_id"] == "sprint-123"
    assert data["velocity"] == 8
    assert data["task_count"] == 10
    mock_sprint_service.calculate_sprint_velocity.assert_called_once_with("sprint-123")


def test_assign_task_to_sprint_success(client, mock_sprint_service):
    """Test PUT /api/tasks/{task_id}/sprint assigns task."""
    # Mock service response
    updated_task = {"id": "task-1", "sprint_id": "sprint-123"}
    mock_sprint_service.move_task_to_sprint.return_value = (True, {"task": updated_task})

    # Make request
    response = client.put(
        "/api/tasks/task-1/sprint",
        json={"sprint_id": "sprint-123"}
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "task-1"
    assert data["sprint_id"] == "sprint-123"
    mock_sprint_service.move_task_to_sprint.assert_called_once_with(
        task_id="task-1",
        sprint_id="sprint-123"
    )


def test_assign_task_remove_from_sprint(client, mock_sprint_service):
    """Test PUT /api/tasks/{task_id}/sprint removes task from sprint."""
    # Mock service response
    updated_task = {"id": "task-1", "sprint_id": None}
    mock_sprint_service.move_task_to_sprint.return_value = (True, {"task": updated_task})

    # Make request (null sprint_id removes from sprint)
    response = client.put(
        "/api/tasks/task-1/sprint",
        json={"sprint_id": None}
    )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "task-1"
    assert data["sprint_id"] is None
    mock_sprint_service.move_task_to_sprint.assert_called_once_with(
        task_id="task-1",
        sprint_id=None
    )


def test_assign_task_different_project(client, mock_sprint_service):
    """Test PUT /api/tasks/{task_id}/sprint returns 400 for different project."""
    # Mock service response
    mock_sprint_service.move_task_to_sprint.return_value = (
        False,
        {"error": "Task and sprint must belong to the same project"}
    )

    # Make request
    response = client.put(
        "/api/tasks/task-1/sprint",
        json={"sprint_id": "sprint-123"}
    )

    # Assertions
    assert response.status_code == 400
    data = response.json()
    assert "same project" in data["detail"].lower()


def test_assign_task_not_found(client, mock_sprint_service):
    """Test PUT /api/tasks/{task_id}/sprint returns 404."""
    # Mock not found response
    mock_sprint_service.move_task_to_sprint.return_value = (
        False,
        {"error": "Task task-999 not found"}
    )

    # Make request
    response = client.put(
        "/api/tasks/task-999/sprint",
        json={"sprint_id": "sprint-123"}
    )

    # Assertions
    assert response.status_code == 404


def test_get_active_sprint_success(client, mock_sprint_service, mock_sprint):
    """Test GET /api/projects/{project_id}/sprints/active returns active sprint."""
    active_sprint = {**mock_sprint, "status": "active"}
    mock_sprint_service.get_active_sprint.return_value = (
        True,
        {"sprint": active_sprint}
    )

    # Make request
    response = client.get("/api/projects/project-456/sprints/active")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == "project-456"
    assert data["sprint"]["status"] == "active"
    mock_sprint_service.get_active_sprint.assert_called_once_with("project-456")


def test_get_active_sprint_none(client, mock_sprint_service):
    """Test GET /api/projects/{project_id}/sprints/active returns null when no active sprint."""
    # Mock no active sprint
    mock_sprint_service.get_active_sprint.return_value = (True, {"sprint": None})

    # Make request
    response = client.get("/api/projects/project-456/sprints/active")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["project_id"] == "project-456"
    assert data["sprint"] is None


def test_openapi_schema_includes_sprints(client):
    """Test OpenAPI schema includes sprint endpoints."""
    response = client.get("/openapi.json")
    assert response.status_code == 200

    schema = response.json()

    # Verify sprint endpoints are documented
    paths = schema["paths"]
    assert "/api/projects/{project_id}/sprints" in paths
    assert "/api/sprints/{sprint_id}" in paths
    assert "/api/sprints/{sprint_id}/start" in paths
    assert "/api/sprints/{sprint_id}/complete" in paths
    assert "/api/sprints/{sprint_id}/velocity" in paths
    assert "/api/tasks/{task_id}/sprint" in paths
    assert "/api/projects/{project_id}/sprints/active" in paths

    # Verify HTTP methods
    assert "post" in paths["/api/projects/{project_id}/sprints"]
    assert "get" in paths["/api/projects/{project_id}/sprints"]
    assert "post" in paths["/api/sprints/{sprint_id}/start"]
    assert "post" in paths["/api/sprints/{sprint_id}/complete"]
    assert "get" in paths["/api/sprints/{sprint_id}"]
    assert "put" in paths["/api/tasks/{task_id}/sprint"]
