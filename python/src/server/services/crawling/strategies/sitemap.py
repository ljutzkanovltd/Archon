"""
Sitemap Crawling Strategy

Handles crawling of URLs from XML sitemaps with rate limiting support.
"""
import asyncio
from collections.abc import Callable
from urllib.parse import urlparse
from xml.etree import ElementTree

import requests

from ....config.logfire_config import get_logger
from ..rate_limiter import RateLimitDetector

logger = get_logger(__name__)


class SitemapCrawlStrategy:
    """Strategy for parsing and crawling sitemaps."""

    def __init__(self):
        """Initialize sitemap crawl strategy with rate limit detector."""
        self.rate_limit_detector = RateLimitDetector()

    def parse_sitemap(self, sitemap_url: str, cancellation_check: Callable[[], None] | None = None) -> list[str]:
        """
        Parse a sitemap and extract URLs with comprehensive error handling.
        
        Args:
            sitemap_url: URL of the sitemap to parse
            cancellation_check: Optional function to check for cancellation
            
        Returns:
            List of URLs extracted from the sitemap
        """
        urls = []

        try:
            # Check for cancellation before making the request
            if cancellation_check:
                try:
                    cancellation_check()
                except asyncio.CancelledError:
                    logger.info("Sitemap parsing cancelled by user")
                    raise  # Re-raise to let the caller handle progress reporting

            logger.info(f"Parsing sitemap: {sitemap_url}")
            resp = requests.get(sitemap_url, timeout=30)

            # Check for rate limiting
            is_rate_limited, retry_after, reason = self.rate_limit_detector.detect(resp)
            if is_rate_limited:
                domain = urlparse(sitemap_url).netloc
                logger.warning(
                    f"Rate limited when fetching sitemap from {domain}: {reason}"
                    f"{f' (Retry-After: {retry_after}s)' if retry_after else ''}"
                )
                # Note: Sitemap parsing is sync, so we just log and return empty
                # The caller should handle retry logic for sitemaps
                return urls

            if resp.status_code != 200:
                logger.error(f"Failed to fetch sitemap: HTTP {resp.status_code}")
                return urls

            try:
                tree = ElementTree.fromstring(resp.content)
                urls = [loc.text for loc in tree.findall('.//{*}loc') if loc.text]
                logger.info(f"Successfully extracted {len(urls)} URLs from sitemap")

            except ElementTree.ParseError:
                logger.exception(f"Error parsing sitemap XML from {sitemap_url}")
            except Exception:
                logger.exception(f"Unexpected error parsing sitemap from {sitemap_url}")

        except requests.exceptions.RequestException:
            logger.exception(f"Network error fetching sitemap from {sitemap_url}")
        except Exception:
            logger.exception(f"Unexpected error in sitemap parsing for {sitemap_url}")

        return urls
