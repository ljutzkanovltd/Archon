"use client";

import { useMemo, useState } from "react";
import {
  HiExclamationCircle,
  HiRefresh,
  HiX,
  HiCheckCircle,
  HiChevronDown,
  HiChevronUp,
  HiClock,
  HiExclamation,
} from "react-icons/hi";

export interface FailedQueueItem {
  item_id: string;
  source_id: string;
  source_url: string;
  source_display_name: string;
  status: string;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  error_type: string | null;
  error_details: Record<string, any> | null;
  requires_human_review: boolean;
  created_at: string;
  started_at: string | null;
  last_retry_at: string | null;
  next_retry_at: string | null;
  suggested_actions: string[];
}

interface FailureReviewDashboardProps {
  items: FailedQueueItem[];
  onRetry?: (item_id: string) => Promise<void>;
  onSkip?: (item_id: string) => Promise<void>;
  onResolve?: (item_id: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function FailureReviewDashboard({
  items,
  onRetry,
  onSkip,
  onResolve,
  isLoading = false,
  className = "",
}: FailureReviewDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const byErrorType = new Map<string, number>();
    items.forEach((item) => {
      const type = item.error_type || "unknown";
      byErrorType.set(type, (byErrorType.get(type) || 0) + 1);
    });

    return {
      total: items.length,
      byErrorType,
    };
  }, [items]);

  const handleAction = async (
    item_id: string,
    action: "retry" | "skip" | "resolve"
  ) => {
    setProcessingId(item_id);
    try {
      if (action === "retry" && onRetry) {
        await onRetry(item_id);
      } else if (action === "skip" && onSkip) {
        await onSkip(item_id);
      } else if (action === "resolve" && onResolve) {
        await onResolve(item_id);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  const getErrorTypeColor = (errorType: string | null) => {
    switch (errorType) {
      case "network":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "rate_limit":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "timeout":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
      case "parse_error":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const getErrorTypeIcon = (errorType: string | null) => {
    switch (errorType) {
      case "network":
        return <HiExclamationCircle className="w-5 h-5" />;
      case "rate_limit":
        return <HiClock className="w-5 h-5" />;
      case "timeout":
        return <HiClock className="w-5 h-5" />;
      case "parse_error":
        return <HiExclamation className="w-5 h-5" />;
      default:
        return <HiExclamationCircle className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}
      >
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading failed items...
          </span>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}
      >
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <HiCheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Items Need Review
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            All failed items have been processed or there are no failures.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
    >
      {/* Header with stats */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Failed Items Requiring Review
        </h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">Total:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {stats.total}
            </span>
          </div>
          {Array.from(stats.byErrorType.entries()).map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${getErrorTypeColor(
                  type
                )}`}
              >
                {getErrorTypeIcon(type)}
                {type}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Items list */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {items.map((item) => {
          const isExpanded = expandedId === item.item_id;
          const isProcessing = processingId === item.item_id;

          return (
            <div key={item.item_id} className="p-6">
              {/* Item header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                      {item.source_display_name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${getErrorTypeColor(
                        item.error_type
                      )}`}
                    >
                      {getErrorTypeIcon(item.error_type)}
                      {item.error_type || "unknown"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 truncate">
                    {item.source_url}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>Retries: {item.retry_count}/{item.max_retries}</span>
                    <span>Created: {formatTimestamp(item.created_at)}</span>
                    {item.last_retry_at && (
                      <span>Last Retry: {formatTimestamp(item.last_retry_at)}</span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction(item.item_id, "retry")}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors"
                    title="Reset and retry this item"
                  >
                    <HiRefresh className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} />
                    Retry
                  </button>
                  <button
                    onClick={() => handleAction(item.item_id, "skip")}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-400 rounded-md transition-colors"
                    title="Mark as permanently failed"
                  >
                    <HiX className="w-4 h-4" />
                    Skip
                  </button>
                  <button
                    onClick={() => handleAction(item.item_id, "resolve")}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-md transition-colors"
                    title="Mark as resolved without retrying"
                  >
                    <HiCheckCircle className="w-4 h-4" />
                    Resolve
                  </button>
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : item.item_id)
                    }
                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                    title={isExpanded ? "Hide details" : "Show details"}
                  >
                    {isExpanded ? (
                      <HiChevronUp className="w-5 h-5" />
                    ) : (
                      <HiChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  {/* Error message */}
                  {item.error_message && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Error Message
                      </h4>
                      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-3">
                        <p className="text-sm text-red-800 dark:text-red-400 font-mono">
                          {item.error_message}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Suggested actions */}
                  {item.suggested_actions &&
                    item.suggested_actions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Suggested Actions
                        </h4>
                        <ul className="space-y-1.5">
                          {item.suggested_actions.map((action, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                            >
                              <span className="text-blue-600 dark:text-blue-400 mt-0.5">
                                •
                              </span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Error details */}
                  {item.error_details && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Technical Details
                      </h4>
                      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md p-3">
                        <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono overflow-x-auto">
                          {JSON.stringify(item.error_details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Source metadata */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Source Information
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Source ID:
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-white font-mono text-xs">
                          {item.source_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Status:
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {item.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Item ID:
                        </span>
                        <span className="ml-2 text-gray-900 dark:text-white font-mono text-xs">
                          {item.item_id}
                        </span>
                      </div>
                      {item.next_retry_at && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Next Retry:
                          </span>
                          <span className="ml-2 text-gray-900 dark:text-white">
                            {formatTimestamp(item.next_retry_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
