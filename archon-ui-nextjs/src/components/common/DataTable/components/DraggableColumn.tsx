"use client";

import React, { FC, memo } from "react";
import { cn } from "@/lib/utils";
import { useColumnReorder } from "../hooks/useColumnReorder";
import { HiOutlineDotsVertical } from "react-icons/hi";

/**
 * DraggableColumn Component
 *
 * A wrapper for column headers that enables drag-and-drop reordering.
 * Uses @dnd-kit for drag-and-drop functionality.
 *
 * Features:
 * - Drag handle (grip dots icon)
 * - Visual feedback during drag (opacity, shadow)
 * - Touch support for mobile devices
 * - Can be disabled per-column
 */

export interface DraggableColumnProps {
  /** Unique column identifier */
  columnKey: string;
  /** Whether reordering is disabled */
  disabled?: boolean;
  /** Whether to show the drag handle */
  showDragHandle?: boolean;
  /** Children (header content) */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Tag to render as (default: th) */
  as?: "th" | "div";
}

const DraggableColumn: FC<DraggableColumnProps> = memo(({
  columnKey,
  disabled = false,
  showDragHandle = true,
  children,
  className,
  as: Component = "th",
}) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    style,
    isDragging,
  } = useColumnReorder({
    columnKey,
    disabled,
  });

  return (
    <Component
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        isDragging && "opacity-50 shadow-lg z-10",
        className
      )}
      {...attributes}
    >
      <div className="flex items-center gap-1">
        {/* Drag Handle */}
        {showDragHandle && !disabled && (
          <button
            type="button"
            className={cn(
              "flex items-center justify-center p-0.5 rounded cursor-grab",
              "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
              "hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-brand-500",
              isDragging && "cursor-grabbing"
            )}
            aria-label={`Drag to reorder ${columnKey} column`}
            {...listeners}
          >
            <HiOutlineDotsVertical className="h-4 w-4" />
          </button>
        )}

        {/* Header Content */}
        <div className="flex-1">{children}</div>
      </div>
    </Component>
  );
});

DraggableColumn.displayName = "DraggableColumn";

/**
 * DraggableColumnHeader
 *
 * A specialized version that combines DraggableColumn with table header styling.
 * Use this for standard table headers with drag-and-drop support.
 */
export interface DraggableColumnHeaderProps extends DraggableColumnProps {
  /** Column width */
  width?: string | number;
  /** Whether column is sortable (shows different cursor) */
  sortable?: boolean;
  /** Click handler for sorting */
  onClick?: () => void;
}

export const DraggableColumnHeader: FC<DraggableColumnHeaderProps> = memo(({
  columnKey,
  disabled = false,
  showDragHandle = true,
  width,
  sortable,
  onClick,
  children,
  className,
}) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    style,
    isDragging,
  } = useColumnReorder({
    columnKey,
    disabled,
  });

  const widthStyle = typeof width === "number" ? `${width}px` : width;

  return (
    <th
      ref={setNodeRef}
      scope="col"
      style={{
        ...style,
        width: widthStyle,
      }}
      className={cn(
        "px-6 py-3 relative",
        sortable && "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-600",
        isDragging && "opacity-50 shadow-lg z-10 bg-gray-100 dark:bg-gray-700",
        className
      )}
      onClick={sortable ? onClick : undefined}
      {...attributes}
    >
      <div className="flex items-center gap-1">
        {/* Drag Handle */}
        {showDragHandle && !disabled && (
          <button
            type="button"
            className={cn(
              "flex items-center justify-center p-0.5 rounded cursor-grab",
              "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300",
              "hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-brand-500",
              isDragging && "cursor-grabbing"
            )}
            aria-label={`Drag to reorder ${columnKey} column`}
            onClick={(e) => e.stopPropagation()} // Prevent sort trigger
            {...listeners}
          >
            <HiOutlineDotsVertical className="h-4 w-4" />
          </button>
        )}

        {/* Header Content */}
        <div className="flex-1">{children}</div>
      </div>
    </th>
  );
});

DraggableColumnHeader.displayName = "DraggableColumnHeader";

export default DraggableColumn;
