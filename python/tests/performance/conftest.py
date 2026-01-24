"""
Performance Test Configuration

This conftest.py DISABLES the automatic mocking from the parent conftest.py
to allow performance tests to run against the real database.

Performance tests need real database connections to measure actual query performance.
"""

import os
import pytest
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)


@pytest.fixture(autouse=False)
def prevent_real_db_calls():
    """Override parent fixture to DISABLE mocking for performance tests."""
    # This fixture does nothing - it just overrides the parent's autouse fixture
    # by having the same name but autouse=False
    yield


@pytest.fixture(autouse=False)
def ensure_test_environment():
    """Override parent fixture to allow real environment for performance tests."""
    # Don't force test environment - use real .env values
    yield
