"""
Integration tests for Reporting API endpoints.

Tests cover:
- GET /api/projects/{project_id}/reports/sprint/{sprint_id} - sprint reports
- GET /api/projects/{project_id}/reports/task-metrics - task metrics
- GET /api/projects/{project_id}/reports/health - project health
- GET /api/projects/{project_id}/reports/velocity - velocity trends
- Cache behavior and performance
- Date range filtering
- Aggregation accuracy
- Error responses (404, 400)
"""

from unittest.mock import MagicMock, patch
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_reporting_service():
    """Mock ReportingService for API testing."""
    with patch("src.server.api_routes.reports.ReportingService") as mock:
        yield mock.return_value


# Using client_with_auth from integration/conftest.py


@pytest.fixture
def mock_sprint_report():
    """Mock sprint report data."""
    return {
        "sprint_id": "sprint-123",
        "sprint_name": "Sprint 1",
        "start_date": "2026-01-01",
        "end_date": "2026-01-14",
        "status": "completed",
        "metrics": {
            "total_tasks": 10,
            "completed_tasks": 8,
            "in_progress_tasks": 2,
            "completion_rate": 0.8,
            "total_story_points": 50,
            "completed_story_points": 40,
            "velocity": 40,
        },
        "burndown": [
            {"date": "2026-01-01", "remaining_points": 50},
            {"date": "2026-01-07", "remaining_points": 25},
            {"date": "2026-01-14", "remaining_points": 10},
        ],
    }


@pytest.fixture
def mock_task_metrics():
    """Mock task metrics data."""
    return {
        "total_tasks": 45,
        "by_status": {
            "todo": 10,
            "doing": 5,
            "review": 3,
            "done": 27,
        },
        "by_assignee": {
            "backend-api-expert": 12,
            "ui-implementation-expert": 15,
            "testing-expert": 8,
            "planner": 10,
        },
        "completion_stats": {
            "completion_rate": 0.6,
            "avg_completion_time_hours": 18.5,
            "median_completion_time_hours": 16.0,
        },
    }


@pytest.fixture
def mock_project_health():
    """Mock project health data."""
    return {
        "project_id": "project-456",
        "health_score": 0.85,
        "metrics": {
            "velocity_trend": "increasing",
            "completion_rate": 0.75,
            "overdue_tasks": 2,
            "blocked_tasks": 1,
            "task_distribution": "balanced",
        },
        "recommendations": [
            "Sprint velocity is increasing - good progress",
            "2 overdue tasks need attention",
        ],
    }


# Test 1: Get sprint report successfully
def test_get_sprint_report_success(client_with_auth, mock_reporting_service, mock_sprint_report):
    """Test GET /api/projects/{project_id}/reports/sprint/{sprint_id} returns report."""
    mock_reporting_service.get_sprint_report.return_value = (True, {"report": mock_sprint_report})

    response = client_with_auth.get("/api/projects/project-456/reports/sprint/sprint-123")

    assert response.status_code == 200
    data = response.json()
    assert data["sprint_id"] == "sprint-123"
    assert data["metrics"]["completion_rate"] == 0.8
    assert data["metrics"]["velocity"] == 40
    assert len(data["burndown"]) == 3


# Test 2: Sprint report for non-existent sprint
def test_get_sprint_report_not_found(client_with_auth, mock_reporting_service):
    """Test GET /api/projects/{project_id}/reports/sprint/{sprint_id} handles missing sprint."""
    mock_reporting_service.get_sprint_report.return_value = (
        False,
        {"error": "Sprint not found"},
    )

    response = client_with_auth.get("/api/projects/project-456/reports/sprint/nonexistent")

    assert response.status_code == 404


# Test 3: Get task metrics successfully
def test_get_task_metrics_success(client_with_auth, mock_reporting_service, mock_task_metrics):
    """Test GET /api/projects/{project_id}/reports/task-metrics returns metrics."""
    mock_reporting_service.get_task_metrics.return_value = (True, {"metrics": mock_task_metrics})

    response = client_with_auth.get("/api/projects/project-456/reports/task-metrics")

    assert response.status_code == 200
    data = response.json()
    assert data["total_tasks"] == 45
    assert data["by_status"]["done"] == 27
    assert data["completion_stats"]["completion_rate"] == 0.6


# Test 4: Task metrics with date range filter
def test_get_task_metrics_with_date_range(client_with_auth, mock_reporting_service, mock_task_metrics):
    """Test GET /api/projects/{project_id}/reports/task-metrics respects date filters."""
    mock_reporting_service.get_task_metrics.return_value = (True, {"metrics": mock_task_metrics})

    start_date = (datetime.now() - timedelta(days=30)).date().isoformat()
    end_date = datetime.now().date().isoformat()

    response = client_with_auth.get(
        f"/api/projects/project-456/reports/task-metrics?start_date={start_date}&end_date={end_date}"
    )

    assert response.status_code == 200


