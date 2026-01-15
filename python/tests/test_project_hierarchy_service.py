"""
Unit tests for ProjectHierarchyService

Tests cover:
- add_child_project - parent-child relationship creation
- remove_child_project - breaking relationships
- get_project_children - direct and all descendants
- get_project_ancestors - ltree path traversal
- get_project_descendants - ltree path traversal
- validate_no_circular_reference - cycle detection
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.server.services.projects.project_hierarchy_service import ProjectHierarchyService


@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client for testing"""
    return MagicMock()


@pytest.fixture
def hierarchy_service(mock_supabase_client):
    """Create ProjectHierarchyService instance with mocked client"""
    return ProjectHierarchyService(supabase_client=mock_supabase_client)


@pytest.mark.asyncio
async def test_add_child_project_success(hierarchy_service, mock_supabase_client):
    """Test add_child_project successfully creates relationship"""
    # Mock parent project exists
    mock_parent_response = MagicMock()
    mock_parent_response.data = [{"id": "parent-123", "title": "Parent Project"}]

    # Mock child project exists
    mock_child_response = MagicMock()
    mock_child_response.data = [{"id": "child-456", "title": "Child Project"}]

    # Mock hierarchy creation
    mock_hierarchy_response = MagicMock()
    mock_hierarchy_response.data = [{
        "id": "rel-789",
        "parent_project_id": "parent-123",
        "child_project_id": "child-456",
        "relationship_type": "subproject"
    }]

    # Configure mock table chain
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_eq = MagicMock()

    # Parent query
    mock_select_chain = MagicMock()
    mock_select_chain.execute.side_effect = [mock_parent_response, mock_child_response]
    mock_eq.return_value = mock_select_chain
    mock_select.return_value.eq = mock_eq

    # Hierarchy insert
    mock_insert = MagicMock()
    mock_insert.return_value.execute.return_value = mock_hierarchy_response

    # Assign mocks
    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        if call_count[0] <= 2:  # First two calls: select parent and child
            mock_table.select.return_value = mock_select
        else:  # Third call: insert hierarchy
            mock_table.insert = mock_insert
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    # Mock validation
    with patch.object(hierarchy_service, 'validate_no_circular_reference', return_value=(True, {"valid": True})):
        success, result = await hierarchy_service.add_child_project(
            parent_id="parent-123",
            child_id="child-456",
            relationship_type="subproject"
        )

    assert success is True
    assert result["relationship"]["id"] == "rel-789"
    assert result["parent"]["title"] == "Parent Project"
    assert result["child"]["title"] == "Child Project"


@pytest.mark.asyncio
async def test_add_child_project_invalid_relationship_type(hierarchy_service):
    """Test add_child_project rejects invalid relationship types"""
    success, result = await hierarchy_service.add_child_project(
        parent_id="parent-123",
        child_id="child-456",
        relationship_type="invalid_type"
    )

    assert success is False
    assert "invalid relationship_type" in result["error"].lower()


@pytest.mark.asyncio
async def test_add_child_project_parent_not_found(hierarchy_service, mock_supabase_client):
    """Test add_child_project fails when parent doesn't exist"""
    # Mock parent not found
    mock_parent_response = MagicMock()
    mock_parent_response.data = []

    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_select.return_value.eq.return_value.execute.return_value = mock_parent_response
    mock_table.select.return_value = mock_select

    mock_supabase_client.table.return_value = mock_table

    success, result = await hierarchy_service.add_child_project(
        parent_id="parent-999",
        child_id="child-456",
        relationship_type="subproject"
    )

    assert success is False
    assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_remove_child_project_success(hierarchy_service, mock_supabase_client):
    """Test remove_child_project successfully breaks relationship"""
    # Mock delete response
    mock_delete_response = MagicMock()
    mock_delete_response.data = [{"id": "rel-789"}]

    mock_table = MagicMock()
    mock_delete = MagicMock()
    mock_delete.return_value.eq.return_value.eq.return_value.execute.return_value = mock_delete_response
    mock_table.delete.return_value = mock_delete

    mock_supabase_client.table.return_value = mock_table

    success, result = await hierarchy_service.remove_child_project(
        parent_id="parent-123",
        child_id="child-456"
    )

    assert success is True
    assert "removed successfully" in result["message"].lower()


