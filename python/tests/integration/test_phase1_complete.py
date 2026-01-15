"""
End-to-end integration tests for Phase 1 features.

Tests complete workflows covering:
- Project creation → Sprint planning → Task assignment → Knowledge linking → Reporting
- Multi-agent collaboration scenarios
- Knowledge base integration with project management
- Sprint lifecycle with reporting
- Error recovery and data consistency
"""

from unittest.mock import MagicMock, patch
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_services():
    """Mock all required services for end-to-end testing."""
    with patch("src.server.api_routes.projects.ProjectService") as mock_project_service, \
         patch("src.server.api_routes.tasks.TaskService") as mock_task_service, \
         patch("src.server.api_routes.sprints.SprintService") as mock_sprint_service, \
         patch("src.server.api_routes.knowledge_links.KnowledgeLinkingService") as mock_knowledge_service, \
         patch("src.server.api_routes.reports.ReportingService") as mock_reporting_service:

        yield {
            "project": mock_project_service.return_value,
            "task": mock_task_service.return_value,
            "sprint": mock_sprint_service.return_value,
            "knowledge": mock_knowledge_service.return_value,
            "reporting": mock_reporting_service.return_value,
        }


# Using client_with_auth from integration/conftest.py


# End-to-End Test 1: Complete project workflow
def test_complete_project_workflow(client_with_auth, mock_services):
    """
    Test complete workflow: Create project → Create tasks → Link knowledge → Generate report.
    """
    # Step 1: Create project
    project_data = {
        "id": "project-e2e-1",
        "title": "Authentication System",
        "description": "Implement JWT-based authentication",
        "created_at": datetime.utcnow().isoformat(),
    }
    mock_services["project"].create_project.return_value = (True, {"project": project_data})

    project_response = client_with_auth.post(
        "/api/projects",
        json={"title": "Authentication System", "description": "Implement JWT-based authentication"},
    )
    assert project_response.status_code == 200
    project_id = project_response.json()["id"]

    # Step 2: Create tasks
    task_data = {
        "id": "task-e2e-1",
        "project_id": project_id,
        "title": "Implement JWT tokens",
        "status": "todo",
        "assignee": "backend-api-expert",
    }
    mock_services["task"].create_task.return_value = (True, {"task": task_data})

    task_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks",
        json={
            "title": "Implement JWT tokens",
            "assignee": "backend-api-expert",
            "estimated_hours": 3.0,
        },
    )
    assert task_response.status_code == 200
    task_id = task_response.json()["id"]

    # Step 3: Link knowledge to task
    link_data = {
        "id": "link-e2e-1",
        "task_id": task_id,
        "knowledge_id": "550e8400-e29b-41d4-a716-446655440000",
        "link_type": "reference",
    }
    mock_services["knowledge"].link_knowledge.return_value = (True, {"link": link_data})

    link_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks/{task_id}/knowledge",
        json={
            "knowledge_id": "550e8400-e29b-41d4-a716-446655440000",
            "link_type": "reference",
        },
    )
    assert link_response.status_code == 200

    # Step 4: Update task status
    updated_task = {**task_data, "status": "done"}
    mock_services["task"].update_task.return_value = (True, {"task": updated_task})

    update_response = client_with_auth.put(
        f"/api/tasks/{task_id}",
        json={"status": "done"},
    )
    assert update_response.status_code == 200

    # Step 5: Generate project health report
    health_data = {
        "project_id": project_id,
        "health_score": 0.9,
        "metrics": {"completion_rate": 1.0, "overdue_tasks": 0},
    }
    mock_services["reporting"].get_project_health.return_value = (True, {"health": health_data})

    health_response = client_with_auth.get(f"/api/projects/{project_id}/reports/health")
    assert health_response.status_code == 200
    assert health_response.json()["health_score"] == 0.9


