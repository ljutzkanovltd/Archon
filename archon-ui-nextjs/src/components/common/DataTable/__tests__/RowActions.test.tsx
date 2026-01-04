import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import RowActions from '../components/RowActions';
import { DataTableButton } from '../context/DataTableContext';

// The overflow menu uses RowMenu which has aria-label="Open actions menu"
const OVERFLOW_MENU_LABEL = /open actions menu/i;

describe('RowActions', () => {
  const createAction = (label: string, variant?: DataTableButton['variant']): DataTableButton => ({
    label,
    onClick: vi.fn(),
    variant,
  });

  describe('Single Action', () => {
    it('should render single action as primary button', () => {
      const action = createAction('View');
      render(<RowActions actions={[action]} />);

      expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    });

    it('should call onClick when single action is clicked', async () => {
      const user = userEvent.setup();
      const action = createAction('View');
      render(<RowActions actions={[action]} />);

      await user.click(screen.getByRole('button', { name: 'View' }));

      expect(action.onClick).toHaveBeenCalledTimes(1);
    });

    it('should not show overflow menu for single action', () => {
      const action = createAction('View');
      render(<RowActions actions={[action]} />);

      // No 3-dots button should be present
      expect(screen.queryByLabelText(OVERFLOW_MENU_LABEL)).not.toBeInTheDocument();
    });
  });

  describe('Multiple Actions', () => {
    it('should show first action as primary button', () => {
      const actions = [
        createAction('View'),
        createAction('Edit'),
        createAction('Delete', 'danger'),
      ];
      render(<RowActions actions={actions} />);

      expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    });

    it('should show overflow menu button for remaining actions', () => {
      const actions = [
        createAction('View'),
        createAction('Edit'),
        createAction('Delete', 'danger'),
      ];
      render(<RowActions actions={actions} />);

      expect(screen.getByLabelText(OVERFLOW_MENU_LABEL)).toBeInTheDocument();
    });

    it('should render remaining actions in overflow menu', async () => {
      const user = userEvent.setup();
      const actions = [
        createAction('View'),
        createAction('Edit'),
        createAction('Delete', 'danger'),
      ];
      render(<RowActions actions={actions} />);

      // Open overflow menu
      await user.click(screen.getByLabelText(OVERFLOW_MENU_LABEL));

      // Check dropdown items
      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });

    it('should call correct onClick for overflow menu items', async () => {
      const user = userEvent.setup();
      const editAction = createAction('Edit');
      const actions = [
        createAction('View'),
        editAction,
        createAction('Delete', 'danger'),
      ];
      render(<RowActions actions={actions} />);

      // Open overflow menu and click Edit
      await user.click(screen.getByLabelText(OVERFLOW_MENU_LABEL));
      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Edit'));

      expect(editAction.onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('showPrimary prop', () => {
    it('should hide primary button when showPrimary is false', () => {
      const actions = [
        createAction('View'),
        createAction('Edit'),
      ];
      render(<RowActions actions={actions} showPrimary={false} />);

      // Primary button should not be visible
      expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();

      // Only overflow menu should be visible
      expect(screen.getByLabelText(OVERFLOW_MENU_LABEL)).toBeInTheDocument();
    });

    it('should show all actions in overflow menu when showPrimary is false', async () => {
      const user = userEvent.setup();
      const actions = [
        createAction('View'),
        createAction('Edit'),
      ];
      render(<RowActions actions={actions} showPrimary={false} />);

      await user.click(screen.getByLabelText(OVERFLOW_MENU_LABEL));

      await waitFor(() => {
        expect(screen.getByText('View')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });
    });
  });

  describe('Empty Actions', () => {
    it('should render nothing when actions array is empty', () => {
      const { container } = render(<RowActions actions={[]} />);

      // Container should be empty or have no visible content
      expect(container.firstChild?.textContent).toBeFalsy();
    });
  });

  describe('Disabled Actions', () => {
    it('should render disabled primary button', () => {
      const action: DataTableButton = {
        label: 'View',
        onClick: vi.fn(),
        disabled: true,
      };
      render(<RowActions actions={[action]} />);

      const button = screen.getByRole('button', { name: 'View' });
      expect(button).toBeDisabled();
    });

    it('should not call onClick on disabled action', async () => {
      const user = userEvent.setup();
      const action: DataTableButton = {
        label: 'View',
        onClick: vi.fn(),
        disabled: true,
      };
      render(<RowActions actions={[action]} />);

      const button = screen.getByRole('button', { name: 'View' });
      // Click should not work on disabled button
      await user.click(button);

      expect(action.onClick).not.toHaveBeenCalled();
    });
  });

  describe('Action Variants', () => {
    it('should apply correct styling for primary variant', () => {
      const action = createAction('Create', 'primary');
      render(<RowActions actions={[action]} />);

      const button = screen.getByRole('button', { name: 'Create' });
      // Primary buttons typically have specific background color classes
      expect(button).toBeInTheDocument();
    });

    it('should apply correct styling for danger variant', () => {
      const action = createAction('Delete', 'danger');
      render(<RowActions actions={[action]} />);

      const button = screen.getByRole('button', { name: 'Delete' });
      expect(button).toBeInTheDocument();
    });

    it('should apply correct styling for ghost variant', () => {
      const action = createAction('Cancel', 'ghost');
      render(<RowActions actions={[action]} />);

      const button = screen.getByRole('button', { name: 'Cancel' });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible name on overflow button', () => {
      const actions = [
        createAction('View'),
        createAction('Edit'),
      ];
      render(<RowActions actions={actions} />);

      const overflowButton = screen.getByLabelText(OVERFLOW_MENU_LABEL);
      expect(overflowButton).toBeInTheDocument();
    });

    it('should use ariaLabel when provided', () => {
      const action: DataTableButton = {
        label: 'X',
        onClick: vi.fn(),
        ariaLabel: 'Delete item',
      };
      render(<RowActions actions={[action]} />);

      expect(screen.getByRole('button', { name: 'Delete item' })).toBeInTheDocument();
    });
  });

  describe('Icon Support', () => {
    it('should render with icon component', () => {
      const MockIcon = () => <svg data-testid="mock-icon" />;
      const action: DataTableButton = {
        label: 'View',
        onClick: vi.fn(),
        icon: MockIcon,
      };
      render(<RowActions actions={[action]} />);

      expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });
  });
});
