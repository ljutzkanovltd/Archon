"""
Project Context Inheritance Service

Manages context inheritance in project hierarchies, combining:
- Project instructions
- Project memory (future)
- Linked knowledge items

Inheritance Rules:
1. Instructions: Child overrides parent (merge with child priority)
2. Memory: Child + parent (combined, no override)
3. Linked Knowledge: Child + parent (union)
4. Privacy: Child can be MORE restrictive, not less
"""

from typing import Any
from uuid import UUID

from ..config.logfire_config import get_logger
from ..utils import get_supabase_client

logger = get_logger(__name__)


class ProjectContext:
    """Container for inherited project context"""

    def __init__(
        self,
        project_id: str,
        instructions: dict[str, Any] | None = None,
        memory: list[dict[str, Any]] | None = None,
        knowledge_items: list[dict[str, Any]] | None = None,
        ancestor_chain: list[dict[str, Any]] | None = None,
    ):
        self.project_id = project_id
        self.instructions = instructions or {}
        self.memory = memory or []
        self.knowledge_items = knowledge_items or []
        self.ancestor_chain = ancestor_chain or []

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "project_id": self.project_id,
            "instructions": self.instructions,
            "memory": self.memory,
            "knowledge_items": self.knowledge_items,
            "ancestor_chain": self.ancestor_chain,
        }


