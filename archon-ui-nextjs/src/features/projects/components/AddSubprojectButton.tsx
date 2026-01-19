"use client";

import { Button } from "flowbite-react";
import { HiPlus } from "react-icons/hi";

interface AddSubprojectButtonProps {
  projectId: string;
  onAddSubproject: (parentId: string) => void;
  variant?: "icon" | "full";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

/**
 * AddSubprojectButton Component
 *
 * Phase 3.2: Add subproject button
 *
 * Features:
 * - Two variants: icon-only (for tree hover) or full button (for empty state)
 * - Triggers SubprojectModal to create child projects
 * - Accepts parent project ID
 * - Customizable size and styling
 *
 * Usage:
 * ```tsx
 * // Icon-only variant (for tree nodes)
 * <AddSubprojectButton
 *   projectId={project.id}
 *   onAddSubproject={handleAddSubproject}
 *   variant="icon"
 *   size="sm"
 * />
 *
 * // Full button variant (for empty state)
 * <AddSubprojectButton
 *   projectId={project.id}
 *   onAddSubproject={handleAddSubproject}
 *   variant="full"
 *   size="md"
 * />
 * ```
 */
export function AddSubprojectButton({
  projectId,
  onAddSubproject,
  variant = "icon",
  size = "sm",
  className = "",
}: AddSubprojectButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddSubproject(projectId);
  };

  if (variant === "icon") {
    // Icon-only button for tree nodes (shows on hover)
    return (
      <button
        onClick={handleClick}
        className={`flex-shrink-0 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100 dark:hover:bg-gray-600 dark:hover:text-gray-200 ${className}`}
        aria-label="Add subproject"
        title="Add subproject"
      >
        <HiPlus className="h-4 w-4" />
      </button>
    );
  }

  // Full button variant for empty state or prominent placement
  return (
    <Button
      onClick={handleClick}
      size={size}
      color="blue"
      className={className}
    >
      <HiPlus className="mr-2 h-4 w-4" />
      Add Subproject
    </Button>
  );
}
