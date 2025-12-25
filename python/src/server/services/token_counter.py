"""
Token Counter Service

Provides accurate token counting for OpenAI and Anthropic models using tiktoken.
Includes caching for performance and support for various content types.
"""

import functools
from typing import Any, Optional

import tiktoken

from ..config.logfire_config import get_logger

logger = get_logger(__name__)


# Model encoding mapping
MODEL_ENCODINGS = {
    # OpenAI models
    "gpt-4": "cl100k_base",
    "gpt-4-turbo": "cl100k_base",
    "gpt-4o": "o200k_base",
    "gpt-4o-mini": "o200k_base",
    "gpt-3.5-turbo": "cl100k_base",
    # Anthropic models use cl100k_base as approximation
    "claude-3-5-sonnet-20241022": "cl100k_base",
    "claude-3-5-sonnet-20240620": "cl100k_base",
    "claude-3-5-haiku-20241022": "cl100k_base",
    "claude-3-opus-20240229": "cl100k_base",
    "claude-3-sonnet-20240229": "cl100k_base",
    "claude-3-haiku-20240307": "cl100k_base",
}


@functools.lru_cache(maxsize=10)
def _get_encoding(encoding_name: str) -> tiktoken.Encoding:
    """
    Get a tiktoken encoding by name with caching.

    Args:
        encoding_name: Name of the encoding (e.g., "cl100k_base", "o200k_base")

    Returns:
        tiktoken.Encoding instance

    Note: This function is cached to avoid repeated encoding initialization
    """
    try:
        return tiktoken.get_encoding(encoding_name)
    except Exception as e:
        logger.error(f"Failed to get encoding {encoding_name}: {e}")
        # Fallback to cl100k_base (works for most models)
        return tiktoken.get_encoding("cl100k_base")


def get_encoding_for_model(model_name: str) -> tiktoken.Encoding:
    """
    Get the appropriate tiktoken encoding for a model.

    Args:
        model_name: Full model name (e.g., "gpt-4o-mini", "claude-3-5-sonnet-20241022")

    Returns:
        tiktoken.Encoding instance
    """
    # Check if we have a direct mapping
    if model_name in MODEL_ENCODINGS:
        encoding_name = MODEL_ENCODINGS[model_name]
        return _get_encoding(encoding_name)

    # Try to detect encoding from model name prefix
    if model_name.startswith("gpt-4o"):
        return _get_encoding("o200k_base")
    elif model_name.startswith(("gpt-4", "gpt-3.5")):
        return _get_encoding("cl100k_base")
    elif model_name.startswith("claude"):
        # Anthropic models: use cl100k_base as approximation
        return _get_encoding("cl100k_base")
    else:
        # Default fallback
        logger.warning(f"Unknown model {model_name}, using cl100k_base encoding")
        return _get_encoding("cl100k_base")


def count_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    """
    Count tokens in a text string for a specific model.

    Args:
        text: Input text to count tokens for
        model: Model name to use for encoding

    Returns:
        Number of tokens in the text
    """
    if not text:
        return 0

    try:
        encoding = get_encoding_for_model(model)
        tokens = encoding.encode(text)
        return len(tokens)
    except Exception as e:
        logger.error(f"Failed to count tokens for model {model}: {e}")
        # Fallback: rough estimate (4 chars per token)
        return len(text) // 4


def count_tokens_for_messages(messages: list[dict[str, Any]], model: str = "gpt-4o-mini") -> int:
    """
    Count tokens for a list of chat messages (OpenAI format).

    This accounts for special tokens added by the chat format:
    - Each message has overhead tokens for role and formatting
    - The entire conversation has overhead for start/end tokens

    Args:
        messages: List of message dicts with "role" and "content" keys
        model: Model name to use for encoding

    Returns:
        Total number of tokens for the conversation
    """
    if not messages:
        return 0

    try:
        encoding = get_encoding_for_model(model)

        # Token overhead per message varies by model
        # For gpt-4 and gpt-3.5-turbo: every message has 3 tokens overhead
        # Plus 1 token for role, 1 for content separator
        tokens_per_message = 3
        tokens_per_name = 1  # If name field is present

        total_tokens = 0
        for message in messages:
            total_tokens += tokens_per_message

            # Count tokens in role
            if "role" in message:
                total_tokens += len(encoding.encode(message["role"]))

            # Count tokens in content
            if "content" in message and message["content"]:
                total_tokens += len(encoding.encode(str(message["content"])))

            # Count tokens in name if present
            if "name" in message:
                total_tokens += tokens_per_name
                total_tokens += len(encoding.encode(message["name"]))

        # Add 3 tokens for assistant response priming
        total_tokens += 3

        return total_tokens

    except Exception as e:
        logger.error(f"Failed to count tokens for messages: {e}")
        # Fallback: sum character counts and estimate
        total_chars = sum(
            len(str(msg.get("content", ""))) + len(msg.get("role", ""))
            for msg in messages
        )
        return total_chars // 4 + len(messages) * 4


