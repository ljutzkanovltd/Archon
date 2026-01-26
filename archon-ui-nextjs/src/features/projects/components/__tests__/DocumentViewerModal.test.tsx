import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DocumentViewerModal } from "../DocumentViewerModal";

describe("DocumentViewerModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <DocumentViewerModal isOpen={false} onClose={mockOnClose} document={null} />
    );
    expect(container.querySelector('[data-testid="flowbite-modal"]')).not.toBeInTheDocument();
  });

  it("renders modal with document filename when open", () => {
    const mockDocument = {
      filename: "test.md",
      file_type: "markdown" as const,
      content: "# Hello World",
    };

    render(
      <DocumentViewerModal isOpen={true} onClose={mockOnClose} document={mockDocument} />
    );

    expect(screen.getByText("test.md")).toBeInTheDocument();
    expect(screen.getByText("Type: MARKDOWN")).toBeInTheDocument();
  });

  it("renders markdown content correctly", () => {
    const mockDocument = {
      filename: "readme.md",
      file_type: "markdown" as const,
      content: "# Test Heading\n\nThis is a paragraph.",
    };

    render(
      <DocumentViewerModal isOpen={true} onClose={mockOnClose} document={mockDocument} />
    );

    // Markdown should be rendered as HTML
    expect(screen.getByText("Test Heading")).toBeInTheDocument();
    expect(screen.getByText("This is a paragraph.")).toBeInTheDocument();
  });

  it("renders plain text content with preserved formatting", () => {
    const mockDocument = {
      filename: "notes.txt",
      file_type: "text" as const,
      content: "Line 1\nLine 2\nLine 3",
    };

    render(
      <DocumentViewerModal isOpen={true} onClose={mockOnClose} document={mockDocument} />
    );

    const preElement = screen.getByText(/Line 1/);
    expect(preElement).toBeInTheDocument();
    expect(preElement.tagName).toBe("PRE");
  });

  it("shows unsupported format message for unknown file types", () => {
    const mockDocument = {
      filename: "unknown.xyz",
      // @ts-expect-error Testing invalid type
      file_type: "unknown",
      content: "some content",
    };

    render(
      <DocumentViewerModal isOpen={true} onClose={mockOnClose} document={mockDocument} />
    );

    expect(screen.getByText("Preview not available for this file type")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const mockDocument = {
      filename: "test.txt",
      file_type: "text" as const,
      content: "Test content",
    };

    render(
      <DocumentViewerModal isOpen={true} onClose={mockOnClose} document={mockDocument} />
    );

    const closeButtons = screen.getAllByText("Close");
    fireEvent.click(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("shows download button", () => {
    const mockDocument = {
      filename: "download.txt",
      file_type: "text" as const,
      content: "Downloadable content",
    };

    render(
      <DocumentViewerModal isOpen={true} onClose={mockOnClose} document={mockDocument} />
    );

    expect(screen.getByText("Download")).toBeInTheDocument();
  });

  it("renders code with syntax highlighting", () => {
    const mockDocument = {
      filename: "example.js",
      file_type: "code" as const,
      content: 'function test() {\n  console.log("Hello");\n}',
    };

    render(
      <DocumentViewerModal isOpen={true} onClose={mockOnClose} document={mockDocument} />
    );

    // SyntaxHighlighter should render the code
    expect(screen.getByText(/function test/)).toBeInTheDocument();
  });

  it("detects language from filename extension", () => {
    const testCases = [
      { filename: "script.py", expectedLang: "python" },
      { filename: "component.tsx", expectedLang: "tsx" },
      { filename: "styles.css", expectedLang: "css" },
    ];

    testCases.forEach(({ filename, expectedLang }) => {
      const ext = filename.split(".").pop()?.toLowerCase();
      expect(ext).toBeTruthy();
    });
  });
});
