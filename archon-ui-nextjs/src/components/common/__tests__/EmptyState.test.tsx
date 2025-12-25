import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import EmptyState from '../EmptyState';
import { ButtonVariant } from '@/lib/types';

describe('EmptyState', () => {
  it('should render with title and description', () => {
    render(
      <EmptyState
        config={{
          type: 'no_data',
          title: 'No Data Found',
          description: 'There are no items to display',
        }}
      />
    );

    expect(screen.getByText('No Data Found')).toBeInTheDocument();
    expect(screen.getByText('There are no items to display')).toBeInTheDocument();
  });

  it('should render default icon for no_data type', () => {
    const { container } = render(
      <EmptyState
        config={{
          type: 'no_data',
          title: 'No Data',
          description: 'Empty',
        }}
      />
    );

    // Check for SVG icon
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('w-16', 'h-16');
  });

  it('should render search icon for no_search_results type', () => {
    const { container } = render(
      <EmptyState
        config={{
          type: 'no_search_results',
          title: 'No Results',
          description: 'Try different search terms',
        }}
      />
    );

    // Check for SVG icon
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render action button when provided', () => {
    const handleAction = vi.fn();

    render(
      <EmptyState
        config={{
          type: 'no_data',
          title: 'No Projects',
          description: 'Get started by creating a project',
          button: {
            text: 'Create Project',
            onClick: handleAction,
          },
        }}
      />
    );

    const button = screen.getByRole('button', { name: 'Create Project' });
    expect(button).toBeInTheDocument();
  });

  it('should call onClick when button clicked', async () => {
    const handleAction = vi.fn();
    const user = userEvent.setup();

    render(
      <EmptyState
        config={{
          type: 'no_data',
          title: 'No Data',
          description: 'Empty',
          button: {
            text: 'Add Item',
            onClick: handleAction,
          },
        }}
      />
    );

    const button = screen.getByRole('button', { name: 'Add Item' });
    await user.click(button);

    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('should not render button without button config', () => {
    render(
      <EmptyState
        config={{
          type: 'no_data',
          title: 'No Data',
          description: 'Empty',
        }}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render button with custom variant', () => {
    render(
      <EmptyState
        config={{
          type: 'no_data',
          title: 'No Data',
          description: 'Empty',
          button: {
            text: 'View More',
            variant: ButtonVariant.SECONDARY,
          },
        }}
      />
    );

    const button = screen.getByRole('button', { name: 'View More' });
    expect(button).toBeInTheDocument();
  });

  it('should replace searchTerm placeholder in title', () => {
    render(
      <EmptyState
        config={{
          type: 'no_search_results',
          title: 'No results for {searchTerm}',
          description: 'Try different terms',
        }}
        searchTerm="react"
      />
    );

    expect(screen.getByText('No results for "react"')).toBeInTheDocument();
  });

  it('should replace searchTerm placeholder in description', () => {
    render(
      <EmptyState
        config={{
          type: 'no_search_results',
          title: 'No Results',
          description: 'No matches found for {searchTerm}',
        }}
        searchTerm="typescript"
      />
    );

    expect(screen.getByText('No matches found for "typescript"')).toBeInTheDocument();
  });

  it('should render custom content when provided', () => {
    render(
      <EmptyState
        config={{
          type: 'no_data',
          title: 'Ignored',
          description: 'Ignored',
          customContent: <div data-testid="custom">Custom Content</div>,
        }}
      />
    );

    expect(screen.getByTestId('custom')).toBeInTheDocument();
    expect(screen.getByText('Custom Content')).toBeInTheDocument();
    // Title and description should not render when customContent is present
    expect(screen.queryByText('Ignored')).not.toBeInTheDocument();
  });

  it('should render in dark mode', () => {
    render(
      <EmptyState
        config={{
          type: 'no_data',
          title: 'No Data',
          description: 'Empty',
        }}
      />
    );

    const title = screen.getByText('No Data');
    expect(title).toHaveClass('dark:text-white');

    const description = screen.getByText('Empty');
    expect(description).toHaveClass('dark:text-gray-400');
  });
});
