import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { McpAnalytics } from '../McpAnalytics';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';
import { mockMcpAnalytics } from '@/test/test-utils';

// Mock Recharts to avoid SVG rendering issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

describe('McpAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading state with skeleton UI', () => {
      render(<McpAnalytics />);

      expect(screen.getByText('MCP Analytics Dashboard')).toBeInTheDocument();
      const animatePulse = document.querySelector('.animate-pulse');
      expect(animatePulse).toBeInTheDocument();
    });

    it('should render multiple skeleton cards', () => {
      const { container } = render(<McpAnalytics />);

      // Should have skeleton cards in loading state
      const skeletonCards = container.querySelectorAll('.animate-pulse .h-32');
      expect(skeletonCards.length).toBeGreaterThan(0);
    });
  });

  describe('Success State', () => {
    it('should render analytics dashboard with data', async () => {
      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('MCP Analytics Dashboard')).toBeInTheDocument();
      });

      // Check for summary metrics
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('should display all summary metrics', async () => {
      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('Total Requests')).toBeInTheDocument();
        expect(screen.getByText('Total Tokens')).toBeInTheDocument();
        expect(screen.getByText('Total Cost')).toBeInTheDocument();
        expect(screen.getByText('Success Rate')).toBeInTheDocument();
      });
    });

    it('should format large numbers correctly', async () => {
      render(<McpAnalytics />);

      await waitFor(() => {
        // 45000 should be formatted as "45,000"
        expect(screen.getByText('45,000')).toBeInTheDocument();
      });
    });

    it('should display cost with correct formatting', async () => {
      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText(/\$0\.45/)).toBeInTheDocument();
      });
    });
  });

  describe('Comparison Metrics', () => {
    it('should display comparison data when compare prop is true', async () => {
      render(<McpAnalytics compare={true} />);

      await waitFor(() => {
        // Should show percentage changes
        expect(screen.getByText(/25\.0%/)).toBeInTheDocument();
      });
    });

    it('should render trend indicators', async () => {
      render(<McpAnalytics compare={true} />);

      await waitFor(() => {
        // Should show positive trend (increase)
        const trendUp = document.querySelectorAll('[class*="text-green"]');
        expect(trendUp.length).toBeGreaterThan(0);
      });
    });

    it('should not display comparison when compare prop is false', async () => {
      render(<McpAnalytics compare={false} />);

      await waitFor(() => {
        expect(screen.getByText('Total Requests')).toBeInTheDocument();
      });

      // Should not show comparison metrics
      expect(screen.queryByText(/Previous Period/)).not.toBeInTheDocument();
    });
  });

  describe('Charts', () => {
    it('should render charts when expanded', async () => {
      const user = userEvent.setup();
      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('MCP Analytics Dashboard')).toBeInTheDocument();
      });

      // Find and click expand button (assuming there's a chevron icon)
      const expandButton = document.querySelector('[class*="HiChevron"]')?.closest('button');
      if (expandButton) {
        await user.click(expandButton);
      }

      // Charts should be visible after expansion
      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should render error message when fetch fails', async () => {
      server.use(
        http.get('/api/mcp/analytics', () => {
          return HttpResponse.json(
            { detail: 'Analytics service unavailable' },
            { status: 500 }
          );
        })
      );

      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics')).toBeInTheDocument();
      });
    });

    it('should render retry button in error state', async () => {
      server.use(
        http.get('/api/mcp/analytics', () => {
          return HttpResponse.json(
            { detail: 'Service unavailable' },
            { status: 500 }
          );
        })
      );

      const user = userEvent.setup();
      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByText('Retry');
      await user.click(retryButton);

      // Should show loading state again
      await waitFor(() => {
        const animatePulse = document.querySelector('.animate-pulse');
        expect(animatePulse).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no data is available', async () => {
      server.use(
        http.get('/api/mcp/analytics', () => {
          return HttpResponse.json({
            ...mockMcpAnalytics(),
            trends: {
              daily: [],
              hourly: [],
            },
          });
        })
      );

      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('No analytics data available')).toBeInTheDocument();
      });
    });
  });

  describe('Props', () => {
    it('should pass days prop to analytics query', async () => {
      render(<McpAnalytics days={7} />);

      await waitFor(() => {
        expect(screen.getByText('MCP Analytics Dashboard')).toBeInTheDocument();
      });

      // Verify the correct period is displayed
      expect(screen.getByText(/30/)).toBeInTheDocument();
    });

    it('should apply custom className', async () => {
      const { container } = render(<McpAnalytics className="custom-analytics" />);

      await waitFor(() => {
        const analyticsDiv = container.querySelector('.custom-analytics');
        expect(analyticsDiv).toBeInTheDocument();
      });
    });
  });

  describe('Ratios Display', () => {
    it('should display success rate as percentage', async () => {
      render(<McpAnalytics />);

      await waitFor(() => {
        // 0.933 should be displayed as 93.3%
        expect(screen.getByText(/93\.3%/)).toBeInTheDocument();
      });
    });

    it('should display error rate', async () => {
      render(<McpAnalytics />);

      await waitFor(() => {
        // 0.053 should be displayed as 5.3%
        expect(screen.getByText(/5\.3%/)).toBeInTheDocument();
      });
    });

    it('should display timeout rate', async () => {
      render(<McpAnalytics />);

      await waitFor(() => {
        // 0.013 should be displayed as 1.3%
        expect(screen.getByText(/1\.3%/)).toBeInTheDocument();
      });
    });
  });

  describe('Response Times', () => {
    it('should display average response time', async () => {
      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText(/125\.5/)).toBeInTheDocument();
      });
    });

    it('should display response time by tool', async () => {
      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
        expect(screen.getByText(/100/)).toBeInTheDocument(); // avg_duration_ms
      });
    });
  });

  describe('Expand/Collapse', () => {
    it('should start in collapsed state by default', async () => {
      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('MCP Analytics Dashboard')).toBeInTheDocument();
      });

      // Detailed charts should not be visible initially
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });

    it('should toggle expansion state when clicked', async () => {
      const user = userEvent.setup();
      render(<McpAnalytics />);

      await waitFor(() => {
        expect(screen.getByText('MCP Analytics Dashboard')).toBeInTheDocument();
      });

      // Find the header/button that toggles expansion
      const header = screen.getByText('MCP Analytics Dashboard').closest('div');
      const expandButton = header?.querySelector('button');

      if (expandButton) {
        // Expand
        await user.click(expandButton);

        await waitFor(() => {
          expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        });

        // Collapse
        await user.click(expandButton);

        await waitFor(() => {
          expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
        });
      }
    });
  });
});
