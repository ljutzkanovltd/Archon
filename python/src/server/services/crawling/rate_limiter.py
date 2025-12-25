"""
Rate Limiting Detection and Backoff Handler

Provides industry-standard rate limiting detection, exponential backoff with jitter,
and Retry-After header compliance for web crawling.

Industry Standards Implemented:
- RFC 7231 (HTTP/1.1 Semantics) - Retry-After header
- Exponential backoff with jitter (AWS/Google Cloud standard)
- Detection of common rate limit patterns (429, 503, custom messages)
"""
import asyncio
import random
import time
from datetime import datetime
from typing import Any, Optional

from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class RateLimitDetector:
    """Detects rate limiting from HTTP responses."""

    # Common rate limit phrases in response bodies
    RATE_LIMIT_PHRASES = [
        'too many requests',
        'rate limit',
        'retry after',
        'slow down',
        'throttled',
        'please try again',
        'temporarily blocked',
        'request limit exceeded',
        'quota exceeded',
        'you are being rate limited'
    ]

    def detect(self, response: Any) -> tuple[bool, Optional[float], str]:
        """
        Detect if response indicates rate limiting.

        Args:
            response: HTTP response object (from crawl4ai or requests)

        Returns:
            Tuple of (is_rate_limited: bool, retry_after_seconds: Optional[float], reason: str)
        """
        # Check HTTP status codes
        status_code = getattr(response, 'status_code', None) or getattr(response, 'status', 0)

        # 429 Too Many Requests (RFC 6585)
        if status_code == 429:
            retry_after = self._parse_retry_after_header(response)
            return True, retry_after, "HTTP 429 Too Many Requests"

        # 503 Service Unavailable (often used for rate limiting)
        if status_code == 503:
            retry_after = self._parse_retry_after_header(response)
            return True, retry_after, "HTTP 503 Service Unavailable"

        # 403 Forbidden (sometimes used by Cloudflare/CDNs for rate limiting)
        if status_code == 403:
            # Check if this is a Cloudflare rate limit
            if self._is_cloudflare_rate_limit(response):
                return True, None, "Cloudflare Rate Limit (Error 1015)"

        # Check response body for rate limit messages
        body_text = self._get_response_body(response)
        if body_text:
            body_lower = body_text.lower()
            for phrase in self.RATE_LIMIT_PHRASES:
                if phrase in body_lower:
                    return True, None, f"Rate limit message detected: '{phrase}'"

        return False, None, ""

    def _parse_retry_after_header(self, response: Any) -> Optional[float]:
        """
        Parse Retry-After header from response.

        Retry-After can be either:
        1. Delay-seconds (integer): number of seconds to wait
        2. HTTP-date: absolute time when to retry

        Returns:
            Number of seconds to wait, or None if header not present/parseable
        """
        headers = self._get_headers(response)
        if not headers:
            return None

        # Header names are case-insensitive in HTTP
        retry_after = headers.get('Retry-After') or headers.get('retry-after')
        if not retry_after:
            return None

        # Try parsing as delay-seconds (integer)
        try:
            return float(retry_after)
        except ValueError:
            pass

        # Try parsing as HTTP-date (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")
        try:
            retry_date = datetime.strptime(retry_after, '%a, %d %b %Y %H:%M:%S GMT')
            delta = retry_date - datetime.utcnow()
            return max(0, delta.total_seconds())
        except ValueError:
            logger.warning(f"Could not parse Retry-After header: {retry_after}")
            return None

    def _get_headers(self, response: Any) -> dict:
        """Extract headers from response object."""
        # Try different attribute names for headers
        headers = getattr(response, 'headers', None)
        if headers is None:
            headers = getattr(response, 'response_headers', {})

        # Convert to dict if needed (some libraries use special header objects)
        if hasattr(headers, 'items'):
            return dict(headers.items())
        return headers if isinstance(headers, dict) else {}

    def _get_response_body(self, response: Any) -> Optional[str]:
        """Extract response body text."""
        # Try different attribute names for body content
        body = getattr(response, 'text', None)
        if body is None:
            body = getattr(response, 'content', None)
        if body is None:
            body = getattr(response, 'html', None)

        # Convert bytes to string if needed
        if isinstance(body, bytes):
            try:
                return body.decode('utf-8')
            except UnicodeDecodeError:
                return body.decode('latin-1', errors='ignore')

        return str(body) if body else None

    def _is_cloudflare_rate_limit(self, response: Any) -> bool:
        """Check if this is a Cloudflare rate limit (Error 1015)."""
        body = self._get_response_body(response)
        if not body:
            return False

        body_lower = body.lower()
        # Cloudflare Error 1015: You are being rate limited
        cloudflare_indicators = [
            'cloudflare',
            'error 1015',
            'rate limit',
            'cf-ray'  # Cloudflare Ray ID header
        ]

        # Need at least 'cloudflare' + 'rate limit' or 'error 1015'
        has_cloudflare = 'cloudflare' in body_lower
        has_rate_limit_indicator = any(
            indicator in body_lower
            for indicator in ['error 1015', 'rate limit', 'rate-limit']
        )

        return has_cloudflare and has_rate_limit_indicator


