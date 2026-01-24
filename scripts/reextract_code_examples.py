#!/usr/bin/env python3
"""
Re-extract code examples from sources with 0 code examples.

This script re-processes sources using optimized validation thresholds
(MIN_CODE_BLOCK_LENGTH=100, MAX_PROSE_RATIO=0.30, MIN_CODE_INDICATORS=2).
"""

import asyncio
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent / "python"
sys.path.insert(0, str(project_root))

from src.server.config.supabase_config import get_supabase_client
from src.server.services.crawling.code_extraction_service import CodeExtractionService
from src.server.config.logfire_config import get_logger

logger = get_logger(__name__)


async def get_sources_without_code_examples(supabase_client):
    """
    Find all sources with 0 code examples.

    Returns:
        List of source dictionaries with source_id, title, source_url
    """
    try:
        # Query sources without code examples
        result = supabase_client.rpc(
            "get_sources_without_code_examples"
        ).execute()

        # If RPC doesn't exist, fall back to direct query
        if not result.data:
            # Manual query: find sources with no code examples
            sources_result = supabase_client.table("archon_sources").select(
                "source_id, title, source_url, source_display_name"
            ).execute()

            code_examples = supabase_client.table("archon_code_examples").select(
                "source_id"
            ).execute()

            # Get set of source_ids that have code examples
            sources_with_code = {ex["source_id"] for ex in (code_examples.data or [])}

            # Filter to sources without code examples
            sources_without = [
                s for s in (sources_result.data or [])
                if s["source_id"] not in sources_with_code
            ]

            logger.info(f"Found {len(sources_without)} sources without code examples")
            return sources_without

        return result.data or []

    except Exception as e:
        logger.error(f"Error fetching sources without code examples: {e}", exc_info=True)
        return []


async def get_pages_for_source(supabase_client, source_id: str):
    """
    Get all pages for a source from archon_page_metadata.

    Args:
        supabase_client: Supabase client
        source_id: Source ID to get pages for

    Returns:
        List of page dictionaries with url, full_content
    """
    try:
        result = supabase_client.table("archon_page_metadata").select(
            "url, full_content"
        ).eq("source_id", source_id).execute()

        pages = result.data or []
        logger.info(f"Found {len(pages)} pages for source {source_id}")
        return pages

    except Exception as e:
        logger.error(f"Error fetching pages for source {source_id}: {e}", exc_info=True)
        return []


async def reextract_code_for_source(
    code_extraction_service: CodeExtractionService,
    source_id: str,
    pages: list,
    source_title: str
):
    """
    Re-extract code examples for a single source.

    Args:
        code_extraction_service: Code extraction service instance
        source_id: Source ID
        pages: List of page dictionaries
        source_title: Source title for logging

    Returns:
        Number of code examples extracted
    """
    if not pages:
        logger.warning(f"No pages found for source {source_id} ({source_title})")
        return 0

    try:
        # Reconstruct crawl_results format
        crawl_results = [
            {
                "url": page["url"],
                "markdown": page["full_content"]
            }
            for page in pages
            if page.get("full_content")
        ]

        if not crawl_results:
            logger.warning(f"No pages with content for source {source_id} ({source_title})")
            return 0

        # Create url_to_full_document mapping
        url_to_full_document = {
            page["url"]: page["full_content"]
            for page in pages
            if page.get("full_content")
        }

        logger.info(
            f"🔄 Re-extracting code for '{source_title}' | "
            f"source_id={source_id} | pages={len(crawl_results)}"
        )

        # Extract and store code examples
        code_count = await code_extraction_service.extract_and_store_code_examples(
            crawl_results=crawl_results,
            url_to_full_document=url_to_full_document,
            source_id=source_id,
            progress_callback=None,  # No progress callback for batch operation
            cancellation_check=None,
            provider="openai",  # Use default provider
            embedding_provider=None  # Use default embedding provider
        )

        logger.info(
            f"✅ Extracted {code_count} code examples for '{source_title}' | "
            f"source_id={source_id}"
        )

        return code_count

    except Exception as e:
        logger.error(
            f"❌ Failed to extract code for source {source_id} ({source_title}): {e}",
            exc_info=True
        )
        return 0


async def main():
    """Main re-extraction workflow."""
    logger.info("=" * 80)
    logger.info("Starting code example re-extraction for sources with 0 code examples")
    logger.info("=" * 80)

    # Initialize Supabase client
    supabase_client = get_supabase_client()
    code_extraction_service = CodeExtractionService(supabase_client)

    # Get sources without code examples
    logger.info("📋 Fetching sources without code examples...")
    sources = await get_sources_without_code_examples(supabase_client)

    if not sources:
        logger.info("✅ No sources need code re-extraction")
        return

    logger.info(f"Found {len(sources)} sources to process")

    # Statistics
    total_code_examples = 0
    sources_with_code = 0
    sources_failed = 0

    # Process each source
    for i, source in enumerate(sources, 1):
        source_id = source["source_id"]
        source_title = source.get("title") or source.get("source_display_name") or source.get("source_url", "Unknown")

        logger.info(f"\n{'=' * 80}")
        logger.info(f"Processing source {i}/{len(sources)}: {source_title}")
        logger.info(f"{'=' * 80}")

        # Get pages for this source
        pages = await get_pages_for_source(supabase_client, source_id)

        if not pages:
            logger.warning(f"⚠️ No pages found for source {source_id}, skipping")
            sources_failed += 1
            continue

        # Re-extract code examples
        code_count = await reextract_code_for_source(
            code_extraction_service,
            source_id,
            pages,
            source_title
        )

        if code_count > 0:
            sources_with_code += 1
            total_code_examples += code_count
        else:
            logger.info(f"ℹ️ No code examples found for '{source_title}'")

    # Final summary
    logger.info("\n" + "=" * 80)
    logger.info("Code Re-extraction Complete")
    logger.info("=" * 80)
    logger.info(f"Total sources processed: {len(sources)}")
    logger.info(f"Sources with code examples: {sources_with_code}")
    logger.info(f"Sources without code: {len(sources) - sources_with_code - sources_failed}")
    logger.info(f"Sources failed: {sources_failed}")
    logger.info(f"Total code examples extracted: {total_code_examples}")
    logger.info(f"Average per source: {total_code_examples / max(sources_with_code, 1):.1f}")
    logger.info("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
