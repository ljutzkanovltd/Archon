"""
Contextual Embedding Service

Handles generation of contextual embeddings for improved RAG retrieval.
Includes proper rate limiting for OpenAI API calls.

Key Features:
- Dynamic document truncation based on token limits
- Full document context (up to 7500 tokens / ~30k chars)
- Token estimation for safe API calls
- Future BM25 keyword boost support
"""

import os

import openai

from ...config.logfire_config import search_logger
from ..credential_service import credential_service
from ..llm_provider_service import (
    extract_message_text,
    get_llm_client,
    prepare_chat_completion_params,
    requires_max_completion_tokens,
)
from ..threading_service import get_threading_service


def estimate_tokens(text: str) -> int:
    """
    Estimate token count using rough heuristic.

    Most tokenizers average 4 characters per token for English text.
    This is intentionally conservative to avoid exceeding context limits.

    Args:
        text: Text to estimate tokens for

    Returns:
        Estimated token count
    """
    return len(text) // 4


def truncate_to_token_limit(text: str, max_tokens: int = 5000) -> str:
    """
    Truncate text to approximate token limit.

    Uses conservative estimation (4 chars = 1 token) to ensure we don't
    exceed model context windows. Adds ellipsis if truncated.

    Args:
        text: Text to truncate
        max_tokens: Maximum token count (default: 5000)

    Returns:
        Truncated text with ellipsis if needed
    """
    max_chars = max_tokens * 4
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."


async def generate_contextual_embedding(
    full_document: str, chunk: str, provider: str = None
) -> tuple[str, bool]:
    """
    Generate contextual information for a chunk with proper rate limiting.

    Args:
        full_document: The complete document text
        chunk: The specific chunk of text to generate context for
        provider: Optional provider override

    Returns:
        Tuple containing:
        - The contextual text that situates the chunk within the document
        - Boolean indicating if contextual embedding was performed
    """
    # Model choice is a RAG setting, get from credential service
    try:
        model_choice = await credential_service.get_credential("MODEL_CHOICE", "gpt-4.1-nano")
    except Exception as e:
        # Fallback to environment variable or default
        search_logger.warning(
            f"Failed to get MODEL_CHOICE from credential service: {e}, using fallback"
        )
        model_choice = os.getenv("MODEL_CHOICE", "gpt-4.1-nano")

    search_logger.debug(f"Using MODEL_CHOICE: {model_choice}")

    threading_service = get_threading_service()

    # Truncate document to fit in LLM context window
    # Reserve ~500 tokens for prompt structure + output, use remaining for document
    # Most models support 8k context, we use 7500 tokens conservatively
    max_doc_tokens = 7500
    truncated_doc = truncate_to_token_limit(full_document, max_doc_tokens)

    # Estimate total tokens for rate limiting
    doc_tokens = estimate_tokens(truncated_doc)
    chunk_tokens = estimate_tokens(chunk)
    prompt_tokens = 100  # Rough estimate for prompt structure
    estimated_tokens = doc_tokens + chunk_tokens + prompt_tokens

    # Log truncation info for monitoring
    search_logger.info(
        f"Contextual embedding | full_doc_len={len(full_document)} chars "
        f"({estimate_tokens(full_document)} tokens) | "
        f"truncated_len={len(truncated_doc)} chars ({doc_tokens} tokens) | "
        f"chunk_len={len(chunk)} chars ({chunk_tokens} tokens) | "
        f"total_estimated={estimated_tokens} tokens"
    )

    try:
        # Use rate limiting before making the API call
        async with threading_service.rate_limited_operation(estimated_tokens):
            async with get_llm_client(provider=provider) as client:
                prompt = f"""<document>
{truncated_doc}
</document>
Here is the chunk we want to situate within the whole document
<chunk>
{chunk}
</chunk>
Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else."""

                # Get model from provider configuration
                model = await _get_model_choice(provider)

                # Prepare parameters and convert max_tokens for GPT-5/reasoning models
                params = {
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a helpful assistant that provides concise contextual information.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1200 if requires_max_completion_tokens(model) else 200,  # Much more tokens for reasoning models (GPT-5 needs extra for reasoning process)
                }
                final_params = prepare_chat_completion_params(model, params)
                response = await client.chat.completions.create(**final_params)

                choice = response.choices[0] if response.choices else None
                context, _, _ = extract_message_text(choice)
                context = context.strip()
                contextual_text = f"{context}\n---\n{chunk}"

                # TODO: Future enhancement - add BM25 keyword boost
                # Anthropic's approach combines contextual embeddings with BM25 scores
                # for hybrid retrieval. This could be implemented in hybrid_search_strategy.py by:
                # 1. Store BM25 scores alongside embeddings during indexing
                # 2. At query time, combine scores: final_score = alpha * semantic_score + (1-alpha) * bm25_score
                # 3. Where alpha = 0.7-0.8 for semantic weight (tune based on use case)
                # 4. Use rank_bm25 library for efficient BM25 computation
                # Expected impact: +5-10% improvement in keyword-heavy queries

                return contextual_text, True

    except Exception as e:
        if "rate_limit_exceeded" in str(e) or "429" in str(e):
            search_logger.warning(f"Rate limit hit in contextual embedding: {e}")
        else:
            search_logger.error(f"Error generating contextual embedding: {e}")
        return chunk, False


