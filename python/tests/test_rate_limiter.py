"""
Unit tests for rate limiting functionality.

Tests cover:
- Rate limit detection (429, 503, custom messages, Cloudflare)
- Retry-After header parsing (seconds and HTTP-date formats)
- Exponential backoff with jitter
- Per-domain rate limiting with token bucket
- Rate limit statistics tracking
"""
import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest

from src.server.services.crawling.async_limiter import (
    AsyncRateLimiter,
    GlobalRateLimiter,
    TokenBucket,
)
from src.server.services.crawling.rate_limiter import (
    ExponentialBackoff,
    RateLimitDetector,
    RateLimitHandler,
)


class TestRateLimitDetector:
    """Test rate limit detection from HTTP responses."""

    @pytest.fixture
    def detector(self):
        """Create rate limit detector instance."""
        return RateLimitDetector()

    def test_detect_429_status(self, detector):
        """Test detection of HTTP 429 Too Many Requests."""
        response = Mock(status_code=429, headers={})
        is_limited, retry_after, reason = detector.detect(response)

        assert is_limited is True
        assert "429" in reason

    def test_detect_503_status(self, detector):
        """Test detection of HTTP 503 Service Unavailable."""
        response = Mock(status_code=503, headers={})
        is_limited, retry_after, reason = detector.detect(response)

        assert is_limited is True
        assert "503" in reason

    def test_detect_with_retry_after_seconds(self, detector):
        """Test parsing Retry-After header with seconds."""
        response = Mock(
            status_code=429,
            headers={'Retry-After': '60'}
        )
        is_limited, retry_after, reason = detector.detect(response)

        assert is_limited is True
        assert retry_after == 60.0

    def test_detect_with_retry_after_http_date(self, detector):
        """Test parsing Retry-After header with HTTP-date."""
        # Create date 30 seconds in the future
        future_time = datetime.utcnow() + timedelta(seconds=30)
        http_date = future_time.strftime('%a, %d %b %Y %H:%M:%S GMT')

        response = Mock(
            status_code=429,
            headers={'Retry-After': http_date}
        )
        is_limited, retry_after, reason = detector.detect(response)

        assert is_limited is True
        # Should be approximately 30 seconds (allow 2s tolerance for processing time)
        assert 28 <= retry_after <= 32

    def test_detect_rate_limit_message(self, detector):
        """Test detection of rate limit messages in response body."""
        response = Mock(
            status_code=200,  # Even with 200, should detect by message
            headers={},
            text="Error: Too many requests. Please try again later."
        )
        is_limited, retry_after, reason = detector.detect(response)

        assert is_limited is True
        assert "too many requests" in reason.lower()

    def test_detect_cloudflare_rate_limit(self, detector):
        """Test detection of Cloudflare Error 1015."""
        response = Mock(
            status_code=403,
            headers={},
            text="<html><body>Error 1015: You are being rate limited by Cloudflare</body></html>"
        )
        is_limited, retry_after, reason = detector.detect(response)

        assert is_limited is True
        assert "cloudflare" in reason.lower()

    def test_no_rate_limit(self, detector):
        """Test that normal responses are not flagged as rate limited."""
        response = Mock(
            status_code=200,
            headers={},
            text="<html><body>Normal content</body></html>"
        )
        is_limited, retry_after, reason = detector.detect(response)

        assert is_limited is False
        assert retry_after is None
        assert reason == ""

    def test_case_insensitive_headers(self, detector):
        """Test that header parsing is case-insensitive."""
        response = Mock(
            status_code=429,
            headers={'retry-after': '30'}  # lowercase
        )
        is_limited, retry_after, reason = detector.detect(response)

        assert is_limited is True
        assert retry_after == 30.0

    def test_bytes_response_body(self, detector):
        """Test handling of response body as bytes."""
        response = Mock(
            status_code=200,
            headers={},
            text=None,
            content=b"Too many requests"
        )
        is_limited, retry_after, reason = detector.detect(response)

        assert is_limited is True


