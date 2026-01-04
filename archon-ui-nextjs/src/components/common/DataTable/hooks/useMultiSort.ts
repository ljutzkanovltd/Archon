"use client";

import { useCallback, useMemo } from "react";
import { MultiSortConfig } from "@/store/useDataTablePreferencesStore";

/**
 * useMultiSort Hook
 *
 * Provides multi-column sorting functionality with priority management.
 * Supports up to 3 sort columns by default.
 *
 * Sorting behavior:
 * - Click: Toggle single column (asc → desc → clear)
 * - Ctrl+Click: Add column to multi-sort
 * - Shift+Click: Add column to multi-sort (alternative)
 *
 * @example
 * const { sortConfig, handleSortClick, getSortDirection, getSortPriority } = useMultiSort({
 *   sortConfig: [],
 *   onSortChange: (newConfig) => setSortConfig(newConfig),
 *   maxSortColumns: 3,
 * });
 */

export interface UseMultiSortOptions {
  /** Current sort configuration */
  sortConfig: MultiSortConfig[];
  /** Callback when sort changes */
  onSortChange: (config: MultiSortConfig[]) => void;
  /** Maximum number of sort columns (default: 3) */
  maxSortColumns?: number;
}

export interface UseMultiSortReturn {
  /** Current sort configuration */
  sortConfig: MultiSortConfig[];
  /** Handle click on sortable column header */
  handleSortClick: (field: string, event?: React.MouseEvent) => void;
  /** Add a sort column programmatically */
  addSortColumn: (field: string, direction?: "asc" | "desc") => void;
  /** Remove a sort column */
  removeSortColumn: (field: string) => void;
  /** Clear all sorting */
  clearSort: () => void;
  /** Get sort direction for a column */
  getSortDirection: (field: string) => "asc" | "desc" | null;
  /** Get sort priority for a column (1, 2, 3 or null) */
  getSortPriority: (field: string) => number | null;
  /** Check if a column is sorted */
  isSorted: (field: string) => boolean;
  /** Check if multi-sort is active */
  isMultiSortActive: boolean;
  /** Number of active sort columns */
  sortCount: number;
}

export function useMultiSort({
  sortConfig,
  onSortChange,
  maxSortColumns = 3,
}: UseMultiSortOptions): UseMultiSortReturn {

  // Check if multi-sort is active
  const isMultiSortActive = sortConfig.length > 1;
  const sortCount = sortConfig.length;

  // Get sort direction for a field
  const getSortDirection = useCallback(
    (field: string): "asc" | "desc" | null => {
      const config = sortConfig.find((s) => s.field === field);
      return config?.direction ?? null;
    },
    [sortConfig]
  );

  // Get sort priority for a field
  const getSortPriority = useCallback(
    (field: string): number | null => {
      const config = sortConfig.find((s) => s.field === field);
      return config?.priority ?? null;
    },
    [sortConfig]
  );

  // Check if a field is sorted
  const isSorted = useCallback(
    (field: string): boolean => {
      return sortConfig.some((s) => s.field === field);
    },
    [sortConfig]
  );

  // Add a sort column
  const addSortColumn = useCallback(
    (field: string, direction: "asc" | "desc" = "asc") => {
      const existing = sortConfig.find((s) => s.field === field);

      if (existing) {
        // Toggle direction
        const newDirection = existing.direction === "asc" ? "desc" : "asc";
        onSortChange(
          sortConfig.map((s) =>
            s.field === field ? { ...s, direction: newDirection } : s
          )
        );
      } else if (sortConfig.length < maxSortColumns) {
        // Add new sort column
        onSortChange([
          ...sortConfig,
          { field, direction, priority: sortConfig.length + 1 },
        ]);
      } else {
        // At max columns - remove oldest, add new
        onSortChange([
          ...sortConfig.slice(1).map((s) => ({ ...s, priority: s.priority - 1 })),
          { field, direction, priority: maxSortColumns },
        ]);
      }
    },
    [sortConfig, onSortChange, maxSortColumns]
  );

  // Remove a sort column
  const removeSortColumn = useCallback(
    (field: string) => {
      const filtered = sortConfig.filter((s) => s.field !== field);
      // Re-assign priorities
      const reordered = filtered.map((s, index) => ({
        ...s,
        priority: index + 1,
      }));
      onSortChange(reordered);
    },
    [sortConfig, onSortChange]
  );

  // Clear all sorting
  const clearSort = useCallback(() => {
    onSortChange([]);
  }, [onSortChange]);

  // Handle click on sortable column header
  const handleSortClick = useCallback(
    (field: string, event?: React.MouseEvent) => {
      const isMultiSortKey = event?.ctrlKey || event?.metaKey || event?.shiftKey;
      const existing = sortConfig.find((s) => s.field === field);

      if (isMultiSortKey) {
        // Multi-sort mode: add/toggle column
        if (existing) {
          if (existing.direction === "asc") {
            // Toggle to desc
            onSortChange(
              sortConfig.map((s) =>
                s.field === field ? { ...s, direction: "desc" as const } : s
              )
            );
          } else {
            // Remove from sort
            removeSortColumn(field);
          }
        } else {
          // Add to sort
          addSortColumn(field);
        }
      } else {
        // Single-sort mode: replace all
        if (existing) {
          if (existing.direction === "asc") {
            // Toggle to desc
            onSortChange([{ field, direction: "desc", priority: 1 }]);
          } else {
            // Clear sort
            onSortChange([]);
          }
        } else {
          // Set as only sort
          onSortChange([{ field, direction: "asc", priority: 1 }]);
        }
      }
    },
    [sortConfig, onSortChange, addSortColumn, removeSortColumn]
  );

  return {
    sortConfig,
    handleSortClick,
    addSortColumn,
    removeSortColumn,
    clearSort,
    getSortDirection,
    getSortPriority,
    isSorted,
    isMultiSortActive,
    sortCount,
  };
}

/**
 * Apply multi-sort to data array
 * Utility function for client-side sorting
 */
export function applyMultiSort<T>(
  data: T[],
  sortConfig: MultiSortConfig[]
): T[] {
  if (sortConfig.length === 0) return data;

  // Sort by priority (1 is highest priority)
  const sortedConfig = [...sortConfig].sort((a, b) => a.priority - b.priority);

  return [...data].sort((a, b) => {
    for (const config of sortedConfig) {
      const aValue = (a as any)[config.field];
      const bValue = (b as any)[config.field];

      // Handle null/undefined
      if (aValue === null || aValue === undefined) {
        if (bValue === null || bValue === undefined) continue;
        return 1;
      }
      if (bValue === null || bValue === undefined) return -1;

      // Compare values
      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      if (comparison !== 0) {
        return config.direction === "asc" ? comparison : -comparison;
      }
    }
    return 0;
  });
}

export default useMultiSort;
