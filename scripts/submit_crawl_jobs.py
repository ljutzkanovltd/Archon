#!/usr/bin/env python3
"""
Submit Crawl Jobs - Main CLI tool for Archon batch crawling
Orchestrates crawling with intelligent deduplication and progress tracking
"""

import asyncio
import sys
import os
import argparse
from typing import List, Optional
from datetime import datetime

# Import from same directory
from library_catalog_extended import (
    get_all_libraries,
    get_libraries_by_priority,
    get_libraries_by_tag,
    get_libraries_by_project
)

# Import our custom modules
from batch_crawler import BatchCrawlOrchestrator, CrawlResult
from crawl_diff_detector import CrawlDiffDetector, SourceStatus
from completeness_validator import CompletenessValidator


class CrawlJobSubmitter:
    """
    Main orchestrator for submitting crawl jobs
    Combines diff detection, validation, and batch crawling
    """

    def __init__(
        self,
        api_base: str = "http://localhost:8181",
        max_concurrent: int = 2,
        verbose: bool = False
    ):
        self.api_base = api_base
        self.max_concurrent = max_concurrent
        self.verbose = verbose

    async def submit_mode_missing(
        self,
        priority_filter: Optional[int] = None,
        dry_run: bool = False
    ) -> List[CrawlResult]:
        """
        Submit crawl jobs for missing (new) libraries only

        Args:
            priority_filter: Only crawl specific priority (1, 2, or 3)
            dry_run: Don't actually crawl
        """
        print("🎯 MODE: Missing Libraries (New)")
        print()

        async with CrawlDiffDetector(self.api_base) as detector:
            diff = await detector.compare_catalog_vs_crawled(priority_filter=priority_filter)

            if not diff.new:
                print("✨ No new libraries to crawl!")
                return []

            print(f"Found {len(diff.new)} new libraries to crawl\n")

            if dry_run:
                print("📋 Libraries to crawl (DRY RUN):")
                for lib in diff.new:
                    print(f"  - {lib['name']} (Priority {lib['priority']})")
                return []

            # Execute batch crawl
            async with BatchCrawlOrchestrator(
                self.api_base,
                self.max_concurrent
            ) as orchestrator:
                return await orchestrator.batch_crawl(
                    diff.new,
                    force_recrawl=False,
                    dry_run=dry_run
                )

    async def submit_mode_incomplete(
        self,
        priority_filter: Optional[int] = None,
        dry_run: bool = False
    ) -> List[CrawlResult]:
        """
        Submit crawl jobs for incomplete libraries

        Args:
            priority_filter: Only crawl specific priority
            dry_run: Don't actually crawl
        """
        print("🎯 MODE: Incomplete Libraries (Re-Crawl)")
        print()

        async with CrawlDiffDetector(self.api_base) as detector:
            diff = await detector.compare_catalog_vs_crawled(priority_filter=priority_filter)

            incomplete_libs = diff.incomplete + diff.missing_sections

            if not incomplete_libs:
                print("✨ No incomplete libraries found!")
                return []

            print(f"Found {len(incomplete_libs)} incomplete libraries:\n")

            for lib in incomplete_libs:
                print(f"  - {lib['name']}: {lib.get('reason', 'Unknown')}")

            print()

            if dry_run:
                print("📋 Would re-crawl these libraries (DRY RUN)")
                return []

            # Execute batch crawl with force re-crawl
            async with BatchCrawlOrchestrator(
                self.api_base,
                self.max_concurrent
            ) as orchestrator:
                return await orchestrator.batch_crawl(
                    incomplete_libs,
                    force_recrawl=True,
                    dry_run=dry_run
                )

    async def submit_mode_stale(
        self,
        priority_filter: Optional[int] = None,
        dry_run: bool = False
    ) -> List[CrawlResult]:
        """
        Submit crawl jobs for stale libraries (>30 days old)

        Note: Currently not implemented as Archon doesn't track last_updated
        This is a placeholder for future functionality
        """
        print("🎯 MODE: Stale Libraries (Refresh)")
        print()
        print("⚠️  Staleness tracking not yet implemented in Archon")
        print("    Using completeness validation instead...")
        print()

        # Fall back to incomplete mode
        return await self.submit_mode_incomplete(priority_filter, dry_run)

    async def submit_mode_all(
        self,
        priority_filter: Optional[int] = None,
        dry_run: bool = False
    ) -> List[CrawlResult]:
        """
        Submit crawl jobs for ALL actionable libraries
        (new + incomplete + missing_sections)
        """
        print("🎯 MODE: All Actionable Libraries")
        print()

        async with CrawlDiffDetector(self.api_base) as detector:
            diff = await detector.compare_catalog_vs_crawled(priority_filter=priority_filter)

            actionable = diff.get_actionable()

            if not actionable:
                print("✨ All libraries are up to date!")
                return []

            print(f"Found {len(actionable)} actionable libraries:")
            print(f"  - New: {len(diff.new)}")
            print(f"  - Incomplete: {len(diff.incomplete)}")
            print(f"  - Missing sections: {len(diff.missing_sections)}")
            print()

            if dry_run:
                detector.print_detailed_report(diff)
                return []

            # Execute batch crawl
            async with BatchCrawlOrchestrator(
                self.api_base,
                self.max_concurrent
            ) as orchestrator:
                return await orchestrator.batch_crawl(
                    actionable,
                    force_recrawl=True,
                    dry_run=dry_run
                )

    async def submit_specific_library(
        self,
        library_name: str,
        dry_run: bool = False
    ) -> List[CrawlResult]:
        """
        Submit crawl job for a specific library

        Args:
            library_name: Name of library to crawl
            dry_run: Don't actually crawl
        """
        print(f"🎯 MODE: Specific Library - '{library_name}'")
        print()

        # Find library in catalog
        all_libs = get_all_libraries()
        matching = [
            lib for lib in all_libs
            if library_name.lower() in lib["name"].lower()
        ]

        if not matching:
            print(f"❌ Library '{library_name}' not found in catalog")
            print("\nAvailable libraries:")
            for lib in sorted(all_libs, key=lambda x: x["name"])[:20]:
                print(f"  - {lib['name']}")
            if len(all_libs) > 20:
                print(f"  ... and {len(all_libs) - 20} more")
            return []

        if len(matching) > 1:
            print(f"⚠️  Multiple matches found:")
            for lib in matching:
                print(f"  - {lib['name']}")
            print("\nPlease be more specific")
            return []

        library = matching[0]
        print(f"Found: {library['name']}")
        print(f"URL: {library['url']}")
        print(f"Priority: {library['priority']}")
        print()

        if dry_run:
            print("📋 Would crawl this library (DRY RUN)")
            return []

        # Execute crawl
        async with BatchCrawlOrchestrator(
            self.api_base,
            self.max_concurrent
        ) as orchestrator:
            return await orchestrator.batch_crawl(
                [library],
                force_recrawl=True,
                dry_run=dry_run
            )

    async def validate_only(self, priority_filter: Optional[int] = None):
        """
        Just validate existing sources, don't crawl
        """
        print("🔍 MODE: Validation Only (No Crawling)")
        print()

        async with CompletenessValidator(self.api_base) as validator:
            results = await validator.validate_all_sources()

            # Filter by priority if needed
            if priority_filter:
                catalog = {lib["url"].rstrip('/'): lib for lib in get_libraries_by_priority(priority_filter)}
                results = [
                    r for r in results
                    if r.url.rstrip('/') in catalog
                ]

            validator.print_validation_report(results)

            # Save report
            output_file = f"validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            output_path = os.path.join(os.path.dirname(__file__), '..', 'logs', output_file)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            await validator.export_validation_report(results, output_path)


