"use client";

import { HiChevronDown, HiChevronRight } from "react-icons/hi";
import { useProjectExpansion } from "@/hooks/useProjectExpansion";
import { useProjectStore } from "@/store/useProjectStore";

interface ProjectExpansionControlsProps {
  className?: string;
}

/**
 * ProjectExpansionControls - Global expand/collapse controls for project tree
 *
 * Controls the expansion state of projects in the sidebar navigation.
 * Uses the same useProjectExpansion hook as the sidebar for state synchronization.
 */
export function ProjectExpansionControls({ className = "" }: ProjectExpansionControlsProps) {
  const { projects } = useProjectStore();
  const { expanded, expandAll, collapseAll } = useProjectExpansion();

  // Get all project IDs that have children
  const projectsWithChildren = projects.filter((p) => p.has_children);
  const allProjectIds = projectsWithChildren.map((p) => p.id);

  // Calculate how many are currently expanded
  const expandedCount = allProjectIds.filter((id) => expanded.has(id)).length;
  const allExpanded = expandedCount === allProjectIds.length && allProjectIds.length > 0;
  const allCollapsed = expandedCount === 0;

  const handleExpandAll = () => {
    expandAll(allProjectIds);
  };

  const handleCollapseAll = () => {
    collapseAll();
  };

  // Don't show controls if no projects with children
  if (projectsWithChildren.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Sidebar:
      </span>
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleExpandAll}
          disabled={allExpanded}
          className="flex items-center gap-1.5 rounded-l-lg border-r border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          title={allExpanded ? "All projects expanded" : "Expand all projects"}
        >
          <HiChevronDown className="h-4 w-4" aria-hidden="true" />
          <span>Expand All</span>
          {expandedCount > 0 && (
            <span className="ml-1 text-xs text-gray-500">({expandedCount})</span>
          )}
        </button>

        <button
          type="button"
          onClick={handleCollapseAll}
          disabled={allCollapsed}
          className="flex items-center gap-1.5 rounded-r-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          title={allCollapsed ? "All projects collapsed" : "Collapse all projects"}
        >
          <HiChevronRight className="h-4 w-4" aria-hidden="true" />
          <span>Collapse All</span>
        </button>
      </div>
    </div>
  );
}
