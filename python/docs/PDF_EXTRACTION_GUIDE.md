# PDF Content Extraction Guide

## Overview

The Archon Document Extraction Service now supports PDF content extraction with dual-library support for maximum compatibility and reliability.

## Features

- **Dual-Library Support**: Primary extraction via `pdfplumber` with `PyPDF2` fallback
- **Page-Level Granularity**: Extract content per page with detailed statistics
- **Rich Metadata**: PDF metadata, page dimensions, text statistics
- **Image-Based PDF Detection**: Warns when PDFs contain no extractable text
- **Error Handling**: Comprehensive error handling for corrupted, encrypted, and invalid PDFs

## Architecture

### Extraction Flow

```
PDF Upload
    ↓
extract_pdf_content()
    ↓
Try: pdfplumber extraction ← Primary (better text extraction)
    ↓ (on failure)
Fallback: PyPDF2 extraction ← Secondary (broader compatibility)
    ↓
Return: { content, pages, metadata }
```

### Library Selection

**pdfplumber (Preferred)**
- Better text extraction quality
- Preserves layout and spacing
- Provides page dimensions
- More accurate word/char counts

**PyPDF2 (Fallback)**
- Broader PDF compatibility
- Simpler extraction logic
- Used when pdfplumber fails

## API Usage

### Basic PDF Extraction

```python
from fastapi import UploadFile
from src.server.services.documents.extraction_service import DocumentExtractionService

service = DocumentExtractionService()

# Extract PDF content
result = await service.extract_pdf_content(uploaded_file)

# Access extracted data
full_text = result['content']
pages = result['pages']
metadata = result['metadata']
```

### Route to Extraction by File Type

```python
# Automatically route based on file extension
result = await service.extract_content_by_type(
    file=uploaded_file,
    file_extension='.pdf'
)
```

## Response Structure

### Successful Extraction

```json
{
  "content": "Full text from all pages concatenated with double newlines...",
  "pages": [
    {
      "page_number": 1,
      "content": "Text from page 1...",
      "width": 612.0,
      "height": 792.0,
      "char_count": 1245,
      "word_count": 215
    },
    {
      "page_number": 2,
      "content": "Text from page 2...",
      "width": 612.0,
      "height": 792.0,
      "char_count": 1180,
      "word_count": 203
    }
  ],
  "metadata": {
    "total_pages": 2,
    "title": "Document Title",
    "author": "Author Name",
    "creator": "PDF Creator Software",
    "producer": "PDF Producer",
    "subject": "Document Subject",
    "extraction_method": "pdfplumber",
    "total_chars": 2425,
    "total_words": 418,
    "pages_with_text": 2
  }
}
```

### Image-Based PDF (No Text)

```json
{
  "content": "",
  "pages": [
    {
      "page_number": 1,
      "content": "",
      "width": 612.0,
      "height": 792.0,
      "char_count": 0,
      "word_count": 0
    }
  ],
  "metadata": {
    "total_pages": 1,
    "title": "",
    "author": "",
    "creator": "",
    "producer": "",
    "subject": "",
    "extraction_method": "pdfplumber",
    "total_chars": 0,
    "total_words": 0,
    "pages_with_text": 0,
    "warning": "No text extracted from PDF. This may be an image-based PDF that requires OCR for text extraction."
  }
}
```

## Error Handling

### HTTP Status Codes

| Status | Condition | Example |
|--------|-----------|---------|
| 400 | Corrupted or invalid PDF | `Corrupted or invalid PDF file` |
| 403 | Password-protected PDF | `Password-protected PDFs are not supported` |
| 500 | Unexpected extraction error | `PDF extraction failed: {error}` |

### Error Examples

**Corrupted PDF**
```python
# Raises HTTPException(status_code=400)
raise HTTPException(
    status_code=400,
    detail="Corrupted or invalid PDF file: {error}"
)
```

**Password-Protected PDF**
```python
# Raises HTTPException(status_code=403)
raise HTTPException(
    status_code=403,
    detail="Password-protected PDFs are not supported"
)
```

**Generic Extraction Failure**
```python
# Raises HTTPException(status_code=500)
raise HTTPException(
    status_code=500,
    detail="PDF extraction failed: {error}"
)
```

## Content Validation

The service includes content validation to ensure extracted text meets quality standards:

