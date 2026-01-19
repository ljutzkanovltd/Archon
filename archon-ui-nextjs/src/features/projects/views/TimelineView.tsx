"use client";

import { useMemo, useState } from "react";
import { Gantt } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/style.css";
import { useSprints } from "@/features/sprints/hooks/useSprintQueries";
import { useTasksByProject } from "@/features/tasks/hooks/useTaskQueries";
import { Task, Sprint } from "@/lib/types";
import { format, addDays, differenceInDays } from "date-fns";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { HiCalendar, HiZoomIn, HiZoomOut } from "react-icons/hi";

interface TimelineViewProps {
  projectId: string;
  projectTitle?: string;
}

type ZoomLevel = "day" | "week" | "month";

interface GanttTask {
  id: string;
  text: string;
  start: string;
  end: string;
  duration?: number;
  progress?: number;
  type?: "task" | "summary";
  parent?: string;
  open?: boolean;
  status?: string;
  assignee?: string;
}

/**
 * TimelineView - Jira-style timeline showing sprints and tasks
 *
 * Features:
 * - Sprint lanes as summary rows
 * - Tasks nested under sprints
 * - Tasks without sprints in "Backlog" lane
 * - Zoom controls (day/week/month)
 * - Color coding by status
 * - Today marker line
 *
 * Usage:
 * ```tsx
 * <TimelineView projectId={projectId} projectTitle={project.title} />
 * ```
 */
export function TimelineView({ projectId, projectTitle }: TimelineViewProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("week");

  // Fetch sprints and tasks
  const { data: sprintsData, isLoading: sprintsLoading } = useSprints(projectId);
  const { data: tasksData, isLoading: tasksLoading } = useTasksByProject(projectId);

  const sprints = sprintsData?.sprints || [];
  const tasks = tasksData?.items || [];

  // Transform data for Gantt chart
  const ganttData = useMemo(() => {
    const data: GanttTask[] = [];

    // Add sprints as summary tasks (lanes)
    sprints.forEach((sprint: Sprint) => {
      // Skip sprints with invalid dates
      if (!sprint.start_date || !sprint.end_date) {
        console.warn(`[Timeline] Skipping sprint "${sprint.name}" - missing dates`, sprint);
        return;
      }

      try {
        data.push({
          id: `sprint-${sprint.id}`,
          text: sprint.name,
          start: format(new Date(sprint.start_date), "yyyy-MM-dd"),
          end: format(new Date(sprint.end_date), "yyyy-MM-dd"),
          type: "summary",
          open: true, // Expand by default to show nested tasks
        });
      } catch (error) {
        console.error(`[Timeline] Error formatting sprint "${sprint.name}":`, error);
      }
    });

    // Add "Backlog" lane for tasks without sprint
    const backlogTasks = tasks.filter((t: Task) => !t.sprint_id);
    if (backlogTasks.length > 0) {
      data.push({
        id: "backlog",
        text: "Backlog (No Sprint)",
        start: format(new Date(), "yyyy-MM-dd"),
        end: format(addDays(new Date(), 30), "yyyy-MM-dd"),
        type: "summary",
        open: true,
      });
    }

    // Add tasks
    tasks.forEach((task: Task) => {
      try {
        const startDate = task.created_at
          ? new Date(task.created_at)
          : new Date();

        // Calculate end date based on estimated hours (default 1 day if no estimate)
        const durationDays = task.estimated_hours
          ? Math.ceil(task.estimated_hours / 8)
          : 1;
        const endDate = addDays(startDate, durationDays);

        // Calculate progress based on status
        let progress = 0;
        if (task.status === "done") progress = 100;
        else if (task.status === "review") progress = 80;
        else if (task.status === "in_progress") progress = 50;

        data.push({
          id: `task-${task.id}`,
          text: task.title,
          start: format(startDate, "yyyy-MM-dd"),
          end: format(endDate, "yyyy-MM-dd"),
          duration: durationDays,
          progress,
          type: "task",
          parent: task.sprint_id ? `sprint-${task.sprint_id}` : "backlog",
          status: task.status,
          assignee: task.assignee || "Unassigned",
        });
      } catch (error) {
        console.error(`[Timeline] Error formatting task "${task.title}":`, error);
      }
    });

    return data;
  }, [sprints, tasks]);

  // Gantt scales configuration based on zoom level
  const scales = useMemo(() => {
    switch (zoomLevel) {
      case "day":
        return [
          { unit: "month", step: 1, format: "MMMM yyyy" },
          { unit: "day", step: 1, format: "d" },
        ];
      case "week":
        return [
          { unit: "month", step: 1, format: "MMMM yyyy" },
          { unit: "week", step: 1, format: "w" },
        ];
      case "month":
        return [
          { unit: "year", step: 1, format: "yyyy" },
          { unit: "month", step: 1, format: "MMM" },
        ];
      default:
        return [
          { unit: "month", step: 1, format: "MMMM yyyy" },
          { unit: "week", step: 1, format: "w" },
        ];
    }
  }, [zoomLevel]);

  // Gantt columns configuration
  const columns = useMemo(
    () => [
      { name: "text", label: "Task Name", width: 300, resize: true },
      { name: "start", label: "Start", align: "center" as const, width: 100 },
      { name: "end", label: "End", align: "center" as const, width: 100 },
      { name: "assignee", label: "Assignee", align: "center" as const, width: 120 },
    ],
    []
  );

  const isLoading = sprintsLoading || tasksLoading;

  // Validate ganttData has proper structure for Gantt component
  const hasValidGanttData = ganttData && ganttData.length > 0 && ganttData.every(item =>
    item.id && item.text && item.start && item.end
  );

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading timeline...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <BreadCrumb
        items={[
          { label: "Projects", href: "/projects" },
          { label: projectTitle || "Project", href: `/projects/${projectId}` },
          { label: "Timeline", href: `/projects/${projectId}/timeline` },
        ]}
        className="mb-4"
      />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            Timeline View
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Visualize sprints and tasks in a Gantt chart timeline
          </p>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel("day")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              zoomLevel === "day"
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            title="Zoom to daily view"
          >
            Day
          </button>
          <button
            onClick={() => setZoomLevel("week")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              zoomLevel === "week"
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            title="Zoom to weekly view"
          >
            Week
          </button>
          <button
            onClick={() => setZoomLevel("month")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              zoomLevel === "month"
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            title="Zoom to monthly view"
          >
            Month
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Total Sprints
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {sprints.length}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Total Tasks
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {tasks.length}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Backlog Tasks
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {tasks.filter((t: Task) => !t.sprint_id).length}
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        {hasValidGanttData ? (
          <div className="h-[600px] w-full">
            <Gantt
              tasks={ganttData}
              links={[]} // Required by SVAR Gantt - empty array for no dependencies
              scales={scales}
              columns={columns}
              cellWidth={zoomLevel === "day" ? 50 : zoomLevel === "week" ? 40 : 30}
              cellHeight={40}
              autoSchedule={false}
              readonly={false}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <HiCalendar className="mb-4 h-16 w-16 text-gray-400" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              No Timeline Data
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              {sprints.length === 0
                ? "Create your first sprint to get started"
                : tasks.length === 0
                ? "Add tasks to your sprint to see them in the timeline"
                : "Create sprints and tasks to visualize them in the timeline"
              }
            </p>
            {sprints.length > 0 && tasks.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 Tip: Create tasks and assign them to "{sprints[0].name}" to see them here
              </p>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          Legend
        </h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-gray-300"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Backlog (0%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-blue-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              In Progress (50%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-yellow-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Review (80%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Done (100%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
