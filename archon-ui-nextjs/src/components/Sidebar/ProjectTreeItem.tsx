"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronDown, Folder, FileText } from "lucide-react";
import { useProjectHierarchy } from "@/hooks/useProjectHierarchy";
import { useProjectExpansion } from "@/hooks/useProjectExpansion";
import { cn } from "@/lib/utils";

interface ProjectTreeItemProps {
  project: {
    id: string;
    title: string;
    has_children?: boolean;
    task_count?: number;
    accumulated_task_count?: number;
    parent_project_id?: string | null;
    [key: string]: any;
  };
  depth?: number;
  isCollapsed?: boolean;
  isMobile?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  siblingCount?: number;
  positionInSiblings?: number;
}

export function ProjectTreeItem({
  project,
  depth = 0,
  isCollapsed = false,
  isMobile = false,
  isExpanded = false,
  onToggle,
  siblingCount,
  positionInSiblings,
}: ProjectTreeItemProps) {
  const pathname = usePathname();

  // Child expansion state management (for this project's children)
  const childExpansion = useProjectExpansion();

  // Fetch children only when expanded (lazy loading)
  const { data: hierarchy, isLoading } = useProjectHierarchy(
    project.id,
    isExpanded // Only fetch when expanded
  );

  const isActive = pathname === `/projects/${project.id}`;
  const hasChildren = project.has_children ?? false;

  // Clean project title - remove emoji icons and markers
  const cleanTitle = (title: string) => {
    return title
      .replace(/[\u{1F4C1}\u{1F4C4}\u{1F4C2}\u{1F4CA}\u{1F4CB}\u{1F5C2}\u{1F5C3}\u{1F5D1}]/gu, '') // Remove file/folder emojis
      .replace(/\[CHILD\]/gi, '')
      .replace(/\[PARENT\]/gi, '')
      .replace(/📁|📄|📂|📊|📋|🗂|🗃|🗑/g, '') // Remove common file/folder emojis
      .trim();
  };

  // Responsive indentation: 12px mobile, 16px desktop
  const indentClass = depth === 0 ? "" : `pl-3 md:pl-${depth * 4}`;

  const toggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggle) {
      onToggle();
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasChildren || !onToggle) return;

    switch (e.key) {
      case "ArrowRight":
        // Expand if collapsed
        if (!isExpanded) {
          e.preventDefault();
          onToggle();
        }
        break;
      case "ArrowLeft":
        // Collapse if expanded
        if (isExpanded) {
          e.preventDefault();
          onToggle();
        }
        break;
      case " ":
        // Space to toggle expansion
        e.preventDefault();
        onToggle();
        break;
    }
  };

  // Determine badge color and count based on has_children
  const badgeCount = hasChildren
    ? (project.accumulated_task_count ?? 0)
    : (project.task_count ?? 0);

  const badgeColorClass = hasChildren
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";

  const badgeTooltip = hasChildren
    ? `${badgeCount} total tasks (including children)`
    : `${badgeCount} project tasks`;

  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-setsize={siblingCount}
      aria-posinset={positionInSiblings}
    >
      {/* Project Item */}
      <div
        className={cn(
          "flex items-center group",
          indentClass
        )}
      >
        {/* Chevron Button (only for parents) */}
        {!isCollapsed && hasChildren && (
          <button
            onClick={toggleExpand}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${cleanTitle(project.title)}`}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-gray-400" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-400" />
            )}
          </button>
        )}

        {/* Spacer for items without chevron (align all projects to same starting point) */}
        {!isCollapsed && !hasChildren && (
          <div className="w-6 flex-shrink-0" />
        )}

        {/* Project Link */}
        <Link
          href={`/projects/${project.id}`}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
            "hover:bg-gray-100 dark:hover:bg-gray-700",
            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
            isActive
              ? "bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400 border-l-2 border-brand-500"
              : "text-gray-700 dark:text-gray-300",
            isCollapsed ? "justify-center" : "",
            // Parent projects: font-medium
            hasChildren && !isCollapsed ? "font-medium" : "font-normal",
            // Child projects: slightly muted text
            !hasChildren && depth > 0 && !isCollapsed ? "text-gray-600 dark:text-gray-400" : ""
          )}
          title={isCollapsed ? cleanTitle(project.title) : undefined}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Icon: Folder for parents/root-level, FileText for children only */}
          {hasChildren || depth === 0 ? (
            <Folder className="h-4 w-4 flex-shrink-0 text-blue-500" aria-hidden="true" />
          ) : (
            <FileText className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          )}

          {/* Title - cleaned of emoji icons and markers */}
          {!isCollapsed && (
            <span className="flex-1 truncate whitespace-nowrap">
              {cleanTitle(project.title)}
            </span>
          )}

          {/* Color-Coded Task Count Badge */}
          {!isCollapsed && badgeCount > 0 && (
            <span
              className={cn(
                "ml-auto flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                badgeColorClass
              )}
              title={badgeTooltip}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </Link>
      </div>

      {/* Children (Recursive) */}
      {!isCollapsed && isExpanded && hierarchy && hierarchy.children.length > 0 && (
        <div
          role="group"
          aria-hidden={!isExpanded}
          className="mt-1 space-y-1 animate-slideDown"
        >
          {hierarchy.children.map((child, index) => (
            <ProjectTreeItem
              key={child.id}
              project={child}
              depth={depth + 1}
              isCollapsed={isCollapsed}
              isMobile={isMobile}
              isExpanded={childExpansion.isExpanded(child.id)}
              onToggle={() => childExpansion.toggle(child.id)}
              siblingCount={hierarchy.children.length}
              positionInSiblings={index + 1}
            />
          ))}
        </div>
      )}

      {/* Loading Indicator */}
      {!isCollapsed && isExpanded && isLoading && (
        <div
          className={cn("py-2 text-sm text-gray-500 dark:text-gray-400", indentClass)}
        >
          <div className="flex items-center gap-2 pl-9">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" />
            <span>Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}
