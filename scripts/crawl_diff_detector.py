#!/usr/bin/env python3
"""
Crawl Diff Detector for Archon Knowledge Base
Compares library catalog vs already-crawled sources to identify differences
"""

import asyncio
import httpx
import sys
import os
from typing import Dict, List, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json

# Import from same directory
from library_catalog_extended import get_all_libraries, get_libraries_by_priority


class SourceStatus(Enum):
    NEW = "new"
    INCOMPLETE = "incomplete"
    MISSING_SECTIONS = "missing_sections"
    UP_TO_DATE = "up_to_date"
    STALE = "stale"


@dataclass
class DiffResult:
    """Result of comparing catalog vs crawled"""
    new: List[dict] = field(default_factory=list)
    incomplete: List[dict] = field(default_factory=list)
    missing_sections: List[dict] = field(default_factory=list)
    up_to_date: List[dict] = field(default_factory=list)
    stale: List[dict] = field(default_factory=list)

    def get_actionable(self) -> List[dict]:
        """Get libraries that need action (new, incomplete, missing_sections)"""
        return self.new + self.incomplete + self.missing_sections

    def print_summary(self):
        """Print a formatted summary"""
        print("=" * 80)
        print("📊 CATALOG vs CRAWLED - DIFF SUMMARY")
        print("=" * 80)
        print()
        print(f"🆕 New (not yet crawled):        {len(self.new)}")
        print(f"⚠️  Incomplete (needs re-crawl):  {len(self.incomplete)}")
        print(f"📋 Missing sections:             {len(self.missing_sections)}")
        print(f"✅ Up to date:                   {len(self.up_to_date)}")
        print(f"🕐 Stale (>30 days):             {len(self.stale)}")
        print()
        print(f"🎯 Total actionable items:       {len(self.get_actionable())}")
        print()