class ProjectContextService:
    """Manage context inheritance in project hierarchies"""

    def __init__(self):
        self.supabase = get_supabase_client()

    async def get_inherited_context(
        self,
        project_id: UUID | str,
        include_instructions: bool = True,
        include_memory: bool = True,
        include_knowledge: bool = True,
    ) -> ProjectContext:
        """
        Get combined context from parent chain + own context.

        Inheritance Rules:
        1. Instructions: Child overrides parent (merge with priority)
        2. Memory: Child + parent (combined, no override)
        3. Linked Knowledge: Child + parent (union)
        4. Privacy: Child can be MORE restrictive, not less

        Args:
            project_id: UUID of the project
            include_instructions: Include project instructions
            include_memory: Include project memory (future feature)
            include_knowledge: Include linked knowledge items

        Returns:
            ProjectContext with merged context from ancestors
        """
        project_id_str = str(project_id)

        try:
            # Get ancestor chain (root to current)
            ancestor_chain = await self._get_ancestor_chain(project_id_str)

            # Initialize context
            context = ProjectContext(project_id=project_id_str, ancestor_chain=ancestor_chain)

            # Merge instructions from ancestors (if enabled)
            if include_instructions:
                context.instructions = await self._merge_instructions(ancestor_chain, project_id_str)

            # Merge memory from ancestors (if enabled) - Future feature
            if include_memory:
                context.memory = await self._merge_memory(ancestor_chain, project_id_str)

            # Merge knowledge items from ancestors (if enabled)
            if include_knowledge:
                context.knowledge_items = await self._merge_knowledge(ancestor_chain, project_id_str)

            return context

        except Exception as e:
            logger.error(f"Error getting inherited context for project {project_id}: {e}", exc_info=True)
            # Return empty context on error
            return ProjectContext(project_id=project_id_str)

    async def _get_ancestor_chain(self, project_id: str) -> list[dict[str, Any]]:
        """
        Get ancestor chain from root to current project.

        Returns:
            List of projects from root to current, ordered by depth
        """
        ancestors = []
        current_id = project_id
        max_depth = 10  # Prevent infinite loops
        depth = 0

        while current_id and depth < max_depth:
            # Get current project
            project_response = (
                self.supabase.table("archon_projects")
                .select("id, title, description")
                .eq("id", current_id)
                .execute()
            )

            if not project_response.data or len(project_response.data) == 0:
                break

            project = project_response.data[0]
            ancestors.insert(0, {"id": project["id"], "title": project["title"], "depth": depth})

            # Get parent from hierarchy table
            parent_response = (
                self.supabase.table("archon_project_hierarchy")
                .select("parent_project_id")
                .eq("child_project_id", current_id)
                .execute()
            )

            if not parent_response.data or len(parent_response.data) == 0:
                break  # Reached root

            current_id = parent_response.data[0]["parent_project_id"]
            depth += 1

        return ancestors

    async def _merge_instructions(
        self, ancestor_chain: list[dict[str, Any]], project_id: str
    ) -> dict[str, Any]:
        """
        Merge instructions from ancestor chain with child override.

        Strategy:
        1. Start with root project instructions
        2. Overlay each descendant's instructions
        3. Child sections override parent sections
        4. Empty child sections preserve parent content

        Returns:
            Merged instructions JSONB content
        """
        merged_instructions: dict[str, Any] = {}

        # Iterate through ancestors (root to current)
        for ancestor in ancestor_chain:
            ancestor_id = ancestor["id"]

            # Get instructions for this ancestor
            instructions_response = (
                self.supabase.table("archon_project_instructions")
                .select("content")
                .eq("project_id", ancestor_id)
                .execute()
            )

            if instructions_response.data and len(instructions_response.data) > 0:
                ancestor_instructions = instructions_response.data[0]["content"]

                # Merge sections (child overrides parent)
                if isinstance(ancestor_instructions, dict):
                    for section_key, section_content in ancestor_instructions.items():
                        # Only override if new content is not empty
                        if section_content:
                            merged_instructions[section_key] = section_content

        # Get current project instructions last (highest priority)
        current_instructions_response = (
            self.supabase.table("archon_project_instructions")
            .select("content")
            .eq("project_id", project_id)
            .execute()
        )

        if current_instructions_response.data and len(current_instructions_response.data) > 0:
            current_instructions = current_instructions_response.data[0]["content"]

            if isinstance(current_instructions, dict):
                for section_key, section_content in current_instructions.items():
                    if section_content:
                        merged_instructions[section_key] = section_content

        return merged_instructions

    async def _merge_memory(
        self, ancestor_chain: list[dict[str, Any]], project_id: str
    ) -> list[dict[str, Any]]:
        """
        Merge memory items from ancestor chain (combined, no override).

        Strategy:
        1. Collect all memory items from ancestors
        2. Collect memory items from current project
        3. Combine without deduplication (each memory item is unique)

        Returns:
            Combined list of memory items

        Note: Memory feature not yet implemented in database schema.
              This is a placeholder for future implementation.
        """
        # TODO: Implement when archon_project_memory table is created
        # For now, return empty list
        return []

    async def _merge_knowledge(
        self, ancestor_chain: list[dict[str, Any]], project_id: str
    ) -> list[dict[str, Any]]:
        """
        Merge linked knowledge items from ancestor chain (union).

        Strategy:
        1. Collect unique knowledge items from ancestors
        2. Add current project's knowledge items
        3. Deduplicate by source_id

        Returns:
            Combined list of unique knowledge items
        """
        knowledge_items = []
        seen_source_ids = set()

        # Iterate through ancestors (root to current)
        for ancestor in ancestor_chain:
            ancestor_id = ancestor["id"]

            # Get linked source IDs for this ancestor
            sources_response = (
                self.supabase.table("archon_project_sources")
                .select("source_id")
                .eq("project_id", ancestor_id)
                .execute()
            )

            if sources_response.data:
                for link in sources_response.data:
                    source_id = link.get("source_id")
                    if source_id and source_id not in seen_source_ids:
                        # Fetch source details separately
                        source_response = (
                            self.supabase.table("archon_sources")
                            .select("id, title, url, source_type")
                            .eq("id", source_id)
                            .execute()
                        )

                        if source_response.data and len(source_response.data) > 0:
                            source = source_response.data[0]
                            knowledge_items.append(
                                {
                                    "id": source["id"],
                                    "title": source["title"],
                                    "url": source.get("url"),
                                    "source_type": source.get("source_type"),
                                    "inherited_from": ancestor_id,
                                }
                            )
                            seen_source_ids.add(source_id)

        # Get current project's knowledge items last
        current_sources_response = (
            self.supabase.table("archon_project_sources")
            .select("source_id")
            .eq("project_id", project_id)
            .execute()
        )

        if current_sources_response.data:
            for link in current_sources_response.data:
                source_id = link.get("source_id")
                if source_id and source_id not in seen_source_ids:
                    # Fetch source details separately
                    source_response = (
                        self.supabase.table("archon_sources")
                        .select("id, title, url, source_type")
                        .eq("id", source_id)
                        .execute()
                    )

                    if source_response.data and len(source_response.data) > 0:
                        source = source_response.data[0]
                        knowledge_items.append(
                            {
                                "id": source["id"],
                                "title": source["title"],
                                "url": source.get("url"),
                                "source_type": source.get("source_type"),
                                "inherited_from": None,  # Owned by current project
                            }
                        )
                        seen_source_ids.add(source_id)

        return knowledge_items


# Singleton instance
_context_service_instance: ProjectContextService | None = None


def get_context_service() -> ProjectContextService:
    """Get singleton ProjectContextService instance"""
    global _context_service_instance
    if _context_service_instance is None:
        _context_service_instance = ProjectContextService()
    return _context_service_instance
