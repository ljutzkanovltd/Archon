import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SprintSelector } from '../components/SprintSelector';

/**
 * Unit Tests - SprintSelector Component
 * Phase 1.22: Component behavior and integration tests
 */

// Mock the useSprints hook
vi.mock('../hooks/useSprintQueries', () => ({
  useSprints: vi.fn(),
}));

// Mock CreateSprintModal component
vi.mock('../components/CreateSprintModal', () => ({
  CreateSprintModal: ({ isOpen, onClose, onSprintCreated }: any) =>
    isOpen ? <div data-testid="create-sprint-modal">Mock CreateSprintModal</div> : null,
}));

import { useSprints } from '../hooks/useSprintQueries';

describe('SprintSelector Component', () => {
  let queryClient: QueryClient;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockOnChange.mockClear();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SprintSelector
          projectId="test-project-id"
          value={undefined}
          onChange={mockOnChange}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('should render loading state', () => {
    vi.mocked(useSprints).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByText(/Loading sprints/i)).toBeInTheDocument();
  });

  it('should render error state', () => {
    const error = new Error('Failed to fetch sprints');
    vi.mocked(useSprints).mockReturnValue({
      data: undefined,
      isLoading: false,
      error,
    } as any);

    renderComponent();

    expect(screen.getByText(/Error loading sprints/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed to fetch sprints/i)).toBeInTheDocument();
  });

  it('should render empty state when no sprints available', () => {
    vi.mocked(useSprints).mockReturnValue({
      data: { sprints: [], count: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText(/No active or planned sprints available/i)).toBeInTheDocument();
  });

  it('should render available sprints (active and planned only)', () => {
    vi.mocked(useSprints).mockReturnValue({
      data: {
        sprints: [
          {
            id: 'sprint-1',
            name: 'Sprint 1',
            status: 'planned',
            start_date: '2024-01-15',
            end_date: '2024-01-29',
          },
          {
            id: 'sprint-2',
            name: 'Sprint 2',
            status: 'active',
            start_date: '2024-01-01',
            end_date: '2024-01-14',
          },
          {
            id: 'sprint-3',
            name: 'Sprint 3',
            status: 'completed',
            start_date: '2023-12-15',
            end_date: '2023-12-29',
          },
        ],
        count: 3,
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    // Should show planned and active sprints
    expect(screen.getByRole('option', { name: /Sprint 1.*Planned/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Sprint 2.*Active/i })).toBeInTheDocument();

    // Should NOT show completed sprint
    expect(screen.queryByRole('option', { name: /Sprint 3/i })).not.toBeInTheDocument();
  });

  it('should display sprint status indicators correctly', () => {
    vi.mocked(useSprints).mockReturnValue({
      data: {
        sprints: [
          {
            id: 'sprint-1',
            name: 'Planned Sprint',
            status: 'planned',
            start_date: '2024-01-15',
            end_date: '2024-01-29',
          },
          {
            id: 'sprint-2',
            name: 'Active Sprint',
            status: 'active',
            start_date: '2024-01-01',
            end_date: '2024-01-14',
          },
        ],
        count: 2,
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const plannedOption = screen.getByRole('option', { name: /Planned Sprint/i });
    const activeOption = screen.getByRole('option', { name: /Active Sprint/i });

    expect(plannedOption.textContent).toContain('📅 Planned');
    expect(activeOption.textContent).toContain('🟢 Active');
  });

  it('should call onChange when selection changes', async () => {
    const user = userEvent.setup();

    vi.mocked(useSprints).mockReturnValue({
      data: {
        sprints: [
          {
            id: 'sprint-1',
            name: 'Sprint 1',
            status: 'planned',
            start_date: '2024-01-15',
            end_date: '2024-01-29',
          },
        ],
        count: 1,
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'sprint-1');

    expect(mockOnChange).toHaveBeenCalledWith('sprint-1');
  });

  it('should call onChange with undefined when "None" is selected', async () => {
    const user = userEvent.setup();

    vi.mocked(useSprints).mockReturnValue({
      data: {
        sprints: [
          {
            id: 'sprint-1',
            name: 'Sprint 1',
            status: 'planned',
            start_date: '2024-01-15',
            end_date: '2024-01-29',
          },
        ],
        count: 1,
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent({ value: 'sprint-1' });

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, '');

    expect(mockOnChange).toHaveBeenCalledWith(undefined);
  });

  it('should display selected value correctly', () => {
    vi.mocked(useSprints).mockReturnValue({
      data: {
        sprints: [
          {
            id: 'sprint-1',
            name: 'Sprint 1',
            status: 'active',
            start_date: '2024-01-15',
            end_date: '2024-01-29',
          },
        ],
        count: 1,
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent({ value: 'sprint-1' });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('sprint-1');
  });

  it('should be disabled when disabled prop is true', () => {
    vi.mocked(useSprints).mockReturnValue({
      data: { sprints: [], count: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderComponent({ disabled: true });

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('should display custom label when provided', () => {
    vi.mocked(useSprints).mockReturnValue({
      data: { sprints: [], count: 0 },
      isLoading: false,
      error: null,
    } as any);

    const { container } = renderComponent({ label: 'Custom Sprint Label' });

    // Flowbite Label uses value attribute - check the label element exists with correct attribute
    const label = container.querySelector('label[for="sprint-selector"]');
    expect(label).toHaveAttribute('value', 'Custom Sprint Label');
  });

  it('should display helper text when provided', () => {
    vi.mocked(useSprints).mockReturnValue({
      data: { sprints: [], count: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderComponent({ helperText: 'Choose a sprint for this task' });

    expect(screen.getByText('Choose a sprint for this task')).toBeInTheDocument();
  });

  it('should mark field as required when required prop is true', () => {
    vi.mocked(useSprints).mockReturnValue({
      data: { sprints: [], count: 0 },
      isLoading: false,
      error: null,
    } as any);

    const { container } = renderComponent({ required: true, label: 'Sprint' });

    // Flowbite Label uses value attribute - check for asterisk in value
    const label = container.querySelector('label[for="sprint-selector"]');
    expect(label).toHaveAttribute('value', 'Sprint *');
  });

  it('should display sprint dates in options', () => {
    vi.mocked(useSprints).mockReturnValue({
      data: {
        sprints: [
          {
            id: 'sprint-1',
            name: 'Sprint Q1',
            status: 'planned',
            start_date: '2024-01-15',
            end_date: '2024-01-29',
          },
        ],
        count: 1,
      },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    const option = screen.getByRole('option', { name: /Sprint Q1/i });

    // Check that dates are displayed (formatted as "Jan 15 - Jan 29")
    expect(option.textContent).toMatch(/Jan 15/);
    expect(option.textContent).toMatch(/Jan 29/);
  });
});
