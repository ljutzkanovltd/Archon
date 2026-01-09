// Custom hooks barrel export
export { useAsyncTask } from "./useAsyncTask";
export type { AsyncTaskState, UseAsyncTaskReturn } from "./useAsyncTask";

export {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsLargeDesktop,
} from "./useMediaQuery";

export { useDebounce, useDebouncedCallback } from "./useDebounce";

export { usePageTitle, useTemporaryPageTitle } from "./usePageTitle";

export {
  useClickOutside,
  useClickOutsideMultiple,
} from "./useClickOutside";

export { useBooleanState, useBooleanFlags } from "./useBooleanState";
export type { BooleanState } from "./useBooleanState";

export { useSmartPolling } from "./useSmartPolling";
export type { UseSmartPollingOptions } from "./useSmartPolling";

export {
  useProgressList,
  useProgress,
  useActiveOperationsCount,
  useMultipleProgress,
} from "./useProgressQueries";

export {
  useMcpStatus,
  useMcpConfig,
  useMcpClients,
  useMcpSessionInfo,
  useMcpUsageStats,
  useMcpAnalytics,
  useMcpLogs,
  mcpKeys,
} from "./useMcpQueries";

export { useTaskCounts } from "./useTaskCounts";
export type { TaskCounts } from "./useTaskCounts";

export { useActiveUsers } from "./useActiveUsers";

export { useQueryParams, useQueryParam } from "./useQueryParams";
export type { QueryParamSchema, UpdateQueryParamsOptions } from "./useQueryParams";
