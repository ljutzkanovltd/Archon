"""
Document Upload and Extraction Demo

Demonstrates how to use DocumentUploadService and DocumentExtractionService.
"""

import asyncio
from io import BytesIO
from uuid import UUID, uuid4
from fastapi import UploadFile

# Adjust import path based on your project structure
from src.server.services.documents import (
    DocumentUploadService,
    DocumentExtractionService,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE,
)


async def demo_text_extraction():
    """Demonstrate text file extraction."""
    print("\n" + "=" * 60)
    print("DEMO 1: Text File Extraction")
    print("=" * 60)

    # Create sample text content
    text_content = """Hello World!
This is a sample text file.
It has multiple lines.
We will extract metadata from it."""

    # Create mock UploadFile
    file_bytes = text_content.encode('utf-8')
    text_file = UploadFile(
        filename="sample.txt",
        file=BytesIO(file_bytes)
    )

    # Extract content
    extraction_service = DocumentExtractionService()
    result = await extraction_service.extract_text_content(text_file)

    print(f"\nFilename: {text_file.filename}")
    print(f"Content:\n{result['content']}")
    print(f"\nMetadata:")
    for key, value in result['metadata'].items():
        print(f"  {key}: {value}")


async def demo_markdown_extraction():
    """Demonstrate markdown file extraction."""
    print("\n" + "=" * 60)
    print("DEMO 2: Markdown File Extraction")
    print("=" * 60)

    # Create sample markdown content
    markdown_content = """# Project Documentation

## Introduction
This is a **sample** markdown document.

## Code Example
```python
def hello_world():
    print("Hello, World!")
```

## Links
- [GitHub](https://github.com)
- [Documentation](https://docs.example.com)

| Feature | Status |
|---------|--------|
| Upload  | Done   |
| Extract | Done   |
"""

    # Create mock UploadFile
    file_bytes = markdown_content.encode('utf-8')
    md_file = UploadFile(
        filename="README.md",
        file=BytesIO(file_bytes)
    )

    # Extract content
    extraction_service = DocumentExtractionService()
    result = await extraction_service.extract_markdown_content(md_file)

    print(f"\nFilename: {md_file.filename}")
    print(f"\nMetadata:")
    for key, value in result['metadata'].items():
        if key != 'header_levels':
            print(f"  {key}: {value}")

    if 'header_levels' in result['metadata']:
        print(f"  header_levels:")
        for level, count in result['metadata']['header_levels'].items():
            print(f"    {level}: {count}")


async def demo_filename_sanitization():
    """Demonstrate filename sanitization."""
    print("\n" + "=" * 60)
    print("DEMO 3: Filename Sanitization")
    print("=" * 60)

    upload_service = DocumentUploadService()

    dangerous_filenames = [
        "normal_file.txt",
        "../../../etc/passwd",
        "file with spaces.txt",
        "file (version 2).md",
        "../../documents/secret.txt",
        "file@#$%^&*().txt",
    ]

    print("\nSanitizing potentially dangerous filenames:")
    for filename in dangerous_filenames:
        sanitized = upload_service._sanitize_filename(filename)
        print(f"  {filename:40} -> {sanitized}")


def demo_allowed_extensions():
    """Demonstrate allowed extensions."""
    print("\n" + "=" * 60)
    print("DEMO 4: Allowed File Extensions")
    print("=" * 60)

    print(f"\nMaximum file size: {MAX_FILE_SIZE / (1024 * 1024):.0f} MB")
    print(f"\nAllowed extensions:")
    for ext, mimes in ALLOWED_EXTENSIONS.items():
        print(f"  {ext:10} -> {', '.join(mimes)}")


async def demo_content_validation():
    """Demonstrate content validation."""
    print("\n" + "=" * 60)
    print("DEMO 5: Content Validation")
    print("=" * 60)

    extraction_service = DocumentExtractionService()

    test_cases = [
        ("Valid content with enough characters", 10),
        ("Short", 10),
        ("", 10),
        ("A" * 5, 3),
    ]

    print("\nValidating content samples:")
    for content, min_length in test_cases:
        is_valid, error = extraction_service.validate_extracted_content(
            content, min_length
        )
        status = "✓ VALID" if is_valid else f"✗ INVALID ({error})"
        preview = content[:30] + "..." if len(content) > 30 else content
        print(f"  Content: '{preview}' (min={min_length})")
        print(f"    Result: {status}")


async def main():
    """Run all demos."""
    print("\n" + "=" * 60)
    print("DOCUMENT UPLOAD & EXTRACTION SERVICE DEMO")
    print("=" * 60)

    await demo_text_extraction()
    await demo_markdown_extraction()
    await demo_filename_sanitization()
    demo_allowed_extensions()
    await demo_content_validation()

    print("\n" + "=" * 60)
    print("Demo completed successfully!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
