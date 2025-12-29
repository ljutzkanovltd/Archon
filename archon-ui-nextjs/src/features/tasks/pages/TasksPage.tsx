"use client";

import { useParams } from "next/navigation";
import { TasksListView } from "../views/TasksListView";
import { TaskDetailView } from "../views/TaskDetailView";

/**
 * TasksPage - Main routing component for tasks feature
 *
 * Routes between list and detail views based on URL params:
 * - /tasks → TasksListView
 * - /tasks/:taskId → TaskDetailView
 */
export function TasksPage() {
  const params = useParams();
  const taskId = params?.taskId as string | undefined;

  // Route to detail view if taskId is present
  if (taskId) {
    return <TaskDetailView taskId={taskId} />;
  }

  // Otherwise show list view
  return <TasksListView />;
}
