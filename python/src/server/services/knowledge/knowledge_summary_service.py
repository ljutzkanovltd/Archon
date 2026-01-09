"""
Knowledge Summary Service

Provides lightweight summary data for knowledge items to minimize data transfer.
Optimized for frequent polling and card displays.
"""

import time
from typing import Any, Optional

from ...config.logfire_config import safe_logfire_info, safe_logfire_error, safe_logfire_warning, search_logger


class KnowledgeSummaryService:
    """
    Service for providing lightweight knowledge item summaries.
    Designed for efficient polling with minimal data transfer.
    """

    def __init__(self, supabase_client):
        """
        Initialize the knowledge summary service.

        Args:
            supabase_client: The Supabase client for database operations
        """
        self.supabase = supabase_client

    async def get_summaries(
        self,
        page: int = 1,
        per_page: int = 20,
        knowledge_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Get lightweight summaries of knowledge items.
        
        Returns only essential data needed for card displays:
        - Basic metadata (title, url, type, tags)
        - Counts only (no actual content)
        - Minimal processing overhead
        
        Args:
            page: Page number (1-based)
            per_page: Items per page
            knowledge_type: Optional filter by knowledge type
            search: Optional search term
            
        Returns:
            Dict with minimal item summaries and pagination info
        """
        try:
            request_start = time.time()
            safe_logfire_info(f"Fetching knowledge summaries | page={page} | per_page={per_page}")

            # Build base query - select only needed fields, including source_url
            query = self.supabase.from_("archon_sources").select(
                "source_id, title, summary, metadata, source_url, created_at, updated_at"
            )

            # Apply filters
            if knowledge_type:
                query = query.contains("metadata", {"knowledge_type": knowledge_type})

            if search:
                search_pattern = f"%{search}%"
                query = query.or_(
                    f"title.ilike.{search_pattern},summary.ilike.{search_pattern}"
                )

            # Get total count
            count_start = time.time()
            count_query = self.supabase.from_("archon_sources").select(
                "*", count="exact", head=True
            )

            if knowledge_type:
                count_query = count_query.contains("metadata", {"knowledge_type": knowledge_type})

            if search:
                search_pattern = f"%{search}%"
                count_query = count_query.or_(
                    f"title.ilike.{search_pattern},summary.ilike.{search_pattern}"
                )

            count_result = count_query.execute()
            total = count_result.count if hasattr(count_result, "count") else 0
            count_time = time.time() - count_start

            if count_time > 1.0:
                search_logger.warning(f"⚠️  Slow count query | duration={count_time:.2f}s | page={page}")
            else:
                search_logger.info(f"✅ Count query completed | duration={count_time:.3f}s | total={total}")
            
            # Apply pagination
            start_idx = (page - 1) * per_page
            query = query.range(start_idx, start_idx + per_page - 1)
            query = query.order("updated_at", desc=True)

            # Execute main query
            sources_start = time.time()
            result = query.execute()
            sources = result.data if result.data else []
            sources_time = time.time() - sources_start

            if sources_time > 1.0:
                search_logger.warning(f"⚠️  Slow sources query | duration={sources_time:.2f}s | count={len(sources)}")
            else:
                search_logger.info(f"✅ Sources query completed | duration={sources_time:.3f}s | count={len(sources)}")

            # Get source IDs for batch operations
            source_ids = [s["source_id"] for s in sources]

            # Batch fetch counts only (no content!)
            summaries = []

            if source_ids:
                # Get both counts in a single efficient query (replaces N*2 individual queries)
                counts_start = time.time()
                doc_counts, code_counts = await self._get_counts_batch(source_ids)
                counts_time = time.time() - counts_start

                if counts_time > 1.0:
                    search_logger.warning(f"⚠️  Slow bulk counts query | duration={counts_time:.2f}s | sources={len(source_ids)}")
                else:
                    search_logger.info(f"✅ Bulk counts query completed | duration={counts_time:.3f}s | sources={len(source_ids)}")

                # Get first URLs in a single query
                urls_start = time.time()
                first_urls = await self._get_first_urls_batch(source_ids)
                urls_time = time.time() - urls_start

                if urls_time > 1.0:
                    search_logger.warning(f"⚠️  Slow first URLs query | duration={urls_time:.2f}s | sources={len(source_ids)}")
                else:
                    search_logger.info(f"✅ First URLs query completed | duration={urls_time:.3f}s | sources={len(source_ids)}")
                
                # Build summaries
                for source in sources:
                    source_id = source["source_id"]
                    metadata = source.get("metadata", {})
                    
                    # Use the original source_url from the source record (the URL the user entered)
                    # Fall back to first crawled page URL, then to source:// format as last resort
                    source_url = source.get("source_url")
                    if source_url:
                        first_url = source_url
                    else:
                        first_url = first_urls.get(source_id, f"source://{source_id}")
                    
                    source_type = metadata.get("source_type", "file" if first_url.startswith("file://") else "url")
                    
                    # Extract knowledge_type - check metadata first, otherwise default based on source content
                    # The metadata should always have it if it was crawled properly
                    knowledge_type = metadata.get("knowledge_type")
                    if not knowledge_type:
                        # Fallback: If not in metadata, default to "technical" for now
                        # This handles legacy data that might not have knowledge_type set
                        safe_logfire_info(f"Knowledge type not found in metadata for {source_id}, defaulting to technical")
                        knowledge_type = "technical"
                    
                    summary = {
                        "source_id": source_id,
                        "title": source.get("title", source.get("summary", "Untitled")),
                        "url": first_url,
                        "status": "active",  # Always active for now
                        "document_count": doc_counts.get(source_id, 0),
                        "code_examples_count": code_counts.get(source_id, 0),
                        "knowledge_type": knowledge_type,
                        "source_type": source_type,
                        "created_at": source.get("created_at"),
                        "updated_at": source.get("updated_at"),
                        "metadata": metadata,  # Include full metadata (contains tags)
                    }
                    summaries.append(summary)

            # Log overall request performance
            request_time = time.time() - request_start

            if request_time > 2.0:
                search_logger.warning(
                    f"⚠️  Slow knowledge summaries request | total_duration={request_time:.2f}s | "
                    f"count={len(summaries)} | total={total} | page={page}"
                )
            else:
                search_logger.info(
                    f"✅ Knowledge summaries fetched | total_duration={request_time:.3f}s | "
                    f"count={len(summaries)} | total={total} | page={page}"
                )

            return {
                "items": summaries,
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page if per_page > 0 else 0,
            }
            
        except Exception as e:
            safe_logfire_error(f"Failed to get knowledge summaries | error={str(e)}")
            raise
    
    async def _get_counts_batch(self, source_ids: list[str]) -> tuple[dict[str, int], dict[str, int]]:
        """
        Get both document and code example counts for multiple sources in a single efficient query.

        Uses the get_bulk_source_counts() PostgreSQL function deployed in migration 0.3.0/002.
        This replaces N*2 individual queries with a single batch query, reducing load time by ~92%.

        Args:
            source_ids: List of source IDs

        Returns:
            Tuple of (doc_counts dict, code_counts dict)
        """
        try:
            if not source_ids:
                return {}, {}

            # Use the optimized bulk count function (single query for all sources)
            result = self.supabase.rpc("get_bulk_source_counts", {"source_ids": source_ids}).execute()

            if hasattr(result, "error") and result.error is not None:
                safe_logfire_error(f"Bulk counts query failed | error={result.error}")
                return {sid: 0 for sid in source_ids}, {sid: 0 for sid in source_ids}

            # Transform results into separate dictionaries
            doc_counts = {}
            code_counts = {}

            for row in result.data or []:
                source_id = row["source_id"]
                doc_counts[source_id] = row["documents_count"]
                code_counts[source_id] = row["code_examples_count"]

            # Ensure all source_ids have counts (default to 0)
            for sid in source_ids:
                if sid not in doc_counts:
                    doc_counts[sid] = 0
                if sid not in code_counts:
                    code_counts[sid] = 0

            safe_logfire_info(f"Bulk counts retrieved | sources={len(source_ids)} | total_docs={sum(doc_counts.values())} | total_code={sum(code_counts.values())}")

            return doc_counts, code_counts

        except Exception as e:
            safe_logfire_error(f"Failed to get bulk counts | error={str(e)}")
            return {sid: 0 for sid in source_ids}, {sid: 0 for sid in source_ids}
    
    async def _get_first_urls_batch(self, source_ids: list[str]) -> dict[str, str]:
        """
        Get first URL for each source in a batch.
        
        Args:
            source_ids: List of source IDs
            
        Returns:
            Dict mapping source_id to first URL
        """
        try:
            # Get all first URLs in one query
            result = (
                self.supabase.from_("archon_crawled_pages")
                .select("source_id, url")
                .in_("source_id", source_ids)
                .order("created_at", desc=False)
                .execute()
            )
            
            # Group by source_id, keeping first URL for each
            urls = {}
            for item in result.data or []:
                source_id = item["source_id"]
                if source_id not in urls:
                    urls[source_id] = item["url"]
            
            # Provide defaults for any missing
            for source_id in source_ids:
                if source_id not in urls:
                    urls[source_id] = f"source://{source_id}"
            
            return urls
            
        except Exception as e:
            safe_logfire_error(f"Failed to get first URLs | error={str(e)}")
            return {sid: f"source://{sid}" for sid in source_ids}