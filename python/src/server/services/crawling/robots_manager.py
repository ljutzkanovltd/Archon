"""
robots.txt Manager with Crawl-Delay Support

Handles parsing, caching, and enforcement of robots.txt directives,
including the Crawl-Delay directive for polite crawling.

Standards Implemented:
- RFC 9309 (Robots Exclusion Protocol)
- Crawl-Delay directive (supported by Bing, Yandex, others)
- User-agent specific rules
- In-memory caching with TTL
"""
import time
from typing import Optional
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests

from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class RobotsCache:
    """
    In-memory cache for parsed robots.txt files with TTL.

    Caches parsed robots.txt to avoid repeated fetching.
    """

    def __init__(self, ttl_seconds: int = 86400):
        """
        Initialize robots.txt cache.

        Args:
            ttl_seconds: Time-to-live for cached entries in seconds (default: 24 hours)
        """
        self.ttl_seconds = ttl_seconds
        self._cache: dict[str, tuple[RobotFileParser, float]] = {}

    def get(self, domain: str) -> Optional[RobotFileParser]:
        """
        Get cached robots.txt parser for domain.

        Args:
            domain: Domain name (e.g., "docs.example.com")

        Returns:
            RobotFileParser if cached and not expired, None otherwise
        """
        if domain not in self._cache:
            return None

        parser, timestamp = self._cache[domain]
        age = time.time() - timestamp

        if age > self.ttl_seconds:
            # Expired, remove from cache
            del self._cache[domain]
            logger.debug(f"robots.txt cache expired for {domain}")
            return None

        logger.debug(f"robots.txt cache hit for {domain} (age: {age:.1f}s)")
        return parser

    def set(self, domain: str, parser: RobotFileParser):
        """
        Store robots.txt parser in cache.

        Args:
            domain: Domain name
            parser: Parsed RobotFileParser instance
        """
        self._cache[domain] = (parser, time.time())
        logger.debug(f"Cached robots.txt for {domain}")

    def clear(self, domain: Optional[str] = None):
        """
        Clear cache for specific domain or all domains.

        Args:
            domain: Domain to clear, or None to clear all
        """
        if domain:
            if domain in self._cache:
                del self._cache[domain]
                logger.debug(f"Cleared robots.txt cache for {domain}")
        else:
            self._cache.clear()
            logger.debug("Cleared all robots.txt cache")

    def get_stats(self) -> dict:
        """Get cache statistics."""
        current_time = time.time()
        valid_count = sum(
            1 for (_, timestamp) in self._cache.values()
            if current_time - timestamp <= self.ttl_seconds
        )

        return {
            'total_entries': len(self._cache),
            'valid_entries': valid_count,
            'expired_entries': len(self._cache) - valid_count,
            'ttl_seconds': self.ttl_seconds
        }


