"""
Async Rate Limiter with Per-Domain Token Bucket

Implements token bucket algorithm for rate limiting async web crawling.
Allows burst traffic while maintaining average rate per domain.

Token Bucket Algorithm:
- Tokens are added at a constant rate (refill_rate per second)
- Each request consumes 1 token
- If no tokens available, request waits until token is added
- Bucket has maximum capacity (allows burst if tokens accumulated)

Industry Standard Implementation based on:
- RFC 6585 (Rate Limiting)
- Common patterns from nginx, HAProxy, AWS API Gateway
"""
import asyncio
import time
from collections import defaultdict
from typing import Optional
from urllib.parse import urlparse

from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class TokenBucket:
    """
    Token bucket rate limiter for a single domain.

    Allows bursts of requests while maintaining average rate over time.
    """

    def __init__(self, capacity: int, refill_rate: float):
        """
        Initialize token bucket.

        Args:
            capacity: Maximum number of tokens (bucket size)
            refill_rate: Tokens added per second
        """
        self.capacity = capacity
        self.tokens = float(capacity)  # Start with full bucket
        self.refill_rate = refill_rate
        self.last_refill = time.time()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: int = 1) -> float:
        """
        Acquire tokens from the bucket, waiting if necessary.

        Args:
            tokens: Number of tokens to acquire (default: 1)

        Returns:
            Time waited in seconds (0 if no wait)
        """
        async with self._lock:
            wait_time = 0.0

            # Refill tokens based on elapsed time
            await self._refill()

            # If not enough tokens, wait until we have them
            while self.tokens < tokens:
                # Calculate how long to wait for needed tokens
                tokens_needed = tokens - self.tokens
                time_to_wait = tokens_needed / self.refill_rate

                # Wait and refill
                await asyncio.sleep(time_to_wait)
                wait_time += time_to_wait
                await self._refill()

            # Consume tokens
            self.tokens -= tokens

            return wait_time

    async def _refill(self):
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_refill

        # Add tokens based on elapsed time and refill rate
        tokens_to_add = elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)

        self.last_refill = now

    def get_available_tokens(self) -> float:
        """Get current available tokens (without locking)."""
        return self.tokens


