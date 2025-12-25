import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 500));
    expect(result.current).toBe('test');
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // Change value
    act(() => {
      rerender({ value: 'updated', delay: 500 });
    });

    // Value should still be initial (not debounced yet)
    expect(result.current).toBe('initial');

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now value should be updated
    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    // First change
    act(() => {
      rerender({ value: 'change1', delay: 500 });
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Second change before debounce completes (timer should reset)
    act(() => {
      rerender({ value: 'change2', delay: 500 });
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Should still be initial (timer was reset, only 250ms passed since last change)
    expect(result.current).toBe('initial');

    // Complete the debounce (need another 250ms)
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Now it should be change2
    expect(result.current).toBe('change2');
  });

  it('should handle delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'test', delay: 500 } }
    );

    // Change delay
    act(() => {
      rerender({ value: 'updated', delay: 1000 });
    });

    // Advance by old delay (should not update yet)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('test');

    // Advance by remaining time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('should cleanup timer on unmount', () => {
    const { unmount } = renderHook(() => useDebounce('test', 500));

    // Unmount before debounce completes
    unmount();

    // Advance timers (should not throw)
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(500);
      });
    }).not.toThrow();
  });
});
