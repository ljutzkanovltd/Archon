"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import "@svar-ui/react-gantt/style.css";
import { useSprints } from "@/features/sprints/hooks/useSprintQueries";
import { useTasksByProject } from "@/features/tasks/hooks/useTaskQueries";
import { Task, Sprint } from "@/lib/types";
import { format, addDays, differenceInDays } from "date-fns";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { HiCalendar, HiZoomIn, HiZoomOut } from "react-icons/hi";
import { GanttErrorBoundary } from "@/features/projects/components/GanttErrorBoundary";
import { SimpleTimelineList } from "@/features/projects/components/SimpleTimelineList";
import { Skeleton, SkeletonCard } from "@/components/LoadingStates";

// Dynamically import Gantt wrapper to disable SSR (SVAR Gantt requires client-side only)
const GanttChart = dynamic(
  () => import("@/features/projects/components/GanttChart").then((mod) => mod.GanttChart),
  { ssr: false }
);

interface TimelineViewProps {
  projectId: string;
  projectTitle?: string;
}

type ZoomLevel = "day" | "week" | "month";

interface GanttTask {
  id: string;
  text: string;
  start: Date; // SVAR Gantt requires Date objects, not strings
  end: Date; // SVAR Gantt requires BOTH end and duration
  duration: number; // Required - number of days
  data: GanttTask[]; // NESTED STRUCTURE: Children embedded in parent's data array (not parent refs)
  progress?: number;
  type?: "task" | "summary";
  open?: boolean;
  assignee?: string;
  // REMOVED: parent property - hierarchy defined by nesting, not references
}