def count_tokens_for_tools(tools: list[dict[str, Any]], model: str = "gpt-4o-mini") -> int:
    """
    Count tokens for tool/function definitions (OpenAI format).

    Args:
        tools: List of tool definition dicts
        model: Model name to use for encoding

    Returns:
        Number of tokens for all tool definitions
    """
    if not tools:
        return 0

    try:
        # Convert tools to JSON string representation
        import json
        tools_text = json.dumps(tools, separators=(",", ":"))
        return count_tokens(tools_text, model)
    except Exception as e:
        logger.error(f"Failed to count tokens for tools: {e}")
        return 0


def estimate_cost(
    prompt_tokens: int,
    completion_tokens: int,
    model: str,
    input_price_per_1k: float,
    output_price_per_1k: float
) -> float:
    """
    Estimate the cost for a request based on token counts and pricing.

    Args:
        prompt_tokens: Number of input tokens
        completion_tokens: Number of output tokens
        model: Model name (for logging)
        input_price_per_1k: Input token price per 1,000 tokens (USD)
        output_price_per_1k: Output token price per 1,000 tokens (USD)

    Returns:
        Total estimated cost in USD
    """
    try:
        input_cost = (prompt_tokens / 1000.0) * input_price_per_1k
        output_cost = (completion_tokens / 1000.0) * output_price_per_1k
        total_cost = input_cost + output_cost

        logger.debug(
            f"Cost estimate for {model}: "
            f"{prompt_tokens} input + {completion_tokens} output tokens = "
            f"${total_cost:.6f}"
        )

        return round(total_cost, 6)
    except Exception as e:
        logger.error(f"Failed to estimate cost: {e}")
        return 0.0


# Cache for pricing data (refreshed periodically)
_pricing_cache: dict[str, dict[str, float]] = {}


def get_pricing_from_db(db_client: Any, model_name: str, provider: str) -> Optional[dict[str, float]]:
    """
    Get pricing for a model from the database.

    Args:
        db_client: Supabase client instance
        model_name: Model name to look up
        provider: Provider name (OpenAI, Anthropic)

    Returns:
        Dict with input_price_per_1k and output_price_per_1k, or None if not found
    """
    cache_key = f"{provider}:{model_name}"

    # Check cache first
    if cache_key in _pricing_cache:
        return _pricing_cache[cache_key]

    try:
        result = db_client.table("archon_llm_pricing")\
            .select("input_price_per_1k, output_price_per_1k")\
            .eq("model_name", model_name)\
            .eq("provider", provider)\
            .order("effective_date", desc=True)\
            .limit(1)\
            .execute()

        if result.data and len(result.data) > 0:
            pricing = {
                "input_price_per_1k": float(result.data[0]["input_price_per_1k"]),
                "output_price_per_1k": float(result.data[0]["output_price_per_1k"])
            }
            # Cache the result
            _pricing_cache[cache_key] = pricing
            return pricing

        logger.warning(f"No pricing data found for {provider}:{model_name}")
        return None

    except Exception as e:
        logger.error(f"Failed to get pricing from database: {e}")
        return None


def clear_pricing_cache():
    """Clear the pricing cache. Call this when pricing data is updated."""
    global _pricing_cache
    _pricing_cache = {}
    logger.info("Pricing cache cleared")


# Export all public functions
__all__ = [
    "count_tokens",
    "count_tokens_for_messages",
    "count_tokens_for_tools",
    "estimate_cost",
    "get_encoding_for_model",
    "get_pricing_from_db",
    "clear_pricing_cache",
]
