"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge, Spinner, Alert, Button, Table } from "flowbite-react";
import {
  HiChartBar,
  HiTrendingUp,
  HiTrendingDown,
  HiClock,
  HiRefresh,
  HiXCircle,
  HiUserGroup,
} from "react-icons/hi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { apiClient } from "@/lib/apiClient";
import { ExportButton } from "@/components/ExportButton";

interface TeamPerformanceReportProps {
  projectId: string;
  startDate?: string;
  endDate?: string;
}

interface MemberStats {
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  avg_completion_time_hours: number;
  high_priority_completed: number;
}

interface TeamPerformance {
  success: boolean;
  team_stats: Record<string, MemberStats>;
  overall: {
    total_members: number;
    total_tasks: number;
    completed_tasks: number;
    avg_team_completion_rate: number;
  };
  date_range: {
    start_date: string;
    end_date: string;
  };
  cached: boolean;
}

/**
 * TeamPerformanceReport - Display team member performance statistics
 *
 * Features:
 * - Completion rate per team member
 * - Average completion time
 * - High priority tasks completed
 * - Visual comparison charts
 * - Overall team statistics
 * - Date range filtering
 * - Sortable data table
 * - Performance rankings
 *
 * Usage:
 * ```tsx
 * <TeamPerformanceReport projectId={projectId} />
 * ```
 */
export function TeamPerformanceReport({
  projectId,
  startDate,
  endDate,
}: TeamPerformanceReportProps) {
  const [sortBy, setSortBy] = useState<
    "completion_rate" | "total_tasks" | "avg_time"
  >("completion_rate");

  // Fetch team performance data
  const {
    data: performanceData,
    isLoading,
    error,
    refetch,
  } = useQuery<TeamPerformance>({
    queryKey: ["team-performance", projectId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const url = `/api/projects/${projectId}/team-performance${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const response = await apiClient.get(url);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Transform team stats for charts
  const chartData = performanceData?.team_stats
    ? Object.entries(performanceData.team_stats)
        .map(([member, stats]) => ({
          name: member,
          completionRate: stats.completion_rate,
          totalTasks: stats.total_tasks,
          completedTasks: stats.completed_tasks,
          avgTime: stats.avg_completion_time_hours,
        }))
        .sort((a, b) => {
          if (sortBy === "completion_rate")
            return b.completionRate - a.completionRate;
          if (sortBy === "total_tasks") return b.totalTasks - a.totalTasks;
          return a.avgTime - b.avgTime;
        })
    : [];

  // Get performance badge color
  const getPerformanceBadge = (rate: number) => {
    if (rate >= 90) return { color: "success", label: "Excellent" };
    if (rate >= 75) return { color: "info", label: "Good" };
    if (rate >= 60) return { color: "warning", label: "Fair" };
    return { color: "failure", label: "Needs Improvement" };
  };

  // Prepare export data
  const exportData = performanceData?.team_stats
    ? Object.entries(performanceData.team_stats).map(([member, stats]) => ({
        member,
        total_tasks: stats.total_tasks,
        completed_tasks: stats.completed_tasks,
        completion_rate: stats.completion_rate,
        avg_completion_time_hours: stats.avg_completion_time_hours,
        high_priority_completed: stats.high_priority_completed,
        performance: getPerformanceBadge(stats.completion_rate).label,
      }))
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
            Loading team performance...
          </span>
        </div>
      </Card>
    );
  }

  if (error || !performanceData) {
    return (
      <Card>
        <Alert color="failure" icon={HiXCircle}>
          <span className="font-medium">
            Failed to load team performance!
          </span>{" "}
          {(error as Error)?.message || "Unknown error occurred"}
        </Alert>
      </Card>
    );
  }

  const memberCount = Object.keys(performanceData.team_stats).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HiUserGroup className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Team Performance Report
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {performanceData.date_range.start_date &&
              performanceData.date_range.end_date
                ? `${performanceData.date_range.start_date} to ${performanceData.date_range.end_date}`
                : "All time"}
              {performanceData.cached && (
                <span className="ml-2 text-xs">(cached)</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={exportData}
            filename={`team-performance-${projectId}`}
            headers={{
              member: "Team Member",
              total_tasks: "Total Tasks",
              completed_tasks: "Completed Tasks",
              completion_rate: "Completion Rate (%)",
              avg_completion_time_hours: "Avg. Completion Time (hrs)",
              high_priority_completed: "High Priority Completed",
              performance: "Performance Rating",
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

      {/* Overall Team Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <HiUserGroup className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Team Members
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {performanceData.overall.total_members}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-100 p-3 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
              <HiChartBar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Tasks
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {performanceData.overall.total_tasks}
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
                {performanceData.overall.completed_tasks}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
              <HiTrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Avg. Completion Rate
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {performanceData.overall.avg_team_completion_rate.toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Completion Rate Comparison Chart */}
      {chartData.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Completion Rate Comparison
            </h3>
            <div className="flex gap-2">
              <Button
                size="xs"
                color={sortBy === "completion_rate" ? "blue" : "gray"}
                onClick={() => setSortBy("completion_rate")}
              >
                By Rate
              </Button>
              <Button
                size="xs"
                color={sortBy === "total_tasks" ? "blue" : "gray"}
                onClick={() => setSortBy("total_tasks")}
              >
                By Tasks
              </Button>
              <Button
                size="xs"
                color={sortBy === "avg_time" ? "blue" : "gray"}
                onClick={() => setSortBy("avg_time")}
              >
                By Speed
              </Button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar
                dataKey="completionRate"
                fill="#10B981"
                name="Completion Rate (%)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Detailed Performance Table */}
      {memberCount > 0 && (
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Detailed Member Performance
          </h3>
          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell>Member</Table.HeadCell>
                <Table.HeadCell>Completion Rate</Table.HeadCell>
                <Table.HeadCell>Total Tasks</Table.HeadCell>
                <Table.HeadCell>Completed</Table.HeadCell>
                <Table.HeadCell>Avg. Time (hrs)</Table.HeadCell>
                <Table.HeadCell>High Priority</Table.HeadCell>
                <Table.HeadCell>Performance</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {Object.entries(performanceData.team_stats)
                  .sort(([, a], [, b]) => b.completion_rate - a.completion_rate)
                  .map(([member, stats]) => {
                    const badge = getPerformanceBadge(stats.completion_rate);
                    return (
                      <Table.Row
                        key={member}
                        className="bg-white dark:border-gray-700 dark:bg-gray-800"
                      >
                        <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                          {member}
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700">
                              <div
                                className="h-2 rounded-full bg-green-500"
                                style={{
                                  width: `${Math.min(stats.completion_rate, 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm">
                              {stats.completion_rate.toFixed(1)}%
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>{stats.total_tasks}</Table.Cell>
                        <Table.Cell>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {stats.completed_tasks}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          {stats.avg_completion_time_hours.toFixed(1)}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color="warning" size="sm">
                            {stats.high_priority_completed}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color={badge.color} size="sm">
                            {badge.label}
                          </Badge>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
              </Table.Body>
            </Table>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {memberCount === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <HiUserGroup className="h-16 w-16 text-gray-400" />
            <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No Team Members Found
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Assign tasks to team members to see performance metrics
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
