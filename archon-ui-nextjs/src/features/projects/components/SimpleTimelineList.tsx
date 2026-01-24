"use client";

import { Task, Sprint } from "@/lib/types";
import { format, differenceInDays } from "date-fns";
import { HiClock, HiUser } from "react-icons/hi";

interface SimpleTimelineListProps {
  sprints: Sprint[];
  tasks: Task[];
  projectId: string;
}

/**
 * SimpleTimelineList - CSS-based timeline fallback
 *
 * Used when Gantt chart fails to initialize. Provides basic
 * timeline visualization using CSS horizontal bars without
 * external dependencies.
 *
 * Features:
 * - Sprint grouping with horizontal bars
 * - Task visualization with progress indicators
 * - Responsive layout
 * - No external library dependencies
 * - Always functional (graceful degradation)
 */
export function SimpleTimelineList({ sprints, tasks, projectId }: SimpleTimelineListProps) {
  // Calculate timeline bounds (earliest start to latest end)
  const getTimelineBounds = () => {
    const allDates: Date[] = [];
    sprints.forEach((sprint) => {
      if (sprint.start_date) allDates.push(new Date(sprint.start_date));
      if (sprint.end_date) allDates.push(new Date(sprint.end_date));
    });
    tasks.forEach((task) => {
      if (task.created_at) allDates.push(new Date(task.created_at));
    });

    if (allDates.length === 0) {
      const now = new Date();
      return { start: now, end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) };
    }

    const start = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const end = new Date(Math.max(...allDates.map((d) => d.getTime())));
    return { start, end };
  };

  const { start: timelineStart, end: timelineEnd } = getTimelineBounds();
  const totalDays = differenceInDays(timelineEnd, timelineStart) || 30;

  // Calculate position and width percentages for timeline bars
  const calculateBarStyle = (startDate: Date, endDate: Date) => {
    const left = (differenceInDays(startDate, timelineStart) / totalDays) * 100;
    const width = (differenceInDays(endDate, startDate) / totalDays) * 100;
    return {
      left: `${Math.max(0, Math.min(100, left))}%`,
      width: `${Math.max(1, Math.min(100 - left, width))}%`,
    };
  };

  // Calculate progress color based on workflow stage
  const getProgressColor = (task: Task) => {
    const stageName = task.workflow_stage?.name?.toLowerCase() || "";
    if (stageName.includes("done") || stageName.includes("complete")) return "bg-green-500";
    if (stageName.includes("review")) return "bg-yellow-500";
    if (stageName.includes("progress") || stageName.includes("doing")) return "bg-blue-500";
    return "bg-gray-400";
  };

  return (
    <div className="space-y-6">
      {/* Timeline Header */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 dark:text-blue-400">ℹ️</div>
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              Simplified Timeline View
            </h3>
            <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
              Showing basic timeline visualization. This fallback view provides sprint and task
              overview without interactive Gantt features.
            </p>
          </div>
        </div>
      </div>

      {/* Sprints with Tasks */}
      {sprints.length > 0 ? (
        sprints.map((sprint) => {
          const sprintTasks = tasks.filter((t) => t.sprint_id === sprint.id);
          const sprintStart = new Date(sprint.start_date);
          const sprintEnd = new Date(sprint.end_date);
          const sprintStyle = calculateBarStyle(sprintStart, sprintEnd);

          return (
            <div
              key={sprint.id}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Sprint Header */}
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {sprint.name}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {format(sprintStart, "MMM d, yyyy")} → {format(sprintEnd, "MMM d, yyyy")} (
                  {differenceInDays(sprintEnd, sprintStart)} days)
                </p>
                {sprint.goal && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                    Goal: {sprint.goal}
                  </p>
                )}
              </div>

              {/* Sprint Timeline Bar */}
              <div className="relative mb-4 h-8 rounded-lg bg-gray-100 dark:bg-gray-700">
                <div
                  className="absolute h-full rounded-lg bg-cyan-500 opacity-30"
                  style={sprintStyle}
                  title={`${sprint.name}: ${format(sprintStart, "MMM d")} - ${format(sprintEnd, "MMM d")}`}
                />
              </div>

              {/* Tasks */}
              {sprintTasks.length > 0 ? (
                <div className="space-y-2">
                  {sprintTasks.map((task) => {
                    const taskStart = task.created_at ? new Date(task.created_at) : sprintStart;
                    const durationDays = task.estimated_hours
                      ? Math.ceil(task.estimated_hours / 8)
                      : 1;
                    const taskEnd = new Date(
                      taskStart.getTime() + durationDays * 24 * 60 * 60 * 1000
                    );
                    const taskStyle = calculateBarStyle(taskStart, taskEnd);
                    const progressColor = getProgressColor(task);

                    return (
                      <div
                        key={task.id}
                        className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-750"
                      >
                        {/* Task Info */}
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {task.title}
                            </h4>
                            <div className="mt-1 flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                              {task.assignee && (
                                <span className="flex items-center gap-1">
                                  <HiUser className="h-3 w-3" />
                                  {task.assignee}
                                </span>
                              )}
                              {task.estimated_hours && (
                                <span className="flex items-center gap-1">
                                  <HiClock className="h-3 w-3" />
                                  {task.estimated_hours}h
                                </span>
                              )}
                              {task.workflow_stage && (
                                <span className="rounded-full bg-gray-200 px-2 py-0.5 dark:bg-gray-600">
                                  {task.workflow_stage.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Task Timeline Bar */}
                        <div className="relative h-6 rounded bg-gray-200 dark:bg-gray-600">
                          <div
                            className={`absolute h-full rounded ${progressColor}`}
                            style={taskStyle}
                            title={`${format(taskStart, "MMM d")} - ${format(taskEnd, "MMM d")}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  No tasks assigned to this sprint
                </p>
              )}
            </div>
          );
        })
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-600 dark:text-gray-400">
            No sprints available. Create your first sprint to get started.
          </p>
        </div>
      )}

      {/* Backlog Tasks */}
      {tasks.filter((t) => !t.sprint_id).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Backlog (Unassigned)
          </h3>
          <div className="space-y-2">
            {tasks
              .filter((t) => !t.sprint_id)
              .map((task) => (
                <div
                  key={task.id}
                  className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-750"
                >
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {task.title}
                  </h4>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                    {task.assignee && (
                      <span className="flex items-center gap-1">
                        <HiUser className="h-3 w-3" />
                        {task.assignee}
                      </span>
                    )}
                    {task.estimated_hours && (
                      <span className="flex items-center gap-1">
                        <HiClock className="h-3 w-3" />
                        {task.estimated_hours}h
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
