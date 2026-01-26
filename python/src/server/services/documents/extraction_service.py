"""
Document Extraction Service

Handles text, markdown, and PDF extraction from uploaded files.
Supports multiple encodings and provides detailed metadata.
"""

import io
from typing import Dict, Any, Tuple, List
from fastapi import UploadFile, HTTPException
from ...config.logfire_config import get_logger

logger = get_logger(__name__)

# Encoding detection order (most common to least common)
ENCODINGS = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1', 'utf-16']


class DocumentExtractionService:
    """Service for extracting text content from various document formats."""

    async def extract_text_content(self, file: UploadFile) -> Dict[str, Any]:
        """
        Extract plain text content from .txt files.

        Tries multiple encodings to ensure successful decoding.
        Provides detailed metadata about the extracted content.

        Args:
            file: Uploaded text file

        Returns:
            Dict containing:
                - content: Extracted text content
                - metadata: Dict with line_count, word_count, char_count, encoding

        Raises:
            HTTPException: If extraction fails
        """
        try:
            # Read file content
            file_bytes = await file.read()

            # Try encodings in order
            content = None
            detected_encoding = None

            for encoding in ENCODINGS:
                try:
                    content = file_bytes.decode(encoding)
                    detected_encoding = encoding
                    logger.info(
                        f"Successfully decoded text file | "
                        f"filename={file.filename} | encoding={encoding}"
                    )
                    break
                except (UnicodeDecodeError, AttributeError):
                    continue

            if content is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not decode file with encodings: {', '.join(ENCODINGS)}"
                )

            # Calculate metadata
            lines = content.split('\n')
            words = content.split()
            chars = len(content)

            metadata = {
                'line_count': len(lines),
                'word_count': len(words),
                'char_count': chars,
                'encoding': detected_encoding,
                'has_empty_lines': any(line.strip() == '' for line in lines),
                'avg_line_length': chars / len(lines) if len(lines) > 0 else 0,
            }

            logger.info(
                f"Text extraction complete | filename={file.filename} | "
                f"lines={metadata['line_count']} | "
                f"words={metadata['word_count']} | "
                f"encoding={detected_encoding}"
            )

            # Reset file pointer for potential re-reading
            await file.seek(0)

            return {
                'content': content,
                'metadata': metadata,
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Text extraction error | filename={file.filename} | error={str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Text extraction failed: {str(e)}"
            )

    async def extract_markdown_content(self, file: UploadFile) -> Dict[str, Any]:
        """
        Extract markdown content while preserving formatting.

        Markdown files are treated similarly to text files but with
        additional analysis of markdown-specific elements.

        Args:
            file: Uploaded markdown file

        Returns:
            Dict containing:
                - content: Extracted markdown content (formatting preserved)
                - metadata: Dict with markdown-specific stats

        Raises:
            HTTPException: If extraction fails
        """
        try:
            # Read file content
            file_bytes = await file.read()

            # Try encodings in order
            content = None
            detected_encoding = None

            for encoding in ENCODINGS:
                try:
                    content = file_bytes.decode(encoding)
                    detected_encoding = encoding
                    logger.info(
                        f"Successfully decoded markdown file | "
                        f"filename={file.filename} | encoding={encoding}"
                    )
                    break
                except (UnicodeDecodeError, AttributeError):
                    continue

            if content is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not decode file with encodings: {', '.join(ENCODINGS)}"
                )

            # Calculate basic metadata
            lines = content.split('\n')
            words = content.split()
            chars = len(content)

            # Markdown-specific analysis
            metadata = {
                'line_count': len(lines),
                'word_count': len(words),
                'char_count': chars,
                'encoding': detected_encoding,
                'has_code_blocks': '```' in content,
                'has_headers': any(line.strip().startswith('#') for line in lines),
                'has_links': '[' in content and '](' in content,
                'has_images': '![' in content,
                'has_tables': '|' in content,
                'code_block_count': content.count('```') // 2,  # Opening and closing
                'header_count': sum(1 for line in lines if line.strip().startswith('#')),
            }

            # Count header levels
            header_levels = {}
            for line in lines:
                stripped = line.strip()
                if stripped.startswith('#'):
                    level = len(stripped) - len(stripped.lstrip('#'))
                    header_levels[f'h{level}'] = header_levels.get(f'h{level}', 0) + 1

            metadata['header_levels'] = header_levels

            logger.info(
                f"Markdown extraction complete | filename={file.filename} | "
                f"lines={metadata['line_count']} | "
                f"words={metadata['word_count']} | "
                f"headers={metadata['header_count']} | "
                f"code_blocks={metadata['code_block_count']} | "
                f"encoding={detected_encoding}"
            )

            # Reset file pointer for potential re-reading
            await file.seek(0)

            return {
                'content': content,
                'metadata': metadata,
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                f"Markdown extraction error | filename={file.filename} | error={str(e)}"
            )
            raise HTTPException(
                status_code=500,
                detail=f"Markdown extraction failed: {str(e)}"
            )

    async def extract_pdf_content(self, file: UploadFile) -> Dict[str, Any]:
        """
        Extract text from PDF with page-level granularity.

        Uses pdfplumber as primary extraction method with PyPDF2 as fallback.
        Provides detailed metadata including page count, dimensions, and text statistics.

        Args:
            file: Uploaded PDF file

        Returns:
            Dict containing:
                - content: Full text (all pages concatenated)
                - pages: List of page-level data with content and dimensions
                - metadata: PDF metadata (title, author, page count, etc.)

        Raises:
            HTTPException: If extraction fails or PDF is invalid
        """
        try:
            # Read file into memory
            pdf_bytes = await file.read()

            # Try pdfplumber first (preferred for better text extraction)
            try:
                result = await self._extract_pdf_with_pdfplumber(pdf_bytes, file.filename)
                logger.info(
                    f"PDF extraction successful (pdfplumber) | "
                    f"filename={file.filename} | "
                    f"pages={result['metadata'].get('total_pages', 0)}"
                )
                return result
            except Exception as pdfplumber_error:
                logger.warning(
                    f"pdfplumber extraction failed, trying PyPDF2 fallback | "
                    f"filename={file.filename} | "
                    f"error={str(pdfplumber_error)}"
                )
                # Fallback to PyPDF2
                result = await self._extract_pdf_with_pypdf2(pdf_bytes, file.filename)
                logger.info(
                    f"PDF extraction successful (PyPDF2 fallback) | "
                    f"filename={file.filename} | "
                    f"pages={result['metadata'].get('total_pages', 0)}"
                )
                return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                f"PDF extraction error | filename={file.filename} | error={str(e)}"
            )
            raise HTTPException(
                status_code=500,
                detail=f"PDF extraction failed: {str(e)}"
            )

    async def _extract_pdf_with_pdfplumber(
        self,
        pdf_bytes: bytes,
        filename: str
    ) -> Dict[str, Any]:
        """
        Extract PDF content using pdfplumber (preferred method).

        Args:
            pdf_bytes: PDF file bytes
            filename: Original filename for logging

        Returns:
            Dict with content, pages, and metadata
        """
        try:
            import pdfplumber
        except ImportError:
            raise ImportError(
                "pdfplumber is required for PDF extraction. "
                "Install with: pip install pdfplumber"
            )

        pdf_stream = io.BytesIO(pdf_bytes)
        pages_data: List[Dict[str, Any]] = []
        full_text: List[str] = []

        with pdfplumber.open(pdf_stream) as pdf:
            # Extract metadata
            metadata = {
                'total_pages': len(pdf.pages),
                'title': pdf.metadata.get('Title', '') if pdf.metadata else '',
                'author': pdf.metadata.get('Author', '') if pdf.metadata else '',
                'creator': pdf.metadata.get('Creator', '') if pdf.metadata else '',
                'producer': pdf.metadata.get('Producer', '') if pdf.metadata else '',
                'subject': pdf.metadata.get('Subject', '') if pdf.metadata else '',
                'extraction_method': 'pdfplumber',
            }

            # Extract text per page
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()

                if text:
                    pages_data.append({
                        'page_number': i + 1,
                        'content': text,
                        'width': float(page.width) if page.width else 0,
                        'height': float(page.height) if page.height else 0,
                        'char_count': len(text),
                        'word_count': len(text.split()),
                    })
                    full_text.append(text)
                else:
                    # Empty page or image-only page
                    pages_data.append({
                        'page_number': i + 1,
                        'content': '',
                        'width': float(page.width) if page.width else 0,
                        'height': float(page.height) if page.height else 0,
                        'char_count': 0,
                        'word_count': 0,
                    })

        # Check if we extracted any text
        combined_content = '\n\n'.join(full_text)
        if not combined_content.strip():
            metadata['warning'] = (
                'No text extracted from PDF. This may be an image-based PDF '
                'that requires OCR for text extraction.'
            )
            logger.warning(
                f"No text extracted from PDF (image-based?) | filename={filename}"
            )

        # Add content statistics to metadata
        metadata['total_chars'] = len(combined_content)
        metadata['total_words'] = len(combined_content.split())
        metadata['pages_with_text'] = sum(1 for p in pages_data if p['content'].strip())

        return {
            'content': combined_content,
            'pages': pages_data,
            'metadata': metadata,
        }

    async def _extract_pdf_with_pypdf2(
        self,
        pdf_bytes: bytes,
        filename: str
    ) -> Dict[str, Any]:
        """
        Extract PDF content using PyPDF2 (fallback method).

        Args:
            pdf_bytes: PDF file bytes
            filename: Original filename for logging

        Returns:
            Dict with content, pages, and metadata
        """
        try:
            import PyPDF2
        except ImportError:
            raise ImportError(
                "PyPDF2 is required for PDF extraction. "
                "Install with: pip install PyPDF2"
            )

        pdf_stream = io.BytesIO(pdf_bytes)

        try:
            reader = PyPDF2.PdfReader(pdf_stream)
        except PyPDF2.errors.PdfReadError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Corrupted or invalid PDF file: {str(e)}"
            )
        except Exception as e:
            if "password" in str(e).lower() or "encrypted" in str(e).lower():
                raise HTTPException(
                    status_code=403,
                    detail="Password-protected PDFs are not supported"
                )
            raise

        pages_data: List[Dict[str, Any]] = []
        full_text: List[str] = []

        # Extract pages
        for i, page in enumerate(reader.pages):
            try:
                text = page.extract_text()
                pages_data.append({
                    'page_number': i + 1,
                    'content': text,
                    'char_count': len(text),
                    'word_count': len(text.split()),
                })
                full_text.append(text)
            except Exception as page_error:
                logger.warning(
                    f"Failed to extract page {i + 1} | "
                    f"filename={filename} | "
                    f"error={str(page_error)}"
                )
                pages_data.append({
                    'page_number': i + 1,
                    'content': '',
                    'char_count': 0,
                    'word_count': 0,
                    'error': str(page_error),
                })

        # Extract metadata
        metadata_obj = reader.metadata if reader.metadata else {}
        metadata = {
            'total_pages': len(reader.pages),
            'title': metadata_obj.get('/Title', '') if metadata_obj else '',
            'author': metadata_obj.get('/Author', '') if metadata_obj else '',
            'creator': metadata_obj.get('/Creator', '') if metadata_obj else '',
            'producer': metadata_obj.get('/Producer', '') if metadata_obj else '',
            'subject': metadata_obj.get('/Subject', '') if metadata_obj else '',
            'extraction_method': 'PyPDF2',
        }

        # Check if we extracted any text
        combined_content = '\n\n'.join(full_text)
        if not combined_content.strip():
            metadata['warning'] = (
                'No text extracted from PDF. This may be an image-based PDF '
                'that requires OCR for text extraction.'
            )
            logger.warning(
                f"No text extracted from PDF (image-based?) | filename={filename}"
            )

        # Add content statistics to metadata
        metadata['total_chars'] = len(combined_content)
        metadata['total_words'] = len(combined_content.split())
        metadata['pages_with_text'] = sum(1 for p in pages_data if p['content'].strip())

        return {
            'content': combined_content,
            'pages': pages_data,
            'metadata': metadata,
        }

    async def extract_content_by_type(
        self,
        file: UploadFile,
        file_extension: str,
    ) -> Dict[str, Any]:
        """
        Extract content based on file type.

        Routes to appropriate extraction method based on file extension.

        Args:
            file: Uploaded file
            file_extension: File extension (e.g., '.txt', '.md', '.pdf')

        Returns:
            Dict containing content and metadata

        Raises:
            HTTPException: If file type is unsupported or extraction fails
        """
        try:
            if file_extension == '.txt':
                return await self.extract_text_content(file)
            elif file_extension == '.md':
                return await self.extract_markdown_content(file)
            elif file_extension == '.pdf':
                return await self.extract_pdf_content(file)
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type for extraction: {file_extension}"
                )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                f"Content extraction error | filename={file.filename} | "
                f"extension={file_extension} | error={str(e)}"
            )
            raise HTTPException(
                status_code=500,
                detail=f"Content extraction failed: {str(e)}"
            )

    def validate_extracted_content(self, content: str, min_length: int = 10) -> Tuple[bool, str]:
        """
        Validate extracted content meets minimum requirements.

        Args:
            content: Extracted text content
            min_length: Minimum character count (default: 10)

        Returns:
            Tuple of (is_valid: bool, error_message: str)
        """
        if not content or not isinstance(content, str):
            return False, "Content is empty or invalid type"

        if len(content.strip()) < min_length:
            return False, f"Content too short (min: {min_length} characters)"

        # Check if content is mostly non-printable characters
        printable_chars = sum(1 for c in content if c.isprintable() or c in ['\n', '\r', '\t'])
        printable_ratio = printable_chars / len(content) if len(content) > 0 else 0

        if printable_ratio < 0.8:
            return False, "Content contains too many non-printable characters"

        return True, ""

    async def extract_metadata_only(self, file: UploadFile) -> Dict[str, Any]:
        """
        Extract only metadata without full content (for large files).

        Useful for getting file statistics without loading entire content.

        Args:
            file: Uploaded file

        Returns:
            Dict containing metadata only
        """
        try:
            # Read file
            file_bytes = await file.read()

            # Try to decode for basic stats
            content = None
            detected_encoding = None

            for encoding in ENCODINGS:
                try:
                    content = file_bytes.decode(encoding)
                    detected_encoding = encoding
                    break
                except (UnicodeDecodeError, AttributeError):
                    continue

            if content is None:
                return {
                    'error': 'Could not decode file',
                    'size_bytes': len(file_bytes),
                }

            # Quick metadata calculation
            lines = content.split('\n')
            metadata = {
                'size_bytes': len(file_bytes),
                'line_count': len(lines),
                'word_count': len(content.split()),
                'char_count': len(content),
                'encoding': detected_encoding,
                'filename': file.filename,
            }

            # Reset file pointer
            await file.seek(0)

            return metadata

        except Exception as e:
            logger.error(f"Metadata extraction error: {str(e)}")
            return {'error': str(e), 'filename': file.filename}
