import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDataTablePreferencesStore,
  useTablePreferences,
  useColumnWidths,
  useColumnOrder,
  useSortConfig,
} from '../useDataTablePreferencesStore';

describe('useDataTablePreferencesStore', () => {
  const TABLE_ID = 'test-table';

  beforeEach(() => {
    // Reset store state between tests
    const store = useDataTablePreferencesStore.getState();
    store.resetPreferences(TABLE_ID);
  });

  describe('Column Order', () => {
    it('should return empty array for new table', () => {
      const { result } = renderHook(() => useColumnOrder(TABLE_ID));

      expect(result.current.columnOrder).toEqual([]);
    });

    it('should set column order', () => {
      const { result } = renderHook(() => useColumnOrder(TABLE_ID));
      const newOrder = ['col1', 'col2', 'col3'];

      act(() => {
        result.current.setColumnOrder(newOrder);
      });

      expect(result.current.columnOrder).toEqual(newOrder);
    });

    it('should persist column order between renders', () => {
      const { result: result1 } = renderHook(() => useColumnOrder(TABLE_ID));

      act(() => {
        result1.current.setColumnOrder(['col1', 'col2']);
      });

      // New hook instance should have same data
      const { result: result2 } = renderHook(() => useColumnOrder(TABLE_ID));
      expect(result2.current.columnOrder).toEqual(['col1', 'col2']);
    });
  });

  describe('Column Widths', () => {
    it('should return empty object for new table', () => {
      const { result } = renderHook(() => useColumnWidths(TABLE_ID));

      expect(result.current.columnWidths).toEqual({});
    });

    it('should set column width', () => {
      const { result } = renderHook(() => useColumnWidths(TABLE_ID));

      act(() => {
        result.current.setColumnWidth('name', 200);
      });

      expect(result.current.columnWidths).toEqual({ name: 200 });
    });

    it('should update multiple column widths', () => {
      const { result } = renderHook(() => useColumnWidths(TABLE_ID));

      act(() => {
        result.current.setColumnWidth('name', 200);
        result.current.setColumnWidth('age', 100);
        result.current.setColumnWidth('status', 150);
      });

      expect(result.current.columnWidths).toEqual({
        name: 200,
        age: 100,
        status: 150,
      });
    });

    it('should reset column widths', () => {
      const { result } = renderHook(() => useColumnWidths(TABLE_ID));

      act(() => {
        result.current.setColumnWidth('name', 200);
        result.current.setColumnWidth('age', 100);
      });

      act(() => {
        result.current.resetColumnWidths();
      });

      expect(result.current.columnWidths).toEqual({});
    });
  });

  describe('Sort Config', () => {
    it('should return empty array for new table', () => {
      const { result } = renderHook(() => useSortConfig(TABLE_ID));

      expect(result.current.sortConfig).toEqual([]);
    });

    it('should set sort config', () => {
      const { result } = renderHook(() => useSortConfig(TABLE_ID));
      const newConfig = [
        { field: 'name', direction: 'asc' as const, priority: 1 },
      ];

      act(() => {
        result.current.setSortConfig(newConfig);
      });

      expect(result.current.sortConfig).toEqual(newConfig);
    });

    it('should handle multi-column sort', () => {
      const { result } = renderHook(() => useSortConfig(TABLE_ID));
      const multiSort = [
        { field: 'name', direction: 'asc' as const, priority: 1 },
        { field: 'age', direction: 'desc' as const, priority: 2 },
      ];

      act(() => {
        result.current.setSortConfig(multiSort);
      });

      expect(result.current.sortConfig).toHaveLength(2);
      expect(result.current.sortConfig[0].field).toBe('name');
      expect(result.current.sortConfig[1].field).toBe('age');
    });

    it('should clear sort config', () => {
      const { result } = renderHook(() => useSortConfig(TABLE_ID));

      act(() => {
        result.current.setSortConfig([
          { field: 'name', direction: 'asc', priority: 1 },
        ]);
      });

      act(() => {
        result.current.clearSortConfig();
      });

      expect(result.current.sortConfig).toEqual([]);
    });
  });

  describe('Hidden Columns', () => {
    it('should start with no hidden columns', () => {
      const { result } = renderHook(() => useTablePreferences(TABLE_ID));

      expect(result.current.hiddenColumns).toEqual([]);
    });

    it('should hide columns', () => {
      const store = useDataTablePreferencesStore.getState();

      act(() => {
        store.setHiddenColumns(TABLE_ID, ['col1', 'col2']);
      });

      const { result } = renderHook(() => useTablePreferences(TABLE_ID));
      expect(result.current.hiddenColumns).toEqual(['col1', 'col2']);
    });
  });

  describe('useTablePreferences (combined)', () => {
    it('should return all preferences for a table', () => {
      const { result } = renderHook(() => useTablePreferences(TABLE_ID));

      expect(result.current).toHaveProperty('columnOrder');
      expect(result.current).toHaveProperty('columnWidths');
      expect(result.current).toHaveProperty('sortConfig');
      expect(result.current).toHaveProperty('hiddenColumns');
    });

    it('should return different preferences for different tables', () => {
      const store = useDataTablePreferencesStore.getState();

      act(() => {
        store.setColumnOrder('table1', ['a', 'b']);
        store.setColumnOrder('table2', ['x', 'y', 'z']);
      });

      const { result: result1 } = renderHook(() => useTablePreferences('table1'));
      const { result: result2 } = renderHook(() => useTablePreferences('table2'));

      expect(result1.current.columnOrder).toEqual(['a', 'b']);
      expect(result2.current.columnOrder).toEqual(['x', 'y', 'z']);
    });
  });

  describe('Reset Preferences', () => {
    it('should reset all preferences for a table', () => {
      const store = useDataTablePreferencesStore.getState();

      act(() => {
        store.setColumnOrder(TABLE_ID, ['col1', 'col2']);
        store.setColumnWidth(TABLE_ID, 'col1', 200);
        store.setSortConfig(TABLE_ID, [{ field: 'col1', direction: 'asc', priority: 1 }]);
      });

      act(() => {
        store.resetPreferences(TABLE_ID);
      });

      const { result } = renderHook(() => useTablePreferences(TABLE_ID));

      expect(result.current.columnOrder).toEqual([]);
      expect(result.current.columnWidths).toEqual({});
      expect(result.current.sortConfig).toEqual([]);
    });
  });
});
