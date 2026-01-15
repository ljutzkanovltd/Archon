"""
Integration tests for Workflows API endpoints.

Tests cover:
- GET /api/workflows/{workflow_id} - get workflow details
- GET /api/workflows/{workflow_id}/stages - get ordered stages
- GET /api/project-types/{type_id}/workflow - get default workflow
- POST /api/tasks/{task_id}/transition - move task to new stage
- GET /api/workflow-stages/{stage_id}/transitions - get available transitions
- Error responses (404, 400, 409)
- OpenAPI schema validation
"""

from unittest.mock import MagicMock, patch
from datetime import datetime

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_workflow_service():
    """Mock WorkflowService for API testing."""
    with patch("src.server.api_routes.workflows.WorkflowService") as mock:
        yield mock.return_value


@pytest.fixture
def client():
    """Create test client."""
    from src.server.main import app
    return TestClient(app)


@pytest.fixture
def mock_workflow():
    """Mock workflow object."""
    return {
        "id": "workflow-123",
        "name": "Standard Agile",
        "description": "Standard agile workflow",
        "project_type_id": "type-123",
        "is_default": True,
        "stages": [
            {"id": "stage-1", "name": "Backlog", "stage_order": 0, "is_initial": True, "is_final": False},
            {"id": "stage-2", "name": "In Progress", "stage_order": 1, "is_initial": False, "is_final": False},
            {"id": "stage-3", "name": "Review", "stage_order": 2, "is_initial": False, "is_final": False},
            {"id": "stage-4", "name": "Done", "stage_order": 3, "is_initial": False, "is_final": True},
        ]
    }


@pytest.fixture
def mock_stages():
    """Mock workflow stages."""
    return [
        {"id": "stage-1", "name": "Backlog", "stage_order": 0},
        {"id": "stage-2", "name": "In Progress", "stage_order": 1},
        {"id": "stage-3", "name": "Review", "stage_order": 2},
        {"id": "stage-4", "name": "Done", "stage_order": 3},
    ]


def test_get_workflow_success(client, mock_workflow_service, mock_workflow):
    """Test GET /api/workflows/{workflow_id} returns workflow details."""
    # Mock service response
    mock_workflow_service.get_workflow_by_id.return_value = (True, {"workflow": mock_workflow})

    # Make request
    response = client.get("/api/workflows/workflow-123")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "workflow-123"
    assert data["name"] == "Standard Agile"
    assert len(data["stages"]) == 4
    mock_workflow_service.get_workflow_by_id.assert_called_once_with("workflow-123")


def test_get_workflow_not_found(client, mock_workflow_service):
    """Test GET /api/workflows/{workflow_id} returns 404 for invalid ID."""
    # Mock service response
    mock_workflow_service.get_workflow_by_id.return_value = (False, {"error": "Workflow workflow-999 not found"})

    # Make request
    response = client.get("/api/workflows/workflow-999")

    # Assertions
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_get_workflow_stages_success(client, mock_workflow_service, mock_stages):
    """Test GET /api/workflows/{workflow_id}/stages returns ordered stages."""
    # Mock service response
    mock_workflow_service.get_workflow_stages.return_value = (True, {"stages": mock_stages})

    # Make request
    response = client.get("/api/workflows/workflow-123/stages")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert "stages" in data
    assert data["count"] == 4
    assert len(data["stages"]) == 4
    # Verify ordering
    assert data["stages"][0]["stage_order"] == 0
    assert data["stages"][1]["stage_order"] == 1
    mock_workflow_service.get_workflow_stages.assert_called_once_with("workflow-123")


def test_get_workflow_stages_not_found(client, mock_workflow_service):
    """Test GET /api/workflows/{workflow_id}/stages returns 404."""
    # Mock service response
    mock_workflow_service.get_workflow_stages.return_value = (
        False,
        {"error": "No stages found for workflow workflow-999"}
    )

    # Make request
    response = client.get("/api/workflows/workflow-999/stages")

    # Assertions
    assert response.status_code == 404


def test_get_project_type_workflow_success(client, mock_workflow_service, mock_workflow):
    """Test GET /api/project-types/{type_id}/workflow returns default workflow."""
    # Mock service response
    mock_workflow_service.get_workflow_by_project_type.return_value = (True, {"workflow": mock_workflow})

    # Make request
    response = client.get("/api/project-types/type-123/workflow")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "workflow-123"
    assert data["is_default"] is True
    mock_workflow_service.get_workflow_by_project_type.assert_called_once_with("type-123")


