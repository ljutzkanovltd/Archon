"use client";

import React, { createContext, useContext, useState, useMemo, useCallback } from "react";

/**
 * DataTable Context System - Three-Layer Architecture
 *
 * Layer 1: Props Context - Immutable configuration passed from parent
 * Layer 2: State Context - Mutable state managed within DataTable
 * Layer 3: Combined Context - Merged props + state for easy consumption
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FilterValue {
  field: string;
  operator: "equals" | "contains" | "startsWith" | "endsWith" | "in" | "between";
  value: any;
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

export interface PaginationConfig {
  page: number;
  per_page: number;
  total: number;
}

export interface DataTableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: any, item: T) => React.ReactNode;
}

export interface DataTableButton {
  label: string;
  icon?: React.ComponentType<any>;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  ariaLabel?: string; // Accessibility: Descriptive label for screen readers
}

// View mode type - centralized for consistency
export type ViewMode = "table" | "list" | "grid" | "kanban" | "custom";

// Layer 1: Props Context (Immutable)
export interface DataTablePropsContext<T = any> {
  columns: DataTableColumn<T>[];
  data: T[];
  tableButtons?: DataTableButton[];
  rowButtons?: (item: T) => DataTableButton[];
  emptyMessage?: string;
  caption?: string; // Accessibility: Table caption for screen readers
  viewMode?: ViewMode;
  customRender?: (item: T) => React.ReactNode;
  keyExtractor?: (item: T) => string;
  // Kanban-specific props
  kanbanGroupBy?: string; // Field to group by (e.g., "status")
  kanbanColumns?: { key: string; label: string; color?: string }[];
  onKanbanDrop?: (itemId: string, newValue: string) => void;
}

// Layer 2: State Context (Mutable)
export interface DataTableStateContext {
  // Pagination
  pagination: PaginationConfig;
  setPagination: (config: Partial<PaginationConfig>) => void;

  // Filtering
  filters: FilterValue[];
  addFilter: (filter: FilterValue) => void;
  removeFilter: (field: string) => void;
  clearFilters: () => void;

  // Sorting
  sort: SortConfig | null;
  setSort: (config: SortConfig | null) => void;

  // Selection
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  isAllSelected: boolean;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // View Mode
  currentViewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

// Layer 3: Combined Context
export type DataTableContext<T = any> = DataTablePropsContext<T> &
  DataTableStateContext;

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const DataTablePropsCtx = createContext<DataTablePropsContext | undefined>(
  undefined
);
const DataTableStateCtx = createContext<DataTableStateContext | undefined>(
  undefined
);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface DataTableProviderProps<T = any> {
  children: React.ReactNode;
  columns: DataTableColumn<T>[];
  data: T[];
  tableButtons?: DataTableButton[];
  rowButtons?: (item: T) => DataTableButton[];
  emptyMessage?: string;
  caption?: string;
  viewMode?: ViewMode;
  customRender?: (item: T) => React.ReactNode;
  keyExtractor?: (item: T) => string;
  initialPagination?: Partial<PaginationConfig>;
  // Kanban-specific props
  kanbanGroupBy?: string;
  kanbanColumns?: { key: string; label: string; color?: string }[];
  onKanbanDrop?: (itemId: string, newValue: string) => void;
}

export function DataTableProvider<T = any>({
  children,
  columns,
  data,
  tableButtons,
  rowButtons,
  emptyMessage = "No data available",
  caption,
  viewMode = "table",
  customRender,
  keyExtractor = (item: any) => item.id || String(item),
  initialPagination,
  kanbanGroupBy,
  kanbanColumns,
  onKanbanDrop,
}: DataTableProviderProps<T>) {
  // ========== STATE MANAGEMENT ==========

  // Pagination
  const [pagination, setPaginationState] = useState<PaginationConfig>({
    page: initialPagination?.page || 1,
    per_page: initialPagination?.per_page || 10,
    total: initialPagination?.total || (data || []).length,
  });

  const setPagination = useCallback((config: Partial<PaginationConfig>) => {
    setPaginationState((prev) => ({ ...prev, ...config }));
  }, []);

  // Filtering
  const [filters, setFilters] = useState<FilterValue[]>([]);

  const addFilter = useCallback((filter: FilterValue) => {
    setFilters((prev) => {
      // Remove existing filter for same field
      const filtered = prev.filter((f) => f.field !== filter.field);
      return [...filtered, filter];
    });
  }, []);

  const removeFilter = useCallback((field: string) => {
    setFilters((prev) => prev.filter((f) => f.field !== field));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  // Sorting
  const [sort, setSort] = useState<SortConfig | null>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    },
    []
  );

  const toggleSelectAll = useCallback(() => {
    const safeData = data || [];
    if (selectedIds.size === safeData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(safeData.map(keyExtractor)));
    }
  }, [selectedIds.size, data, keyExtractor]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const isAllSelected = useMemo(
    () => {
      const safeData = data || [];
      return safeData.length > 0 && selectedIds.size === safeData.length;
    },
    [data, selectedIds.size]
  );

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // View Mode
  const [currentViewMode, setViewMode] = useState<ViewMode>(viewMode);

  // ========== CONTEXT VALUES ==========

  const propsValue: DataTablePropsContext<T> = useMemo(
    () => ({
      columns,
      data,
      tableButtons,
      rowButtons,
      emptyMessage,
      caption,
      viewMode,
      customRender,
      keyExtractor,
      kanbanGroupBy,
      kanbanColumns,
      onKanbanDrop,
    }),
    [columns, data, tableButtons, rowButtons, emptyMessage, caption, viewMode, customRender, keyExtractor, kanbanGroupBy, kanbanColumns, onKanbanDrop]
  );

  const stateValue: DataTableStateContext = useMemo(
    () => ({
      pagination,
      setPagination,
      filters,
      addFilter,
      removeFilter,
      clearFilters,
      sort,
      setSort,
      selectedIds,
      toggleSelection,
      toggleSelectAll,
      clearSelection,
      isSelected,
      isAllSelected,
      searchQuery,
      setSearchQuery,
      currentViewMode,
      setViewMode,
    }),
    [
      pagination,
      setPagination,
      filters,
      addFilter,
      removeFilter,
      clearFilters,
      sort,
      selectedIds,
      toggleSelection,
      toggleSelectAll,
      clearSelection,
      isSelected,
      isAllSelected,
      searchQuery,
      currentViewMode,
    ]
  );

  return (
    <DataTablePropsCtx.Provider value={propsValue}>
      <DataTableStateCtx.Provider value={stateValue}>
        {children}
      </DataTableStateCtx.Provider>
    </DataTablePropsCtx.Provider>
  );
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Combined context hook - Most common use case
 */
