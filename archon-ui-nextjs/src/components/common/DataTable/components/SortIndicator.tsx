"use client";

import React, { FC, memo } from "react";
import { cn } from "@/lib/utils";
import { HiChevronUp, HiChevronDown, HiX } from "react-icons/hi";

/**
 * SortIndicator Component
 *
 * Displays sort direction indicator with optional priority badge for multi-sort.
 *
 * Features:
 * - Ascending/descending arrows
 * - Priority badge (1, 2, 3) for multi-sort
 * - Clear button for removing sort
 * - Animated transitions
 */

export interface SortIndicatorProps {
  /** Sort direction (null = not sorted) */
  direction: "asc" | "desc" | null;
  /** Sort priority for multi-sort (1, 2, 3, or null) */
  priority?: number | null;
  /** Whether to show the priority badge */
  showPriority?: boolean;
  /** Whether to show a clear button */
  showClear?: boolean;
  /** Callback when clear is clicked */
  onClear?: () => void;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
}

const SortIndicator: FC<SortIndicatorProps> = memo(({
  direction,
  priority,
  showPriority = true,
  showClear = false,
  onClear,
  size = "sm",
  className,
}) => {
  if (!direction) {
    // Not sorted - show both arrows in gray
    return (
      <div className={cn("flex flex-col", className)}>
        <HiChevronUp
          className={cn(
            "text-gray-400 dark:text-gray-500",
            size === "sm" ? "h-3 w-3" : "h-4 w-4"
          )}
        />
        <HiChevronDown
          className={cn(
            "-mt-1 text-gray-400 dark:text-gray-500",
            size === "sm" ? "h-3 w-3" : "h-4 w-4"
          )}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* Sort Direction Arrow */}
      <div className="flex flex-col">
        <HiChevronUp
          className={cn(
            "transition-colors",
            size === "sm" ? "h-3 w-3" : "h-4 w-4",
            direction === "asc"
              ? "text-brand-600 dark:text-brand-400"
              : "text-gray-400 dark:text-gray-500"
          )}
        />
        <HiChevronDown
          className={cn(
            "-mt-1 transition-colors",
            size === "sm" ? "h-3 w-3" : "h-4 w-4",
            direction === "desc"
              ? "text-brand-600 dark:text-brand-400"
              : "text-gray-400 dark:text-gray-500"
          )}
        />
      </div>

      {/* Priority Badge */}
      {showPriority && priority !== null && priority !== undefined && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full font-medium",
            "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400",
            size === "sm"
              ? "h-4 w-4 text-[10px]"
              : "h-5 w-5 text-xs"
          )}
        >
          {priority}
        </span>
      )}

      {/* Clear Button */}
      {showClear && onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className={cn(
            "ml-1 rounded-full transition-colors",
            "text-gray-400 hover:text-gray-600 hover:bg-gray-200",
            "dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700",
            "focus:outline-none focus:ring-2 focus:ring-brand-500",
            size === "sm" ? "p-0.5" : "p-1"
          )}
          aria-label="Clear sort"
        >
          <HiX className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
        </button>
      )}
    </div>
  );
});

SortIndicator.displayName = "SortIndicator";

/**
 * MultiSortBadge Component
 *
 * Displays a summary of active multi-sort columns with clear all option.
 */
export interface MultiSortBadgeProps {
  /** Number of active sort columns */
  sortCount: number;
  /** Callback to clear all sorting */
  onClearAll?: () => void;
  /** Additional class names */
  className?: string;
}

export const MultiSortBadge: FC<MultiSortBadgeProps> = memo(({
  sortCount,
  onClearAll,
  className,
}) => {
  if (sortCount <= 1) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full",
        "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400",
        "text-xs font-medium",
        className
      )}
    >
      <span>Sorted by {sortCount} columns</span>
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className={cn(
            "rounded-full p-0.5 transition-colors",
            "hover:bg-brand-200 dark:hover:bg-brand-800/30",
            "focus:outline-none focus:ring-2 focus:ring-brand-500"
          )}
          aria-label="Clear all sorting"
        >
          <HiX className="h-3 w-3" />
        </button>
      )}
    </div>
  );
});

MultiSortBadge.displayName = "MultiSortBadge";

export default SortIndicator;
