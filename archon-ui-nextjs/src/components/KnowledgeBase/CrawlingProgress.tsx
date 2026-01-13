"use client";

import { useState } from "react";
import { HiX, HiStop, HiRefresh, HiPause, HiPlay } from "react-icons/hi";
import { AnimatePresence, motion } from "framer-motion";
import { Progress, ProgressStatus } from "@/lib/types";
import { progressApi } from "@/lib/apiClient";
import { useProgressList } from "@/hooks/useProgressQueries";

interface CrawlingProgressProps {
  className?: string;
}

export function CrawlingProgress({ className = "" }: CrawlingProgressProps) {
  const [liveUpdates, setLiveUpdates] = useState(true);
  const { data, isLoading, isError, refetch } = useProgressList({
    enabled: liveUpdates,
    pollingInterval: 1000,
  });

  const operations = data?.operations || [];
  const activeOperations = operations.filter((op: Progress) =>
    !["completed", "error", "failed", "cancelled"].includes(op.status)
  );
  const hasPausedOperations = operations.some((op: Progress) => op.status === "paused");

  const handleStop = async (progressId: string) => {
    try {
      await progressApi.stop(progressId);
      // Refetch to update UI
      refetch();
    } catch (error) {
      console.error("Failed to stop operation:", error);
      alert("Failed to stop operation. Please try again.");
    }
  };

  const handlePause = async (progressId: string) => {
    try {
      await progressApi.pause(progressId);
      // Refetch to update UI
      refetch();
    } catch (error) {
      console.error("Failed to pause operation:", error);
      alert("Failed to pause operation. Please try again.");
    }
  };

  const handleResume = async (progressId: string) => {
    try {
      await progressApi.resume(progressId);
      // Refetch to update UI
      refetch();
    } catch (error) {
      console.error("Failed to resume operation:", error);
      alert("Failed to resume operation. Please try again.");
    }
  };

  if (isLoading && operations.length === 0) {
    return null;
  }

  if (activeOperations.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Active Operations ({activeOperations.length})
          </h3>
          {/* Spinning loader icon when operations are active */}
          {activeOperations.length > 0 && (
            <HiRefresh className="h-5 w-5 animate-spin text-cyan-500 dark:text-cyan-400" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh"
          >
            <HiRefresh className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="relative inline-block h-5 w-9">
              <input
                type="checkbox"
                checked={liveUpdates}
                onChange={(e) => setLiveUpdates(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-cyan-500 peer-checked:after:translate-x-4 dark:bg-gray-600"></div>
            </div>
            <span className={liveUpdates ? "text-cyan-600 dark:text-cyan-400" : ""}>
              Live Updates
            </span>
          </label>
        </div>
      </div>

      {/* Operations List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        <AnimatePresence>
          {activeOperations.map((operation: Progress) => (
            <motion.div
              key={operation.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
            >
              <OperationCard
                operation={operation}
                onStop={handleStop}
                onPause={handlePause}
                onResume={handleResume}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Error State */}
      {isError && (
        <div className="p-4 text-center text-sm text-red-600 dark:text-red-400">
          Failed to load operations. Click refresh to try again.
        </div>
      )}
    </div>
  );
}

interface OperationCardProps {
  operation: Progress;
  onStop: (progressId: string) => void;
  onPause: (progressId: string) => void;
  onResume: (progressId: string) => void;
}

function OperationCard({ operation, onStop, onPause, onResume }: OperationCardProps) {
  const [isStopping, setIsStopping] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  // Never-go-backwards logic: track previous progress values
  const [prevProgress, setPrevProgress] = useState<number>(0);
  const [prevPagesCrawled, setPrevPagesCrawled] = useState<number>(0);
  const [prevCodeExamples, setPrevCodeExamples] = useState<number>(0);

  // Ensure progress only increases
  const displayProgress = Math.max(operation.progress_percentage ?? 0, prevProgress);
  const displayPagesCrawled = Math.max(operation.pages_crawled ?? 0, prevPagesCrawled);
  const displayCodeExamples = Math.max(operation.code_examples_found ?? 0, prevCodeExamples);

  // Update previous values when progress increases
  if (displayProgress > prevProgress) {
    setPrevProgress(displayProgress);
  }
  if (displayPagesCrawled > prevPagesCrawled) {
    setPrevPagesCrawled(displayPagesCrawled);
  }
  if (displayCodeExamples > prevCodeExamples) {
    setPrevCodeExamples(displayCodeExamples);
  }

  const handleStop = async () => {
    if (!confirm("Are you sure you want to stop this operation?")) {
      return;
    }

    setIsStopping(true);
    try {
      await onStop(operation.id);
    } finally {
      setIsStopping(false);
    }
  };

  const handlePause = async () => {
    setIsPausing(true);
    try {
      await onPause(operation.id);
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await onResume(operation.id);
    } finally {
      setIsResuming(false);
    }
  };

  // Get status badge color
  const getStatusColor = (status: ProgressStatus) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
      case "crawling":
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
      case "processing":
      case "storing":
      case "document_storage":
        return "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400";
      case "paused":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "error":
      case "failed":
      case "cancelled":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Get operation type label
  const getOperationTypeLabel = () => {
    switch (operation.operation_type) {
      case "crawl":
        return "Web Crawl";
      case "upload":
        return "Document Upload";
      case "processing":
        return "Processing";
      default:
        return operation.operation_type;
    }
  };

  // Format title
  const getTitle = () => {
    if (operation.operation_type === "crawl" && displayPagesCrawled !== undefined) {
      // Calculate range: show batches of 50, or smaller ranges for low counts
      const pagesCrawled = displayPagesCrawled || 0;
      const rangeStart = pagesCrawled > 0 ? Math.max(1, Math.floor((pagesCrawled - 1) / 50) * 50 + 1) : 1;
      const rangeEnd = pagesCrawled > 0 ? Math.min(rangeStart + 49, pagesCrawled) : 0;
      const currentRange = pagesCrawled > 0 ? `${rangeStart}-${rangeEnd}` : "0-0";

      const total = operation.total_pages ?? "?";
      const depth = operation.current_depth ?? operation.max_depth ?? "?";
      return `Crawling URLs ${currentRange} of ${total} at depth ${depth}`;
    } else if (operation.operation_type === "upload") {
      return `Processing ${operation.filename || "document"}`;
    }
    return operation.message || "Processing...";
  };

  return (
    <div className="p-4">
      {/* Header with title and stop button */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h4 className="mb-2 text-base font-medium text-gray-900 dark:text-white">
            {getTitle()}
          </h4>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(operation.status)}`}
            >
              {operation.status.charAt(0).toUpperCase() + operation.status.slice(1)}
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {getOperationTypeLabel()}
            </span>
          </div>
        </div>
        <div className="ml-4 flex items-center gap-2">
          {operation.status === "paused" ? (
            <button
              onClick={handleResume}
              disabled={isResuming}
              className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
              title="Resume operation"
            >
              <HiPlay className="h-4 w-4" />
              {isResuming ? "Resuming..." : "Resume"}
            </button>
          ) : (
            <>
              <button
                onClick={handlePause}
                disabled={isPausing}
                className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-700 hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
                title="Pause operation"
              >
                <HiPause className="h-4 w-4" />
                {isPausing ? "Pausing..." : "Pause"}
              </button>
              <button
                onClick={handleStop}
                disabled={isStopping}
                className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                title="Stop operation"
              >
                <HiStop className="h-4 w-4" />
                {isStopping ? "Stopping..." : "Stop"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Progress</span>
          <span className="font-medium text-cyan-600 dark:text-cyan-400">
            {displayProgress}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {displayPagesCrawled !== undefined && (
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {displayPagesCrawled}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Pages Crawled</div>
          </div>
        )}
        {displayCodeExamples !== undefined && displayCodeExamples > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {displayCodeExamples}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Code Examples</div>
          </div>
        )}
        {operation.current_step && (
          <div className="text-center col-span-2">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {operation.current_step}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Current Step</div>
          </div>
        )}
      </div>

      {/* URL */}
      {operation.url && (
        <div className="mt-3 truncate text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">URL: </span>
          <a
            href={operation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-600 dark:hover:text-cyan-400"
          >
            {operation.url}
          </a>
        </div>
      )}

      {/* Error Message */}
      {operation.error_message && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <span className="font-medium">Error: </span>
          {operation.error_message}
        </div>
      )}
    </div>
  );
}
