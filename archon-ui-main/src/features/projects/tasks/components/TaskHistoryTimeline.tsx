import { Archive, CheckCircle, Clock, Edit2, History, User as UserIcon } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useToast } from "@/features/shared/hooks/useToast";
import { Card } from "../../../ui/primitives";
import { cn } from "../../../ui/primitives/styles";

interface TaskHistoryChange {
  change_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
  change_reason?: string | null;
}

interface TaskHistoryResponse {
  task_id: string;
  changes: TaskHistoryChange[];
  count: number;
  field_filter: string | null;
}

interface TaskHistoryTimelineProps {
  taskId: string;
  className?: string;
}

// Format timestamp to human-readable format
const formatTimestamp = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Get icon for field type
const getFieldIcon = (fieldName: string) => {
  switch (fieldName) {
    case "status":
      return <CheckCircle className="w-4 h-4" />;
    case "archived":
      return <Archive className="w-4 h-4" />;
    case "title":
    case "description":
      return <Edit2 className="w-4 h-4" />;
    case "assignee":
      return <UserIcon className="w-4 h-4" />;
    default:
      return <History className="w-4 h-4" />;
  }
};

// Get color for field type
const getFieldColor = (fieldName: string): string => {
  switch (fieldName) {
    case "status":
      return "text-blue-500 dark:text-blue-400";
    case "archived":
      return "text-gray-500 dark:text-gray-400";
    case "title":
    case "description":
      return "text-purple-500 dark:text-purple-400";
    case "assignee":
      return "text-cyan-500 dark:text-cyan-400";
    case "priority":
      return "text-orange-500 dark:text-orange-400";
    default:
      return "text-gray-500 dark:text-gray-400";
  }
};

// Highlight significant events
const isSignificantEvent = (fieldName: string, oldValue: string | null, newValue: string | null): boolean => {
  if (fieldName === "status" && newValue === "done") return true;
  if (fieldName === "archived" && newValue === "true") return true;
  return false;
};

export const TaskHistoryTimeline: React.FC<TaskHistoryTimelineProps> = ({ taskId, className }) => {
  const [history, setHistory] = useState<TaskHistoryChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fieldFilter, setFieldFilter] = useState<string | null>(null);
  const { showToast } = useToast();

  // Fetch task history
  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const url = fieldFilter
          ? `/api/tasks/${taskId}/history?field_name=${fieldFilter}`
          : `/api/tasks/${taskId}/history`;

        // Use the configured API base URL from environment or default
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8181";
        const response = await fetch(`${apiBaseUrl}${url}`);
        if (!response.ok) {
          throw new Error("Failed to fetch task history");
        }

        const data: TaskHistoryResponse = await response.json();
        setHistory(data.changes);
      } catch (error) {
        console.error("Error fetching task history:", error);
        showToast("Failed to load task history", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [taskId, fieldFilter, showToast]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <Card blur="md" transparency="light" className={cn("p-6 text-center", className)}>
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
        <p className="text-gray-600 dark:text-gray-400">No history available yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          Changes will appear here as you update this task
        </p>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setFieldFilter(null)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            !fieldFilter
              ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700",
          )}
        >
          All Changes
        </button>
        <button
          type="button"
          onClick={() => setFieldFilter("status")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            fieldFilter === "status"
              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700",
          )}
        >
          Status Only
        </button>
      </div>

      {/* Timeline */}
      <div className="relative space-y-4 pl-8">
        {/* Vertical line */}
        <div className="absolute left-[13px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-500/50 via-purple-500/50 to-transparent" />

        {history.map((change, index) => {
          const isSignificant = isSignificantEvent(change.field_name, change.old_value, change.new_value);
          const fieldColor = getFieldColor(change.field_name);

          return (
            <div key={change.change_id} className="relative">
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute -left-[26px] top-2 w-6 h-6 rounded-full flex items-center justify-center",
                  isSignificant
                    ? "bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30"
                    : "bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600",
                  fieldColor,
                )}
              >
                {getFieldIcon(change.field_name)}
              </div>

              {/* Change card */}
              <Card
                blur="md"
                transparency="light"
                size="none"
                className={cn(
                  "p-4 transition-all",
                  isSignificant && "border-cyan-400/50 shadow-lg shadow-cyan-500/10",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Field name and timestamp */}
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium capitalize", fieldColor)}>{change.field_name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(change.changed_at)}</span>
                    </div>

                    {/* Old → New values */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through">
                        {change.old_value || "empty"}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        {change.new_value || "empty"}
                      </span>
                    </div>

                    {/* Changed by */}
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <UserIcon className="w-3 h-3" />
                      <span>Changed by {change.changed_by}</span>
                    </div>

                    {/* Change reason (if provided) */}
                    {change.change_reason && (
                      <div className="text-xs italic text-gray-500 dark:text-gray-500 mt-1">
                        "{change.change_reason}"
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
};
