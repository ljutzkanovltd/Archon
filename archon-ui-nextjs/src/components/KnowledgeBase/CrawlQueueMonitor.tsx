"use client";

import { useState, useEffect } from "react";
import { HiRefresh, HiClock, HiCheckCircle, HiXCircle, HiPlay } from "react-icons/hi";
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

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadQueue, 2000); // Refresh every 2 seconds
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

  // Don't show if no queue items
  if (!stats || stats.total === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <HiClock className="h-5 w-5 text-gray-500" />;
      case "running":
        return <HiPlay className="h-5 w-5 text-blue-500 animate-pulse" />;
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
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
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

  return (
    <div className={`rounded-lg border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-200 p-4 dark:border-blue-800">
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
            <HiRefresh className="h-5 w-5 animate-spin text-blue-500" />
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Stats badges */}
          <div className="flex gap-2">
            <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {stats.pending} Pending
            </span>
            {stats.running > 0 && (
              <span className="rounded-full bg-blue-200 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
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

          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="relative inline-block h-5 w-9">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-500 peer-checked:after:translate-x-4 dark:bg-gray-600"></div>
            </div>
            <span className={autoRefresh ? "text-blue-600 dark:text-blue-400" : ""}>
              Auto
            </span>
          </label>

          <button
            onClick={loadQueue}
            className="rounded-lg p-2 hover:bg-blue-100 dark:hover:bg-blue-900/40"
            title="Refresh"
          >
            <HiRefresh className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
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
                <div>
                  <div className="mb-2 flex items-center gap-2 px-2">
                    <HiPlay className="h-5 w-5 animate-pulse text-blue-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Actively Crawling ({runningItems.length})
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
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Pending (MIDDLE) */}
              {pendingItems.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 px-2">
                    <HiClock className="h-5 w-5 text-gray-500" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Pending Queue ({pendingItems.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {pendingItems.map((item) => (
                      <QueueItemCard
                        key={item.item_id}
                        item={item}
                        source={sourceMap.get(item.source_id)}
                        getStatusIcon={getStatusIcon}
                        getStatusColor={getStatusColor}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3: Completed (BOTTOM) */}
              {completedItems.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 px-2">
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
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {runningItems.length === 0 && pendingItems.length === 0 && completedItems.length === 0 && (
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
}

function QueueItemCard({
  item,
  source,
  getStatusIcon,
  getStatusColor,
  formatDate,
}: QueueItemCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {getStatusIcon(item.status)}
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {source?.title || `Source ${item.source_id.slice(0, 8)}`}
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
              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                Priority: {item.priority}
              </span>
              {item.retry_count > 0 && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  Retry {item.retry_count}/{item.max_retries}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-600 dark:text-gray-400">
          <div>Created: {formatDate(item.created_at)}</div>
          {item.started_at && <div>Started: {formatDate(item.started_at)}</div>}
          {item.completed_at && <div>Completed: {formatDate(item.completed_at)}</div>}
        </div>
      </div>
      {item.error_message && (
        <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <span className="font-medium">Error:</span> {item.error_message}
        </div>
      )}
    </div>
  );
}
