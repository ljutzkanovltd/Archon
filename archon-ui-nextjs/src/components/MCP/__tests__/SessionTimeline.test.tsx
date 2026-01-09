import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { SessionTimeline } from '../SessionTimeline';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';
import { mockMcpSessionDetails, mockMcpRequest } from '@/test/test-utils';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('SessionTimeline', () => {
  const sessionId = 'test-session-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading spinner while fetching data', () => {
      render(<SessionTimeline sessionId={sessionId} />);

      expect(screen.getByText('Loading timeline...')).toBeInTheDocument();
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should respect custom height prop in loading state', () => {
      const { container } = render(<SessionTimeline sessionId={sessionId} height={600} />);

      const loadingDiv = container.querySelector('[style*="height"]');
      expect(loadingDiv).toHaveStyle({ height: '600px' });
    });
  });

  describe('Success State', () => {
    it('should render timeline with events', async () => {
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('Session Timeline')).toBeInTheDocument();
      });

      // Check timeline header
      expect(screen.getByText(/5 events/)).toBeInTheDocument();
      expect(screen.getByText(/duration/)).toBeInTheDocument();
    });

    it('should render start and end markers', async () => {
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('Start')).toBeInTheDocument();
        expect(screen.getByText('End')).toBeInTheDocument();
      });
    });

    it('should render event cards with tool names', async () => {
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
        expect(screen.getByText('create_task')).toBeInTheDocument();
      });
    });
  });

  describe('Zoom Controls', () => {
    it('should render zoom controls with initial 100% zoom', async () => {
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });

    it('should zoom in when zoom in button is clicked', async () => {
      const user = userEvent.setup();
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      const zoomInButton = screen.getByTitle('Zoom in');
      await user.click(zoomInButton);

      await waitFor(() => {
        expect(screen.getByText('125%')).toBeInTheDocument();
      });
    });

    it('should zoom out when zoom out button is clicked', async () => {
      const user = userEvent.setup();
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      const zoomOutButton = screen.getByTitle('Zoom out');
      await user.click(zoomOutButton);

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument();
      });
    });

    it('should reset zoom when reset button is clicked', async () => {
      const user = userEvent.setup();
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      // Zoom in first
      const zoomInButton = screen.getByTitle('Zoom in');
      await user.click(zoomInButton);

      await waitFor(() => {
        expect(screen.getByText('125%')).toBeInTheDocument();
      });

      // Reset zoom
      const resetButton = screen.getByTitle('Reset zoom');
      await user.click(resetButton);

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });
    });

    it('should disable zoom in button at max zoom (300%)', async () => {
      const user = userEvent.setup();
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      const zoomInButton = screen.getByTitle('Zoom in');

      // Click zoom in 8 times (100% + 25% * 8 = 300%)
      for (let i = 0; i < 8; i++) {
        await user.click(zoomInButton);
      }

      await waitFor(() => {
        expect(zoomInButton).toBeDisabled();
      });
    });

    it('should disable zoom out button at min zoom (50%)', async () => {
      const user = userEvent.setup();
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      const zoomOutButton = screen.getByTitle('Zoom out');

      // Click zoom out twice (100% - 25% * 2 = 50%)
      await user.click(zoomOutButton);
      await user.click(zoomOutButton);

      await waitFor(() => {
        expect(zoomOutButton).toBeDisabled();
      });
    });
  });

  describe('Event Modal', () => {
    it('should open modal when event dot is clicked', async () => {
      const user = userEvent.setup();
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
      });

      // Find and click event card
      const eventCard = screen.getByText('search_docs').closest('div');
      if (eventCard) {
        await user.click(eventCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Event Details')).toBeInTheDocument();
      });
    });

    it('should display event details in modal', async () => {
      const user = userEvent.setup();
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
      });

      // Click event to open modal
      const eventCard = screen.getByText('search_docs').closest('div');
      if (eventCard) {
        await user.click(eventCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Tool Name')).toBeInTheDocument();
        expect(screen.getByText('Method')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Duration')).toBeInTheDocument();
        expect(screen.getByText('Token Usage')).toBeInTheDocument();
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

      render(<SessionTimeline sessionId="error-session" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load timeline')).toBeInTheDocument();
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

      const user = userEvent.setup();
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByText('Retry');
      await user.click(retryButton);

      // Should trigger refetch
      await waitFor(() => {
        expect(screen.getByText('Loading timeline...')).toBeInTheDocument();
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
          });
        })
      );

      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('No events yet')).toBeInTheDocument();
        expect(
          screen.getByText('Timeline will populate when requests are made')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Event Colors', () => {
    it('should render success events with green color', async () => {
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('search_docs')).toBeInTheDocument();
      });

      // Success events should have green background
      const successDots = document.querySelectorAll('.bg-green-500');
      expect(successDots.length).toBeGreaterThan(0);
    });

    it('should render error events with red color', async () => {
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        expect(screen.getByText('create_task')).toBeInTheDocument();
      });

      // Error events should have red background
      const errorDots = document.querySelectorAll('.bg-red-500');
      expect(errorDots.length).toBeGreaterThan(0);
    });
  });

  describe('Time Formatting', () => {
    it('should format timestamps correctly', async () => {
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        // Should display time in HH:MM:SS format
        const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
        expect(timeElements.length).toBeGreaterThan(0);
      });
    });

    it('should format duration correctly', async () => {
      render(<SessionTimeline sessionId={sessionId} />);

      await waitFor(() => {
        // Should display duration with ms or s
        expect(screen.getByText(/150ms/)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('should render timeline with default height of 400px', () => {
      const { container } = render(<SessionTimeline sessionId={sessionId} />);

      const timeline = container.querySelector('[style*="height"]');
      expect(timeline).toBeTruthy();
    });

    it('should apply custom className', async () => {
      const { container } = render(
        <SessionTimeline sessionId={sessionId} className="custom-class" />
      );

      await waitFor(() => {
        const timeline = container.querySelector('.custom-class');
        expect(timeline).toBeInTheDocument();
      });
    });
  });
});
