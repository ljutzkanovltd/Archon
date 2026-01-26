"use client";

import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Calendar, dateFnsLocalizer, View, Event, EventPropGetter } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addDays, startOfDay, endOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { useSprints } from "@/features/sprints/hooks/useSprintQueries";
import { useTasksByProject } from "@/features/tasks/hooks/useTaskQueries";
import { Task, Sprint } from "@/lib/types";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { HiCalendar, HiViewGrid, HiViewList } from "react-icons/hi";
import { Skeleton, SkeletonCard } from "@/components/LoadingStates";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/calendar-theme.css";

// Setup date-fns localizer for react-big-calendar
const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarViewProps {
  projectId: string;
  projectTitle?: string;
}

interface CalendarEvent extends Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource: {
    task: Task;
    type: "task" | "sprint" | "milestone";
    status?: string;
  };
}

/**
 * CalendarView - Google Calendar/Jira-style calendar for tasks and sprints
 *
 * Features:
 * ✅ Month/Week/Day/Agenda views
 * ✅ Tasks displayed by due date
 * ✅ Sprint boundaries as background events (toggleable)
 * ✅ Color coding by task status (backlog/in-progress/review/done/blocked)
 * ✅ Click to view task details (handlers prepared)
 * ✅ Real-time updates via TanStack Query
 * ✅ Advanced filtering (sprint, assignee, priority, status)
 * ✅ Show/hide completed tasks toggle
 * ✅ Show/hide sprint boundaries toggle
 * ✅ Active filter indicator with count
 * ✅ Clear all filters button
 * 🔄 Drag-and-drop to reschedule tasks (future)
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
 * - Show sprints: Toggle to hide/show sprint boundaries
 * - Filters applied client-side after data fetch for instant response
 *
 * Usage:
 * ```tsx
 * <CalendarView projectId={projectId} projectTitle={project.title} />
 * ```
 */
