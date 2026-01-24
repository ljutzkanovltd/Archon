"use client";

import { useEffect, useState } from "react";
import { HiCheckCircle, HiXCircle, HiStop, HiRefresh } from "react-icons/hi";
import { AnimatePresence, motion } from "framer-motion";
import { Progress, ProgressStatus } from "@/lib/types";
import { progressApi } from "@/lib/apiClient";

/**
 * Upload Progress Monitoring Component
 *
 * Displays real-time progress for document upload and crawl operations
 * with polling, status updates, and cancellation support.
 *
 * Features:
 * - Real-time progress polling (1s interval)
 * - Visual progress bar (0-100%)
 * - Current stage labels
 * - Status-based UI states (initializing/processing/completed/error/cancelled)
 * - Cancel operation support
 * - Auto-cleanup on unmount
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <UploadProgress
 *   progressId="progress-uuid"
 *   operationType="upload"
 *   onComplete={() => console.log("Operation completed")}
 *   onError={(err) => console.error(err)}
 *   onCancel={() => console.log("Operation cancelled")}
 * />
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UploadProgressProps {
  /** Progress ID to track */
  progressId: string;
  /** Type of operation being tracked */
  operationType: "upload" | "crawl";
  /** Callback fired when operation completes successfully */
  onComplete?: () => void;
  /** Callback fired when operation encounters an error */
  onError?: (error: string) => void;
  /** Callback fired when operation is cancelled */
  onCancel?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UploadProgress({
  progressId,
  operationType,
  onComplete,
  onError,
  onCancel,
}: UploadProgressProps) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [isStopping, setIsStopping] = useState(false);

  // Never-go-backwards logic: track previous progress values
  const [prevProgress, setPrevProgress] = useState<number>(0);

  // ============================================================================
  // POLLING EFFECT
  // ============================================================================

  useEffect(() => {
    if (!isPolling) return;

    const pollProgress = async () => {
      try {
        const response = await progressApi.getById(progressId);
        const data = response.operation;

        setProgress(data);

        // Check for terminal states
        if (data.status === "completed") {
          setIsPolling(false);
          onComplete?.();
        } else if (data.status === "error" || data.status === "failed") {
          setIsPolling(false);
          onError?.(data.error_message || "Operation failed");
        } else if (data.status === "cancelled") {
          setIsPolling(false);
          onCancel?.();
        }
      } catch (error) {
        console.error("Progress polling error:", error);
        // Continue polling on network errors
      }
    };

    // Initial poll
    pollProgress();

    // Poll every 1 second
    const interval = setInterval(pollProgress, 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
    };
  }, [progressId, isPolling, onComplete, onError, onCancel]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCancel = async () => {
    if (!confirm(`Cancel this ${operationType} operation?`)) {
      return;
    }

    setIsStopping(true);
    try {
      await progressApi.stop(progressId);
      setIsPolling(false);
      onCancel?.();
    } catch (error) {
      console.error("Cancel error:", error);
      alert(`Failed to cancel ${operationType}. Please try again.`);
    } finally {
      setIsStopping(false);
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Ensure progress only increases
  const displayProgress = Math.max(progress?.progress_percentage ?? 0, prevProgress);

  // Update previous values when progress increases
  if (displayProgress > prevProgress) {
    setPrevProgress(displayProgress);
  }

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
        return operationType === "upload"
          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
          : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
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

  // Get progress bar color based on operation type
  const getProgressBarColor = () => {
    if (progress?.status === "completed") {
      return "bg-green-500";
    }
    if (progress?.status === "error" || progress?.status === "failed") {
      return "bg-red-500";
    }
    return operationType === "upload" ? "bg-purple-500" : "bg-cyan-500";
  };

  // Get operation title
  const getTitle = () => {
    if (progress?.filename) {
      return `Processing ${progress.filename}`;
    }
    if (progress?.url) {
      return `Crawling ${progress.url}`;
    }
    return operationType === "upload" ? "Processing document" : "Crawling URL";
  };

  // Get current stage label
  const getCurrentStage = () => {
    if (!progress) return "Initializing...";

    if (progress.current_step) {
      return progress.current_step;
    }

    if (progress.message) {
      return progress.message;
    }

    switch (progress.status) {
      case "pending":
        return "Starting operation...";
      case "crawling":
        return "Crawling pages...";
      case "processing":
        return "Processing content...";
      case "storing":
      case "document_storage":
        return "Storing data...";
      case "completed":
        return "Operation completed successfully";
      case "error":
      case "failed":
        return "Operation failed";
      case "cancelled":
        return "Operation cancelled";
      default:
        return "Processing...";
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!progress) {
    // Loading state
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center gap-3">
          <HiRefresh className="h-5 w-5 animate-spin text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Loading progress...
          </span>
        </div>
      </motion.div>
    );
  }

  // Determine if operation is terminal
  const isTerminal = ["completed", "error", "failed", "cancelled"].includes(progress.status);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <h4 className="mb-2 text-base font-medium text-gray-900 dark:text-white">
              {getTitle()}
            </h4>
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(progress.status)}`}
              >
                {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {operationType === "upload" ? "Document Upload" : "Web Crawl"}
              </span>
            </div>
          </div>

          {/* Cancel Button (only show if not terminal) */}
          {!isTerminal && (
            <button
              onClick={handleCancel}
              disabled={isStopping}
              className="ml-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              title="Cancel operation"
            >
              <HiStop className="h-4 w-4" />
              <span>{isStopping ? "Cancelling..." : "Cancel"}</span>
            </button>
          )}

          {/* Terminal State Icons */}
          {progress.status === "completed" && (
            <HiCheckCircle className="ml-4 h-8 w-8 text-green-500" />
          )}
          {(progress.status === "error" || progress.status === "failed") && (
            <HiXCircle className="ml-4 h-8 w-8 text-red-500" />
          )}
          {progress.status === "cancelled" && (
            <HiXCircle className="ml-4 h-8 w-8 text-yellow-500" />
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {getCurrentStage()}
            </span>
            <span
              className={`font-medium ${
                operationType === "upload"
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-cyan-600 dark:text-cyan-400"
              }`}
            >
              {displayProgress}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <motion.div
              className={`h-full rounded-full ${getProgressBarColor()} transition-all duration-300`}
              initial={{ width: 0 }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Stats (for crawl operations) */}
        {operationType === "crawl" && progress.pages_crawled !== undefined && (
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {progress.pages_crawled}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Pages Crawled
              </div>
            </div>
            {progress.total_pages && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {progress.total_pages}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Total Pages
                </div>
              </div>
            )}
            {progress.code_examples_found !== undefined &&
              progress.code_examples_found > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {progress.code_examples_found}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Code Examples
                  </div>
                </div>
              )}
          </div>
        )}

        {/* URL (for crawl operations) */}
        {progress.url && (
          <div className="mb-3 truncate text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">URL: </span>
            <a
              href={progress.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-600 dark:hover:text-cyan-400"
            >
              {progress.url}
            </a>
          </div>
        )}

        {/* Error Message */}
        {progress.error_message && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <span className="font-medium">Error: </span>
            {progress.error_message}
          </div>
        )}

        {/* Success Message */}
        {progress.status === "completed" && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <span className="font-medium">Success: </span>
            {operationType === "upload"
              ? "Document uploaded and processed successfully"
              : "Website crawled and indexed successfully"}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
