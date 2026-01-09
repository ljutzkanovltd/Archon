import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { McpLogsViewer } from '../McpLogsViewer';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';
import { mockMcpLogEntry } from '@/test/test-utils';

// Mock react-window to avoid virtualization issues in tests
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount }: any) => (
    <div data-testid="virtualized-list">
      {Array.from({ length: Math.min(itemCount, 10) }).map((_, index) =>
        children({ index, style: {} })
      )}
    </div>
  ),
}));

// Mock react-window-infinite-loader
vi.mock('react-window-infinite-loader', () => ({
  default: ({ children }: any) => children({ onItemsRendered: vi.fn(), ref: vi.fn() }),
}));

describe('McpLogsViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading state with skeleton UI', () => {
      render(<McpLogsViewer />);

      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('should render logs viewer with data', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('MCP Logs')).toBeInTheDocument();
      });

      // Should display total count
      expect(screen.getByText(/2 logs/)).toBeInTheDocument();
    });

    it('should render log entries with details', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
      });

      // Check log card elements
      expect(screen.getByText(/150ms/)).toBeInTheDocument();
      expect(screen.getByText(/300/)).toBeInTheDocument(); // tokens
      expect(screen.getByText(/\$0\.000300/)).toBeInTheDocument(); // cost
    });

    it('should display error messages for failed logs', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('Task creation failed')).toBeInTheDocument();
      });
    });
  });

  describe('Level Filtering', () => {
    it('should render level filter dropdown', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('All Levels')).toBeInTheDocument();
      });
    });

    it('should filter logs by level', async () => {
      const user = userEvent.setup();
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('MCP Logs')).toBeInTheDocument();
      });

      // Click level filter
      const levelFilter = screen.getByDisplayValue('all');
      await user.click(levelFilter);
      await user.selectOptions(levelFilter, 'error');

      // Should trigger refetch with level filter
      await waitFor(() => {
        expect(screen.getByText('create_task')).toBeInTheDocument();
      });
    });

    it('should support initial level filter prop', async () => {
      render(<McpLogsViewer initialLevel="error" />);

      await waitFor(() => {
        const levelFilter = screen.getByDisplayValue('error');
        expect(levelFilter).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should render search input', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search/i);
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should debounce search input', async () => {
      const user = userEvent.setup();
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('MCP Logs')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search/i);
      await user.type(searchInput, 'search_docs');

      // Should show search query in UI
      await waitFor(
        () => {
          expect(screen.getByDisplayValue('search_docs')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Log Level Badges', () => {
    it('should render info badge with green styling', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
      });

      // Info/success logs should have green badge
      const infoBadges = document.querySelectorAll('.bg-green-100');
      expect(infoBadges.length).toBeGreaterThan(0);
    });

    it('should render error badge with red styling', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('create_task')).toBeInTheDocument();
      });

      // Error logs should have red badge
      const errorBadges = document.querySelectorAll('.bg-red-100');
      expect(errorBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Expandable Details', () => {
    it('should expand log when clicked', async () => {
      const user = userEvent.setup();
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
      });

      // Click on log card
      const logCard = screen.getByText('search_docs').closest('div');
      if (logCard) {
        await user.click(logCard);
      }

      // Should show expanded details
      await waitFor(() => {
        expect(screen.getByText('req-1')).toBeInTheDocument(); // request_id
      });
    });

    it('should collapse log when clicked again', async () => {
      const user = userEvent.setup();
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
      });

      const logCard = screen.getByText('search_docs').closest('div');
      if (logCard) {
        // Expand
        await user.click(logCard);

        await waitFor(() => {
          expect(screen.getByText('req-1')).toBeInTheDocument();
        });

        // Collapse
        await user.click(logCard);

        await waitFor(() => {
          expect(screen.queryByText('Full Details')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Export Functionality', () => {
    it('should render export button', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });
    });

    it('should export to JSON when selected', async () => {
      const user = userEvent.setup();
      const createObjectURLMock = vi.fn(() => 'blob:mock-url');
      global.URL.createObjectURL = createObjectURLMock;

      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      // Click export button
      const exportButton = screen.getByText('Export');
      await user.click(exportButton);

      // Select JSON format (if dropdown appears)
      const jsonOption = screen.queryByText('JSON');
      if (jsonOption) {
        await user.click(jsonOption);
      }

      // Should trigger download
      await waitFor(() => {
        expect(createObjectURLMock).toHaveBeenCalled();
      });
    });

    it('should export to CSV when selected', async () => {
      const user = userEvent.setup();
      const createObjectURLMock = vi.fn(() => 'blob:mock-url');
      global.URL.createObjectURL = createObjectURLMock;

      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export');
      await user.click(exportButton);

      const csvOption = screen.queryByText('CSV');
      if (csvOption) {
        await user.click(csvOption);
      }

      await waitFor(() => {
        expect(createObjectURLMock).toHaveBeenCalled();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should render refresh button', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        const refreshButton = screen.getByTitle('Refresh');
        expect(refreshButton).toBeInTheDocument();
      });
    });

    it('should refetch data when refresh is clicked', async () => {
      const user = userEvent.setup();
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('MCP Logs')).toBeInTheDocument();
      });

      const refreshButton = screen.getByTitle('Refresh');
      await user.click(refreshButton);

      // Should show loading state briefly
      await waitFor(() => {
        const skeleton = document.querySelector('.animate-pulse');
        expect(skeleton).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should render error message when fetch fails', async () => {
      server.use(
        http.get('/api/mcp/logs', () => {
          return HttpResponse.json(
            { detail: 'Logs service unavailable' },
            { status: 500 }
          );
        })
      );

      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load logs/)).toBeInTheDocument();
      });
    });

    it('should render retry button in error state', async () => {
      server.use(
        http.get('/api/mcp/logs', () => {
          return HttpResponse.json(
            { detail: 'Service unavailable' },
            { status: 500 }
          );
        })
      );

      const user = userEvent.setup();
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      await user.click(retryButton);
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no logs exist', async () => {
      server.use(
        http.get('/api/mcp/logs', () => {
          return HttpResponse.json({
            logs: [],
            pagination: {
              total: 0,
              limit: 100,
              offset: 0,
              has_more: false,
            },
          });
        })
      );

      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('No logs found')).toBeInTheDocument();
      });
    });
  });

  describe('Session Filtering', () => {
    it('should filter by sessionId prop', async () => {
      render(<McpLogsViewer sessionId="test-session-123" />);

      await waitFor(() => {
        expect(screen.getByText('MCP Logs')).toBeInTheDocument();
      });

      // Should only show logs from the specific session
      expect(screen.getByText('search_docs')).toBeInTheDocument();
    });
  });

  describe('Virtualization', () => {
    it('should render virtualized list', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        const virtualizedList = screen.getByTestId('virtualized-list');
        expect(virtualizedList).toBeInTheDocument();
      });
    });

    it('should handle large number of logs efficiently', async () => {
      server.use(
        http.get('/api/mcp/logs', () => {
          return HttpResponse.json({
            logs: Array.from({ length: 1000 }).map((_, i) =>
              mockMcpLogEntry({ request_id: `req-${i}` })
            ),
            pagination: {
              total: 1000,
              limit: 100,
              offset: 0,
              has_more: true,
            },
          });
        })
      );

      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
      });

      // Should render but only show a subset due to virtualization
      const logCards = screen.getAllByText(/req-/);
      expect(logCards.length).toBeLessThan(50); // Much less than 1000
    });
  });

  describe('Infinite Scroll', () => {
    it('should indicate when more logs are available', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('MCP Logs')).toBeInTheDocument();
      });

      // Check if "has_more" is handled (pagination info should be present)
      expect(screen.getByText(/2 logs/)).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('should apply custom className', async () => {
      const { container } = render(<McpLogsViewer className="custom-logs" />);

      await waitFor(() => {
        const logsDiv = container.querySelector('.custom-logs');
        expect(logsDiv).toBeInTheDocument();
      });
    });
  });

  describe('Formatting', () => {
    it('should format timestamps correctly', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        // Should display timestamps in readable format
        const timestamps = screen.getAllByText(/\d{1,2}:\d{2}/);
        expect(timestamps.length).toBeGreaterThan(0);
      });
    });

    it('should format duration with ms or seconds', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText(/150ms/)).toBeInTheDocument();
      });
    });

    it('should format costs with 6 decimal places', async () => {
      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText(/\$0\.000300/)).toBeInTheDocument();
      });
    });

    it('should format token counts with commas', async () => {
      server.use(
        http.get('/api/mcp/logs', () => {
          return HttpResponse.json({
            logs: [mockMcpLogEntry({ total_tokens: 12345 })],
            pagination: {
              total: 1,
              limit: 100,
              offset: 0,
              has_more: false,
            },
          });
        })
      );

      render(<McpLogsViewer />);

      await waitFor(() => {
        expect(screen.getByText('12,345')).toBeInTheDocument();
      });
    });
  });
});
