#!/usr/bin/env python3
"""Simple code re-extraction WITHOUT AI summary generation - LET DATABASE GENERATE ID."""

import asyncio
import sys
import os
import re
from datetime import datetime, UTC

os.chdir('/app')
sys.path.insert(0, '/app')

from src.server.services.client_manager import get_supabase_client

def extract_code_blocks_from_markdown(markdown: str):
    """Extract code blocks from markdown content."""
    # Pattern for fenced code blocks with language
    pattern = r'```(\w+)?\n(.*?)```'
    matches = re.findall(pattern, markdown, re.DOTALL)

    code_blocks = []
    for language, code in matches:
        code = code.strip()
        if len(code) >= 100:  # MIN_CODE_BLOCK_LENGTH = 100
            code_blocks.append({
                'language': language or 'plaintext',
                'content': code
            })

    return code_blocks


async def main():
    """Main re-extraction workflow."""
    print("=" * 80)
    print("Simple Code Re-extraction (No AI Summaries) - WORKING VERSION")
    print("=" * 80)

    supabase_client = get_supabase_client()

    # Get all sources
    sources_result = supabase_client.table("archon_sources").select(
        "source_id, title, source_url, source_display_name"
    ).execute()

    all_sources = sources_result.data or []
    print(f"\n📋 Total sources: {len(all_sources)}")

    # Get sources that already have code examples
    code_examples = supabase_client.table("archon_code_examples").select(
        "source_id"
    ).execute()

    sources_with_code = {ex["source_id"] for ex in (code_examples.data or [])}
    print(f"✅ Sources with code: {len(sources_with_code)}")

    # Filter to sources without code examples
    sources_without = [
        s for s in all_sources
        if s["source_id"] not in sources_with_code
    ]

    print(f"🔄 Sources to process: {len(sources_without)}\n")

    if not sources_without:
        print("✅ No sources need re-extraction")
        return

    # Statistics
    total_code_examples = 0
    sources_with_new_code = 0

    # Process each source
    for i, source in enumerate(sources_without, 1):
        source_id = source["source_id"]
        source_title = (
            source.get("title") or
            source.get("source_display_name") or
            source.get("source_url", "Unknown")
        )

        print(f"\n[{i}/{len(sources_without)}] {source_title[:60]}")

        try:
            # Get pages for this source
            pages_result = supabase_client.table("archon_page_metadata").select(
                "url, full_content"
            ).eq("source_id", source_id).execute()

            pages = pages_result.data or []

            if not pages:
                print(f"  ⚠️ No pages")
                continue

            # Extract code blocks from all pages
            all_code_blocks = []
            for page in pages:
                if not page.get("full_content"):
                    continue

                blocks = extract_code_blocks_from_markdown(page["full_content"])
                for block in blocks:
                    all_code_blocks.append({
                        'url': page['url'],
                        'language': block['language'],
                        'content': block['content']
                    })

            if not all_code_blocks:
                print(f"  ℹ️ No code blocks found")
                continue

            print(f"  📝 Found {len(all_code_blocks)} code blocks")

            # Store code examples (batch insert)
            code_examples_to_insert = []
            chunk_counter = {}  # Track chunk numbers per URL

            for block in all_code_blocks:
                url = block['url']

                # Get next chunk_number for this URL
                if url not in chunk_counter:
                    chunk_counter[url] = 0
                chunk_counter[url] += 1

                code_examples_to_insert.append({
                    # NO 'id' field - let database auto-generate
                    'source_id': source_id,
                    'url': url,
                    'chunk_number': chunk_counter[url],
                    'content': block['content'],
                    'summary': f"{block['language']} code example",
                    'metadata': {},
                    'created_at': datetime.now(UTC).isoformat(),
                })

            # Insert in batches of 50
            batch_size = 50
            inserted = 0
            for i in range(0, len(code_examples_to_insert), batch_size):
                batch = code_examples_to_insert[i:i+batch_size]
                try:
                    supabase_client.table("archon_code_examples").insert(batch).execute()
                    inserted += len(batch)
                except Exception as e:
                    print(f"  ⚠️ Batch insert error: {e}")

            if inserted > 0:
                print(f"  ✅ Inserted {inserted} code examples")
                sources_with_new_code += 1
                total_code_examples += inserted

        except Exception as e:
            print(f"  ❌ Error: {e}")

    # Final summary
    print("\n" + "=" * 80)
    print("COMPLETE")
    print("=" * 80)
    print(f"Sources processed: {len(sources_without)}")
    print(f"Sources with code: {sources_with_new_code}")
    print(f"Total code examples: {total_code_examples}")
    if sources_with_new_code > 0:
        print(f"Average per source: {total_code_examples / sources_with_new_code:.1f}")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
