/**
 * DocumentViewerModal Usage Examples
 *
 * This file demonstrates how to use the DocumentViewerModal component
 * with different document types and integration patterns.
 */

import { useState } from "react";
import { Button } from "flowbite-react";
import { DocumentViewerModal } from "./DocumentViewerModal";
import { HiDocumentText, HiPhotograph, HiCode } from "react-icons/hi";

// Example 1: Basic Markdown Document
export function MarkdownDocumentExample() {
  const [isOpen, setIsOpen] = useState(false);

  const markdownDoc = {
    filename: "README.md",
    file_type: "markdown" as const,
    content: `# Project Documentation

## Overview
This is a comprehensive guide to using the DocumentViewerModal component.

### Features
- Multi-format support
- Dark mode compatibility
- Responsive design
- Zoom controls for images
- Syntax highlighting for code

### Installation
\`\`\`bash
npm install react-markdown react-pdf react-zoom-pan-pinch react-syntax-highlighter
\`\`\`

### Usage
Import and use the component in your React application.`,
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <HiDocumentText className="mr-2 h-4 w-4" />
        View Markdown
      </Button>
      <DocumentViewerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        document={markdownDoc}
      />
    </>
  );
}

// Example 2: Code Document with Syntax Highlighting
export function CodeDocumentExample() {
  const [isOpen, setIsOpen] = useState(false);

  const codeDoc = {
    filename: "example.tsx",
    file_type: "code" as const,
    content: `import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  disabled = false
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      {label}
    </button>
  );
};`,
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <HiCode className="mr-2 h-4 w-4" />
        View Code
      </Button>
      <DocumentViewerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        document={codeDoc}
      />
    </>
  );
}

// Example 3: Image Document with Zoom Controls
export function ImageDocumentExample() {
  const [isOpen, setIsOpen] = useState(false);

  const imageDoc = {
    filename: "architecture-diagram.png",
    file_type: "image" as const,
    mime_type: "image/png",
    // In real usage, this would be base64 encoded or a data URL
    content: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzRBOTBFMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjIwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkFyY2hpdGVjdHVyZTwvdGV4dD48L3N2Zz4=",
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <HiPhotograph className="mr-2 h-4 w-4" />
        View Image
      </Button>
      <DocumentViewerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        document={imageDoc}
      />
    </>
  );
}

// Example 4: Plain Text Document
export function TextDocumentExample() {
  const [isOpen, setIsOpen] = useState(false);

  const textDoc = {
    filename: "notes.txt",
    file_type: "text" as const,
    content: `Meeting Notes - 2025-01-26

Attendees:
- John Doe
- Jane Smith
- Bob Johnson

Agenda:
1. Project status update
2. Sprint planning
3. Technical architecture review

Action Items:
- Complete document viewer component
- Add multi-format support
- Test with various file types
- Update documentation`,
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <HiDocumentText className="mr-2 h-4 w-4" />
        View Text
      </Button>
      <DocumentViewerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        document={textDoc}
      />
    </>
  );
}

// Example 5: Integration with Document List
export function DocumentListIntegration() {
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  const documents = [
    {
      id: "1",
      filename: "API_DOCS.md",
      file_type: "markdown" as const,
      content: "# API Documentation\n\n## Endpoints\n\n### GET /api/projects\nReturns list of projects.",
    },
    {
      id: "2",
      filename: "helper.ts",
      file_type: "code" as const,
      content: "export function formatDate(date: Date): string {\n  return date.toISOString().split('T')[0];\n}",
    },
    {
      id: "3",
      filename: "requirements.txt",
      file_type: "text" as const,
      content: "fastapi==0.109.0\npydantic==2.5.0\nuvicorn==0.27.0",
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Project Documents</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedDoc(doc)}
          >
            <div className="flex items-center gap-2 mb-2">
              {doc.file_type === "code" && <HiCode className="h-5 w-5 text-blue-500" />}
              {doc.file_type === "markdown" && <HiDocumentText className="h-5 w-5 text-green-500" />}
              {doc.file_type === "text" && <HiDocumentText className="h-5 w-5 text-gray-500" />}
              <span className="font-medium truncate">{doc.filename}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Type: {doc.file_type.toUpperCase()}
            </p>
          </div>
        ))}
      </div>

      <DocumentViewerModal
        isOpen={selectedDoc !== null}
        onClose={() => setSelectedDoc(null)}
        document={selectedDoc}
      />
    </div>
  );
}

// Example 6: With Fetch from API
export function FetchDocumentExample() {
  const [isOpen, setIsOpen] = useState(false);
  const [document, setDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDocument = async (documentId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}`);
      const data = await response.json();

      // Transform API response to match DocumentViewerModal props
      setDocument({
        filename: data.filename,
        file_type: data.file_type,
        mime_type: data.mime_type,
        content: data.content,
        file_path: data.file_path,
      });

      setIsOpen(true);
    } catch (error) {
      console.error("Failed to fetch document:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => fetchDocument("doc-123")}
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : "Fetch & View Document"}
      </Button>

      <DocumentViewerModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setDocument(null);
        }}
        document={document}
      />
    </>
  );
}

// Complete example showing all formats in a single demo
export function ComprehensiveDemo() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold mb-4">DocumentViewerModal Examples</h1>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold mb-2">Markdown Documents</h3>
          <MarkdownDocumentExample />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Code Files</h3>
          <CodeDocumentExample />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Images</h3>
          <ImageDocumentExample />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Plain Text</h3>
          <TextDocumentExample />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Document List Integration</h3>
          <DocumentListIntegration />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Fetch from API</h3>
          <FetchDocumentExample />
        </div>
      </div>
    </div>
  );
}
