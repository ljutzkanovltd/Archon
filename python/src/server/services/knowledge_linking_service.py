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

    async def get_source_linked_projects(
        self, source_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all projects linked to a KB source (backlinks).

        Phase 1.2: Backlinks Endpoint

        Args:
            source_id: ID of the knowledge source

        Returns:
            Tuple of (success, result_dict)
            result_dict contains:
                - source_id: The source ID
                - linked_projects: List of projects with link metadata
                - total_links: Count of linked projects
        """
        try:
            # Verify source exists
            source_response = (
                self.supabase_client.table("archon_sources")
                .select("*")
                .eq("source_id", source_id)
                .execute()
            )

            if not source_response.data:
                return False, {"error": f"Knowledge source {source_id} not found"}

            # Get all pages for this source
            pages_response = (
                self.supabase_client.table("archon_crawled_pages")
                .select("page_id")
                .eq("source_id", source_id)
                .execute()
            )

            page_ids = [p["page_id"] for p in (pages_response.data or [])]

            if not page_ids:
                # Source exists but has no pages
                return True, {
                    "source_id": source_id,
                    "linked_projects": [],
                    "total_links": 0,
                }

            # Get all links for these pages to projects
            links_response = (
                self.supabase_client.table("archon_knowledge_links")
                .select("*")
                .eq("source_type", "project")
                .eq("knowledge_type", "rag_page")
                .in_("knowledge_id", page_ids)
                .execute()
            )

            links = links_response.data or []

            # Get unique project IDs
            project_ids = list(set(link["source_id"] for link in links))

            if not project_ids:
                return True, {
                    "source_id": source_id,
                    "linked_projects": [],
                    "total_links": 0,
                }

            # Fetch project details
            projects_response = (
                self.supabase_client.table("archon_projects")
                .select("id, title, created_at")
                .in_("id", project_ids)
                .execute()
            )

            projects = projects_response.data or []

            # Create project lookup
            project_lookup = {p["id"]: p for p in projects}

            # Build linked_projects list with earliest link timestamp per project
            linked_projects = []
            project_links = {}

            for link in links:
                proj_id = link["source_id"]
                if proj_id not in project_links:
                    project_links[proj_id] = {
                        "created_at": link["created_at"],
                        "created_by": link["created_by"],
                    }
                else:
                    # Keep earliest link
                    if link["created_at"] < project_links[proj_id]["created_at"]:
                        project_links[proj_id] = {
                            "created_at": link["created_at"],
                            "created_by": link["created_by"],
                        }

            for proj_id, link_meta in project_links.items():
                if proj_id in project_lookup:
                    proj = project_lookup[proj_id]
                    linked_projects.append({
                        "project_id": proj["id"],
                        "project_title": proj["title"],
                        "linked_at": link_meta["created_at"],
                        "linked_by": link_meta["created_by"],
                    })

            # Sort by linked_at DESC
            linked_projects.sort(key=lambda x: x["linked_at"], reverse=True)

            return True, {
                "source_id": source_id,
                "linked_projects": linked_projects,
                "total_links": len(linked_projects),
            }

        except Exception as e:
            logger.error(f"Error getting source linked projects: {str(e)}")
            return False, {"error": str(e)}

    async def link_source_to_project(
        self,
        project_id: str,
        source_id: str,
        linked_by: str,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Link all pages from a KB source to a project.

        Phase 1.3: Link Endpoint

        Args:
            project_id: UUID of the project
            source_id: ID of the knowledge source
            linked_by: User who created the link

        Returns:
            Tuple of (success, result_dict)
            result_dict contains:
                - links_created: Number of links created
                - source: Source details
        """
        try:
            # Verify project exists
            project_response = (
                self.supabase_client.table("archon_projects")
                .select("*")
                .eq("id", project_id)
                .execute()
            )

            if not project_response.data:
                return False, {"error": f"Project {project_id} not found"}

            # Verify source exists
            source_response = (
                self.supabase_client.table("archon_sources")
                .select("*")
                .eq("source_id", source_id)
                .execute()
            )

            if not source_response.data:
                return False, {"error": f"Knowledge source {source_id} not found"}

            source = source_response.data[0]

            # Get all pages for this source
            pages_response = (
                self.supabase_client.table("archon_crawled_pages")
                .select("page_id")
                .eq("source_id", source_id)
                .execute()
            )

            pages = pages_response.data or []

            if not pages:
                return False, {"error": f"Source {source_id} has no indexed pages"}

            # Check if any links already exist
            existing_links_response = (
                self.supabase_client.table("archon_knowledge_links")
                .select("knowledge_id")
                .eq("source_type", "project")
                .eq("source_id", project_id)
                .eq("knowledge_type", "rag_page")
                .in_("knowledge_id", [p["page_id"] for p in pages])
                .execute()
            )

            existing_page_ids = set(
                link["knowledge_id"] for link in (existing_links_response.data or [])
            )

            # Create links for pages that aren't already linked
            links_to_create = []
            for page in pages:
                if page["page_id"] not in existing_page_ids:
                    links_to_create.append({
                        "source_type": "project",
                        "source_id": project_id,
                        "knowledge_type": "rag_page",
                        "knowledge_id": page["page_id"],
                        "created_by": linked_by,
                    })

            if not links_to_create:
                return False, {
                    "error": f"All pages from source {source_id} already linked to project"
                }

            # Batch insert links
            insert_response = (
                self.supabase_client.table("archon_knowledge_links")
                .insert(links_to_create)
                .execute()
            )

            links_created = len(insert_response.data or [])

            logger.info(
                f"Created {links_created} links from source {source_id} to project {project_id}"
            )

            return True, {
                "links_created": links_created,
                "source": source,
            }

        except Exception as e:
            logger.error(f"Error linking source to project: {str(e)}")
            return False, {"error": str(e)}

    async def unlink_source_from_project(
        self,
        project_id: str,
        source_id: str,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Remove all links between KB source and project.

        Phase 1.3: Unlink Endpoint

        Args:
            project_id: UUID of the project
            source_id: ID of the knowledge source

        Returns:
            Tuple of (success, result_dict)
            result_dict contains:
                - links_removed: Number of links removed
                - message: Success message
        """
        try:
            # Verify project exists
            project_response = (
                self.supabase_client.table("archon_projects")
                .select("id")
                .eq("id", project_id)
                .execute()
            )

            if not project_response.data:
                return False, {"error": f"Project {project_id} not found"}

            # Verify source exists
            source_response = (
                self.supabase_client.table("archon_sources")
                .select("source_id")
                .eq("source_id", source_id)
                .execute()
            )

            if not source_response.data:
                return False, {"error": f"Knowledge source {source_id} not found"}

            # Get all pages for this source
            pages_response = (
                self.supabase_client.table("archon_crawled_pages")
                .select("page_id")
                .eq("source_id", source_id)
                .execute()
            )

            page_ids = [p["page_id"] for p in (pages_response.data or [])]

            if not page_ids:
                return False, {"error": f"Source {source_id} has no indexed pages"}

            # Delete all links
            delete_response = (
                self.supabase_client.table("archon_knowledge_links")
                .delete()
                .eq("source_type", "project")
                .eq("source_id", project_id)
                .eq("knowledge_type", "rag_page")
                .in_("knowledge_id", page_ids)
                .execute()
            )

            links_removed = len(delete_response.data or [])

            if links_removed == 0:
                return False, {
                    "error": f"No links found between source {source_id} and project {project_id}"
                }

            logger.info(
                f"Removed {links_removed} links from source {source_id} to project {project_id}"
            )

            return True, {
                "links_removed": links_removed,
                "message": "Links removed successfully",
            }

        except Exception as e:
            logger.error(f"Error unlinking source from project: {str(e)}")
            return False, {"error": str(e)}

    async def suggest_knowledge(
        self,
        source_type: str,
        source_id: str,
        limit: int = 5,
        include_linked: bool = False,
    ) -> tuple[bool, dict[str, Any]]:
        """
        AI-powered knowledge suggestions based on entity title and description.

        Uses pgvector cosine similarity to find relevant documents and code examples.
        Results are cached for 1 hour to improve performance.

        Phase 1.4: Enhanced with include_linked parameter

        Args:
            source_type: Type of source entity (project, task, sprint)
            source_id: UUID of the source entity
            limit: Maximum number of suggestions to return (default: 5)
            include_linked: If true, include already-linked items with is_linked flag

        Returns:
            Tuple of (success, result_dict)
            result_dict contains:
                - suggestions: List of knowledge items with relevance scores, is_linked flag
                - count: Number of suggestions
                - cached: Whether results came from cache
        """
        try:
            # Validate source_type
            if source_type not in self.VALID_SOURCE_TYPES:
                return False, {
                    "error": f"Invalid source_type. Must be one of: {', '.join(self.VALID_SOURCE_TYPES)}"
                }

            # Check cache (include include_linked in cache key)
            cache_key = f"{source_type}:{source_id}:{limit}:{include_linked}"
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

            # Phase 1.4: Add is_linked flag to suggestions
            # Get existing links for this source
            existing_links_response = (
                self.supabase_client.table("archon_knowledge_links")
                .select("knowledge_id, knowledge_type, created_at")
                .eq("source_type", source_type)
                .eq("source_id", source_id)
                .execute()
            )

            existing_links = existing_links_response.data or []
            linked_items = {
                (link["knowledge_type"], link["knowledge_id"]): link["created_at"]
                for link in existing_links
            }

            # Add is_linked flag to each suggestion
            enriched_suggestions = []
            for suggestion in top_suggestions:
                knowledge_type = suggestion["knowledge_type"]
                knowledge_id = suggestion["knowledge_id"]
                link_key = (knowledge_type, knowledge_id)

                is_linked = link_key in linked_items

                enriched_suggestion = {
                    **suggestion,
                    "is_linked": is_linked,
                }

                # Add linked_at if it's linked
                if is_linked:
                    enriched_suggestion["linked_at"] = linked_items[link_key]

                # If include_linked is False, only add unlinked items
                if include_linked or not is_linked:
                    enriched_suggestions.append(enriched_suggestion)

            result = {
                "suggestions": enriched_suggestions,
                "count": len(enriched_suggestions),
                "cached": False
            }

            # Cache the result
            _suggestion_cache[cache_key] = (result, now)

            logger.info(
                f"Generated {len(enriched_suggestions)} AI knowledge suggestions for {source_type} {source_id} "
                f"(include_linked={include_linked})"
            )

            return True, result

        except Exception as e:
            logger.error(f"Error generating knowledge suggestions: {str(e)}")
            return False, {"error": str(e)}

    async def unlink_source_from_all_projects(
        self, source_id: str
    ) -> dict[str, Any]:
        """
        Unlink a knowledge source from ALL projects.

        Used before force-deleting a KB item that has backlinks.

        Phase 2.2: Bulk Unlink Helper

        Args:
            source_id: ID of the knowledge source

        Returns:
            dict: {
                "unlinked_count": int,
                "project_ids": [str],
                "errors": []
            }
        """
        try:
            # Get all linked projects
            success, result = await self.get_source_linked_projects(source_id)

            if not success:
                return {
                    "unlinked_count": 0,
                    "project_ids": [],
                    "errors": [{"error": result.get("error", "Failed to get linked projects")}]
                }

            linked_projects = result.get("linked_projects", [])

            if not linked_projects:
                return {
                    "unlinked_count": 0,
                    "project_ids": [],
                    "errors": []
                }

            unlinked_count = 0
            project_ids = []
            errors = []

            for project in linked_projects:
                try:
                    unlink_success, unlink_result = await self.unlink_source_from_project(
                        project_id=project["project_id"],
                        source_id=source_id
                    )

                    if unlink_success:
                        unlinked_count += unlink_result.get("links_removed", 0)
                        project_ids.append(project["project_id"])
                    else:
                        errors.append({
                            "project_id": project["project_id"],
                            "error": unlink_result.get("error", "Unknown error")
                        })
                except Exception as e:
                    errors.append({
                        "project_id": project["project_id"],
                        "error": str(e)
                    })

            logger.info(
                f"Bulk unlink completed for source {source_id}: "
                f"{unlinked_count} links removed from {len(project_ids)} projects"
            )

            return {
                "unlinked_count": unlinked_count,
                "project_ids": project_ids,
                "errors": errors
            }

        except Exception as e:
            logger.error(f"Error unlinking source from all projects: {str(e)}")
            return {
                "unlinked_count": 0,
                "project_ids": [],
                "errors": [{"error": str(e)}]
            }

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
