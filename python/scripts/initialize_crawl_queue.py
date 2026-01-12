#!/usr/bin/env python3
"""
Crawl Queue Initialization Script

This script populates the crawl queue with all sources from the archon_sources table,
organizing them into batches and assigning priorities based on knowledge type.

Usage:
    python scripts/initialize_crawl_queue.py [options]

Options:
    --dry-run           Show what would be added without actually adding
    --batch-size N      Number of sources per batch (default: 5)
    --priority-high N   Priority for llms.txt sources (default: 100)
    --priority-normal N Priority for sitemap sources (default: 50)
    --api-url URL       Backend API URL (default: http://localhost:8181)
    --help              Show this help message

Examples:
    # Dry run to see what would be added
    python scripts/initialize_crawl_queue.py --dry-run

    # Add all sources with default settings
    python scripts/initialize_crawl_queue.py

    # Custom batch size and priorities
    python scripts/initialize_crawl_queue.py --batch-size 10 --priority-high 90 --priority-normal 40
"""

import argparse
import json
import sys
from datetime import datetime
from typing import Any, Dict, List

import requests
from postgrest import APIError
from supabase import Client, create_client

# Configuration
DEFAULT_API_URL = "http://localhost:8181"
DEFAULT_BATCH_SIZE = 5
DEFAULT_PRIORITY_HIGH = 100  # llms.txt sources (fast, single file)
DEFAULT_PRIORITY_NORMAL = 50  # Regular sitemap sources


def get_supabase_client() -> Client:
    """Create Supabase client using environment variables or config."""
    import os

    from dotenv import load_dotenv

    # Load .env from project root
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    load_dotenv(env_path)

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment or .env file"
        )

    return create_client(supabase_url, supabase_key)


def fetch_all_sources(supabase: Client) -> List[Dict[str, Any]]:
    """Fetch all sources from archon_sources table."""
    print("📊 Fetching all sources from database...")

    try:
        response = supabase.table("archon_sources").select("*").execute()
        sources = response.data

        print(f"✅ Found {len(sources)} sources in database")
        return sources

    except APIError as e:
        print(f"❌ Error fetching sources: {e}")
        sys.exit(1)


def categorize_sources(
    sources: List[Dict[str, Any]], priority_high: int, priority_normal: int
) -> List[Dict[str, Any]]:
    """
    Categorize sources by type and assign priorities.

    Priority logic:
    - llms.txt sources: HIGH priority (fast, single file downloads)
    - Sitemap/regular sources: NORMAL priority
    """
    categorized = []

    for source in sources:
        url = source.get("source_url", "")
        metadata = source.get("metadata", {})
        knowledge_type = metadata.get("knowledge_type", "")

        # Determine priority based on URL and knowledge type
        if "llms.txt" in url or "llms-full.txt" in url:
            priority = priority_high
            category = "llms.txt"
        else:
            priority = priority_normal
            category = "sitemap"

        categorized.append(
            {
                "source_id": source["source_id"],
                "source_url": url,
                "display_name": source.get("source_display_name", source.get("title", "Unknown")),
                "knowledge_type": knowledge_type,
                "priority": priority,
                "category": category,
                "metadata": metadata,
            }
        )

    # Sort by priority (high to low) then by display name
    categorized.sort(key=lambda x: (-x["priority"], x["display_name"]))

    return categorized


def create_batches(sources: List[Dict[str, Any]], batch_size: int) -> List[List[Dict[str, Any]]]:
    """Group sources into batches of specified size."""
    batches = []
    for i in range(0, len(sources), batch_size):
        batch = sources[i : i + batch_size]
        batches.append(batch)
    return batches


def add_batch_to_queue(api_url: str, batch: List[Dict[str, Any]], batch_number: int, dry_run: bool) -> bool:
    """
    Add a batch of sources to the crawl queue via API.

    Args:
        api_url: Backend API URL
        batch: List of source items
        batch_number: Batch sequence number (for logging)
        dry_run: If True, don't actually add to queue

    Returns:
        True if successful, False otherwise
    """
    endpoint = f"{api_url}/api/crawl-queue/add-batch"

    # Prepare request payload
    source_ids = [item["source_id"] for item in batch]
    priorities = {item["source_id"]: item["priority"] for item in batch}

    payload = {"source_ids": source_ids, "priorities": priorities}

    if dry_run:
        print(f"\n🔹 Batch {batch_number} (DRY RUN - would add {len(batch)} sources):")
        for item in batch:
            print(f"   - [{item['category']}] {item['display_name']} (priority: {item['priority']})")
        return True

    try:
        print(f"\n🔹 Adding Batch {batch_number} ({len(batch)} sources)...")
        response = requests.post(endpoint, json=payload, timeout=30)
        response.raise_for_status()

        result = response.json()
        batch_id = result.get("batch_id")

        print(f"✅ Batch {batch_number} added successfully (batch_id: {batch_id})")
        for item in batch:
            print(f"   - [{item['category']}] {item['display_name']} (priority: {item['priority']})")

        return True

    except requests.exceptions.RequestException as e:
        print(f"❌ Error adding batch {batch_number}: {e}")
        if hasattr(e, "response") and e.response is not None:
            try:
                error_detail = e.response.json()
                print(f"   Error detail: {error_detail}")
            except json.JSONDecodeError:
                print(f"   Raw response: {e.response.text}")
        return False


