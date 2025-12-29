"use client";

import { TasksPage as TasksFeature } from "@/features/tasks/pages/TasksPage";

/**
 * Tasks Page - Next.js page component
 *
 * Delegates to TasksPage feature component for all logic and rendering.
 */
export default function TasksPage() {
  return <TasksFeature />;
}
