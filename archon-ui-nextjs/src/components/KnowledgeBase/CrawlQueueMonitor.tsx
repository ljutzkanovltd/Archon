"use client";

import { useState, useEffect } from "react";
import { HiRefresh, HiClock, HiCheckCircle, HiXCircle, HiPlay, HiPause, HiStop } from "react-icons/hi";
import { KnowledgeSource } from "@/lib/types";

interface QueueItem {
  item_id: string;
  batch_id: string;
  source_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  priority: number;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  error_type: string | null;
  error_details: {
    validation_result?: {
      pages_count: number;
      chunks_count: number;
      code_examples_count: number;
      error?: string;
    };
  } | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface QueueStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

interface CrawlQueueMonitorProps {
  sources: KnowledgeSource[];
  className?: string;
}

export function CrawlQueueMonitor({ sources, className = "" }: CrawlQueueMonitorProps) {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [workerStatus, setWorkerStatus] = useState<"idle" | "running" | "paused">("running");

  // Create source lookup map
  const sourceMap = new Map(sources.map(s => [s.source_id, s]));

  const loadQueue = async () => {
    try {
      const [statsRes, itemsRes] = await Promise.all([
        fetch("http://localhost:8181/api/crawl-queue/status"),
        fetch("http://localhost:8181/api/crawl-queue/items?limit=50")
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        setItems(itemsData.items || []);
      }
    } catch (error) {
      console.error("Failed to load queue:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load worker status from health endpoint
  const loadWorkerStatus = async () => {
    try {
      const response = await fetch("http://localhost:8181/api/crawl-queue/worker/health");

      if (response.ok) {
        const data = await response.json();
        // Update worker status based on health check response
        if (data.status === "running" || data.is_running) {
          setWorkerStatus("running");
        } else if (data.status === "paused") {
          setWorkerStatus("paused");
        } else {
          setWorkerStatus("idle");
        }
      }
    } catch (error) {
      console.error("Failed to load worker status:", error);
    }
  };

  // Pause the queue worker
  const handlePauseWorker = async () => {
    try {
      const response = await fetch("http://localhost:8181/api/crawl-queue/worker/pause", {
        method: "POST"
      });

      const data = await response.json();

      if (data.success) {
        setWorkerStatus("paused");
        alert("✅ Queue worker paused. No new items will be processed.");
      } else {
        throw new Error(data.error || "Failed to pause worker");
      }
    } catch (error) {
      console.error("Failed to pause worker:", error);
      alert("❌ Failed to pause worker. Please try again.");
    }
  };

  // Resume the queue worker
  const handleResumeWorker = async () => {
    try {
      const response = await fetch("http://localhost:8181/api/crawl-queue/worker/resume", {
        method: "POST"
      });

      const data = await response.json();

      if (data.success) {
        setWorkerStatus("running");
        alert("✅ Queue worker resumed. Processing will continue.");
      } else {
        throw new Error(data.error || "Failed to resume worker");
      }
    } catch (error) {
      console.error("Failed to resume worker:", error);
      alert("❌ Failed to resume worker. Please try again.");
    }
  };

  // Stop the queue worker and all running items
  const handleStopWorker = async () => {
    if (!confirm("⚠️ Stop queue worker?\n\nThis will:\n- Pause the worker\n- Cancel all running crawls\n- Mark running items as cancelled\n\nAre you sure?")) {
      return;
    }

    try {
      const response = await fetch("http://localhost:8181/api/crawl-queue/worker/stop", {
        method: "POST"
      });

      const data = await response.json();

      if (data.success) {
        setWorkerStatus("paused");
        alert(`✅ Queue worker stopped. ${data.items_cancelled || 0} running items cancelled.`);
        await loadQueue(); // Refresh queue
      } else {
        throw new Error(data.error || "Failed to stop worker");
      }
    } catch (error) {
      console.error("Failed to stop worker:", error);
      alert("❌ Failed to stop worker. Please try again.");
    }
  };

  // Clear completed and failed items from the queue
  const handleClearCompleted = async () => {
    const completedCount = (stats?.completed || 0) + (stats?.failed || 0);

    if (completedCount === 0) {
      alert("ℹ️ No completed or failed items to clear.");
      return;
    }

    if (!confirm(`🗑️ Clear ${completedCount} completed/failed items from queue?\n\nThis cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch("http://localhost:8181/api/crawl-queue/clear-completed", {
        method: "POST"
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Cleared ${data.removed_count || completedCount} items from queue.`);
        await loadQueue(); // Refresh queue
      } else {
        throw new Error(data.error || "Failed to clear completed items");
      }
    } catch (error) {
      console.error("Failed to clear completed items:", error);
      alert("❌ Failed to clear items. Please try again.");
    }
  };

  // Stop a running queue item
  const handleStopItem = async (itemId: string) => {
    if (!confirm("⚠️ Stop this crawl?\n\nProgress will be lost and the item will be marked as cancelled.")) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8181/api/crawl-queue/${itemId}/stop`, {
        method: "POST"
      });

      const data = await response.json();

      if (data.success) {
        alert("✅ Crawl stopped successfully. The item has been cancelled.");
        await loadQueue(); // Refresh queue
      } else {
        throw new Error(data.error || "Failed to stop item");
      }
    } catch (error) {
      console.error("Failed to stop item:", error);
      alert("❌ Failed to stop crawl. Please try again.");
    }
  };

  // Retry a failed queue item
  const handleRetry = async (itemId: string) => {
    try {
      const response = await fetch(`http://localhost:8181/api/crawl-queue/retry/${itemId}`, {
        method: "POST"
      });

      const data = await response.json();

      if (data.success) {
        alert("✅ Item reset to pending and will be retried shortly.");
        await loadQueue(); // Refresh queue
      } else {
        throw new Error(data.error || "Failed to retry");
      }
    } catch (error) {
      console.error("Failed to retry:", error);
      alert("❌ Failed to retry item. Please try again.");
    }
  };

  // Cancel a queue item
  const handleCancel = async (itemId: string) => {
    if (!confirm("Are you sure you want to cancel this crawl?")) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8181/api/crawl-queue/${itemId}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (data.success) {
        alert("✅ Item cancelled successfully.");
        await loadQueue(); // Refresh queue
      } else {
        throw new Error(data.error || "Failed to cancel");
      }
    } catch (error) {
      console.error("Failed to cancel:", error);
      alert("❌ Failed to cancel item. Please try again.");
    }
  };

