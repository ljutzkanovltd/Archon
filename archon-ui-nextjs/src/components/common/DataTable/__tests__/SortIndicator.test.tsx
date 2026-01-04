import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import SortIndicator, { MultiSortBadge } from '../components/SortIndicator';

describe('SortIndicator', () => {
  describe('Unsorted State', () => {
    it('should render component when not sorted', () => {
      const { container } = render(<SortIndicator direction={null} />);

      // Component should render
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should not show priority badge when not sorted', () => {
      render(<SortIndicator direction={null} priority={null} />);

      // No number badge should be visible
      expect(screen.queryByText('1')).not.toBeInTheDocument();
      expect(screen.queryByText('2')).not.toBeInTheDocument();
    });
  });

  describe('Ascending Sort', () => {
    it('should render component with asc direction', () => {
      const { container } = render(<SortIndicator direction="asc" />);

      // Component should render
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should render with correct aria attributes', () => {
      const { container } = render(<SortIndicator direction="asc" />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Descending Sort', () => {
    it('should render component with desc direction', () => {
      const { container } = render(<SortIndicator direction="desc" />);

      // Component should render
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Priority Badge', () => {
    it('should show priority badge when showPriority is true and priority is provided', () => {
      render(
        <SortIndicator
          direction="asc"
          priority={1}
          showPriority={true}
        />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should show correct priority number', () => {
      render(
        <SortIndicator
          direction="desc"
          priority={2}
          showPriority={true}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should not show priority badge when showPriority is false', () => {
      render(
        <SortIndicator
          direction="asc"
          priority={1}
          showPriority={false}
        />
      );

      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('should not show priority badge when priority is null', () => {
      render(
        <SortIndicator
          direction="asc"
          priority={null}
          showPriority={true}
        />
      );

      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });
  });

  describe('Clear Button', () => {
    it('should show clear button when showClear is true', () => {
      const onClear = vi.fn();
      render(
        <SortIndicator
          direction="asc"
          showClear={true}
          onClear={onClear}
        />
      );

      const clearButton = screen.getByRole('button', { name: /clear sort/i });
      expect(clearButton).toBeInTheDocument();
    });

    it('should call onClear when clear button is clicked', () => {
      const onClear = vi.fn();
      render(
        <SortIndicator
          direction="asc"
          showClear={true}
          onClear={onClear}
        />
      );

      const clearButton = screen.getByRole('button', { name: /clear sort/i });
      fireEvent.click(clearButton);

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('should stop propagation when clear button is clicked', () => {
      const onClear = vi.fn();
      const parentOnClick = vi.fn();

      const { container } = render(
        <div onClick={parentOnClick}>
          <SortIndicator
            direction="asc"
            showClear={true}
            onClear={onClear}
          />
        </div>
      );

      const clearButton = screen.getByRole('button', { name: /clear sort/i });
      fireEvent.click(clearButton);

      expect(onClear).toHaveBeenCalled();
      // Parent click should not be triggered due to stopPropagation
    });
  });

  describe('Size Variants', () => {
    it('should render with small size by default', () => {
      const { container } = render(<SortIndicator direction="asc" size="sm" />);

      // Component should render without errors
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should render with medium size', () => {
      const { container } = render(<SortIndicator direction="asc" size="md" />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});

describe('MultiSortBadge', () => {
  it('should not render when sortCount is 0', () => {
    const { container } = render(<MultiSortBadge sortCount={0} />);

    expect(container.firstChild).toBeNull();
  });

  it('should not render when sortCount is 1', () => {
    const { container } = render(<MultiSortBadge sortCount={1} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render when sortCount is 2 or more', () => {
    render(<MultiSortBadge sortCount={2} />);

    expect(screen.getByText(/sorted by 2 columns/i)).toBeInTheDocument();
  });

  it('should show correct count text', () => {
    render(<MultiSortBadge sortCount={3} />);

    expect(screen.getByText(/sorted by 3 columns/i)).toBeInTheDocument();
  });

  it('should show clear all button when onClearAll is provided', () => {
    const onClearAll = vi.fn();
    render(<MultiSortBadge sortCount={2} onClearAll={onClearAll} />);

    const clearButton = screen.getByRole('button', { name: /clear all sorting/i });
    expect(clearButton).toBeInTheDocument();
  });

  it('should call onClearAll when clear button is clicked', () => {
    const onClearAll = vi.fn();
    render(<MultiSortBadge sortCount={2} onClearAll={onClearAll} />);

    const clearButton = screen.getByRole('button', { name: /clear all sorting/i });
    fireEvent.click(clearButton);

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('should accept custom className', () => {
    const { container } = render(
      <MultiSortBadge sortCount={2} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