async def process_chunk_with_context(
    url: str, content: str, full_document: str
) -> tuple[str, bool]:
    """
    Process a single chunk with contextual embedding using async/await.

    Args:
        url: URL of the document
        content: The chunk content
        full_document: The complete document text

    Returns:
        Tuple containing:
        - The contextual text that situates the chunk within the document
        - Boolean indicating if contextual embedding was performed
    """
    return await generate_contextual_embedding(full_document, content)


async def _get_model_choice(provider: str | None = None) -> str:
    """Get model choice from credential service with centralized defaults."""
    from ..credential_service import credential_service

    # Get the active provider configuration
    provider_config = await credential_service.get_active_provider("llm")
    model = provider_config.get("chat_model", "").strip()  # Strip whitespace
    provider_name = provider_config.get("provider", "openai")

    # Handle empty model case - use centralized defaults
    if not model:
        search_logger.warning(f"chat_model is empty for provider {provider_name}, using centralized defaults")

        # Special handling for Ollama to check specific credential
        if provider_name == "ollama":
            try:
                ollama_model = await credential_service.get_credential("OLLAMA_CHAT_MODEL")
                if ollama_model and ollama_model.strip():
                    model = ollama_model.strip()
                    search_logger.info(f"Using OLLAMA_CHAT_MODEL fallback: {model}")
                else:
                    # Use default for Ollama
                    model = "llama3.2:latest"
                    search_logger.info(f"Using Ollama default: {model}")
            except Exception as e:
                search_logger.error(f"Error getting OLLAMA_CHAT_MODEL: {e}")
                model = "llama3.2:latest"
                search_logger.info(f"Using Ollama fallback: {model}")
        else:
            # Use provider-specific defaults
            provider_defaults = {
                "openai": "gpt-4o-mini",
                "openrouter": "anthropic/claude-3.5-sonnet",
                "google": "gemini-1.5-flash",
                "anthropic": "claude-3-5-haiku-20241022",
                "grok": "grok-3-mini"
            }
            model = provider_defaults.get(provider_name, "gpt-4o-mini")
            search_logger.debug(f"Using default model for provider {provider_name}: {model}")
    search_logger.debug(f"Using model from credential service: {model}")

    return model


