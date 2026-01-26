# Document Upload and Extraction Services

## Overview

The Document Services module provides secure file upload and text extraction capabilities for the Archon knowledge base system. It consists of two main services:

1. **DocumentUploadService** - Handles file validation, storage, and security
2. **DocumentExtractionService** - Extracts text content and metadata from documents

## Features

### Upload Service

- **Multi-format support**: PDF, Markdown, Text, Images, Code files
- **Security validation**: File type, size, and MIME type checking
- **Access control**: User permission verification via UserAccessService
- **Dual storage**: Supabase Storage (primary) with local filesystem fallback
- **Filename sanitization**: Protection against path traversal attacks

### Extraction Service

- **Multi-encoding support**: UTF-8, Latin-1, CP1252, ISO-8859-1, UTF-16
- **Intelligent fallback**: Tries multiple encodings automatically
- **Rich metadata**: Line count, word count, character count, encoding detection
- **Markdown analysis**: Headers, code blocks, links, tables detection
- **Content validation**: Ensures extracted content meets quality requirements

## Installation

The services are located in:
```
python/src/server/services/documents/
├── __init__.py
├── upload_service.py
└── extraction_service.py
```

## Usage

### Basic Upload Workflow

```python
from uuid import UUID
from fastapi import UploadFile
from src.server.services.documents import DocumentUploadService

# Initialize service
upload_service = DocumentUploadService()

# Validate upload
is_valid, error = await upload_service.validate_upload(
    file=uploaded_file,
    user_id=UUID("user-uuid"),
    project_id=UUID("project-uuid")
)

if not is_valid:
    raise HTTPException(status_code=400, detail=error)

# Store file
success, result = await upload_service.store_file(
    file=uploaded_file,
    project_id=UUID("project-uuid"),
    user_id=UUID("user-uuid")
)

print(f"File stored at: {result['file_path']}")
print(f"Storage type: {result['storage_type']}")
print(f"File size: {result['size']} bytes")
```

### Text Extraction

```python
from src.server.services.documents import DocumentExtractionService

# Initialize service
extraction_service = DocumentExtractionService()

# Extract text content
result = await extraction_service.extract_text_content(text_file)

print(f"Content: {result['content']}")
print(f"Lines: {result['metadata']['line_count']}")
print(f"Words: {result['metadata']['word_count']}")
print(f"Encoding: {result['metadata']['encoding']}")
```

### Markdown Extraction

```python
# Extract markdown with analysis
result = await extraction_service.extract_markdown_content(md_file)

print(f"Content: {result['content']}")
print(f"Has code blocks: {result['metadata']['has_code_blocks']}")
print(f"Has headers: {result['metadata']['has_headers']}")
print(f"Header count: {result['metadata']['header_count']}")
print(f"Code block count: {result['metadata']['code_block_count']}")
```

### Auto-detection by File Type

```python
# Automatic routing based on extension
result = await extraction_service.extract_content_by_type(
    file=uploaded_file,
    file_extension=".txt"  # or ".md"
)
```

## Configuration

### Environment Variables

```bash
# Supabase Storage (optional, for cloud storage)
SUPABASE_URL=http://supabase-ai-db:8000
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_STORAGE_BUCKET=documents

# Local Storage (fallback)
LOCAL_STORAGE_PATH=/tmp/archon-uploads
```

### Allowed File Types

| Extension | MIME Types | Max Size |
|-----------|------------|----------|
| .pdf | application/pdf | 50 MB |
| .md | text/markdown, text/plain | 50 MB |
| .txt | text/plain | 50 MB |
| .png | image/png | 50 MB |
| .jpg/.jpeg | image/jpeg | 50 MB |
| .py | text/x-python, text/plain | 50 MB |
| .js | application/javascript | 50 MB |
| .ts/.tsx | application/typescript | 50 MB |
| .jsx | application/javascript | 50 MB |

## Security Features

### Validation Checks

1. **File Extension**: Only whitelisted extensions allowed
2. **MIME Type**: Validates content-type header (with lenient fallback)
3. **File Size**: Maximum 50MB enforced
4. **User Permission**: Checks project access via UserAccessService
5. **Filename Sanitization**: Removes path traversal attempts and dangerous characters

### Example Validation

```python
# This will fail:
await upload_service.validate_upload(
    file=malicious_file,  # filename: "../../../etc/passwd"
    user_id=user_id,
    project_id=project_id
)
# HTTPException(400, "Unsupported file type")

# Sanitized filename:
safe_name = upload_service._sanitize_filename("../../../etc/passwd")
# Returns: "___________etc_passwd" or similar
```

## Error Handling

### Upload Service Errors

| Error Code | Description | Cause |
|------------|-------------|-------|
| 400 | Bad Request | Invalid file type, empty file, missing filename |
| 403 | Forbidden | User lacks project access |
| 413 | Payload Too Large | File exceeds 50MB limit |
| 500 | Internal Server Error | Storage failure, unexpected error |

### Extraction Service Errors

| Error Code | Description | Cause |
|------------|-------------|-------|
| 400 | Bad Request | Unsupported file type, encoding failure |
| 500 | Internal Server Error | Extraction failure, unexpected error |

## Integration with Existing Services

### UserAccessService Integration

```python
from src.server.services.user_access_service import UserAccessService

# Upload service uses access service for permission checks
upload_service = DocumentUploadService(
    access_service=UserAccessService()
)

# Automatically checks:
# 1. User has project access
# 2. User is admin or project owner/member
```

