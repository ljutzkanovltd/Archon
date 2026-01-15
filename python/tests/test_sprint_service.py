"""
Unit tests for SprintService.

Tests cover:
- create_sprint() - create new sprint with date validation
- start_sprint() - activate sprint with one-active-per-project validation
- complete_sprint() - close sprint and calculate velocity
- move_task_to_sprint() - assign task to sprint with validation
- get_sprint_tasks() - retrieve tasks in sprint
- calculate_sprint_velocity() - sum completed story points
- get_active_sprint() - get currently active sprint
- list_sprints() - list all sprints for project
- Error handling and edge cases
"""

from unittest.mock import MagicMock, patch
from datetime import date, datetime

import pytest

from src.server.services.projects.sprint_service import SprintService


@pytest.fixture
def sprint_service(mock_supabase_client):
    """Create a fresh SprintService instance with mocked Supabase client."""
    with patch("src.server.services.projects.sprint_service.get_supabase_client", return_value=mock_supabase_client):
        return SprintService(supabase_client=mock_supabase_client)


@pytest.fixture
def mock_sprint():
    """Mock sprint object for testing."""
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
        "completed_at": None,
    }


@pytest.fixture
def mock_tasks():
    """Mock tasks for sprint testing."""
    return [
        {
            "id": "task-1",
            "sprint_id": "sprint-123",
            "title": "Implement login endpoint",
            "story_points": 5,
            "workflow_stage_id": "stage-4",  # Done stage
            "task_order": 1,
        },
        {
            "id": "task-2",
            "sprint_id": "sprint-123",
            "title": "Add password reset",
            "story_points": 3,
            "workflow_stage_id": "stage-4",  # Done stage
            "task_order": 2,
        },
        {
            "id": "task-3",
            "sprint_id": "sprint-123",
            "title": "Write tests",
            "story_points": 2,
            "workflow_stage_id": "stage-2",  # In Progress
            "task_order": 3,
        },
    ]


@pytest.mark.asyncio
async def test_create_sprint_success(sprint_service, mock_supabase_client, mock_sprint):
    """Test successful sprint creation."""
    # Mock insert query
    mock_execute = MagicMock()
    mock_execute.data = [mock_sprint]

    mock_table = MagicMock()
    mock_table.insert.return_value.execute.return_value = mock_execute
    mock_supabase_client.table.return_value = mock_table

    # Execute test
    success, result = await sprint_service.create_sprint(
        project_id="project-456",
        name="Sprint 1",
        start_date=date(2026, 1, 20),
        end_date=date(2026, 2, 3),
        goal="Implement user authentication"
    )

    # Assertions
    assert success is True
    assert "sprint" in result
    assert result["sprint"]["name"] == "Sprint 1"
    assert result["sprint"]["status"] == "planned"


@pytest.mark.asyncio
async def test_create_sprint_invalid_dates(sprint_service, mock_supabase_client):
    """Test sprint creation fails with invalid dates."""
    # Execute test with end_date before start_date
    success, result = await sprint_service.create_sprint(
        project_id="project-456",
        name="Sprint 1",
        start_date=date(2026, 2, 3),
        end_date=date(2026, 1, 20),  # Before start!
        goal="Test"
    )

    # Assertions
    assert success is False
    assert "error" in result
    assert "after start_date" in result["error"]


@pytest.mark.asyncio
async def test_start_sprint_success(sprint_service, mock_supabase_client, mock_sprint):
    """Test successful sprint activation."""
    # Mock sprint query
    mock_sprint_execute = MagicMock()
    mock_sprint_execute.data = [mock_sprint]

    # Mock active sprints query (should be empty)
    mock_active_execute = MagicMock()
    mock_active_execute.data = []

    # Mock update query
    updated_sprint = {**mock_sprint, "status": "active"}
    mock_update_execute = MagicMock()
    mock_update_execute.data = [updated_sprint]

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # First call - get sprint
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_sprint_execute
            mock_table.select.return_value = mock_select
        elif call_count[0] == 2:  # Second call - check active sprints
            mock_select = MagicMock()
            mock_select.eq.return_value.eq.return_value.execute.return_value = mock_active_execute
            mock_table.select.return_value = mock_select
        else:  # Third call - update sprint
            mock_table.update.return_value.eq.return_value.execute.return_value = mock_update_execute
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await sprint_service.start_sprint("sprint-123")

    # Assertions
    assert success is True
    assert result["sprint"]["status"] == "active"


