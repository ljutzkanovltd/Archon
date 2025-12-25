#!/usr/bin/env python3
"""
Batch Crawl Orchestrator for Archon Knowledge Base
Handles intelligent batching, deduplication, and progress monitoring
"""

import asyncio
import httpx
import sys
import os
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import json
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'docs'))
from library_catalog_extended import get_all_libraries, get_libraries_by_priority, get_libraries_by_tag


class CrawlReason(Enum):
    NEW = "new"
    INCOMPLETE = "incomplete"
    MISSING_SECTIONS = "missing_sections"
    STALE = "stale"
    UP_TO_DATE = "up_to_date"


@dataclass
class CrawlJob:
    """Represents a crawl job to be executed"""
    library_name: str
    url: str
    priority: int
    reason: CrawlReason
    expected_min_words: int = 50000
    crawl_config: dict = None

    def __post_init__(self):
        if self.crawl_config is None:
            self.crawl_config = {}


@dataclass
class CrawlResult:
    """Result of a crawl operation"""
    library_name: str
    success: bool
    progress_id: str
    status: str
    message: str
    word_count: int = 0
    pages_crawled: int = 0
    error: Optional[str] = None


class BatchCrawlOrchestrator:
    """
    Orchestrates batch crawling operations with intelligent deduplication
    and concurrency control (2-3 concurrent jobs max)
    """

    def __init__(
        self,
        api_base: str = "http://localhost:8181",
        max_concurrent: int = 2,
        poll_interval: float = 3.0,
        timeout: float = 600.0
    ):
        """
        Initialize the batch crawler

        Args:
            api_base: Base URL for Archon backend API
            max_concurrent: Maximum concurrent crawl operations (default: 2)
            poll_interval: How often to poll for progress (seconds)
            timeout: Maximum time to wait for crawl completion (seconds)
        """
        self.api_base = api_base.rstrip('/')
        self.max_concurrent = max_concurrent
        self.poll_interval = poll_interval
        self.timeout = timeout
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.client = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()

    async def get_existing_sources(self) -> Dict[str, dict]:
        """
        Fetch all existing sources from Archon

        Returns:
            dict: {url: {source_id, word_count, display_name, ...}}
        """
        try:
            response = await self.client.get(f"{self.api_base}/api/knowledge-items")
            response.raise_for_status()

            response_data = response.json()
            # API returns {"items": [...]} format
            sources_data = response_data.get("items", []) if isinstance(response_data, dict) else response_data
            sources = {}

            for source in sources_data:
                # Normalize URL for comparison
                url = source.get("url", "").rstrip('/')
                metadata = source.get("metadata", {})
                sources[url] = {
                    "source_id": source.get("source_id"),
                    "display_name": source.get("title"),
                    "word_count": metadata.get("word_count", 0),
                    "summary": source.get("title", ""),
                    "url": url
                }

            return sources

        except httpx.HTTPError as e:
            print(f"Error fetching existing sources: {e}")
            return {}

    async def check_completeness(
        self,
        source_url: str,
        existing_sources: Dict[str, dict],
        expected_min_words: int
    ) -> Tuple[bool, str]:
        """
        Check if a source is complete based on word count

        Returns:
            (is_complete, reason)
        """
        normalized_url = source_url.rstrip('/')

        if normalized_url not in existing_sources:
            return False, "not_found"

        source = existing_sources[normalized_url]
        word_count = source.get("word_count", 0)

        if word_count < expected_min_words:
            return False, f"incomplete (only {word_count} words, expected {expected_min_words}+)"

        return True, "complete"

    async def needs_crawling(
        self,
        library: dict,
        existing_sources: Dict[str, dict],
        force_recrawl: bool = False
    ) -> Tuple[bool, CrawlReason, str]:
        """
        Determine if a library needs crawling

        Args:
            library: Library dict from catalog
            existing_sources: Currently crawled sources
            force_recrawl: Force re-crawl even if exists

        Returns:
            (should_crawl, reason, details)
        """
        url = library["url"].rstrip('/')
        name = library["name"]

        # Check if already exists
        if url not in existing_sources:
            return True, CrawlReason.NEW, f"Not yet crawled"

        if force_recrawl:
            return True, CrawlReason.INCOMPLETE, "Force re-crawl requested"

        # Check completeness based on expected word counts
        expected_words = self._get_expected_word_count(name)
        is_complete, reason = await self.check_completeness(
            url, existing_sources, expected_words
        )

        if not is_complete:
            return True, CrawlReason.INCOMPLETE, reason

        # All checks passed - up to date
        return False, CrawlReason.UP_TO_DATE, "Already complete"

    def _get_expected_word_count(self, library_name: str) -> int:
        """Get expected minimum word count for a library"""
        # Special cases for known large documentation
        thresholds = {
            "Odoo": 200000,
            "FastAPI": 300000,
            "React": 400000,
            "Next.js": 350000,
            "PostgreSQL": 500000,
            "TypeScript": 450000,
            "Supabase": 300000,
            "Docker Compose": 200000,
            "Azure Storage Blob": 100000,
            "Azure Functions": 150000,
            "Azure App Service": 150000,
            "Azure PostgreSQL": 100000,
        }

        return thresholds.get(library_name, 50000)  # Default 50k words

    async def submit_crawl_job(self, job: CrawlJob) -> str:
        """
        Submit a crawl job to Archon backend API

        Returns:
            progress_id for tracking
        """
        payload = {
            "url": job.url,
            "knowledge_type": "technical",
            "tags": [f"priority-{job.priority}", job.library_name.lower().replace(" ", "-")],
            "max_depth": job.crawl_config.get("max_depth", 2),
            "extract_code_examples": job.crawl_config.get("extract_code_examples", True),
        }

        # Add crawl delay if specified (for rate-limited sites like Odoo)
        if "crawl_delay" in job.crawl_config:
            payload["crawl_delay"] = job.crawl_config["crawl_delay"]

        try:
            response = await self.client.post(
                f"{self.api_base}/api/knowledge-items/crawl",
                json=payload
            )
            response.raise_for_status()

            result = response.json()
            return result.get("progressId", "")

        except httpx.HTTPError as e:
            print(f"Error submitting crawl job for {job.library_name}: {e}")
            raise

    async def poll_progress(self, progress_id: str, library_name: str) -> CrawlResult:
        """
        Poll crawl progress until completion or timeout

        Returns:
            CrawlResult with final status
        """
        start_time = asyncio.get_event_loop().time()
        last_stage = None

        while True:
            # Check timeout
            if asyncio.get_event_loop().time() - start_time > self.timeout:
                return CrawlResult(
                    library_name=library_name,
                    success=False,
                    progress_id=progress_id,
                    status="timeout",
                    message=f"Timeout after {self.timeout}s"
                )

            try:
                response = await self.client.get(
                    f"{self.api_base}/api/crawl-progress/{progress_id}"
                )
                response.raise_for_status()

                data = response.json()
                status = data.get("status", "unknown")
                stage = data.get("stage", "")
                progress = data.get("progress", 0)

                # Print progress updates only when stage changes
                if stage != last_stage and stage:
                    print(f"  [{library_name}] {stage.replace('_', ' ').title()} ({progress:.0f}%)")
                    last_stage = stage

                # Check for completion
                if status in ["completed", "error", "cancelled"]:
                    result_data = data.get("result", {})
                    return CrawlResult(
                        library_name=library_name,
                        success=(status == "completed"),
                        progress_id=progress_id,
                        status=status,
                        message=data.get("message", ""),
                        word_count=result_data.get("word_count", 0),
                        pages_crawled=result_data.get("pages_crawled", 0),
                        error=data.get("error") if status == "error" else None
                    )

                # Wait before next poll
                await asyncio.sleep(self.poll_interval)

            except httpx.HTTPError as e:
                print(f"Error polling progress for {library_name}: {e}")
                await asyncio.sleep(self.poll_interval)

    async def crawl_with_concurrency(self, job: CrawlJob) -> CrawlResult:
        """
        Execute a crawl job with concurrency control

        Uses semaphore to limit concurrent operations
        """
        async with self.semaphore:
            print(f"\n🚀 Starting crawl: {job.library_name}")
            print(f"   URL: {job.url}")
            print(f"   Reason: {job.reason.value}")
            print(f"   Priority: {job.priority}")

            try:
                progress_id = await self.submit_crawl_job(job)
                print(f"   Progress ID: {progress_id}")

                result = await self.poll_progress(progress_id, job.library_name)

                if result.success:
                    print(f"✅ Completed: {job.library_name}")
                    print(f"   Words: {result.word_count:,}, Pages: {result.pages_crawled}")
                else:
                    print(f"❌ Failed: {job.library_name} - {result.status}")
                    if result.error:
                        print(f"   Error: {result.error}")

                return result

            except Exception as e:
                print(f"❌ Exception during crawl of {job.library_name}: {e}")
                return CrawlResult(
                    library_name=job.library_name,
                    success=False,
                    progress_id="",
                    status="exception",
                    message=str(e),
                    error=str(e)
                )

    async def batch_crawl(
        self,
        libraries: List[dict],
        force_recrawl: bool = False,
        priority_filter: Optional[int] = None,
        dry_run: bool = False
    ) -> List[CrawlResult]:
        """
        Main orchestration: batch crawl multiple libraries

        Args:
            libraries: List of library dicts from catalog
            force_recrawl: Re-crawl even if already exists
            priority_filter: Only crawl libraries with this priority (1, 2, or 3)
            dry_run: Don't actually crawl, just show what would be crawled

        Returns:
            List of CrawlResults
        """
        print(f"📚 Batch Crawl Orchestrator")
        print(f"=" * 60)
        print(f"Max Concurrent: {self.max_concurrent}")
        print(f"Poll Interval: {self.poll_interval}s")
        print(f"Timeout: {self.timeout}s")
        print(f"Dry Run: {dry_run}")
        print()

        # Filter by priority if specified
        if priority_filter:
            libraries = [lib for lib in libraries if lib["priority"] == priority_filter]
            print(f"Filtered to Priority {priority_filter}: {len(libraries)} libraries\n")

        # Sort by priority (1 first, then 2, then 3)
        libraries.sort(key=lambda x: x["priority"])

        # Get existing sources
        print("🔍 Fetching existing sources from Archon...")
        existing_sources = await self.get_existing_sources()
        print(f"   Found {len(existing_sources)} existing sources\n")

        # Determine what needs crawling
        jobs = []
        skipped = []

        for lib in libraries:
            needs_crawl, reason, details = await self.needs_crawling(
                lib, existing_sources, force_recrawl
            )

            if needs_crawl:
                # Create crawl config based on library
                crawl_config = self._get_crawl_config(lib["name"])

                job = CrawlJob(
                    library_name=lib["name"],
                    url=lib["url"],
                    priority=lib["priority"],
                    reason=reason,
                    expected_min_words=self._get_expected_word_count(lib["name"]),
                    crawl_config=crawl_config
                )
                jobs.append(job)
            else:
                skipped.append((lib["name"], details))

        # Print summary
        print(f"📊 Crawl Plan Summary")
        print(f"-" * 60)
        print(f"Total libraries: {len(libraries)}")
        print(f"To crawl: {len(jobs)}")
        print(f"Skipped (up-to-date): {len(skipped)}")
        print()

        if skipped and len(skipped) <= 10:
            print("Skipped libraries:")
            for name, reason in skipped:
                print(f"  ✓ {name}: {reason}")
            print()

        if not jobs:
            print("✨ All libraries are up to date!")
            return []

        print(f"Queued for crawling:")
        for job in jobs:
            print(f"  - {job.library_name} ({job.reason.value})")
        print()

        if dry_run:
            print("🏁 Dry run complete - no actual crawls performed")
            return []

        # Execute crawls in parallel (with concurrency limit)
        print(f"🚀 Starting batch crawl ({self.max_concurrent} concurrent)")
        print("=" * 60)

        tasks = [self.crawl_with_concurrency(job) for job in jobs]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Convert exceptions to CrawlResults
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                final_results.append(CrawlResult(
                    library_name=jobs[i].library_name,
                    success=False,
                    progress_id="",
                    status="exception",
                    message=str(result),
                    error=str(result)
                ))
            else:
                final_results.append(result)

        # Print final summary
        print("\n" + "=" * 60)
        print("📊 Batch Crawl Summary")
        print("=" * 60)

        successful = sum(1 for r in final_results if r.success)
        failed = sum(1 for r in final_results if not r.success)
        total_words = sum(r.word_count for r in final_results if r.success)
        total_pages = sum(r.pages_crawled for r in final_results if r.success)

        print(f"Successful: {successful}/{len(final_results)}")
        print(f"Failed: {failed}/{len(final_results)}")
        print(f"Total words crawled: {total_words:,}")
        print(f"Total pages crawled: {total_pages:,}")
        print()

        if failed > 0:
            print("Failed crawls:")
            for result in final_results:
                if not result.success:
                    print(f"  ❌ {result.library_name}: {result.status}")
                    if result.error:
                        print(f"     {result.error[:100]}")

        return final_results

    def _get_crawl_config(self, library_name: str) -> dict:
        """Get special crawl configuration for specific libraries"""
        configs = {
            "Odoo": {
                "max_depth": 3,
                "crawl_delay": 2.0,  # 0.5 req/sec
                "extract_code_examples": True
            },
            "FastAPI": {
                "max_depth": 2,
                "extract_code_examples": True
            },
            "React": {
                "max_depth": 2,
                "extract_code_examples": True
            },
            "Azure Storage Blob": {
                "max_depth": 2,
                "crawl_delay": 1.5
            },
            "Azure Functions": {
                "max_depth": 2,
                "crawl_delay": 1.5
            },
        }

        return configs.get(library_name, {
            "max_depth": 2,
            "extract_code_examples": True
        })