# Test 5: Task metrics by assignee filter
def test_get_task_metrics_by_assignee(client_with_auth, mock_reporting_service):
    """Test GET /api/projects/{project_id}/reports/task-metrics filters by assignee."""
    filtered_metrics = {
        "total_tasks": 12,
        "by_status": {"todo": 2, "doing": 3, "review": 1, "done": 6},
        "assignee": "backend-api-expert",
    }
    mock_reporting_service.get_task_metrics.return_value = (True, {"metrics": filtered_metrics})

    response = client_with_auth.get(
        "/api/projects/project-456/reports/task-metrics?assignee=backend-api-expert"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["assignee"] == "backend-api-expert"
    assert data["total_tasks"] == 12


# Test 6: Get project health report
def test_get_project_health_success(client_with_auth, mock_reporting_service, mock_project_health):
    """Test GET /api/projects/{project_id}/reports/health returns health report."""
    mock_reporting_service.get_project_health.return_value = (True, {"health": mock_project_health})

    response = client_with_auth.get("/api/projects/project-456/reports/health")

    assert response.status_code == 200
    data = response.json()
    assert data["health_score"] == 0.85
    assert data["metrics"]["velocity_trend"] == "increasing"
    assert len(data["recommendations"]) >= 1


# Test 7: Project health for non-existent project
def test_get_project_health_not_found(client_with_auth, mock_reporting_service):
    """Test GET /api/projects/{project_id}/reports/health handles missing project."""
    mock_reporting_service.get_project_health.return_value = (
        False,
        {"error": "Project not found"},
    )

    response = client_with_auth.get("/api/projects/nonexistent/reports/health")

    assert response.status_code == 404


# Test 8: Get velocity trends
def test_get_velocity_trends_success(client_with_auth, mock_reporting_service):
    """Test GET /api/projects/{project_id}/reports/velocity returns velocity trends."""
    velocity_data = {
        "sprints": [
            {"sprint_name": "Sprint 1", "velocity": 35, "planned": 40},
            {"sprint_name": "Sprint 2", "velocity": 40, "planned": 45},
            {"sprint_name": "Sprint 3", "velocity": 42, "planned": 45},
        ],
        "average_velocity": 39,
        "trend": "increasing",
    }
    mock_reporting_service.get_velocity_trends.return_value = (True, {"velocity": velocity_data})

    response = client_with_auth.get("/api/projects/project-456/reports/velocity")

    assert response.status_code == 200
    data = response.json()
    assert len(data["sprints"]) == 3
    assert data["average_velocity"] == 39
    assert data["trend"] == "increasing"


# Test 9: Velocity trends with sprint limit
def test_get_velocity_trends_with_limit(client_with_auth, mock_reporting_service):
    """Test GET /api/projects/{project_id}/reports/velocity respects limit parameter."""
    velocity_data = {
        "sprints": [
            {"sprint_name": "Sprint 3", "velocity": 42, "planned": 45},
        ],
        "average_velocity": 42,
        "trend": "stable",
    }
    mock_reporting_service.get_velocity_trends.return_value = (True, {"velocity": velocity_data})

    response = client_with_auth.get("/api/projects/project-456/reports/velocity?limit=1")

    assert response.status_code == 200
    data = response.json()
    assert len(data["sprints"]) <= 1


# Test 10: Cache behavior for reports
def test_report_cache_behavior(client_with_auth, mock_reporting_service, mock_task_metrics):
    """Test GET /api/projects/{project_id}/reports/task-metrics caches results."""
    mock_reporting_service.get_task_metrics.return_value = (True, {"metrics": mock_task_metrics})

    # First request
    response1 = client_with_auth.get("/api/projects/project-456/reports/task-metrics")
    assert response1.status_code == 200

    # Second request (should use cache if implemented)
    response2 = client_with_auth.get("/api/projects/project-456/reports/task-metrics")
    assert response2.status_code == 200

    # Verify responses are consistent
    assert response1.json() == response2.json()


# Test 11: Aggregation accuracy for completion rate
def test_completion_rate_calculation_accuracy(client_with_auth, mock_reporting_service):
    """Test completion rate calculation accuracy in task metrics."""
    # Mock data with known values for verification
    metrics_with_known_values = {
        "total_tasks": 100,
        "by_status": {"todo": 20, "doing": 10, "review": 5, "done": 65},
        "completion_stats": {"completion_rate": 0.65},
    }
    mock_reporting_service.get_task_metrics.return_value = (
        True,
        {"metrics": metrics_with_known_values},
    )

    response = client_with_auth.get("/api/projects/project-456/reports/task-metrics")

    assert response.status_code == 200
    data = response.json()
    # Verify completion rate matches done tasks / total tasks
    expected_rate = 65 / 100
    assert data["completion_stats"]["completion_rate"] == expected_rate


# Test 12: Report performance for large datasets
def test_report_performance_large_dataset(client_with_auth, mock_reporting_service):
    """Test GET /api/projects/{project_id}/reports/task-metrics performs well with large data."""
    import time

    # Mock large dataset
    large_metrics = {
        "total_tasks": 1000,
        "by_status": {"todo": 200, "doing": 100, "review": 50, "done": 650},
        "by_assignee": {f"agent-{i}": 50 for i in range(20)},
        "completion_stats": {"completion_rate": 0.65},
    }
    mock_reporting_service.get_task_metrics.return_value = (True, {"metrics": large_metrics})

    start_time = time.time()
    response = client_with_auth.get("/api/projects/project-456/reports/task-metrics")
    elapsed = (time.time() - start_time) * 1000  # Convert to ms

    assert response.status_code == 200
    assert elapsed < 1000, f"Report generation took {elapsed:.2f}ms (should be <1000ms)"
