import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { ToolExecutionHistory } from '../ToolExecutionHistory';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';
import { mockMcpSessionDetails, mockMcpRequest } from '@/test/test-utils';

describe('ToolExecutionHistory', () => {
  const sessionId = 'test-session-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading spinner while fetching data', () => {
      render(<ToolExecutionHistory sessionId={sessionId} />);

      expect(screen.getByText('Loading session details...')).toBeInTheDocument();
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('should render session details with requests', async () => {
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('5 requests')).toBeInTheDocument();
      });

      // Check summary stats
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Total Tokens')).toBeInTheDocument();
      expect(screen.getByText('1,500')).toBeInTheDocument();
    });

    it('should render request list with details', async () => {
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
      });

      // Check request card elements
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText(/Time:/)).toBeInTheDocument();
      expect(screen.getByText(/Duration:/)).toBeInTheDocument();
      expect(screen.getByText(/Tokens:/)).toBeInTheDocument();
      expect(screen.getByText(/Cost:/)).toBeInTheDocument();
    });

    it('should display error message for failed requests', async () => {
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('Task creation failed')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should filter by status', async () => {
      const user = userEvent.setup();
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('5 requests')).toBeInTheDocument();
      });

      // Get status filter dropdown
      const statusFilter = screen.getByDisplayValue('All Status');
      await user.click(statusFilter);
      await user.selectOptions(statusFilter, 'error');

      // Should show only error requests
      await waitFor(() => {
        expect(screen.getByText('1 request')).toBeInTheDocument();
      });
    });

    it('should filter by tool name', async () => {
      const user = userEvent.setup();
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('5 requests')).toBeInTheDocument();
      });

      // Get tool filter dropdown
      const toolFilter = screen.getByDisplayValue('All Tools');
      await user.click(toolFilter);
      await user.selectOptions(toolFilter, 'search_docs');

      // Should show filtered results
      await waitFor(() => {
        expect(screen.getByText('1 request')).toBeInTheDocument();
      });
    });

    it('should combine status and tool filters', async () => {
      const user = userEvent.setup();
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('5 requests')).toBeInTheDocument();
      });

      // Filter by status
      const statusFilter = screen.getByDisplayValue('All Status');
      await user.selectOptions(statusFilter, 'success');

      // Filter by tool
      const toolFilter = screen.getByDisplayValue('All Tools');
      await user.selectOptions(toolFilter, 'list_tasks');

      // Should show combined filter results
      await waitFor(() => {
        expect(screen.getByText('1 request')).toBeInTheDocument();
      });
    });
  });

  describe('Request Detail Modal', () => {
    it('should open modal when request card is clicked', async () => {
      const user = userEvent.setup();
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
      });

      // Click on request card
      const requestCard = screen.getByText('search_docs').closest('div');
      if (requestCard) {
        await user.click(requestCard);
      }

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText('Request Details')).toBeInTheDocument();
      });
    });

    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
      });

      // Open modal
      const requestCard = screen.getByText('search_docs').closest('div');
      if (requestCard) {
        await user.click(requestCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Request Details')).toBeInTheDocument();
      });

      // Close modal by clicking overlay
      const modal = screen.getByText('Request Details').closest('div')?.parentElement;
      if (modal) {
        await user.click(modal);
      }

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Request Details')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should render error message when session fetch fails', async () => {
      server.use(
        http.get('/api/mcp/sessions/:sessionId', () => {
          return HttpResponse.json(
            { detail: 'Session not found' },
            { status: 404 }
          );
        })
      );

      render(<ToolExecutionHistory sessionId="error-session" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load session')).toBeInTheDocument();
      });
    });

    it('should render retry button in error state', async () => {
      server.use(
        http.get('/api/mcp/sessions/:sessionId', () => {
          return HttpResponse.json(
            { detail: 'Service unavailable' },
            { status: 500 }
          );
        })
      );

      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no requests exist', async () => {
      server.use(
        http.get('/api/mcp/sessions/:sessionId', () => {
          return HttpResponse.json({
            ...mockMcpSessionDetails(),
            requests: [],
            summary: {
              total_requests: 0,
              total_tokens: 0,
              total_prompt_tokens: 0,
              total_completion_tokens: 0,
              total_cost: 0,
              success_count: 0,
              error_count: 0,
              timeout_count: 0,
            },
          });
        })
      );

      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('No requests yet')).toBeInTheDocument();
        expect(
          screen.getByText('Tool executions will appear here when the session makes requests')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Status Badges', () => {
    it('should render success badge with correct styling', async () => {
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        const successBadge = screen.getByText('Success');
        expect(successBadge).toHaveClass('bg-green-100', 'text-green-800');
      });
    });

    it('should render error badge with correct styling', async () => {
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        const errorBadge = screen.getByText('Error');
        expect(errorBadge).toHaveClass('bg-red-100', 'text-red-800');
      });
    });
  });

  describe('Formatting', () => {
    it('should format duration correctly (ms)', async () => {
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        // 150ms should be displayed as "150ms"
        expect(screen.getByText(/150ms/)).toBeInTheDocument();
      });
    });

    it('should format duration correctly (seconds)', async () => {
      server.use(
        http.get('/api/mcp/sessions/:sessionId', () => {
          return HttpResponse.json({
            ...mockMcpSessionDetails(),
            requests: [
              mockMcpRequest({ duration_ms: 2500 }), // 2.5 seconds
            ],
          });
        })
      );

      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText(/2\.50s/)).toBeInTheDocument();
      });
    });

    it('should format cost with 6 decimal places', async () => {
      render(<ToolExecutionHistory sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText(/\$0\.000300/)).toBeInTheDocument();
      });
    });
  });
});
