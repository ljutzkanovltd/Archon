#!/usr/bin/env python3
"""
Archon Documentation Auto-Crawler
Automatically queues and processes documentation sources
Run with: nohup python3 scripts/auto-crawl-docs.py > crawl-progress.log 2>&1 &
"""

import json
import time
import requests
import sys
from datetime import datetime
from typing import Dict, List, Optional

# Configuration
API_BASE = "http://localhost:8181"
MAX_CONCURRENT = 2  # Reduced from 3 to lower DB pressure
CHECK_INTERVAL = 30  # seconds between progress checks

# Documentation sources to crawl (in priority order)
# Format: (url, title, tags_list)
SOURCES = [
    # Tier 1: llms.txt sources (fast)
    # Note: Supabase, Zod, Stripe already started - will be monitored

    # Tier 2: Important framework docs
    ("https://fastapi.tiangolo.com", "FastAPI Documentation", ["fastapi", "python", "api", "backend"]),
    ("https://tailwindcss.com/docs", "Tailwind CSS v4 Documentation", ["tailwind", "css", "ui", "styling"]),
    ("https://react.dev", "React Documentation", ["react", "frontend", "ui", "components"]),
    ("https://tanstack.com/query/latest", "TanStack Query Documentation", ["tanstack", "query", "react", "data-fetching"]),

    # Tier 3: State management & forms
    ("https://zustand-demo.pmnd.rs", "Zustand State Management", ["zustand", "state", "react"]),
    ("https://react-hook-form.com", "React Hook Form", ["forms", "validation", "react"]),

    # Tier 4: UI Components
    ("https://www.radix-ui.com/primitives", "Radix UI Primitives", ["radix", "ui", "components", "accessibility"]),
    ("https://ui.shadcn.com", "shadcn/ui Components", ["shadcn", "ui", "components", "tailwind"]),
    ("https://lucide.dev", "Lucide Icons", ["icons", "lucide", "ui"]),

    # Tier 5: Testing
    ("https://playwright.dev/docs", "Playwright Testing", ["playwright", "testing", "e2e"]),
    ("https://vitest.dev", "Vitest Testing Framework", ["vitest", "testing", "unit"]),
    ("https://docs.pytest.org/en/stable", "pytest Documentation", ["pytest", "python", "testing"]),

    # Tier 6: AI/ML
    ("https://docs.ultralytics.com", "Ultralytics YOLO", ["yolo", "cv", "object-detection", "ml"]),
    ("https://www.sbert.net", "Sentence Transformers", ["embeddings", "nlp", "transformers"]),

    # Tier 7: Database & Backend
    ("https://www.sqlalchemy.org", "SQLAlchemy ORM", ["sqlalchemy", "orm", "database", "python"]),
    ("https://docs.pydantic.dev/latest", "Pydantic Core Documentation", ["pydantic", "validation", "python"]),
]

# Track state
active_crawls: Dict[str, str] = {}  # progress_id -> url
completed = 0
failed = 0
source_index = 0


