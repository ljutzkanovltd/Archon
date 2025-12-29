import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderHook, act } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { DataTable, DataTableColumn } from '../index';
import { DataTableProvider, useSorting, useSelection } from '../context/DataTableContext';

describe('DataTableContent', () => {
  const mockData = [
    { id: '1', name: 'Alice', age: 30, status: 'active' },
    { id: '2', name: 'Bob', age: 25, status: 'inactive' },
    { id: '3', name: 'Charlie', age: 35, status: 'active' },
  ];

  const mockColumns: DataTableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'age', label: 'Age', sortable: true },
    { key: 'status', label: 'Status', sortable: false },
  ];

  describe('Table View', () => {
    it('should render rows correctly in table view', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="table"
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('should render all columns in table view', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="table"
        />
      );

      // Check column headers
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('should render cell values correctly', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="table"
        />
      );

      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });

    it('should use custom render function when provided', () => {
      const columnsWithRender: DataTableColumn[] = [
        {
          key: 'name',
          label: 'Name',
          render: (value) => <strong data-testid="custom-name">{value}</strong>,
        },
      ];

      render(
        <DataTable
          data={mockData}
          columns={columnsWithRender}
          viewMode="table"
        />
      );

      expect(screen.getByTestId('custom-name')).toHaveTextContent('Alice');
    });
  });

  describe('Grid View', () => {
    it('should render items correctly in grid view', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="grid"
        />
      );

      // Data should be present in grid view
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('should not render as table in grid view', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="grid"
        />
      );

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should toggle sort direction on column click', () => {
      const { result } = renderHook(() => useSorting(), {
        wrapper: ({ children }) => (
          <DataTableProvider data={mockData} columns={mockColumns}>
            {children}
          </DataTableProvider>
        ),
      });

      // Initially no sort
      expect(result.current.sort).toBeNull();

      // First click: ascending
      act(() => {
        result.current.toggleSort('name');
      });

      expect(result.current.sort).toEqual({ field: 'name', direction: 'asc' });

      // Second click: descending
      act(() => {
        result.current.toggleSort('name');
      });

      expect(result.current.sort).toEqual({ field: 'name', direction: 'desc' });

      // Third click: clear sort
      act(() => {
        result.current.toggleSort('name');
      });

      expect(result.current.sort).toBeNull();
    });

    it('should sort data in ascending order', () => {
      const { result } = renderHook(() => useSorting(), {
        wrapper: ({ children }) => (
          <DataTableProvider data={mockData} columns={mockColumns}>
            {children}
          </DataTableProvider>
        ),
      });

      act(() => {
        result.current.setSort({ field: 'age', direction: 'asc' });
      });

      expect(result.current.sort).toEqual({ field: 'age', direction: 'asc' });
    });

    it('should sort data in descending order', () => {
      const { result } = renderHook(() => useSorting(), {
        wrapper: ({ children }) => (
          <DataTableProvider data={mockData} columns={mockColumns}>
            {children}
          </DataTableProvider>
        ),
      });

      act(() => {
        result.current.setSort({ field: 'age', direction: 'desc' });
      });

      expect(result.current.sort).toEqual({ field: 'age', direction: 'desc' });
    });

    it('should provide isSorted helper', () => {
      const { result } = renderHook(() => useSorting(), {
        wrapper: ({ children }) => (
          <DataTableProvider data={mockData} columns={mockColumns}>
            {children}
          </DataTableProvider>
        ),
      });

      act(() => {
        result.current.setSort({ field: 'name', direction: 'asc' });
      });

      expect(result.current.isSorted('name')).toBe(true);
      expect(result.current.isSorted('age')).toBe(false);
    });

    it('should provide getSortDirection helper', () => {
      const { result } = renderHook(() => useSorting(), {
        wrapper: ({ children }) => (
          <DataTableProvider data={mockData} columns={mockColumns}>
            {children}
          </DataTableProvider>
        ),
      });

      act(() => {
        result.current.setSort({ field: 'name', direction: 'desc' });
      });

      expect(result.current.getSortDirection('name')).toBe('desc');
      expect(result.current.getSortDirection('age')).toBeNull();
    });
  });

  describe('Row Selection', () => {
    it('should toggle individual row selection', () => {
      const { result } = renderHook(() => useSelection(), {
        wrapper: ({ children }) => (
          <DataTableProvider
            data={mockData}
            columns={mockColumns}
            keyExtractor={(item) => item.id}
          >
            {children}
          </DataTableProvider>
        ),
      });

      expect(result.current.selectedCount).toBe(0);

      // Select first row
      act(() => {
        result.current.toggleSelection('1');
      });

      expect(result.current.selectedCount).toBe(1);
      expect(result.current.isSelected('1')).toBe(true);

      // Deselect first row
      act(() => {
        result.current.toggleSelection('1');
      });

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isSelected('1')).toBe(false);
    });

    it('should toggle select all', () => {
      const { result } = renderHook(() => useSelection(), {
        wrapper: ({ children }) => (
          <DataTableProvider
            data={mockData}
            columns={mockColumns}
            keyExtractor={(item) => item.id}
          >
            {children}
          </DataTableProvider>
        ),
      });

      // Select all
      act(() => {
        result.current.toggleSelectAll();
      });

      expect(result.current.isAllSelected).toBe(true);
      expect(result.current.selectedCount).toBe(mockData.length);

      // Deselect all
      act(() => {
        result.current.toggleSelectAll();
      });

      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.selectedCount).toBe(0);
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => useSelection(), {
        wrapper: ({ children }) => (
          <DataTableProvider
            data={mockData}
            columns={mockColumns}
            keyExtractor={(item) => item.id}
          >
            {children}
          </DataTableProvider>
        ),
      });

      // Select some rows
      act(() => {
        result.current.toggleSelection('1');
        result.current.toggleSelection('2');
      });

      expect(result.current.selectedCount).toBe(2);

      // Clear selection
      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedCount).toBe(0);
      expect(result.current.hasSelection).toBe(false);
    });

    it('should track multiple selections', () => {
      const { result } = renderHook(() => useSelection(), {
        wrapper: ({ children }) => (
          <DataTableProvider
            data={mockData}
            columns={mockColumns}
            keyExtractor={(item) => item.id}
          >
            {children}
          </DataTableProvider>
        ),
      });

      act(() => {
        result.current.toggleSelection('1');
        result.current.toggleSelection('2');
        result.current.toggleSelection('3');
      });

      expect(result.current.selectedCount).toBe(3);
      expect(result.current.isSelected('1')).toBe(true);
      expect(result.current.isSelected('2')).toBe(true);
      expect(result.current.isSelected('3')).toBe(true);
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no data', () => {
      render(
        <DataTable
          data={[]}
          columns={mockColumns}
          emptyMessage="No items found"
        />
      );

      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('should show empty state icon', () => {
      const { container } = render(
        <DataTable
          data={[]}
          columns={mockColumns}
        />
      );

      // Empty state should have an icon
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should not show table when empty', () => {
      render(
        <DataTable
          data={[]}
          columns={mockColumns}
        />
      );

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner', () => {
      const { container } = render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          isLoading={true}
        />
      );

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not show data during loading', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          isLoading={true}
        />
      );

      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });

    it('should not show empty state during loading', () => {
      render(
        <DataTable
          data={[]}
          columns={mockColumns}
          isLoading={true}
          emptyMessage="No data"
        />
      );

      expect(screen.queryByText('No data')).not.toBeInTheDocument();
    });

    it('should show data after loading completes', () => {
      const { rerender } = render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          isLoading={true}
        />
      );

      expect(screen.queryByText('Alice')).not.toBeInTheDocument();

      // Finish loading
      rerender(
        <DataTable
          data={mockData}
          columns={mockColumns}
          isLoading={false}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('View Mode Switching', () => {
    it('should switch from table to grid view', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="table"
          showViewToggle={true}
        />
      );

      // Should start in table view
      expect(screen.getByRole('table')).toBeInTheDocument();

      // Find grid view button and click
      const gridButton = screen.getByLabelText(/grid view/i);
      await user.click(gridButton);

      // Should now be in grid view (no table)
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('should maintain data across view switches', async () => {
      const user = userEvent.setup();

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="table"
          showViewToggle={true}
        />
      );

      // Data should be present in table view
      expect(screen.getByText('Alice')).toBeInTheDocument();

      // Switch to grid view
      const gridButton = screen.getByLabelText(/grid view/i);
      await user.click(gridButton);

      // Data should still be present in grid view
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should render table with proper semantics', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="table"
          caption="User data table"
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('User data table')).toBeInTheDocument();
    });

    it('should have proper column headers', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="table"
        />
      );

      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders).toHaveLength(mockColumns.length);
    });

    it('should render rows with proper structure', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="table"
        />
      );

      // Should have header row + data rows
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(mockData.length);
    });
  });
});
