"use client";

import { Badge } from 'flowbite-react';
import { useTaskCounts } from '@/hooks/useTaskCounts';
import { useProjectStore } from '@/store/useProjectStore';
import { usePathname } from 'next/navigation';

interface TaskCountBadgeProps {
  isCollapsed: boolean;
  isMobile?: boolean;
}

/**
 * Task Count Badge Component
 *
 * Displays task counts by status in the sidebar:
 * - Collapsed desktop: Shows total count only (e.g., "12")
 * - Expanded desktop: Shows full breakdown (e.g., "12 total • 3 todo • 5 doing...")
 * - Mobile: Always shows full breakdown
 *
 * Context-aware:
 * - Shows global counts on Dashboard and general pages
 * - Shows project-specific counts when viewing a project
 *
 * Auto-refreshes every 30 seconds via useTaskCounts hook.
 */
export const TaskCountBadge = ({ isCollapsed, isMobile = false }: TaskCountBadgeProps) => {
  const { selectedProject } = useProjectStore();

  // Always use project-specific counts when a project is selected
  // This allows the task counts to follow the selected project across all pages
  const projectId = selectedProject?.id;

  const { data: counts, isLoading, error } = useTaskCounts(projectId);

  // Loading state: show skeleton placeholder
  if (isLoading) {
    return (
      <div className="flex gap-1">
        <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        {(!isCollapsed || isMobile) && (
          <>
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </>
        )}
      </div>
    );
  }

  // Error state: show placeholder with dashes
  if (error || !counts) {
    console.error('Failed to load task counts:', error);
    return (
      <Badge color="gray" size="sm">
        --
      </Badge>
    );
  }

  // Collapsed desktop sidebar: show total count only
  if (isCollapsed && !isMobile) {
    return (
      <Badge color="gray" size="sm" className="font-medium">
        {counts.total}
      </Badge>
    );
  }

  // Expanded desktop or mobile: show full breakdown
  return (
    <div className="flex flex-wrap gap-1 text-xs items-center">
      <Badge color={projectId ? "info" : "gray"} size="sm" className="font-medium">
        {projectId ? "📋" : "🌐"} {counts.total}
      </Badge>
      {counts.todo > 0 && (
        <Badge color="gray" size="sm">
          {counts.todo} todo
        </Badge>
      )}
      {counts.doing > 0 && (
        <Badge color="info" size="sm">
          {counts.doing} doing
        </Badge>
      )}
      {counts.review > 0 && (
        <Badge color="warning" size="sm">
          {counts.review} review
        </Badge>
      )}
      {counts.done > 0 && (
        <Badge color="success" size="sm">
          {counts.done} done
        </Badge>
      )}
    </div>
  );
};
