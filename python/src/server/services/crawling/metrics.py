"""
Rate Limiting Metrics Collection

Provides Prometheus-style metrics for rate limiting monitoring.
Tracks events, timing, and statistics for observability.

Metrics Categories:
- Counters: Rate limit triggers, retries, errors
- Gauges: Current delays, active domains
- Histograms: Backoff delays, response times
- Summary: Per-domain statistics
"""
import time
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class RateLimitEvent(Enum):
    """Types of rate limit events."""
    DETECTED = "detected"              # Rate limit detected
    RETRY_AFTER = "retry_after"        # Retry-After header present
    BACKOFF_APPLIED = "backoff_applied"  # Exponential backoff applied
    ROBOTS_BLOCKED = "robots_blocked"  # robots.txt disallowed
    CRAWL_DELAY = "crawl_delay"        # Crawl-Delay applied
    ADAPTIVE_ADJUST = "adaptive_adjust"  # Adaptive throttling adjusted
    TOKEN_WAIT = "token_wait"          # Waited for token bucket


class RateLimitReason(Enum):
    """Reasons for rate limiting."""
    HTTP_429 = "http_429"
    HTTP_503 = "http_503"
    HTTP_403_CLOUDFLARE = "http_403_cloudflare"
    CUSTOM_MESSAGE = "custom_message"
    ROBOTS_TXT = "robots_txt"
    TIMEOUT = "timeout"
    ERROR = "error"


@dataclass
class RateLimitMetric:
    """Single rate limit metric event."""
    timestamp: float
    event_type: RateLimitEvent
    domain: str
    reason: Optional[RateLimitReason] = None
    delay_seconds: Optional[float] = None
    retry_after: Optional[float] = None
    attempt_number: Optional[int] = None
    url: Optional[str] = None
    metadata: dict = field(default_factory=dict)


