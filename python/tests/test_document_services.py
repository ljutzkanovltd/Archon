"""
Unit tests for document upload and extraction services.
"""

import pytest
from io import BytesIO
from uuid import uuid4
from fastapi import UploadFile, HTTPException
from src.server.services.documents import (
    DocumentUploadService,
    DocumentExtractionService,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE,
)


class TestDocumentExtractionService:
    """Tests for DocumentExtractionService."""

    @pytest.fixture
    def extraction_service(self):
        """Create extraction service instance."""
        return DocumentExtractionService()

    @pytest.mark.asyncio
    async def test_extract_text_content_utf8(self, extraction_service):
        """Test text extraction with UTF-8 encoding."""
        content = "Hello world!\nThis is a test.\nLine 3."
        file_bytes = content.encode('utf-8')

        # Create mock UploadFile
        upload_file = UploadFile(
            filename="test.txt",
            file=BytesIO(file_bytes)
        )

        result = await extraction_service.extract_text_content(upload_file)

        assert 'content' in result
        assert 'metadata' in result
        assert result['content'] == content
        assert result['metadata']['line_count'] == 3
        assert result['metadata']['word_count'] == 8
        assert result['metadata']['encoding'] == 'utf-8'

    @pytest.mark.asyncio
    async def test_extract_text_content_latin1(self, extraction_service):
        """Test text extraction with Latin-1 encoding fallback."""
        content = "Café résumé"
        file_bytes = content.encode('latin-1')

        upload_file = UploadFile(
            filename="test.txt",
            file=BytesIO(file_bytes)
        )

        result = await extraction_service.extract_text_content(upload_file)

        assert result['content'] == content
        assert result['metadata']['encoding'] in ['utf-8', 'latin-1']

    @pytest.mark.asyncio
    async def test_extract_markdown_content(self, extraction_service):
        """Test markdown extraction with metadata analysis."""
        content = """# Header 1
## Header 2
Some text with [link](https://example.com)

```python
def hello():
    print("world")
```

| Table | Header |
|-------|--------|
| Cell  | Data   |
"""
        file_bytes = content.encode('utf-8')

        upload_file = UploadFile(
            filename="test.md",
            file=BytesIO(file_bytes)
        )

        result = await extraction_service.extract_markdown_content(upload_file)

        assert result['content'] == content
        metadata = result['metadata']
        assert metadata['has_code_blocks'] is True
        assert metadata['has_headers'] is True
        assert metadata['has_links'] is True
        assert metadata['has_tables'] is True
        assert metadata['code_block_count'] == 1
        assert metadata['header_count'] == 2

    @pytest.mark.asyncio
    async def test_validate_extracted_content(self, extraction_service):
        """Test content validation."""
        # Valid content
        is_valid, error = extraction_service.validate_extracted_content(
            "This is valid content with enough characters."
        )
        assert is_valid is True
        assert error == ""

        # Too short
        is_valid, error = extraction_service.validate_extracted_content(
            "Short", min_length=10
        )
        assert is_valid is False
        assert "too short" in error.lower()

        # Empty content
        is_valid, error = extraction_service.validate_extracted_content("")
        assert is_valid is False
        assert "empty" in error.lower()


class TestDocumentUploadService:
    """Tests for DocumentUploadService."""

    @pytest.fixture
    def upload_service(self):
        """Create upload service instance."""
        return DocumentUploadService()

    def test_sanitize_filename(self, upload_service):
        """Test filename sanitization."""
        # Normal filename
        assert upload_service._sanitize_filename("document.txt") == "document.txt"

        # Filename with dangerous characters
        result = upload_service._sanitize_filename("../../../etc/passwd")
        assert ".." not in result
        assert "/" not in result
        assert result.endswith(".txt") or result == "uploaded_file"

        # Filename with spaces and special chars
        result = upload_service._sanitize_filename("my document (draft).txt")
        assert " " not in result  # Spaces replaced
        assert "(" not in result  # Parens replaced

    def test_allowed_extensions(self):
        """Test that all expected extensions are allowed."""
        expected = ['.pdf', '.md', '.txt', '.png', '.jpg', '.jpeg',
                   '.py', '.js', '.ts', '.tsx', '.jsx']

        for ext in expected:
            assert ext in ALLOWED_EXTENSIONS

    def test_max_file_size_constant(self):
        """Test max file size is set to 50MB."""
        assert MAX_FILE_SIZE == 50 * 1024 * 1024


@pytest.mark.asyncio
async def test_extract_content_by_type():
    """Test routing to correct extraction method based on file type."""
    extraction_service = DocumentExtractionService()

    # Text file
    txt_content = "Plain text content"
    txt_file = UploadFile(
        filename="test.txt",
        file=BytesIO(txt_content.encode('utf-8'))
    )
    result = await extraction_service.extract_content_by_type(txt_file, '.txt')
    assert result['content'] == txt_content

    # Markdown file
    md_content = "# Markdown content"
    md_file = UploadFile(
        filename="test.md",
        file=BytesIO(md_content.encode('utf-8'))
    )
    result = await extraction_service.extract_content_by_type(md_file, '.md')
    assert result['content'] == md_content

    # Unsupported file type
    with pytest.raises(HTTPException) as exc_info:
        pdf_file = UploadFile(filename="test.pdf", file=BytesIO(b"PDF content"))
        await extraction_service.extract_content_by_type(pdf_file, '.pdf')

    assert exc_info.value.status_code == 400
    assert "unsupported" in str(exc_info.value.detail).lower()