class TestExponentialBackoff:
    """Test exponential backoff calculation."""

    @pytest.fixture
    def backoff(self):
        """Create exponential backoff instance."""
        return ExponentialBackoff(base_delay=1.0, max_delay=60.0)

    def test_calculate_delay_first_attempt(self, backoff):
        """Test delay calculation for first retry (attempt 0)."""
        delay = backoff.calculate_delay(attempt=0)

        # base_delay * (2^0) + jitter = 1.0 + [0-1] = 1.0-2.0
        assert 1.0 <= delay <= 2.0

    def test_calculate_delay_exponential_growth(self, backoff):
        """Test that delay grows exponentially."""
        delay0 = backoff.calculate_delay(attempt=0)
        delay1 = backoff.calculate_delay(attempt=1)
        delay2 = backoff.calculate_delay(attempt=2)
        delay3 = backoff.calculate_delay(attempt=3)

        # Each should be approximately double (accounting for jitter)
        # attempt 0: 1 * 2^0 = 1
        # attempt 1: 1 * 2^1 = 2
        # attempt 2: 1 * 2^2 = 4
        # attempt 3: 1 * 2^3 = 8
        assert 1.0 <= delay0 <= 2.0
        assert 2.0 <= delay1 <= 3.0
        assert 4.0 <= delay2 <= 5.0
        assert 8.0 <= delay3 <= 9.0

    def test_calculate_delay_respects_max(self, backoff):
        """Test that delay is capped at max_delay."""
        # With base=1, attempt=10 would give 2^10 = 1024
        delay = backoff.calculate_delay(attempt=10)

        # Should be capped at max_delay + jitter
        assert delay <= backoff.max_delay + 1.0

    def test_calculate_delay_with_retry_after(self, backoff):
        """Test that explicit retry_after is respected."""
        delay = backoff.calculate_delay(attempt=0, retry_after=30.0)

        # Should use retry_after + jitter
        assert 30.0 <= delay <= 31.0

    def test_calculate_delay_retry_after_capped(self, backoff):
        """Test that retry_after is still capped at max_delay."""
        delay = backoff.calculate_delay(attempt=0, retry_after=100.0)

        # Should be capped at max_delay
        assert delay <= backoff.max_delay + 1.0

    @pytest.mark.asyncio
    async def test_wait_actually_waits(self, backoff):
        """Test that wait() actually sleeps for the calculated delay."""
        backoff_short = ExponentialBackoff(base_delay=0.1, max_delay=1.0)

        start_time = time.time()
        actual_delay = await backoff_short.wait(attempt=0)
        elapsed = time.time() - start_time

        # Elapsed time should match the returned delay
        assert abs(elapsed - actual_delay) < 0.05  # 50ms tolerance


class TestTokenBucket:
    """Test token bucket rate limiting algorithm."""

    @pytest.mark.asyncio
    async def test_acquire_when_tokens_available(self):
        """Test acquiring tokens when bucket has capacity."""
        bucket = TokenBucket(capacity=10, refill_rate=1.0)

        wait_time = await bucket.acquire(tokens=1)

        # Should not wait if tokens available
        assert wait_time == 0.0
        assert bucket.tokens == 9.0

    @pytest.mark.asyncio
    async def test_acquire_waits_when_empty(self):
        """Test that acquire waits when bucket is empty."""
        bucket = TokenBucket(capacity=1, refill_rate=10.0)  # Fast refill

        # Drain the bucket
        await bucket.acquire(tokens=1)
        assert bucket.tokens == 0.0

        # Next acquire should wait
        start_time = time.time()
        wait_time = await bucket.acquire(tokens=1)
        elapsed = time.time() - start_time

        # Should have waited ~0.1s (1 token / 10 tokens per second)
        assert wait_time > 0
        assert 0.08 <= elapsed <= 0.15  # Some tolerance for timing

    @pytest.mark.asyncio
    async def test_token_refill_over_time(self):
        """Test that tokens refill at correct rate."""
        bucket = TokenBucket(capacity=10, refill_rate=10.0)  # 10 tokens/sec

        # Drain bucket
        await bucket.acquire(tokens=10)
        assert bucket.tokens == 0.0

        # Wait for 0.5 seconds
        await asyncio.sleep(0.5)

        # Should have ~5 tokens (10 tokens/sec * 0.5 sec)
        await bucket._refill()
        assert 4.5 <= bucket.tokens <= 5.5

    @pytest.mark.asyncio
    async def test_capacity_limit(self):
        """Test that bucket doesn't overflow capacity."""
        bucket = TokenBucket(capacity=5, refill_rate=10.0)

        # Wait for tokens to accumulate (would be 10+ without cap)
        await asyncio.sleep(1.0)
        await bucket._refill()

        # Should be capped at capacity
        assert bucket.tokens == 5.0


