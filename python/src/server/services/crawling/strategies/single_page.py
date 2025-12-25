"""
Single Page Crawling Strategy

Handles crawling of individual web pages with rate limiting support.
"""
import asyncio
import os
import time
import traceback
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import urlparse

from crawl4ai import CacheMode, CrawlerRunConfig

from ....config.logfire_config import get_logger
from ..adaptive_throttler import get_global_adaptive_throttler
from ..async_limiter import GlobalRateLimiter
from ..metrics import RateLimitEvent, RateLimitReason, get_global_metrics_collector
from ..rate_limiter import RateLimitHandler
from ..robots_manager import get_global_robots_manager

logger = get_logger(__name__)


class SinglePageCrawlStrategy:
    """Strategy for crawling a single web page."""

    def __init__(self, crawler, markdown_generator):
        """
        Initialize single page crawl strategy.

        Args:
            crawler (AsyncWebCrawler): The Crawl4AI crawler instance for web crawling operations
            markdown_generator (DefaultMarkdownGenerator): The markdown generator instance for converting HTML to markdown
        """
        self.crawler = crawler
        self.markdown_generator = markdown_generator

        # Initialize rate limiting components
        # Get configuration from environment variables
        default_rate = float(os.getenv('CRAWL_DEFAULT_RATE_LIMIT', '1.0'))
        base_delay = float(os.getenv('CRAWL_BASE_DELAY', '1.0'))
        max_delay = float(os.getenv('CRAWL_MAX_DELAY', '60.0'))
        adaptive_enabled = os.getenv('CRAWL_ADAPTIVE_THROTTLE', 'false').lower() == 'true'
        respect_robots = os.getenv('CRAWL_RESPECT_ROBOTS', 'true').lower() == 'true'

        # Global async rate limiter (per-domain token bucket)
        self.rate_limiter = GlobalRateLimiter.get_instance(default_rate=default_rate)

        # Rate limit handler (detection + exponential backoff)
        self.rate_limit_handler = RateLimitHandler(
            base_delay=base_delay,
            max_delay=max_delay,
            jitter_range=(0.0, 1.0)
        )

        # Adaptive throttler (latency-based)
        self.adaptive_throttler = get_global_adaptive_throttler() if adaptive_enabled else None

        # robots.txt manager
        self.robots_manager = get_global_robots_manager() if respect_robots else None

        # Metrics collector
        self.metrics_collector = get_global_metrics_collector()

        logger.info(
            f"Initialized crawling strategy: "
            f"rate_limit={default_rate} req/s, "
            f"backoff={base_delay}-{max_delay}s, "
            f"adaptive={adaptive_enabled}, "
            f"respect_robots={respect_robots}"
        )

    def _get_wait_selector_for_docs(self, url: str) -> str:
        """Get appropriate wait selector based on documentation framework."""
        url_lower = url.lower()

        # Common selectors for different documentation frameworks
        if 'docusaurus' in url_lower:
            return '.markdown, .theme-doc-markdown, article'
        elif 'vitepress' in url_lower:
            return '.VPDoc, .vp-doc, .content'
        elif 'gitbook' in url_lower:
            return '.markdown-section, .page-wrapper'
        elif 'mkdocs' in url_lower:
            return '.md-content, article'
        elif 'docsify' in url_lower:
            return '#main, .markdown-section'
        elif 'copilotkit' in url_lower:
            # CopilotKit uses a custom setup, wait for any content
            return 'div[class*="content"], div[class*="doc"], #__next'
        elif 'milkdown' in url_lower:
            # Milkdown uses a custom rendering system
            return 'main, article, .prose, [class*="content"]'
        else:
            # Simplified generic selector - just wait for body to have content
            return 'body'

    async def crawl_single_page(
        self,
        url: str,
        transform_url_func: Callable[[str], str],
        is_documentation_site_func: Callable[[str], bool],
        retry_count: int = 3
    ) -> dict[str, Any]:
        """
        Crawl a single web page and return the result with retry logic.
        
        Args:
            url: URL of the web page to crawl
            transform_url_func: Function to transform URLs (e.g., GitHub URLs)
            is_documentation_site_func: Function to check if URL is a documentation site
            retry_count: Number of retry attempts
            
        Returns:
            Dict with success status, content, and metadata
        """
        # Transform GitHub URLs to raw content URLs if applicable
        original_url = url
        url = transform_url_func(url)

        # Extract domain for rate limiting
        domain = urlparse(url).netloc

        # Check robots.txt if enabled
        if self.robots_manager:
            # Check if URL is allowed
            if not self.robots_manager.is_allowed(url):
                logger.warning(f"URL disallowed by robots.txt: {url}")

                # Record metric
                self.metrics_collector.record_event(
                    event_type=RateLimitEvent.ROBOTS_BLOCKED,
                    domain=domain,
                    reason=RateLimitReason.ROBOTS_TXT,
                    url=url
                )

                return {
                    "success": False,
                    "error": f"Crawling disallowed by robots.txt for {url}"
                }

            # Get and apply crawl-delay from robots.txt
            crawl_delay = self.robots_manager.get_crawl_delay(url)
            if crawl_delay:
                logger.info(
                    f"Applying robots.txt Crawl-Delay for {domain}: {crawl_delay}s"
                )

                # Record metric
                self.metrics_collector.record_event(
                    event_type=RateLimitEvent.CRAWL_DELAY,
                    domain=domain,
                    delay_seconds=crawl_delay,
                    url=url
                )

                await asyncio.sleep(crawl_delay)

        last_error = None
        start_time = None  # Track request timing for adaptive throttling

        for attempt in range(retry_count):
            try:
                # Apply per-domain rate limiting BEFORE making request
                wait_time = await self.rate_limiter.acquire(domain)
                if wait_time > 0:
                    logger.info(
                        f"Rate limiter delayed request to {domain} by {wait_time:.2f}s"
                    )

                # Apply adaptive throttling if enabled
                if self.adaptive_throttler:
                    adaptive_delay = await self.adaptive_throttler.acquire(domain)
                    if adaptive_delay > 0:
                        logger.debug(
                            f"Adaptive throttler delayed request to {domain} by {adaptive_delay:.2f}s"
                        )
                if not self.crawler:
                    logger.error(f"No crawler instance available for URL: {url}")
                    return {
                        "success": False,
                        "error": "No crawler instance available - crawler initialization may have failed"
                    }

                # Use ENABLED cache mode for better performance, BYPASS only on retries
                cache_mode = CacheMode.BYPASS if attempt > 0 else CacheMode.ENABLED

                # Check if this is a documentation site that needs special handling
                is_doc_site = is_documentation_site_func(url)

                # Enhanced configuration for documentation sites
                if is_doc_site:
                    wait_selector = self._get_wait_selector_for_docs(url)
                    logger.info(f"Detected documentation site, using wait selector: {wait_selector}")

                    crawl_config = CrawlerRunConfig(
                        cache_mode=cache_mode,
                        stream=True,  # Enable streaming for faster parallel processing
                        markdown_generator=self.markdown_generator,
                        # Wait for documentation content to load
                        wait_for=wait_selector,
                        # Use domcontentloaded for problematic sites
                        wait_until='domcontentloaded',  # Always use domcontentloaded for speed
                        # Increased timeout for JavaScript rendering
                        page_timeout=30000,  # 30 seconds
                        # Give JavaScript time to render
                        delay_before_return_html=0.5,  # Reduced from 2.0s
                        # Enable image waiting for completeness
                        wait_for_images=False,  # Skip images for faster crawling
                        # Scan full page to trigger lazy loading
                        scan_full_page=True,
                        # Keep images for documentation sites
                        exclude_all_images=False,
                        # Still remove popups
                        remove_overlay_elements=True,
                        # Process iframes for complete content
                        process_iframes=True
                    )
                else:
                    # Configuration for regular sites
                    crawl_config = CrawlerRunConfig(
                        cache_mode=cache_mode,
                        stream=True,  # Enable streaming
                        markdown_generator=self.markdown_generator,
                        wait_until='domcontentloaded',  # Use domcontentloaded for better reliability
                        page_timeout=45000,  # 45 seconds timeout
                        delay_before_return_html=0.3,  # Reduced from 1.0s
                        scan_full_page=True  # Trigger lazy loading
                    )

                logger.info(f"Crawling {url} (attempt {attempt + 1}/{retry_count})")
                logger.info(f"Using wait_until: {crawl_config.wait_until}, page_timeout: {crawl_config.page_timeout}")

                # Track request timing for adaptive throttling
                start_time = time.time()

                try:
                    result = await self.crawler.arun(url=url, config=crawl_config)

                    # Record response time for adaptive throttling
                    if self.adaptive_throttler and start_time:
                        latency = time.time() - start_time
                        self.adaptive_throttler.record_response(
                            domain,
                            latency=latency,
                            is_error=not result.success
                        )
                except Exception as e:
                    last_error = f"Crawler exception for {url}: {str(e)}"
                    logger.error(last_error)
                    if attempt < retry_count - 1:
                        # Use rate limit handler for backoff (no response, so no detection)
                        await self.rate_limit_handler.backoff(
                            attempt,
                            {'retry_after': None, 'reason': 'Crawler exception'},
                            domain=domain
                        )
                    continue

                # Check for rate limiting in the response
                is_rate_limited, rate_limit_info = self.rate_limit_handler.check_rate_limit(result)

                if is_rate_limited:
                    logger.warning(
                        f"Rate limit detected for {url}: {rate_limit_info['reason']}"
                    )

                    # If we have retries left, backoff and try again
                    if attempt < retry_count - 1:
                        await self.rate_limit_handler.backoff(attempt, rate_limit_info, domain=domain)
                        continue

                    # Out of retries, return error
                    return {
                        "success": False,
                        "error": f"Rate limited after {retry_count} attempts: {rate_limit_info['reason']}"
                    }

                if not result.success:
                    last_error = f"Failed to crawl {url}: {result.error_message}"
                    logger.warning(f"Crawl attempt {attempt + 1} failed: {last_error}")

                    # Use rate limit handler for backoff
                    if attempt < retry_count - 1:
                        await self.rate_limit_handler.backoff(
                            attempt,
                            {'retry_after': None, 'reason': f'Crawl failed: {result.error_message}'},
                            domain=domain
                        )
                    continue

                # Validate content
                if not result.markdown or len(result.markdown.strip()) < 50:
                    last_error = f"Insufficient content from {url}"
                    logger.warning(f"Crawl attempt {attempt + 1}: {last_error}")

                    if attempt < retry_count - 1:
                        await self.rate_limit_handler.backoff(
                            attempt,
                            {'retry_after': None, 'reason': 'Insufficient content'},
                            domain=domain
                        )
                    continue

                # Success! Return both markdown AND HTML
                # Debug logging to see what we got
                markdown_sample = result.markdown[:1000] if result.markdown else "NO MARKDOWN"
                has_triple_backticks = '```' in result.markdown if result.markdown else False
                backtick_count = result.markdown.count('```') if result.markdown else 0

                logger.info(f"Crawl result for {url} | has_markdown={bool(result.markdown)} | markdown_length={len(result.markdown) if result.markdown else 0} | has_triple_backticks={has_triple_backticks} | backtick_count={backtick_count}")

                # Log markdown info for debugging if needed
                if backtick_count > 0:
                    logger.info(f"Markdown has {backtick_count} code blocks for {url}")

                if 'getting-started' in url:
                    logger.info(f"Markdown sample for getting-started: {markdown_sample}")

                # Extract title from HTML <title> tag
                title = "Untitled"
                if result.html:
                    import re
                    title_match = re.search(r'<title[^>]*>(.*?)</title>', result.html, re.IGNORECASE | re.DOTALL)
                    if title_match:
                        extracted_title = title_match.group(1).strip()
                        # Clean up HTML entities
                        extracted_title = extracted_title.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
                        if extracted_title:
                            title = extracted_title

                return {
                    "success": True,
                    "url": original_url,  # Use original URL for tracking
                    "markdown": result.markdown,
                    "html": result.html,  # Use raw HTML instead of cleaned_html for code extraction
                    "title": title,
                    "links": result.links,
                    "content_length": len(result.markdown)
                }

            except TimeoutError:
                last_error = f"Timeout crawling {url}"
                logger.warning(f"Crawl attempt {attempt + 1} timed out")
                # Use rate limit handler for backoff
                if attempt < retry_count - 1:
                    await self.rate_limit_handler.backoff(
                        attempt,
                        {'retry_after': None, 'reason': 'Timeout'},
                        domain=domain
                    )
            except Exception as e:
                last_error = f"Error crawling page: {str(e)}"
                logger.error(f"Error on attempt {attempt + 1} crawling {url}: {e}")
                logger.error(traceback.format_exc())
                # Use rate limit handler for backoff
                if attempt < retry_count - 1:
                    await self.rate_limit_handler.backoff(
                        attempt,
                        {'retry_after': None, 'reason': f'Exception: {str(e)}'},
                        domain=domain
                    )

        # All retries failed
        return {
            "success": False,
            "error": last_error or f"Failed to crawl {url} after {retry_count} attempts"
        }

    async def crawl_markdown_file(
        self,
        url: str,
        transform_url_func: Callable[[str], str],
        progress_callback: Callable[..., Awaitable[None]] | None = None,
        start_progress: int = 10,
        end_progress: int = 20
    ) -> list[dict[str, Any]]:
        """
        Crawl a .txt or markdown file with comprehensive error handling and progress reporting.

        Args:
            url: URL of the text/markdown file
            transform_url_func: Function to transform URLs (e.g., GitHub URLs)
            progress_callback: Optional callback for progress updates
            start_progress: Starting progress percentage (must be 0-100)
            end_progress: Ending progress percentage (must be 0-100 and > start_progress)

        Returns:
            List containing the crawled document

        Raises:
            ValueError: If start_progress or end_progress are invalid
        """
        # Validate progress parameters before any async work or progress reporting
        if not isinstance(start_progress, (int, float)) or not isinstance(end_progress, (int, float)):
            raise ValueError(
                f"start_progress and end_progress must be int or float, "
                f"got start_progress={type(start_progress).__name__}, end_progress={type(end_progress).__name__}"
            )

        if not (0 <= start_progress <= 100):
            raise ValueError(
                f"start_progress must be in range [0, 100], got {start_progress}"
            )

        if not (0 <= end_progress <= 100):
            raise ValueError(
                f"end_progress must be in range [0, 100], got {end_progress}"
            )

        if start_progress >= end_progress:
            raise ValueError(
                f"start_progress must be less than end_progress, "
                f"got start_progress={start_progress}, end_progress={end_progress}"
            )

        try:
            # Transform GitHub URLs to raw content URLs if applicable
            original_url = url
            url = transform_url_func(url)
            logger.info(f"Crawling markdown file: {url}")

            # Define local report_progress helper like in other methods
            async def report_progress(progress: int, message: str, **kwargs):
                """Helper to report progress if callback is available"""
                if progress_callback:
                    await progress_callback('crawling', progress, message, **kwargs)

            # Report initial progress (single file = 1 page)
            await report_progress(
                start_progress,
                f"Fetching text file: {url}",
                total_pages=1,
                processed_pages=0
            )

            # Use consistent configuration even for text files
            crawl_config = CrawlerRunConfig(
                cache_mode=CacheMode.ENABLED,
                stream=False
            )

            result = await self.crawler.arun(url=url, config=crawl_config)
            if result.success and result.markdown:
                logger.info(f"Successfully crawled markdown file: {url}")

                # Report completion progress
                await report_progress(
                    end_progress,
                    f"Text file crawled successfully: {original_url}",
                    total_pages=1,
                    processed_pages=1
                )

                return [{'url': original_url, 'markdown': result.markdown, 'html': result.html}]
            else:
                logger.error(f"Failed to crawl {url}: {result.error_message}")
                return []
        except Exception as e:
            logger.error(f"Exception while crawling markdown file {url}: {e}")
            logger.error(traceback.format_exc())
            return []
