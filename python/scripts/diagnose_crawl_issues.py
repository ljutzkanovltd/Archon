#!/usr/bin/env python3
"""
Diagnostic Script for Crawl Issues

This script diagnoses common crawling problems by:
1. Checking for failed queue items
2. Analyzing validation errors
3. Counting data in database tables
4. Identifying orphaned progress tracking
5. Providing actionable recommendations

Usage:
    python scripts/diagnose_crawl_issues.py
    python scripts/diagnose_crawl_issues.py --source-id <source_id>
    python scripts/diagnose_crawl_issues.py --hours 48
"""

import argparse
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.server.utils import get_supabase_client
from src.config.logfire_config import safe_logfire_info, safe_logfire_error


class CrawlDiagnostics:
    """Diagnostic tool for crawl issues."""

    def __init__(self):
        """Initialize diagnostics with Supabase client."""
        self.supabase = get_supabase_client()
        self.issues_found = []
        self.recommendations = []

    async def run_diagnostics(
        self, source_id: str | None = None, hours: int = 24
    ) -> Dict[str, Any]:
        """
        Run comprehensive diagnostics.

        Args:
            source_id: Specific source to diagnose (optional)
            hours: Hours to look back for queue items (default: 24)

        Returns:
            Dict with diagnostic results
        """
        print(f"\n{'='*80}")
        print(f"ARCHON CRAWL DIAGNOSTICS")
        print(f"{'='*80}\n")
        print(f"Timestamp: {datetime.utcnow().isoformat()}")
        print(f"Looking back: {hours} hours")
        if source_id:
            print(f"Source ID: {source_id}")
        print(f"\n{'-'*80}\n")

        results = {
            "queue_items": await self.check_queue_items(hours, source_id),
            "data_counts": await self.check_data_counts(source_id),
            "validation_errors": await self.check_validation_errors(hours, source_id),
            "orphaned_progress": await self.check_orphaned_progress(),
            "issues_found": self.issues_found,
            "recommendations": self.recommendations,
        }

        self.print_summary(results)
        return results

    async def check_queue_items(
        self, hours: int, source_id: str | None = None
    ) -> Dict[str, Any]:
        """Check queue items for failures."""
        print(f"📋 Checking Queue Items (last {hours}h)...")

        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        try:
            query = (
                self.supabase.table("archon_crawl_queue")
                .select("*")
                .gte("created_at", cutoff_time.isoformat())
            )

            if source_id:
                query = query.eq("source_id", source_id)

            result = query.order("created_at", desc=True).execute()

            items = result.data if result.data else []

            # Group by status
            status_counts = {}
            failed_items = []
            for item in items:
                status = item.get("status", "unknown")
                status_counts[status] = status_counts.get(status, 0) + 1

                if status == "failed":
                    failed_items.append(item)

            print(f"  Total items: {len(items)}")
            for status, count in status_counts.items():
                emoji = {
                    "completed": "✅",
                    "failed": "❌",
                    "running": "🔄",
                    "pending": "⏳",
                    "paused": "⏸️",
                }.get(status, "❓")
                print(f"  {emoji} {status.upper()}: {count}")

            if failed_items:
                print(f"\n  ⚠️  Found {len(failed_items)} FAILED items:")
                for item in failed_items[:5]:  # Show first 5
                    print(f"    - {item['item_id'][:8]}...")
                    print(f"      Source: {item['source_id']}")
                    print(f"      Error: {item.get('error_message', 'No message')}")
                    print(f"      Type: {item.get('error_type', 'unknown')}")
                    print(f"      Retries: {item.get('retry_count', 0)}")
                    print()

                self.issues_found.append(
                    f"Found {len(failed_items)} failed queue items"
                )
                self.recommendations.append(
                    "Review failed items in CrawlQueueMonitor at http://localhost:3738/knowledge-base"
                )

            return {
                "total": len(items),
                "status_counts": status_counts,
                "failed_items": failed_items,
            }

        except Exception as e:
            error_msg = f"Failed to query queue items: {e}"
            print(f"  ❌ {error_msg}")
            self.issues_found.append(error_msg)
            return {"error": str(e)}

    async def check_data_counts(self, source_id: str | None = None) -> Dict[str, Any]:
        """Check data counts in database tables."""
        print(f"\n📊 Checking Data Counts...")

        try:
            # Get sources (optionally filtered)
            if source_id:
                sources_result = (
                    self.supabase.table("archon_sources")
                    .select("source_id, title, updated_at")
                    .eq("source_id", source_id)
                    .execute()
                )
            else:
                sources_result = (
                    self.supabase.table("archon_sources")
                    .select("source_id, title, updated_at")
                    .order("updated_at", desc=True)
                    .limit(10)
                    .execute()
                )

            sources = sources_result.data if sources_result.data else []
            print(f"  Analyzing {len(sources)} sources...")
            print()

            source_data = []
            for source in sources:
                sid = source["source_id"]
                title = source["title"][:40]

                # Count pages
                pages_result = (
                    self.supabase.table("archon_page_metadata")
                    .select("id", count="exact")
                    .eq("source_id", sid)
                    .execute()
                )
                pages_count = pages_result.count if pages_result.count else 0

                # Count chunks
                chunks_result = (
                    self.supabase.table("archon_crawled_pages")
                    .select("id", count="exact")
                    .eq("source_id", sid)
                    .execute()
                )
                chunks_count = chunks_result.count if chunks_result.count else 0

                # Count code examples
                code_result = (
                    self.supabase.table("archon_code_examples")
                    .select("id", count="exact")
                    .eq("source_id", sid)
                    .execute()
                )
                code_count = code_result.count if code_result.count else 0

                # Check for issues
                has_issue = False
                issue_type = ""

                if pages_count == 0 and chunks_count == 0 and code_count == 0:
                    has_issue = True
                    issue_type = "NO DATA"
                elif pages_count == 0 and chunks_count == 0:
                    has_issue = True
                    issue_type = "NO PAGES/CHUNKS"
                elif pages_count > 0 and chunks_count == 0:
                    has_issue = True
                    issue_type = "NO CHUNKS (validation fail)"

                status_emoji = "❌" if has_issue else "✅"
                print(f"  {status_emoji} {title}")
                print(f"      Source ID: {sid[:16]}...")
                print(f"      Pages: {pages_count}, Chunks: {chunks_count}, Code: {code_count}")

                if has_issue:
                    print(f"      ⚠️  ISSUE: {issue_type}")
                    self.issues_found.append(
                        f"Source '{title}' has issue: {issue_type}"
                    )

                print()

                source_data.append(
                    {
                        "source_id": sid,
                        "title": title,
                        "pages": pages_count,
                        "chunks": chunks_count,
                        "code_examples": code_count,
                        "has_issue": has_issue,
                        "issue_type": issue_type,
                    }
                )

            # Summary
            issues_count = sum(1 for s in source_data if s["has_issue"])
            if issues_count > 0:
                self.recommendations.append(
                    f"Check crawl logs for sources with no data - they may have failed validation"
                )
                self.recommendations.append(
                    f"Verify embedding API keys are configured correctly in Settings"
                )

            return {"sources": source_data, "issues_count": issues_count}

        except Exception as e:
            error_msg = f"Failed to check data counts: {e}"
            print(f"  ❌ {error_msg}")
            self.issues_found.append(error_msg)
            return {"error": str(e)}

    async def check_validation_errors(
        self, hours: int, source_id: str | None = None
    ) -> Dict[str, Any]:
        """Check for validation-specific errors."""
        print(f"\n🔍 Checking Validation Errors (last {hours}h)...")

        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        try:
            query = (
                self.supabase.table("archon_crawl_queue")
                .select("*")
                .eq("status", "failed")
                .eq("error_type", "validation_failed")
                .gte("created_at", cutoff_time.isoformat())
            )

            if source_id:
                query = query.eq("source_id", source_id)

            result = query.order("created_at", desc=True).execute()
            validation_errors = result.data if result.data else []

            print(f"  Found {len(validation_errors)} validation failures")

            if validation_errors:
                print(f"\n  Validation Error Details:")
                for item in validation_errors[:3]:  # Show first 3
                    print(f"    - Item: {item['item_id'][:8]}...")
                    print(f"      Source: {item['source_id']}")
                    print(f"      Error: {item.get('error_message', 'No message')}")

                    error_details = item.get("error_details", {})
                    if isinstance(error_details, dict):
                        validation_result = error_details.get("validation_result", {})
                        if validation_result:
                            print(f"      Pages: {validation_result.get('pages_count', 0)}")
                            print(f"      Chunks: {validation_result.get('chunks_count', 0)}")
                            print(
                                f"      Code Examples: {validation_result.get('code_examples_count', 0)}"
                            )
                    print()

                self.issues_found.append(
                    f"Found {len(validation_errors)} validation failures"
                )
                self.recommendations.append(
                    "Validation is failing - check if crawls are creating pages/chunks"
                )
                self.recommendations.append(
                    "Review crawling_service.py orchestrate_crawl() for errors"
                )

            return {"validation_errors": validation_errors}

        except Exception as e:
            error_msg = f"Failed to check validation errors: {e}"
            print(f"  ❌ {error_msg}")
            return {"error": str(e)}

    async def check_orphaned_progress(self) -> Dict[str, Any]:
        """Check for orphaned progress tracking (ProgressTracker in-memory state)."""
        print(f"\n🔄 Checking Progress Tracking...")

        # NOTE: ProgressTracker is in-memory, so we can only check via API
        # This is a placeholder for future implementation

        print(f"  ℹ️  Progress tracking is in-memory (check via /api/progress/list)")
        self.recommendations.append(
            "If direct crawls are stuck, check http://localhost:8181/api/progress/list"
        )

        return {"note": "Progress tracking check requires API endpoint"}

    def print_summary(self, results: Dict[str, Any]):
        """Print diagnostic summary."""
        print(f"\n{'='*80}")
        print(f"DIAGNOSTIC SUMMARY")
        print(f"{'='*80}\n")

        # Issues
        if self.issues_found:
            print(f"❌ ISSUES FOUND ({len(self.issues_found)}):")
            for i, issue in enumerate(self.issues_found, 1):
                print(f"  {i}. {issue}")
            print()
        else:
            print(f"✅ No issues found!\n")

        # Recommendations
        if self.recommendations:
            print(f"💡 RECOMMENDATIONS ({len(self.recommendations)}):")
            for i, rec in enumerate(self.recommendations, 1):
                print(f"  {i}. {rec}")
            print()

        print(f"{'='*80}\n")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Diagnose Archon crawl issues")
    parser.add_argument(
        "--source-id", type=str, help="Specific source ID to diagnose (optional)"
    )
    parser.add_argument(
        "--hours",
        type=int,
        default=24,
        help="Hours to look back for queue items (default: 24)",
    )

    args = parser.parse_args()

    diagnostics = CrawlDiagnostics()
    results = await diagnostics.run_diagnostics(
        source_id=args.source_id, hours=args.hours
    )

    # Exit code based on issues found
    exit_code = 0 if not results["issues_found"] else 1
    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
