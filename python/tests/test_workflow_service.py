"""
Unit tests for WorkflowService.

Tests cover:
- get_workflow_by_project_type() - fetch default workflow for type
- get_workflow_by_id() - fetch workflow with stages
- get_workflow_stages() - ordered stage list
- validate_stage_transition() - check transition validity
- get_available_transitions() - get possible next stages
- get_initial_stage() - get starting stage for new tasks
- Workflow caching functionality
- Error handling and edge cases
"""

from unittest.mock import MagicMock, patch
from datetime import datetime

import pytest

from src.server.services.projects.workflow_service import WorkflowService


@pytest.fixture
def workflow_service(mock_supabase_client):
    """Create a fresh WorkflowService instance with mocked Supabase client."""
    with patch("src.server.services.projects.workflow_service.get_supabase_client", return_value=mock_supabase_client):
        return WorkflowService(supabase_client=mock_supabase_client)


@pytest.fixture
def mock_workflow():
    """Mock workflow object for testing."""
    return {
        "id": "workflow-123",
        "name": "Standard Agile",
        "description": "Standard agile workflow",
        "project_type_id": "type-123",
        "is_default": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


@pytest.fixture
def mock_stages():
    """Mock workflow stages for testing."""
    return [
        {
            "id": "stage-1",
            "workflow_id": "workflow-123",
            "name": "Backlog",
            "description": "Tasks awaiting sprint assignment",
            "stage_order": 0,
            "is_initial": True,
            "is_final": False,
            "color": "#6B7280",
        },
        {
            "id": "stage-2",
            "workflow_id": "workflow-123",
            "name": "In Progress",
            "description": "Active development work",
            "stage_order": 1,
            "is_initial": False,
            "is_final": False,
            "color": "#3B82F6",
        },
        {
            "id": "stage-3",
            "workflow_id": "workflow-123",
            "name": "Review",
            "description": "Code review and testing",
            "stage_order": 2,
            "is_initial": False,
            "is_final": False,
            "color": "#F59E0B",
        },
        {
            "id": "stage-4",
            "workflow_id": "workflow-123",
            "name": "Done",
            "description": "Completed and deployed",
            "stage_order": 3,
            "is_initial": False,
            "is_final": True,
            "color": "#10B981",
        },
    ]


@pytest.mark.asyncio
async def test_get_workflow_by_project_type_success(workflow_service, mock_supabase_client, mock_workflow, mock_stages):
    """Test successful retrieval of workflow by project type."""
    # Mock workflow query
    mock_workflow_execute = MagicMock()
    mock_workflow_execute.data = [mock_workflow]

    # Mock stages query
    mock_stages_execute = MagicMock()
    mock_stages_execute.data = mock_stages

    # Setup table mock to return different responses for different queries
    mock_table = MagicMock()

    # First call (workflow)
    mock_workflow_select = MagicMock()
    mock_workflow_select.eq.return_value.eq.return_value.execute.return_value = mock_workflow_execute

    # Second call (stages)
    mock_stages_select = MagicMock()
    mock_stages_select.eq.return_value.order.return_value.execute.return_value = mock_stages_execute

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # First call - workflows
            mock_workflow_select.select.return_value = mock_workflow_select
            mock_table.select = lambda *args: mock_workflow_select
        else:  # Second call - stages
            mock_stages_select.select.return_value = mock_stages_select
            mock_table.select = lambda *args: mock_stages_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await workflow_service.get_workflow_by_project_type("type-123")

    # Assertions
    assert success is True
    assert "workflow" in result
    assert result["workflow"]["id"] == "workflow-123"
    assert result["workflow"]["name"] == "Standard Agile"
    assert result["workflow"]["stages"] == mock_stages
    assert len(result["workflow"]["stages"]) == 4


@pytest.mark.asyncio
async def test_get_workflow_by_project_type_not_found(workflow_service, mock_supabase_client):
    """Test workflow not found for project type."""
    # Mock empty result
    mock_execute = MagicMock()
    mock_execute.data = []

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.eq.return_value.eq.return_value.execute.return_value = mock_execute
    mock_table.select.return_value = mock_select
    mock_supabase_client.table.return_value = mock_table

    # Execute test
    success, result = await workflow_service.get_workflow_by_project_type("type-nonexistent")

    # Assertions
    assert success is False
    assert "error" in result
    assert "No default workflow found" in result["error"]


@pytest.mark.asyncio
async def test_get_workflow_by_id_success(workflow_service, mock_supabase_client, mock_workflow, mock_stages):
    """Test successful retrieval of workflow by ID."""
    # Mock workflow query
    mock_workflow_execute = MagicMock()
    mock_workflow_execute.data = [mock_workflow]

    # Mock stages query
    mock_stages_execute = MagicMock()
    mock_stages_execute.data = mock_stages

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # First call - workflow
            mock_workflow_select = MagicMock()
            mock_workflow_select.eq.return_value.execute.return_value = mock_workflow_execute
            mock_table.select.return_value = mock_workflow_select
        else:  # Second call - stages
            mock_stages_select = MagicMock()
            mock_stages_select.eq.return_value.order.return_value.execute.return_value = mock_stages_execute
            mock_table.select.return_value = mock_stages_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await workflow_service.get_workflow_by_id("workflow-123")

    # Assertions
    assert success is True
    assert "workflow" in result
    assert result["workflow"]["id"] == "workflow-123"
    assert len(result["workflow"]["stages"]) == 4


@pytest.mark.asyncio
async def test_get_workflow_stages_success(workflow_service, mock_supabase_client, mock_stages):
    """Test successful retrieval of workflow stages."""
    # Mock stages query
    mock_execute = MagicMock()
    mock_execute.data = mock_stages

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.eq.return_value.order.return_value.execute.return_value = mock_execute
    mock_table.select.return_value = mock_select
    mock_supabase_client.table.return_value = mock_table

    # Execute test
    success, result = await workflow_service.get_workflow_stages("workflow-123")

    # Assertions
    assert success is True
    assert "stages" in result
    assert len(result["stages"]) == 4
    # Verify ordering
    assert result["stages"][0]["stage_order"] == 0
    assert result["stages"][1]["stage_order"] == 1
    assert result["stages"][2]["stage_order"] == 2
    assert result["stages"][3]["stage_order"] == 3


@pytest.mark.asyncio
async def test_validate_stage_transition_success(workflow_service, mock_supabase_client):
    """Test successful stage transition validation."""
    from_stage = {
        "id": "stage-1",
        "workflow_id": "workflow-123",
        "name": "Backlog",
        "stage_order": 0,
    }
    to_stage = {
        "id": "stage-2",
        "workflow_id": "workflow-123",
        "name": "In Progress",
        "stage_order": 1,
    }

    # Mock from_stage query
    mock_from_execute = MagicMock()
    mock_from_execute.data = [from_stage]

    # Mock to_stage query
    mock_to_execute = MagicMock()
    mock_to_execute.data = [to_stage]

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # First call - from_stage
            mock_from_select = MagicMock()
            mock_from_select.eq.return_value.execute.return_value = mock_from_execute
            mock_table.select.return_value = mock_from_select
        else:  # Second call - to_stage
            mock_to_select = MagicMock()
            mock_to_select.eq.return_value.execute.return_value = mock_to_execute
            mock_table.select.return_value = mock_to_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await workflow_service.validate_stage_transition("stage-1", "stage-2")

    # Assertions
    assert success is True
    assert result["valid"] is True
    assert result["from_stage"]["name"] == "Backlog"
    assert result["to_stage"]["name"] == "In Progress"


@pytest.mark.asyncio
async def test_validate_stage_transition_different_workflows(workflow_service, mock_supabase_client):
    """Test transition validation fails for different workflows."""
    from_stage = {
        "id": "stage-1",
        "workflow_id": "workflow-123",
        "name": "Backlog",
        "stage_order": 0,
    }
    to_stage = {
        "id": "stage-2",
        "workflow_id": "workflow-456",  # Different workflow!
        "name": "In Progress",
        "stage_order": 1,
    }

    # Mock queries
    mock_from_execute = MagicMock()
    mock_from_execute.data = [from_stage]
    mock_to_execute = MagicMock()
    mock_to_execute.data = [to_stage]

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:
            mock_from_select = MagicMock()
            mock_from_select.eq.return_value.execute.return_value = mock_from_execute
            mock_table.select.return_value = mock_from_select
        else:
            mock_to_select = MagicMock()
            mock_to_select.eq.return_value.execute.return_value = mock_to_execute
            mock_table.select.return_value = mock_to_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await workflow_service.validate_stage_transition("stage-1", "stage-2")

    # Assertions
    assert success is False
    assert "error" in result
    assert "different workflows" in result["error"]


@pytest.mark.asyncio
async def test_get_available_transitions_success(workflow_service, mock_supabase_client, mock_stages):
    """Test getting available transitions from a stage."""
    current_stage = {
        "id": "stage-1",
        "workflow_id": "workflow-123",
        "stage_order": 0,
    }

    # Mock current stage query
    mock_current_execute = MagicMock()
    mock_current_execute.data = [current_stage]

    # Mock all stages query
    mock_all_execute = MagicMock()
    mock_all_execute.data = mock_stages

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # First call - current stage
            mock_current_select = MagicMock()
            mock_current_select.eq.return_value.execute.return_value = mock_current_execute
            mock_table.select.return_value = mock_current_select
        else:  # Second call - all stages
            mock_all_select = MagicMock()
            mock_all_select.eq.return_value.order.return_value.execute.return_value = mock_all_execute
            mock_table.select.return_value = mock_all_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await workflow_service.get_available_transitions("stage-1")

    # Assertions
    assert success is True
    assert "available_stages" in result
    assert len(result["available_stages"]) == 3  # All stages except current


@pytest.mark.asyncio
async def test_get_initial_stage_success(workflow_service, mock_supabase_client, mock_stages):
    """Test getting initial stage of a workflow."""
    initial_stage = mock_stages[0]  # Backlog is initial

    # Mock query
    mock_execute = MagicMock()
    mock_execute.data = [initial_stage]

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.eq.return_value.eq.return_value.execute.return_value = mock_execute
    mock_table.select.return_value = mock_select
    mock_supabase_client.table.return_value = mock_table

    # Execute test
    success, result = await workflow_service.get_initial_stage("workflow-123")

    # Assertions
    assert success is True
    assert "initial_stage" in result
    assert result["initial_stage"]["name"] == "Backlog"
    assert result["initial_stage"]["is_initial"] is True


@pytest.mark.asyncio
async def test_get_initial_stage_fallback_to_first(workflow_service, mock_supabase_client, mock_stages):
    """Test initial stage fallback to first by order when no is_initial flag."""
    first_stage = mock_stages[0]

    # Mock empty result for is_initial query
    mock_empty_execute = MagicMock()
    mock_empty_execute.data = []

    # Mock fallback query (first by order)
    mock_fallback_execute = MagicMock()
    mock_fallback_execute.data = [first_stage]

    # Setup table mock
    mock_table = MagicMock()

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # First call - is_initial query
            mock_initial_select = MagicMock()
            mock_initial_select.eq.return_value.eq.return_value.execute.return_value = mock_empty_execute
            mock_table.select.return_value = mock_initial_select
        else:  # Second call - fallback to first
            mock_fallback_select = MagicMock()
            mock_fallback_select.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_fallback_execute
            mock_table.select.return_value = mock_fallback_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Execute test
    success, result = await workflow_service.get_initial_stage("workflow-123")

    # Assertions
    assert success is True
    assert result["initial_stage"]["name"] == "Backlog"


@pytest.mark.asyncio
async def test_workflow_caching(workflow_service, mock_supabase_client, mock_workflow, mock_stages):
    """Test that workflows are cached after first retrieval."""
    # Mock first query
    mock_workflow_execute = MagicMock()
    mock_workflow_execute.data = [mock_workflow]
    mock_stages_execute = MagicMock()
    mock_stages_execute.data = mock_stages

    mock_table = MagicMock()
    call_count = [0]

    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] == 1:  # First call - workflow
            mock_workflow_select = MagicMock()
            mock_workflow_select.eq.return_value.execute.return_value = mock_workflow_execute
            mock_table.select.return_value = mock_workflow_select
        else:  # Second call - stages
            mock_stages_select = MagicMock()
            mock_stages_select.eq.return_value.order.return_value.execute.return_value = mock_stages_execute
            mock_table.select.return_value = mock_stages_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # First call - should hit database
    success1, result1 = await workflow_service.get_workflow_by_id("workflow-123")
    assert success1 is True

    # Reset call count
    initial_call_count = call_count[0]

    # Second call - should use cache (no additional DB calls)
    success2, result2 = await workflow_service.get_workflow_by_id("workflow-123")
    assert success2 is True
    assert call_count[0] == initial_call_count  # No new calls made

    # Verify both results are identical
    assert result1["workflow"]["id"] == result2["workflow"]["id"]


@pytest.mark.asyncio
async def test_clear_cache(workflow_service):
    """Test cache clearing functionality."""
    # Add something to cache
    workflow_service._workflow_cache["test"] = {"data": "test"}
    assert len(workflow_service._workflow_cache) == 1

    # Clear cache
    await workflow_service.clear_cache()
    assert len(workflow_service._workflow_cache) == 0
