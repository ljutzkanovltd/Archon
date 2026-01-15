"""
Knowledge linking tools for Archon MCP Server.

Provides MCP tools for linking knowledge base items (documents, code examples, RAG pages)
to projects, tasks, and sprints, including AI-powered suggestions.
"""

import json
import logging
from typing import Any
from urllib.parse import urljoin

import httpx
from mcp.server.fastmcp import Context, FastMCP

from src.mcp_server.utils import track_tool_execution
from src.mcp_server.utils.error_handling import MCPErrorFormatter
from src.mcp_server.utils.timeout_config import get_default_timeout
from src.server.config.service_discovery import get_api_url

logger = logging.getLogger(__name__)


def register_knowledge_link_tools(mcp: FastMCP):
    """Register knowledge linking tools with the MCP server."""

    @mcp.tool()
    @track_tool_execution
    async def link_knowledge(
        ctx: Context,
        source_type: str,
        source_id: str,
        knowledge_type: str,
        knowledge_id: str,
        relevance_score: float | None = None,
    ) -> str:
        """
        Link a knowledge item to a project, task, or sprint.

        Creates a connection between an entity (project/task/sprint) and a knowledge base item
        (document/code example/RAG page). Returns the link details and full knowledge item information.

        Args:
            source_type: Type of entity to link to ("project", "task", or "sprint")
            source_id: UUID of the project/task/sprint
            knowledge_type: Type of knowledge item ("document", "code_example", or "rag_page")
            knowledge_id: UUID of the knowledge item
            relevance_score: Optional relevance score (0.00-1.00) for AI-suggested links

        Returns:
            JSON with:
            - success: bool
            - link: Link object with metadata
            - knowledge_item: Full knowledge item details with content preview

        Example:
            link_knowledge(
                source_type="project",
                source_id="550e8400-e29b-41d4-a716-446655440000",
                knowledge_type="rag_page",
                knowledge_id="abc-123-def",
                relevance_score=0.85
            )
        """
        try:
            api_url = get_api_url()

            # Build endpoint URL based on source type
            if source_type == "project":
                endpoint = f"/api/projects/{source_id}/knowledge"
            elif source_type == "task":
                endpoint = f"/api/tasks/{source_id}/knowledge"
            elif source_type == "sprint":
                endpoint = f"/api/sprints/{source_id}/knowledge"
            else:
                return json.dumps({
                    "success": False,
                    "error": f"Invalid source_type: {source_type}. Must be 'project', 'task', or 'sprint'."
                })

            url = urljoin(api_url, endpoint)

            # Prepare request body
            body = {
                "knowledge_type": knowledge_type,
                "knowledge_id": knowledge_id,
            }
            if relevance_score is not None:
                body["relevance_score"] = relevance_score

            # Query parameters for permission check
            params = {}
            if source_type != "project":
                # For tasks and sprints, we need to pass project_id for permission check
                # In a real implementation, we'd fetch the project_id from the entity
                # For now, this is a placeholder - the API will handle validation
                params["project_id"] = "placeholder"

            async with httpx.AsyncClient(timeout=get_default_timeout()) as client:
                response = await client.post(url, json=body, params=params)

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps(result)
                else:
                    error_formatter = MCPErrorFormatter("link_knowledge")
                    return error_formatter.format_error_response(response)

        except Exception as e:
            logger.error(f"Error linking knowledge: {e}")
            return json.dumps({
                "success": False,
                "error": str(e)
            })

    @mcp.tool()
    @track_tool_execution
    async def unlink_knowledge(
        ctx: Context,
        link_id: str,
    ) -> str:
        """
        Remove a knowledge link.

        Deletes the connection between an entity and a knowledge item.

        Args:
            link_id: UUID of the knowledge link to remove

        Returns:
            JSON with:
            - success: bool
            - message: Confirmation message

        Example:
            unlink_knowledge(link_id="link-123-abc")
        """
        try:
            api_url = get_api_url()
            url = urljoin(api_url, f"/api/knowledge-links/{link_id}")

            # Note: In production, we'd need to get project_id for permission check
            params = {"project_id": "placeholder"}

            async with httpx.AsyncClient(timeout=get_default_timeout()) as client:
                response = await client.delete(url, params=params)

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps(result)
                else:
                    error_formatter = MCPErrorFormatter("unlink_knowledge")
                    return error_formatter.format_error_response(response)

        except Exception as e:
            logger.error(f"Error unlinking knowledge: {e}")
            return json.dumps({
                "success": False,
                "error": str(e)
            })

    @mcp.tool()
    @track_tool_execution
    async def get_linked_knowledge(
        ctx: Context,
        source_type: str,
        source_id: str,
    ) -> str:
        """
        Get all knowledge items linked to an entity.

        Retrieves all knowledge base items connected to a project, task, or sprint,
        with full details and metadata.

        Args:
            source_type: Type of entity ("project", "task", or "sprint")
            source_id: UUID of the project/task/sprint

        Returns:
            JSON with:
            - success: bool
            - links: Array of link objects with full knowledge_item details
            - count: Total number of links

        Example:
            get_linked_knowledge(
                source_type="project",
                source_id="550e8400-e29b-41d4-a716-446655440000"
            )
        """
        try:
            api_url = get_api_url()

            # Build endpoint URL based on source type
            if source_type == "project":
                endpoint = f"/api/projects/{source_id}/knowledge"
            elif source_type == "task":
                endpoint = f"/api/tasks/{source_id}/knowledge"
            elif source_type == "sprint":
                endpoint = f"/api/sprints/{source_id}/knowledge"
            else:
                return json.dumps({
                    "success": False,
                    "error": f"Invalid source_type: {source_type}. Must be 'project', 'task', or 'sprint'."
                })

            url = urljoin(api_url, endpoint)

            # Query parameters for permission check
            params = {}
            if source_type != "project":
                params["project_id"] = "placeholder"

            async with httpx.AsyncClient(timeout=get_default_timeout()) as client:
                response = await client.get(url, params=params)

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps(result)
                else:
                    error_formatter = MCPErrorFormatter("get_linked_knowledge")
                    return error_formatter.format_error_response(response)

        except Exception as e:
            logger.error(f"Error getting linked knowledge: {e}")
            return json.dumps({
                "success": False,
                "error": str(e)
            })

    @mcp.tool()
    @track_tool_execution
    async def suggest_knowledge(
        ctx: Context,
        source_type: str,
        source_id: str,
        limit: int = 5,
    ) -> str:
        """
        Get AI-powered knowledge suggestions for an entity.

        Uses RAG semantic search to suggest relevant documents and code examples
        based on the entity's title and description. Results are cached for 1 hour.

        Args:
            source_type: Type of entity ("project", "task", or "sprint")
            source_id: UUID of the project/task/sprint
            limit: Maximum number of suggestions to return (default: 5, max: 20)

        Returns:
            JSON with:
            - success: bool
            - suggestions: Array of suggested knowledge items with:
              - knowledge_id: UUID
              - knowledge_type: Type of knowledge item
              - title: Display title
              - url: URL (for RAG pages)
              - language: Programming language (for code examples)
              - relevance_score: AI-calculated relevance (0.00-1.00)
              - content_preview: First 200 characters
              - source_id: Source ID
            - count: Number of suggestions
            - cached: Whether results came from cache

        Example:
            suggest_knowledge(
                source_type="project",
                source_id="550e8400-e29b-41d4-a716-446655440000",
                limit=10
            )
        """
        try:
            api_url = get_api_url()

            # Build endpoint URL based on source type
            if source_type == "project":
                endpoint = f"/api/projects/{source_id}/knowledge/suggestions"
            elif source_type == "task":
                endpoint = f"/api/tasks/{source_id}/knowledge/suggestions"
            elif source_type == "sprint":
                endpoint = f"/api/sprints/{source_id}/knowledge/suggestions"
            else:
                return json.dumps({
                    "success": False,
                    "error": f"Invalid source_type: {source_type}. Must be 'project', 'task', or 'sprint'."
                })

            url = urljoin(api_url, endpoint)

            # Query parameters
            params = {"limit": min(limit, 20)}  # Cap at 20
            if source_type != "project":
                params["project_id"] = "placeholder"

            async with httpx.AsyncClient(timeout=get_default_timeout()) as client:
                response = await client.get(url, params=params)

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps(result)
                else:
                    error_formatter = MCPErrorFormatter("suggest_knowledge")
                    return error_formatter.format_error_response(response)

        except Exception as e:
            logger.error(f"Error getting knowledge suggestions: {e}")
            return json.dumps({
                "success": False,
                "error": str(e)
            })

    @mcp.tool()
    @track_tool_execution
    async def get_knowledge_sources(
        ctx: Context,
        knowledge_type: str,
        knowledge_id: str,
    ) -> str:
        """
        Get all entities linked to a knowledge item (reverse lookup).

        Finds all projects, tasks, and sprints that reference a specific knowledge item.
        Useful for understanding where documentation or code examples are being used.

        Args:
            knowledge_type: Type of knowledge item ("document", "code_example", or "rag_page")
            knowledge_id: UUID of the knowledge item

        Returns:
            JSON with:
            - success: bool
            - sources: Object with arrays grouped by type:
              - projects: Array of projects with link metadata
              - tasks: Array of tasks with link metadata
              - sprints: Array of sprints with link metadata
            - total_count: Total number of linked entities

        Example:
            get_knowledge_sources(
                knowledge_type="rag_page",
                knowledge_id="abc-123-def"
            )
        """
        try:
            api_url = get_api_url()
            url = urljoin(api_url, f"/api/knowledge/{knowledge_type}/{knowledge_id}/sources")

            async with httpx.AsyncClient(timeout=get_default_timeout()) as client:
                response = await client.get(url)

                if response.status_code == 200:
                    result = response.json()
                    return json.dumps(result)
                else:
                    error_formatter = MCPErrorFormatter("get_knowledge_sources")
                    return error_formatter.format_error_response(response)

        except Exception as e:
            logger.error(f"Error getting knowledge sources: {e}")
            return json.dumps({
                "success": False,
                "error": str(e)
            })
