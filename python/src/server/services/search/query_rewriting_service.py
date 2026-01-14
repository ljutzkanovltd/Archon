"""
Query Rewriting Service

Expands short queries using LLM to improve recall.

This service uses LLM-based query expansion to add synonyms and related terms
to short queries (typically <4 words). Expected impact: +15-20% recall improvement.

Example:
    "auth" → "authentication, authorization, JWT, OAuth, sessions, login, tokens"
"""

import asyncio
from typing import Any

from ...config.logfire_config import get_logger, safe_logfire_error, safe_logfire_info
from ..credential_service import credential_service
from ..llm_provider_service import get_llm_client

logger = get_logger(__name__)


class QueryRewritingService:
    """Service for expanding queries using LLM"""

    def __init__(self):
        self._settings_cache = {}

    async def _get_setting(self, key: str, default: Any) -> Any:
        """Get setting from credential service with caching"""
        if key in self._settings_cache:
            return self._settings_cache[key]

        try:
            value = await credential_service.get_credential(key, default)
            if isinstance(default, bool):
                value = str(value).lower() == "true" if value is not None else default
            elif isinstance(default, int):
                value = int(value) if value is not None else default
            self._settings_cache[key] = value
            return value
        except Exception as e:
            safe_logfire_error(f"Error getting setting {key}: {e}")
            self._settings_cache[key] = default
            return default

    async def should_rewrite_query(self, query: str) -> bool:
        """
        Determine if query should be rewritten.

        Short queries (<4 words) benefit most from expansion.

        Args:
            query: The search query to check

        Returns:
            bool: True if query should be rewritten, False otherwise
        """
        # Check if query rewriting is enabled
        enabled = await self._get_setting("ENABLE_QUERY_REWRITING", False)
        if not enabled:
            return False

        # Only rewrite short queries
        word_count = len(query.split())
        min_words = await self._get_setting("QUERY_REWRITE_MIN_WORDS", 4)

        return word_count < min_words

    async def rewrite_query(
        self, query: str, context: str = "technical documentation"
    ) -> dict[str, Any]:
        """
        Expand query with synonyms and related terms.

        Args:
            query: Original user query
            context: Context for expansion (e.g., "technical documentation", "code examples")

        Returns:
            dict with:
                - original_query: The original query
                - rewritten_query: Expanded query
                - expansion_terms: List of added terms
                - used_rewriting: Whether rewriting was applied
        """
        # Check if we should rewrite
        if not await self.should_rewrite_query(query):
            return {
                "original_query": query,
                "rewritten_query": query,
                "expansion_terms": [],
                "used_rewriting": False,
            }

        safe_logfire_info(f"Rewriting query | original='{query}' | context={context}")

        # Create expansion prompt
        prompt = f"""You are a search query expansion expert for {context}.

Expand the following short query with synonyms, related terms, and technical variations.

Original query: "{query}"

Instructions:
1. Keep the original terms
2. Add 2-4 synonyms or related terms
3. Add common technical variations
4. Focus on terms that would appear in relevant documentation
5. Return as a comma-separated list of terms

Example:
Input: "auth"
Output: authentication, authorization, JWT, OAuth, login, sessions, tokens

Now expand this query:
"{query}"

Expanded terms (comma-separated):"""

        try:
            # Get active LLM provider
            provider_config = await credential_service.get_active_provider("llm")
            provider = provider_config.get("provider", "openai")
            model = provider_config.get("model")

            # Generate expansion using LLM
            async with get_llm_client(provider=provider) as client:
                response = await client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=100,
                    temperature=0.3,  # Low temperature for consistency
                )

                # Extract generated text
                expanded_text = (
                    response.choices[0].message.content.strip()
                    if response.choices and response.choices[0].message.content
                    else query
                )

            # Parse expansion terms
            terms = [term.strip() for term in expanded_text.split(",")]
            expansion_terms = [
                term for term in terms if term.lower() not in query.lower()
            ]

            # Create rewritten query
            rewritten_query = f"{query} {' '.join(expansion_terms)}"

            safe_logfire_info(
                f"Query rewritten | original='{query}' | "
                f"rewritten='{rewritten_query}' | added_terms={len(expansion_terms)}"
            )

            return {
                "original_query": query,
                "rewritten_query": rewritten_query,
                "expansion_terms": expansion_terms,
                "used_rewriting": True,
            }

        except Exception as e:
            safe_logfire_error(f"Query rewriting failed: {e}, using original query")
            return {
                "original_query": query,
                "rewritten_query": query,
                "expansion_terms": [],
                "used_rewriting": False,
                "error": str(e),
            }

    async def rewrite_query_batch(
        self, queries: list[str], context: str = "technical documentation"
    ) -> list[dict[str, Any]]:
        """
        Rewrite multiple queries in batch.

        Args:
            queries: List of queries to rewrite
            context: Context for expansion

        Returns:
            List of rewrite results
        """
        tasks = [self.rewrite_query(q, context) for q in queries]
        return await asyncio.gather(*tasks)
