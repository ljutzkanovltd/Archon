import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { DataTable, DataTableColumn } from '../index';

describe('DataTable Core', () => {
  // Test data
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
    it('should render with table view by default', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="table"
        />
      );

      // Check for table elements
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('should render all rows in table view', () => {
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

    it('should render column headers correctly', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="table"
        />
      );

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  describe('Grid View', () => {
    it('should render grid view when viewMode is grid', () => {
      const { container } = render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="grid"
        />
      );

      // Grid view uses a different structure (not a table)
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      // Data should still be present
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    it('should toggle between table and grid views', async () => {
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

      // Find and click grid view button
      const gridButton = screen.getByLabelText(/grid view/i);
      await user.click(gridButton);

      // Should switch to grid view (table disappears)
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Generic TypeScript Types', () => {
    interface CustomData {
      id: string;
      title: string;
      count: number;
    }

    it('should work with different data types', () => {
      const customData: CustomData[] = [
        { id: '1', title: 'Item 1', count: 10 },
        { id: '2', title: 'Item 2', count: 20 },
      ];

      const customColumns: DataTableColumn<CustomData>[] = [
        { key: 'title', label: 'Title' },
        { key: 'count', label: 'Count' },
      ];

      render(
        <DataTable
          data={customData}
          columns={customColumns}
          viewMode="table"
        />
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
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

    it('should display custom empty message', () => {
      render(
        <DataTable
          data={[]}
          columns={mockColumns}
          emptyMessage="Custom empty message"
        />
      );

      expect(screen.getByText('Custom empty message')).toBeInTheDocument();
    });

    it('should not show table when data is empty', () => {
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
    it('should display loading spinner when isLoading is true', () => {
      const { container } = render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          isLoading={true}
        />
      );

      // Loading spinner should be present
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not show data when loading', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          isLoading={true}
        />
      );

      // Data should not be visible during loading
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    it('should not show pagination when loading', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          isLoading={true}
          showPagination={true}
        />
      );

      // Pagination should be hidden during loading
      expect(screen.queryByLabelText(/page/i)).not.toBeInTheDocument();
    });
  });

  describe('Custom Render', () => {
    it('should use custom render function when provided', () => {
      const customRender = (item: typeof mockData[0]) => (
        <div data-testid="custom-item">
          Custom: {item.name}
        </div>
      );

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          viewMode="custom"
          customRender={customRender}
        />
      );

      // Custom rendered items should be present
      expect(screen.getByText('Custom: Alice')).toBeInTheDocument();
      expect(screen.getByText('Custom: Bob')).toBeInTheDocument();
    });
  });

  describe('Table Buttons', () => {
    it('should render table-level action buttons', () => {
      const handleCreate = vi.fn();

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          tableButtons={[
            { label: 'Create New', onClick: handleCreate, variant: 'primary' }
          ]}
        />
      );

      expect(screen.getByText('Create New')).toBeInTheDocument();
    });

    it('should call onClick when table button is clicked', async () => {
      const user = userEvent.setup();
      const handleCreate = vi.fn();

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          tableButtons={[
            { label: 'Create New', onClick: handleCreate }
          ]}
        />
      );

      const button = screen.getByText('Create New');
      await user.click(button);

      expect(handleCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Row Buttons', () => {
    it('should render row-level action buttons', () => {
      const handleEdit = vi.fn();

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          rowButtons={(item) => [
            { label: 'Edit', onClick: () => handleEdit(item) }
          ]}
        />
      );

      // Should have edit buttons for each row
      const editButtons = screen.getAllByText('Edit');
      expect(editButtons).toHaveLength(mockData.length);
    });

    it('should call onClick with correct item when row button is clicked', async () => {
      const user = userEvent.setup();
      const handleEdit = vi.fn();

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          rowButtons={(item) => [
            { label: 'Edit', onClick: () => handleEdit(item), ariaLabel: `Edit ${item.name}` }
          ]}
        />
      );

      const aliceEditButton = screen.getByLabelText('Edit Alice');
      await user.click(aliceEditButton);

      expect(handleEdit).toHaveBeenCalledWith(mockData[0]);
    });
  });

  describe('Accessibility', () => {
    it('should render table with proper caption', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          caption="User list with 3 users"
        />
      );

      expect(screen.getByText('User list with 3 users')).toBeInTheDocument();
    });

    it('should have proper ARIA labels on buttons', () => {
      const handleEdit = vi.fn();

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          rowButtons={(item) => [
            { label: 'Edit', onClick: () => handleEdit(item), ariaLabel: `Edit ${item.name}` }
          ]}
        />
      );

      expect(screen.getByLabelText('Edit Alice')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit Bob')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should show pagination when showPagination is true', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showPagination={true}
        />
      );

      // Pagination should be visible (look for page indicators or navigation)
      expect(screen.getByText(/page/i)).toBeInTheDocument();
    });

    it('should hide pagination when showPagination is false', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showPagination={false}
        />
      );

      // Pagination should not be visible
      expect(screen.queryByText(/page/i)).not.toBeInTheDocument();
    });

    it('should not show pagination when data is empty', () => {
      render(
        <DataTable
          data={[]}
          columns={mockColumns}
          showPagination={true}
        />
      );

      // Pagination should be hidden for empty data
      expect(screen.queryByText(/page/i)).not.toBeInTheDocument();
    });
  });

  describe('Feature Flags', () => {
    it('should hide search when showSearch is false', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={false}
        />
      );

      expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    });

    it('should show search when showSearch is true', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('should hide header when showHeader is false', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showHeader={false}
          tableButtons={[
            { label: 'Create', onClick: vi.fn() }
          ]}
        />
      );

      // Table buttons should not be visible (they're in the header)
      expect(screen.queryByText('Create')).not.toBeInTheDocument();
    });
  });
});
