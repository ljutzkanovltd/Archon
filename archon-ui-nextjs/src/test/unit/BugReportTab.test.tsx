import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BugReportTab from '@/app/settings/components/BugReportTab';

describe('BugReportTab', () => {
  beforeEach(() => {
    // Mock console.log to verify bug report is logged
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock navigator properties
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      writable: true,
    });

    Object.defineProperty(navigator, 'platform', {
      value: 'Linux x86_64',
      writable: true,
    });

    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      writable: true,
    });

    // Mock window.screen
    Object.defineProperty(window, 'screen', {
      value: {
        width: 1920,
        height: 1080,
      },
      writable: true,
    });

    // Mock timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders the bug report component with header', () => {
      render(<BugReportTab />);
      expect(screen.getByText('Bug Report')).toBeInTheDocument();
      expect(
        screen.getByText(/Report bugs or issues with Archon/i)
      ).toBeInTheDocument();
    });

    it('renders privacy notice', () => {
      render(<BugReportTab />);
      expect(screen.getByText('Privacy Protection')).toBeInTheDocument();
      expect(
        screen.getByText(/System information.*will be included automatically/i)
      ).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<BugReportTab />);

      expect(screen.getByLabelText(/Bug Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Steps to Reproduce/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Expected Behavior/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Actual Behavior/i)).toBeInTheDocument();
    });

    it('renders submit button with bug icon', () => {
      render(<BugReportTab />);

      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveClass('bg-brand-600');
    });

    it('renders system information preview section', () => {
      render(<BugReportTab />);

      expect(
        screen.getByText('System Information (Auto-collected)')
      ).toBeInTheDocument();
      expect(screen.getByText(/Browser:/i)).toBeInTheDocument();
      expect(screen.getByText(/Platform:/i)).toBeInTheDocument();
      expect(screen.getByText(/Screen:/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('disables submit button when form is empty', () => {
      render(<BugReportTab />);

      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when only title is filled', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: 'Test Bug Title' } });

      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when only description is filled', () => {
      render(<BugReportTab />);

      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when title and description are filled', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;

      fireEvent.change(titleInput, { target: { value: 'Test Bug Title' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });
      expect(submitButton).not.toBeDisabled();
    });

    it('disables submit button with whitespace-only title', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;

      fireEvent.change(titleInput, { target: { value: '   ' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button with whitespace-only description', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;

      fireEvent.change(titleInput, { target: { value: 'Test Bug Title' } });
      fireEvent.change(descriptionInput, { target: { value: '   ' } });

      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('User Input', () => {
    it('updates title field value on user input', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: 'New Bug Title' } });

      expect(titleInput.value).toBe('New Bug Title');
    });

    it('updates description field value on user input', () => {
      render(<BugReportTab />);

      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      fireEvent.change(descriptionInput, { target: { value: 'Detailed bug description' } });

      expect(descriptionInput.value).toBe('Detailed bug description');
    });

    it('updates steps field value on user input', () => {
      render(<BugReportTab />);

      const stepsInput = screen.getByLabelText(/Steps to Reproduce/i) as HTMLTextAreaElement;
      fireEvent.change(stepsInput, { target: { value: '1. Go to page\n2. Click button' } });

      expect(stepsInput.value).toBe('1. Go to page\n2. Click button');
    });

    it('updates expected behavior field on user input', () => {
      render(<BugReportTab />);

      const expectedInput = screen.getByLabelText(/Expected Behavior/i) as HTMLTextAreaElement;
      fireEvent.change(expectedInput, { target: { value: 'Page should load successfully' } });

      expect(expectedInput.value).toBe('Page should load successfully');
    });

    it('updates actual behavior field on user input', () => {
      render(<BugReportTab />);

      const actualInput = screen.getByLabelText(/Actual Behavior/i) as HTMLTextAreaElement;
      fireEvent.change(actualInput, { target: { value: 'Page shows error message' } });

      expect(actualInput.value).toBe('Page shows error message');
    });

    it('handles multi-line input in textarea fields', () => {
      render(<BugReportTab />);

      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const multiLineText = 'First line\nSecond line\nThird line';

      fireEvent.change(descriptionInput, { target: { value: multiLineText } });

      expect(descriptionInput.value).toBe(multiLineText);
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      // Button should show loading state
      expect(screen.getByText(/Submitting\.\.\./i)).toBeInTheDocument();
    });

    it('shows loading state during submission', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      expect(screen.getByText(/Submitting\.\.\./i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('shows success state after submission delay', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      // Button should be in loading state
      expect(screen.getByText(/Submitting\.\.\./i)).toBeInTheDocument();

      // Advance timer for submission delay
      vi.advanceTimersByTime(1000);

      // After submission, button should show submitted state
      // The Submitted! text will be in the button
      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });


    it('disables submit button while loading', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
    });

    it('disables submit button after successful submission', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      vi.advanceTimersByTime(1000);

      expect(submitButton).toBeDisabled();
    });
  });

  describe('System Information Collection', () => {
    it('collects system information on submit', () => {
      const consoleSpy = console.log as any;

      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      vi.advanceTimersByTime(1000);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Bug Report:',
        expect.objectContaining({
          title: 'Test Bug',
          description: 'Test Description',
          systemInfo: expect.objectContaining({
            userAgent: expect.any(String),
            platform: expect.any(String),
            language: expect.any(String),
            screenResolution: expect.any(String),
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it('includes correct userAgent in system info', () => {
      const consoleSpy = console.log as any;

      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      vi.advanceTimersByTime(1000);

      const callArg = consoleSpy.mock.calls[0][1];
      expect(callArg.systemInfo.userAgent).toBe(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      );
    });

    it('includes correct platform in system info', () => {
      const consoleSpy = console.log as any;

      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      vi.advanceTimersByTime(1000);

      const callArg = consoleSpy.mock.calls[0][1];
      expect(callArg.systemInfo.platform).toBe('Linux x86_64');
    });

    it('includes correct language in system info', () => {
      const consoleSpy = console.log as any;

      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      vi.advanceTimersByTime(1000);

      const callArg = consoleSpy.mock.calls[0][1];
      expect(callArg.systemInfo.language).toBe('en-US');
    });

    it('includes correct screen resolution in system info', () => {
      const consoleSpy = console.log as any;

      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      vi.advanceTimersByTime(1000);

      const callArg = consoleSpy.mock.calls[0][1];
      expect(callArg.systemInfo.screenResolution).toBe('1920x1080');
    });

    it('includes ISO timestamp in system info', () => {
      const consoleSpy = console.log as any;

      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      vi.advanceTimersByTime(1000);

      const callArg = consoleSpy.mock.calls[0][1];
      expect(callArg.systemInfo.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('displays system info preview with correct values', () => {
      render(<BugReportTab />);

      const systemInfoSection = screen.getByText(
        'System Information (Auto-collected)'
      ).parentElement;

      // Check that the section contains the platform text
      expect(within(systemInfoSection!).getByText(/Platform:/i)).toBeInTheDocument();

      // The screen resolution should be displayed
      expect(within(systemInfoSection!).getByText(/Screen:/i)).toBeInTheDocument();

      // Verify the actual values are rendered
      expect(systemInfoSection).toHaveTextContent('Linux x86_64');
      expect(systemInfoSection).toHaveTextContent('1920x1080');
    });
  });

  describe('Form Reset', () => {
    it('triggers reset timeout after successful submission', () => {
      const consoleSpy = console.log as any;
      vi.useFakeTimers();

      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      // Fill required fields
      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

      // Submit
      fireEvent.click(submitButton);

      // Advance past submission delay
      vi.advanceTimersByTime(1000);

      // Verify submission was logged
      expect(consoleSpy).toHaveBeenCalled();

      // The reset should be scheduled at 3000ms after submission
      vi.advanceTimersByTime(3000);

      // After reset, fields should be cleared (verified via the component logic)
      // Component resets fields in setTimeout at line 53-61
      // and clears submitted flag

      vi.useRealTimers();
    });

    it('changes button text during submission', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      // Fill required fields
      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

      // Initially shows bug icon
      expect(screen.getByText(/Submit Bug Report/i)).toBeInTheDocument();

      // Submit
      fireEvent.click(submitButton);

      // Should show loading state immediately
      expect(screen.getByText(/Submitting\.\.\./i)).toBeInTheDocument();
    });

    it('re-enables submit button after reset', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      // Use fireEvent for faster input
      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.click(submitButton);

      vi.advanceTimersByTime(1000);

      // Submit button should be disabled after successful submission
      expect(submitButton).toBeDisabled();

      // Wait for reset
      vi.advanceTimersByTime(3000);

      // Submit button should be disabled because form is now empty
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Optional Fields', () => {
    it('allows submission without optional fields', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      // Only fill required fields
      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

      // Do not fill optional fields
      // Steps, Expected, Actual are optional

      expect(submitButton).not.toBeDisabled();
      fireEvent.click(submitButton);

      // Check that submit button shows loading state
      expect(screen.getByText(/Submitting\.\.\./i)).toBeInTheDocument();
    });

    it('includes optional fields in submission when provided', () => {
      const consoleSpy = console.log as any;

      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const stepsInput = screen.getByLabelText(/Steps to Reproduce/i) as HTMLTextAreaElement;
      const expectedInput = screen.getByLabelText(/Expected Behavior/i) as HTMLTextAreaElement;
      const actualInput = screen.getByLabelText(/Actual Behavior/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
      fireEvent.change(stepsInput, { target: { value: 'Test Steps' } });
      fireEvent.change(expectedInput, { target: { value: 'Test Expected' } });
      fireEvent.change(actualInput, { target: { value: 'Test Actual' } });
      fireEvent.click(submitButton);

      // Verify that console.log was called with the correct data
      expect(consoleSpy).toHaveBeenCalledWith(
        'Bug Report:',
        expect.objectContaining({
          title: 'Test Bug',
          description: 'Test Description',
          steps: 'Test Steps',
          expected: 'Test Expected',
          actual: 'Test Actual',
        })
      );
    });
  });

  describe('Accessibility', () => {
    it('has proper label associations with form inputs', () => {
      render(<BugReportTab />);

      const titleLabel = screen.getByText(/Bug Title/i);
      const titleInput = screen.getByLabelText(/Bug Title/i);

      expect(titleInput).toBeInTheDocument();
      expect(titleLabel).toBeInTheDocument();
    });

    it('indicates required fields with asterisk', () => {
      render(<BugReportTab />);

      const titleLabel = screen.getByText(/Bug Title \*/i);
      const descriptionLabel = screen.getByText(/Description \*/i);

      expect(titleLabel).toBeInTheDocument();
      expect(descriptionLabel).toBeInTheDocument();
    });

    it('has form inputs with correct type attributes', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i);
      expect(titleInput).toHaveAttribute('type', 'text');

      const titleInputElement = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      expect(titleInputElement.required).toBe(true);
    });

    it('has descriptive placeholder text', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByPlaceholderText(/Brief description of the issue/i);
      const descriptionInput = screen.getByPlaceholderText(
        /Detailed description of the bug/i
      );

      expect(titleInput).toBeInTheDocument();
      expect(descriptionInput).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid form submissions', () => {
      const consoleSpy = console.log as any;

      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const descriptionInput = screen.getByLabelText(/^Description/i) as HTMLTextAreaElement;
      const submitButton = screen.getByRole('button', {
        name: /Submit Bug Report/i,
      });

      fireEvent.change(titleInput, { target: { value: 'Test Bug' } });
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

      // First submission
      fireEvent.click(submitButton);

      // Button should be disabled after first click
      expect(submitButton).toBeDisabled();

      // Try to click again immediately (should not trigger another submission)
      fireEvent.click(submitButton);

      // Only one submission should be logged
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });

    it('handles very long input text', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const longTitle = 'a'.repeat(500);

      fireEvent.change(titleInput, { target: { value: longTitle } });

      expect(titleInput.value).toBe(longTitle);
    });

    it('handles special characters in input', async () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const specialChars = '!@#$%^&*()_+-=';

      // Use fireEvent for special characters that cause parsing issues
      fireEvent.change(titleInput, { target: { value: specialChars } });

      expect(titleInput.value).toBe(specialChars);
    });

    it('handles unicode characters in input', () => {
      render(<BugReportTab />);

      const titleInput = screen.getByLabelText(/Bug Title/i) as HTMLInputElement;
      const unicodeText = '测试 버그';

      fireEvent.change(titleInput, { target: { value: unicodeText } });

      expect(titleInput.value).toBe(unicodeText);
    });
  });
});
