import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBooleanState } from '../useBooleanState';

describe('useBooleanState', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useBooleanState(false));
    expect(result.current.value).toBe(false);
  });

  it('should initialize with true', () => {
    const { result } = renderHook(() => useBooleanState(true));
    expect(result.current.value).toBe(true);
  });

  it('should set value to true', () => {
    const { result } = renderHook(() => useBooleanState(false));

    act(() => {
      result.current.setTrue();
    });

    expect(result.current.value).toBe(true);
  });

  it('should set value to false', () => {
    const { result } = renderHook(() => useBooleanState(true));

    act(() => {
      result.current.setFalse();
    });

    expect(result.current.value).toBe(false);
  });

  it('should toggle value from false to true', () => {
    const { result } = renderHook(() => useBooleanState(false));

    act(() => {
      result.current.toggle();
    });

    expect(result.current.value).toBe(true);
  });

  it('should toggle value from true to false', () => {
    const { result } = renderHook(() => useBooleanState(true));

    act(() => {
      result.current.toggle();
    });

    expect(result.current.value).toBe(false);
  });

  it('should toggle multiple times', () => {
    const { result } = renderHook(() => useBooleanState(false));

    act(() => {
      result.current.toggle();
    });
    expect(result.current.value).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.value).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.value).toBe(true);
  });

  it('should maintain value after setTrue when already true', () => {
    const { result } = renderHook(() => useBooleanState(true));

    act(() => {
      result.current.setTrue();
    });

    expect(result.current.value).toBe(true);
  });

  it('should maintain value after setFalse when already false', () => {
    const { result } = renderHook(() => useBooleanState(false));

    act(() => {
      result.current.setFalse();
    });

    expect(result.current.value).toBe(false);
  });
});