async def generate_contextual_embeddings_batch(
    full_documents: list[str], chunks: list[str], provider: str = None
) -> list[tuple[str, bool]]:
    """
    Generate contextual information for multiple chunks in a single API call to avoid rate limiting.

    This processes ALL chunks passed to it in a single API call.
    The caller should batch appropriately (e.g., 10 chunks at a time).

    Args:
        full_documents: List of complete document texts
        chunks: List of specific chunks to generate context for
        provider: Optional provider override

    Returns:
        List of tuples containing:
        - The contextual text that situates the chunk within the document
        - Boolean indicating if contextual embedding was performed
    """
    try:
        async with get_llm_client(provider=provider) as client:
            # Get model choice from credential service (RAG setting)
            model_choice = await _get_model_choice(provider)

            # Build batch prompt for ALL chunks at once
            batch_prompt = "Process the following chunks and provide contextual information for each:\n\n"

            # For batch processing, use moderate document context per chunk
            # Trade-off: more docs in batch vs more context per doc
            # Using 5000 tokens (~20k chars) per doc allows ~5-10 docs per batch
            max_doc_tokens_batch = 5000

            for i, (doc, chunk) in enumerate(zip(full_documents, chunks, strict=False)):
                # Use dynamic truncation for document context
                doc_preview = truncate_to_token_limit(doc, max_doc_tokens_batch)
                batch_prompt += f"CHUNK {i + 1}:\n"
                batch_prompt += f"<document_preview>\n{doc_preview}\n</document_preview>\n"
                batch_prompt += f"<chunk>\n{chunk}\n</chunk>\n\n"  # Use full chunk

            batch_prompt += (
                "For each chunk, provide a short succinct context to situate it within the overall document for improving search retrieval. "
                "Format your response as:\nCHUNK 1: [context]\nCHUNK 2: [context]\netc."
            )

            # Make single API call for ALL chunks
            # Prepare parameters and convert max_tokens for GPT-5/reasoning models
            batch_params = {
                "model": model_choice,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that generates contextual information for document chunks.",
                    },
                    {"role": "user", "content": batch_prompt},
                ],
                "temperature": 0,
                "max_tokens": (600 if requires_max_completion_tokens(model_choice) else 100) * len(chunks),  # Much more tokens for reasoning models (GPT-5 needs extra reasoning space)
            }
            final_batch_params = prepare_chat_completion_params(model_choice, batch_params)
            response = await client.chat.completions.create(**final_batch_params)

            # Parse response
            choice = response.choices[0] if response.choices else None
            response_text, _, _ = extract_message_text(choice)
            if not response_text:
                search_logger.error(
                    "Empty response from LLM when generating contextual embeddings batch"
                )
                return [(chunk, False) for chunk in chunks]

            # Extract contexts from response
            lines = response_text.strip().split("\n")
            chunk_contexts = {}

            for line in lines:
                if line.strip().startswith("CHUNK"):
                    parts = line.split(":", 1)
                    if len(parts) == 2:
                        chunk_num = int(parts[0].strip().split()[1]) - 1
                        context = parts[1].strip()
                        chunk_contexts[chunk_num] = context

            # Build results
            results = []
            for i, chunk in enumerate(chunks):
                if i in chunk_contexts:
                    # Combine context with full chunk (not truncated)
                    contextual_text = chunk_contexts[i] + "\\n\\n" + chunk
                    results.append((contextual_text, True))
                else:
                    results.append((chunk, False))

            return results

    except openai.RateLimitError as e:
        if "insufficient_quota" in str(e):
            search_logger.warning(f"⚠️ QUOTA EXHAUSTED in contextual embeddings: {e}")
            search_logger.warning(
                "OpenAI quota exhausted - proceeding without contextual embeddings"
            )
        else:
            search_logger.warning(f"Rate limit hit in contextual embeddings batch: {e}")
            search_logger.warning(
                "Rate limit hit - proceeding without contextual embeddings for this batch"
            )
        # Return non-contextual for all chunks
        return [(chunk, False) for chunk in chunks]

    except Exception as e:
        search_logger.error(f"Error in contextual embedding batch: {e}")
        # Return non-contextual for all chunks
        return [(chunk, False) for chunk in chunks]
