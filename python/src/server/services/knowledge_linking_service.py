"""
Knowledge Linking Service Module for Archon

This module provides business logic for linking knowledge base items
(documents, code examples, RAG pages) to projects, tasks, and sprints.
Supports both manual linking and AI-powered suggestions.
"""

from datetime import datetime, timedelta
from typing import Any, Optional

from src.server.utils import get_supabase_client
from ..config.logfire_config import get_logger

logger = get_logger(__name__)

# Simple in-memory cache for AI suggestions (1 hour TTL)
_suggestion_cache = {}
_CACHE_TTL_SECONDS = 3600


class KnowledgeLinkingService:
    """Service class for knowledge linking operations"""

    VALID_SOURCE_TYPES = ["project", "task", "sprint"]
    VALID_KNOWLEDGE_TYPES = ["document", "code_example", "rag_page"]

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    async def link_knowledge(
        self,
        source_type: str,
        source_id: str,
        knowledge_type: str,
        knowledge_id: str,
        created_by: str,
        relevance_score: Optional[float] = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a link between a source entity and a knowledge item.

        Args:
            source_type: Type of source entity (project, task, sprint)
            source_id: UUID of the source entity
            knowledge_type: Type of knowledge item (document, code_example, rag_page)
            knowledge_id: UUID of the knowledge item
            created_by: User identifier or "ai-suggestion"
            relevance_score: Optional AI-suggested relevance (0.00-1.00)

        Returns:
            Tuple of (success, result_dict)
            result_dict contains link data or error message
        """
        try:
            # Validate source_type
            if source_type not in self.VALID_SOURCE_TYPES:
                return False, {
                    "error": f"Invalid source_type. Must be one of: {', '.join(self.VALID_SOURCE_TYPES)}"
                }

            # Validate knowledge_type
            if knowledge_type not in self.VALID_KNOWLEDGE_TYPES:
                return False, {
                    "error": f"Invalid knowledge_type. Must be one of: {', '.join(self.VALID_KNOWLEDGE_TYPES)}"
                }

            # Validate relevance_score if provided
            if relevance_score is not None and (relevance_score < 0 or relevance_score > 1):
                return False, {
                    "error": "relevance_score must be between 0.00 and 1.00"
                }

            # Create knowledge link (trigger will validate entity existence)
            link_data = {
                "source_type": source_type,
                "source_id": source_id,
                "knowledge_type": knowledge_type,
                "knowledge_id": knowledge_id,
                "created_by": created_by,
                "relevance_score": relevance_score,
            }

            link_response = (
                self.supabase_client.table("archon_knowledge_links")
                .insert(link_data)
                .execute()
            )

            if not link_response.data:
                return False, {"error": "Failed to create knowledge link"}

            link = link_response.data[0]

            # Fetch full knowledge item details
            knowledge_item = await self._get_knowledge_item(knowledge_type, knowledge_id)

            logger.info(
                f"Created knowledge link: {source_type} {source_id} -> {knowledge_type} {knowledge_id}"
            )
            return True, {
                "link": link,
                "knowledge_item": knowledge_item
            }

        except Exception as e:
            error_msg = str(e)
            if "duplicate key" in error_msg.lower():
                return False, {"error": "Knowledge link already exists"}
            elif "not found" in error_msg.lower():
                return False, {"error": error_msg}
            logger.error(f"Error creating knowledge link: {error_msg}")
            return False, {"error": error_msg}

    async def unlink_knowledge(self, link_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Remove a knowledge link.

        Args:
            link_id: UUID of the knowledge link

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Delete knowledge link
            delete_response = (
                self.supabase_client.table("archon_knowledge_links")
                .delete()
                .eq("id", link_id)
                .execute()
            )

            if not delete_response.data:
                return False, {"error": f"Knowledge link {link_id} not found"}

            logger.info(f"Removed knowledge link {link_id}")
            return True, {"message": "Knowledge link removed successfully"}

        except Exception as e:
            logger.error(f"Error removing knowledge link: {str(e)}")
            return False, {"error": str(e)}

    async def get_linked_knowledge(
        self, source_type: str, source_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all knowledge items linked to a source entity.

        Args:
            source_type: Type of source entity (project, task, sprint)
            source_id: UUID of the source entity

        Returns:
            Tuple of (success, result_dict)
            result_dict contains knowledge items list with link metadata
        """
        try:
            # Validate source_type
            if source_type not in self.VALID_SOURCE_TYPES:
                return False, {
                    "error": f"Invalid source_type. Must be one of: {', '.join(self.VALID_SOURCE_TYPES)}"
                }

            # Get all links for this source
            links_response = (
                self.supabase_client.table("archon_knowledge_links")
                .select("*")
                .eq("source_type", source_type)
                .eq("source_id", source_id)
                .order("relevance_score", desc=True)
                .execute()
            )

            links = links_response.data or []

            # Fetch full knowledge items for each link
            enriched_links = []
            for link in links:
                knowledge_item = await self._get_knowledge_item(
                    link["knowledge_type"],
                    link["knowledge_id"]
                )

                enriched_links.append({
                    **link,
                    "knowledge_item": knowledge_item
                })

            return True, {
                "links": enriched_links,
                "count": len(enriched_links)
            }

        except Exception as e:
            logger.error(f"Error getting linked knowledge: {str(e)}")
            return False, {"error": str(e)}

    async def get_knowledge_sources(
        self, knowledge_type: str, knowledge_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all source entities linked to a knowledge item (reverse lookup).

        Args:
            knowledge_type: Type of knowledge item (document, code_example, rag_page)
            knowledge_id: UUID of the knowledge item

        Returns:
            Tuple of (success, result_dict)
            result_dict contains source entities list
        """
        try:
            # Validate knowledge_type
            if knowledge_type not in self.VALID_KNOWLEDGE_TYPES:
                return False, {
                    "error": f"Invalid knowledge_type. Must be one of: {', '.join(self.VALID_KNOWLEDGE_TYPES)}"
                }

            # Get all links to this knowledge item
            links_response = (
                self.supabase_client.table("archon_knowledge_links")
                .select("*")
                .eq("knowledge_type", knowledge_type)
                .eq("knowledge_id", knowledge_id)
                .execute()
            )

            links = links_response.data or []

            # Group by source type and fetch source entities
            sources_by_type = {"projects": [], "tasks": [], "sprints": []}

            for link in links:
                source_type = link["source_type"]
                source_id = link["source_id"]

                # Fetch source entity details
                table_name = f"archon_{source_type}s"  # project -> archon_projects
                source_response = (
                    self.supabase_client.table(table_name)
                    .select("*")
                    .eq("id", source_id)
                    .execute()
                )

                if source_response.data:
                    source = source_response.data[0]
                    source["link_id"] = link["id"]
                    source["relevance_score"] = link["relevance_score"]
                    source["created_by"] = link["created_by"]

                    sources_by_type[f"{source_type}s"].append(source)

            total_count = sum(len(v) for v in sources_by_type.values())

            return True, {
                "sources": sources_by_type,
                "total_count": total_count
            }

        except Exception as e:
            logger.error(f"Error getting knowledge sources: {str(e)}")
            return False, {"error": str(e)}

    async def suggest_knowledge(
        self,
        source_type: str,
        source_id: str,
        limit: int = 5,
    ) -> tuple[bool, dict[str, Any]]:
        """
        AI-powered knowledge suggestions based on entity title and description.

        Uses pgvector cosine similarity to find relevant documents and code examples.
        Results are cached for 1 hour to improve performance.

        Args:
            source_type: Type of source entity (project, task, sprint)
            source_id: UUID of the source entity
            limit: Maximum number of suggestions to return (default: 5)

        Returns:
            Tuple of (success, result_dict)
            result_dict contains:
                - suggestions: List of knowledge items with relevance scores
                - count: Number of suggestions
                - cached: Whether results came from cache
        """
        try:
            # Validate source_type
            if source_type not in self.VALID_SOURCE_TYPES:
                return False, {
                    "error": f"Invalid source_type. Must be one of: {', '.join(self.VALID_SOURCE_TYPES)}"
                }

            # Check cache
            cache_key = f"{source_type}:{source_id}:{limit}"
            now = datetime.utcnow()
            if cache_key in _suggestion_cache:
                cached_data, cached_time = _suggestion_cache[cache_key]
                if (now - cached_time).total_seconds() < _CACHE_TTL_SECONDS:
                    logger.info(f"Cache hit for knowledge suggestions: {cache_key}")
                    return True, {
                        **cached_data,
                        "cached": True
                    }

            # Fetch source entity to get title and description
            table_name = f"archon_{source_type}s"
            source_response = (
                self.supabase_client.table(table_name)
                .select("*")
                .eq("id", source_id)
                .execute()
            )

            if not source_response.data:
                return False, {"error": f"{source_type.capitalize()} {source_id} not found"}

            source_entity = source_response.data[0]

            # Construct search query from title and description
            title = source_entity.get("title", "")
            description = source_entity.get("description", "")

            # For sprints, also include goal
            if source_type == "sprint":
                goal = source_entity.get("goal", "")
                search_query = f"{title} {description} {goal}".strip()
            else:
                search_query = f"{title} {description}".strip()

            if not search_query:
                return False, {"error": "Source entity has no title or description for AI search"}

            # Search archon_crawled_pages using pgvector similarity
            # Assuming embedding column exists and search function is available
            pages_suggestions = []
            try:
                # Use Supabase RPC to call similarity search function
                pages_response = self.supabase_client.rpc(
                    "search_knowledge_by_similarity",
                    {
                        "query_text": search_query,
                        "match_limit": limit,
                        "table_name": "archon_crawled_pages"
                    }
                ).execute()

                if pages_response.data:
                    for item in pages_response.data:
                        pages_suggestions.append({
                            "knowledge_id": item["id"],
                            "knowledge_type": "rag_page",
                            "title": item.get("section_title") or item.get("url"),
                            "url": item.get("url"),
                            "relevance_score": float(item.get("similarity", 0.0)),
                            "content_preview": item.get("content", "")[:200] + "..." if len(item.get("content", "")) > 200 else item.get("content", ""),
                            "source_id": item.get("source_id"),
                        })
            except Exception as e:
                logger.warning(f"Error searching crawled pages: {str(e)}")

            # Search archon_code_examples using pgvector similarity
            code_suggestions = []
            try:
                code_response = self.supabase_client.rpc(
                    "search_knowledge_by_similarity",
                    {
                        "query_text": search_query,
                        "match_limit": limit,
                        "table_name": "archon_code_examples"
                    }
                ).execute()

                if code_response.data:
                    for item in code_response.data:
                        code_suggestions.append({
                            "knowledge_id": item["id"],
                            "knowledge_type": "code_example",
                            "title": item.get("summary") or f"Code example from {item.get('source_id')}",
                            "language": item.get("language"),
                            "relevance_score": float(item.get("similarity", 0.0)),
                            "content_preview": item.get("code_snippet", "")[:200] + "..." if len(item.get("code_snippet", "")) > 200 else item.get("code_snippet", ""),
                            "source_id": item.get("source_id"),
                        })
            except Exception as e:
                logger.warning(f"Error searching code examples: {str(e)}")

            # Combine and sort by relevance_score
            all_suggestions = pages_suggestions + code_suggestions
            all_suggestions.sort(key=lambda x: x["relevance_score"], reverse=True)

            # Limit to requested number
            top_suggestions = all_suggestions[:limit]

            result = {
                "suggestions": top_suggestions,
                "count": len(top_suggestions),
                "cached": False
            }

            # Cache the result
            _suggestion_cache[cache_key] = (result, now)

            logger.info(
                f"Generated {len(top_suggestions)} AI knowledge suggestions for {source_type} {source_id}"
            )

            return True, result

        except Exception as e:
            logger.error(f"Error generating knowledge suggestions: {str(e)}")
            return False, {"error": str(e)}

    async def _get_knowledge_item(
        self, knowledge_type: str, knowledge_id: str
    ) -> Optional[dict[str, Any]]:
        """
        Internal method to fetch full knowledge item details.

        Args:
            knowledge_type: Type of knowledge item
            knowledge_id: UUID of the knowledge item

        Returns:
            Knowledge item dictionary or None if not found
        """
        try:
            if knowledge_type in ["document", "rag_page"]:
                # Fetch from archon_crawled_pages using page_id (UUID column)
                response = (
                    self.supabase_client.table("archon_crawled_pages")
                    .select("*")
                    .eq("page_id", knowledge_id)  # Fixed: use page_id instead of id
                    .execute()
                )
            elif knowledge_type == "code_example":
                # Fetch from archon_code_examples
                response = (
                    self.supabase_client.table("archon_code_examples")
                    .select("*")
                    .eq("id", knowledge_id)
                    .execute()
                )
            else:
                return None

            if response.data:
                item = response.data[0]
                # Add a preview of content (first 200 chars)
                if "content" in item and item["content"]:
                    item["content_preview"] = item["content"][:200] + "..." if len(item["content"]) > 200 else item["content"]
                return item

            return None

        except Exception as e:
            logger.error(f"Error fetching knowledge item: {str(e)}")
            return None
