"use client";

import { useState, useEffect } from "react";
import { HiX, HiGlobeAlt, HiUpload, HiCog } from "react-icons/hi";
import { CrawlRequest, UploadMetadata } from "@/lib/types";

interface CrawlDefaults {
  max_depth: number;
  crawl_type: "technical" | "business";
  extract_code_examples: boolean;
}

interface AddSourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCrawl: (data: CrawlRequest) => Promise<void>;
  onUpload: (file: File, metadata: UploadMetadata) => Promise<void>;
}

export function AddSourceDialog({ isOpen, onClose, onCrawl, onUpload }: AddSourceDialogProps) {
  const [activeTab, setActiveTab] = useState<"crawl" | "upload">("crawl");

  // Crawl form state
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlType, setCrawlType] = useState<"technical" | "business">("technical");
  const [crawlTags, setCrawlTags] = useState<string[]>([]);
  const [crawlTagInput, setCrawlTagInput] = useState("");

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"technical" | "business">("technical");
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadTagInput, setUploadTagInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crawl settings state (loaded from /api/crawl-defaults)
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [extractCodeExamples, setExtractCodeExamples] = useState(true);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);

  // Load crawl defaults when dialog opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingDefaults(true);
      fetch("/api/crawl-defaults")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load settings");
          return res.json();
        })
        .then((defaults: CrawlDefaults) => {
          setCrawlDepth(defaults.max_depth || 3);
          setCrawlType(defaults.crawl_type || "technical");
          setExtractCodeExamples(defaults.extract_code_examples ?? true);
        })
        .catch((err) => {
          console.error("Failed to load crawl defaults:", err);
          // Use sensible defaults on error
          setCrawlDepth(3);
          setExtractCodeExamples(true);
        })
        .finally(() => setIsLoadingDefaults(false));
    }
  }, [isOpen]);

  const resetForm = () => {
    setCrawlUrl("");
    setCrawlType("technical");
    setCrawlTags([]);
    setCrawlTagInput("");
    setSelectedFile(null);
    setUploadType("technical");
    setUploadTags([]);
    setUploadTagInput("");
    setError(null);
    // Reset crawl settings to defaults
    setCrawlDepth(3);
    setExtractCodeExamples(true);
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
      await onCrawl({
        url: crawlUrl,
        knowledge_type: crawlType,
        tags: crawlTags,
        max_depth: crawlDepth,
        extract_code_examples: extractCodeExamples,
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start crawl");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("Please select a file to upload");
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpload(selectedFile, {
        knowledge_type: uploadType,
        tags: uploadTags,
        extract_code_examples: extractCodeExamples,
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setIsSubmitting(false);
    }
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, handler: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handler();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Add Knowledge
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <HiX className="h-6 w-6" />
          </button>
        </div>

        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Crawl websites or upload documents to expand your knowledge base.
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("crawl")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "crawl"
                ? "border-b-2 border-cyan-500 text-cyan-600 dark:text-cyan-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <HiGlobeAlt className="h-5 w-5" />
            Crawl Website
          </button>
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
        </div>

        {/* Crawl Tab */}
        {activeTab === "crawl" && (
          <form onSubmit={handleCrawlSubmit}>
            {/* URL Input */}
            <div className="mb-4">
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

            {/* Knowledge Type */}
            <div className="mb-4">
              <label
                htmlFor="crawl_knowledge_type"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Knowledge Type
              </label>
              <select
                id="crawl_knowledge_type"
                value={crawlType}
                onChange={(e) => setCrawlType(e.target.value as "technical" | "business")}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-cyan-500 focus:ring-cyan-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                disabled={isSubmitting}
              >
                <option value="technical">Technical</option>
                <option value="business">Business</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Code, APIs, dev docs
              </p>
            </div>

            {/* Tags Input */}
            <div className="mb-4">
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

            {/* Crawl Settings - loaded from /api/crawl-defaults */}
            {isLoadingDefaults ? (
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <HiCog className="h-4 w-4 animate-spin" />
                Loading crawl settings...
              </div>
            ) : (
              <>
                {/* Max Depth Slider */}
                <div className="mb-4">
                  <label className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>Max Crawl Depth</span>
                    <span className="rounded bg-cyan-100 px-2 py-0.5 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                      {crawlDepth}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={crawlDepth}
                    onChange={(e) => setCrawlDepth(Number(e.target.value))}
                    disabled={isSubmitting}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-cyan-500 dark:bg-gray-700"
                  />
                  <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>1 (shallow)</span>
                    <span>5 (deep)</span>
                  </div>
                </div>

                {/* Extract Code Examples Toggle */}
                <div className="mb-4">
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
              </>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
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

        {/* Upload Tab */}
        {activeTab === "upload" && (
          <form onSubmit={handleUploadSubmit}>
            {/* File Input */}
            <div className="mb-4">
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
                          PDF, DOC, DOCX, TXT, MD files supported
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Knowledge Type */}
            <div className="mb-4">
              <label
                htmlFor="upload_knowledge_type"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Knowledge Type
              </label>
              <select
                id="upload_knowledge_type"
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as "technical" | "business")}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-purple-500 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                disabled={isSubmitting}
              >
                <option value="technical">Technical</option>
                <option value="business">Business</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Guides, policies, general
              </p>
            </div>

            {/* Tags Input */}
            <div className="mb-4">
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
            <div className="mb-4">
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

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
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
      </div>
    </div>
  );
}