async def main():
    """Example usage"""
    import argparse

    parser = argparse.ArgumentParser(description="Batch crawl libraries for Archon knowledge base")
    parser.add_argument("--priority", type=int, choices=[1, 2, 3], help="Only crawl this priority level")
    parser.add_argument("--force", action="store_true", help="Force re-crawl even if exists")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually crawl, just show plan")
    parser.add_argument("--concurrent", type=int, default=2, help="Max concurrent crawls (default: 2)")
    parser.add_argument("--tag", type=str, help="Only crawl libraries with this tag (e.g., 'azure')")

    args = parser.parse_args()

    # Get libraries
    if args.tag:
        libraries = get_libraries_by_tag(args.tag)
    elif args.priority:
        libraries = get_libraries_by_priority(args.priority)
    else:
        libraries = get_all_libraries()

    # Run batch crawl
    async with BatchCrawlOrchestrator(max_concurrent=args.concurrent) as orchestrator:
        results = await orchestrator.batch_crawl(
            libraries,
            force_recrawl=args.force,
            priority_filter=args.priority,
            dry_run=args.dry_run
        )

        # Save results to JSON
        if not args.dry_run and results:
            output_file = f"crawl_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            output_path = os.path.join(os.path.dirname(__file__), '..', 'logs', output_file)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            with open(output_path, 'w') as f:
                json.dump([{
                    "library_name": r.library_name,
                    "success": r.success,
                    "status": r.status,
                    "word_count": r.word_count,
                    "pages_crawled": r.pages_crawled,
                    "error": r.error
                } for r in results], f, indent=2)

            print(f"\n📄 Results saved to: {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
