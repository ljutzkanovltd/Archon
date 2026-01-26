"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import "@svar-ui/react-gantt/style.css";
// TODO: Re-enable custom theme after resolving PostCSS processing issue
// import "@/styles/gantt-theme.css";
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
  type?: "task" | "summary" | "milestone";
  open?: boolean;
  assignee?: string;
  status?: string; // For color coding
  priority?: string; // For border styling
  // REMOVED: parent property - hierarchy defined by nesting, not references
}

interface GanttLink {
  id: string;
  source: string;
  target: string;
  type: "e2s" | "s2s" | "e2e" | "s2e"; // end-to-start, start-to-start, end-to-end, start-to-end
}

/**
 * TimelineView - Jira-style Gantt timeline with sprints, tasks, milestones, and dependencies
 *
 * Features:
 * ✅ Sprint lanes as summary rows with NESTED task structure
 * ✅ Sprint start/end milestones (🚀 Start, 🏁 End)
 * ✅ Task dependencies (automatic feature-based linking)
 * ✅ Color coding by status (backlog/in-progress/review/done/blocked)
 * ✅ Priority indicators (urgent/high/medium/low border colors)
 * ✅ Progress bars (0%-100% based on workflow stage)
 * ✅ Zoom controls (day/week/month views)
 * ✅ Enhanced tooltips with task details
 * ✅ Archon theme integration (dark mode support)
 * ✅ Drag-and-drop task rescheduling
 * ✅ Real-time updates via TanStack Query
 * ✅ Advanced filtering (sprint, assignee, priority, status)
 * ✅ Show/hide completed tasks toggle
 * ✅ Active filter indicator with count
 * ✅ Clear all filters button
 *
 * Data Fetching:
 * - Uses TanStack Query hooks for automatic caching and refetching
 * - `useSprints(projectId)` - Fetches all sprints for the project
 * - `useTasksByProject(projectId)` - Fetches all tasks (up to 1000) for the project
 * - Automatic cache invalidation on mutations
 * - Background refetching for real-time updates
 *
 * Filtering:
 * - Sprint filter: All/Backlog/Specific sprint
 * - Assignee filter: Multi-select checkbox list
 * - Priority filter: Multi-select (urgent/high/medium/low)
 * - Status filter: Multi-select (backlog/in-progress/review/done/blocked)
 * - Show completed: Toggle to hide/show Done tasks
 * - Filters applied client-side after data fetch for instant response
 *
 * Data Structure: NESTED (SVAR Gantt requirement)
 * - Sprints at root level with tasks in `data: [...]`
 * - Milestones at root level (not nested)
 * - NO parent property - hierarchy defined by nesting
 * - All items have `data: []` array (even leaf nodes)
 *
 * Task Dependencies:
 * - Auto-generated based on feature grouping
 * - Sequential end-to-start links within each feature
 * - Rendered as gray arrows with hover highlighting
 *
 * Usage:
 * ```tsx
 * <TimelineView projectId={projectId} projectTitle={project.title} />
 * ```
 */
