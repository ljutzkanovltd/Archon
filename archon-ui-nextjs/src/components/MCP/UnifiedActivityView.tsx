"use client";

import { useMcpClients, useMcpSessionHealth, useMcpAnalytics } from "@/hooks";
import { useState, useMemo } from "react";
import { HiUser, HiCode, HiCheckCircle, HiXCircle, HiClock, HiChevronDown, HiChevronUp } from "react-icons/hi";
import { SessionTypeFilter, SessionType } from "./SessionTypeFilter";

interface ActivityItem {
  id: string;
  type: "session" | "request";
  timestamp: string;
  sessionId: string;
  clientType: string;
  status: "active" | "disconnected" | "success" | "error";
  title: string;
  subtitle?: string;
  duration?: number;
  details?: any;
}

interface UnifiedActivityViewProps {
  viewMode: "api" | "mcp" | "unified";
  className?: string;
}

export function UnifiedActivityView({ viewMode, className = "" }: UnifiedActivityViewProps) {
  const { data: clients = [] } = useMcpClients();
  const { data: health } = useMcpSessionHealth();
  const { data: analytics } = useMcpAnalytics({ days: 1 });

  const [sessionFilter, setSessionFilter] = useState<SessionType>("all");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showLimit, setShowLimit] = useState(20);

  // Build unified activity timeline
  const activities = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = [];

    // Add session activities (connections/disconnections)
    if (viewMode === "mcp" || viewMode === "unified") {
      health?.recent_activity?.forEach((session) => {
        items.push({
          id: `session-${session.session_id}`,
          type: "session",
          timestamp: new Date(Date.now() - session.uptime_minutes * 60 * 1000).toISOString(),
          sessionId: session.session_id,
          clientType: session.client_type,
          status: session.status === "active" ? "active" : "disconnected",
          title: `Session ${session.status === "active" ? "Connected" : "Disconnected"}`,
          subtitle: `${session.client_type} • Uptime: ${session.uptime_minutes}m`,
          details: session,
        });
      });
    }

    // Add tool execution activities (from analytics response_times)
    if ((viewMode === "api" || viewMode === "unified") && analytics?.response_times?.by_tool) {
      Object.entries(analytics.response_times.by_tool).slice(0, 50).forEach(([toolName, data]: [string, any], idx) => {
        items.push({
          id: `tool-${toolName}-${idx}`,
          type: "request",
          timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(), // Placeholder
          sessionId: "unknown",
          clientType: "MCP Client",
          status: "success", // Assume success if in response_times
          title: `Tool: ${toolName}`,
          subtitle: `Avg: ${data.avg?.toFixed(0) || 0}ms • P95: ${data.p95?.toFixed(0) || 0}ms`,
          duration: data.avg,
          details: data,
        });
      });
    }

    // Sort by timestamp (most recent first)
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [viewMode, health, analytics]);

  // Filter by session type
  const filteredActivities = useMemo(() => {
    if (sessionFilter === "all") return activities;

    return activities.filter((activity) => {
      const clientType = activity.clientType.toLowerCase();

      if (sessionFilter === "claude-code") return clientType.includes("claude");
      if (sessionFilter === "cursor") return clientType.includes("cursor");
      if (sessionFilter === "api") return activity.type === "request";
      if (sessionFilter === "other") return !clientType.includes("claude") && !clientType.includes("cursor");

      return true;
    });
  }, [activities, sessionFilter]);

  // Calculate counts for filter
  const filterCounts: Record<SessionType, number> = useMemo(() => {
    return {
      all: activities.length,
      "claude-code": activities.filter((a) => a.clientType.toLowerCase().includes("claude")).length,
      cursor: activities.filter((a) => a.clientType.toLowerCase().includes("cursor")).length,
      api: activities.filter((a) => a.type === "request").length,
      other: activities.filter((a) => {
        const ct = a.clientType.toLowerCase();
        return !ct.includes("claude") && !ct.includes("cursor");
      }).length,
    };
  }, [activities]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const displayedActivities = filteredActivities.slice(0, showLimit);
  const hasMore = filteredActivities.length > showLimit;

  if (filteredActivities.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center ${className}`}>
        <div className="text-gray-400 dark:text-gray-500 mb-2">
          <HiClock className="w-12 h-12 mx-auto mb-3" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
          No Activity Found
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {viewMode === "api" && "No API requests recorded yet"}
          {viewMode === "mcp" && "No MCP sessions found"}
          {viewMode === "unified" && "No activity recorded yet"}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Activity Timeline
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filteredActivities.length} {filteredActivities.length === 1 ? "event" : "events"} • Last 24 hours
          </p>
        </div>
        <SessionTypeFilter value={sessionFilter} onChange={setSessionFilter} counts={filterCounts} />
      </div>

      {/* Activity List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {displayedActivities.map((activity) => {
            const isExpanded = expandedItems.has(activity.id);

            return (
              <div
                key={activity.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Activity Row */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpand(activity.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      activity.type === "session"
                        ? activity.status === "active"
                          ? "bg-green-100 dark:bg-green-900/20"
                          : "bg-gray-100 dark:bg-gray-700"
                        : activity.status === "success"
                        ? "bg-blue-100 dark:bg-blue-900/20"
                        : "bg-red-100 dark:bg-red-900/20"
                    }`}>
                      {activity.type === "session" ? (
                        <HiUser className={`w-5 h-5 ${
                          activity.status === "active" ? "text-green-600 dark:text-green-400" : "text-gray-500"
                        }`} />
                      ) : activity.status === "success" ? (
                        <HiCheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <HiXCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {activity.title}
                        </h4>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(activity.timestamp).toLocaleTimeString()}
                          </span>
                          {isExpanded ? (
                            <HiChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <HiChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                      {activity.subtitle && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {activity.subtitle}
                        </p>
                      )}
                      {activity.duration !== undefined && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Response time: {activity.duration.toFixed(0)}ms
                        </p>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="flex-shrink-0">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        activity.status === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : activity.status === "disconnected"
                          ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          : activity.status === "success"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}>
                        {activity.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && activity.details && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="ml-14 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(activity.details).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-gray-500 dark:text-gray-400 font-medium">{key}:</dt>
                            <dd className="text-gray-900 dark:text-white font-mono">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <button
              onClick={() => setShowLimit((prev) => prev + 20)}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Load More ({filteredActivities.length - showLimit} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