class CrawlDiffDetector:
    """
    Detects differences between library catalog and crawled sources
    """

    # Expected word count thresholds
    EXPECTED_WORD_COUNTS = {
        "Odoo": 200000,
        "FastAPI": 300000,
        "React": 400000,
        "Next.js": 350000,
        "PostgreSQL": 500000,
        "TypeScript": 450000,
        "Supabase": 300000,
        "Docker Compose": 200000,
        "PydanticAI": 400000,
        "Model Context Protocol": 150000,
        "TanStack Query": 200000,
        "Tailwind CSS": 300000,
    }

    # Expected sections for validation
    EXPECTED_SECTIONS = {
        "FastAPI": ["/tutorial/", "/reference/", "/advanced/"],
        "React": ["/learn/", "/reference/"],
        "Next.js": ["/docs/app/", "/docs/pages/", "/docs/api-reference/"],
        "TypeScript": ["/docs/handbook/"],
        "PostgreSQL": ["/docs/15/sql-", "/docs/15/tutorial-"],
        "Supabase": ["/docs/guides/database", "/docs/guides/auth", "/docs/reference/"],
        "TanStack Query": ["/docs/framework/react/guides/", "/docs/framework/react/reference/"],
    }

    def __init__(self, api_base: str = "http://localhost:8181"):
        """Initialize diff detector"""
        self.api_base = api_base.rstrip('/')
        self.client = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()

    async def get_crawled_sources(self) -> Dict[str, dict]:
        """
        Fetch all crawled sources from Archon

        Returns:
            dict: {normalized_url: source_data}
        """
        try:
            response = await self.client.get(f"{self.api_base}/api/knowledge-items")
            response.raise_for_status()

            response_data = response.json()
            # API returns {"items": [...]} format
            sources_data = response_data.get("items", []) if isinstance(response_data, dict) else response_data
            sources = {}

            for source in sources_data:
                url = source.get("url", "").rstrip('/')
                # Extract word count from metadata
                metadata = source.get("metadata", {})
                source_info = {
                    "source_id": source.get("source_id"),
                    "url": source.get("url"),
                    "title": source.get("title"),
                    "word_count": metadata.get("word_count", 0),
                    "summary": source.get("title", ""),
                    "display_name": source.get("title", ""),
                }
                sources[url] = source_info

            return sources

        except httpx.HTTPError as e:
            print(f"Error fetching crawled sources: {e}")
            return {}

    async def get_source_pages(self, source_id: str) -> List[dict]:
        """Fetch pages for a source to check sections"""
        try:
            response = await self.client.get(
                f"{self.api_base}/api/knowledge-items/{source_id}/pages"
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError:
            return []

    def normalize_url(self, url: str) -> str:
        """Normalize URL for comparison"""
        return url.rstrip('/').lower()

    def get_expected_word_count(self, library_name: str) -> int:
        """Get expected minimum word count"""
        return self.EXPECTED_WORD_COUNTS.get(library_name, 50000)

    def is_incomplete(self, library: dict, crawled_source: dict) -> bool:
        """Check if a crawled source is incomplete"""
        word_count = crawled_source.get("word_count", 0)
        expected = self.get_expected_word_count(library["name"])

        # Incomplete if less than 50% of expected
        return word_count < (expected * 0.5)

    async def has_missing_sections(self, library: dict, crawled_source: dict) -> Tuple[bool, List[str]]:
        """
        Check if critical sections are missing

        Returns:
            (has_missing, list_of_missing_sections)
        """
        library_name = library["name"]
        expected_sections = self.EXPECTED_SECTIONS.get(library_name, [])

        if not expected_sections:
            return False, []

        source_id = crawled_source.get("source_id")
        if not source_id:
            return False, []

        # Get pages for this source
        pages = await self.get_source_pages(source_id)
        page_urls = [p.get("url", "") for p in pages]

        # Check for missing sections
        missing = []
        for section in expected_sections:
            found = any(section in url for url in page_urls)
            if not found:
                missing.append(section)

        return len(missing) > 0, missing

    async def compare_catalog_vs_crawled(
        self,
        catalog_libraries: List[dict] = None,
        priority_filter: int = None
    ) -> DiffResult:
        """
        Compare catalog libraries vs crawled sources

        Args:
            catalog_libraries: List of libraries from catalog (default: all)
            priority_filter: Filter by priority (1, 2, or 3)

        Returns:
            DiffResult with categorized libraries
        """
        print("🔍 Comparing library catalog vs crawled sources...")
        print()

        # Get catalog libraries
        if catalog_libraries is None:
            if priority_filter:
                catalog_libraries = get_libraries_by_priority(priority_filter)
            else:
                catalog_libraries = get_all_libraries()

        print(f"📚 Catalog libraries: {len(catalog_libraries)}")

        # Get crawled sources
        crawled_sources = await self.get_crawled_sources()
        print(f"📦 Crawled sources: {len(crawled_sources)}")
        print()

        # Create URL index for catalog
        catalog_by_url = {
            self.normalize_url(lib["url"]): lib
            for lib in catalog_libraries
        }

        # Create name index for reverse lookup
        crawled_by_url = {
            self.normalize_url(url): source
            for url, source in crawled_sources.items()
        }

        result = DiffResult()

        # Categorize each catalog library
        for library in catalog_libraries:
            lib_url = self.normalize_url(library["url"])
            lib_name = library["name"]

            # Check if crawled
            if lib_url not in crawled_by_url:
                # NEW: Not yet crawled
                result.new.append({
                    **library,
                    "status": SourceStatus.NEW.value,
                    "reason": "Not yet crawled"
                })
                continue

            crawled_source = crawled_by_url[lib_url]

            # Check for errors in crawl (like "too many requests")
            summary = crawled_source.get("summary", "").lower()
            display_name = crawled_source.get("display_name", "").lower()

            has_errors = any(
                indicator in summary or indicator in display_name
                for indicator in ["429", "too many requests", "rate limit", "error"]
            )

            if has_errors:
                # INCOMPLETE: Has errors
                result.incomplete.append({
                    **library,
                    "status": SourceStatus.INCOMPLETE.value,
                    "reason": "Crawl errors detected (rate limiting or access issues)",
                    "crawled_source": crawled_source,
                    "word_count": crawled_source.get("word_count", 0)
                })
                continue

            # Check word count completeness
            if self.is_incomplete(library, crawled_source):
                # INCOMPLETE: Word count too low
                word_count = crawled_source.get("word_count", 0)
                expected = self.get_expected_word_count(lib_name)
                percentage = (word_count / expected * 100) if expected > 0 else 0

                result.incomplete.append({
                    **library,
                    "status": SourceStatus.INCOMPLETE.value,
                    "reason": f"Word count too low: {word_count:,} / {expected:,} ({percentage:.0f}%)",
                    "crawled_source": crawled_source,
                    "word_count": word_count,
                    "expected_word_count": expected
                })
                continue

            # Check for missing critical sections
            has_missing, missing_sections = await self.has_missing_sections(library, crawled_source)

            if has_missing:
                # MISSING_SECTIONS: Has content but missing sections
                result.missing_sections.append({
                    **library,
                    "status": SourceStatus.MISSING_SECTIONS.value,
                    "reason": f"Missing {len(missing_sections)} critical sections",
                    "missing_sections": missing_sections,
                    "crawled_source": crawled_source,
                    "word_count": crawled_source.get("word_count", 0)
                })
                continue

            # UP_TO_DATE: All checks passed
            result.up_to_date.append({
                **library,
                "status": SourceStatus.UP_TO_DATE.value,
                "reason": "Complete and up to date",
                "crawled_source": crawled_source,
                "word_count": crawled_source.get("word_count", 0)
            })

        return result

    async def detect_missing_sections(
        self,
        library: dict,
        source_data: dict
    ) -> List[str]:
        """
        Detect missing sections for a specific library

        Returns:
            List of missing section URLs
        """
        library_name = library["name"]
        expected_sections = self.EXPECTED_SECTIONS.get(library_name, [])

        if not expected_sections:
            return []

        source_id = source_data.get("source_id")
        if not source_id:
            return []

        pages = await self.get_source_pages(source_id)
        page_urls = [p.get("url", "") for p in pages]

        missing = []
        for section in expected_sections:
            found = any(section in url for url in page_urls)
            if not found:
                # Construct expected URL
                base_url = library["url"].rstrip('/')
                expected_url = f"{base_url}{section}"
                missing.append(expected_url)

        return missing

    def print_detailed_report(self, result: DiffResult):
        """Print detailed diff report"""
        result.print_summary()

        if result.new:
            print("=" * 80)
            print("🆕 NEW LIBRARIES (Not Yet Crawled)")
            print("=" * 80)
            for lib in result.new:
                print(f"\n📘 {lib['name']} (Priority {lib['priority']})")
                print(f"   URL: {lib['url']}")
                print(f"   Projects: {', '.join(lib['projects'])}")

        if result.incomplete:
            print("\n" + "=" * 80)
            print("⚠️  INCOMPLETE CRAWLS (Need Re-Crawl)")
            print("=" * 80)
            for lib in result.incomplete:
                print(f"\n📘 {lib['name']} (Priority {lib['priority']})")
                print(f"   URL: {lib['url']}")
                print(f"   Reason: {lib['reason']}")
                if 'word_count' in lib:
                    print(f"   Words: {lib['word_count']:,}", end="")
                    if 'expected_word_count' in lib:
                        print(f" / {lib['expected_word_count']:,}")
                    else:
                        print()

        if result.missing_sections:
            print("\n" + "=" * 80)
            print("📋 MISSING SECTIONS (Partial Crawls)")
            print("=" * 80)
            for lib in result.missing_sections:
                print(f"\n📘 {lib['name']} (Priority {lib['priority']})")
                print(f"   URL: {lib['url']}")
                print(f"   Words: {lib['word_count']:,}")
                print(f"   Missing sections:")
                for section in lib.get('missing_sections', []):
                    print(f"      - {section}")

        if result.up_to_date:
            print("\n" + "=" * 80)
            print(f"✅ UP TO DATE ({len(result.up_to_date)} sources)")
            print("=" * 80)
            # Only show first 10 to avoid clutter
            for lib in result.up_to_date[:10]:
                print(f"   ✓ {lib['name']} ({lib['word_count']:,} words)")
            if len(result.up_to_date) > 10:
                print(f"   ... and {len(result.up_to_date) - 10} more")

        print("\n" + "=" * 80)

    async def export_diff_report(self, result: DiffResult, output_file: str):
        """Export diff report to JSON"""
        report = {
            "timestamp": asyncio.get_event_loop().time(),
            "summary": {
                "new": len(result.new),
                "incomplete": len(result.incomplete),
                "missing_sections": len(result.missing_sections),
                "up_to_date": len(result.up_to_date),
                "stale": len(result.stale),
                "actionable": len(result.get_actionable())
            },
            "libraries": {
                "new": result.new,
                "incomplete": result.incomplete,
                "missing_sections": result.missing_sections,
                "up_to_date": result.up_to_date,
                "stale": result.stale
            }
        }

        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"\n📄 Diff report exported to: {output_file}")


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Detect differences between catalog and crawled sources")
    parser.add_argument("--priority", type=int, choices=[1, 2, 3], help="Filter by priority")
    parser.add_argument("--export", type=str, help="Export report to JSON file")
    parser.add_argument("--actionable-only", action="store_true", help="Show only actionable items")

    args = parser.parse_args()

    async with CrawlDiffDetector() as detector:
        result = await detector.compare_catalog_vs_crawled(priority_filter=args.priority)

        if args.actionable_only:
            # Only show new, incomplete, and missing_sections
            print("🎯 ACTIONABLE ITEMS ONLY")
            print()
            temp_result = DiffResult(
                new=result.new,
                incomplete=result.incomplete,
                missing_sections=result.missing_sections
            )
            detector.print_detailed_report(temp_result)
        else:
            detector.print_detailed_report(result)

        if args.export:
            output_path = os.path.join(os.path.dirname(__file__), '..', 'logs', args.export)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            await detector.export_diff_report(result, output_path)


if __name__ == "__main__":
    asyncio.run(main())
