import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiSort, applyMultiSort } from '../hooks/useMultiSort';
import { MultiSortConfig } from '@/store/useDataTablePreferencesStore';

describe('useMultiSort Hook', () => {
  const createTestHook = (initialConfig: MultiSortConfig[] = []) => {
    let sortConfig = initialConfig;
    const onSortChange = vi.fn((newConfig: MultiSortConfig[]) => {
      sortConfig = newConfig;
    });

    const { result, rerender } = renderHook(() =>
      useMultiSort({
        sortConfig,
        onSortChange,
        maxSortColumns: 3,
      })
    );

    return { result, rerender, onSortChange, getSortConfig: () => sortConfig };
  };

  describe('Initial State', () => {
    it('should return empty state when no sort config', () => {
      const { result } = createTestHook([]);

      expect(result.current.sortConfig).toEqual([]);
      expect(result.current.isMultiSortActive).toBe(false);
      expect(result.current.sortCount).toBe(0);
    });

    it('should return initial sort config', () => {
      const initialConfig: MultiSortConfig[] = [
        { field: 'name', direction: 'asc', priority: 1 },
      ];
      const { result } = createTestHook(initialConfig);

      expect(result.current.sortConfig).toEqual(initialConfig);
      expect(result.current.isMultiSortActive).toBe(false); // Single sort is not "multi"
      expect(result.current.sortCount).toBe(1);
    });

    it('should detect multi-sort active', () => {
      const initialConfig: MultiSortConfig[] = [
        { field: 'name', direction: 'asc', priority: 1 },
        { field: 'age', direction: 'desc', priority: 2 },
      ];
      const { result } = createTestHook(initialConfig);

      expect(result.current.isMultiSortActive).toBe(true);
      expect(result.current.sortCount).toBe(2);
    });
  });

  describe('addSortColumn', () => {
    it('should add a new sort column', () => {
      const { result, onSortChange } = createTestHook([]);

      act(() => {
        result.current.addSortColumn('name');
      });

      expect(onSortChange).toHaveBeenCalledWith([
        { field: 'name', direction: 'asc', priority: 1 },
      ]);
    });

    it('should toggle direction on existing sort column', () => {
      const { result, onSortChange } = createTestHook([
        { field: 'name', direction: 'asc', priority: 1 },
      ]);

      act(() => {
        result.current.addSortColumn('name');
      });

      expect(onSortChange).toHaveBeenCalledWith([
        { field: 'name', direction: 'desc', priority: 1 },
      ]);
    });

    it('should respect maxSortColumns limit', () => {
      const initialConfig: MultiSortConfig[] = [
        { field: 'name', direction: 'asc', priority: 1 },
        { field: 'age', direction: 'desc', priority: 2 },
        { field: 'status', direction: 'asc', priority: 3 },
      ];
      const { result, onSortChange } = createTestHook(initialConfig);

      act(() => {
        result.current.addSortColumn('score');
      });

      // Should remove oldest (name) and add new (score)
      expect(onSortChange).toHaveBeenCalledWith([
        { field: 'age', direction: 'desc', priority: 1 },
        { field: 'status', direction: 'asc', priority: 2 },
        { field: 'score', direction: 'asc', priority: 3 },
      ]);
    });
  });

  describe('removeSortColumn', () => {
    it('should remove a sort column', () => {
      const initialConfig: MultiSortConfig[] = [
        { field: 'name', direction: 'asc', priority: 1 },
        { field: 'age', direction: 'desc', priority: 2 },
      ];
      const { result, onSortChange } = createTestHook(initialConfig);

      act(() => {
        result.current.removeSortColumn('name');
      });

      expect(onSortChange).toHaveBeenCalledWith([
        { field: 'age', direction: 'desc', priority: 1 },
      ]);
    });
  });

  describe('clearSort', () => {
    it('should clear all sort columns', () => {
      const initialConfig: MultiSortConfig[] = [
        { field: 'name', direction: 'asc', priority: 1 },
        { field: 'age', direction: 'desc', priority: 2 },
      ];
      const { result, onSortChange } = createTestHook(initialConfig);

      act(() => {
        result.current.clearSort();
      });

      expect(onSortChange).toHaveBeenCalledWith([]);
    });
  });

  describe('getSortPriority', () => {
    it('should return priority for sorted field', () => {
      const initialConfig: MultiSortConfig[] = [
        { field: 'name', direction: 'asc', priority: 1 },
        { field: 'age', direction: 'desc', priority: 2 },
      ];
      const { result } = createTestHook(initialConfig);

      expect(result.current.getSortPriority('name')).toBe(1);
      expect(result.current.getSortPriority('age')).toBe(2);
      expect(result.current.getSortPriority('unknown')).toBeNull();
    });
  });

  describe('getSortDirection', () => {
    it('should return direction for sorted field', () => {
      const initialConfig: MultiSortConfig[] = [
        { field: 'name', direction: 'asc', priority: 1 },
        { field: 'age', direction: 'desc', priority: 2 },
      ];
      const { result } = createTestHook(initialConfig);

      expect(result.current.getSortDirection('name')).toBe('asc');
      expect(result.current.getSortDirection('age')).toBe('desc');
      expect(result.current.getSortDirection('unknown')).toBeNull();
    });
  });

  describe('isSorted', () => {
    it('should return true for sorted fields', () => {
      const initialConfig: MultiSortConfig[] = [
        { field: 'name', direction: 'asc', priority: 1 },
      ];
      const { result } = createTestHook(initialConfig);

      expect(result.current.isSorted('name')).toBe(true);
      expect(result.current.isSorted('unknown')).toBe(false);
    });
  });

  describe('handleSortClick', () => {
    it('should set single sort on click without modifier', () => {
      const { result, onSortChange } = createTestHook([]);

      act(() => {
        result.current.handleSortClick('name');
      });

      expect(onSortChange).toHaveBeenCalledWith([
        { field: 'name', direction: 'asc', priority: 1 },
      ]);
    });

    it('should toggle to desc on second click', () => {
      const initialConfig: MultiSortConfig[] = [
        { field: 'name', direction: 'asc', priority: 1 },
      ];
      const { result, onSortChange } = createTestHook(initialConfig);

      act(() => {
        result.current.handleSortClick('name');
      });

      expect(onSortChange).toHaveBeenCalledWith([
        { field: 'name', direction: 'desc', priority: 1 },
      ]);
    });

    it('should clear on third click', () => {
      const initialConfig: MultiSortConfig[] = [
        { field: 'name', direction: 'desc', priority: 1 },
      ];
      const { result, onSortChange } = createTestHook(initialConfig);

      act(() => {
        result.current.handleSortClick('name');
      });

      expect(onSortChange).toHaveBeenCalledWith([]);
    });
  });
});

