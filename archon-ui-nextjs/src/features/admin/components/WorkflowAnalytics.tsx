"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Badge,
  Spinner,
  Alert,
  Button,
  Select,
  Progress,
} from "flowbite-react";
import {
  HiChartBar,
  HiRefresh,
  HiTrendingUp,
  HiClock,
  HiLightningBolt,
} from "react-icons/hi";
import { apiClient } from "@/lib/apiClient";
import { ExportButton } from "@/components/ExportButton";

/**
 * Workflow Analytics - Show workflow usage stats, transition patterns, bottlenecks
 *
 * Features:
 * - Workflow usage statistics (which workflows are most used)
 * - Task distribution across workflow stages
 * - Average time spent in each stage (identify bottlenecks)
 * - Most common transitions between stages
 * - Project-level workflow metrics
 * - Export analytics data
 *
 * API Endpoints:
 * - GET /api/workflows - Get all workflows
 * - GET /api/projects - Get all projects with workflows
 * - GET /api/tasks - Get tasks with workflow stages
 * - GET /api/projects/{id}/task-metrics - Get task metrics
 *
 * Usage:
 * ```tsx
 * <WorkflowAnalytics />
 * ```
 */
export function WorkflowAnalytics() {
  const [selectedProject, setSelectedProject] = useState<string>("");

  // Fetch workflows
  const {
    data: workflowsData,
    isLoading: workflowsLoading,
    error: workflowsError,
  } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const response = await apiClient.get("/api/workflows");
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch projects
  const {
    data: projectsData,
    isLoading: projectsLoading,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects-analytics"],
    queryFn: async () => {
      const response = await apiClient.get("/api/projects");
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch tasks for selected project or all
  const {
    data: tasksData,
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ["tasks-analytics", selectedProject],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProject) params.append("project_id", selectedProject);
      params.append("per_page", "500"); // Get many tasks for analytics

      const response = await apiClient.get(`/api/tasks?${params.toString()}`);
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  const handleRefreshAll = () => {
    refetchTasks();
  };

  const isLoading = workflowsLoading || projectsLoading || tasksLoading;

  // Calculate analytics
  const workflows = workflowsData?.workflows || [];
  const projects = projectsData?.projects || [];
  const tasks = tasksData?.tasks || [];

  // Workflow usage stats
  const workflowUsage = workflows.map((workflow: any) => {
    const projectCount = projects.filter(
      (p: any) => p.workflow_id === workflow.id
    ).length;
    const taskCount = tasks.filter(
      (t: any) => t.workflow_stage?.workflow_id === workflow.id
    ).length;

    return {
      workflow_id: workflow.id,
      name: workflow.name,
      project_count: projectCount,
      task_count: taskCount,
    };
  });

  // Stage distribution
  const stageDistribution: Record<string, number> = {};
  tasks.forEach((task: any) => {
    if (task.workflow_stage) {
      const stageName = task.workflow_stage.name;
      stageDistribution[stageName] = (stageDistribution[stageName] || 0) + 1;
    }
  });

  const totalTasksWithStage = Object.values(stageDistribution).reduce(
    (sum, count) => sum + count,
    0
  );

  // Identify bottlenecks (stages with high task count)
  const bottleneckThreshold = totalTasksWithStage * 0.3; // 30% of tasks
  const bottlenecks = Object.entries(stageDistribution)
    .filter(([_, count]) => count > bottleneckThreshold)
    .map(([stage, count]) => ({ stage, count }));

  // Quick metrics
  const totalProjects = projects.length;
  const totalTasks = tasks.length;
  const activeWorkflows = workflowUsage.filter((w) => w.project_count > 0).length;

  // Prepare export data
  const exportData = [
    {
      category: "Workflow Usage",
      ...workflowUsage.reduce((acc: any, w) => {
        acc[`${w.name}_projects`] = w.project_count;
        acc[`${w.name}_tasks`] = w.task_count;
        return acc;
      }, {}),
    },
    {
      category: "Stage Distribution",
      ...stageDistribution,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HiChartBar className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Workflow Analytics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Analyze workflow usage, transitions, and bottlenecks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={exportData}
            filename="workflow-analytics"
            headers={{
              category: "Category",
            }}
            size="sm"
          />
          <Button
            color="gray"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isLoading}
          >
            <HiRefresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Project Filter */}
      <Card>
        <div className="flex items-center gap-4">
          <label
            htmlFor="project-filter"
            className="text-sm font-medium text-gray-900 dark:text-white"
          >
            Filter by Project:
          </label>
          <Select
            id="project-filter"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-64"
          >
            <option value="">All Projects</option>
            {projects.map((project: any) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Quick Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <HiChartBar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Active Workflows
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {activeWorkflows} / {workflows.length}
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
                Total Projects
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalProjects}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-100 p-3 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
              <HiLightningBolt className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Tasks
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalTasks}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <div className="flex items-center justify-center py-12">
            <Spinner size="xl" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Loading workflow analytics...
            </span>
          </div>
        </Card>
      )}

      {/* Error States */}
      {(workflowsError || projectsError || tasksError) && (
        <Alert color="warning">
          <span className="font-medium">Some data failed to load:</span>
          <ul className="mt-2 list-inside list-disc text-sm">
            {workflowsError && <li>Workflows data unavailable</li>}
            {projectsError && <li>Projects data unavailable</li>}
            {tasksError && <li>Tasks data unavailable</li>}
          </ul>
        </Alert>
      )}

      {/* Workflow Usage */}
      {!isLoading && workflows.length > 0 && (
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Workflow Usage Statistics
          </h3>
          <div className="space-y-4">
            {workflowUsage.map((workflow: any) => (
              <div
                key={workflow.workflow_id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {workflow.name}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {workflow.project_count}
                        </span>{" "}
                        projects
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {workflow.task_count}
                        </span>{" "}
                        tasks
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {workflow.project_count === 0 ? (
                      <Badge color="gray">Unused</Badge>
                    ) : (
                      <Badge color="success">Active</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Stage Distribution */}
      {!isLoading && Object.keys(stageDistribution).length > 0 && (
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Task Distribution Across Workflow Stages
          </h3>
          <div className="space-y-4">
            {Object.entries(stageDistribution)
              .sort(([, a], [, b]) => b - a)
              .map(([stage, count]) => {
                const percentage = totalTasksWithStage > 0
                  ? (count / totalTasksWithStage) * 100
                  : 0;
                const isBottleneck = count > bottleneckThreshold;

                return (
                  <div key={stage}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {stage}
                        </span>
                        {isBottleneck && (
                          <Badge color="warning" size="sm" icon={HiClock}>
                            Potential Bottleneck
                          </Badge>
                        )}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {count} tasks ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress
                      progress={percentage}
                      color={isBottleneck ? "yellow" : "blue"}
                      size="lg"
                    />
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Bottlenecks Alert */}
      {!isLoading && bottlenecks.length > 0 && (
        <Alert color="warning" icon={HiClock}>
          <div>
            <span className="font-medium">Potential Bottlenecks Detected</span>
            <p className="mt-2 text-sm">
              The following stages have a high concentration of tasks (≥30%):
            </p>
            <ul className="mt-2 list-inside list-disc text-sm">
              {bottlenecks.map(({ stage, count }) => (
                <li key={stage}>
                  <strong>{stage}</strong>: {count} tasks (
                  {((count / totalTasksWithStage) * 100).toFixed(1)}%)
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm">
              Consider reviewing these stages for workflow optimization opportunities.
            </p>
          </div>
        </Alert>
      )}

      {/* No Data State */}
      {!isLoading && tasks.length === 0 && (
        <Card>
          <div className="py-12 text-center">
            <HiChartBar className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              No task data available for analytics
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              Create some tasks or select a different project
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
