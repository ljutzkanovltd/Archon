"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * DataTable Preferences Store
 *
 * Persists user preferences for table columns per tableId:
 * - Column widths (resizable)
 * - Column order (reorderable)
 * - Hidden columns (visibility toggle)
 * - Sort configuration (multi-sort)
 *
 * Pattern: Zustand + persist middleware (same as useSettingsStore)
 * Storage: localStorage with key 'archon-datatable-preferences'
 */

// ============================================================================
// TYPES
// ============================================================================

export interface MultiSortConfig {
  field: string;
  direction: "asc" | "desc";
  priority: number; // 1, 2, 3... for display order
}

export interface TablePreferences {
  columnOrder: string[];
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
  sortConfig: MultiSortConfig[];
}

interface DataTablePreferencesState {
  // State: keyed by tableId
  tables: Record<string, TablePreferences>;

  // Actions
  getPreferences: (tableId: string) => TablePreferences | null;
  savePreferences: (tableId: string, prefs: Partial<TablePreferences>) => void;

  // Column widths
  setColumnWidth: (tableId: string, columnKey: string, width: number) => void;
  resetColumnWidths: (tableId: string) => void;

  // Column order
  setColumnOrder: (tableId: string, order: string[]) => void;
  moveColumn: (tableId: string, fromIndex: number, toIndex: number) => void;
  resetColumnOrder: (tableId: string) => void;

  // Column visibility
  toggleColumnVisibility: (tableId: string, columnKey: string) => void;
  setHiddenColumns: (tableId: string, hidden: string[]) => void;

  // Sort configuration
  setSortConfig: (tableId: string, config: MultiSortConfig[]) => void;
  addSortColumn: (tableId: string, field: string, direction?: "asc" | "desc") => void;
  removeSortColumn: (tableId: string, field: string) => void;
  clearSort: (tableId: string) => void;

