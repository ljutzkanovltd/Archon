"use client";

import { useState, useEffect } from "react";
import { HiX, HiRefresh, HiCog } from "react-icons/hi";
import { KnowledgeSource } from "@/lib/types";
import { RecrawlOptions } from "@/lib/apiClient";

interface RecrawlOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: RecrawlOptions) => Promise<void>;
  source: KnowledgeSource | null;
}

interface CrawlDefaults {
  max_depth: number;
  crawl_type: "technical" | "business";
  extract_code_examples: boolean;
}

/**
 * Modal component for configuring recrawl options.
 * Loads default values from crawl settings on open.
 */
export function RecrawlOptionsModal({
  isOpen,
  onClose,
  onConfirm,
  source,
}: RecrawlOptionsModalProps) {
  // Form state
  const [maxDepth, setMaxDepth] = useState(3);
  const [crawlType, setCrawlType] = useState<"technical" | "business">("technical");
  const [extractCodeExamples, setExtractCodeExamples] = useState(true);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load defaults from settings when modal opens
  useEffect(() => {
    if (isOpen && source) {
      setIsLoadingDefaults(true);
      setError(null);

      // Fetch crawl defaults from backend
      fetch("/api/crawl-defaults")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load settings");
          return res.json();
        })
        .then((defaults: CrawlDefaults) => {
          setMaxDepth(defaults.max_depth || 3);
          setCrawlType(defaults.crawl_type || "technical");
          setExtractCodeExamples(defaults.extract_code_examples ?? true);
        })
        .catch((err) => {
          console.error("Failed to load crawl defaults:", err);
          // Use sensible defaults on error
          setMaxDepth(3);
          setCrawlType("technical");
          setExtractCodeExamples(true);
        })
        .finally(() => setIsLoadingDefaults(false));
    }
  }, [isOpen, source]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onConfirm({
        max_depth: maxDepth,
        knowledge_type: crawlType,
        extract_code_examples: extractCodeExamples,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recrawl");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen || !source) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HiRefresh className="h-6 w-6 text-cyan-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Recrawl Options
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-200"
          >
            <HiX className="h-6 w-6" />
          </button>
        </div>

        {/* Source Info */}
        <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {source.title}
          </p>
          {source.url && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
              {source.url}
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading defaults indicator */}
        {isLoadingDefaults ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <HiCog className="h-5 w-5 animate-spin" />
              <span>Loading settings...</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Max Depth Slider */}
            <div className="mb-6">
              <label className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                <span>Max Crawl Depth</span>
                <span className="rounded bg-cyan-100 px-2 py-0.5 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                  {maxDepth}
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value))}
                disabled={isLoading}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-cyan-500 dark:bg-gray-700"
              />
              <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>1 (shallow)</span>
                <span>5 (deep)</span>
              </div>
            </div>

            {/* Knowledge Type Radio */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Knowledge Type
              </label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="crawlType"
                    value="technical"
                    checked={crawlType === "technical"}
                    onChange={() => setCrawlType("technical")}
                    disabled={isLoading}
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Technical
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="crawlType"
                    value="business"
                    checked={crawlType === "business"}
                    onChange={() => setCrawlType("business")}
                    disabled={isLoading}
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Business
                  </span>
                </label>
              </div>
            </div>

            {/* Extract Code Examples Toggle */}
            <div className="mb-6">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Extract Code Examples
                </span>
                <button
                  type="button"
                  onClick={() => setExtractCodeExamples(!extractCodeExamples)}
                  disabled={isLoading}
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

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <HiCog className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <HiRefresh className="h-4 w-4" />
                    Start Recrawl
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
