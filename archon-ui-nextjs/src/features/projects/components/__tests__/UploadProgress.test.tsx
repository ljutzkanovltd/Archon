import { render, screen, waitFor } from "@testing-library/react";
import { UploadProgress } from "../UploadProgress";
import { progressApi } from "@/lib/apiClient";

// Mock the apiClient
jest.mock("@/lib/apiClient", () => ({
  progressApi: {
    getById: jest.fn(),
    stop: jest.fn(),
  },
}));

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("UploadProgress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    (progressApi.getById as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <UploadProgress
        progressId="test-progress-id"
        operationType="upload"
      />
    );

    expect(screen.getByText(/Loading progress/i)).toBeInTheDocument();
  });

  it("renders progress data when available", async () => {
    (progressApi.getById as jest.Mock).mockResolvedValue({
      operation: {
        id: "test-progress-id",
        operation_type: "upload",
        status: "processing",
        progress_percentage: 50,
        message: "Processing document",
        filename: "test.pdf",
        started_at: new Date().toISOString(),
      },
    });

    render(
      <UploadProgress
        progressId="test-progress-id"
        operationType="upload"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Processing test.pdf/i)).toBeInTheDocument();
      expect(screen.getByText(/50%/i)).toBeInTheDocument();
    });
  });

  it("calls onComplete when operation completes", async () => {
    const onComplete = jest.fn();

    (progressApi.getById as jest.Mock).mockResolvedValue({
      operation: {
        id: "test-progress-id",
        operation_type: "upload",
        status: "completed",
        progress_percentage: 100,
        message: "Upload complete",
        filename: "test.pdf",
        started_at: new Date().toISOString(),
      },
    });

    render(
      <UploadProgress
        progressId="test-progress-id"
        operationType="upload"
        onComplete={onComplete}
      />
    );

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("calls onError when operation fails", async () => {
    const onError = jest.fn();

    (progressApi.getById as jest.Mock).mockResolvedValue({
      operation: {
        id: "test-progress-id",
        operation_type: "upload",
        status: "error",
        progress_percentage: 25,
        message: "Upload failed",
        error_message: "Failed to process document",
        filename: "test.pdf",
        started_at: new Date().toISOString(),
      },
    });

    render(
      <UploadProgress
        progressId="test-progress-id"
        operationType="upload"
        onError={onError}
      />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("Failed to process document");
    });
  });

  it("displays crawl stats for crawl operations", async () => {
    (progressApi.getById as jest.Mock).mockResolvedValue({
      operation: {
        id: "test-progress-id",
        operation_type: "crawl",
        status: "crawling",
        progress_percentage: 60,
        message: "Crawling pages",
        url: "https://example.com",
        pages_crawled: 10,
        total_pages: 20,
        code_examples_found: 5,
        started_at: new Date().toISOString(),
      },
    });

    render(
      <UploadProgress
        progressId="test-progress-id"
        operationType="crawl"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("Pages Crawled")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(screen.getByText("Total Pages")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("Code Examples")).toBeInTheDocument();
    });
  });
});
