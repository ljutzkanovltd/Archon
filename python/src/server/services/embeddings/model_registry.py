"""
Embedding Model Registry

Centralized registry of embedding models with metadata including:
- Model names and dimensions
- Provider mappings (OpenAI, Google, Ollama, Jina, etc.)
- MTEB scores for quality comparison
- Release dates for tracking model versions

This registry enables intelligent model selection and provider routing.
"""

from dataclasses import dataclass
from datetime import date
from typing import Literal


ProviderType = Literal["openai", "google", "ollama", "jina", "openrouter", "anthropic", "grok"]


@dataclass
class EmbeddingModelMetadata:
    """Metadata for an embedding model."""

    model_name: str
    dimensions: int
    provider: ProviderType
    mteb_score: float | None = None
    max_tokens: int = 8192
    release_date: date | None = None
    description: str = ""
    api_endpoint: str | None = None
    requires_api_key: bool = True


# =====================================================
# EMBEDDING MODEL REGISTRY
# =====================================================

EMBEDDING_MODELS: dict[str, EmbeddingModelMetadata] = {
    # ===== OpenAI Models =====
    "text-embedding-ada-002": EmbeddingModelMetadata(
        model_name="text-embedding-ada-002",
        dimensions=1536,
        provider="openai",
        mteb_score=60.9,
        max_tokens=8191,
        release_date=date(2022, 12, 1),
        description="Legacy OpenAI embedding model, reliable but lower quality"
    ),
    "text-embedding-3-small": EmbeddingModelMetadata(
        model_name="text-embedding-3-small",
        dimensions=1536,
        provider="openai",
        mteb_score=62.3,
        max_tokens=8191,
        release_date=date(2024, 1, 25),
        description="Current OpenAI standard embedding model, good balance of quality and cost"
    ),
    "text-embedding-3-large": EmbeddingModelMetadata(
        model_name="text-embedding-3-large",
        dimensions=3072,
        provider="openai",
        mteb_score=64.6,
        max_tokens=8191,
        release_date=date(2024, 1, 25),
        description="OpenAI large embedding model, higher quality but more expensive"
    ),

    # ===== Google Models =====
    "text-embedding-004": EmbeddingModelMetadata(
        model_name="text-embedding-004",
        dimensions=768,
        provider="google",
        mteb_score=62.7,
        max_tokens=2048,
        release_date=date(2024, 5, 1),
        description="Latest Google embedding model with strong multilingual support"
    ),
    "text-embedding-005": EmbeddingModelMetadata(
        model_name="text-embedding-005",
        dimensions=768,
        provider="google",
        mteb_score=None,  # Not yet benchmarked on MTEB
        max_tokens=2048,
        release_date=date(2024, 11, 1),
        description="Newest Google embedding model"
    ),
    "text-multilingual-embedding-002": EmbeddingModelMetadata(
        model_name="text-multilingual-embedding-002",
        dimensions=768,
        provider="google",
        mteb_score=None,
        max_tokens=2048,
        release_date=date(2024, 1, 1),
        description="Google multilingual embedding model"
    ),

    # ===== Ollama Models =====
    "nomic-embed-text": EmbeddingModelMetadata(
        model_name="nomic-embed-text",
        dimensions=768,
        provider="ollama",
        mteb_score=62.4,
        max_tokens=8192,
        release_date=date(2024, 2, 1),
        description="Popular open-source embedding model, runs locally via Ollama",
        requires_api_key=False
    ),
    "mxbai-embed-large": EmbeddingModelMetadata(
        model_name="mxbai-embed-large",
        dimensions=1024,
        provider="ollama",
        mteb_score=64.6,
        max_tokens=512,
        release_date=date(2024, 3, 1),
        description="High-quality Ollama embedding model",
        requires_api_key=False
    ),
    "all-minilm": EmbeddingModelMetadata(
        model_name="all-minilm",
        dimensions=384,
        provider="ollama",
        mteb_score=58.0,
        max_tokens=256,
        release_date=date(2021, 1, 1),
        description="Lightweight embedding model for resource-constrained environments",
        requires_api_key=False
    ),

    # ===== Jina AI Models (2024) =====
    "jina-embeddings-v3": EmbeddingModelMetadata(
        model_name="jina-embeddings-v3",
        dimensions=1024,
        provider="jina",
        mteb_score=66.3,
        max_tokens=8192,
        release_date=date(2024, 9, 1),
        description="Best open-source embedding model with late chunking support (MTEB: 66.3, +6% vs text-embedding-3-small)",
        api_endpoint="https://api.jina.ai/v1/embeddings",
        requires_api_key=True
    ),

    # ===== GTE Models (2024) =====
    "gte-qwen2-7b-instruct": EmbeddingModelMetadata(
        model_name="gte-qwen2-7b-instruct",
        dimensions=3584,
        provider="ollama",  # Can also be openrouter
        mteb_score=67.3,
        max_tokens=8192,
        release_date=date(2024, 11, 1),
        description="Highest quality embedding model, instruction-following (MTEB: 67.3, +8% vs text-embedding-3-small)",
        requires_api_key=False  # Via Ollama
    ),
}


# =====================================================
# DIMENSION TO MODELS MAPPING
# =====================================================