def test_get_project_type_workflow_not_found(client, mock_workflow_service):
    """Test GET /api/project-types/{type_id}/workflow returns 404."""
    # Mock service response
    mock_workflow_service.get_workflow_by_project_type.return_value = (
        False,
        {"error": "No default workflow found for project type type-999"}
    )

    # Make request
    response = client.get("/api/project-types/type-999/workflow")

    # Assertions
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_transition_task_success(client, mock_workflow_service, mock_supabase_client):
    """Test POST /api/tasks/{task_id}/transition successfully transitions task."""
    # Mock task query
    mock_task_execute = MagicMock()
    mock_task_execute.data = [{"workflow_stage_id": "stage-1"}]

    # Mock transition validation
    mock_workflow_service.validate_stage_transition.return_value = (
        True,
        {
            "valid": True,
            "from_stage": {"id": "stage-1", "name": "Backlog"},
            "to_stage": {"id": "stage-2", "name": "In Progress"},
        }
    )

    # Mock task update
    updated_task = {"id": "task-1", "workflow_stage_id": "stage-2"}
    mock_update_execute = MagicMock()
    mock_update_execute.data = [updated_task]

    # Setup Supabase mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # Get task
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_task_execute
            mock_table.select.return_value = mock_select
        else:  # Update task
            mock_table.update.return_value.eq.return_value.execute.return_value = mock_update_execute
        return mock_table

    with patch("src.server.api_routes.workflows.get_supabase_client", return_value=mock_supabase_client):
        mock_supabase_client.table.side_effect = table_side_effect

        # Make request
        response = client.post(
            "/api/tasks/task-1/transition",
            json={"to_stage_id": "stage-2"}
        )

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["task_id"] == "task-1"
    assert data["from_stage"]["name"] == "Backlog"
    assert data["to_stage"]["name"] == "In Progress"


def test_transition_task_no_current_stage(client, mock_workflow_service, mock_supabase_client):
    """Test POST /api/tasks/{task_id}/transition fails when task has no stage."""
    # Mock task query with no workflow_stage_id
    mock_task_execute = MagicMock()
    mock_task_execute.data = [{"workflow_stage_id": None}]

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.eq.return_value.execute.return_value = mock_task_execute
    mock_table.select.return_value = mock_select

    with patch("src.server.api_routes.workflows.get_supabase_client", return_value=mock_supabase_client):
        mock_supabase_client.table.return_value = mock_table

        # Make request
        response = client.post(
            "/api/tasks/task-1/transition",
            json={"to_stage_id": "stage-2"}
        )

    # Assertions
    assert response.status_code == 400
    data = response.json()
    assert "does not have a workflow stage" in data["detail"]


def test_transition_task_different_workflows(client, mock_workflow_service, mock_supabase_client):
    """Test POST /api/tasks/{task_id}/transition fails for different workflows."""
    # Mock task query
    mock_task_execute = MagicMock()
    mock_task_execute.data = [{"workflow_stage_id": "stage-1"}]

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.eq.return_value.execute.return_value = mock_task_execute
    mock_table.select.return_value = mock_select

    # Mock validation failure
    mock_workflow_service.validate_stage_transition.return_value = (
        False,
        {"error": "Cannot transition between stages from different workflows"}
    )

    with patch("src.server.api_routes.workflows.get_supabase_client", return_value=mock_supabase_client):
        mock_supabase_client.table.return_value = mock_table

        # Make request
        response = client.post(
            "/api/tasks/task-1/transition",
            json={"to_stage_id": "stage-999"}
        )

    # Assertions
    assert response.status_code == 400
    data = response.json()
    assert "different workflow" in data["detail"].lower()


def test_get_available_transitions_success(client, mock_workflow_service):
    """Test GET /api/workflow-stages/{stage_id}/transitions returns available stages."""
    # Mock service response
    mock_workflow_service.get_available_transitions.return_value = (
        True,
        {
            "current_stage_id": "stage-1",
            "available_stages": [
                {"id": "stage-2", "name": "In Progress"},
                {"id": "stage-3", "name": "Review"},
                {"id": "stage-4", "name": "Done"},
            ]
        }
    )

    # Make request
    response = client.get("/api/workflow-stages/stage-1/transitions")

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["current_stage_id"] == "stage-1"
    assert data["count"] == 3
    assert len(data["available_stages"]) == 3
    mock_workflow_service.get_available_transitions.assert_called_once_with("stage-1")


def test_get_available_transitions_not_found(client, mock_workflow_service):
    """Test GET /api/workflow-stages/{stage_id}/transitions returns 404."""
    # Mock service response
    mock_workflow_service.get_available_transitions.return_value = (
        False,
        {"error": "Stage stage-999 not found"}
    )

    # Make request
    response = client.get("/api/workflow-stages/stage-999/transitions")

    # Assertions
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_openapi_schema_includes_workflows(client):
    """Test OpenAPI schema includes workflow endpoints."""
    response = client.get("/openapi.json")
    assert response.status_code == 200

    schema = response.json()

    # Verify workflow endpoints are documented
    paths = schema["paths"]
    assert "/api/workflows/{workflow_id}" in paths
    assert "/api/workflows/{workflow_id}/stages" in paths
    assert "/api/project-types/{type_id}/workflow" in paths
    assert "/api/tasks/{task_id}/transition" in paths
    assert "/api/workflow-stages/{stage_id}/transitions" in paths

    # Verify HTTP methods
    assert "get" in paths["/api/workflows/{workflow_id}"]
    assert "get" in paths["/api/workflows/{workflow_id}/stages"]
    assert "post" in paths["/api/tasks/{task_id}/transition"]