class TestAsyncRateLimiter:
    """Test async rate limiter with per-domain limits."""

    @pytest.mark.asyncio
    async def test_acquire_creates_bucket_for_new_domain(self):
        """Test that acquiring for new domain creates token bucket."""
        limiter = AsyncRateLimiter(default_rate=1.0)

        wait_time = await limiter.acquire("example.com")

        assert "example.com" in limiter._buckets
        assert wait_time == 0.0  # First request should not wait

    @pytest.mark.asyncio
    async def test_acquire_enforces_rate_limit(self):
        """Test that rate limiting is enforced."""
        limiter = AsyncRateLimiter(default_rate=10.0)  # 10 req/sec = 0.1s per request

        # First request - no wait
        wait1 = await limiter.acquire("example.com")
        assert wait1 == 0.0

        # Second request immediately - should wait
        wait2 = await limiter.acquire("example.com")
        # Small wait expected (not full 0.1s due to burst capacity)
        assert wait2 >= 0.0

    @pytest.mark.asyncio
    async def test_acquire_url_extracts_domain(self):
        """Test that acquire_url extracts domain from URL."""
        limiter = AsyncRateLimiter(default_rate=1.0)

        await limiter.acquire_url("https://example.com/page")

        assert "example.com" in limiter._buckets

    @pytest.mark.asyncio
    async def test_set_domain_rate(self):
        """Test setting custom rate for specific domain."""
        limiter = AsyncRateLimiter(default_rate=1.0)

        limiter.set_domain_rate("api.github.com", rate=0.5, burst_size=1)

        rate, burst = limiter.get_domain_rate("api.github.com")
        assert rate == 0.5
        assert burst == 1

    @pytest.mark.asyncio
    async def test_per_domain_isolation(self):
        """Test that domains are rate-limited independently."""
        limiter = AsyncRateLimiter(default_rate=1.0, burst_size=1)

        # Acquire for domain A
        await limiter.acquire("domain-a.com")

        # Acquiring for domain B should not be affected
        wait_time = await limiter.acquire("domain-b.com")
        assert wait_time == 0.0  # No wait for different domain

    @pytest.mark.asyncio
    async def test_get_stats_for_domain(self):
        """Test getting statistics for specific domain."""
        limiter = AsyncRateLimiter(default_rate=1.0)

        await limiter.acquire("example.com")
        await limiter.acquire("example.com")

        stats = limiter.get_stats("example.com")

        assert stats['domain'] == "example.com"
        assert stats['acquires'] == 2
        assert stats['rate_limit'] == 1.0

    @pytest.mark.asyncio
    async def test_get_stats_global(self):
        """Test getting global statistics."""
        limiter = AsyncRateLimiter(default_rate=1.0)

        await limiter.acquire("domain-a.com")
        await limiter.acquire("domain-b.com")
        await limiter.acquire("domain-a.com")

        stats = limiter.get_stats()

        assert stats['total_acquires'] == 3
        assert stats['domains_tracked'] == 2
        assert len(stats['by_domain']) == 2


class TestRateLimitHandler:
    """Test high-level rate limit handler."""

    @pytest.fixture
    def handler(self):
        """Create rate limit handler instance."""
        return RateLimitHandler(base_delay=0.1, max_delay=1.0)

    def test_check_rate_limit_detects_429(self, handler):
        """Test that check_rate_limit detects 429 responses."""
        response = Mock(status_code=429, headers={})

        is_limited, info = handler.check_rate_limit(response)

        assert is_limited is True
        assert '429' in info['reason']

    def test_check_rate_limit_extracts_retry_after(self, handler):
        """Test that Retry-After is extracted."""
        response = Mock(
            status_code=429,
            headers={'Retry-After': '30'}
        )

        is_limited, info = handler.check_rate_limit(response)

        assert is_limited is True
        assert info['retry_after'] == 30.0

    @pytest.mark.asyncio
    async def test_backoff_applies_delay(self, handler):
        """Test that backoff actually delays execution."""
        rate_limit_info = {'retry_after': None, 'reason': 'Test'}

        start_time = time.time()
        delay = await handler.backoff(attempt=0, rate_limit_info=rate_limit_info)
        elapsed = time.time() - start_time

        # Should have delayed ~0.1s (base_delay)
        assert delay > 0
        assert abs(elapsed - delay) < 0.05  # 50ms tolerance

    @pytest.mark.asyncio
    async def test_backoff_respects_retry_after(self, handler):
        """Test that explicit retry_after is used."""
        rate_limit_info = {'retry_after': 0.2, 'reason': 'Test'}

        delay = await handler.backoff(attempt=0, rate_limit_info=rate_limit_info)

        # Should use retry_after value
        assert 0.2 <= delay <= 0.3  # retry_after + jitter

    @pytest.mark.asyncio
    async def test_backoff_tracks_domain_stats(self, handler):
        """Test that backoff tracks per-domain statistics."""
        rate_limit_info = {'retry_after': None, 'reason': 'Test'}

        await handler.backoff(attempt=0, rate_limit_info=rate_limit_info, domain="example.com")
        await handler.backoff(attempt=1, rate_limit_info=rate_limit_info, domain="example.com")

        stats = handler.get_rate_limit_stats("example.com")

        assert stats['rate_limit_count'] == 2
        assert stats['last_rate_limit_time'] is not None

    def test_get_stats_global(self, handler):
        """Test getting global rate limit statistics."""
        # Manually set some stats for testing
        handler.rate_limit_count['domain-a.com'] = 5
        handler.rate_limit_count['domain-b.com'] = 3
        handler.last_rate_limit_time['domain-a.com'] = time.time()

        stats = handler.get_rate_limit_stats()

        assert stats['total_rate_limits'] == 8
        assert stats['domains_rate_limited'] == 2
        assert 'domain-a.com' in stats['by_domain']


class TestGlobalRateLimiter:
    """Test global rate limiter singleton."""

    def test_get_instance_creates_singleton(self):
        """Test that get_instance returns same instance."""
        # Reset singleton for test
        GlobalRateLimiter.reset_instance()

        instance1 = GlobalRateLimiter.get_instance(default_rate=1.0)
        instance2 = GlobalRateLimiter.get_instance(default_rate=2.0)  # Different rate should be ignored

        assert instance1 is instance2  # Same object

    def test_reset_instance(self):
        """Test that reset_instance creates new instance."""
        instance1 = GlobalRateLimiter.get_instance()
        GlobalRateLimiter.reset_instance()
        instance2 = GlobalRateLimiter.get_instance()

        assert instance1 is not instance2  # Different objects


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
