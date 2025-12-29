import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { DataTable, DataTableColumn } from '../index';

describe('DataTablePagination', () => {
  // Generate test data for pagination
  const generateMockData = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
    }));
  };

  const mockColumns: DataTableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
  ];

  describe('Rendering', () => {
    it('should render pagination controls', () => {
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPerPage={10}
        />
      );

      // Should show results info
      expect(screen.getByText(/showing/i)).toBeInTheDocument();

      // Should show navigation buttons
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should display correct results info', () => {
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPerPage={10}
        />
      );

      expect(screen.getByText(/showing/i)).toBeInTheDocument();
      expect(screen.getByText(/1/)).toBeInTheDocument();
      expect(screen.getByText(/10/)).toBeInTheDocument();
      expect(screen.getByText(/30/)).toBeInTheDocument();
    });

    it('should show per-page selector', () => {
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
        />
      );

      expect(screen.getByLabelText(/per page/i)).toBeInTheDocument();
    });
  });

  describe('Page Navigation', () => {
    it('should navigate to next page', async () => {
      const user = userEvent.setup();
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPerPage={10}
          viewMode="table"
        />
      );

      // Should be on page 1 initially (showing User 1-10)
      expect(screen.getByText('User 1')).toBeInTheDocument();
      expect(screen.queryByText('User 11')).not.toBeInTheDocument();

      // Click next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Should now be on page 2 (showing User 11-20)
      expect(screen.queryByText('User 1')).not.toBeInTheDocument();
      expect(screen.getByText('User 11')).toBeInTheDocument();
    });

    it('should navigate to previous page', async () => {
      const user = userEvent.setup();
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPage={2}
          initialPerPage={10}
          viewMode="table"
        />
      );

      // Should be on page 2 initially
      expect(screen.getByText('User 11')).toBeInTheDocument();

      // Click previous button
      const prevButton = screen.getByRole('button', { name: /previous/i });
      await user.click(prevButton);

      // Should now be on page 1
      expect(screen.getByText('User 1')).toBeInTheDocument();
      expect(screen.queryByText('User 11')).not.toBeInTheDocument();
    });

    it('should navigate to specific page by clicking page number', async () => {
      const user = userEvent.setup();
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPerPage={10}
          viewMode="table"
        />
      );

      // Click on page 3
      const page3Button = screen.getByRole('button', { name: '3' });
      await user.click(page3Button);

      // Should now be on page 3 (showing User 21-30)
      expect(screen.queryByText('User 1')).not.toBeInTheDocument();
      expect(screen.getByText('User 21')).toBeInTheDocument();
    });
  });

  describe('First/Last Page Buttons', () => {
    it('should disable previous button on first page', () => {
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPerPage={10}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPage={3}
          initialPerPage={10}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should enable both buttons on middle page', () => {
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPage={2}
          initialPerPage={10}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(prevButton).not.toBeDisabled();
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('Per-Page Selector', () => {
    it('should update per-page value when selector changes', async () => {
      const user = userEvent.setup();
      const data = generateMockData(100);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPerPage={10}
        />
      );

      // Should show 10 per page initially
      expect(screen.getByText(/1.*10.*100/)).toBeInTheDocument();

      // Change to 25 per page
      const perPageSelect = screen.getByLabelText(/per page/i);
      await user.selectOptions(perPageSelect, '25');

      // Should now show 25 per page
      expect(screen.getByText(/1.*25.*100/)).toBeInTheDocument();
    });

    it('should reset to page 1 when changing per-page', async () => {
      const user = userEvent.setup();
      const data = generateMockData(100);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPage={3}
          initialPerPage={10}
          viewMode="table"
        />
      );

      // Should be on page 3 (showing User 21-30)
      expect(screen.getByText('User 21')).toBeInTheDocument();

      // Change per-page selector
      const perPageSelect = screen.getByLabelText(/per page/i);
      await user.selectOptions(perPageSelect, '25');

      // Should reset to page 1 (showing User 1-25)
      expect(screen.getByText('User 1')).toBeInTheDocument();
    });

    it('should have options for 5, 10, 25, 50, 100', () => {
      const data = generateMockData(100);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
        />
      );

      const perPageSelect = screen.getByLabelText(/per page/i) as HTMLSelectElement;
      const options = Array.from(perPageSelect.options).map(o => o.value);

      expect(options).toContain('5');
      expect(options).toContain('10');
      expect(options).toContain('25');
      expect(options).toContain('50');
      expect(options).toContain('100');
    });
  });

  describe('Page Number Display', () => {
    it('should show all page numbers when total pages <= 7', () => {
      const data = generateMockData(50);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPerPage={10}
        />
      );

      // Should show pages 1, 2, 3, 4, 5
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    });

    it('should show ellipsis for large number of pages', () => {
      const data = generateMockData(200);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPerPage={10}
        />
      );

      // Should show ellipsis
      expect(screen.getByText('...')).toBeInTheDocument();
    });

    it('should highlight current page', () => {
      const data = generateMockData(50);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPage={2}
          initialPerPage={10}
        />
      );

      const page2Button = screen.getByRole('button', { name: '2' });
      // Current page should have different color (blue instead of light)
      expect(page2Button).toHaveClass('bg-blue-700');
    });
  });

  describe('Disabled States', () => {
    it('should disable previous button when on first page', () => {
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPage={1}
          initialPerPage={10}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button when on last page', () => {
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPage={3}
          initialPerPage={10}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for navigation buttons', () => {
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
        />
      );

      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should have label for per-page selector', () => {
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
        />
      );

      expect(screen.getByLabelText(/per page/i)).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      const data = generateMockData(30);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
        />
      );

      // Tab to next button and press Enter
      const nextButton = screen.getByRole('button', { name: /next/i });
      nextButton.focus();
      await user.keyboard('{Enter}');

      // Should navigate to page 2
      expect(screen.getByText(/11.*20.*30/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single page of data', () => {
      const data = generateMockData(5);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPerPage={10}
        />
      );

      // Previous and next buttons should be disabled
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('should handle exact multiple of per-page', () => {
      const data = generateMockData(20);

      render(
        <DataTable
          data={data}
          columns={mockColumns}
          showPagination={true}
          initialPerPage={10}
        />
      );

      // Should have exactly 2 pages
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '3' })).not.toBeInTheDocument();
    });
  });
});
