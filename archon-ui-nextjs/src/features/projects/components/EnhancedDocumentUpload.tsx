"use client";

import { useState } from "react";
import { HiX, HiGlobeAlt, HiUpload } from "react-icons/hi";
import { UploadProgress } from "./UploadProgress";

/**
 * Enhanced Document Upload Component for Project Documents
 *
 * Supports two upload methods:
 * 1. File Upload - Drag-and-drop or browse to upload documents
 * 2. URL Crawl - Crawl website URLs to extract documentation
 *
 * Features:
 * - Two-tab interface (Upload | Crawl)
 * - Metadata configuration (knowledge type, tags, code extraction)
 * - Privacy controls (project-private, send to KB)
 * - Form validation
 * - Loading/success/error states
 * - Real-time progress monitoring
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <EnhancedDocumentUpload
 *   projectId="project-uuid"
 *   onSuccess={() => console.log("Upload successful")}
 *   onError={(err) => console.error(err)}
 * />
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

interface EnhancedDocumentUploadProps {
  /** Project ID to associate the document with */
  projectId: string;
  /** Callback fired on successful upload/crawl */
  onSuccess?: () => void;
  /** Callback fired on error */
  onError?: (error: string) => void;
}

interface UploadResponse {
  success: boolean;
  progressId: string;
  message: string;
  filename?: string;
}

interface CrawlResponse {
  success: boolean;
  progressId: string;
  message: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EnhancedDocumentUpload({
  projectId,
  onSuccess,
  onError,
}: EnhancedDocumentUploadProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<"upload" | "crawl">("upload");

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"technical" | "business">("technical");
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadTagInput, setUploadTagInput] = useState("");