@pytest.mark.asyncio
async def test_start_sprint_already_active_conflict(sprint_service, mock_supabase_client, mock_sprint):
    """Test starting sprint fails when another sprint is active."""
    # Mock sprint query
    mock_sprint_execute = MagicMock()
    mock_sprint_execute.data = [mock_sprint]

    # Mock active sprints query (another sprint active!)
    other_active_sprint = {
        "id": "sprint-999",
        "name": "Sprint 0",
        "status": "active"
    }
    mock_active_execute = MagicMock()
    mock_active_execute.data = [other_active_sprint]

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # First call - get sprint
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_sprint_execute
            mock_table.select.return_value = mock_select
        else:  # Second call - check active sprints
            mock_select = MagicMock()
            mock_select.eq.return_value.eq.return_value.execute.return_value = mock_active_execute
            mock_table.select.return_value = mock_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await sprint_service.start_sprint("sprint-123")

    # Assertions
    assert success is False
    assert "error" in result
    assert "already has an active sprint" in result["error"]
    assert "conflict_sprint_id" in result
    assert result["conflict_sprint_id"] == "sprint-999"


@pytest.mark.asyncio
async def test_complete_sprint_success(sprint_service, mock_supabase_client, mock_sprint, mock_tasks):
    """Test successful sprint completion with velocity calculation."""
    active_sprint = {**mock_sprint, "status": "active"}

    # Mock sprint query
    mock_sprint_execute = MagicMock()
    mock_sprint_execute.data = [active_sprint]

    # Mock tasks for velocity calculation
    mock_tasks_execute = MagicMock()
    mock_tasks_execute.data = mock_tasks

    # Mock final stages query
    final_stage = {"id": "stage-4"}
    mock_final_stages_execute = MagicMock()
    mock_final_stages_execute.data = [final_stage]

    # Mock update query
    completed_sprint = {**active_sprint, "status": "completed", "velocity": 8}
    mock_update_execute = MagicMock()
    mock_update_execute.data = [completed_sprint]

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # Get sprint
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_sprint_execute
            mock_table.select.return_value = mock_select
        elif call_count[0] == 2:  # Get tasks for velocity
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_tasks_execute
            mock_table.select.return_value = mock_select
        elif call_count[0] == 3:  # Get final stages
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_final_stages_execute
            mock_table.select.return_value = mock_select
        else:  # Update sprint
            mock_table.update.return_value.eq.return_value.execute.return_value = mock_update_execute
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await sprint_service.complete_sprint("sprint-123")

    # Assertions
    assert success is True
    assert result["sprint"]["status"] == "completed"
    assert result["velocity"] == 8  # task-1 (5) + task-2 (3) = 8


@pytest.mark.asyncio
async def test_calculate_sprint_velocity(sprint_service, mock_supabase_client, mock_tasks):
    """Test velocity calculation sums completed story points."""
    # Mock tasks query
    mock_tasks_execute = MagicMock()
    mock_tasks_execute.data = mock_tasks

    # Mock final stages query
    final_stage = {"id": "stage-4"}
    mock_final_stages_execute = MagicMock()
    mock_final_stages_execute.data = [final_stage]

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # Get tasks
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_tasks_execute
            mock_table.select.return_value = mock_select
        else:  # Get final stages
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_final_stages_execute
            mock_table.select.return_value = mock_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await sprint_service.calculate_sprint_velocity("sprint-123")

    # Assertions
    assert success is True
    assert result["velocity"] == 8  # Only task-1 (5) + task-2 (3) are done (stage-4)


@pytest.mark.asyncio
async def test_calculate_sprint_velocity_no_tasks(sprint_service, mock_supabase_client):
    """Test velocity calculation with no tasks returns 0."""
    # Mock empty tasks query
    mock_execute = MagicMock()
    mock_execute.data = []

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.eq.return_value.execute.return_value = mock_execute
    mock_table.select.return_value = mock_select
    mock_supabase_client.table.return_value = mock_table

    # Execute test
    success, result = await sprint_service.calculate_sprint_velocity("sprint-123")

    # Assertions
    assert success is True
    assert result["velocity"] == 0


@pytest.mark.asyncio
async def test_move_task_to_sprint_success(sprint_service, mock_supabase_client):
    """Test successfully moving task to sprint."""
    # Mock sprint query
    sprint = {
        "id": "sprint-123",
        "name": "Sprint 1",
        "project_id": "project-456",
        "status": "active"
    }
    mock_sprint_execute = MagicMock()
    mock_sprint_execute.data = [sprint]

    # Mock task query
    task = {"id": "task-1", "project_id": "project-456"}
    mock_task_execute = MagicMock()
    mock_task_execute.data = [task]

    # Mock update query
    updated_task = {**task, "sprint_id": "sprint-123"}
    mock_update_execute = MagicMock()
    mock_update_execute.data = [updated_task]

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # Get sprint
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_sprint_execute
            mock_table.select.return_value = mock_select
        elif call_count[0] == 2:  # Get task
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_task_execute
            mock_table.select.return_value = mock_select
        else:  # Update task
            mock_table.update.return_value.eq.return_value.execute.return_value = mock_update_execute
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await sprint_service.move_task_to_sprint("task-1", "sprint-123")

    # Assertions
    assert success is True
    assert result["task"]["sprint_id"] == "sprint-123"


