"use client";

import { TaskDetailView } from "@/features/tasks/views/TaskDetailView";
import { use } from "react";

interface TaskDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Task Detail Page - Next.js page component
 *
 * Delegates to TaskDetailView feature component for all logic and rendering.
 * Receives task ID from URL params and passes to TaskDetailView.
 */
export default function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = use(params);
  return <TaskDetailView taskId={id} />;
}