```python
# Validate extracted content
is_valid, error_msg = service.validate_extracted_content(
    content=extracted_text,
    min_length=10
)

if not is_valid:
    # Handle invalid content
    logger.warning(f"Invalid content: {error_msg}")
```

### Validation Rules

- Content must not be empty or None
- Content must meet minimum length requirement (default: 10 characters)
- Content must be at least 80% printable characters
- Whitespace and common control characters are allowed

## Testing

### Unit Tests

```bash
# Run PDF extraction tests
cd python
uv run pytest tests/test_pdf_extraction.py -v
```

### Test Coverage

- ✅ Basic PDF extraction
- ✅ Content routing by file type
- ✅ Empty/image-based PDF detection
- ✅ Unsupported file type handling
- ✅ Metadata structure validation
- ✅ Page data structure validation
- ✅ Corrupted PDF error handling
- ✅ Fallback mechanism testing
- ✅ Content validation (valid, empty, short)
- 🔄 Integration tests (require real PDF fixtures)

### Creating Test Fixtures

To test with real PDFs, add test files to `tests/fixtures/`:

```bash
mkdir -p tests/fixtures/pdf
# Add test PDFs:
# - sample_text.pdf (text-based PDF)
# - sample_image.pdf (image-based PDF, no text)
# - sample_multipage.pdf (multi-page document)
# - sample_protected.pdf (password-protected)
```

## Performance Considerations

### Memory Usage

PDFs are loaded into memory during extraction:
- Small PDFs (<1MB): Negligible impact
- Medium PDFs (1-10MB): Acceptable memory usage
- Large PDFs (>10MB): Consider streaming or chunked processing

### Processing Time

Typical extraction times:
- Small PDF (1-5 pages): 100-300ms
- Medium PDF (10-50 pages): 500ms-2s
- Large PDF (100+ pages): 2s-10s

### Optimization Tips

1. **Use pdfplumber when possible**: Better performance and accuracy
2. **Validate file size before processing**: Reject PDFs over reasonable size limit
3. **Implement timeout**: Prevent long-running extractions from blocking
4. **Cache results**: Store extracted content to avoid re-processing

## Dependencies

```toml
# pyproject.toml
[dependency-groups]
server = [
    # PDF extraction
    "pypdf2>=3.0.1",
    "pdfplumber>=0.11.6",
]
```

## Logging

The service logs key events:

```python
# Successful extraction
logger.info(
    f"PDF extraction successful (pdfplumber) | "
    f"filename={filename} | pages={total_pages}"
)

# Fallback to PyPDF2
logger.warning(
    f"pdfplumber extraction failed, trying PyPDF2 fallback | "
    f"filename={filename} | error={error}"
)

# Image-based PDF warning
logger.warning(
    f"No text extracted from PDF (image-based?) | filename={filename}"
)

# Extraction error
logger.error(
    f"PDF extraction error | filename={filename} | error={error}"
)
```

## Future Enhancements

### OCR Integration

For image-based PDFs, consider integrating OCR:

```python
# Potential OCR integration
if not extracted_text and has_images:
    # Use tesseract or cloud OCR service
    extracted_text = await ocr_service.extract_text(pdf_bytes)
```

### Streaming Support

For very large PDFs:

```python
# Potential streaming implementation
async def extract_pdf_streaming(file: UploadFile) -> AsyncIterator[dict]:
    async for page in extract_pages_streaming(file):
        yield page
```

### Table Extraction

Extract structured tables:

```python
# pdfplumber supports table extraction
tables = page.extract_tables()
```

## Troubleshooting

### pdfplumber Import Error

```bash
# Install pdfplumber
uv pip install pdfplumber>=0.11.6
```

### PyPDF2 Import Error

```bash
# Install PyPDF2
uv pip install PyPDF2>=3.0.1
```

### "No text extracted" Warning

This typically means:
1. PDF contains only images (OCR required)
2. PDF uses non-standard encoding
3. PDF is corrupted

**Solution**: Try OCR service or different PDF source

### Memory Issues with Large PDFs

**Solution**: Implement file size limits or streaming extraction

## References

- [pdfplumber Documentation](https://github.com/jsvine/pdfplumber)
- [PyPDF2 Documentation](https://pypdf2.readthedocs.io/)
- [FastAPI File Upload](https://fastapi.tiangolo.com/tutorial/request-files/)

---

**Last Updated**: 2026-01-26
**Version**: 1.0.0
**Author**: Archon Team