  // Reset
  resetPreferences: (tableId: string) => void;
  clearAllPreferences: () => void;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_PREFERENCES: TablePreferences = {
  columnOrder: [],
  columnWidths: {},
  hiddenColumns: [],
  sortConfig: [],
};

// ============================================================================
// STORE
// ============================================================================

export const useDataTablePreferencesStore = create<DataTablePreferencesState>()(
  persist(
    (set, get) => ({
      tables: {},

      // ========== GETTERS ==========

      getPreferences: (tableId: string) => {
        return get().tables[tableId] || null;
      },

      savePreferences: (tableId: string, prefs: Partial<TablePreferences>) => {
        set((state) => ({
          tables: {
            ...state.tables,
            [tableId]: {
              ...DEFAULT_PREFERENCES,
              ...state.tables[tableId],
              ...prefs,
            },
          },
        }));
      },

      // ========== COLUMN WIDTHS ==========

      setColumnWidth: (tableId: string, columnKey: string, width: number) => {
        set((state) => {
          const current = state.tables[tableId] || DEFAULT_PREFERENCES;
          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                columnWidths: {
                  ...current.columnWidths,
                  [columnKey]: width,
                },
              },
            },
          };
        });
      },

      resetColumnWidths: (tableId: string) => {
        set((state) => {
          const current = state.tables[tableId];
          if (!current) return state;
          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                columnWidths: {},
              },
            },
          };
        });
      },

      // ========== COLUMN ORDER ==========

      setColumnOrder: (tableId: string, order: string[]) => {
        set((state) => {
          const current = state.tables[tableId] || DEFAULT_PREFERENCES;
          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                columnOrder: order,
              },
            },
          };
        });
      },

      moveColumn: (tableId: string, fromIndex: number, toIndex: number) => {
        set((state) => {
          const current = state.tables[tableId];
          if (!current || current.columnOrder.length === 0) return state;

          const newOrder = [...current.columnOrder];
          const [moved] = newOrder.splice(fromIndex, 1);
          newOrder.splice(toIndex, 0, moved);

          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                columnOrder: newOrder,
              },
            },
          };
        });
      },

      resetColumnOrder: (tableId: string) => {
        set((state) => {
          const current = state.tables[tableId];
          if (!current) return state;
          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                columnOrder: [],
              },
            },
          };
        });
      },

      // ========== COLUMN VISIBILITY ==========

      toggleColumnVisibility: (tableId: string, columnKey: string) => {
        set((state) => {
          const current = state.tables[tableId] || DEFAULT_PREFERENCES;
          const hiddenColumns = current.hiddenColumns.includes(columnKey)
            ? current.hiddenColumns.filter((k) => k !== columnKey)
            : [...current.hiddenColumns, columnKey];

          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                hiddenColumns,
              },
            },
          };
        });
      },

      setHiddenColumns: (tableId: string, hidden: string[]) => {
        set((state) => {
          const current = state.tables[tableId] || DEFAULT_PREFERENCES;
          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                hiddenColumns: hidden,
              },
            },
          };
        });
      },

      // ========== SORT CONFIGURATION ==========

      setSortConfig: (tableId: string, config: MultiSortConfig[]) => {
        set((state) => {
          const current = state.tables[tableId] || DEFAULT_PREFERENCES;
          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                sortConfig: config,
              },
            },
          };
        });
      },

      addSortColumn: (tableId: string, field: string, direction: "asc" | "desc" = "asc") => {
        set((state) => {
          const current = state.tables[tableId] || DEFAULT_PREFERENCES;
          const existing = current.sortConfig.find((s) => s.field === field);

          let newConfig: MultiSortConfig[];

          if (existing) {
            // Toggle direction if already sorted
            newConfig = current.sortConfig.map((s) =>
              s.field === field
                ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" }
                : s
            );
          } else {
            // Add new sort column (max 3)
            if (current.sortConfig.length >= 3) {
              // Remove oldest, add new
              newConfig = [
                ...current.sortConfig.slice(1).map((s) => ({
                  ...s,
                  priority: s.priority - 1,
                })),
                { field, direction, priority: 3 },
              ];
            } else {
              newConfig = [
                ...current.sortConfig,
                { field, direction, priority: current.sortConfig.length + 1 },
              ];
            }
          }

          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                sortConfig: newConfig,
              },
            },
          };
        });
      },

      removeSortColumn: (tableId: string, field: string) => {
        set((state) => {
          const current = state.tables[tableId];
          if (!current) return state;

          const newConfig = current.sortConfig
            .filter((s) => s.field !== field)
            .map((s, index) => ({ ...s, priority: index + 1 }));

          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                sortConfig: newConfig,
              },
            },
          };
        });
      },

      clearSort: (tableId: string) => {
        set((state) => {
          const current = state.tables[tableId];
          if (!current) return state;
          return {
            tables: {
              ...state.tables,
              [tableId]: {
                ...current,
                sortConfig: [],
              },
            },
          };
        });
      },

      // ========== RESET ==========

      resetPreferences: (tableId: string) => {
        set((state) => {
          const { [tableId]: _, ...rest } = state.tables;
          return { tables: rest };
        });
      },

      clearAllPreferences: () => {
        set({ tables: {} });
      },
    }),
    {
      name: 'archon-datatable-preferences',
      partialize: (state) => ({ tables: state.tables }),
    }
  )
);

// ============================================================================
// SELECTOR HOOKS (for performance optimization)
// ============================================================================

/**
 * Hook to get preferences for a specific table
 * Returns null if no preferences exist (use defaults)
 */
export function useTablePreferences(tableId: string | undefined) {
  return useDataTablePreferencesStore((state) =>
    tableId ? state.tables[tableId] || null : null
  );
}

/**
 * Hook to get column widths for a specific table
 */
export function useColumnWidths(tableId: string | undefined) {
  return useDataTablePreferencesStore((state) =>
    tableId ? state.tables[tableId]?.columnWidths || {} : {}
  );
}

/**
 * Hook to get column order for a specific table
 */
export function useColumnOrder(tableId: string | undefined) {
  return useDataTablePreferencesStore((state) =>
    tableId ? state.tables[tableId]?.columnOrder || [] : []
  );
}

/**
 * Hook to get sort config for a specific table
 */
export function useSortConfig(tableId: string | undefined) {
  return useDataTablePreferencesStore((state) =>
    tableId ? state.tables[tableId]?.sortConfig || [] : []
  );
}
