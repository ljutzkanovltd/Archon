"""
Adaptive Throttling for Web Crawling

Automatically adjusts crawl rate based on server response times and errors.
Inspired by Scrapy's AutoThrottle extension.

Algorithm:
- Monitors response latency for each domain
- Calculates target delay based on latency and target concurrency
- Adjusts delay using exponential moving average
- Automatically slows down on errors, speeds up when server is responsive

References:
- Scrapy AutoThrottle: https://docs.scrapy.org/en/latest/topics/autothrottle.html
- Adaptive rate limiting patterns
"""
import asyncio
import time
from collections import defaultdict
from typing import Optional
from urllib.parse import urlparse

from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class DomainStats:
    """
    Statistics and state for a single domain.

    Tracks response times, errors, and calculated delays.
    """

    def __init__(
        self,
        start_delay: float,
        target_concurrency: float
    ):
        """
        Initialize domain statistics.

        Args:
            start_delay: Initial delay in seconds
            target_concurrency: Target concurrent requests (typically 1.0-2.0)
        """
        self.current_delay = start_delay
        self.target_concurrency = target_concurrency

        # Response time tracking
        self.response_times: list[float] = []
        self.error_count = 0
        self.success_count = 0

        # Timing
        self.last_request_time: Optional[float] = None

        # Moving average alpha (for exponential moving average)
        self.alpha = 0.5  # Weight for new values

    def record_response(self, latency: float, is_error: bool = False):
        """
        Record a response and update statistics.

        Args:
            latency: Response time in seconds
            is_error: Whether the response was an error
        """
        self.response_times.append(latency)

        if is_error:
            self.error_count += 1
        else:
            self.success_count += 1

        # Keep only last 100 response times
        if len(self.response_times) > 100:
            self.response_times = self.response_times[-100:]

    def calculate_target_delay(self) -> Optional[float]:
        """
        Calculate target delay based on recent response times.

        Algorithm (Scrapy AutoThrottle):
        target_delay = response_latency / target_concurrency

        Returns:
            Target delay in seconds, or None if insufficient data
        """
        if not self.response_times:
            return None

        # Use median of recent response times (more robust than mean)
        sorted_times = sorted(self.response_times)
        median_latency = sorted_times[len(sorted_times) // 2]

        # Calculate target delay
        target_delay = median_latency / self.target_concurrency

        return target_delay

    def update_delay(self, max_delay: float, min_delay: float):
        """
        Update current delay using exponential moving average.

        Formula: current_delay = (current_delay + target_delay) / 2

        Args:
            max_delay: Maximum allowed delay
            min_delay: Minimum allowed delay
        """
        target_delay = self.calculate_target_delay()

        if target_delay is None:
            return  # No data yet

        # Exponential moving average
        new_delay = (self.current_delay + target_delay) / 2

        # Apply bounds
        new_delay = max(min_delay, min(max_delay, new_delay))

        # Log significant changes
        if abs(new_delay - self.current_delay) > 0.1:
            logger.info(
                f"Adjusted delay: {self.current_delay:.2f}s -> {new_delay:.2f}s "
                f"(median latency: {sorted(self.response_times)[len(self.response_times)//2]:.2f}s, "
                f"target concurrency: {self.target_concurrency})"
            )

        self.current_delay = new_delay

    def get_stats(self) -> dict:
        """Get statistics for this domain."""
        response_times_sorted = sorted(self.response_times) if self.response_times else []

        return {
            'current_delay': self.current_delay,
            'target_concurrency': self.target_concurrency,
            'response_count': len(self.response_times),
            'success_count': self.success_count,
            'error_count': self.error_count,
            'error_rate': (
                self.error_count / (self.success_count + self.error_count)
                if (self.success_count + self.error_count) > 0 else 0
            ),
            'median_latency': (
                response_times_sorted[len(response_times_sorted) // 2]
                if response_times_sorted else None
            ),
            'min_latency': response_times_sorted[0] if response_times_sorted else None,
            'max_latency': response_times_sorted[-1] if response_times_sorted else None,
        }


class AdaptiveThrottler:
    """
    Adaptive throttling manager for web crawling.

    Automatically adjusts per-domain crawl delays based on:
    - Server response times (latency)
    - Error rates
    - Target concurrency level

    Usage:
        throttler = AdaptiveThrottler(
            start_delay=1.0,
            max_delay=60.0,
            target_concurrency=2.0
        )

        # Before request
        domain = urlparse(url).netloc
        delay = throttler.get_delay(domain)
        await asyncio.sleep(delay)

        # After request
        throttler.record_response(domain, latency=response_time, is_error=False)
    """

    def __init__(
        self,
        start_delay: float = 1.0,
        max_delay: float = 60.0,
        min_delay: float = 0.1,
        target_concurrency: float = 2.0,
        enabled: bool = True
    ):
        """
        Initialize adaptive throttler.

        Args:
            start_delay: Initial delay for new domains (default: 1.0s)
            max_delay: Maximum delay cap (default: 60.0s)
            min_delay: Minimum delay floor (default: 0.1s)
            target_concurrency: Target concurrent requests per domain (default: 2.0)
                               Higher = more aggressive, Lower = more conservative
            enabled: Whether adaptive throttling is enabled (default: True)
        """
        self.start_delay = start_delay
        self.max_delay = max_delay
        self.min_delay = min_delay
        self.target_concurrency = target_concurrency
        self.enabled = enabled

        # Per-domain statistics
        self._domain_stats: dict[str, DomainStats] = {}

        # Global statistics
        self._total_requests = 0
        self._total_errors = 0

        logger.info(
            f"Initialized adaptive throttler: "
            f"start_delay={start_delay}s, max_delay={max_delay}s, "
            f"min_delay={min_delay}s, target_concurrency={target_concurrency}, "
            f"enabled={enabled}"
        )

    def _get_or_create_stats(self, domain: str) -> DomainStats:
        """Get or create statistics for domain."""
        if domain not in self._domain_stats:
            self._domain_stats[domain] = DomainStats(
                start_delay=self.start_delay,
                target_concurrency=self.target_concurrency
            )
            logger.debug(f"Created adaptive stats for {domain}")

        return self._domain_stats[domain]

    def get_delay(self, domain: str) -> float:
        """
        Get current delay for domain.

        Args:
            domain: Domain name (e.g., "docs.example.com")

        Returns:
            Delay in seconds to wait before next request
        """
        if not self.enabled:
            return 0.0

        stats = self._get_or_create_stats(domain)
        return stats.current_delay

    async def acquire(self, domain: str) -> float:
        """
        Acquire permission to make request (with adaptive delay).

        Args:
            domain: Domain name

        Returns:
            Delay that was applied in seconds
        """
        delay = self.get_delay(domain)

        if delay > 0:
            await asyncio.sleep(delay)

        return delay

    async def acquire_url(self, url: str) -> float:
        """
        Acquire permission for URL (extracts domain automatically).

        Args:
            url: Full URL

        Returns:
            Delay that was applied in seconds
        """
        domain = urlparse(url).netloc
        return await self.acquire(domain)

    def record_response(
        self,
        domain: str,
        latency: float,
        is_error: bool = False
    ):
        """
        Record a response and update adaptive delay.

        Args:
            domain: Domain name
            latency: Response time in seconds
            is_error: Whether the response was an error
        """
        if not self.enabled:
            return

        stats = self._get_or_create_stats(domain)

        # Record response
        stats.record_response(latency, is_error)

        # Update delay based on new data
        stats.update_delay(self.max_delay, self.min_delay)

        # Update global stats
        self._total_requests += 1
        if is_error:
            self._total_errors += 1

    def record_response_url(
        self,
        url: str,
        latency: float,
        is_error: bool = False
    ):
        """
        Record response for URL (extracts domain automatically).

        Args:
            url: Full URL
            latency: Response time in seconds
            is_error: Whether the response was an error
        """
        domain = urlparse(url).netloc
        self.record_response(domain, latency, is_error)

    def set_target_concurrency(self, domain: str, target: float):
        """
        Set custom target concurrency for specific domain.

        Args:
            domain: Domain name
            target: Target concurrency (e.g., 1.0 = conservative, 3.0 = aggressive)
        """
        stats = self._get_or_create_stats(domain)
        stats.target_concurrency = target
        logger.info(f"Set target concurrency for {domain}: {target}")

    def get_stats(self, domain: Optional[str] = None) -> dict:
        """
        Get adaptive throttling statistics.

        Args:
            domain: Optional domain to filter stats

        Returns:
            Dict with statistics
        """
        if domain:
            if domain not in self._domain_stats:
                return {
                    'domain': domain,
                    'tracked': False
                }

            stats = self._domain_stats[domain].get_stats()
            stats['domain'] = domain
            stats['tracked'] = True
            return stats

        # Global stats
        return {
            'enabled': self.enabled,
            'start_delay': self.start_delay,
            'max_delay': self.max_delay,
            'min_delay': self.min_delay,
            'target_concurrency': self.target_concurrency,
            'total_requests': self._total_requests,
            'total_errors': self._total_errors,
            'global_error_rate': (
                self._total_errors / self._total_requests
                if self._total_requests > 0 else 0
            ),
            'domains_tracked': len(self._domain_stats),
            'by_domain': {
                domain: stats.get_stats()
                for domain, stats in self._domain_stats.items()
            }
        }

    def reset_stats(self, domain: Optional[str] = None):
        """
        Reset statistics.

        Args:
            domain: Optional domain to reset, or None for all
        """
        if domain:
            if domain in self._domain_stats:
                del self._domain_stats[domain]
                logger.debug(f"Reset adaptive throttler stats for {domain}")
        else:
            self._domain_stats.clear()
            self._total_requests = 0
            self._total_errors = 0
            logger.debug("Reset all adaptive throttler stats")


# Global singleton instance
_global_adaptive_throttler: Optional[AdaptiveThrottler] = None


def get_global_adaptive_throttler() -> AdaptiveThrottler:
    """
    Get global AdaptiveThrottler instance (singleton pattern).

    Returns:
        Global AdaptiveThrottler instance
    """
    global _global_adaptive_throttler

    if _global_adaptive_throttler is None:
        _global_adaptive_throttler = AdaptiveThrottler()
        logger.info("Created global AdaptiveThrottler instance")

    return _global_adaptive_throttler
