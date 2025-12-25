/**
 * Task Hooks
 *
 * Business logic hooks for task management operations.
 * These hooks encapsulate the business logic that should NOT live in components.
 */

// Business logic hooks
export { useTaskActions } from "./useTaskActions";
export { useTaskEditor } from "./useTaskEditor";

// TanStack Query hooks
export {
  taskKeys,
  useArchiveTask,
  useCreateTask,
  useDeleteTask,
  useProjectTasks,
  useTaskCounts,
  useUnarchiveTask,
  useUpdateTask,
} from "./useTaskQueries";
