"""
Performance Monitoring API

Provides aggregated performance statistics for monitoring and debugging.
Tracks endpoint latencies, cache performance, and embedding generation metrics.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/performance", tags=["performance"])


@router.get("/stats")
async def get_performance_stats():
    """
    Get comprehensive performance statistics.

    Returns aggregated metrics including:
    - Endpoint latencies (P50, P95, P99)
    - Cache hit rates and timing
    - Embedding generation performance
    - Slow queries (>1s)

    Example response:
    ```json
    {
      "endpoints": {
        "/api/knowledge/search": {
          "p50": 120,
          "p95": 450,
          "p99": 890,
          "avg": 180,
          "count": 1500
        }
      },
      "cache": {
        "hit_rate": 0.50,
        "hits": 750,
        "misses": 750,
        "avg_hit_time": 37.5,
        "avg_miss_time": 950.2
      },
      "embeddings": {
        "total_generated": 25000,
        "avg_latency": 900.5,
        "batch_speedup": "8.5x"
      },
      "slow_queries": [
        {
          "endpoint": "/api/knowledge/search",
          "latency_ms": 1450,
          "timestamp": "2026-01-23T13:45:00.123Z"
        }
      ]
    }
    ```
    """
    from ..services.performance_metrics import get_metrics_service

    metrics_service = get_metrics_service()
    stats = metrics_service.get_all_stats()

    return JSONResponse(
        content=stats,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.post("/reset")
async def reset_performance_stats():
    """
    Reset all performance statistics.

    Useful for testing or starting fresh after configuration changes.
    **Warning:** This clears all accumulated metrics.
    """
    from ..services.performance_metrics import get_metrics_service

    metrics_service = get_metrics_service()
    metrics_service.reset_stats()

    return {"success": True, "message": "Performance statistics reset"}


@router.get("/health")
async def performance_health():
    """
    Quick health check for performance monitoring system.

    Returns basic status without full statistics.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        logger.info("Performance health endpoint called - step 1")
        from ..services.performance_metrics import get_metrics_service

        logger.info("Performance health endpoint called - step 2: getting service")
        metrics_service = get_metrics_service()

        logger.info("Performance health endpoint called - step 3: getting stats")
        stats = metrics_service.get_all_stats()

        logger.info("Performance health endpoint called - step 4: calculating health")
        # Calculate overall health
        total_requests = sum(ep["count"] for ep in stats["endpoints"].values())
        avg_latency = (
            sum(ep["avg"] * ep["count"] for ep in stats["endpoints"].values()) / total_requests
            if total_requests > 0
            else 0
        )

        logger.info("Performance health endpoint called - step 5: returning response")
        return {
            "status": "healthy",
            "total_requests": total_requests,
            "avg_latency_ms": round(avg_latency, 1),
            "cache_hit_rate": stats["cache"]["hit_rate"],
            "slow_queries_count": len(stats["slow_queries"]),
        }
    except Exception as e:
        logger.error(f"Error in performance health endpoint: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


@router.get("/prewarming/status")
async def get_prewarming_status():
    """
    Get status of query cache prewarming.

    Returns information about the prewarming process including:
    - Running status
    - Success/failure counts
    - Total queries to prewarm
    - Completion time

    Example response:
    ```json
    {
      "is_running": false,
      "total_queries": 100,
      "success_count": 98,
      "failure_count": 2,
      "completion_time_seconds": 145.3,
      "status": "completed",
      "cache_hit_rate_improvement": "Expected 40% → 60-70%"
    }
    ```
    """
    from ..services.search.query_prewarming import get_prewarming_status

    status = await get_prewarming_status()

    # Add computed fields
    if status["completion_time_seconds"]:
        status["status"] = "completed"
        status["cache_hit_rate_improvement"] = "Expected 40% → 60-70%"
    elif status["is_running"]:
        status["status"] = "in_progress"
        total = status["total_queries"]
        processed = status["success_count"] + status["failure_count"]
        status["progress_percent"] = round((processed / total) * 100, 1) if total > 0 else 0
    else:
        status["status"] = "not_started"

    return status
