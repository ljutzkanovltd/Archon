"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge, Spinner, Alert, Button } from "flowbite-react";
import {
  HiChartBar,
  HiClock,
  HiTrendingUp,
  HiRefresh,
  HiXCircle,
} from "react-icons/hi";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { apiClient } from "@/lib/apiClient";
import { ExportButton } from "@/components/ExportButton";

interface TaskMetricsViewProps {
  projectId: string;
  startDate?: string;
  endDate?: string;
}

interface TaskMetrics {
  success: boolean;
  total_tasks: number;
  status_distribution: Record<string, number>;
  assignee_breakdown: Record<string, number>;
  priority_distribution: Record<string, number>;
  avg_completion_time_hours: number;
  completion_trend: Array<{
    date: string;
    completed_count: number;
  }>;
  date_range: {
    start_date: string;
    end_date: string;
  };
  cached: boolean;
}

// Chart colors
const STATUS_COLORS = {
  backlog: "#6B7280", // gray
  in_progress: "#3B82F6", // blue
  review: "#F59E0B", // amber
  done: "#10B981", // green
};

const PRIORITY_COLORS = {
  urgent: "#EF4444", // red
  high: "#F59E0B", // amber
  medium: "#3B82F6", // blue
  low: "#6B7280", // gray
};

/**
 * TaskMetricsView - Display comprehensive task metrics and analytics
 *
 * Features:
 * - Task distribution by workflow stage (bar chart)
 * - Task breakdown by assignee (bar chart)
 * - Priority distribution (pie chart)
 * - Completion trend over time (line chart)
 * - Average completion time
 * - Total task count
 * - Date range filter
 * - Auto-refresh capability
 *
 * Usage:
 * ```tsx
 * <TaskMetricsView projectId={projectId} />
 * ```
 */
export function TaskMetricsView({
  projectId,
  startDate,
  endDate,
}: TaskMetricsViewProps) {
  const [dateRange, setDateRange] = useState<{
    start?: string;
    end?: string;
  }>({
    start: startDate,
    end: endDate,
  });

  // Fetch task metrics
  const {
    data: metricsData,
    isLoading,
    error,
    refetch,
  } = useQuery<TaskMetrics>({
    queryKey: ["task-metrics", projectId, dateRange.start, dateRange.end],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.start) params.append("start_date", dateRange.start);
      if (dateRange.end) params.append("end_date", dateRange.end);

      const url = `/api/projects/${projectId}/task-metrics${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const response = await apiClient.get(url);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes (matches backend cache)
  });

  // Transform status distribution for chart
  const statusChartData = metricsData?.status_distribution
    ? Object.entries(metricsData.status_distribution).map(([status, count]) => ({
        name: status.replace("_", " ").toUpperCase(),
        count,
        fill: STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "#6B7280",
      }))
    : [];

  // Transform assignee breakdown for chart
  const assigneeChartData = metricsData?.assignee_breakdown
    ? Object.entries(metricsData.assignee_breakdown)
        .map(([assignee, count]) => ({
          name: assignee === "unassigned" ? "Unassigned" : assignee,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // Top 10 assignees
    : [];

  // Transform priority distribution for chart
  const priorityChartData = metricsData?.priority_distribution
    ? Object.entries(metricsData.priority_distribution).map(
        ([priority, count]) => ({
          name: priority.toUpperCase(),
          value: count,
          fill:
            PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] ||
            "#6B7280",
        })
      )
    : [];

  // Transform completion trend for chart
  const trendChartData = metricsData?.completion_trend || [];

  // Prepare export data
  const exportData = metricsData
    ? [
        ...statusChartData.map((item) => ({
          metric_type: "Status Distribution",
          status: item.name,
          count: item.count,
        })),
        ...assigneeChartData.map((item) => ({
          metric_type: "Assignee Breakdown",
          assignee: item.name,
          count: item.count,
        })),
        ...priorityChartData.map((item) => ({
          metric_type: "Priority Distribution",
          priority: item.name,
          count: item.value,
        })),
      ]
    : [];

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <Spinner size="xl" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading task metrics...
          </span>
        </div>
      </Card>
    );
  }

  if (error || !metricsData) {
    return (
      <Card>
        <Alert color="failure" icon={HiXCircle}>
          <span className="font-medium">Failed to load task metrics!</span>{" "}
          {(error as Error)?.message || "Unknown error occurred"}
        </Alert>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HiChartBar className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Task Metrics & Analytics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {metricsData.date_range.start_date &&
              metricsData.date_range.end_date
                ? `${metricsData.date_range.start_date} to ${metricsData.date_range.end_date}`
                : "All time"}
              {metricsData.cached && (
                <span className="ml-2 text-xs">(cached)</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={exportData}
            filename={`task-metrics-${projectId}`}
            headers={{
              metric_type: "Metric Type",
              status: "Status",
              assignee: "Assignee",
              priority: "Priority",
              count: "Count",
            }}
            size="sm"
            showDropdown
          />
          <Button color="gray" size="sm" onClick={handleRefresh}>
            <HiRefresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <HiChartBar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Tasks
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metricsData.total_tasks}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-green-100 p-3 text-green-600 dark:bg-green-900/20 dark:text-green-400">
              <HiTrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Completed
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metricsData.status_distribution.done || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-100 p-3 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
              <HiClock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Avg. Completion Time
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metricsData.avg_completion_time_hours.toFixed(1)}h
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Status Distribution Chart */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Task Distribution by Stage
        </h3>
        {statusChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]}>
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">
            No task data available
          </p>
        )}
      </Card>

      {/* Priority Distribution Chart */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Priority Distribution
        </h3>
        {priorityChartData.length > 0 ? (
          <div className="flex flex-col items-center lg:flex-row lg:items-start lg:justify-around">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={priorityChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {priorityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 lg:mt-0">
              {priorityChartData.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-3 text-sm"
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    {entry.name}: {entry.value} tasks
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">
            No priority data available
          </p>
        )}
      </Card>

      {/* Assignee Breakdown Chart */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Tasks by Assignee (Top 10)
        </h3>
        {assigneeChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={assigneeChartData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" fill="#8B5CF6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">
            No assignee data available
          </p>
        )}
      </Card>

      {/* Completion Trend Chart */}
      {trendChartData.length > 0 && (
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Completion Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="completed_count"
                stroke="#10B981"
                strokeWidth={2}
                name="Completed Tasks"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Empty State */}
      {metricsData.total_tasks === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <HiChartBar className="h-16 w-16 text-gray-400" />
            <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No Tasks Yet
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create tasks to see metrics and analytics
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
