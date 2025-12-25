"use client";

import { Badge } from 'flowbite-react';
import { useTaskCounts } from '@/hooks/useTaskCounts';

interface ProjectTaskBadgeProps {
  projectId: string;
  isCollapsed: boolean;
  isMobile?: boolean;
}

/**
 * Project Task Badge Component
 *
 * Displays a simple numeric task count badge for a specific project (inbox-style).
 * - Shows total count only (minimalist design)
 * - Hides badge if project has 0 tasks (reduces visual clutter)
 * - Displays "99+" for counts > 99
 * - Shows skeleton during loading
 * - Fails silently on error (task counts are supplementary info)
 *
 * Auto-refreshes every 30 seconds via useTaskCounts hook.
 */
export const ProjectTaskBadge = ({
  projectId,
}: ProjectTaskBadgeProps) => {
  const { data: counts, isLoading, error } = useTaskCounts(projectId);

  // Loading state: show skeleton placeholder
  if (isLoading) {
    return (
      <div className="h-5 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    );
  }

  // Error or no tasks: hide badge (fail silently, cleaner UI)
  if (error || !counts || counts.total === 0) {
    return null;
  }

  // Format count (99+ for large numbers)
  const displayCount = counts.total > 99 ? '99+' : counts.total.toString();

  // Render simple numeric badge (inbox-style)
  return (
    <Badge
      color="gray"
      size="sm"
      className="font-medium text-xs"
    >
      {displayCount}
    </Badge>
  );
};
