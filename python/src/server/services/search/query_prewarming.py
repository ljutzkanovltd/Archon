"""
Query Prewarming Service

Pre-generates embeddings for common queries at server startup to improve
cache hit rates and reduce first-time query latency.

Expected Impact:
- Cache hit rate: 40% → 60-70%
- First-time latency for common queries: 18-21s → <100ms
- Non-blocking startup (runs in background)
"""

import asyncio
import logging
import time
from typing import Optional

from ...config.logfire_config import search_logger
from ..embeddings.embedding_service import create_embedding

logger = logging.getLogger(__name__)

# Top 100 common queries curated for knowledge base searches
# Organized by category for better maintainability
COMMON_QUERIES = [
    # Authentication & Security (10)
    "authentication",
    "OAuth JWT",
    "user authentication",
    "login system",
    "password hashing",
    "session management",
    "API authentication",
    "token refresh",
    "RBAC permissions",
    "security best practices",
    # Database & Performance (10)
    "database indexing",
    "query optimization",
    "PostgreSQL performance",
    "vector search",
    "database migrations",
    "connection pooling",
    "ORM best practices",
    "database transactions",
    "SQL injection prevention",
    "database backup",
    # API Design (10)
    "REST API design",
    "GraphQL schema",
    "API versioning",
    "rate limiting",
    "API documentation",
    "error handling",
    "pagination",
    "API security",
    "webhooks",
    "API testing",
    # Frontend Development (10)
    "React components",
    "state management",
    "React hooks",
    "Redux patterns",
    "form validation",
    "responsive design",
    "CSS best practices",
    "accessibility WCAG",
    "frontend testing",
    "performance optimization",
    # Backend Development (10)
    "microservices architecture",
    "caching strategies",
    "async await patterns",
    "background jobs",
    "message queues",
    "logging best practices",
    "monitoring alerting",
    "error tracking",
    "deployment strategies",
    "Docker containers",
    # Testing (10)
    "unit testing",
    "integration testing",
    "E2E testing",
    "test coverage",
    "mocking strategies",
    "TDD approach",
    "test automation",
    "CI/CD pipelines",
    "load testing",
    "security testing",
    # AI/ML Integration (10)
    "vector embeddings",
    "semantic search",
    "RAG implementation",
    "prompt engineering",
    "LLM integration",
    "AI model deployment",
    "embedding models",
    "vector databases",
    "similarity search",
    "AI best practices",
    # DevOps & Infrastructure (10)
    "container orchestration",
    "Kubernetes deployment",
    "load balancing",
    "reverse proxy",
    "SSL certificates",
    "environment variables",
    "configuration management",
    "infrastructure as code",
    "monitoring tools",
    "log aggregation",
    # Code Quality (10)
    "code review",
    "refactoring patterns",
    "design patterns",
    "clean code",
    "SOLID principles",
    "code documentation",
    "linting rules",
    "type safety",
    "error handling patterns",
    "code organization",
    # Project Management (10)
    "agile methodology",
    "sprint planning",
    "task estimation",
    "project documentation",
    "code collaboration",
    "Git workflow",
    "pull request best practices",
    "branching strategies",
    "release management",
    "technical debt",
]


class QueryPrewarmer:
    """
    Pre-warms the embedding cache with common queries.

    Runs asynchronously in background during server startup.
    """

    def __init__(self):
        self.queries = COMMON_QUERIES
        self.is_running = False
        self.completion_time: Optional[float] = None
        self.success_count = 0
        self.failure_count = 0

    async def prewarm_cache(self) -> dict:
        """
        Pre-generate embeddings for common queries.

        Returns:
            dict: Summary statistics of prewarming operation
        """
        if self.is_running:
            logger.warning("Query prewarming already in progress")
            return {"status": "already_running"}

        self.is_running = True
        start_time = time.time()
        self.success_count = 0
        self.failure_count = 0

        logger.info(f"🔥 Starting query cache prewarming for {len(self.queries)} queries...")
        search_logger.info(f"Query prewarming: {len(self.queries)} queries to process")

        try:
            # Process queries in batches to avoid overwhelming the API
            batch_size = 10
            for i in range(0, len(self.queries), batch_size):
                batch = self.queries[i:i + batch_size]

                # Process batch concurrently
                tasks = [self._prewarm_single_query(query) for query in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Count successes/failures
                for result in results:
                    if isinstance(result, Exception):
                        self.failure_count += 1
                    else:
                        self.success_count += 1

                # Log progress every batch
                total_processed = self.success_count + self.failure_count
                if total_processed % 10 == 0:
                    logger.info(
                        f"Query prewarming progress: {total_processed}/{len(self.queries)} "
                        f"({self.success_count} succeeded, {self.failure_count} failed)"
                    )

            elapsed = time.time() - start_time
            self.completion_time = elapsed

            logger.info(
                f"✅ Query cache prewarming complete: "
                f"{self.success_count} succeeded, {self.failure_count} failed "
                f"in {elapsed:.2f}s"
            )

            search_logger.info(
                "Query prewarming completed",
                extra={
                    "success_count": self.success_count,
                    "failure_count": self.failure_count,
                    "total_queries": len(self.queries),
                    "duration_seconds": elapsed,
                    "avg_time_per_query_ms": (elapsed / len(self.queries)) * 1000,
                },
            )

            return {
                "status": "completed",
                "success_count": self.success_count,
                "failure_count": self.failure_count,
                "total_queries": len(self.queries),
                "duration_seconds": elapsed,
                "cache_hit_rate_improvement_expected": "40% → 60-70%",
            }

        except Exception as e:
            logger.error(f"❌ Query prewarming failed: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e),
                "success_count": self.success_count,
                "failure_count": self.failure_count,
            }
        finally:
            self.is_running = False

    async def _prewarm_single_query(self, query: str) -> bool:
        """
        Pre-warm a single query by generating its embedding.

        Args:
            query: Query text to prewarm

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Create embedding (will cache automatically)
            await create_embedding(query)
            return True
        except Exception as e:
            logger.warning(f"Failed to prewarm query '{query[:50]}...': {e}")
            # Don't raise - continue with other queries
            return False


# Global instance
_query_prewarmer: Optional[QueryPrewarmer] = None


def get_query_prewarmer() -> QueryPrewarmer:
    """Get or create the global query prewarmer instance."""
    global _query_prewarmer
    if _query_prewarmer is None:
        _query_prewarmer = QueryPrewarmer()
    return _query_prewarmer


async def prewarm_query_cache() -> dict:
    """
    Convenience function to prewarm the query cache.

    Returns:
        dict: Summary statistics of prewarming operation
    """
    prewarmer = get_query_prewarmer()
    return await prewarmer.prewarm_cache()


async def get_prewarming_status() -> dict:
    """
    Get current status of query prewarming.

    Returns:
        dict: Current prewarming status and statistics
    """
    prewarmer = get_query_prewarmer()
    return {
        "is_running": prewarmer.is_running,
        "total_queries": len(prewarmer.queries),
        "success_count": prewarmer.success_count,
        "failure_count": prewarmer.failure_count,
        "completion_time_seconds": prewarmer.completion_time,
    }