/**
 * TimelineView - Jira-style timeline showing sprints and tasks
 *
 * Features:
 * - Sprint lanes as summary rows with NESTED task structure
 * - Tasks embedded in parent's data array (not parent references)
 * - Tasks without sprints in "Backlog" lane
 * - Zoom controls (day/week/month)
 * - Color coding by status
 *
 * Data Structure: NESTED (SVAR Gantt requirement)
 * - Sprints at root level with tasks in `data: [...]`
 * - NO parent property - hierarchy defined by nesting
 * - All items have `data: []` array (even leaf nodes)
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

  // Transform data for Gantt chart - NESTED STRUCTURE (SVAR requirement)
  const ganttData = useMemo(() => {
    const data: GanttTask[] = [];

    // Add sprints as summary tasks with NESTED children
    sprints.forEach((sprint: Sprint) => {
      // Skip sprints with invalid dates
      if (!sprint.start_date || !sprint.end_date) {
        console.warn(`[Timeline] Skipping sprint "${sprint.name}" - missing dates`, sprint);
        return;
      }

      try {
        const startDate = new Date(sprint.start_date);
        const endDate = new Date(sprint.end_date);
        const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        // Get tasks for this sprint and nest them in data array
        const sprintTasks = tasks
          .filter((t: Task) => t.sprint_id === sprint.id)
          .map((task: Task) => {
            const taskStartDate = task.created_at ? new Date(task.created_at) : new Date();
            const durationDays = task.estimated_hours ? Math.ceil(task.estimated_hours / 8) : 1;
            const taskEndDate = addDays(taskStartDate, durationDays);

            // Calculate progress based on workflow stage
            let progress = 0;
            const stageName = task.workflow_stage?.name?.toLowerCase() || task.status?.toLowerCase() || "";
            if (stageName.includes("done") || stageName.includes("complete")) progress = 100;
            else if (stageName.includes("review")) progress = 80;
            else if (stageName.includes("progress") || stageName.includes("doing")) progress = 50;

            return {
              id: `task-${task.id}`,
              text: task.title,
              start: taskStartDate,
              end: taskEndDate,
              duration: durationDays,
              data: [], // Leaf nodes still need empty array
              progress,
              type: "task" as const,
              assignee: task.assignee || "Unassigned",
            };
          });

        data.push({
          id: `sprint-${sprint.id}`,
          text: sprint.name,
          start: startDate,
          end: endDate,
          duration: duration > 0 ? duration : 1,
          data: sprintTasks, // ✅ NESTED: Children inside data array
          type: "summary",
          open: true, // Expand by default to show nested tasks
        });
      } catch (error) {
        console.error(`[Timeline] Error formatting sprint "${sprint.name}":`, error);
      }
    });

    // Add "Backlog" lane for tasks without sprint (NESTED structure)
    const backlogTasks = tasks
      .filter((t: Task) => !t.sprint_id)
      .map((task: Task) => {
        const taskStartDate = task.created_at ? new Date(task.created_at) : new Date();
        const durationDays = task.estimated_hours ? Math.ceil(task.estimated_hours / 8) : 1;
        const taskEndDate = addDays(taskStartDate, durationDays);

        // Calculate progress based on workflow stage
        let progress = 0;
        const stageName = task.workflow_stage?.name?.toLowerCase() || task.status?.toLowerCase() || "";
        if (stageName.includes("done") || stageName.includes("complete")) progress = 100;
        else if (stageName.includes("review")) progress = 80;
        else if (stageName.includes("progress") || stageName.includes("doing")) progress = 50;

        return {
          id: `task-${task.id}`,
          text: task.title,
          start: taskStartDate,
          end: taskEndDate,
          duration: durationDays,
          data: [], // Leaf nodes still need empty array
          progress,
          type: "task" as const,
          assignee: task.assignee || "Unassigned",
        };
      });

    if (backlogTasks.length > 0) {
      const backlogStart = new Date();
      const backlogEnd = addDays(backlogStart, 30);
      data.push({
        id: "backlog",
        text: "Backlog (No Sprint)",
        start: backlogStart,
        end: backlogEnd,
        duration: 30,
        data: backlogTasks, // ✅ NESTED: Children inside data array
        type: "summary",
        open: true,
      });
    }

    console.log('[Timeline] Using NESTED structure - children embedded in parent\'s data array');
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
      { name: "duration", label: "Duration", align: "center" as const, width: 80 },
      { name: "assignee", label: "Assignee", align: "center" as const, width: 120 },
    ],
    []
  );

  const isLoading = sprintsLoading || tasksLoading;

  // Validate ganttData has proper structure for Gantt component
  const hasValidGanttData = useMemo(() => {
    if (!ganttData || ganttData.length === 0) {
      console.log('[Timeline] No gantt data available');
      return false;
    }
    if (!scales || scales.length === 0) {
      console.error('[Timeline] Scales configuration is missing');
      return false;
    }
    if (!columns || columns.length === 0) {
      console.error('[Timeline] Columns configuration is missing');
      return false;
    }

    // Validate each item has required fields for SVAR Gantt
    const isValid = ganttData.every(item => {
      const hasRequiredFields =
        item.id &&
        item.text &&
        item.start instanceof Date &&
        item.end instanceof Date &&
        typeof item.duration === 'number' &&
        Array.isArray(item.data); // Required to prevent null forEach errors
      if (!hasRequiredFields) {
        console.error('[Timeline] Invalid gantt item:', item);
      }
      return hasRequiredFields;
    });

    console.log('[Timeline] Gantt data validation:', {
      dataCount: ganttData.length,
      scalesCount: scales.length,
      columnsCount: columns.length,
      isValid
    });

    return isValid;
  }, [ganttData, scales, columns]);

  if (isLoading) {
    return (
      <div className="p-8">
        {/* Skeleton for breadcrumb */}
        <div className="mb-4">
          <Skeleton height="1rem" width="200px" />
        </div>

        {/* Skeleton for header */}
        <div className="mb-6">
          <Skeleton height="2rem" width="300px" className="mb-2" />
          <Skeleton height="1rem" width="400px" />
        </div>

        {/* Skeleton for stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <SkeletonCard showHeader={false} bodyLines={1} showFooter={false} />
          <SkeletonCard showHeader={false} bodyLines={1} showFooter={false} />
          <SkeletonCard showHeader={false} bodyLines={1} showFooter={false} />
        </div>

        {/* Skeleton for Gantt chart area */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <Skeleton height="600px" className="w-full" />
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

      {/* Gantt Chart with Fallback */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        {hasValidGanttData ? (
          <GanttErrorBoundary
            fallback={
              <SimpleTimelineList
                sprints={sprints}
                tasks={tasks}
                projectId={projectId}
              />
            }
          >
            <div className="h-[600px] w-full">
              <GanttChart
                tasks={ganttData}
                links={[]} // Required by SVAR Gantt - empty array for no dependencies
                scales={scales}
                columns={columns}
                cellWidth={zoomLevel === "day" ? 50 : zoomLevel === "week" ? 40 : 30}
                cellHeight={40}
                readonly={false}
              />
            </div>
          </GanttErrorBoundary>
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