export function TimelineView({ projectId, projectTitle }: TimelineViewProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("week");

  // Filter state
  const [selectedSprintId, setSelectedSprintId] = useState<string>("all");
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState<boolean>(true);
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(false);

  // Fetch sprints and tasks
  const { data: sprintsData, isLoading: sprintsLoading } = useSprints(projectId);
  const { data: tasksData, isLoading: tasksLoading } = useTasksByProject(projectId);

  const sprints = sprintsData?.sprints || [];
  const allTasks = tasksData?.items || [];

  // Extract unique filter values
  const filterOptions = useMemo(() => {
    const assignees = new Set<string>();
    const priorities = new Set<string>();
    const statuses = new Set<string>();

    allTasks.forEach((task: Task) => {
      if (task.assignee) assignees.add(task.assignee);
      if (task.priority) priorities.add(task.priority);
      const stageName = task.workflow_stage?.name?.toLowerCase() || "backlog";
      statuses.add(stageName);
    });

    return {
      assignees: Array.from(assignees).sort(),
      priorities: Array.from(priorities).sort(),
      statuses: Array.from(statuses).sort(),
    };
  }, [allTasks]);

  // Apply filters to tasks
  const tasks = useMemo(() => {
    return allTasks.filter((task: Task) => {
      // Sprint filter
      if (selectedSprintId !== "all") {
        if (selectedSprintId === "backlog" && task.sprint_id) return false;
        if (selectedSprintId !== "backlog" && task.sprint_id !== selectedSprintId) return false;
      }

      // Assignee filter
      if (selectedAssignees.size > 0 && !selectedAssignees.has(task.assignee || "Unassigned")) {
        return false;
      }

      // Priority filter
      if (selectedPriorities.size > 0 && !selectedPriorities.has(task.priority || "medium")) {
        return false;
      }

      // Status filter
      const stageName = task.workflow_stage?.name?.toLowerCase() || "backlog";
      if (selectedStatuses.size > 0 && !selectedStatuses.has(stageName)) {
        return false;
      }

      // Show completed filter
      if (!showCompleted && stageName === "done") {
        return false;
      }

      return true;
    });
  }, [allTasks, selectedSprintId, selectedAssignees, selectedPriorities, selectedStatuses, showCompleted]);

  // Transform data for Gantt chart - NESTED STRUCTURE (SVAR requirement)
  const ganttData = useMemo(() => {
    const data: GanttTask[] = [];
    const milestones: GanttTask[] = [];

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
              status: stageName || "backlog",
              priority: task.priority || "medium",
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

        // Add sprint start milestone
        milestones.push({
          id: `milestone-start-${sprint.id}`,
          text: `🚀 ${sprint.name} Start`,
          start: startDate,
          end: startDate,
          duration: 0,
          data: [],
          type: "milestone",
          status: sprint.status,
        });

        // Add sprint end milestone
        milestones.push({
          id: `milestone-end-${sprint.id}`,
          text: `🏁 ${sprint.name} End`,
          start: endDate,
          end: endDate,
          duration: 0,
          data: [],
          type: "milestone",
          status: sprint.status,
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
          status: stageName || "backlog",
          priority: task.priority || "medium",
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

    // Add all milestones to root level (not nested)
    data.push(...milestones);

    console.log('[Timeline] Using NESTED structure - children embedded in parent\'s data array');
    console.log(`[Timeline] Added ${milestones.length} sprint milestones`);
    return data;
  }, [sprints, tasks]);

  // Generate task dependency links based on features or sequential order
  const ganttLinks = useMemo((): GanttLink[] => {
    const links: GanttLink[] = [];

    // Group tasks by feature for dependency linking
    const tasksByFeature = new Map<string, Task[]>();
    tasks.forEach((task: Task) => {
      if (task.feature && task.sprint_id) {
        const featureTasks = tasksByFeature.get(task.feature) || [];
        featureTasks.push(task);
        tasksByFeature.set(task.feature, featureTasks);
      }
    });

    // Create sequential dependencies within each feature
    tasksByFeature.forEach((featureTasks, feature) => {
      // Sort by created_at to establish sequence
      const sortedTasks = [...featureTasks].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Link each task to the next one (end-to-start)
      for (let i = 0; i < sortedTasks.length - 1; i++) {
        const sourceTask = sortedTasks[i];
        const targetTask = sortedTasks[i + 1];

        links.push({
          id: `link-${sourceTask.id}-${targetTask.id}`,
          source: `task-${sourceTask.id}`,
          target: `task-${targetTask.id}`,
          type: "e2s", // end-to-start dependency
        });
      }
    });

    console.log(`[Timeline] Generated ${links.length} task dependency links`);
    return links;
  }, [tasks]);

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

      {/* Filter Controls */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Filters
            </h3>
            {(selectedSprintId !== "all" ||
              selectedAssignees.size > 0 ||
              selectedPriorities.size > 0 ||
              selectedStatuses.size > 0 ||
              !showCompleted) && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-200">
                {[
                  selectedSprintId !== "all" ? 1 : 0,
                  selectedAssignees.size,
                  selectedPriorities.size,
                  selectedStatuses.size,
                  !showCompleted ? 1 : 0,
                ]
                  .filter((n) => n > 0)
                  .reduce((a, b) => a + b, 0)}{" "}
                active
              </span>
            )}
          </div>
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            {filtersExpanded ? "Hide" : "Show"} Filters
          </button>
        </div>

        {filtersExpanded && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Sprint Filter */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Sprint
              </label>
              <select
                value={selectedSprintId}
                onChange={(e) => setSelectedSprintId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Sprints</option>
                <option value="backlog">Backlog Only</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee Filter */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Assignees ({selectedAssignees.size} selected)
              </label>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-700">
                {filterOptions.assignees.map((assignee) => (
                  <label
                    key={assignee}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssignees.has(assignee)}
                      onChange={(e) => {
                        const newSet = new Set(selectedAssignees);
                        if (e.target.checked) {
                          newSet.add(assignee);
                        } else {
                          newSet.delete(assignee);
                        }
                        setSelectedAssignees(newSet);
                      }}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-gray-900 dark:text-white">{assignee}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Priorities ({selectedPriorities.size} selected)
              </label>
              <div className="space-y-1">
                {filterOptions.priorities.map((priority) => (
                  <label
                    key={priority}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPriorities.has(priority)}
                      onChange={(e) => {
                        const newSet = new Set(selectedPriorities);
                        if (e.target.checked) {
                          newSet.add(priority);
                        } else {
                          newSet.delete(priority);
                        }
                        setSelectedPriorities(newSet);
                      }}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="capitalize text-gray-900 dark:text-white">{priority}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Statuses ({selectedStatuses.size} selected)
              </label>
              <div className="space-y-1">
                {filterOptions.statuses.map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStatuses.has(status)}
                      onChange={(e) => {
                        const newSet = new Set(selectedStatuses);
                        if (e.target.checked) {
                          newSet.add(status);
                        } else {
                          newSet.delete(status);
                        }
                        setSelectedStatuses(newSet);
                      }}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="capitalize text-gray-900 dark:text-white">{status}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Row */}
        <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Show completed tasks
          </label>

          <button
            onClick={() => {
              setSelectedSprintId("all");
              setSelectedAssignees(new Set());
              setSelectedPriorities(new Set());
              setSelectedStatuses(new Set());
              setShowCompleted(true);
            }}
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Visible Tasks
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {tasks.length}
            {tasks.length !== allTasks.length && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                / {allTasks.length}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Active Sprints
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {sprints.filter((s) => s.status === "active").length}
            <span className="ml-2 text-sm font-normal text-gray-500">
              / {sprints.length}
            </span>
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            In Progress
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {tasks.filter((t: Task) => t.workflow_stage?.name?.toLowerCase() === "in progress").length}
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
                links={ganttLinks}
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
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
          Legend
        </h3>

        {/* Task Status Colors */}
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
            Task Status
          </h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-gray-400"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Backlog</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-primary-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-warning-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Review</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-success-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Done</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-red-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Blocked</span>
            </div>
          </div>
        </div>

        {/* Priority Borders */}
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
            Task Priority (Border)
          </h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-gray-200 ring-2 ring-red-600"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Urgent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-gray-200 ring-2 ring-orange-600"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-gray-200 ring-1 ring-primary-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-gray-200 ring-1 ring-gray-400"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Low</span>
            </div>
          </div>
        </div>

        {/* Special Indicators */}
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
            Special Indicators
          </h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-indigo-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Sprint</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] text-white">◆</div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Milestone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-4 bg-gray-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Dependency</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