  // Crawl form state
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlType, setCrawlType] = useState<"technical" | "business">("technical");
  const [crawlTags, setCrawlTags] = useState<string[]>([]);
  const [crawlTagInput, setCrawlTagInput] = useState("");
  const [crawlDepth, setCrawlDepth] = useState(2);

  // Shared metadata state
  const [extractCodeExamples, setExtractCodeExamples] = useState(true);
  const [isProjectPrivate, setIsProjectPrivate] = useState(true);
  const [sendToKB, setSendToKB] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const resetForm = () => {
    setSelectedFile(null);
    setUploadType("technical");
    setUploadTags([]);
    setUploadTagInput("");
    setCrawlUrl("");
    setCrawlType("technical");
    setCrawlTags([]);
    setCrawlTagInput("");
    setCrawlDepth(2);
    setExtractCodeExamples(true);
    setIsProjectPrivate(true);
    setSendToKB(false);
    setError(null);
    setProgressId(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedFile) {
      setError("Please select a file to upload");
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare FormData
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("knowledge_type", uploadType);
      formData.append("tags", JSON.stringify(uploadTags));
      formData.append("extract_code_examples", String(extractCodeExamples));
      formData.append("is_project_private", String(isProjectPrivate));
      formData.append("send_to_kb", String(sendToKB));

      // Get auth token
      const token =
        typeof window !== "undefined" ? localStorage.getItem("archon_token") : null;

      // Submit to backend
      const response = await fetch(`http://localhost:8181/api/projects/${projectId}/documents/upload`, {
        method: "POST",
        body: formData,
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to upload document");
      }

      const data: UploadResponse = await response.json();

      // Set progress ID to start monitoring
      if (data.progressId) {
        setProgressId(data.progressId);
      } else {
        // No progress tracking, treat as immediate success
        resetForm();
        onSuccess?.();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload document";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCrawlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!crawlUrl.trim()) {
      setError("URL is required");
      return;
    }

    // Basic URL validation
    try {
      new URL(crawlUrl);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare request body
      const requestBody = {
        url: crawlUrl,
        max_depth: crawlDepth,
        knowledge_type: crawlType,
        tags: crawlTags,
        extract_code_examples: extractCodeExamples,
        is_project_private: isProjectPrivate,
        send_to_kb: sendToKB,
      };

      // Get auth token
      const token =
        typeof window !== "undefined" ? localStorage.getItem("archon_token") : null;

      // Submit to backend
      const response = await fetch(`http://localhost:8181/api/projects/${projectId}/documents/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to start crawl");
      }

      const data: CrawlResponse = await response.json();

      // Set progress ID to start monitoring
      if (data.progressId) {
        setProgressId(data.progressId);
      } else {
        // No progress tracking, treat as immediate success
        resetForm();
        onSuccess?.();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start crawl";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tag management handlers
  const handleAddUploadTag = () => {
    const tag = uploadTagInput.trim();
    if (tag && !uploadTags.includes(tag)) {
      setUploadTags([...uploadTags, tag]);
      setUploadTagInput("");
    }
  };

  const handleRemoveUploadTag = (tagToRemove: string) => {
    setUploadTags(uploadTags.filter((tag) => tag !== tagToRemove));
  };

  const handleAddCrawlTag = () => {
    const tag = crawlTagInput.trim();
    if (tag && !crawlTags.includes(tag)) {
      setCrawlTags([...crawlTags, tag]);
      setCrawlTagInput("");
    }
  };

  const handleRemoveCrawlTag = (tagToRemove: string) => {
    setCrawlTags(crawlTags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, handler: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handler();
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Progress Monitor (when operation is in progress) */}
      {progressId && (
        <UploadProgress
          progressId={progressId}
          operationType={activeTab}
          onComplete={() => {
            setProgressId(null);
            resetForm();
            onSuccess?.();
          }}
          onError={(errorMsg) => {
            setProgressId(null);
            setError(errorMsg);
            onError?.(errorMsg);
          }}
          onCancel={() => {
            setProgressId(null);
            resetForm();
          }}
        />
      )}

      {/* Upload Form (hide when operation is in progress) */}
      <div
        className={`rounded-lg bg-white p-6 shadow dark:bg-gray-800 ${
          progressId ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Add Project Document
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Upload files or crawl websites to add documentation to this project.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("upload")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "upload"
              ? "border-b-2 border-purple-500 text-purple-600 dark:text-purple-400"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <HiUpload className="h-5 w-5" />
          Upload Document
        </button>
        <button
          onClick={() => setActiveTab("crawl")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "crawl"
              ? "border-b-2 border-cyan-500 text-cyan-600 dark:text-cyan-400"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          <HiGlobeAlt className="h-5 w-5" />
          Crawl URL
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === "upload" && (
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {/* File Input */}
          <div>
            <label
              htmlFor="file"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Document File <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="file"
                id="file"
                accept=".txt,.md,.pdf,.doc,.docx,.html,.htm"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={isSubmitting}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />
              <div
                className={`flex h-20 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                  selectedFile
                    ? "border-purple-400 bg-purple-50 dark:border-purple-500 dark:bg-purple-900/20"
                    : "border-gray-300 bg-gray-50 hover:border-purple-400 dark:border-gray-600 dark:bg-gray-700/50"
                } ${isSubmitting ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <HiUpload
                  className={`h-6 w-6 ${
                    selectedFile ? "text-purple-500" : "text-gray-400 dark:text-gray-500"
                  }`}
                />
                <div className="text-sm">
                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="font-medium text-purple-700 dark:text-purple-400">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        {Math.round(selectedFile.size / 1024)} KB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        Click to browse or drag & drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PDF, DOC, DOCX, TXT, MD, HTML files supported
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Knowledge Type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Knowledge Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="upload_knowledge_type"
                  value="technical"
                  checked={uploadType === "technical"}
                  onChange={(e) => setUploadType(e.target.value as "technical" | "business")}
                  disabled={isSubmitting}
                  className="mr-2 h-4 w-4 border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Technical <span className="text-xs text-gray-500">(Code, APIs, dev docs)</span>
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="upload_knowledge_type"
                  value="business"
                  checked={uploadType === "business"}
                  onChange={(e) => setUploadType(e.target.value as "technical" | "business")}
                  disabled={isSubmitting}
                  className="mr-2 h-4 w-4 border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Business <span className="text-xs text-gray-500">(Guides, policies, general)</span>
                </span>
              </label>
            </div>
          </div>

          {/* Tags Input */}
          <div>
            <label
              htmlFor="upload_tags"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="upload_tags"
                value={uploadTagInput}
                onChange={(e) => setUploadTagInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleAddUploadTag)}
                placeholder="Add tags like 'manual', 'reference', 'guide'..."
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-purple-500 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleAddUploadTag}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                disabled={isSubmitting}
              >
                Add
              </button>
            </div>

            {/* Tags Display */}
            {uploadTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {uploadTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveUploadTag(tag)}
                      className="text-purple-600 hover:text-purple-800 dark:hover:text-purple-300"
                      disabled={isSubmitting}
                    >
                      <HiX className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Extract Code Examples Toggle */}
          <div>
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Extract Code Examples
              </span>
              <button
                type="button"
                onClick={() => setExtractCodeExamples(!extractCodeExamples)}
                disabled={isSubmitting}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  extractCodeExamples
                    ? "bg-purple-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    extractCodeExamples ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Automatically extract and index code snippets from the document
            </p>
          </div>

          {/* Privacy Control */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isProjectPrivate}
                onChange={(e) => setIsProjectPrivate(e.target.checked)}
                disabled={isSubmitting}
                className="mr-2 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Keep private to this project
              </span>
            </label>
            <p className="ml-6 mt-1 text-xs text-gray-500 dark:text-gray-400">
              Only accessible within this project, not available globally
            </p>
          </div>

          {/* Send to KB */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={sendToKB}
                onChange={(e) => setSendToKB(e.target.checked)}
                disabled={isSubmitting}
                className="mr-2 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Add to global knowledge base
              </span>
            </label>
            <p className="ml-6 mt-1 text-xs text-gray-500 dark:text-gray-400">
              Make this document searchable in the global knowledge base
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>
      )}

      {/* Crawl Tab */}
      {activeTab === "crawl" && (
        <form onSubmit={handleCrawlSubmit} className="space-y-4">
          {/* URL Input */}
          <div>
            <label
              htmlFor="url"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Website URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <HiGlobeAlt className="h-5 w-5 text-cyan-500" />
              </div>
              <input
                type="url"
                id="url"
                value={crawlUrl}
                onChange={(e) => setCrawlUrl(e.target.value)}
                placeholder="https://docs.example.com"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 focus:border-cyan-500 focus:ring-cyan-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Max Depth Slider */}
          <div>
            <label className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Max Crawl Depth</span>
              <span className="rounded bg-cyan-100 px-2 py-0.5 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                {crawlDepth}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={3}
              value={crawlDepth}
              onChange={(e) => setCrawlDepth(Number(e.target.value))}
              disabled={isSubmitting}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-cyan-500 dark:bg-gray-700"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>1 (shallow)</span>
              <span>3 (deep)</span>
            </div>
          </div>

          {/* Knowledge Type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Knowledge Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="crawl_knowledge_type"
                  value="technical"
                  checked={crawlType === "technical"}
                  onChange={(e) => setCrawlType(e.target.value as "technical" | "business")}
                  disabled={isSubmitting}
                  className="mr-2 h-4 w-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Technical <span className="text-xs text-gray-500">(Code, APIs, dev docs)</span>
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="crawl_knowledge_type"
                  value="business"
                  checked={crawlType === "business"}
                  onChange={(e) => setCrawlType(e.target.value as "technical" | "business")}
                  disabled={isSubmitting}
                  className="mr-2 h-4 w-4 border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Business <span className="text-xs text-gray-500">(Guides, policies, general)</span>
                </span>
              </label>
            </div>
          </div>

          {/* Tags Input */}
          <div>
            <label
              htmlFor="crawl_tags"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="crawl_tags"
                value={crawlTagInput}
                onChange={(e) => setCrawlTagInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleAddCrawlTag)}
                placeholder="Press Enter or comma to add tags"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-cyan-500 focus:ring-cyan-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleAddCrawlTag}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                disabled={isSubmitting}
              >
                Add
              </button>
            </div>

            {/* Tags Display */}
            {crawlTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {crawlTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-sm text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveCrawlTag(tag)}
                      className="text-cyan-600 hover:text-cyan-800 dark:hover:text-cyan-300"
                      disabled={isSubmitting}
                    >
                      <HiX className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Extract Code Examples Toggle */}
          <div>
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Extract Code Examples
              </span>
              <button
                type="button"
                onClick={() => setExtractCodeExamples(!extractCodeExamples)}
                disabled={isSubmitting}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  extractCodeExamples
                    ? "bg-cyan-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    extractCodeExamples ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Automatically extract and index code snippets from crawled pages
            </p>
          </div>

          {/* Privacy Control */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isProjectPrivate}
                onChange={(e) => setIsProjectPrivate(e.target.checked)}
                disabled={isSubmitting}
                className="mr-2 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Keep private to this project
              </span>
            </label>
            <p className="ml-6 mt-1 text-xs text-gray-500 dark:text-gray-400">
              Only accessible within this project, not available globally
            </p>
          </div>

          {/* Send to KB */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={sendToKB}
                onChange={(e) => setSendToKB(e.target.checked)}
                disabled={isSubmitting}
                className="mr-2 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Add to global knowledge base
              </span>
            </label>
            <p className="ml-6 mt-1 text-xs text-gray-500 dark:text-gray-400">
              Make this documentation searchable in the global knowledge base
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !crawlUrl}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Starting..." : "Start Crawling"}
            </button>
          </div>
        </form>
      )}
      </div>
    </div>
  );
}