  // Get user-friendly error message based on error type
  const getErrorMessage = (item: QueueItem): { friendly: string; technical: string } => {
    if (!item.error_message) {
      return { friendly: "", technical: "" };
    }

    const errorType = item.error_type || "unknown";

    // User-friendly error messages with actionable guidance
    const errorMessages: Record<string, string> = {
      "validation_failed": "⚠️ Crawl completed but no data was created. The site may require authentication, have anti-scraping protection, or the content format may be incompatible with our parser.",
      "network": "🌐 Network error occurred. The site may be temporarily unavailable or experiencing connectivity issues. This will be retried automatically.",
      "rate_limit": "⏱️ Rate limit exceeded. The site is throttling our requests. Retrying with exponential backoff to respect rate limits.",
      "parse_error": "📄 Unable to parse page content. The page structure may be incompatible with our parser, or the content may be dynamically loaded via JavaScript.",
      "timeout": "⏰ Crawl timed out. The site may be slow, unresponsive, or the content is very large. This will be retried automatically.",
      "other": "❌ An unexpected error occurred during crawling."
    };

    const friendlyMessage = errorMessages[errorType] || errorMessages["other"];

    return {
      friendly: friendlyMessage,
      technical: item.error_message
    };
  };

  useEffect(() => {
    loadQueue();
    loadWorkerStatus();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadQueue, 1000); // Refresh every 1 second for real-time updates
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Organize items into 3 sections
  const runningItems = items
    .filter(item => item.status === "running")
    .slice(0, 5); // Max 5 actively crawling

  const pendingItems = items
    .filter(item => item.status === "pending")
    .sort((a, b) => b.priority - a.priority); // Sort by priority desc

  const completedItems = items
    .filter(item => item.status === "completed")
    .sort((a, b) => {
      // Sort by completion time desc (most recent first)
      if (!a.completed_at) return 1;
      if (!b.completed_at) return -1;
      return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
    });

  const failedItems = items
    .filter(item => item.status === "failed")
    .sort((a, b) => {
      // Sort by completion time desc (most recent first)
      if (!a.completed_at) return 1;
      if (!b.completed_at) return -1;
      return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
    });

  // Don't show if no queue items
  if (!stats || stats.total === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <HiClock className="h-5 w-5 text-gray-500" />;
      case "running":
        return <HiPlay className="h-5 w-5 text-brand-500 animate-pulse" />;
      case "completed":
        return <HiCheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <HiXCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
      case "running":
        return "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400";
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "failed":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  };

  // Calculate progress percentage for running items
  const calculateProgress = (item: QueueItem): number => {
    if (!item.started_at) return 0;
    if (item.completed_at) return 100;

    // Estimate based on time elapsed (rough heuristic: assume 1 minute average)
    const elapsed = Date.now() - new Date(item.started_at).getTime();
    const estimatedTotal = 60000; // 1 minute in milliseconds
    const progress = Math.min(Math.round((elapsed / estimatedTotal) * 100), 95);
    return progress;
  };

  // Calculate ETA for running items
  const calculateETA = (item: QueueItem): string => {
    if (!item.started_at) return "Unknown";
    if (item.completed_at) return "Done";

    const progress = calculateProgress(item);
    if (progress === 0) return "Starting...";
    if (progress >= 95) return "< 1m";

    const elapsed = Date.now() - new Date(item.started_at).getTime();
    const remaining = (elapsed / progress) * (100 - progress);
    const seconds = Math.round(remaining / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  };

  return (
    <div className={`rounded-lg border-2 border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-200 p-4 dark:border-brand-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-900 dark:text-white"
          >
            <svg
              className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Crawl Queue
          </h3>
          {stats.running > 0 && (
            <HiRefresh className="h-5 w-5 animate-spin text-brand-500" />
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Stats badges */}
          <div className="flex gap-2">
            <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {stats.pending} Pending
            </span>
            {stats.running > 0 && (
              <span className="rounded-full bg-brand-200 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                {stats.running} Running
              </span>
            )}
            {stats.completed > 0 && (
              <span className="rounded-full bg-green-200 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                {stats.completed} Done
              </span>
            )}
            {stats.failed > 0 && (
              <span className="rounded-full bg-red-200 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                {stats.failed} Failed
              </span>
            )}
          </div>

          {/* Worker status indicator */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
              workerStatus === "running"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : workerStatus === "paused"
                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                workerStatus === "running"
                  ? "bg-green-500 animate-pulse"
                  : workerStatus === "paused"
                  ? "bg-orange-500"
                  : "bg-gray-500"
              }`} />
              Worker: {workerStatus === "running" ? "Active" : workerStatus === "paused" ? "Paused" : "Idle"}
            </span>
          </div>

          {/* Worker Control Buttons */}
          <div className="flex items-center gap-2 border-l border-gray-300 pl-4 dark:border-gray-600">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">CONTROLS:</span>
            {workerStatus === "running" ? (
              <button
                onClick={handlePauseWorker}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
                title="Pause Worker - No new items will be processed"
              >
                <span className="flex items-center gap-1.5">
                  <HiPause className="h-4 w-4" />
                  Pause
                </span>
              </button>
            ) : (
              <button
                onClick={handleResumeWorker}
                className="rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
                title="Resume Worker - Processing will continue"
              >
                <span className="flex items-center gap-1.5">
                  <HiPlay className="h-4 w-4" />
                  Resume
                </span>
              </button>
            )}

            <button
              onClick={handleStopWorker}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
              title="Stop Worker - Pause worker and cancel all running items"
            >
              <span className="flex items-center gap-1.5">
                <HiStop className="h-4 w-4" />
                Stop
              </span>
            </button>

            <button
              onClick={handleClearCompleted}
              disabled={(stats?.completed || 0) + (stats?.failed || 0) === 0}
              className="rounded-lg bg-gray-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-600 dark:hover:bg-gray-700"
              title="Clear Completed - Remove completed and failed items from queue"
            >
              <span className="flex items-center gap-1.5">
                <HiXCircle className="h-4 w-4" />
                Clear
              </span>
            </button>
          </div>

          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-3 border-l border-gray-300 pl-4 dark:border-gray-600">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="relative inline-block h-5 w-9">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-500 peer-checked:after:translate-x-4 dark:bg-gray-600"></div>
              </div>
              <span className={`text-xs font-medium ${autoRefresh ? "text-brand-600 dark:text-brand-400" : ""}`}>
                Auto-refresh: {autoRefresh ? "ON" : "OFF"}
              </span>
            </label>

            {/* Manual refresh button - only show when auto-refresh is disabled */}
            {!autoRefresh && (
              <button
                onClick={loadQueue}
                className="rounded-lg p-2 hover:bg-brand-100 dark:hover:bg-brand-900/40"
                title="Refresh Queue"
              >
                <HiRefresh className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-600 dark:text-gray-400">
              Loading queue...
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {/* Section 1: Actively Crawling (TOP - Max 5) */}
              {runningItems.length > 0 && (
                <div className="rounded-lg bg-brand-50 p-4 dark:bg-brand-900/10">
                  <div className="mb-3 flex items-center gap-2">
                    <HiPlay className="h-5 w-5 animate-pulse text-brand-500" />
                    <h4 className="text-sm font-semibold text-brand-900 dark:text-brand-100">
                      🔄 Actively Crawling ({runningItems.length}/{stats.running})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {runningItems.map((item) => (
                      <QueueItemCard
                        key={item.item_id}
                        item={item}
                        source={sourceMap.get(item.source_id)}
                        getStatusIcon={getStatusIcon}
                        getStatusColor={getStatusColor}
                        formatDate={formatDate}
                        calculateProgress={calculateProgress}
                        calculateETA={calculateETA}
                        getErrorMessage={getErrorMessage}
                        onRetry={handleRetry}
                        onCancel={handleCancel}
                        onStop={handleStopItem}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Pending (MIDDLE) */}
              {pendingItems.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2 px-2">
                    <HiClock className="h-5 w-5 text-gray-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      ⏳ Pending Queue ({pendingItems.length}/{stats.pending})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {pendingItems.slice(0, 10).map((item) => (
                      <QueueItemCard
                        key={item.item_id}
                        item={item}
                        source={sourceMap.get(item.source_id)}
                        getStatusIcon={getStatusIcon}
                        getStatusColor={getStatusColor}
                        formatDate={formatDate}
                        calculateProgress={calculateProgress}
                        calculateETA={calculateETA}
                        getErrorMessage={getErrorMessage}
                        onRetry={handleRetry}
                        onCancel={handleCancel}
                        onStop={handleStopItem}
                      />
                    ))}
                    {pendingItems.length > 10 && (
                      <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                        + {pendingItems.length - 10} more...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 3: Failed Items (ATTENTION REQUIRED) */}
              {failedItems.length > 0 && (
                <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
                  <div className="mb-3 flex items-center gap-2">
                    <HiXCircle className="h-5 w-5 text-red-500" />
                    <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">
                      ❌ Failed Items - Attention Required ({failedItems.length}/{stats.failed})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {failedItems.map((item) => (
                      <QueueItemCard
                        key={item.item_id}
                        item={item}
                        source={sourceMap.get(item.source_id)}
                        getStatusIcon={getStatusIcon}
                        getStatusColor={getStatusColor}
                        formatDate={formatDate}
                        calculateProgress={calculateProgress}
                        calculateETA={calculateETA}
                        getErrorMessage={getErrorMessage}
                        onRetry={handleRetry}
                        onCancel={handleCancel}
                        onStop={handleStopItem}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Recently Completed (BOTTOM) */}
              {completedItems.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2 px-2">
                    <HiCheckCircle className="h-5 w-5 text-green-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Recently Completed ({completedItems.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {completedItems.map((item) => (
                      <QueueItemCard
                        key={item.item_id}
                        item={item}
                        source={sourceMap.get(item.source_id)}
                        getStatusIcon={getStatusIcon}
                        getStatusColor={getStatusColor}
                        formatDate={formatDate}
                        calculateProgress={calculateProgress}
                        calculateETA={calculateETA}
                        getErrorMessage={getErrorMessage}
                        onRetry={handleRetry}
                        onCancel={handleCancel}
                        onStop={handleStopItem}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {runningItems.length === 0 && pendingItems.length === 0 && failedItems.length === 0 && completedItems.length === 0 && (
                <div className="p-8 text-center text-gray-600 dark:text-gray-400">
                  Queue is empty
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Queue Item Card Component
interface QueueItemCardProps {
  item: QueueItem;
  source?: KnowledgeSource;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusColor: (status: string) => string;
  formatDate: (dateString: string | null) => string;
  calculateProgress: (item: QueueItem) => number;
  calculateETA: (item: QueueItem) => string;
  getErrorMessage: (item: QueueItem) => { friendly: string; technical: string };
  onRetry: (itemId: string) => Promise<void>;
  onCancel: (itemId: string) => Promise<void>;
  onStop: (itemId: string) => Promise<void>;
}

function QueueItemCard({
  item,
  source,
  getStatusIcon,
  getStatusColor,
  formatDate,
  calculateProgress,
  calculateETA,
  getErrorMessage,
  onRetry,
  onCancel,
  onStop,
}: QueueItemCardProps) {
  const isHighPriority = item.priority >= 200;
  const progress = item.status === "running" ? calculateProgress(item) : 0;
  const eta = item.status === "running" ? calculateETA(item) : "";
  const errorInfo = item.status === "failed" ? getErrorMessage(item) : null;

  return (
    <div className={`rounded-lg border bg-white p-3 dark:bg-gray-800 ${
      isHighPriority
        ? "border-l-4 border-l-amber-500 border-t border-r border-b border-gray-200 dark:border-gray-700"
        : "border border-gray-200 dark:border-gray-700"
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {getStatusIcon(item.status)}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">
                {source?.title || `Source ${item.source_id.slice(0, 8)}`}
              </span>
              {isHighPriority && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  🚀 High Priority
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {source?.url}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(item.status)}`}
              >
                {item.status.toUpperCase()}
              </span>
              {!isHighPriority && (
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  Priority: {item.priority}
                </span>
              )}
              {item.retry_count > 0 && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  Retry {item.retry_count}/{item.max_retries}
                </span>
              )}
            </div>

            {/* Progress bar for running items */}
            {item.status === "running" && (
              <div className="mt-3 space-y-2">
                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-brand-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span>{progress}% complete</span>
                    <span>•</span>
                    <span>ETA: {eta}</span>
                  </div>
                  <button
                    onClick={() => onStop(item.item_id)}
                    className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                    title="Stop this crawl"
                  >
                    <HiStop className="h-4 w-4" />
                    Stop
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-gray-600 dark:text-gray-400">
          <div>Created: {formatDate(item.created_at)}</div>
          {item.started_at && <div>Started: {formatDate(item.started_at)}</div>}
          {item.completed_at && <div>Completed: {formatDate(item.completed_at)}</div>}
        </div>
      </div>
      {/* Enhanced Error Display for Failed Items */}
      {item.status === "failed" && errorInfo && (
        <div className="mt-3 space-y-2">
          {/* User-Friendly Error Message */}
          <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
            <div className="text-sm font-medium text-red-900 dark:text-red-100">
              {errorInfo.friendly}
            </div>

            {/* Validation Details (if validation failed) */}
            {item.error_details?.validation_result && (
              <div className="mt-2 rounded bg-yellow-50 p-2 text-xs dark:bg-yellow-900/20">
                <div className="font-medium text-yellow-900 dark:text-yellow-100">
                  📊 Validation Details:
                </div>
                <div className="mt-1 text-yellow-800 dark:text-yellow-200">
                  📄 Pages: {item.error_details.validation_result.pages_count} |
                  📦 Chunks: {item.error_details.validation_result.chunks_count} |
                  💻 Code Examples: {item.error_details.validation_result.code_examples_count}
                </div>
                {item.error_details.validation_result.error && (
                  <div className="mt-1 text-yellow-700 dark:text-yellow-300">
                    {item.error_details.validation_result.error}
                  </div>
                )}
              </div>
            )}

            {/* Technical Error Message (collapsible) */}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">
                Show technical details
              </summary>
              <div className="mt-1 rounded bg-red-100 p-2 text-xs font-mono text-red-800 dark:bg-red-900/40 dark:text-red-300">
                {errorInfo.technical}
              </div>
            </details>

            {/* Action Buttons */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onRetry(item.item_id)}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
              >
                🔁 Retry Now
              </button>
              <button
                onClick={() => onCancel(item.item_id)}
                className="rounded-lg bg-gray-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600"
              >
                ✖️ Cancel
              </button>
            </div>

            {/* Retry Information */}
            {item.retry_count > 0 && item.retry_count < item.max_retries && (
              <div className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                ℹ️ This item will be automatically retried.
                Attempts: {item.retry_count}/{item.max_retries}
              </div>
            )}
            {item.retry_count >= item.max_retries && (
              <div className="mt-2 text-xs text-red-700 dark:text-red-400">
                ⚠️ Maximum retry attempts reached. Manual intervention required.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