SUPPORTED_DIMENSIONS: dict[int, list[str]] = {
    384: ["all-minilm"],
    768: ["nomic-embed-text", "text-embedding-004", "text-embedding-005", "text-multilingual-embedding-002"],
    1024: ["mxbai-embed-large", "jina-embeddings-v3"],
    1536: ["text-embedding-ada-002", "text-embedding-3-small"],
    3072: ["text-embedding-3-large"],
    3584: ["gte-qwen2-7b-instruct"],  # NEW DIMENSION!
}


# =====================================================
# HELPER FUNCTIONS
# =====================================================

def get_model_metadata(model_name: str) -> EmbeddingModelMetadata | None:
    """
    Get metadata for a specific embedding model.

    Args:
        model_name: Name of the embedding model

    Returns:
        EmbeddingModelMetadata if found, None otherwise
    """
    # Direct lookup
    if model_name in EMBEDDING_MODELS:
        return EMBEDDING_MODELS[model_name]

    # Try lowercase
    model_lower = model_name.lower()
    for key, metadata in EMBEDDING_MODELS.items():
        if key.lower() == model_lower:
            return metadata

    # Try stripping provider prefixes (e.g., "openai/text-embedding-3-small")
    for separator in ("/", ":"):
        if separator in model_name:
            base_name = model_name.split(separator)[-1]
            if base_name in EMBEDDING_MODELS:
                return EMBEDDING_MODELS[base_name]

    return None


def get_models_by_dimension(dimension: int) -> list[EmbeddingModelMetadata]:
    """
    Get all models that support a specific dimension.

    Args:
        dimension: Embedding dimension (384, 768, 1024, 1536, 3072, 3584)

    Returns:
        List of model metadata objects
    """
    model_names = SUPPORTED_DIMENSIONS.get(dimension, [])
    return [EMBEDDING_MODELS[name] for name in model_names if name in EMBEDDING_MODELS]


def get_models_by_provider(provider: ProviderType) -> list[EmbeddingModelMetadata]:
    """
    Get all models from a specific provider.

    Args:
        provider: Provider name (openai, google, ollama, jina, etc.)

    Returns:
        List of model metadata objects
    """
    return [
        metadata for metadata in EMBEDDING_MODELS.values()
        if metadata.provider.lower() == provider.lower()
    ]


def get_best_model_for_dimension(dimension: int) -> EmbeddingModelMetadata | None:
    """
    Get the best quality model (highest MTEB score) for a dimension.

    Args:
        dimension: Embedding dimension

    Returns:
        Best model metadata or None if no models available
    """
    models = get_models_by_dimension(dimension)
    if not models:
        return None

    # Sort by MTEB score (descending), handle None scores
    models_with_scores = [m for m in models if m.mteb_score is not None]
    if not models_with_scores:
        return models[0]  # Return first model if no MTEB scores available

    return max(models_with_scores, key=lambda m: m.mteb_score or 0)


def get_dimension_for_model(model_name: str) -> int | None:
    """
    Get the embedding dimension for a specific model.

    Args:
        model_name: Name of the embedding model

    Returns:
        Dimension (int) or None if model not found
    """
    metadata = get_model_metadata(model_name)
    if metadata:
        return metadata.dimensions

    # Fallback to heuristic detection for unknown models
    model_lower = model_name.lower()

    # OpenAI models
    if "text-embedding-3-large" in model_lower:
        return 3072
    elif "text-embedding-3-small" in model_lower or "text-embedding-ada" in model_lower:
        return 1536

    # Google models
    elif "text-embedding-004" in model_lower or "gemini-text-embedding" in model_lower:
        return 768

    # Ollama models
    elif "mxbai-embed" in model_lower:
        return 1024
    elif "nomic-embed" in model_lower:
        return 768
    elif "all-minilm" in model_lower:
        return 384

    # Jina models
    elif "jina-embeddings-v3" in model_lower:
        return 1024

    # GTE models
    elif "gte-qwen2-7b" in model_lower:
        return 3584

    # Default fallback (most common OpenAI dimension)
    return 1536


def is_dimension_supported(dimension: int) -> bool:
    """Check if a dimension is supported by the database schema."""
    return dimension in SUPPORTED_DIMENSIONS


def get_all_supported_dimensions() -> list[int]:
    """Get list of all supported dimensions."""
    return sorted(SUPPORTED_DIMENSIONS.keys())


def get_model_comparison_summary() -> str:
    """
    Generate a summary comparing all embedding models by MTEB score.

    Returns:
        Formatted string with model comparison
    """
    models_with_scores = [
        m for m in EMBEDDING_MODELS.values()
        if m.mteb_score is not None
    ]

    # Sort by MTEB score descending
    sorted_models = sorted(models_with_scores, key=lambda m: m.mteb_score or 0, reverse=True)

    lines = ["Embedding Model Comparison (by MTEB Score):", "=" * 80]
    for i, model in enumerate(sorted_models, 1):
        improvement = ""
        if model.mteb_score and i > 1:
            baseline = 62.3  # text-embedding-3-small baseline
            improvement = f" (+{model.mteb_score - baseline:.1f}% vs baseline)"

        lines.append(
            f"{i}. {model.model_name:35} | MTEB: {model.mteb_score:4.1f} | "
            f"{model.dimensions:4}D | {model.provider:10}{improvement}"
        )

    return "\n".join(lines)