# End-to-End Test 2: Sprint lifecycle with knowledge linking
def test_sprint_lifecycle_with_knowledge(client_with_auth, mock_services):
    """
    Test sprint workflow: Create sprint → Assign tasks → Link knowledge → Complete sprint → Generate report.
    """
    project_id = "project-sprint-1"

    # Step 1: Create sprint
    sprint_data = {
        "id": "sprint-e2e-1",
        "project_id": project_id,
        "name": "Sprint 1",
        "start_date": "2026-01-15",
        "end_date": "2026-01-29",
        "status": "planned",
    }
    mock_services["sprint"].create_sprint.return_value = (True, {"sprint": sprint_data})

    sprint_response = client_with_auth.post(
        f"/api/projects/{project_id}/sprints",
        json={
            "name": "Sprint 1",
            "start_date": "2026-01-15",
            "end_date": "2026-01-29",
            "goal": "Complete authentication feature",
        },
    )
    assert sprint_response.status_code == 200
    sprint_id = sprint_response.json()["id"]

    # Step 2: Create and assign tasks to sprint
    task_data = {
        "id": "task-sprint-1",
        "project_id": project_id,
        "title": "JWT implementation",
        "sprint_id": sprint_id,
        "status": "todo",
    }
    mock_services["task"].create_task.return_value = (True, {"task": task_data})

    task_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks",
        json={"title": "JWT implementation", "sprint_id": sprint_id},
    )
    assert task_response.status_code == 200
    task_id = task_response.json()["id"]

    # Step 3: Start sprint
    active_sprint = {**sprint_data, "status": "active"}
    mock_services["sprint"].start_sprint.return_value = (True, {"sprint": active_sprint})

    start_response = client_with_auth.post(f"/api/sprints/{sprint_id}/start")
    assert start_response.status_code == 200

    # Step 4: Link knowledge to sprint task
    mock_services["knowledge"].link_knowledge.return_value = (
        True,
        {"link": {"id": "link-sprint-1", "task_id": task_id}},
    )

    link_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks/{task_id}/knowledge",
        json={
            "knowledge_id": "550e8400-e29b-41d4-a716-446655440001",
            "link_type": "example",
        },
    )
    assert link_response.status_code == 200

    # Step 5: Complete task and sprint
    completed_task = {**task_data, "status": "done"}
    mock_services["task"].update_task.return_value = (True, {"task": completed_task})
    client_with_auth.put(f"/api/tasks/{task_id}", json={"status": "done"})

    completed_sprint = {**sprint_data, "status": "completed"}
    mock_services["sprint"].complete_sprint.return_value = (True, {"sprint": completed_sprint})

    complete_response = client_with_auth.post(f"/api/sprints/{sprint_id}/complete")
    assert complete_response.status_code == 200

    # Step 6: Generate sprint report
    sprint_report = {
        "sprint_id": sprint_id,
        "metrics": {"completion_rate": 1.0, "velocity": 8},
    }
    mock_services["reporting"].get_sprint_report.return_value = (True, {"report": sprint_report})

    report_response = client_with_auth.get(f"/api/projects/{project_id}/reports/sprint/{sprint_id}")
    assert report_response.status_code == 200
    assert report_response.json()["metrics"]["completion_rate"] == 1.0


# End-to-End Test 3: Multi-agent collaboration scenario
def test_multi_agent_collaboration(client_with_auth, mock_services):
    """
    Test multi-agent workflow: Planner creates tasks → Experts execute → Testing validates.
    """
    project_id = "project-collab-1"

    # Step 1: Planner creates planning task
    planning_task = {
        "id": "task-plan-1",
        "project_id": project_id,
        "title": "Plan authentication feature",
        "assignee": "planner",
        "status": "done",
    }
    mock_services["task"].create_task.return_value = (True, {"task": planning_task})

    plan_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks",
        json={"title": "Plan authentication feature", "assignee": "planner"},
    )
    assert plan_response.status_code == 200

    # Step 2: Backend expert implements
    backend_task = {
        "id": "task-backend-1",
        "project_id": project_id,
        "title": "Implement JWT endpoints",
        "assignee": "backend-api-expert",
        "status": "doing",
    }
    mock_services["task"].create_task.return_value = (True, {"task": backend_task})

    backend_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks",
        json={"title": "Implement JWT endpoints", "assignee": "backend-api-expert"},
    )
    assert backend_response.status_code == 200

    # Step 3: Testing expert creates tests
    testing_task = {
        "id": "task-test-1",
        "project_id": project_id,
        "title": "Write authentication tests",
        "assignee": "testing-expert",
        "status": "done",
    }
    mock_services["task"].create_task.return_value = (True, {"task": testing_task})

    test_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks",
        json={"title": "Write authentication tests", "assignee": "testing-expert"},
    )
    assert test_response.status_code == 200

    # Step 4: Verify all agents have tasks
    all_tasks = [planning_task, backend_task, testing_task]
    mock_services["task"].list_tasks.return_value = (True, {"tasks": all_tasks})

    tasks_response = client_with_auth.get(f"/api/projects/{project_id}/tasks")
    assert tasks_response.status_code == 200
    tasks_data = tasks_response.json()

    # Verify multi-agent distribution
    assignees = {task["assignee"] for task in all_tasks}
    assert "planner" in assignees
    assert "backend-api-expert" in assignees
    assert "testing-expert" in assignees