### Supabase Storage Integration

```python
# Storage hierarchy:
# projects/{project_id}/documents/{sanitized_filename}

# Example path:
# projects/550e8400-e29b-41d4-a716-446655440000/documents/my_document.txt

# Public URL (if Supabase configured):
# https://{project}.supabase.co/storage/v1/object/public/documents/{path}
```

## Testing

### Run Unit Tests

```bash
# From project root
cd python
pytest tests/test_document_services.py -v

# Run specific test
pytest tests/test_document_services.py::test_extract_text_content_utf8 -v

# With coverage
pytest tests/test_document_services.py --cov=src.server.services.documents
```

### Run Demo

```bash
# From project root
cd python
python examples/document_upload_demo.py
```

Expected output:
```
==============================================================
DEMO 1: Text File Extraction
==============================================================

Filename: sample.txt
Content:
Hello World!
This is a sample text file.
...

Metadata:
  line_count: 4
  word_count: 11
  char_count: 78
  encoding: utf-8
```

## API Endpoint Integration

### Example FastAPI Endpoint

```python
from fastapi import APIRouter, UploadFile, File, Depends
from uuid import UUID
from src.server.services.documents import (
    DocumentUploadService,
    DocumentExtractionService
)

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    project_id: UUID = ...,
    user_id: UUID = Depends(get_current_user),
):
    """Upload and process document."""
    upload_service = DocumentUploadService()
    extraction_service = DocumentExtractionService()

    # Validate
    await upload_service.validate_upload(file, user_id, project_id)

    # Extract content if text/markdown
    file_ext = Path(file.filename).suffix.lower()
    content_result = None

    if file_ext in ['.txt', '.md']:
        content_result = await extraction_service.extract_content_by_type(
            file, file_ext
        )

    # Store file
    storage_result = await upload_service.store_file(
        file, project_id, user_id
    )

    return {
        "success": True,
        "storage": storage_result[1],
        "extraction": content_result,
    }
```

## Best Practices

### 1. Always Validate Before Storage

```python
# ✓ GOOD
await upload_service.validate_upload(file, user_id, project_id)
await upload_service.store_file(file, project_id, user_id)

# ✗ BAD
await upload_service.store_file(file, project_id, user_id)  # No validation
```

### 2. Handle Encoding Gracefully

```python
# ✓ GOOD - Service handles multiple encodings automatically
result = await extraction_service.extract_text_content(file)

# ✗ BAD - Manual decoding without fallback
content = file.read().decode('utf-8')  # Fails on non-UTF8
```

### 3. Validate Extracted Content

```python
# ✓ GOOD
result = await extraction_service.extract_text_content(file)
is_valid, error = extraction_service.validate_extracted_content(
    result['content']
)
if not is_valid:
    raise ValueError(error)

# ✗ BAD - No validation
result = await extraction_service.extract_text_content(file)
# Use result['content'] without checking
```

### 4. Use Appropriate Storage Path

```python
# ✓ GOOD - Let service generate path
await upload_service.store_file(file, project_id, user_id)

# ✓ GOOD - Custom path with proper structure
custom_path = f"projects/{project_id}/documents/{category}/{filename}"
await upload_service.store_file(file, project_id, user_id, storage_path=custom_path)

# ✗ BAD - User-controlled path (security risk)
await upload_service.store_file(file, project_id, user_id, storage_path=user_input)
```

## Performance Considerations

### Large Files

- Files up to 50MB are supported
- Memory-efficient: Uses streaming where possible
- Supabase Storage handles large files efficiently

### Concurrent Uploads

- Services are stateless and thread-safe
- Each upload creates new service instance
- Database connection pooling via Supabase client singleton

### Encoding Detection

- Tries encodings in order of likelihood (UTF-8 first)
- Early exit on successful decode
- Minimal overhead for most files

## Future Enhancements

Planned features (not yet implemented):

1. **PDF text extraction** - PyPDF2 or pdfplumber integration
2. **Image OCR** - Tesseract integration for image text extraction
3. **Code syntax validation** - Verify code files are syntactically valid
4. **Virus scanning** - ClamAV integration
5. **Thumbnail generation** - For image files
6. **Chunking service** - Split large documents for RAG processing

## Troubleshooting

### Issue: "Supabase storage failed, falling back to local"

**Cause**: Supabase credentials not configured or storage bucket doesn't exist

**Solution**:
```bash
# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_KEY

# Create storage bucket in Supabase dashboard:
# Storage > New Bucket > Name: "documents"
```

### Issue: "Could not decode file with encodings"

**Cause**: File uses unsupported encoding

**Solution**:
```python
# Add custom encoding to ENCODINGS list
from src.server.services.documents.extraction_service import ENCODINGS
ENCODINGS.append('your-encoding-name')
```

### Issue: "Access denied to project"

**Cause**: User lacks permission to upload to project

**Solution**:
```python
# Grant user access to project
from src.server.services.user_access_service import UserAccessService
access_service = UserAccessService()
await access_service.add_user_to_project(
    user_id=user_id,
    project_id=project_id,
    access_level='member',
    added_by=admin_user_id
)
```

## Related Documentation

- [User Access Service](../services/user_access_service.py)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [FastAPI File Uploads](https://fastapi.tiangolo.com/tutorial/request-files/)

## Support

For issues or questions:
1. Check logs: `docker logs archon-backend`
2. Review test cases: `python/tests/test_document_services.py`
3. Run demo: `python examples/document_upload_demo.py`
