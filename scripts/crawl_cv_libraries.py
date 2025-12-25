#!/usr/bin/env python3
"""
Crawl all Computer Vision libraries in priority order
Executes batch crawling for CV project libraries
"""

import asyncio
import sys
from library_catalog_extended import get_libraries_by_project
from batch_crawler import BatchCrawlOrchestrator

async def main():
    """Main entry point for CV library crawling"""

    # Get all CV libraries
    cv_libs = get_libraries_by_project("computer_vision")

    # Sort by priority (1 first, then 2, then 3)
    cv_libs_sorted = sorted(cv_libs, key=lambda x: x["priority"])

    print("=" * 80)
    print("COMPUTER VISION LIBRARY CRAWL")
    print("=" * 80)
    print(f"\nTotal CV libraries: {len(cv_libs_sorted)}")
    print(f"Priority 1: {sum(1 for lib in cv_libs_sorted if lib['priority'] == 1)}")
    print(f"Priority 2: {sum(1 for lib in cv_libs_sorted if lib['priority'] == 2)}")
    print(f"Priority 3: {sum(1 for lib in cv_libs_sorted if lib['priority'] == 3)}")
    print()

    # Crawl with batch size 2 (user's preference)
    api_base = "http://localhost:8181"
    max_concurrent = 2

    async with BatchCrawlOrchestrator(api_base, max_concurrent) as orchestrator:
        results = await orchestrator.batch_crawl(
            cv_libs_sorted,
            force_recrawl=False,  # Skip already crawled
            dry_run=False
        )

    # Print summary
    print("\n" + "=" * 80)
    print("CRAWL SUMMARY")
    print("=" * 80)

    successful = sum(1 for r in results if r.success)
    failed = sum(1 for r in results if not r.success)
    total_words = sum(r.word_count for r in results if r.success)

    print(f"Total jobs: {len(results)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Total words crawled: {total_words:,}")
    print()

    if failed > 0:
        print("❌ Failed jobs:")
        for result in results:
            if not result.success:
                print(f"  - {result.library_name}: {result.status}")

    print("\n✅ Crawl complete!")

if __name__ == "__main__":
    asyncio.run(main())