describe('applyMultiSort', () => {
  const testData = [
    { id: 1, name: 'Charlie', age: 35, score: 90 },
    { id: 2, name: 'Alice', age: 25, score: 85 },
    { id: 3, name: 'Bob', age: 30, score: 90 },
    { id: 4, name: 'Alice', age: 30, score: 95 },
  ];

  it('should return original data when no sort config', () => {
    const result = applyMultiSort(testData, []);
    expect(result).toEqual(testData);
  });

  it('should sort by single column ascending', () => {
    const result = applyMultiSort(testData, [
      { field: 'name', direction: 'asc', priority: 1 },
    ]);

    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Alice');
    expect(result[2].name).toBe('Bob');
    expect(result[3].name).toBe('Charlie');
  });

  it('should sort by single column descending', () => {
    const result = applyMultiSort(testData, [
      { field: 'age', direction: 'desc', priority: 1 },
    ]);

    expect(result[0].age).toBe(35);
    expect(result[1].age).toBe(30);
    expect(result[2].age).toBe(30);
    expect(result[3].age).toBe(25);
  });

  it('should apply multi-column sorting by priority', () => {
    // Sort by score desc, then name asc
    const result = applyMultiSort(testData, [
      { field: 'score', direction: 'desc', priority: 1 },
      { field: 'name', direction: 'asc', priority: 2 },
    ]);

    // First by score (desc): 95, 90, 90, 85
    // Within same score, by name (asc)
    expect(result[0]).toMatchObject({ name: 'Alice', score: 95 });
    expect(result[1]).toMatchObject({ name: 'Bob', score: 90 }); // Bob before Charlie
    expect(result[2]).toMatchObject({ name: 'Charlie', score: 90 });
    expect(result[3]).toMatchObject({ name: 'Alice', score: 85 });
  });

  it('should handle null/undefined values by pushing them to end', () => {
    const dataWithNulls = [
      { id: 1, name: 'Alice', value: 10 },
      { id: 2, name: 'Bob', value: null },
      { id: 3, name: 'Charlie', value: undefined },
      { id: 4, name: 'Dave', value: 5 },
    ];

    const result = applyMultiSort(dataWithNulls, [
      { field: 'value', direction: 'asc', priority: 1 },
    ]);

    // Valid values sorted first, nulls/undefined at end
    expect(result[0].name).toBe('Dave'); // value: 5
    expect(result[1].name).toBe('Alice'); // value: 10
    // Nulls at end
    expect(result[2].value === null || result[2].value === undefined).toBe(true);
    expect(result[3].value === null || result[3].value === undefined).toBe(true);
  });

  it('should handle date strings', () => {
    const dataWithDates = [
      { id: 1, name: 'A', date: '2024-01-15' },
      { id: 2, name: 'B', date: '2024-01-01' },
      { id: 3, name: 'C', date: '2024-01-30' },
    ];

    const result = applyMultiSort(dataWithDates, [
      { field: 'date', direction: 'asc', priority: 1 },
    ]);

    expect(result[0].date).toBe('2024-01-01');
    expect(result[1].date).toBe('2024-01-15');
    expect(result[2].date).toBe('2024-01-30');
  });
});
