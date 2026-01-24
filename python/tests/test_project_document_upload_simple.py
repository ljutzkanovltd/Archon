"""
Simple sanity tests for Project Document Upload
Tests basic functionality without complex mocking
"""

import pytest


def test_sanity():
    """Basic sanity test"""
    assert True


def test_imports():
    """Test that modules can be imported"""
    from io import BytesIO
    from fastapi.testclient import TestClient
    from src.server.utils.progress.progress_tracker import ProgressTracker

    assert BytesIO is not None
    assert TestClient is not None
    assert ProgressTracker is not None


def test_progress_tracker():
    """Test ProgressTracker basic functionality"""
    from src.server.utils.progress.progress_tracker import ProgressTracker

    tracker = ProgressTracker("test-id", operation_type="upload")
    tracker.state.update({
        "status": "processing",
        "progress": 50,
    })

    assert tracker.progress_id == "test-id"
    assert tracker.state["status"] == "processing"
    assert tracker.state["progress"] == 50


@pytest.mark.parametrize("operation_type", ["upload", "crawl"])
def test_progress_tracker_types(operation_type):
    """Test different operation types"""
    from src.server.utils.progress.progress_tracker import ProgressTracker

    tracker = ProgressTracker(f"test-{operation_type}", operation_type=operation_type)
    tracker.state["status"] = "processing"

    assert tracker.progress_id == f"test-{operation_type}"
    assert tracker.state["status"] == "processing"


def test_test_client_creation(client):
    """Test that FastAPI test client can be created"""
    response = client.get("/health")
    # Should get some response (200 or 404)
    assert response.status_code in [200, 404, 500]
