#!/usr/bin/env python3
"""
Completeness Validator for Archon Knowledge Base
Validates crawled sources for completeness and quality
"""

import asyncio
import httpx
import sys
import os
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'docs'))
from library_catalog_extended import get_all_libraries


@dataclass
class ValidationIssue:
    """Represents a validation issue found"""
    severity: str  # "critical", "warning", "info"
    issue_type: str  # "word_count", "missing_sections", "errors", "stale"
    message: str
    details: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of validating a source"""
    source_id: str
    library_name: str
    url: str
    is_complete: bool
    word_count: int
    expected_min_words: int
    issues: List[ValidationIssue] = field(default_factory=list)
    needs_recrawl: bool = False
    missing_sections: List[str] = field(default_factory=list)
    last_crawled: Optional[datetime] = None

    @property
    def critical_issues(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == "critical"]

    @property
    def warning_issues(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == "warning"]


class CompletenessValidator:
    """
    Validates completeness and quality of crawled sources
    """

    # Expected minimum word counts for known libraries
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
        "Azure Storage Blob": 100000,
        "Azure Functions": 150000,
        "Azure App Service": 150000,
        "Azure PostgreSQL": 100000,
        "n8n": 250000,
        "Qdrant": 200000,
        "Langfuse": 150000,
        "Flowise": 100000,
    }

    # Expected critical sections for specific libraries
    EXPECTED_SECTIONS = {
        "FastAPI": ["/tutorial/", "/reference/", "/advanced/"],
        "React": ["/learn/", "/reference/", "/blog/"],
        "Next.js": ["/docs/app/", "/docs/pages/", "/docs/api-reference/"],
        "TypeScript": ["/docs/handbook/", "/docs/handbook/type-checking"],
        "PostgreSQL": ["/docs/15/sql-", "/docs/15/tutorial-"],
        "Supabase": ["/docs/guides/database", "/docs/guides/auth", "/docs/reference/"],
        "TanStack Query": ["/docs/framework/react/guides/", "/docs/framework/react/reference/"],
    }

    def __init__(self, api_base: str = "http://localhost:8181"):
        """
        Initialize validator

        Args:
            api_base: Base URL for Archon backend API
        """
        self.api_base = api_base.rstrip('/')
        self.client = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()

    async def get_all_sources(self) -> List[dict]:
        """Fetch all sources from Archon"""
        try:
            response = await self.client.get(f"{self.api_base}/api/knowledge-items")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"Error fetching sources: {e}")
            return []

    async def get_source_pages(self, source_id: str) -> List[dict]:
        """
        Fetch all pages for a source

        This helps validate if critical sections are present
        """
        try:
            response = await self.client.get(
                f"{self.api_base}/api/knowledge-items/{source_id}/pages"
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"Error fetching pages for source {source_id}: {e}")
            return []

    def get_expected_word_count(self, library_name: str) -> int:
        """Get expected minimum word count for a library"""
        return self.EXPECTED_WORD_COUNTS.get(library_name, 50000)

    def check_word_count(
        self,
        library_name: str,
        actual_words: int,
        expected_words: int
    ) -> Optional[ValidationIssue]:
        """
        Check if word count meets expectations

        Returns ValidationIssue if below threshold, None if OK
        """
        if actual_words < expected_words:
            # Determine severity based on how far below
            percentage = (actual_words / expected_words) * 100 if expected_words > 0 else 0

            if percentage < 25:
                severity = "critical"
            elif percentage < 50:
                severity = "warning"
            else:
                severity = "info"

            return ValidationIssue(
                severity=severity,
                issue_type="word_count",
                message=f"Word count below expected: {actual_words:,} / {expected_words:,} ({percentage:.0f}%)",
                details=f"Expected at least {expected_words:,} words for {library_name}"
            )

        return None

    async def check_missing_sections(
        self,
        library_name: str,
        source_id: str,
        crawled_pages: List[dict]
    ) -> Tuple[List[str], Optional[ValidationIssue]]:
        """
        Check if critical sections are missing

        Returns:
            (missing_sections, validation_issue or None)
        """
        expected_sections = self.EXPECTED_SECTIONS.get(library_name, [])

        if not expected_sections:
            return [], None

        # Get all page URLs
        page_urls = [page.get("url", "") for page in crawled_pages]

        # Check which sections are missing
        missing = []
        for section in expected_sections:
            # Check if any page URL contains this section
            found = any(section in url for url in page_urls)
            if not found:
                missing.append(section)

        if missing:
            return missing, ValidationIssue(
                severity="warning",
                issue_type="missing_sections",
                message=f"Missing {len(missing)} expected sections",
                details=f"Missing sections: {', '.join(missing)}"
            )

        return [], None

    def check_for_errors(self, source_data: dict) -> Optional[ValidationIssue]:
        """
        Check for crawl errors in source metadata

        Looks for "429", "too many requests", "rate limit" in metadata
        """
        summary = source_data.get("summary", "").lower()
        display_name = source_data.get("display_name", "").lower()

        error_indicators = [
            "429",
            "too many requests",
            "rate limit",
            "rate-limit",
            "access denied",
            "forbidden",
        ]

        for indicator in error_indicators:
            if indicator in summary or indicator in display_name:
                return ValidationIssue(
                    severity="critical",
                    issue_type="errors",
                    message=f"Crawl errors detected: '{indicator}' found in metadata",
                    details="Source may have been rate-limited during crawl"
                )

        return None

    def check_staleness(
        self,
        last_updated: Optional[datetime],
        stale_threshold_days: int = 30
    ) -> Optional[ValidationIssue]:
        """
        Check if source is stale (> N days old)

        Note: Archon currently doesn't track last_updated in API response
        This is a placeholder for future functionality
        """
        if last_updated is None:
            return None

        age = datetime.now() - last_updated
        if age > timedelta(days=stale_threshold_days):
            return ValidationIssue(
                severity="info",
                issue_type="stale",
                message=f"Source is {age.days} days old",
                details=f"Consider refreshing if documentation has been updated"
            )

        return None

    async def validate_source(
        self,
        source_data: dict,
        library_name: Optional[str] = None
    ) -> ValidationResult:
        """
        Validate a single source for completeness

        Args:
            source_data: Source dict from Archon API
            library_name: Optional library name for enhanced validation

        Returns:
            ValidationResult with all issues found
        """
        source_id = source_data.get("source_id", "")
        url = source_data.get("url", "")
        word_count = source_data.get("word_count", 0)

        # Infer library name if not provided
        if not library_name:
            library_name = source_data.get("display_name", "Unknown")

        expected_words = self.get_expected_word_count(library_name)

        issues = []
        missing_sections = []

        # Check 1: Word count
        word_count_issue = self.check_word_count(library_name, word_count, expected_words)
        if word_count_issue:
            issues.append(word_count_issue)

        # Check 2: Crawl errors
        error_issue = self.check_for_errors(source_data)
        if error_issue:
            issues.append(error_issue)

        # Check 3: Missing sections (requires fetching pages)
        if library_name in self.EXPECTED_SECTIONS:
            pages = await self.get_source_pages(source_id)
            missing, section_issue = await self.check_missing_sections(
                library_name, source_id, pages
            )
            if section_issue:
                issues.append(section_issue)
                missing_sections = missing

        # Check 4: Staleness (placeholder - not yet in API)
        # stale_issue = self.check_staleness(last_updated)
        # if stale_issue:
        #     issues.append(stale_issue)

        # Determine if complete
        critical_issues = [i for i in issues if i.severity == "critical"]
        is_complete = len(critical_issues) == 0 and word_count >= expected_words

        # Determine if needs re-crawl
        needs_recrawl = (
            len(critical_issues) > 0 or
            word_count < (expected_words * 0.5) or  # Less than 50% expected
            len(missing_sections) > 0
        )

        return ValidationResult(
            source_id=source_id,
            library_name=library_name,
            url=url,
            is_complete=is_complete,
            word_count=word_count,
            expected_min_words=expected_words,
            issues=issues,
            needs_recrawl=needs_recrawl,
            missing_sections=missing_sections
        )

    async def validate_all_sources(self) -> List[ValidationResult]:
        """
        Validate all sources in the knowledge base

        Returns list of ValidationResults
        """
        print("🔍 Validating all sources in Archon knowledge base...")
        print()

        sources = await self.get_all_sources()
        print(f"Found {len(sources)} sources to validate\n")

        # Get library catalog for enhanced validation
        catalog = {lib["url"].rstrip('/'): lib["name"] for lib in get_all_libraries()}

        results = []
        for source in sources:
            # Try to match with library catalog
            source_url = source.get("url", "").rstrip('/')
            library_name = catalog.get(source_url) or source.get("display_name", "Unknown")

            result = await self.validate_source(source, library_name)
            results.append(result)

        return results

    def print_validation_report(self, results: List[ValidationResult]):
        """Print a formatted validation report"""
        print("=" * 80)
        print("📊 VALIDATION REPORT")
        print("=" * 80)
        print()

        complete = [r for r in results if r.is_complete]
        incomplete = [r for r in results if not r.is_complete]
        needs_recrawl = [r for r in results if r.needs_recrawl]

        print(f"Total sources: {len(results)}")
        print(f"Complete: {len(complete)} ({len(complete)*100//len(results) if results else 0}%)")
        print(f"Incomplete: {len(incomplete)} ({len(incomplete)*100//len(results) if results else 0}%)")
        print(f"Needs re-crawl: {len(needs_recrawl)}")
        print()

        if incomplete:
            print("⚠️  INCOMPLETE SOURCES")
            print("-" * 80)
            for result in incomplete:
                print(f"\n📘 {result.library_name}")
                print(f"   URL: {result.url}")
                print(f"   Words: {result.word_count:,} / {result.expected_min_words:,}")

                if result.critical_issues:
                    print(f"   🚨 Critical issues:")
                    for issue in result.critical_issues:
                        print(f"      - {issue.message}")

                if result.warning_issues:
                    print(f"   ⚠️  Warnings:")
                    for issue in result.warning_issues:
                        print(f"      - {issue.message}")

                if result.missing_sections:
                    print(f"   📋 Missing sections:")
                    for section in result.missing_sections:
                        print(f"      - {section}")

                if result.needs_recrawl:
                    print(f"   🔄 Recommendation: RE-CRAWL")

        print()
        print("=" * 80)

        # Summary stats
        total_words = sum(r.word_count for r in results)
        avg_words = total_words // len(results) if results else 0

        print(f"Total words in knowledge base: {total_words:,}")
        print(f"Average words per source: {avg_words:,}")
        print()

    async def export_validation_report(self, results: List[ValidationResult], output_file: str):
        """Export validation report to JSON"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "total_sources": len(results),
            "complete": len([r for r in results if r.is_complete]),
            "incomplete": len([r for r in results if not r.is_complete]),
            "needs_recrawl": len([r for r in results if r.needs_recrawl]),
            "sources": [
                {
                    "source_id": r.source_id,
                    "library_name": r.library_name,
                    "url": r.url,
                    "is_complete": r.is_complete,
                    "word_count": r.word_count,
                    "expected_min_words": r.expected_min_words,
                    "needs_recrawl": r.needs_recrawl,
                    "issues": [
                        {
                            "severity": i.severity,
                            "type": i.issue_type,
                            "message": i.message,
                            "details": i.details
                        }
                        for i in r.issues
                    ],
                    "missing_sections": r.missing_sections
                }
                for r in results
            ]
        }

        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"📄 Validation report exported to: {output_file}")


async def main():
    """Main entry point for completeness validation"""
    import argparse

    parser = argparse.ArgumentParser(description="Validate completeness of Archon knowledge base")
    parser.add_argument("--export", type=str, help="Export report to JSON file")
    parser.add_argument("--library", type=str, help="Validate specific library only")

    args = parser.parse_args()

    async with CompletenessValidator() as validator:
        results = await validator.validate_all_sources()

        # Filter by library if specified
        if args.library:
            results = [r for r in results if args.library.lower() in r.library_name.lower()]

        validator.print_validation_report(results)

        if args.export:
            output_path = os.path.join(os.path.dirname(__file__), '..', 'logs', args.export)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            await validator.export_validation_report(results, output_path)


if __name__ == "__main__":
    asyncio.run(main())