@pytest.mark.asyncio
async def test_move_task_to_sprint_different_project(sprint_service, mock_supabase_client):
    """Test moving task to sprint from different project fails."""
    # Mock sprint query
    sprint = {
        "id": "sprint-123",
        "name": "Sprint 1",
        "project_id": "project-456",
        "status": "active"
    }
    mock_sprint_execute = MagicMock()
    mock_sprint_execute.data = [sprint]

    # Mock task query (different project!)
    task = {"id": "task-1", "project_id": "project-999"}
    mock_task_execute = MagicMock()
    mock_task_execute.data = [task]

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # Get sprint
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_sprint_execute
            mock_table.select.return_value = mock_select
        else:  # Get task
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_task_execute
            mock_table.select.return_value = mock_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await sprint_service.move_task_to_sprint("task-1", "sprint-123")

    # Assertions
    assert success is False
    assert "error" in result
    assert "same project" in result["error"]


@pytest.mark.asyncio
async def test_get_sprint_tasks(sprint_service, mock_supabase_client, mock_sprint, mock_tasks):
    """Test retrieving all tasks in a sprint."""
    # Mock sprint query
    mock_sprint_execute = MagicMock()
    mock_sprint_execute.data = [mock_sprint]

    # Mock tasks query
    mock_tasks_execute = MagicMock()
    mock_tasks_execute.data = mock_tasks

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # Get sprint
            mock_select = MagicMock()
            mock_select.eq.return_value.execute.return_value = mock_sprint_execute
            mock_table.select.return_value = mock_select
        else:  # Get tasks
            mock_select = MagicMock()
            mock_select.eq.return_value.order.return_value.execute.return_value = mock_tasks_execute
            mock_table.select.return_value = mock_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await sprint_service.get_sprint_tasks("sprint-123")

    # Assertions
    assert success is True
    assert "tasks" in result
    assert result["count"] == 3
    assert len(result["tasks"]) == 3


@pytest.mark.asyncio
async def test_get_active_sprint(sprint_service, mock_supabase_client, mock_sprint):
    """Test getting active sprint for a project."""
    active_sprint = {**mock_sprint, "status": "active"}

    # Mock query
    mock_execute = MagicMock()
    mock_execute.data = [active_sprint]

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.eq.return_value.eq.return_value.execute.return_value = mock_execute
    mock_table.select.return_value = mock_select
    mock_supabase_client.table.return_value = mock_table

    # Execute test
    success, result = await sprint_service.get_active_sprint("project-456")

    # Assertions
    assert success is True
    assert result["sprint"]["status"] == "active"
    assert result["sprint"]["name"] == "Sprint 1"


@pytest.mark.asyncio
async def test_get_active_sprint_none(sprint_service, mock_supabase_client):
    """Test getting active sprint when none exists."""
    # Mock empty query
    mock_execute = MagicMock()
    mock_execute.data = []

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.eq.return_value.eq.return_value.execute.return_value = mock_execute
    mock_table.select.return_value = mock_select
    mock_supabase_client.table.return_value = mock_table

    # Execute test
    success, result = await sprint_service.get_active_sprint("project-456")

    # Assertions
    assert success is True
    assert result["sprint"] is None


@pytest.mark.asyncio
async def test_list_sprints(sprint_service, mock_supabase_client):
    """Test listing all sprints for a project."""
    sprints = [
        {"id": "sprint-3", "name": "Sprint 3", "status": "planned", "start_date": "2026-02-17"},
        {"id": "sprint-2", "name": "Sprint 2", "status": "active", "start_date": "2026-02-03"},
        {"id": "sprint-1", "name": "Sprint 1", "status": "completed", "start_date": "2026-01-20"},
    ]

    # Mock query
    mock_execute = MagicMock()
    mock_execute.data = sprints

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.eq.return_value.order.return_value.neq.return_value.execute.return_value = mock_execute
    mock_table.select.return_value = mock_select
    mock_supabase_client.table.return_value = mock_table

    # Execute test
    success, result = await sprint_service.list_sprints("project-456", include_cancelled=False)

    # Assertions
    assert success is True
    assert result["count"] == 3
    assert len(result["sprints"]) == 3
    # Verify descending order by start_date
    assert result["sprints"][0]["name"] == "Sprint 3"
