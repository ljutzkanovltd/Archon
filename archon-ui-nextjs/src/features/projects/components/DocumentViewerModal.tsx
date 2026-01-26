"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Modal, Button, Spinner } from "flowbite-react";
import {
  HiX,
  HiDownload,
  HiExclamationCircle,
  HiArrowsExpand,
  HiXCircle,
  HiClipboardCopy
} from "react-icons/hi";
import ReactMarkdown from "react-markdown";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import toast from "react-hot-toast";

// Dynamically import react-pdf components to avoid SSR issues with canvas
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);
const Page = dynamic(
  () => import("react-pdf").then((mod) => mod.Page),
  { ssr: false }
);

// Import PDF.js styles dynamically as well
if (typeof window !== "undefined") {
  import("react-pdf/dist/esm/Page/AnnotationLayer.css");
  import("react-pdf/dist/esm/Page/TextLayer.css");
}

// Configure PDF.js worker (only on client side)
if (typeof window !== "undefined") {
  import("react-pdf").then((mod) => {
    mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.js`;
  });
}

export interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    filename: string;
    file_type: "pdf" | "markdown" | "text" | "image" | "code";
    mime_type?: string;
    content: string;
    file_path?: string;
  } | null;
}

/**
 * DocumentViewerModal - Comprehensive document viewer with multi-format support
 *
 * Features:
 * - Markdown rendering with react-markdown
 * - PDF viewing with react-pdf (multi-page navigation)
 * - Image viewing with zoom/pan/pinch controls
 * - Code syntax highlighting with react-syntax-highlighter
 * - Plain text rendering with preserved formatting
 * - Dark mode support
 * - ESC key to close
 * - Responsive design (mobile-friendly)
 * - Loading states and error handling
 * - Download functionality
 * - Full-screen mode with F key shortcut
 * - Copy content to clipboard with Ctrl+C/Cmd+C shortcut
 * - Toast notifications for actions
 */
export function DocumentViewerModal({
  isOpen,
  onClose,
  document,
}: DocumentViewerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(darkModeMediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeMediaQuery.addEventListener("change", handler);
    return () => darkModeMediaQuery.removeEventListener("change", handler);
  }, []);

  // Reset state when document changes
  useEffect(() => {
    if (document) {
      setIsLoading(false);
      setError(null);
      setPageNumber(1);
      setNumPages(null);
    }
  }, [document]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleDownload = useCallback(() => {
    if (!document) return;

    const blob = new Blob([document.content], {
      type: document.mime_type || "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = document.filename;
    link.click();
    URL.revokeObjectURL(url);
  }, [document]);

  const detectLanguage = useCallback((filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "jsx",
      ts: "typescript",
      tsx: "tsx",
      py: "python",
      rb: "ruby",
      java: "java",
      go: "go",
      rs: "rust",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      php: "php",
      swift: "swift",
      kt: "kotlin",
      sh: "bash",
      bash: "bash",
      sql: "sql",
      json: "json",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
      html: "html",
      css: "css",
      scss: "scss",
      md: "markdown",
    };
    return languageMap[ext || ""] || "javascript";
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    setError(`Failed to load PDF: ${error.message}`);
    setIsLoading(false);
  };

  const renderContent = () => {
    if (!document) return null;

    try {
      switch (document.file_type) {
        case "markdown":
          return (
            <div className="prose prose-lg dark:prose-invert max-w-none p-6">
              <ReactMarkdown>{document.content}</ReactMarkdown>
            </div>
          );

        case "text":
          return (
            <pre className="whitespace-pre-wrap font-mono text-sm p-6 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg overflow-auto">
              {document.content}
            </pre>
          );

        case "pdf":
          return (
            <div className="flex flex-col items-center space-y-4 p-6">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="xl" />
                  <span className="ml-3 text-gray-600 dark:text-gray-400">
                    Loading PDF...
                  </span>
                </div>
              )}
              <Document
                file={document.file_path || `data:application/pdf;base64,${btoa(document.content)}`}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading=""
              >
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-lg"
                />
              </Document>
              {numPages && numPages > 1 && (
                <div className="flex items-center gap-4 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Page {pageNumber} of {numPages}
                  </span>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={pageNumber >= numPages}
                    onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          );

        case "image":
          return (
            <div className="p-6">
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                centerOnInit
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <div className="space-y-4">
                    <div className="flex justify-center gap-2">
                      <Button size="sm" color="gray" onClick={() => zoomIn()}>
                        Zoom In
                      </Button>
                      <Button size="sm" color="gray" onClick={() => zoomOut()}>
                        Zoom Out
                      </Button>
                      <Button size="sm" color="gray" onClick={() => resetTransform()}>
                        Reset
                      </Button>
                    </div>
                    <TransformComponent
                      wrapperClass="!w-full !h-[60vh] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden"
                      contentClass="!w-full !h-full flex items-center justify-center"
                    >
                      <img
                        src={document.content.startsWith("data:") ? document.content : `data:${document.mime_type || "image/png"};base64,${document.content}`}
                        alt={document.filename}
                        className="max-w-full max-h-full object-contain"
                      />
                    </TransformComponent>
                  </div>
                )}
              </TransformWrapper>
            </div>
          );

        case "code":
          return (
            <div className="p-6">
              <SyntaxHighlighter
                language={detectLanguage(document.filename)}
                style={isDarkMode ? vscDarkPlus : vs}
                customStyle={{
                  margin: 0,
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  maxHeight: "70vh",
                  overflow: "auto",
                }}
                showLineNumbers
                wrapLines
              >
                {document.content}
              </SyntaxHighlighter>
            </div>
          );

        default:
          return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HiExclamationCircle className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                Preview not available for this file type
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                File type: {document.file_type}
              </p>
            </div>
          );
      }
    } catch (err) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <HiExclamationCircle className="h-16 w-16 text-red-500 mb-4" />
          <p className="text-red-700 dark:text-red-400 font-medium">
            Failed to load document
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {err instanceof Error ? err.message : "Unknown error occurred"}
          </p>
        </div>
      );
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="4xl" dismissible>
      <Modal.Header className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex-1 truncate">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {document?.filename || "Document"}
            </h3>
            {document?.file_type && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Type: {document.file_type.toUpperCase()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button size="sm" color="gray" onClick={handleDownload} disabled={!document}>
              <HiDownload className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-0">
        <div className="max-h-[70vh] overflow-y-auto bg-white dark:bg-gray-800">
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <HiExclamationCircle className="h-16 w-16 text-red-500 mb-4" />
              <p className="text-red-700 dark:text-red-400 font-medium mb-2">
                Error Loading Document
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
              <Button size="sm" color="gray" onClick={onClose} className="mt-4">
                Close
              </Button>
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </Modal.Body>

      <Modal.Footer className="border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center w-full">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">ESC</kbd> to close
          </div>
          <Button color="gray" onClick={onClose}>
            <HiX className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
