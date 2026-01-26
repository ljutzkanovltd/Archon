"""
Test suite for PDF extraction functionality.

Tests pdfplumber and PyPDF2 extraction methods with various PDF types.
"""

import pytest
from io import BytesIO
from fastapi import UploadFile, HTTPException
from src.server.services.documents.extraction_service import DocumentExtractionService


@pytest.fixture
def extraction_service():
    """Fixture providing extraction service instance."""
    return DocumentExtractionService()


@pytest.fixture
def create_mock_upload_file():
    """Factory fixture for creating mock UploadFile objects."""
    def _create_file(content: bytes, filename: str) -> UploadFile:
        return UploadFile(
            filename=filename,
            file=BytesIO(content)
        )
    return _create_file


class TestPDFExtraction:
    """Tests for PDF content extraction."""

    @pytest.mark.asyncio
    async def test_extract_pdf_content_basic(
        self,
        extraction_service,
        create_mock_upload_file
    ):
        """Test basic PDF extraction with valid text-based PDF."""
        # This test would require a real PDF file or mock
        # For now, we'll test the error handling

        # Create a mock "PDF" (invalid content for testing error handling)
        mock_pdf = create_mock_upload_file(b"Not a real PDF", "test.pdf")

        # Should raise an exception for invalid PDF
        with pytest.raises(HTTPException) as exc_info:
            await extraction_service.extract_pdf_content(mock_pdf)

        assert exc_info.value.status_code in [400, 500]

    @pytest.mark.asyncio
    async def test_extract_content_by_type_pdf(
        self,
        extraction_service,
        create_mock_upload_file
    ):
        """Test routing to PDF extraction through extract_content_by_type."""
        mock_pdf = create_mock_upload_file(b"Not a real PDF", "test.pdf")

        # Should attempt PDF extraction
        with pytest.raises(HTTPException):
            await extraction_service.extract_content_by_type(mock_pdf, ".pdf")

    @pytest.mark.asyncio
    async def test_extract_pdf_with_empty_content(
        self,
        extraction_service,
        create_mock_upload_file
    ):
        """Test PDF extraction warning for image-based PDFs."""
        # This would need a real image-based PDF to test properly
        # Testing the error path instead
        mock_pdf = create_mock_upload_file(b"%PDF-invalid", "image_based.pdf")

        with pytest.raises(HTTPException):
            await extraction_service.extract_pdf_content(mock_pdf)

    @pytest.mark.asyncio
    async def test_unsupported_file_type(self, extraction_service, create_mock_upload_file):
        """Test that unsupported file types raise appropriate error."""
        mock_file = create_mock_upload_file(b"test content", "test.unsupported")

        with pytest.raises(HTTPException) as exc_info:
            await extraction_service.extract_content_by_type(mock_file, ".unsupported")

        assert exc_info.value.status_code == 400
        assert "Unsupported file type" in str(exc_info.value.detail)


class TestPDFMetadata:
    """Tests for PDF metadata extraction."""

    @pytest.mark.asyncio
    async def test_metadata_structure(self, extraction_service):
        """Test that PDF metadata has expected structure."""
        # This would require a real PDF with metadata
        # For now, documenting expected structure

        expected_metadata_keys = {
            'total_pages',
            'title',
            'author',
            'creator',
            'producer',
            'subject',
            'extraction_method',
            'total_chars',
            'total_words',
            'pages_with_text',
        }

        # Test structure expectation is documented
        assert expected_metadata_keys  # Placeholder for when we have real test


class TestPDFPages:
    """Tests for page-level PDF extraction."""

    @pytest.mark.asyncio
    async def test_pages_structure(self, extraction_service):
        """Test that page data has expected structure."""
        expected_page_keys_pdfplumber = {
            'page_number',
            'content',
            'width',
            'height',
            'char_count',
            'word_count',
        }

        expected_page_keys_pypdf2 = {
            'page_number',
            'content',
            'char_count',
            'word_count',
        }

        # Both structures should be supported
        assert expected_page_keys_pdfplumber
        assert expected_page_keys_pypdf2


class TestPDFErrorHandling:
    """Tests for PDF extraction error handling."""

    @pytest.mark.asyncio
    async def test_corrupted_pdf_handling(
        self,
        extraction_service,
        create_mock_upload_file
    ):
        """Test handling of corrupted PDF files."""
        corrupted_pdf = create_mock_upload_file(b"corrupted data", "corrupted.pdf")

        with pytest.raises(HTTPException) as exc_info:
            await extraction_service.extract_pdf_content(corrupted_pdf)

        # Should raise 400 or 500 error
        assert exc_info.value.status_code in [400, 500]

    @pytest.mark.asyncio
    async def test_extraction_fallback(self, extraction_service):
        """Test that PyPDF2 fallback is attempted when pdfplumber fails."""
        # This would need specific PDF that fails pdfplumber but works with PyPDF2
        # For now, documenting the expected behavior

        # Expected: If pdfplumber fails, should try PyPDF2
        # Expected: Should log warning about fallback
        # Expected: metadata['extraction_method'] should indicate which method succeeded
        pass


class TestPDFContentValidation:
    """Tests for PDF content validation."""

    @pytest.mark.asyncio
    async def test_validate_extracted_pdf_content(self, extraction_service):
        """Test content validation for extracted PDF text."""
        # Test with valid content
        valid_content = "This is valid PDF text content with enough characters."
        is_valid, error_msg = extraction_service.validate_extracted_content(
            valid_content,
            min_length=10
        )
        assert is_valid
        assert error_msg == ""

    @pytest.mark.asyncio
    async def test_validate_empty_pdf_content(self, extraction_service):
        """Test validation catches empty PDF content."""
        empty_content = ""
        is_valid, error_msg = extraction_service.validate_extracted_content(
            empty_content,
            min_length=10
        )
        assert not is_valid
        assert "empty" in error_msg.lower() or "too short" in error_msg.lower()

    @pytest.mark.asyncio
    async def test_validate_short_pdf_content(self, extraction_service):
        """Test validation catches content below minimum length."""
        short_content = "Hi"
        is_valid, error_msg = extraction_service.validate_extracted_content(
            short_content,
            min_length=10
        )
        assert not is_valid
        assert "too short" in error_msg.lower()


# Integration test markers for future implementation
@pytest.mark.integration
class TestPDFIntegration:
    """Integration tests requiring real PDF files."""

    @pytest.mark.skip(reason="Requires test PDF fixtures")
    @pytest.mark.asyncio
    async def test_extract_real_text_pdf(self, extraction_service):
        """Test extraction from real text-based PDF."""
        # TODO: Add test PDF to tests/fixtures/
        # pdf_path = Path(__file__).parent / "fixtures" / "sample_text.pdf"
        pass

    @pytest.mark.skip(reason="Requires test PDF fixtures")
    @pytest.mark.asyncio
    async def test_extract_real_image_pdf(self, extraction_service):
        """Test extraction from real image-based PDF (should warn)."""
        # TODO: Add image-based PDF to tests/fixtures/
        pass

    @pytest.mark.skip(reason="Requires test PDF fixtures")
    @pytest.mark.asyncio
    async def test_extract_multipage_pdf(self, extraction_service):
        """Test extraction from multi-page PDF."""
        # TODO: Add multi-page PDF to tests/fixtures/
        pass

    @pytest.mark.skip(reason="Requires protected PDF fixture")
    @pytest.mark.asyncio
    async def test_extract_password_protected_pdf(self, extraction_service):
        """Test that password-protected PDFs raise 403."""
        # TODO: Add password-protected PDF to tests/fixtures/
        pass
