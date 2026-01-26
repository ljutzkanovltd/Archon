"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge, Progress, Alert, Spinner } from "flowbite-react";
import {
  HiChartPie,
  HiExclamation,
  HiClock,
  HiTrendingUp,
  HiTrendingDown,
  HiCheckCircle,
  HiXCircle,
} from "react-icons/hi";
import apiClient from "@/lib/apiClient";
import { ExportButton } from "@/components/ExportButton";

interface ProjectHealthDashboardProps {
  projectId: string;
}

interface ProjectHealth {
  success: boolean;
  project: {
    id: string;
    title: string;
  };
  health_score: number;
  risk_level: "low" | "medium" | "high";
  blocked_tasks_count: number;
  overdue_tasks_count: number;
  unassigned_tasks_count: number;
  high_priority_pending_count: number;
  indicators: {
    total_tasks: number;
    completion_rate: number;
    blocked_percentage: number;
    overdue_percentage: number;
  };
  blocked_tasks: Array<{
    id: string;
    title: string;
    priority: string;
  }>;
  overdue_tasks: Array<{
    id: string;
    title: string;
    due_date: string;
    priority: string;
  }>;
  cached: boolean;
}

/**
 * ProjectHealthDashboard - Display project health metrics and risk indicators
 *
 * Features:
 * - Health score (0-100) with visual indicator
 * - Risk level assessment (low/medium/high)
 * - Blocked tasks list and count
 * - Overdue tasks list and count
 * - Key performance indicators (completion rate, blocked %, overdue %)
 * - Unassigned tasks count
 * - High priority pending tasks count
 * - Cached results indicator
 *
 * Usage:
 * ```tsx
 * <ProjectHealthDashboard projectId={projectId} />
 * ```
 */
