import { useState, useCallback } from "react";

export interface AsyncTaskState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}

export interface UseAsyncTaskReturn<T, Args extends unknown[]> {
  execute: (...args: Args) => Promise<T | null>;
  reset: () => void;
  state: AsyncTaskState<T>;
}

/**
 * Hook for managing async operations with loading, error, and success states
 *
 * @example
 * const { execute, state } = useAsyncTask(async (id: string) => {
 *   return await api.fetchProject(id);
 * });
 *
 * // Later in component:
 * onClick={() => execute(projectId)}
 *
 * if (state.isLoading) return <Spinner />;
 * if (state.isError) return <Error message={state.error?.message} />;
 * if (state.isSuccess) return <div>{state.data}</div>;
 */
export function useAsyncTask<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>
): UseAsyncTaskReturn<T, Args> {
  const [state, setState] = useState<AsyncTaskState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
  });

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState({
        data: null,
        error: null,
        isLoading: true,
        isError: false,
        isSuccess: false,
      });

      try {
        const result = await asyncFunction(...args);
        setState({
          data: result,
          error: null,
          isLoading: false,
          isError: false,
          isSuccess: true,
        });
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState({
          data: null,
          error: err,
          isLoading: false,
          isError: true,
          isSuccess: false,
        });
        return null;
      }
    },
    [asyncFunction]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isError: false,
      isSuccess: false,
    });
  }, []);

  return { execute, reset, state };
}