export function useDataTableContext<T = any>(): DataTableContext<T> {
  const props = useContext(DataTablePropsCtx);
  const state = useContext(DataTableStateCtx);

  if (!props || !state) {
    throw new Error(
      "useDataTableContext must be used within a DataTableProvider"
    );
  }

  return { ...props, ...state } as DataTableContext<T>;
}

/**
 * Props-only hook - For read-only configuration access
 */
export function useDataTableProps<T = any>(): DataTablePropsContext<T> {
  const context = useContext(DataTablePropsCtx);
  if (!context) {
    throw new Error(
      "useDataTableProps must be used within a DataTableProvider"
    );
  }
  return context as DataTablePropsContext<T>;
}

/**
 * State-only hook - For state management access
 */
export function useDataTableState(): DataTableStateContext {
  const context = useContext(DataTableStateCtx);
  if (!context) {
    throw new Error(
      "useDataTableState must be used within a DataTableProvider"
    );
  }
  return context;
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * Pagination hook
 */
export function usePagination() {
  const { pagination, setPagination } = useDataTableState();

  const nextPage = useCallback(() => {
    const maxPage = Math.ceil(pagination.total / pagination.per_page);
    if (pagination.page < maxPage) {
      setPagination({ page: pagination.page + 1 });
    }
  }, [pagination, setPagination]);

  const prevPage = useCallback(() => {
    if (pagination.page > 1) {
      setPagination({ page: pagination.page - 1 });
    }
  }, [pagination, setPagination]);

  const goToPage = useCallback(
    (page: number) => {
      const maxPage = Math.ceil(pagination.total / pagination.per_page);
      if (page >= 1 && page <= maxPage) {
        setPagination({ page });
      }
    },
    [pagination, setPagination]
  );

  const setPerPage = useCallback(
    (per_page: number) => {
      setPagination({ per_page, page: 1 }); // Reset to page 1 when changing per_page
    },
    [setPagination]
  );

  return {
    ...pagination,
    nextPage,
    prevPage,
    goToPage,
    setPerPage,
    hasNext: pagination.page < Math.ceil(pagination.total / pagination.per_page),
    hasPrev: pagination.page > 1,
  };
}

/**
 * Filtering hook
 */
export function useFiltering() {
  const { filters, addFilter, removeFilter, clearFilters } =
    useDataTableState();

  const hasFilters = filters.length > 0;

  const getFilter = useCallback(
    (field: string) => filters.find((f) => f.field === field),
    [filters]
  );

  return {
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    hasFilters,
    getFilter,
  };
}

/**
 * Sorting hook
 */
export function useSorting() {
  const { sort, setSort } = useDataTableState();

  const toggleSort = useCallback(
    (field: string) => {
      if (!sort || sort.field !== field) {
        setSort({ field, direction: "asc" });
      } else if (sort.direction === "asc") {
        setSort({ field, direction: "desc" });
      } else {
        setSort(null); // Clear sort
      }
    },
    [sort, setSort]
  );

  const isSorted = useCallback(
    (field: string) => sort?.field === field,
    [sort]
  );

  const getSortDirection = useCallback(
    (field: string) => (sort?.field === field ? sort.direction : null),
    [sort]
  );

  return {
    sort,
    setSort,
    toggleSort,
    isSorted,
    getSortDirection,
  };
}

/**
 * Selection hook
 */
export function useSelection() {
  const {
    selectedIds,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    isSelected,
    isAllSelected,
  } = useDataTableState();

  const selectedCount = selectedIds.size;

  return {
    selectedIds,
    selectedCount,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    hasSelection: selectedCount > 0,
  };
}

/**
 * Filtered & Sorted Data hook
 * Returns processed data after applying search, filters, and sorting
 */
export function useFilteredData<T = any>() {
  const { data, columns } = useDataTableProps<T>();
  const { searchQuery, sort, filters } = useDataTableState();

  return useMemo(() => {
    let processedData = [...(data || [])];

    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();

      processedData = processedData.filter((item) => {
        // Search across all columns
        return columns.some((column) => {
          const value = (item as any)[column.key];

          if (value === null || value === undefined) {
            return false;
          }

          // Convert value to string and search
          const stringValue = String(value).toLowerCase();
          return stringValue.includes(query);
        });
      });
    }

    // Apply filters
    if (filters && filters.length > 0) {
      processedData = processedData.filter((item) => {
        return filters.every((filter) => {
          const value = (item as any)[filter.field];

          // Handle null/undefined values
          if (value === null || value === undefined) {
            return false;
          }

          if (filter.operator === "equals") {
            // Special handling for boolean values
            if (typeof value === "boolean") {
              return value === (filter.value === "true" || filter.value === true);
            }
            return String(value).toLowerCase() === String(filter.value).toLowerCase();
          }

          if (filter.operator === "contains") {
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          }

          if (filter.operator === "startsWith") {
            return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
          }

          if (filter.operator === "endsWith") {
            return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
          }

          if (filter.operator === "in") {
            // For multiselect filters
            if (Array.isArray(filter.value)) {
              return filter.value.includes(String(value));
            }
            return true;
          }

          if (filter.operator === "between") {
            // For date range filters
            if (filter.value && typeof filter.value === "object" && "from" in filter.value && "to" in filter.value) {
              const itemDate = new Date(value).getTime();
              const fromDate = filter.value.from ? new Date(filter.value.from).getTime() : -Infinity;
              const toDate = filter.value.to ? new Date(filter.value.to).getTime() : Infinity;
              return itemDate >= fromDate && itemDate <= toDate;
            }
            return true;
          }

          return true;
        });
      });
    }

    // Apply sorting
    if (sort) {
      processedData.sort((a, b) => {
        const aValue = (a as any)[sort.field];
        const bValue = (b as any)[sort.field];

        // Handle null/undefined
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // Compare values
        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          // Fallback: convert to string and compare
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sort.direction === 'asc' ? comparison : -comparison;
      });
    }

    return processedData;
  }, [data, columns, searchQuery, sort, filters]);
}