class ExponentialBackoff:
    """
    Implements exponential backoff with jitter.

    Algorithm: delay = min(base_delay * (2 ^ attempt) + jitter, max_delay)

    Based on AWS and Google Cloud best practices:
    - https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
    - https://cloud.google.com/iot/docs/how-tos/exponential-backoff
    """

    def __init__(
        self,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        jitter_range: tuple[float, float] = (0.0, 1.0)
    ):
        """
        Initialize exponential backoff calculator.

        Args:
            base_delay: Base delay in seconds (default: 1.0)
            max_delay: Maximum delay cap in seconds (default: 60.0)
            jitter_range: Random jitter range in seconds as (min, max) (default: 0-1s)
        """
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter_min, self.jitter_max = jitter_range

    def calculate_delay(self, attempt: int, retry_after: Optional[float] = None) -> float:
        """
        Calculate delay for given attempt number.

        Args:
            attempt: Current attempt number (0-indexed)
            retry_after: Explicit retry delay from server (overrides calculation)

        Returns:
            Delay in seconds to wait before next attempt
        """
        # If server provided explicit Retry-After, respect it
        if retry_after is not None:
            # Still add jitter and cap to max_delay
            jitter = random.uniform(self.jitter_min, self.jitter_max)
            return min(retry_after + jitter, self.max_delay)

        # Calculate exponential backoff: base_delay * (2 ^ attempt)
        delay = self.base_delay * (2 ** attempt)

        # Add random jitter to prevent thundering herd problem
        jitter = random.uniform(self.jitter_min, self.jitter_max)
        delay += jitter

        # Cap to max_delay
        delay = min(delay, self.max_delay)

        return delay

    async def wait(self, attempt: int, retry_after: Optional[float] = None) -> float:
        """
        Calculate delay and wait asynchronously.

        Args:
            attempt: Current attempt number (0-indexed)
            retry_after: Explicit retry delay from server

        Returns:
            Actual delay that was waited (for logging)
        """
        delay = self.calculate_delay(attempt, retry_after)
        await asyncio.sleep(delay)
        return delay


class RateLimitHandler:
    """
    High-level rate limiting handler combining detection and backoff.

    Usage:
        handler = RateLimitHandler()

        for attempt in range(max_retries):
            response = await fetch_url(url)

            is_limited, retry_info = handler.check_rate_limit(response)
            if is_limited and attempt < max_retries - 1:
                await handler.backoff(attempt, retry_info)
                continue
    """

    def __init__(
        self,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        jitter_range: tuple[float, float] = (0.0, 1.0)
    ):
        """
        Initialize rate limit handler.

        Args:
            base_delay: Base delay for exponential backoff (default: 1.0s)
            max_delay: Maximum delay cap (default: 60.0s)
            jitter_range: Random jitter range (default: 0-1s)
        """
        self.detector = RateLimitDetector()
        self.backoff_calculator = ExponentialBackoff(base_delay, max_delay, jitter_range)

        # Track rate limit occurrences per domain (in-memory)
        self.rate_limit_count: dict[str, int] = {}
        self.last_rate_limit_time: dict[str, float] = {}

    def check_rate_limit(self, response: Any) -> tuple[bool, dict]:
        """
        Check if response indicates rate limiting.

        Args:
            response: HTTP response object

        Returns:
            Tuple of (is_rate_limited: bool, rate_limit_info: dict)

            rate_limit_info contains:
            - retry_after: Optional[float] - Seconds to wait
            - reason: str - Why rate limit was detected
        """
        is_limited, retry_after, reason = self.detector.detect(response)

        return is_limited, {
            'retry_after': retry_after,
            'reason': reason
        }

    async def backoff(
        self,
        attempt: int,
        rate_limit_info: dict,
        domain: Optional[str] = None
    ) -> float:
        """
        Apply exponential backoff with jitter.

        Args:
            attempt: Current attempt number (0-indexed)
            rate_limit_info: Info from check_rate_limit()
            domain: Optional domain for tracking (e.g., "docs.example.com")

        Returns:
            Actual delay that was applied (for logging)
        """
        retry_after = rate_limit_info.get('retry_after')
        reason = rate_limit_info.get('reason', 'Unknown')

        # Track rate limit occurrence
        if domain:
            self.rate_limit_count[domain] = self.rate_limit_count.get(domain, 0) + 1
            self.last_rate_limit_time[domain] = time.time()

        # Calculate and apply backoff
        delay = await self.backoff_calculator.wait(attempt, retry_after)

        # Log the backoff
        logger.warning(
            f"Rate limit detected ({reason}). "
            f"Backing off for {delay:.2f}s (attempt {attempt + 1})"
            f"{f' for domain {domain}' if domain else ''}"
        )

        return delay

    def get_rate_limit_stats(self, domain: Optional[str] = None) -> dict:
        """
        Get rate limit statistics.

        Args:
            domain: Optional domain to filter stats

        Returns:
            Dict with rate limit statistics
        """
        if domain:
            return {
                'domain': domain,
                'rate_limit_count': self.rate_limit_count.get(domain, 0),
                'last_rate_limit_time': self.last_rate_limit_time.get(domain),
                'last_rate_limit_ago_seconds': (
                    time.time() - self.last_rate_limit_time[domain]
                    if domain in self.last_rate_limit_time else None
                )
            }

        # Return all stats
        return {
            'total_rate_limits': sum(self.rate_limit_count.values()),
            'domains_rate_limited': len(self.rate_limit_count),
            'by_domain': {
                domain: {
                    'count': count,
                    'last_time': self.last_rate_limit_time.get(domain),
                    'last_ago_seconds': (
                        time.time() - self.last_rate_limit_time[domain]
                        if domain in self.last_rate_limit_time else None
                    )
                }
                for domain, count in self.rate_limit_count.items()
            }
        }