class RobotsManager:
    """
    Manages robots.txt parsing, caching, and enforcement.

    Handles:
    - Fetching and parsing robots.txt
    - Checking if URLs are allowed for crawling
    - Extracting and enforcing Crawl-Delay directive
    - Caching parsed robots.txt with TTL
    """

    def __init__(
        self,
        user_agent: str = "ArchonBot/1.0",
        cache_ttl: int = 86400,
        timeout: int = 10
    ):
        """
        Initialize robots.txt manager.

        Args:
            user_agent: User-agent string to use (default: "ArchonBot/1.0")
            cache_ttl: Cache TTL in seconds (default: 24 hours)
            timeout: Request timeout in seconds (default: 10)
        """
        self.user_agent = user_agent
        self.timeout = timeout
        self.cache = RobotsCache(ttl_seconds=cache_ttl)

        # Track fetch failures to avoid repeated attempts
        self._fetch_failures: dict[str, float] = {}
        self._failure_retry_delay = 3600  # Retry failed fetches after 1 hour

    def _get_robots_url(self, url: str) -> str:
        """
        Get robots.txt URL for given URL.

        Args:
            url: Any URL on the site

        Returns:
            URL of robots.txt file (e.g., "https://example.com/robots.txt")
        """
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        return robots_url

    def _should_retry_fetch(self, domain: str) -> bool:
        """Check if we should retry fetching robots.txt after previous failure."""
        if domain not in self._fetch_failures:
            return True

        last_failure_time = self._fetch_failures[domain]
        time_since_failure = time.time() - last_failure_time

        return time_since_failure >= self._failure_retry_delay

    def _fetch_and_parse(self, url: str) -> Optional[RobotFileParser]:
        """
        Fetch and parse robots.txt for URL.

        Args:
            url: URL to get robots.txt for

        Returns:
            RobotFileParser instance, or None if fetch fails
        """
        robots_url = self._get_robots_url(url)
        domain = urlparse(url).netloc

        # Check if we should retry after previous failure
        if not self._should_retry_fetch(domain):
            logger.debug(
                f"Skipping robots.txt fetch for {domain} "
                f"(retry delay not elapsed)"
            )
            return None

        try:
            logger.info(f"Fetching robots.txt from {robots_url}")

            response = requests.get(
                robots_url,
                timeout=self.timeout,
                headers={'User-Agent': self.user_agent}
            )

            # Handle different status codes
            if response.status_code == 404:
                # No robots.txt - allow all
                logger.info(f"No robots.txt found for {domain} (404)")
                parser = RobotFileParser()
                parser.parse([])  # Empty rules = allow all
                return parser

            if response.status_code != 200:
                logger.warning(
                    f"Failed to fetch robots.txt from {robots_url}: "
                    f"HTTP {response.status_code}"
                )
                self._fetch_failures[domain] = time.time()
                return None

            # Parse robots.txt
            parser = RobotFileParser()
            parser.parse(response.text.splitlines())

            # Clear failure record on success
            if domain in self._fetch_failures:
                del self._fetch_failures[domain]

            return parser

        except requests.exceptions.Timeout:
            logger.warning(f"Timeout fetching robots.txt from {robots_url}")
            self._fetch_failures[domain] = time.time()
            return None

        except requests.exceptions.RequestException as e:
            logger.warning(f"Error fetching robots.txt from {robots_url}: {e}")
            self._fetch_failures[domain] = time.time()
            return None

        except Exception as e:
            logger.error(f"Unexpected error fetching robots.txt from {robots_url}: {e}")
            self._fetch_failures[domain] = time.time()
            return None

    def _get_parser(self, url: str, use_cache: bool = True) -> Optional[RobotFileParser]:
        """
        Get robots.txt parser for URL (from cache or by fetching).

        Args:
            url: URL to get parser for
            use_cache: Whether to use cached parser (default: True)

        Returns:
            RobotFileParser instance, or None if unavailable
        """
        domain = urlparse(url).netloc

        # Try cache first
        if use_cache:
            cached_parser = self.cache.get(domain)
            if cached_parser is not None:
                return cached_parser

        # Fetch and parse
        parser = self._fetch_and_parse(url)

        # Cache if successful
        if parser is not None:
            self.cache.set(domain, parser)

        return parser

    def is_allowed(self, url: str, use_cache: bool = True) -> bool:
        """
        Check if URL is allowed to be crawled according to robots.txt.

        Args:
            url: URL to check
            use_cache: Whether to use cached robots.txt (default: True)

        Returns:
            True if allowed, False if disallowed
            Returns True if robots.txt is unavailable (fail-open)
        """
        parser = self._get_parser(url, use_cache=use_cache)

        if parser is None:
            # Fail-open: allow crawling if robots.txt is unavailable
            logger.debug(f"robots.txt unavailable for {url}, allowing by default")
            return True

        is_allowed = parser.can_fetch(self.user_agent, url)

        if not is_allowed:
            logger.info(f"URL disallowed by robots.txt: {url}")

        return is_allowed

    def get_crawl_delay(self, url: str, use_cache: bool = True) -> Optional[float]:
        """
        Get Crawl-Delay directive from robots.txt.

        The Crawl-Delay directive specifies minimum delay in seconds between
        successive requests to the same server.

        Note: Crawl-Delay is supported by Bing, Yandex, and others, but NOT
        by Googlebot (Google uses Search Console for rate configuration).

        Args:
            url: URL to get crawl delay for
            use_cache: Whether to use cached robots.txt (default: True)

        Returns:
            Delay in seconds, or None if no Crawl-Delay directive
        """
        parser = self._get_parser(url, use_cache=use_cache)

        if parser is None:
            return None

        # RobotFileParser has request_rate() method for Crawl-Delay
        try:
            # request_rate() returns RequestRate object or None
            rate = parser.request_rate(self.user_agent)

            if rate is None:
                return None

            # RequestRate has requests (number) and seconds (time window)
            # Crawl-Delay = seconds / requests
            if rate.requests > 0:
                crawl_delay = rate.seconds / rate.requests
                logger.info(
                    f"Crawl-Delay for {urlparse(url).netloc}: {crawl_delay}s "
                    f"({rate.requests} requests per {rate.seconds}s)"
                )
                return crawl_delay

        except AttributeError:
            # Fallback: manually parse Crawl-Delay from robots.txt
            # This handles older Python versions or non-standard formats
            return self._parse_crawl_delay_manually(url, parser)

        return None

    def _parse_crawl_delay_manually(
        self,
        url: str,
        parser: RobotFileParser
    ) -> Optional[float]:
        """
        Manually parse Crawl-Delay directive (fallback method).

        Args:
            url: URL being checked
            parser: RobotFileParser instance

        Returns:
            Crawl delay in seconds, or None
        """
        # Re-fetch robots.txt content to parse manually
        robots_url = self._get_robots_url(url)

        try:
            response = requests.get(robots_url, timeout=self.timeout)
            if response.status_code != 200:
                return None

            # Parse Crawl-Delay directive
            # Format: Crawl-delay: <seconds>
            for line in response.text.splitlines():
                line = line.strip().lower()

                # Check if this line is for our user-agent or wildcard
                if line.startswith('user-agent:'):
                    current_ua = line.split(':', 1)[1].strip()
                    # Simple matching: exact match or wildcard
                    if current_ua not in ['*', self.user_agent.lower()]:
                        continue

                # Check for Crawl-delay directive
                if line.startswith('crawl-delay:'):
                    delay_str = line.split(':', 1)[1].strip()
                    try:
                        delay = float(delay_str)
                        logger.info(
                            f"Parsed Crawl-Delay for {urlparse(url).netloc}: {delay}s"
                        )
                        return delay
                    except ValueError:
                        logger.warning(f"Invalid Crawl-Delay value: {delay_str}")

        except Exception as e:
            logger.warning(f"Error parsing Crawl-Delay manually: {e}")

        return None

    def get_stats(self) -> dict:
        """
        Get statistics about robots.txt manager.

        Returns:
            Dict with statistics
        """
        return {
            'user_agent': self.user_agent,
            'cache': self.cache.get_stats(),
            'fetch_failures': len(self._fetch_failures),
            'failure_retry_delay_seconds': self._failure_retry_delay
        }

    def clear_cache(self, domain: Optional[str] = None):
        """
        Clear robots.txt cache.

        Args:
            domain: Optional domain to clear, or None for all
        """
        self.cache.clear(domain)


# Global singleton instance
_global_robots_manager: Optional[RobotsManager] = None


def get_global_robots_manager() -> RobotsManager:
    """
    Get global RobotsManager instance (singleton pattern).

    Returns:
        Global RobotsManager instance
    """
    global _global_robots_manager

    if _global_robots_manager is None:
        _global_robots_manager = RobotsManager()
        logger.info("Created global RobotsManager instance")

    return _global_robots_manager