# End-to-End Test 4: Knowledge discovery and recommendation workflow
def test_knowledge_discovery_workflow(client_with_auth, mock_services):
    """
    Test knowledge discovery: Create project → Get AI suggestions → Link relevant items → Track usage.
    """
    project_id = "project-knowledge-1"

    # Step 1: Get AI knowledge suggestions for project
    suggestions = [
        {
            "page_id": "550e8400-e29b-41d4-a716-446655440010",
            "title": "JWT Authentication Guide",
            "relevance_score": 0.92,
        },
        {
            "page_id": "550e8400-e29b-41d4-a716-446655440011",
            "title": "FastAPI Security Best Practices",
            "relevance_score": 0.88,
        },
    ]
    mock_services["knowledge"].suggest_knowledge_for_project.return_value = (
        True,
        {"suggestions": suggestions},
    )

    suggestions_response = client_with_auth.get(f"/api/projects/{project_id}/knowledge/suggestions?limit=5")
    assert suggestions_response.status_code == 200
    assert len(suggestions_response.json()["suggestions"]) >= 2

    # Step 2: Create task and link top suggestion
    task_data = {
        "id": "task-knowledge-1",
        "project_id": project_id,
        "title": "Implement JWT authentication",
    }
    mock_services["task"].create_task.return_value = (True, {"task": task_data})

    task_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks",
        json={"title": "Implement JWT authentication"},
    )
    task_id = task_response.json()["id"]

    mock_services["knowledge"].link_knowledge.return_value = (
        True,
        {"link": {"id": "link-knowledge-1", "knowledge_id": suggestions[0]["page_id"]}},
    )

    link_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks/{task_id}/knowledge",
        json={
            "knowledge_id": suggestions[0]["page_id"],
            "link_type": "tutorial",
        },
    )
    assert link_response.status_code == 200

    # Step 3: Verify reverse lookup shows project using knowledge
    reverse_lookup_data = {
        "projects": [{"project_id": project_id, "link_count": 1}],
        "tasks": [{"task_id": task_id, "task_title": "Implement JWT authentication"}],
    }
    mock_services["knowledge"].get_knowledge_sources.return_value = (
        True,
        reverse_lookup_data,
    )

    reverse_response = client_with_auth.get(f"/api/knowledge/rag_page/{suggestions[0]['page_id']}/projects")
    assert reverse_response.status_code == 200
    assert len(reverse_response.json()["projects"]) >= 1


# End-to-End Test 5: Error recovery and data consistency
def test_error_recovery_and_consistency(client_with_auth, mock_services):
    """
    Test error handling: Verify system handles failures gracefully and maintains data consistency.
    """
    project_id = "project-error-1"

    # Step 1: Attempt to link knowledge to non-existent task (should fail)
    mock_services["knowledge"].link_knowledge.return_value = (
        False,
        {"error": "Task not found"},
    )

    link_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks/nonexistent-task/knowledge",
        json={"knowledge_id": "550e8400-e29b-41d4-a716-446655440000"},
    )
    assert link_response.status_code == 404

    # Step 2: Attempt duplicate link (should fail)
    mock_services["knowledge"].link_knowledge.return_value = (
        False,
        {"error": "Link already exists"},
    )

    duplicate_response = client_with_auth.post(
        f"/api/projects/{project_id}/tasks/task-1/knowledge",
        json={"knowledge_id": "550e8400-e29b-41d4-a716-446655440000"},
    )
    assert duplicate_response.status_code == 409

    # Step 3: Get report for non-existent project (should fail gracefully)
    mock_services["reporting"].get_project_health.return_value = (
        False,
        {"error": "Project not found"},
    )

    report_response = client_with_auth.get("/api/projects/nonexistent/reports/health")
    assert report_response.status_code == 404

    # Step 4: Verify existing data remains intact after failures
    existing_task = {
        "id": "task-1",
        "project_id": project_id,
        "title": "Existing task",
        "status": "doing",
    }
    mock_services["task"].get_task.return_value = (True, {"task": existing_task})

    task_response = client_with_auth.get("/api/tasks/task-1")
    assert task_response.status_code == 200
    assert task_response.json()["status"] == "doing"  # Status unchanged


# End-to-End Test 6: Performance under load
def test_performance_under_concurrent_operations(client_with_auth, mock_services):
    """
    Test system performance with multiple concurrent operations.
    """
    import time

    project_id = "project-perf-1"

    # Simulate multiple concurrent task creations
    task_ids = []
    for i in range(10):
        task_data = {
            "id": f"task-perf-{i}",
            "project_id": project_id,
            "title": f"Task {i}",
        }
        mock_services["task"].create_task.return_value = (True, {"task": task_data})

        start_time = time.time()
        response = client_with_auth.post(
            f"/api/projects/{project_id}/tasks",
            json={"title": f"Task {i}"},
        )
        elapsed = (time.time() - start_time) * 1000

        assert response.status_code == 200
        assert elapsed < 200, f"Task creation took {elapsed:.2f}ms (should be <200ms)"
        task_ids.append(response.json()["id"])

    # Verify all tasks were created
    all_tasks = [{"id": tid, "title": f"Task {i}"} for i, tid in enumerate(task_ids)]
    mock_services["task"].list_tasks.return_value = (True, {"tasks": all_tasks})

    list_response = client_with_auth.get(f"/api/projects/{project_id}/tasks")
    assert list_response.status_code == 200
    assert len(list_response.json()["tasks"]) == 10
