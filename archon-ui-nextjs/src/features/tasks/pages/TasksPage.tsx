"use client";

import { Suspense } from "react";
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

  // Otherwise show list view with Suspense boundary
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          <p className="ml-3 text-gray-500 dark:text-gray-400">Loading tasks...</p>
        </div>
      }
    >
      <TasksListView />
    </Suspense>
  );
}