export function CalendarView({ projectId, projectTitle }: CalendarViewProps) {
  const [currentView, setCurrentView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filter state
  const [selectedSprintId, setSelectedSprintId] = useState<string>("all");
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState<boolean>(true);
  const [showSprints, setShowSprints] = useState<boolean>(true);
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

  // Transform tasks and sprints into calendar events
  const events = useMemo((): CalendarEvent[] => {
    const calendarEvents: CalendarEvent[] = [];

    // Add tasks with due dates as events
    tasks.forEach((task: Task) => {
      if (task.due_date) {
        try {
          const dueDate = new Date(task.due_date);
          const startDate = startOfDay(dueDate);
          const endDate = endOfDay(dueDate);

          calendarEvents.push({
            id: task.id,
            title: task.title,
            start: startDate,
            end: endDate,
            resource: {
              task,
              type: "task",
              status: task.workflow_stage?.name || task.status || "todo",
            },
          });
        } catch (err) {
          console.warn(`[Calendar] Invalid due_date for task "${task.title}"`, err);
        }
      }
    });

    // Add sprint boundaries as background events (if enabled)
    if (showSprints) {
      sprints.forEach((sprint: Sprint) => {
        if (sprint.start_date && sprint.end_date) {
          try {
            const startDate = new Date(sprint.start_date);
            const endDate = new Date(sprint.end_date);

            calendarEvents.push({
              id: `sprint-${sprint.id}`,
              title: `📅 ${sprint.name}`,
              start: startDate,
              end: endDate,
              resource: {
                task: null as any, // Sprint doesn't have a task
                type: "sprint",
              },
              allDay: true,
            });
          } catch (err) {
            console.warn(`[Calendar] Invalid dates for sprint "${sprint.name}"`, err);
          }
        }
      });
    }

    return calendarEvents;
  }, [tasks, sprints, showSprints]);

  // Custom event styling based on task status
  const eventStyleGetter: EventPropGetter<CalendarEvent> = useCallback((event) => {
    const { type, status } = event.resource;

    // Sprint background styling
    if (type === "sprint") {
      return {
        style: {
          backgroundColor: "#f3f4f6", // gray-100
          border: "2px dashed #9ca3af", // gray-400
          color: "#6b7280", // gray-500
          opacity: 0.6,
        },
      };
    }

    // Task status colors matching Archon theme
    let backgroundColor = "#3b82f6"; // primary-500 (default)
    let color = "#ffffff";

    switch (status?.toLowerCase()) {
      case "backlog":
      case "todo":
        backgroundColor = "#9ca3af"; // gray-400
        break;
      case "in progress":
      case "doing":
        backgroundColor = "#3b82f6"; // primary-500
        break;
      case "review":
        backgroundColor = "#f59e0b"; // warning-500
        break;
      case "done":
        backgroundColor = "#10b981"; // success-500
        break;
      case "blocked":
        backgroundColor = "#ef4444"; // red-500
        break;
      default:
        backgroundColor = "#6b7280"; // gray-500
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "4px",
        border: "none",
        color,
        fontSize: "0.875rem",
        fontWeight: "500",
      },
    };
  }, []);

  // Handle event click (open task detail)
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    const { type, task } = event.resource;

    if (type === "task" && task) {
      // TODO: Open task detail modal or navigate to task
      console.log("Selected task:", task);
      // Future: dispatch openTaskModal(task.id) or router.push(`/tasks/${task.id}`)
    }
  }, []);

  // Handle slot selection (create new task on date)
  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date; end: Date; action: string }) => {
      if (slotInfo.action === "select" || slotInfo.action === "click") {
        // TODO: Open create task modal with pre-filled due date
        console.log("Selected date range:", slotInfo.start, "to", slotInfo.end);
        // Future: dispatch openCreateTaskModal({ projectId, dueDate: slotInfo.start })
      }
    },
    [projectId]
  );

  // Handle view change
  const handleViewChange = useCallback((view: View) => {
    setCurrentView(view);
  }, []);

  // Handle date navigation
  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  // Loading state
  if (sprintsLoading || tasksLoading) {
    return (
      <div className="space-y-4">
        {/* Breadcrumb skeleton */}
        <Skeleton className="h-8 w-64" />

        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>

        {/* Calendar skeleton */}
        <SkeletonCard className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <BreadCrumb
        items={[
          { label: "Projects", href: "/projects" },
          { label: projectTitle || "Project", href: `/projects/${projectId}` },
          { label: "Calendar", href: `/projects/${projectId}/calendar` },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HiCalendar className="h-6 w-6 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Calendar View
          </h2>
        </div>

        {/* View info */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>{tasks.length} tasks</span>
          {tasks.length !== allTasks.length && (
            <span className="text-xs text-gray-500">/ {allTasks.length} total</span>
          )}
          <span>•</span>
          <span>{sprints.length} sprints</span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Filters
            </h3>
            {(selectedSprintId !== "all" ||
              selectedAssignees.size > 0 ||
              selectedPriorities.size > 0 ||
              selectedStatuses.size > 0 ||
              !showCompleted ||
              !showSprints) && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-200">
                {[
                  selectedSprintId !== "all" ? 1 : 0,
                  selectedAssignees.size,
                  selectedPriorities.size,
                  selectedStatuses.size,
                  !showCompleted ? 1 : 0,
                  !showSprints ? 1 : 0,
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
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Show completed tasks
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={showSprints}
                onChange={(e) => setShowSprints(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Show sprint boundaries
            </label>
          </div>

          <button
            onClick={() => {
              setSelectedSprintId("all");
              setSelectedAssignees(new Set());
              setSelectedPriorities(new Set());
              setSelectedStatuses(new Set());
              setShowCompleted(true);
              setShowSprints(true);
            }}
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          view={currentView}
          onView={handleViewChange}
          date={currentDate}
          onNavigate={handleNavigate}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          eventPropGetter={eventStyleGetter}
          views={["month", "week", "day", "agenda"]}
          messages={{
            next: "Next",
            previous: "Previous",
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day",
            agenda: "Agenda",
            date: "Date",
            time: "Time",
            event: "Task",
            allDay: "All Day",
            noEventsInRange: "No tasks in this date range.",
            showMore: (total) => `+${total} more`,
          }}
          className="archon-calendar"
        />
      </div>

      {/* Legend */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Task Status Legend
        </h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-gray-400"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">Backlog / Todo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-primary-500"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-warning-500"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">Review</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-success-500"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">Done</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded border-2 border-dashed border-gray-400 bg-gray-100"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">Sprint Boundaries</span>
          </div>
        </div>
      </div>
    </div>
  );
}
