"use client";

import { FC } from "react";
import { HiViewList, HiViewGrid, HiMenuAlt2 } from "react-icons/hi";
import { HiViewColumns } from "react-icons/hi2";
import { cn } from "@/lib/utils";

/**
 * ViewModeToggle - Reusable view mode toggle component
 *
 * Provides a consistent UI for switching between different view modes
 * across the application (table, grid, kanban, list).
 *
 * Features:
 * - Configurable modes via props
 * - Icon and optional label for each mode
 * - Dark mode support
 * - Accessibility with aria attributes
 * - Size variants (sm, md)
 */

// Supported view modes
export type ViewMode = "table" | "grid" | "kanban" | "list";

// Icon mapping for each view mode
const VIEW_MODE_CONFIG: Record<ViewMode, { icon: FC<{ className?: string }>; label: string }> = {
  table: { icon: HiViewList, label: "Table" },
  grid: { icon: HiViewGrid, label: "Grid" },
  kanban: { icon: HiViewColumns, label: "Kanban" },
  list: { icon: HiMenuAlt2, label: "List" },
};

interface ViewModeToggleProps {
  /** Array of view modes to display */
  modes: ViewMode[];
  /** Currently active view mode */
  currentMode: ViewMode;
  /** Callback when view mode changes */
  onChange: (mode: ViewMode) => void;
  /** Size variant */
  size?: "sm" | "md";
  /** Whether to show labels alongside icons */
  showLabels?: boolean;
  /** Additional class name for the container */
  className?: string;
}

export function ViewModeToggle({
  modes,
  currentMode,
  onChange,
  size = "md",
  showLabels = false,
  className,
}: ViewModeToggleProps) {
  if (modes.length === 0) return null;

  // Size-based classes
  const sizeClasses = {
    sm: {
      button: "px-2 py-1.5 text-xs",
      icon: "h-3.5 w-3.5",
    },
    md: {
      button: "px-3 py-2 text-sm",
      icon: "h-4 w-4",
    },
  };

  const { button: buttonSize, icon: iconSize } = sizeClasses[size];

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-gray-200 dark:border-gray-700",
        className
      )}
      role="group"
      aria-label="View mode"
    >
      {modes.map((mode, index) => {
        const { icon: Icon, label } = VIEW_MODE_CONFIG[mode];
        const isActive = currentMode === mode;
        const isFirst = index === 0;
        const isLast = index === modes.length - 1;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={cn(
              "flex items-center gap-1.5 font-medium transition-colors",
              buttonSize,
              // Border radius
              isFirst && "rounded-l-lg",
              isLast && "rounded-r-lg",
              // Border between buttons
              !isFirst && "border-l border-gray-200 dark:border-gray-700",
              // Active/inactive styles
              isActive
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
            aria-pressed={isActive}
            title={label}
          >
            <Icon className={iconSize} aria-hidden="true" />
            {showLabels && <span className="hidden sm:inline">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default ViewModeToggle;