def print_summary(categorized_sources: List[Dict[str, Any]], batches: List[List[Dict[str, Any]]]):
    """Print summary statistics before processing."""
    total = len(categorized_sources)
    llms_count = sum(1 for s in categorized_sources if s["category"] == "llms.txt")
    sitemap_count = sum(1 for s in categorized_sources if s["category"] == "sitemap")

    print("\n" + "=" * 80)
    print("📋 CRAWL QUEUE INITIALIZATION SUMMARY")
    print("=" * 80)
    print(f"Total sources:        {total}")
    print(f"  - llms.txt:         {llms_count} (high priority)")
    print(f"  - sitemap/regular:  {sitemap_count} (normal priority)")
    print(f"\nBatches to create:    {len(batches)}")
    print(f"Sources per batch:    {len(batches[0])} (last batch may have fewer)")
    print("=" * 80 + "\n")


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(
        description="Initialize crawl queue with all sources from database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would be added without actually adding")
    parser.add_argument(
        "--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help=f"Sources per batch (default: {DEFAULT_BATCH_SIZE})"
    )
    parser.add_argument(
        "--priority-high",
        type=int,
        default=DEFAULT_PRIORITY_HIGH,
        help=f"Priority for llms.txt sources (default: {DEFAULT_PRIORITY_HIGH})",
    )
    parser.add_argument(
        "--priority-normal",
        type=int,
        default=DEFAULT_PRIORITY_NORMAL,
        help=f"Priority for sitemap sources (default: {DEFAULT_PRIORITY_NORMAL})",
    )
    parser.add_argument("--api-url", type=str, default=DEFAULT_API_URL, help=f"Backend API URL (default: {DEFAULT_API_URL})")

    args = parser.parse_args()

    # Validate arguments
    if args.batch_size < 1:
        print("❌ Error: batch-size must be at least 1")
        sys.exit(1)

    print("🚀 Archon Crawl Queue Initialization")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 80)

    if args.dry_run:
        print("⚠️  DRY RUN MODE - No changes will be made")
        print("-" * 80)

    # Step 1: Connect to database
    try:
        supabase = get_supabase_client()
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        sys.exit(1)

    # Step 2: Fetch all sources
    sources = fetch_all_sources(supabase)

    if not sources:
        print("⚠️  No sources found in database. Nothing to add to queue.")
        sys.exit(0)

    # Step 3: Categorize and prioritize
    print("\n📊 Categorizing sources by type and priority...")
    categorized = categorize_sources(sources, args.priority_high, args.priority_normal)

    # Step 4: Group into batches
    print(f"📦 Creating batches of {args.batch_size} sources...")
    batches = create_batches(categorized, args.batch_size)

    # Step 5: Print summary
    print_summary(categorized, batches)

    # Step 6: Confirm before proceeding (unless dry-run)
    if not args.dry_run:
        print("⚠️  This will add all sources to the crawl queue and start processing.")
        confirm = input("   Continue? [y/N]: ")
        if confirm.lower() != "y":
            print("❌ Aborted by user")
            sys.exit(0)
        print()

    # Step 7: Add batches to queue
    successful = 0
    failed = 0

    for i, batch in enumerate(batches, start=1):
        if add_batch_to_queue(args.api_url, batch, i, args.dry_run):
            successful += 1
        else:
            failed += 1

    # Step 8: Final summary
    print("\n" + "=" * 80)
    print("✅ INITIALIZATION COMPLETE")
    print("=" * 80)
    print(f"Total batches:        {len(batches)}")
    print(f"  - Successful:       {successful}")
    print(f"  - Failed:           {failed}")
    print(f"\nTotal sources added:  {successful * args.batch_size} (approximately)")
    print("=" * 80)

    if args.dry_run:
        print("\n⚠️  This was a DRY RUN. Run without --dry-run to actually add sources to queue.")
    else:
        print("\n🎉 Queue is now populated and worker will begin processing shortly.")
        print(f"   Monitor progress: {args.api_url}/api/crawl-queue/status")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
