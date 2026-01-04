"use client";

import React, { FC, memo } from "react";
import { cn } from "@/lib/utils";
import { useColumnResize } from "../hooks/useColumnResize";
import { DataTableColumn } from "../context/DataTableContext";

/**
 * ResizableHeader Component
 *
 * A table header cell with a resize handle on the right edge.
 * Following TanStack Table patterns for column resizing.
 *
 * Features:
 * - 5px resize handle on right edge
 * - Visual feedback during resize (brand color highlight)
 * - Double-click to reset to default width
 * - Touch support for mobile devices
 * - Keyboard accessible (tab + arrow keys)
 */

export interface ResizableHeaderProps {
  /** Column configuration */
  column: DataTableColumn;
  /** Current column width in pixels */
  width: number;
  /** Callback when width changes */
  onWidthChange: (columnKey: string, width: number) => void;
  /** Resize mode: 'onChange' for real-time, 'onEnd' for on release */
  resizeMode?: "onChange" | "onEnd";
  /** Children (header content) */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Whether sorting is active on this column */
  isSorted?: boolean;
  /** Click handler for sorting */
  onClick?: () => void;
}

const ResizableHeader: FC<ResizableHeaderProps> = memo(({
  column,
  width,
  onWidthChange,
  resizeMode = "onChange",
  children,
  className,
  isSorted,
  onClick,
}) => {
  const canResize = column.resizable !== false;
  const minWidth = column.minWidth ?? 50;
  const maxWidth = column.maxWidth ?? 500;

  const { isResizing, currentWidth, getResizeProps } = useColumnResize({
    columnKey: column.key,
    initialWidth: width,
    minWidth,
    maxWidth,
    resizeMode,
    onResize: onWidthChange,
  });

  const resizeProps = canResize ? getResizeProps() : null;

  return (
    <th
      scope="col"
      style={{ width: `${currentWidth}px`, position: "relative" }}
      className={cn(
        "px-6 py-3 transition-colors",
        column.sortable && "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-600",
        isResizing && "select-none",
        className
      )}
      onClick={column.sortable && !isResizing ? onClick : undefined}
    >
      {/* Header content */}
      <div className="flex items-center gap-2">
        {children}
      </div>

      {/* Resize handle */}
      {canResize && resizeProps && (
        <div
          {...resizeProps}
          className={cn(
            "absolute right-0 top-0 h-full w-[5px] cursor-col-resize",
            "bg-transparent hover:bg-brand-500/50 transition-colors",
            "after:absolute after:right-0 after:top-0 after:h-full after:w-[1px]",
            "after:bg-gray-200 dark:after:bg-gray-600",
            isResizing && "bg-brand-500"
          )}
          style={{
            ...resizeProps.style,
            touchAction: "none",
          }}
          title="Drag to resize • Double-click to reset"
        />
      )}
    </th>
  );
});

ResizableHeader.displayName = "ResizableHeader";

export default ResizableHeader;
