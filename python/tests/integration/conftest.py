"""
Integration test configuration for Archon.

Provides fixtures for integration testing with mocked authentication.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch


@pytest.fixture
def mock_auth_user():
    """Mock authenticated user for integration tests."""
    return {
        "id": "test-user-123",
        "email": "test@example.com",
        "full_name": "Test User",
        "org_id": "test-org-456",
        "role": "owner",
    }


@pytest.fixture
def client_with_auth(mock_auth_user):
    """
    FastAPI test client with authentication dependencies overridden.

    This fixture bypasses all authentication checks by overriding the
    auth dependency functions to return a mock user.
    """
    from src.server.auth.dependencies import (
        get_current_user,
        require_knowledge_manage,
        require_knowledge_read,
        require_sprint_manage,
        require_task_assign,
        require_reports_read,
        require_project_write,
        require_team_manage,
        require_hierarchy_manage,
    )
    from src.server.main import app

    # Override all auth dependencies to return mock user
    app.dependency_overrides[get_current_user] = lambda: mock_auth_user
    app.dependency_overrides[require_knowledge_manage] = lambda: mock_auth_user
    app.dependency_overrides[require_knowledge_read] = lambda: mock_auth_user
    app.dependency_overrides[require_sprint_manage] = lambda: mock_auth_user
    app.dependency_overrides[require_task_assign] = lambda: mock_auth_user
    app.dependency_overrides[require_reports_read] = lambda: mock_auth_user
    app.dependency_overrides[require_project_write] = lambda: mock_auth_user
    app.dependency_overrides[require_team_manage] = lambda: mock_auth_user
    app.dependency_overrides[require_hierarchy_manage] = lambda: mock_auth_user

    # Create test client
    test_client = TestClient(app)

    yield test_client

    # Clean up dependency overrides
    app.dependency_overrides.clear()


@pytest.fixture
def mock_supabase_for_integration():
    """
    Mock Supabase client specifically for integration tests.

    Returns a more complete mock that supports chained operations.
    """
    mock_client = MagicMock()

    # Mock table operations with full chaining support
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_insert = MagicMock()
    mock_update = MagicMock()
    mock_delete = MagicMock()
    mock_execute = MagicMock()

    # Setup execute response
    mock_execute.data = []
    mock_execute.count = 0

    # Setup select chaining
    mock_select.execute.return_value = mock_execute
    mock_select.eq.return_value = mock_select
    mock_select.neq.return_value = mock_select
    mock_select.gte.return_value = mock_select
    mock_select.lte.return_value = mock_select
    mock_select.order.return_value = mock_select
    mock_select.limit.return_value = mock_select
    mock_select.offset.return_value = mock_select
    mock_select.single.return_value = mock_select
    mock_select.maybe_single.return_value = mock_select

    # Setup insert chaining
    mock_insert.execute.return_value = mock_execute
    mock_insert.returning.return_value = mock_insert

    # Setup update chaining
    mock_update.execute.return_value = mock_execute
    mock_update.eq.return_value = mock_update
    mock_update.returning.return_value = mock_update

    # Setup delete chaining
    mock_delete.execute.return_value = mock_execute
    mock_delete.eq.return_value = mock_delete

    # Connect table methods
    mock_table.select.return_value = mock_select
    mock_table.insert.return_value = mock_insert
    mock_table.update.return_value = mock_update
    mock_table.delete.return_value = mock_delete

    # Make table() return the mock table
    mock_client.table.return_value = mock_table

    # Mock RPC for PostgreSQL functions
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value = mock_execute
    mock_client.rpc.return_value = mock_rpc

    return mock_client