export function ProjectHealthDashboard({
  projectId,
}: ProjectHealthDashboardProps) {
  // Fetch project health data
  const {
    data: healthData,
    isLoading,
    error,
  } = useQuery<ProjectHealth>({
    queryKey: ["project-health", projectId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/projects/${projectId}/health`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes (matches backend cache)
    refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 minutes
  });

  // Calculate health score color and status
  const healthStatus = useMemo(() => {
    if (!healthData) return { color: "gray", label: "Unknown", icon: HiChartPie };

    const score = healthData.health_score;

    if (score >= 80) {
      return { color: "success", label: "Excellent", icon: HiCheckCircle };
    } else if (score >= 60) {
      return { color: "info", label: "Good", icon: HiTrendingUp };
    } else if (score >= 40) {
      return { color: "warning", label: "Fair", icon: HiExclamation };
    } else {
      return { color: "failure", label: "Poor", icon: HiXCircle };
    }
  }, [healthData]);

  // Get risk level badge color
  const getRiskBadgeColor = (riskLevel: string): string => {
    switch (riskLevel) {
      case "low":
        return "success";
      case "medium":
        return "warning";
      case "high":
        return "failure";
      default:
        return "gray";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <Spinner size="xl" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading project health...
          </span>
        </div>
      </Card>
    );
  }

  if (error || !healthData) {
    return (
      <Card>
        <Alert color="failure" icon={HiXCircle}>
          <span className="font-medium">Failed to load project health!</span>{" "}
          {(error as Error)?.message || "Unknown error occurred"}
        </Alert>
      </Card>
    );
  }

  const HealthIcon = healthStatus.icon;

  // Prepare export data
  const exportData = useMemo(() => {
    const data: Record<string, any>[] = [];

    // Add blocked tasks
    healthData.blocked_tasks.forEach((task) => {
      data.push({
        type: "Blocked",
        task_id: task.id,
        title: task.title,
        priority: task.priority,
        due_date: "",
      });
    });

    // Add overdue tasks
    healthData.overdue_tasks.forEach((task) => {
      data.push({
        type: "Overdue",
        task_id: task.id,
        title: task.title,
        priority: task.priority,
        due_date: task.due_date,
      });
    });

    return data;
  }, [healthData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HiChartPie className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Project Health Dashboard
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {healthData.project.title}
              {healthData.cached && (
                <span className="ml-2 text-xs">(cached)</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge color={getRiskBadgeColor(healthData.risk_level)} size="lg">
            Risk: {healthData.risk_level.toUpperCase()}
          </Badge>
          <ExportButton
            data={exportData}
            filename={`project-health-${healthData.project.id}`}
            headers={{
              type: "Issue Type",
              task_id: "Task ID",
              title: "Task Title",
              priority: "Priority",
              due_date: "Due Date",
            }}
            size="sm"
            showDropdown
          />
        </div>
      </div>

      {/* Health Score Card */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <HealthIcon
                className={`h-12 w-12 text-${healthStatus.color}-500`}
              />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Overall Health Score
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {healthStatus.label} - {healthData.health_score}/100
                </p>
              </div>
            </div>
            <Progress
              progress={healthData.health_score}
              color={healthStatus.color}
              size="lg"
            />
          </div>
        </div>
      </Card>

      {/* Key Indicators Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <IndicatorCard
          title="Blocked Tasks"
          value={healthData.blocked_tasks_count}
          percentage={healthData.indicators.blocked_percentage}
          icon={HiExclamation}
          color="warning"
        />
        <IndicatorCard
          title="Overdue Tasks"
          value={healthData.overdue_tasks_count}
          percentage={healthData.indicators.overdue_percentage}
          icon={HiClock}
          color="failure"
        />
        <IndicatorCard
          title="Unassigned"
          value={healthData.unassigned_tasks_count}
          icon={HiExclamation}
          color="gray"
        />
        <IndicatorCard
          title="High Priority Pending"
          value={healthData.high_priority_pending_count}
          icon={HiTrendingUp}
          color="info"
        />
      </div>

      {/* Completion Rate */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Completion Metrics
        </h3>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Completion Rate
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {healthData.indicators.completion_rate.toFixed(1)}%
              </span>
            </div>
            <Progress
              progress={healthData.indicators.completion_rate}
              color={
                healthData.indicators.completion_rate >= 75
                  ? "success"
                  : healthData.indicators.completion_rate >= 50
                  ? "info"
                  : "warning"
              }
              size="lg"
            />
          </div>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Total Tasks: {healthData.indicators.total_tasks}</span>
            <span>
              Completed:{" "}
              {Math.round(
                (healthData.indicators.completion_rate *
                  healthData.indicators.total_tasks) /
                  100
              )}
            </span>
          </div>
        </div>
      </Card>

      {/* Blocked Tasks */}
      {healthData.blocked_tasks_count > 0 && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <HiExclamation className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Blocked Tasks ({healthData.blocked_tasks_count})
            </h3>
          </div>
          <div className="space-y-2">
            {healthData.blocked_tasks.slice(0, 5).map((task) => (
              <TaskListItem
                key={task.id}
                taskId={task.id}
                title={task.title}
                priority={task.priority}
                projectId={projectId}
              />
            ))}
            {healthData.blocked_tasks_count > 5 && (
              <p className="pt-2 text-sm text-gray-500 dark:text-gray-400">
                ...and {healthData.blocked_tasks_count - 5} more blocked tasks
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Overdue Tasks */}
      {healthData.overdue_tasks_count > 0 && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <HiClock className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Overdue Tasks ({healthData.overdue_tasks_count})
            </h3>
          </div>
          <div className="space-y-2">
            {healthData.overdue_tasks.slice(0, 5).map((task) => (
              <TaskListItem
                key={task.id}
                taskId={task.id}
                title={task.title}
                priority={task.priority}
                dueDate={task.due_date}
                projectId={projectId}
              />
            ))}
            {healthData.overdue_tasks_count > 5 && (
              <p className="pt-2 text-sm text-gray-500 dark:text-gray-400">
                ...and {healthData.overdue_tasks_count - 5} more overdue tasks
              </p>
            )}
          </div>
        </Card>
      )}

      {/* All Clear Message */}
      {healthData.blocked_tasks_count === 0 &&
        healthData.overdue_tasks_count === 0 && (
          <Card>
            <div className="flex items-center justify-center py-8">
              <HiCheckCircle className="mr-3 h-12 w-12 text-green-500" />
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  No Blockers or Overdue Tasks
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Project is on track!
                </p>
              </div>
            </div>
          </Card>
        )}
    </div>
  );
}

/**
 * IndicatorCard - Display a single health indicator metric
 */
interface IndicatorCardProps {
  title: string;
  value: number;
  percentage?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "success" | "info" | "warning" | "failure" | "gray";
}

function IndicatorCard({
  title,
  value,
  percentage,
  icon: Icon,
  color,
}: IndicatorCardProps) {
  const colorClasses = {
    success:
      "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    info: "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    warning:
      "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    failure: "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400",
  };

  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {percentage !== undefined && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {percentage.toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * TaskListItem - Display a task in a list with priority badge and link
 */
interface TaskListItemProps {
  taskId: string;
  title: string;
  priority: string;
  dueDate?: string;
  projectId: string;
}

function TaskListItem({
  taskId,
  title,
  priority,
  dueDate,
  projectId,
}: TaskListItemProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "urgent":
        return "failure";
      case "high":
        return "warning";
      case "medium":
        return "info";
      case "low":
        return "gray";
      default:
        return "gray";
    }
  };

  const formatDueDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.ceil(
        (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays < 0) {
        return `${Math.abs(diffDays)} days overdue`;
      }
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex-1 min-w-0">
        <a
          href={`/projects/${projectId}?taskId=${taskId}`}
          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          {title}
        </a>
        {dueDate && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Due: {formatDueDate(dueDate)}
          </p>
        )}
      </div>
      <Badge color={getPriorityColor(priority)} size="sm">
        {priority}
      </Badge>
    </div>
  );
}
