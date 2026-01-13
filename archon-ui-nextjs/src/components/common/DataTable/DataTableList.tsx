"use client";

import { Checkbox } from "flowbite-react";
import {
  useDataTableContext,
  useSorting,
  useSelection,
  useFilteredData,
  useMultiSorting,
  useColumnOrder,
  useColumnWidths,
} from "./context/DataTableContext";
import { SortIndicator } from "./components";
import { RowActions } from "./components";
import { cn } from "@/lib/utils";

interface DataTableListProps {
  variant?: "table" | "list";
  /** Enable column resizing (default: true) */
  enableResize?: boolean;
  /** Enable column reordering (default: false - requires DnD wrapper) */
  enableReorder?: boolean;
  /** Enable multi-column sorting (default: true) */
  enableMultiSort?: boolean;
  /** Show primary action as button (default: true) */
  showPrimaryAction?: boolean;
  /** Resize mode: 'onChange' for real-time, 'onEnd' for on release */
  resizeMode?: "onChange" | "onEnd";
}

/**
 * DataTableList - Enhanced Table/List view component
 *
 * Renders data in a table format with:
 * - Sortable columns (single or multi-sort)
 * - Resizable column widths
 * - Row selection
 * - Row action buttons (primary action pattern)
 * - Responsive design
 */