class AsyncRateLimiter:
    """
    Async rate limiter with per-domain limits using token bucket algorithm.

    Usage:
        limiter = AsyncRateLimiter(default_rate=1.0)

        # Acquire permission before making request
        domain = urlparse(url).netloc
        await limiter.acquire(domain)

        # Make request
        response = await fetch(url)

        # Optional: Set custom rate for specific domain
        limiter.set_domain_rate("api.github.com", rate=0.5)  # 0.5 req/s
    """

    def __init__(
        self,
        default_rate: float = 1.0,
        burst_size: Optional[int] = None
    ):
        """
        Initialize async rate limiter.

        Args:
            default_rate: Default requests per second per domain
            burst_size: Maximum burst size (bucket capacity).
                       If None, defaults to rate * 2 (allows 2 seconds of burst)
        """
        self.default_rate = default_rate
        self.default_burst_size = burst_size or int(default_rate * 2)

        # Per-domain token buckets
        self._buckets: dict[str, TokenBucket] = {}
        self._custom_rates: dict[str, tuple[float, int]] = {}  # domain -> (rate, burst)

        # Statistics
        self._total_acquires = 0
        self._total_wait_time = 0.0
        self._domain_stats: dict[str, dict] = defaultdict(lambda: {
            'acquires': 0,
            'total_wait_time': 0.0,
            'last_acquire': None
        })

    def _get_or_create_bucket(self, domain: str) -> TokenBucket:
        """Get existing bucket or create new one for domain."""
        if domain not in self._buckets:
            # Check if custom rate is set for this domain
            if domain in self._custom_rates:
                rate, burst = self._custom_rates[domain]
            else:
                rate, burst = self.default_rate, self.default_burst_size

            self._buckets[domain] = TokenBucket(capacity=burst, refill_rate=rate)
            logger.debug(
                f"Created token bucket for {domain}: "
                f"rate={rate} req/s, burst={burst}"
            )

        return self._buckets[domain]

    async def acquire(self, domain: str, tokens: int = 1) -> float:
        """
        Acquire permission to make request to domain.

        This will wait if rate limit is reached.

        Args:
            domain: Domain name (e.g., "docs.example.com")
            tokens: Number of tokens to acquire (default: 1)

        Returns:
            Time waited in seconds
        """
        bucket = self._get_or_create_bucket(domain)
        wait_time = await bucket.acquire(tokens)

        # Update statistics
        self._total_acquires += 1
        self._total_wait_time += wait_time
        self._domain_stats[domain]['acquires'] += 1
        self._domain_stats[domain]['total_wait_time'] += wait_time
        self._domain_stats[domain]['last_acquire'] = time.time()

        if wait_time > 0:
            logger.debug(
                f"Rate limited {domain}: waited {wait_time:.2f}s "
                f"(rate: {bucket.refill_rate} req/s)"
            )

        return wait_time

    async def acquire_url(self, url: str, tokens: int = 1) -> float:
        """
        Acquire permission for URL (extracts domain automatically).

        Args:
            url: Full URL (e.g., "https://docs.example.com/page")
            tokens: Number of tokens to acquire

        Returns:
            Time waited in seconds
        """
        domain = urlparse(url).netloc
        return await self.acquire(domain, tokens)

    def set_domain_rate(
        self,
        domain: str,
        rate: float,
        burst_size: Optional[int] = None
    ):
        """
        Set custom rate limit for specific domain.

        Args:
            domain: Domain name (e.g., "api.github.com")
            rate: Requests per second
            burst_size: Maximum burst size (defaults to rate * 2)
        """
        burst = burst_size or int(rate * 2)
        self._custom_rates[domain] = (rate, burst)

        # If bucket already exists, replace it with new rate
        if domain in self._buckets:
            del self._buckets[domain]
            logger.info(
                f"Updated rate limit for {domain}: "
                f"{rate} req/s, burst={burst}"
            )

    def get_domain_rate(self, domain: str) -> tuple[float, int]:
        """
        Get rate limit for domain.

        Returns:
            Tuple of (rate_per_second, burst_size)
        """
        if domain in self._custom_rates:
            return self._custom_rates[domain]
        return self.default_rate, self.default_burst_size

    def get_stats(self, domain: Optional[str] = None) -> dict:
        """
        Get rate limiting statistics.

        Args:
            domain: Optional domain to filter stats

        Returns:
            Dict with statistics
        """
        if domain:
            stats = self._domain_stats.get(domain, {
                'acquires': 0,
                'total_wait_time': 0.0,
                'last_acquire': None
            })

            bucket = self._buckets.get(domain)
            rate, burst = self.get_domain_rate(domain)

            return {
                'domain': domain,
                'rate_limit': rate,
                'burst_size': burst,
                'acquires': stats['acquires'],
                'total_wait_time': stats['total_wait_time'],
                'avg_wait_time': (
                    stats['total_wait_time'] / stats['acquires']
                    if stats['acquires'] > 0 else 0
                ),
                'last_acquire': stats['last_acquire'],
                'available_tokens': bucket.get_available_tokens() if bucket else burst
            }

        # Return global stats
        return {
            'total_acquires': self._total_acquires,
            'total_wait_time': self._total_wait_time,
            'avg_wait_time': (
                self._total_wait_time / self._total_acquires
                if self._total_acquires > 0 else 0
            ),
            'domains_tracked': len(self._buckets),
            'custom_rates': len(self._custom_rates),
            'by_domain': {
                domain: {
                    'rate_limit': self.get_domain_rate(domain)[0],
                    'burst_size': self.get_domain_rate(domain)[1],
                    'acquires': stats['acquires'],
                    'total_wait_time': stats['total_wait_time'],
                    'avg_wait_time': (
                        stats['total_wait_time'] / stats['acquires']
                        if stats['acquires'] > 0 else 0
                    ),
                    'last_acquire': stats['last_acquire']
                }
                for domain, stats in self._domain_stats.items()
            }
        }

    def reset_stats(self):
        """Reset all statistics (useful for testing)."""
        self._total_acquires = 0
        self._total_wait_time = 0.0
        self._domain_stats.clear()
        logger.info("Rate limiter statistics reset")

    def clear_domain(self, domain: str):
        """
        Clear rate limit state for a domain.

        Useful for removing domains that are no longer being crawled.

        Args:
            domain: Domain to clear
        """
        if domain in self._buckets:
            del self._buckets[domain]
        if domain in self._custom_rates:
            del self._custom_rates[domain]
        if domain in self._domain_stats:
            del self._domain_stats[domain]

        logger.debug(f"Cleared rate limit state for {domain}")


class GlobalRateLimiter:
    """
    Singleton global rate limiter instance.

    Provides a shared rate limiter across all crawling operations.
    """

    _instance: Optional[AsyncRateLimiter] = None

    @classmethod
    def get_instance(
        cls,
        default_rate: float = 1.0,
        burst_size: Optional[int] = None
    ) -> AsyncRateLimiter:
        """
        Get or create global rate limiter instance.

        Args:
            default_rate: Default requests per second (used only on first call)
            burst_size: Maximum burst size (used only on first call)

        Returns:
            Global AsyncRateLimiter instance
        """
        if cls._instance is None:
            cls._instance = AsyncRateLimiter(default_rate, burst_size)
            logger.info(
                f"Created global rate limiter: "
                f"default_rate={default_rate} req/s, "
                f"burst_size={burst_size or int(default_rate * 2)}"
            )

        return cls._instance

    @classmethod
    def reset_instance(cls):
        """Reset global instance (useful for testing)."""
        cls._instance = None