async def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Submit crawl jobs to Archon knowledge base",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Crawl all missing Tier 1 libraries
  python submit_crawl_jobs.py --mode missing --priority 1

  # Re-crawl incomplete sources
  python submit_crawl_jobs.py --mode incomplete

  # Crawl specific library
  python submit_crawl_jobs.py --library "Supabase"

  # Dry run (show what would be crawled)
  python submit_crawl_jobs.py --mode all --dry-run

  # Just validate, don't crawl
  python submit_crawl_jobs.py --mode validate

  # Crawl Azure services only
  python submit_crawl_jobs.py --tag azure --batch-size 3

  # Crawl with higher concurrency (use with caution!)
  python submit_crawl_jobs.py --mode missing --batch-size 3 --priority 1
        """
    )

    parser.add_argument(
        "--mode",
        choices=["missing", "incomplete", "stale", "all", "validate"],
        default="all",
        help="Crawl mode: missing (new only), incomplete (re-crawl), stale (refresh), all (actionable), validate (check only)"
    )

    parser.add_argument(
        "--priority",
        type=int,
        choices=[1, 2, 3],
        help="Only crawl libraries with this priority (1=Critical, 2=High, 3=Medium)"
    )

    parser.add_argument(
        "--library",
        type=str,
        help="Crawl specific library by name (e.g., 'Supabase', 'FastAPI')"
    )

    parser.add_argument(
        "--tag",
        type=str,
        help="Only crawl libraries with this tag (e.g., 'azure')"
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=2,
        help="Max concurrent crawls (default: 2, recommended: 2-3)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be crawled without actually crawling"
    )

    parser.add_argument(
        "--api-base",
        type=str,
        default="http://localhost:8181",
        help="Archon backend API base URL (default: http://localhost:8181)"
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output"
    )

    args = parser.parse_args()

    # Validate batch size
    if args.batch_size > 3:
        print("⚠️  WARNING: Batch size > 3 may overload the system")
        print("    Recommended: 2-3 concurrent crawls")
        print()
        response = input("Continue anyway? (y/N): ")
        if response.lower() != 'y':
            print("Aborted")
            return

    # Create submitter
    submitter = CrawlJobSubmitter(
        api_base=args.api_base,
        max_concurrent=args.batch_size,
        verbose=args.verbose
    )

    # Execute based on mode
    try:
        if args.library:
            # Specific library mode
            results = await submitter.submit_specific_library(
                args.library,
                dry_run=args.dry_run
            )

        elif args.mode == "validate":
            # Validation only
            await submitter.validate_only(priority_filter=args.priority)
            return

        elif args.mode == "missing":
            # New libraries only
            results = await submitter.submit_mode_missing(
                priority_filter=args.priority,
                dry_run=args.dry_run
            )

        elif args.mode == "incomplete":
            # Incomplete libraries
            results = await submitter.submit_mode_incomplete(
                priority_filter=args.priority,
                dry_run=args.dry_run
            )

        elif args.mode == "stale":
            # Stale libraries
            results = await submitter.submit_mode_stale(
                priority_filter=args.priority,
                dry_run=args.dry_run
            )

        else:  # args.mode == "all"
            # All actionable libraries
            results = await submitter.submit_mode_all(
                priority_filter=args.priority,
                dry_run=args.dry_run
            )

        # Print final summary
        if not args.dry_run and results:
            print("\n" + "=" * 80)
            print("🏁 FINAL SUMMARY")
            print("=" * 80)

            successful = sum(1 for r in results if r.success)
            failed = sum(1 for r in results if not r.success)
            total_words = sum(r.word_count for r in results if r.success)

            print(f"Total jobs: {len(results)}")
            print(f"Successful: {successful}")
            print(f"Failed: {failed}")
            print(f"Total words added: {total_words:,}")
            print()

            if failed > 0:
                print("❌ Failed jobs:")
                for result in results:
                    if not result.success:
                        print(f"  - {result.library_name}: {result.status}")

    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        print("Note: Some crawls may still be running in the background")
        sys.exit(1)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
