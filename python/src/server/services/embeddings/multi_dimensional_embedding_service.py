"""
Multi-Dimensional Embedding Service

Manages embeddings with different dimensions (384, 768, 1024, 1536, 3072, 3584) to support
various embedding models from OpenAI, Google, Ollama, Jina, and other providers.

This service works with the tested database schema that has been validated.
Integrates with the model registry for intelligent model selection and dimension mapping.
"""

from typing import Any

from ...config.logfire_config import get_logger
from .model_registry import (
    SUPPORTED_DIMENSIONS,
    get_dimension_for_model,
    get_model_metadata,
    get_models_by_dimension,
    is_dimension_supported as registry_is_dimension_supported,
)

logger = get_logger(__name__)

class MultiDimensionalEmbeddingService:
    """Service for managing embeddings with multiple dimensions."""

    def __init__(self):
        pass

    def get_supported_dimensions(self) -> dict[int, list[str]]:
        """Get all supported embedding dimensions and their associated models."""
        return SUPPORTED_DIMENSIONS.copy()

    def get_dimension_for_model(self, model_name: str) -> int:
        """
        Get the embedding dimension for a specific model name.

        Uses the model registry for known models, falls back to heuristics for unknown models.

        Args:
            model_name: Name of the embedding model

        Returns:
            Embedding dimension (384, 768, 1024, 1536, 3072, or 3584)
        """
        # Try registry lookup first
        dimension = get_dimension_for_model(model_name)
        if dimension:
            return dimension

        # Fallback to heuristics for completely unknown models
        model_lower = model_name.lower()

        # Use heuristics to determine dimension based on model name patterns
        # OpenAI models
        if "text-embedding-3-large" in model_lower:
            return 3072
        elif "text-embedding-3-small" in model_lower or "text-embedding-ada" in model_lower:
            return 1536

        # Google models
        elif "text-embedding-004" in model_lower or "text-embedding-005" in model_lower:
            return 768
        elif "gemini-text-embedding" in model_lower or "text-multilingual-embedding" in model_lower:
            return 768

        # Ollama models (common patterns)
        elif "mxbai-embed" in model_lower:
            return 1024
        elif "nomic-embed" in model_lower:
            return 768
        elif "all-minilm" in model_lower:
            return 384

        # Jina models
        elif "jina-embeddings-v3" in model_lower or "jina-v3" in model_lower:
            return 1024

        # GTE models
        elif "gte-qwen2-7b" in model_lower or "gte-qwen" in model_lower:
            return 3584

        elif "embed" in model_lower:
            # Generic embedding model, assume common dimension
            return 768

        # Default fallback for unknown models (most common OpenAI dimension)
        logger.warning(f"Unknown model {model_name}, defaulting to 1536 dimensions")
        return 1536

    def get_embedding_column_name(self, dimension: int) -> str:
        """Get the appropriate database column name for the given dimension."""
        if dimension in SUPPORTED_DIMENSIONS:
            return f"embedding_{dimension}"
        else:
            logger.warning(f"Unsupported dimension {dimension}, using fallback column")
            return "embedding"  # Fallback to original column

    def is_dimension_supported(self, dimension: int) -> bool:
        """Check if a dimension is supported by the database schema."""
        return registry_is_dimension_supported(dimension)

    def get_models_for_dimension(self, dimension: int) -> list[str]:
        """
        Get list of model names that support a specific dimension.

        Args:
            dimension: Embedding dimension

        Returns:
            List of model names
        """
        models = get_models_by_dimension(dimension)
        return [m.model_name for m in models]

    def get_model_info(self, model_name: str) -> dict[str, Any] | None:
        """
        Get detailed information about a specific model.

        Args:
            model_name: Name of the embedding model

        Returns:
            Dictionary with model metadata or None if not found
        """
        metadata = get_model_metadata(model_name)
        if not metadata:
            return None

        return {
            "model_name": metadata.model_name,
            "dimensions": metadata.dimensions,
            "provider": metadata.provider,
            "mteb_score": metadata.mteb_score,
            "max_tokens": metadata.max_tokens,
            "description": metadata.description,
            "requires_api_key": metadata.requires_api_key,
        }

# Global instance
multi_dimensional_embedding_service = MultiDimensionalEmbeddingService()