@dataclass
class DomainMetrics:
    """Aggregated metrics for a single domain."""
    domain: str

    # Counters
    total_requests: int = 0
    rate_limit_count: int = 0
    retry_count: int = 0
    robots_blocked_count: int = 0

    # Timing
    total_delay_seconds: float = 0.0
    total_wait_seconds: float = 0.0

    # Latency tracking
    response_times: list[float] = field(default_factory=list)

    # Rate limit reasons breakdown
    reasons: dict[str, int] = field(default_factory=lambda: defaultdict(int))

    # Timestamps
    first_request: Optional[float] = None
    last_request: Optional[float] = None
    last_rate_limit: Optional[float] = None

    def record_request(self):
        """Record a new request."""
        now = time.time()
        self.total_requests += 1
        if self.first_request is None:
            self.first_request = now
        self.last_request = now

    def record_rate_limit(self, reason: RateLimitReason):
        """Record a rate limit event."""
        self.rate_limit_count += 1
        self.reasons[reason.value] += 1
        self.last_rate_limit = time.time()

    def record_delay(self, delay_seconds: float):
        """Record a delay applied."""
        self.total_delay_seconds += delay_seconds

    def record_wait(self, wait_seconds: float):
        """Record time waited for token."""
        self.total_wait_seconds += wait_seconds

    def record_response_time(self, latency: float):
        """Record response latency."""
        self.response_times.append(latency)
        # Keep only last 100 for memory efficiency
        if len(self.response_times) > 100:
            self.response_times = self.response_times[-100:]

    def get_stats(self) -> dict:
        """Get statistics summary."""
        now = time.time()

        # Calculate response time percentiles
        response_times_sorted = sorted(self.response_times) if self.response_times else []
        p50 = response_times_sorted[len(response_times_sorted) // 2] if response_times_sorted else None
        p95_idx = int(len(response_times_sorted) * 0.95)
        p95 = response_times_sorted[p95_idx] if response_times_sorted and p95_idx > 0 else None

        return {
            'domain': self.domain,
            'total_requests': self.total_requests,
            'rate_limit_count': self.rate_limit_count,
            'retry_count': self.retry_count,
            'robots_blocked_count': self.robots_blocked_count,
            'rate_limit_rate': (
                self.rate_limit_count / self.total_requests
                if self.total_requests > 0 else 0.0
            ),
            'total_delay_seconds': self.total_delay_seconds,
            'total_wait_seconds': self.total_wait_seconds,
            'avg_delay_per_request': (
                self.total_delay_seconds / self.total_requests
                if self.total_requests > 0 else 0.0
            ),
            'response_time_p50': p50,
            'response_time_p95': p95,
            'response_time_min': response_times_sorted[0] if response_times_sorted else None,
            'response_time_max': response_times_sorted[-1] if response_times_sorted else None,
            'reasons_breakdown': dict(self.reasons),
            'first_request_ago': (now - self.first_request) if self.first_request else None,
            'last_request_ago': (now - self.last_request) if self.last_request else None,
            'last_rate_limit_ago': (now - self.last_rate_limit) if self.last_rate_limit else None,
        }


class RateLimitMetricsCollector:
    """
    Collects and aggregates rate limiting metrics.

    Provides observability into rate limiting behavior across all domains.
    Designed for integration with monitoring systems (Prometheus, Grafana, etc.)
    """

    def __init__(self, max_events_history: int = 1000):
        """
        Initialize metrics collector.

        Args:
            max_events_history: Maximum number of events to keep in history
        """
        self.max_events_history = max_events_history

        # Event history (for detailed debugging)
        self._events: list[RateLimitMetric] = []

        # Per-domain aggregated metrics
        self._domain_metrics: dict[str, DomainMetrics] = {}

        # Global counters
        self._global_counters = {
            'total_rate_limits': 0,
            'total_retries': 0,
            'total_robots_blocks': 0,
            'total_delays_applied': 0,
        }

        logger.info(f"Initialized rate limit metrics collector (max_history={max_events_history})")

    def _get_or_create_domain_metrics(self, domain: str) -> DomainMetrics:
        """Get or create metrics for domain."""
        if domain not in self._domain_metrics:
            self._domain_metrics[domain] = DomainMetrics(domain=domain)
        return self._domain_metrics[domain]

    def record_event(
        self,
        event_type: RateLimitEvent,
        domain: str,
        reason: Optional[RateLimitReason] = None,
        delay_seconds: Optional[float] = None,
        retry_after: Optional[float] = None,
        attempt_number: Optional[int] = None,
        url: Optional[str] = None,
        **metadata
    ):
        """
        Record a rate limit event.

        Args:
            event_type: Type of event
            domain: Domain name
            reason: Reason for rate limit (if applicable)
            delay_seconds: Delay applied in seconds
            retry_after: Retry-After value from server
            attempt_number: Retry attempt number
            url: Full URL (optional)
            **metadata: Additional metadata
        """
        event = RateLimitMetric(
            timestamp=time.time(),
            event_type=event_type,
            domain=domain,
            reason=reason,
            delay_seconds=delay_seconds,
            retry_after=retry_after,
            attempt_number=attempt_number,
            url=url,
            metadata=metadata
        )

        # Add to history
        self._events.append(event)

        # Trim history if too long
        if len(self._events) > self.max_events_history:
            self._events = self._events[-self.max_events_history:]

        # Update domain metrics
        domain_metrics = self._get_or_create_domain_metrics(domain)

        if event_type == RateLimitEvent.DETECTED:
            if reason:
                domain_metrics.record_rate_limit(reason)
                self._global_counters['total_rate_limits'] += 1

        elif event_type == RateLimitEvent.BACKOFF_APPLIED:
            domain_metrics.retry_count += 1
            self._global_counters['total_retries'] += 1
            if delay_seconds:
                domain_metrics.record_delay(delay_seconds)
                self._global_counters['total_delays_applied'] += 1

        elif event_type == RateLimitEvent.ROBOTS_BLOCKED:
            domain_metrics.robots_blocked_count += 1
            self._global_counters['total_robots_blocks'] += 1

        elif event_type == RateLimitEvent.TOKEN_WAIT:
            if delay_seconds:
                domain_metrics.record_wait(delay_seconds)

    def record_request(self, domain: str, latency: Optional[float] = None):
        """
        Record a successful request.

        Args:
            domain: Domain name
            latency: Response time in seconds
        """
        domain_metrics = self._get_or_create_domain_metrics(domain)
        domain_metrics.record_request()

        if latency is not None:
            domain_metrics.record_response_time(latency)

    def get_domain_stats(self, domain: str) -> Optional[dict]:
        """
        Get statistics for specific domain.

        Args:
            domain: Domain name

        Returns:
            Statistics dict or None if domain not tracked
        """
        if domain not in self._domain_metrics:
            return None

        return self._domain_metrics[domain].get_stats()

    def get_global_stats(self) -> dict:
        """
        Get global statistics across all domains.

        Returns:
            Dict with global metrics
        """
        total_requests = sum(m.total_requests for m in self._domain_metrics.values())
        total_rate_limits = sum(m.rate_limit_count for m in self._domain_metrics.values())

        return {
            'total_requests': total_requests,
            'total_rate_limits': total_rate_limits,
            'total_retries': self._global_counters['total_retries'],
            'total_robots_blocks': self._global_counters['total_robots_blocks'],
            'total_delays_applied': self._global_counters['total_delays_applied'],
            'global_rate_limit_rate': (
                total_rate_limits / total_requests
                if total_requests > 0 else 0.0
            ),
            'domains_tracked': len(self._domain_metrics),
            'events_in_history': len(self._events),
        }

    def get_all_domain_stats(self) -> dict[str, dict]:
        """
        Get statistics for all tracked domains.

        Returns:
            Dict mapping domain -> statistics
        """
        return {
            domain: metrics.get_stats()
            for domain, metrics in self._domain_metrics.items()
        }

    def get_recent_events(
        self,
        limit: int = 100,
        event_type: Optional[RateLimitEvent] = None,
        domain: Optional[str] = None
    ) -> list[dict]:
        """
        Get recent rate limit events.

        Args:
            limit: Maximum number of events to return
            event_type: Filter by event type
            domain: Filter by domain

        Returns:
            List of event dictionaries
        """
        events = self._events[-limit:]

        # Apply filters
        if event_type:
            events = [e for e in events if e.event_type == event_type]

        if domain:
            events = [e for e in events if e.domain == domain]

        # Convert to dicts
        return [
            {
                'timestamp': e.timestamp,
                'event_type': e.event_type.value,
                'domain': e.domain,
                'reason': e.reason.value if e.reason else None,
                'delay_seconds': e.delay_seconds,
                'retry_after': e.retry_after,
                'attempt_number': e.attempt_number,
                'url': e.url,
                'metadata': e.metadata,
            }
            for e in events
        ]

    def get_prometheus_metrics(self) -> str:
        """
        Export metrics in Prometheus text format.

        Returns:
            Prometheus-formatted metrics string
        """
        lines = []

        # Global counters
        lines.append('# HELP archon_rate_limit_total Total rate limit events detected')
        lines.append('# TYPE archon_rate_limit_total counter')
        lines.append(f'archon_rate_limit_total {self._global_counters["total_rate_limits"]}')
        lines.append('')

        lines.append('# HELP archon_rate_limit_retries_total Total retry attempts due to rate limiting')
        lines.append('# TYPE archon_rate_limit_retries_total counter')
        lines.append(f'archon_rate_limit_retries_total {self._global_counters["total_retries"]}')
        lines.append('')

        lines.append('# HELP archon_robots_blocks_total Total requests blocked by robots.txt')
        lines.append('# TYPE archon_robots_blocks_total counter')
        lines.append(f'archon_robots_blocks_total {self._global_counters["total_robots_blocks"]}')
        lines.append('')

        # Per-domain metrics
        lines.append('# HELP archon_domain_rate_limit_count Rate limit count per domain')
        lines.append('# TYPE archon_domain_rate_limit_count gauge')
        for domain, metrics in self._domain_metrics.items():
            lines.append(f'archon_domain_rate_limit_count{{domain="{domain}"}} {metrics.rate_limit_count}')
        lines.append('')

        lines.append('# HELP archon_domain_requests_total Total requests per domain')
        lines.append('# TYPE archon_domain_requests_total counter')
        for domain, metrics in self._domain_metrics.items():
            lines.append(f'archon_domain_requests_total{{domain="{domain}"}} {metrics.total_requests}')
        lines.append('')

        return '\n'.join(lines)

    def clear_domain(self, domain: str):
        """Clear metrics for specific domain."""
        if domain in self._domain_metrics:
            del self._domain_metrics[domain]
            logger.debug(f"Cleared metrics for {domain}")

    def reset_all(self):
        """Reset all metrics."""
        self._events.clear()
        self._domain_metrics.clear()
        for key in self._global_counters:
            self._global_counters[key] = 0
        logger.info("Reset all rate limit metrics")


# Global singleton instance
_global_metrics_collector: Optional[RateLimitMetricsCollector] = None


def get_global_metrics_collector() -> RateLimitMetricsCollector:
    """
    Get global metrics collector instance (singleton pattern).

    Returns:
        Global RateLimitMetricsCollector instance
    """
    global _global_metrics_collector

    if _global_metrics_collector is None:
        _global_metrics_collector = RateLimitMetricsCollector()
        logger.info("Created global RateLimitMetricsCollector instance")

    return _global_metrics_collector