def log(level: str, msg: str):
    """Log with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}", flush=True)


def log_info(msg): log("INFO", msg)
def log_success(msg): log("SUCCESS", msg)
def log_error(msg): log("ERROR", msg)
def log_warn(msg): log("WARN", msg)


def check_api() -> bool:
    """Check if API is available"""
    try:
        resp = requests.get(f"{API_BASE}/health", timeout=5)
        return resp.status_code == 200
    except Exception as e:
        log_error(f"API not available: {e}")
        return False


def get_indexed_sources() -> List[str]:
    """Get already indexed source URLs"""
    try:
        resp = requests.get(f"{API_BASE}/api/rag/sources", timeout=10)
        data = resp.json()
        urls = []
        for source in data.get("sources", []):
            url = source.get("metadata", {}).get("original_url", "")
            if url:
                urls.append(url)
        return urls
    except Exception as e:
        log_warn(f"Could not fetch indexed sources: {e}")
        return []


def start_crawl(url: str, title: str, tags: List[str]) -> Optional[str]:
    """Start a new crawl, returns progress_id or None"""
    log_info(f"Starting crawl: {title}")

    try:
        resp = requests.post(
            f"{API_BASE}/api/knowledge-items/crawl",
            json={
                "url": url,
                "title": title,
                "knowledge_type": "technical",
                "tags": tags
            },
            timeout=30
        )
        data = resp.json()

        if data.get("success"):
            progress_id = data.get("progressId")
            if progress_id:
                log_success(f"Crawl started: {title} (ID: {progress_id})")
                return progress_id

        log_error(f"Failed to start crawl: {data}")
        return None
    except Exception as e:
        log_error(f"Error starting crawl for {url}: {e}")
        return None


def check_crawl_progress(progress_id: str, url: str) -> str:
    """
    Check crawl progress
    Returns: "running", "completed", "failed"
    """
    try:
        resp = requests.get(f"{API_BASE}/api/crawl-progress/{progress_id}", timeout=10)
        data = resp.json()

        status = data.get("status", "unknown")
        progress = data.get("progress", 0)
        total_pages = data.get("totalPages", "?")
        processed = data.get("processedPages", 0)

        if status in ("completed", "complete"):
            log_success(f"Completed: {url} ({processed}/{total_pages} pages)")
            return "completed"
        elif status in ("error", "failed"):
            log_error(f"Failed: {url}")
            return "failed"
        else:
            log_info(f"Progress: {url} - {progress:.0f}% ({processed}/{total_pages} pages) [{status}]")
            return "running"
    except Exception as e:
        log_warn(f"Error checking progress for {progress_id}: {e}")
        return "running"  # Assume still running


def main():
    global active_crawls, completed, failed, source_index

    log_info("=" * 50)
    log_info("Archon Auto-Crawler Started")
    log_info(f"Total sources to queue: {len(SOURCES)}")
    log_info(f"Max concurrent crawls: {MAX_CONCURRENT}")
    log_info(f"Check interval: {CHECK_INTERVAL}s")
    log_info("=" * 50)

    # Start fresh - no active crawls (previous progress IDs invalid after restart)
    # Already indexed sources will be skipped via get_indexed_sources()
    active_crawls = {}
    log_info("Starting fresh (will skip already indexed sources)")

    # Get already indexed sources
    indexed_urls = get_indexed_sources()
    log_info(f"Already indexed: {len(indexed_urls)} sources")

    while True:
        # Check API availability
        if not check_api():
            log_warn("API unavailable, waiting 60s...")
            time.sleep(60)
            continue

        # Check progress of active crawls
        to_remove = []
        for progress_id, url in list(active_crawls.items()):
            result = check_crawl_progress(progress_id, url)
            if result == "completed":
                to_remove.append(progress_id)
                completed += 1
            elif result == "failed":
                to_remove.append(progress_id)
                failed += 1

        for pid in to_remove:
            del active_crawls[pid]

        # Start new crawls if we have capacity
        while len(active_crawls) < MAX_CONCURRENT and source_index < len(SOURCES):
            url, title, tags = SOURCES[source_index]
            source_index += 1

            # Skip if already indexed
            if any(url in indexed for indexed in indexed_urls):
                log_info(f"Skipping (already indexed): {title}")
                continue

            progress_id = start_crawl(url, title, tags)
            if progress_id:
                active_crawls[progress_id] = url

            # Small delay between starting crawls
            time.sleep(2)

        # Check if we're done
        if source_index >= len(SOURCES) and len(active_crawls) == 0:
            log_info("=" * 50)
            log_success("All crawls completed!")
            log_info(f"Completed: {completed}")
            log_info(f"Failed: {failed}")
            log_info("=" * 50)
            break

        # Status summary
        queued = len(SOURCES) - source_index
        log_info(f"Status: Active={len(active_crawls)}, Queued={queued}, Completed={completed}, Failed={failed}")

        # Wait before next check
        time.sleep(CHECK_INTERVAL)

    log_info("Crawler finished. Check dashboard at http://localhost:3737")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log_info("Crawler stopped by user. Active crawls will continue on server.")
    except Exception as e:
        log_error(f"Unexpected error: {e}")
        sys.exit(1)