export function DataTableList({
  variant = "table",
  enableResize = true,
  enableReorder = false,
  enableMultiSort = true,
  showPrimaryAction = true,
  resizeMode = "onChange",
}: DataTableListProps) {
  const { columns, rowButtons, keyExtractor, caption, enableSelection = true } = useDataTableContext();
  const filteredData = useFilteredData();

  // Use multi-sort if enabled, otherwise fall back to legacy sorting
  const {
    addSortColumn,
    getSortDirection: getMultiSortDirection,
    getSortPriority,
    hasMultiSort,
  } = useMultiSorting();

  const { toggleSort, getSortDirection: getLegacySortDirection } = useSorting();
  const { isSelected, toggleSelection, isAllSelected, toggleSelectAll } =
    useSelection();

  // Column order and widths
  const { orderedColumns } = useColumnOrder();
  const { columnWidths, setWidth, getColumnWidth } = useColumnWidths();

  const hasActions = !!rowButtons;
  const hasSelection = enableSelection; // Configurable via context

  // Determine which columns to render (use ordered if reorder enabled)
  const displayColumns = enableReorder ? orderedColumns : columns;

  // Helper function to start resize (used by both mouse and touch)
  const startResize = (
    startX: number,
    columnKey: string,
    minWidth?: number,
    maxWidth?: number
  ) => {
    const startWidth = getColumnWidth(columnKey, 150);
    const minW = minWidth ?? 50;
    const maxW = maxWidth ?? 500;

    const handleMove = (clientX: number) => {
      const delta = clientX - startX;
      const newWidth = Math.max(minW, Math.min(maxW, startWidth + delta));
      setWidth(columnKey, newWidth);
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // Handle sort click based on mode
  const handleSortClick = (columnKey: string, event?: React.MouseEvent) => {
    if (enableMultiSort) {
      // Multi-sort: Ctrl/Shift adds to sort, regular click replaces
      const isMultiSortKey = event?.ctrlKey || event?.metaKey || event?.shiftKey;
      if (isMultiSortKey) {
        addSortColumn(columnKey);
      } else {
        // Single click cycles: asc → desc → clear
        const currentDir = getMultiSortDirection(columnKey);
        if (!currentDir) {
          addSortColumn(columnKey, "asc");
        } else if (currentDir === "asc") {
          addSortColumn(columnKey, "desc");
        } else {
          // Clear - use legacy toggle which clears on third click
          toggleSort(columnKey);
        }
      }
    } else {
      toggleSort(columnKey);
    }
  };

  // Get sort direction (multi or legacy)
  const getSortDirection = enableMultiSort ? getMultiSortDirection : getLegacySortDirection;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
        {caption && <caption className="sr-only">{caption}</caption>}

        <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            {/* Selection Column */}
            {hasSelection && (
              <th scope="col" className="w-12 px-6 py-3">
                <Checkbox
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all rows"
                />
              </th>
            )}

            {/* Data Columns */}
            {displayColumns.map((column) => {
              const width = enableResize
                ? getColumnWidth(column.key, column.width ? parseInt(column.width) : 150)
                : column.width;

              const sortDirection = column.sortable ? getSortDirection(column.key) : null;
              const sortPriority = enableMultiSort && column.sortable
                ? getSortPriority(column.key)
                : null;

              return (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-6 py-3 transition-colors relative",
                    column.sortable && "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-600"
                  )}
                  style={{
                    width: typeof width === "number" ? `${width}px` : width,
                    minWidth: column.minWidth,
                    maxWidth: column.maxWidth,
                  }}
                  onClick={(e) => column.sortable && handleSortClick(column.key, e)}
                  onKeyDown={(e) => {
                    // Keyboard support for sorting: Enter or Space triggers sort
                    if (column.sortable && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      handleSortClick(column.key, e as unknown as React.MouseEvent);
                    }
                  }}
                  tabIndex={column.sortable ? 0 : undefined}
                  role={column.sortable ? "columnheader" : undefined}
                  aria-sort={
                    sortDirection === "asc"
                      ? "ascending"
                      : sortDirection === "desc"
                        ? "descending"
                        : undefined
                  }
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <SortIndicator
                        direction={sortDirection}
                        priority={sortPriority}
                        showPriority={enableMultiSort && hasMultiSort}
                      />
                    )}
                  </div>

                  {/* Resize handle - supports mouse, touch, and keyboard */}
                  {enableResize && column.resizable !== false && (
                    <div
                      className={cn(
                        "absolute right-0 top-0 h-full w-[5px] cursor-col-resize",
                        "bg-transparent hover:bg-brand-500/50 focus:bg-brand-500/50 transition-colors",
                        "after:absolute after:right-0 after:top-0 after:h-full after:w-[1px]",
                        "after:bg-gray-200 dark:after:bg-gray-600",
                        "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                      )}
                      style={{ touchAction: "none" }}
                      role="separator"
                      aria-label={`Resize ${column.label} column`}
                      aria-orientation="vertical"
                      tabIndex={0}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startResize(e.clientX, column.key, column.minWidth, column.maxWidth);
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const touch = e.touches[0];
                        startResize(touch.clientX, column.key, column.minWidth, column.maxWidth);
                      }}
                      onKeyDown={(e) => {
                        // Keyboard resize: Arrow keys adjust width by 10px
                        const currentW = getColumnWidth(column.key, 150);
                        const minW = column.minWidth ?? 50;
                        const maxW = column.maxWidth ?? 500;
                        const step = e.shiftKey ? 50 : 10;

                        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                          e.preventDefault();
                          setWidth(column.key, Math.min(maxW, currentW + step));
                        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                          e.preventDefault();
                          setWidth(column.key, Math.max(minW, currentW - step));
                        } else if (e.key === "Home") {
                          e.preventDefault();
                          setWidth(column.key, 150); // Reset to default
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        // Reset to default width
                        setWidth(column.key, 150);
                      }}
                      title="Drag to resize • Double-click to reset • Use arrow keys for keyboard resize"
                    />
                  )}
                </th>
              );
            })}

            {/* Actions Column */}
            {hasActions && (
              <th scope="col" className="px-6 py-3 text-right">
                Actions
              </th>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredData.map((item) => {
            const itemKey = keyExtractor?.(item) || String(item);
            const actions = rowButtons?.(item) || [];

            return (
              <tr
                key={itemKey}
                className={cn(
                  "transition-colors",
                  isSelected(itemKey)
                    ? "bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/30"
                    : "bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                )}
              >
                {/* Selection Cell */}
                {hasSelection && (
                  <td className="px-6 py-4">
                    <Checkbox
                      checked={isSelected(itemKey)}
                      onChange={(e) => {
                        const shiftKey = (e.nativeEvent as MouseEvent).shiftKey;
                        toggleSelection(itemKey, shiftKey);
                      }}
                      aria-label={`Select row ${itemKey}`}
                      title="Click to select, Shift+Click to select range"
                    />
                  </td>
                )}

                {/* Data Cells */}
                {displayColumns.map((column) => {
                  const value = (item as any)[column.key];
                  const width = enableResize
                    ? getColumnWidth(column.key, column.width ? parseInt(column.width) : 150)
                    : column.width;

                  return (
                    <td
                      key={column.key}
                      className="px-6 py-4"
                      style={{
                        width: typeof width === "number" ? `${width}px` : width,
                      }}
                    >
                      {column.render ? column.render(value, item) : value}
                    </td>
                  );
                })}

                {/* Actions Cell - Primary action pattern */}
                {hasActions && (
                  <td className="px-6 py-4">
                    <RowActions
                      actions={actions}
                      showPrimary={showPrimaryAction}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
