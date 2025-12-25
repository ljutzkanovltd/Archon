#!/usr/bin/env python3
"""
Re-crawl missing Computer Vision libraries
Targets only the 13 libraries that failed or were not crawled
"""

import asyncio
import sys
from library_catalog_extended import get_libraries_by_project
from batch_crawler import BatchCrawlOrchestrator

# Missing CV libraries identified from validation
MISSING_CV_LIBRARIES = [
    "OpenCV Docs Master",
    "OpenCV.js",
    "OpenCV Contrib",
    "OpenCV Python Package",
    "OpenCV Official Site",
    "Detectron2",
    "MMDetection",
    "Norfair",
    "ONNXRuntime Mobile",
    "ONNXRuntime WebGPU",
    "Roboflow Supervision",
    "Roboflow Notebooks",
    "SoccerNet",
]

async def main():
    """Re-crawl missing CV libraries"""

    # Get all CV libraries
    all_cv_libs = get_libraries_by_project("computer_vision")

    # Filter to only missing libraries
    missing_libs = [
        lib for lib in all_cv_libs
        if lib["name"] in MISSING_CV_LIBRARIES
    ]

    # Sort by priority (Priority 1 first)
    missing_libs_sorted = sorted(missing_libs, key=lambda x: x["priority"])

    print("=" * 80)
    print("RE-CRAWL MISSING CV LIBRARIES")
    print("=" * 80)
    print(f"\nTotal missing libraries: {len(missing_libs_sorted)}")
    print(f"Priority 1: {sum(1 for lib in missing_libs_sorted if lib['priority'] == 1)}")
    print(f"Priority 2: {sum(1 for lib in missing_libs_sorted if lib['priority'] == 2)}")
    print(f"Priority 3: {sum(1 for lib in missing_libs_sorted if lib['priority'] == 3)}")
    print("\nLibraries to re-crawl:")
    for lib in missing_libs_sorted:
        print(f"  - {lib['name']} (P{lib['priority']})")
    print()

    # Crawl with batch size 2 (safe configuration)
    api_base = "http://localhost:8181"
    max_concurrent = 2

    async with BatchCrawlOrchestrator(api_base, max_concurrent) as orchestrator:
        results = await orchestrator.batch_crawl(
            missing_libs_sorted,
            force_recrawl=True,  # Force re-crawl even if exists
            dry_run=False
        )

    # Print summary
    print("\n" + "=" * 80)
    print("RE-CRAWL SUMMARY")
    print("=" * 80)

    successful = sum(1 for r in results if r.success)
    failed = sum(1 for r in results if not r.success)
    total_words = sum(r.word_count for r in results if r.success)

    print(f"Total jobs: {len(results)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Total words crawled: {total_words:,}")
    print()

    if successful > 0:
        print("✅ Successfully crawled:")
        for result in results:
            if result.success:
                print(f"  - {result.library_name}: {result.word_count:,} words")
        print()

    if failed > 0:
        print("❌ Failed jobs:")
        for result in results:
            if not result.success:
                print(f"  - {result.library_name}: {result.status}")
        print()

    print(f"\n{'='*80}")
    print("NEXT STEPS")
    print(f"{'='*80}")
    if failed > 0:
        print("1. Review failed crawls and retry if needed")
    print("2. Run validation: python submit_crawl_jobs.py --mode validate")
    print("3. Proceed with remaining Priority 1 non-CV libraries")
    print()

if __name__ == "__main__":
    asyncio.run(main())
