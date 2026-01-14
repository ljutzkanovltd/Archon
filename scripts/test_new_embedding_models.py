"""
Test script for new embedding models (jina-embeddings-v3, gte-qwen2-7b-instruct)

Usage:
    python scripts/test_new_embedding_models.py

This script verifies:
1. Model registry contains new models
2. Dimension detection works correctly
3. Provider mapping is correct
4. Model metadata is accessible
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "python"))

from src.server.services.embeddings.model_registry import (
    EMBEDDING_MODELS,
    SUPPORTED_DIMENSIONS,
    get_model_metadata,
    get_models_by_dimension,
    get_models_by_provider,
    get_best_model_for_dimension,
    get_dimension_for_model,
    get_model_comparison_summary,
)


def test_model_registry():
    """Test that new models are in the registry."""
    print("\n" + "=" * 80)
    print("TEST 1: Model Registry")
    print("=" * 80)

    # Check jina-embeddings-v3
    jina_model = get_model_metadata("jina-embeddings-v3")
    assert jina_model is not None, "❌ jina-embeddings-v3 not found in registry"
    assert jina_model.dimensions == 1024, f"❌ Wrong dimension: {jina_model.dimensions}"
    assert jina_model.provider == "jina", f"❌ Wrong provider: {jina_model.provider}"
    assert jina_model.mteb_score == 66.3, f"❌ Wrong MTEB score: {jina_model.mteb_score}"
    print("✅ jina-embeddings-v3: 1024D, Jina provider, MTEB: 66.3")

    # Check gte-qwen2-7b-instruct
    gte_model = get_model_metadata("gte-qwen2-7b-instruct")
    assert gte_model is not None, "❌ gte-qwen2-7b-instruct not found in registry"
    assert gte_model.dimensions == 3584, f"❌ Wrong dimension: {gte_model.dimensions}"
    assert gte_model.provider == "ollama", f"❌ Wrong provider: {gte_model.provider}"
    assert gte_model.mteb_score == 67.3, f"❌ Wrong MTEB score: {gte_model.mteb_score}"
    print("✅ gte-qwen2-7b-instruct: 3584D, Ollama provider, MTEB: 67.3")

    print("✅ All models found in registry")


def test_dimension_support():
    """Test dimension support."""
    print("\n" + "=" * 80)
    print("TEST 2: Dimension Support")
    print("=" * 80)

    expected_dimensions = [384, 768, 1024, 1536, 3072, 3584]
    actual_dimensions = sorted(SUPPORTED_DIMENSIONS.keys())

    assert actual_dimensions == expected_dimensions, \
        f"❌ Dimension mismatch: {actual_dimensions} != {expected_dimensions}"

    print(f"✅ Supported dimensions: {actual_dimensions}")

    # Check 3584D is properly mapped
    models_3584 = SUPPORTED_DIMENSIONS[3584]
    assert "gte-qwen2-7b-instruct" in models_3584, \
        "❌ gte-qwen2-7b-instruct not in 3584D mapping"
    print(f"✅ 3584D models: {models_3584}")


def test_dimension_detection():
    """Test dimension detection for models."""
    print("\n" + "=" * 80)
    print("TEST 3: Dimension Detection")
    print("=" * 80)

    test_cases = [
        ("jina-embeddings-v3", 1024),
        ("gte-qwen2-7b-instruct", 3584),
        ("text-embedding-3-small", 1536),
        ("text-embedding-3-large", 3072),
        ("nomic-embed-text", 768),
        ("all-minilm", 384),
    ]

    for model_name, expected_dim in test_cases:
        detected_dim = get_dimension_for_model(model_name)
        assert detected_dim == expected_dim, \
            f"❌ {model_name}: Expected {expected_dim}D, got {detected_dim}D"
        print(f"✅ {model_name:30} → {detected_dim:4}D")


def test_provider_grouping():
    """Test provider grouping."""
    print("\n" + "=" * 80)
    print("TEST 4: Provider Grouping")
    print("=" * 80)

    # Check Jina provider
    jina_models = get_models_by_provider("jina")
    assert len(jina_models) == 1, f"❌ Expected 1 Jina model, got {len(jina_models)}"
    assert jina_models[0].model_name == "jina-embeddings-v3"
    print(f"✅ Jina models: {[m.model_name for m in jina_models]}")

    # Check Ollama provider (should include gte-qwen2-7b-instruct)
    ollama_models = get_models_by_provider("ollama")
    ollama_model_names = [m.model_name for m in ollama_models]
    assert "gte-qwen2-7b-instruct" in ollama_model_names, \
        f"❌ gte-qwen2-7b-instruct not in Ollama models: {ollama_model_names}"
    print(f"✅ Ollama models: {ollama_model_names}")


def test_best_model_selection():
    """Test best model selection by dimension."""
    print("\n" + "=" * 80)
    print("TEST 5: Best Model Selection")
    print("=" * 80)

    # 3584D - should return gte-qwen2-7b-instruct
    best_3584 = get_best_model_for_dimension(3584)
    assert best_3584 is not None, "❌ No best model for 3584D"
    assert best_3584.model_name == "gte-qwen2-7b-instruct", \
        f"❌ Wrong best model for 3584D: {best_3584.model_name}"
    print(f"✅ Best 3584D model: {best_3584.model_name} (MTEB: {best_3584.mteb_score})")

    # 1024D - should return jina-embeddings-v3 (higher MTEB than mxbai-embed-large)
    best_1024 = get_best_model_for_dimension(1024)
    assert best_1024 is not None, "❌ No best model for 1024D"
    assert best_1024.model_name == "jina-embeddings-v3", \
        f"❌ Wrong best model for 1024D: {best_1024.model_name}"
    print(f"✅ Best 1024D model: {best_1024.model_name} (MTEB: {best_1024.mteb_score})")


def test_model_comparison():
    """Test model comparison summary."""
    print("\n" + "=" * 80)
    print("TEST 6: Model Comparison Summary")
    print("=" * 80)

    summary = get_model_comparison_summary()
    assert "jina-embeddings-v3" in summary, "❌ jina-embeddings-v3 not in summary"
    assert "gte-qwen2-7b-instruct" in summary, "❌ gte-qwen2-7b-instruct not in summary"
    print(summary)
    print("✅ Model comparison summary generated successfully")


def test_model_metadata_access():
    """Test accessing model metadata."""
    print("\n" + "=" * 80)
    print("TEST 7: Model Metadata Access")
    print("=" * 80)

    jina_meta = get_model_metadata("jina-embeddings-v3")
    print(f"✅ Jina Embeddings v3:")
    print(f"   - Dimensions: {jina_meta.dimensions}")
    print(f"   - Provider: {jina_meta.provider}")
    print(f"   - MTEB Score: {jina_meta.mteb_score}")
    print(f"   - Max Tokens: {jina_meta.max_tokens}")
    print(f"   - Description: {jina_meta.description[:60]}...")
    print(f"   - API Endpoint: {jina_meta.api_endpoint}")
    print(f"   - Requires API Key: {jina_meta.requires_api_key}")

    gte_meta = get_model_metadata("gte-qwen2-7b-instruct")
    print(f"\n✅ GTE-Qwen2-7B-instruct:")
    print(f"   - Dimensions: {gte_meta.dimensions}")
    print(f"   - Provider: {gte_meta.provider}")
    print(f"   - MTEB Score: {gte_meta.mteb_score}")
    print(f"   - Max Tokens: {gte_meta.max_tokens}")
    print(f"   - Description: {gte_meta.description[:60]}...")
    print(f"   - Requires API Key: {gte_meta.requires_api_key}")


def main():
    """Run all tests."""
    print("\n" + "=" * 80)
    print("TESTING NEW EMBEDDING MODELS")
    print("=" * 80)

    try:
        test_model_registry()
        test_dimension_support()
        test_dimension_detection()
        test_provider_grouping()
        test_best_model_selection()
        test_model_comparison()
        test_model_metadata_access()

        print("\n" + "=" * 80)
        print("✅ ALL TESTS PASSED")
        print("=" * 80)
        print("\nNew embedding models are ready to use!")
        print("- jina-embeddings-v3 (1024D, MTEB: 66.3)")
        print("- gte-qwen2-7b-instruct (3584D, MTEB: 67.3)")
        print("\nNext steps:")
        print("1. Configure your preferred model in Archon Settings")
        print("2. Run database migration: ./start-archon.sh")
        print("3. Test embedding generation with new model")
        print("=" * 80)
        return 0

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