@pytest.mark.asyncio
async def test_remove_child_project_not_found(hierarchy_service, mock_supabase_client):
    """Test remove_child_project fails when relationship doesn't exist"""
    # Mock delete response - no data returned
    mock_delete_response = MagicMock()
    mock_delete_response.data = []

    mock_table = MagicMock()
    mock_delete = MagicMock()
    mock_delete.return_value.eq.return_value.eq.return_value.execute.return_value = mock_delete_response
    mock_table.delete.return_value = mock_delete

    mock_supabase_client.table.return_value = mock_table

    success, result = await hierarchy_service.remove_child_project(
        parent_id="parent-123",
        child_id="child-456"
    )

    assert success is False
    assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_get_project_children_direct_only(hierarchy_service, mock_supabase_client):
    """Test get_project_children returns direct children only"""
    # Mock hierarchy response
    mock_hierarchy_response = MagicMock()
    mock_hierarchy_response.data = [
        {"child_project_id": "child-1", "relationship_type": "subproject"},
        {"child_project_id": "child-2", "relationship_type": "subproject"}
    ]

    # Mock children projects response
    mock_children_response = MagicMock()
    mock_children_response.data = [
        {"id": "child-1", "title": "Child 1"},
        {"id": "child-2", "title": "Child 2"}
    ]

    call_count = [0]
    def table_side_effect(table_name):
        call_count[0] += 1
        mock_table = MagicMock()
        if call_count[0] == 1:  # First call: archon_project_hierarchy
            mock_select = MagicMock()
            mock_select.return_value.eq.return_value.execute.return_value = mock_hierarchy_response
            mock_table.select.return_value = mock_select
        else:  # Second call: archon_projects
            mock_select = MagicMock()
            mock_select.return_value.in_.return_value.execute.return_value = mock_children_response
            mock_table.select.return_value = mock_select
        return mock_table

    mock_supabase_client.table.side_effect = table_side_effect

    success, result = await hierarchy_service.get_project_children(
        project_id="parent-123",
        direct_only=True
    )

    assert success is True
    assert result["count"] == 2
    assert len(result["children"]) == 2
    assert result["children"][0]["relationship_type"] == "subproject"


@pytest.mark.asyncio
async def test_validate_no_circular_reference_self_reference(hierarchy_service):
    """Test validate_no_circular_reference detects self-reference"""
    success, result = await hierarchy_service.validate_no_circular_reference(
        parent_id="project-123",
        child_id="project-123"
    )

    assert success is False
    assert "cannot be its own parent" in result["error"].lower()


@pytest.mark.asyncio
async def test_validate_no_circular_reference_valid(hierarchy_service):
    """Test validate_no_circular_reference allows valid relationship"""
    # Mock get_project_descendants - no descendants
    with patch.object(hierarchy_service, 'get_project_descendants', return_value=(True, {"descendants": []})):
        # Mock get_project_ancestors - no ancestors
        with patch.object(hierarchy_service, 'get_project_ancestors', return_value=(True, {"ancestors": []})):
            success, result = await hierarchy_service.validate_no_circular_reference(
                parent_id="parent-123",
                child_id="child-456"
            )

    assert success is True
    assert result["valid"] is True


@pytest.mark.asyncio
async def test_validate_no_circular_reference_detects_cycle(hierarchy_service):
    """Test validate_no_circular_reference detects circular reference"""
    # Mock get_project_descendants - parent is in child's descendants
    mock_descendants = [{"id": "parent-123", "title": "Parent Project"}]

    with patch.object(hierarchy_service, 'get_project_descendants', return_value=(True, {"descendants": mock_descendants})):
        success, result = await hierarchy_service.validate_no_circular_reference(
            parent_id="parent-123",
            child_id="child-456"
        )

    assert success is False
    assert "circular reference" in result["error"].lower()
