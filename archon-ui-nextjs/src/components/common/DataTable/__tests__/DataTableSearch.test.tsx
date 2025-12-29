import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { DataTable, DataTableColumn } from '../index';

describe('DataTableSearch', () => {
  // Test data
  const mockData = [
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com', status: 'active' },
    { id: '2', name: 'Bob Smith', email: 'bob@example.com', status: 'inactive' },
    { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', status: 'active' },
  ];

  const mockColumns: DataTableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render search input', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    it('should have search icon', () => {
      const { container } = render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      // Search icon should be present
      const icon = container.querySelector('.text-gray-400');
      expect(icon).toBeInTheDocument();
    });

    it('should have proper ARIA label', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      const searchInput = screen.getByLabelText('Search');
      expect(searchInput).toBeInTheDocument();
    });

    it('should have role="search"', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      expect(screen.getByRole('search')).toBeInTheDocument();
    });
  });

  describe('Search Input', () => {
    it('should update value when typing', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
      await user.type(searchInput, 'Alice');

      expect(searchInput.value).toBe('Alice');
    });

    it('should clear search when input is cleared', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i) as HTMLInputElement;

      // Type something
      await user.type(searchInput, 'Alice');
      expect(searchInput.value).toBe('Alice');

      // Clear it
      await user.clear(searchInput);
      expect(searchInput.value).toBe('');
    });
  });

  describe('Debouncing (300ms)', () => {
    it('should debounce search input by 300ms', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
          viewMode="table"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Type "Alice" (should show all initially)
      await user.type(searchInput, 'Alice');

      // Advance timers by 200ms (debounce not complete)
      vi.advanceTimersByTime(200);

      // All items should still be visible (debounce hasn't triggered filter)
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();

      // Advance by remaining 100ms to complete the 300ms debounce
      vi.advanceTimersByTime(100);

      // Now the search should filter (wait for re-render)
      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Bob and Charlie should be filtered out
      await waitFor(() => {
        expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
      });
    });

    it('should reset debounce timer on rapid typing', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Type "A"
      await user.type(searchInput, 'A');

      // Wait 200ms
      vi.advanceTimersByTime(200);

      // Type more characters (should reset timer)
      await user.type(searchInput, 'lice');

      // Wait another 200ms (still shouldn't trigger filter)
      vi.advanceTimersByTime(200);

      // All items should still be visible
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();

      // Wait final 100ms to complete debounce
      vi.advanceTimersByTime(100);

      // Now filter should apply
      await waitFor(() => {
        expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search Filtering', () => {
    it('should filter results based on search query', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
          viewMode="table"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'Alice');

      // Complete debounce
      vi.advanceTimersByTime(300);

      // Only Alice should be visible
      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
        expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
      });
    });

    it('should search across multiple columns', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Search by email
      await user.type(searchInput, 'bob@example');
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
      });
    });

    it('should be case-insensitive', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Search with lowercase
      await user.type(searchInput, 'alice');
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Clear and search with uppercase
      await user.clear(searchInput);
      await user.type(searchInput, 'ALICE');
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });
    });

    it('should show all results when search is cleared', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Search for Alice
      await user.type(searchInput, 'Alice');
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
      });

      // Clear search
      await user.clear(searchInput);
      vi.advanceTimersByTime(300);

      // All results should be visible again
      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
      });
    });

    it('should show empty state when no results match', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
          emptyMessage="No matching results"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'NonExistentUser');
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('No matching results')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Tab to search input
      await user.tab();
      expect(searchInput).toHaveFocus();

      // Type with keyboard
      await user.keyboard('Alice');
      expect(searchInput).toHaveValue('Alice');
    });

    it('should have proper input type="search"', () => {
      render(
        <DataTable
          data={mockData}
          columns={mockColumns}
          showSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toHaveAttribute('type', 'search');
    });
  });
});
