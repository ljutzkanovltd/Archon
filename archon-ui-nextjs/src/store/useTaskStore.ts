import { create } from "zustand";
import { tasksApi, ApiError } from "@/lib/apiClient";
import { Task } from "@/lib/types";

interface TaskState {
  tasks: Task[];
  selectedTask: Task | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}

interface TaskActions {
  fetchTasks: (params?: {
    page?: number;
    per_page?: number;
    query?: string;
    filter_by?: "status" | "project" | "assignee";
    filter_value?: string;
    project_id?: string;
    include_closed?: boolean;
  }) => Promise<void>;
  fetchTaskById: (id: string) => Promise<void>;
  createTask: (data: {
    project_id: string;
    title: string;
    description?: string;
    status?: "todo" | "doing" | "review" | "done";
    assignee?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    feature?: string;
  }) => Promise<Task>;
  updateTask: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      status: "todo" | "doing" | "review" | "done";
      assignee: string;
      priority: "low" | "medium" | "high" | "urgent";
      feature: string;
    }>
  ) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  archiveTask: (id: string, archived_by: string) => Promise<void>;
  unarchiveTask: (id: string) => Promise<void>;
  setSelectedTask: (task: Task | null) => void;
  clearError: () => void;
}

type TaskStore = TaskState & TaskActions;

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  selectedTask: null,
  isLoading: false,
  error: null,
  pagination: { page: 1, per_page: 10, total: 0 },

  fetchTasks: async (params) => {
    console.log('[Task Store] Fetching tasks with params:', params);
    set({ isLoading: true, error: null });
    try {
      const response = await tasksApi.getAll(params);
      console.log('[Task Store] API Response:', response);
      console.log('[Task Store] Tasks loaded:', response.items.length);
      set({
        tasks: response.items,
        pagination: {
          page: response.page,
          per_page: response.per_page,
          total: response.total,
        },
        isLoading: false,
      });
    } catch (error) {
      const apiError = error as ApiError;
      console.error('[Task Store] Error:', apiError);
      set({
        tasks: [],
        isLoading: false,
        error: apiError.message || "Failed to fetch tasks",
      });
    }
  },

  fetchTaskById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const task = await tasksApi.getById(id);
      set({ selectedTask: task, isLoading: false });
    } catch (error) {
      const apiError = error as ApiError;
      set({
        selectedTask: null,
        isLoading: false,
        error: apiError.message || "Failed to fetch task",
      });
    }
  },

  createTask: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const newTask = await tasksApi.create(data);
      set((state) => ({
        tasks: [newTask, ...state.tasks],
        pagination: {
          ...state.pagination,
          total: state.pagination.total + 1,
        },
        isLoading: false,
      }));
      return newTask;
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to create task",
      });
      throw error;
    }
  },

  updateTask: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const updatedTask = await tasksApi.update(id, data);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updatedTask : t)),
        selectedTask:
          state.selectedTask?.id === id ? updatedTask : state.selectedTask,
        isLoading: false,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to update task",
      });
      throw error;
    }
  },

  deleteTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await tasksApi.delete(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1),
        },
        selectedTask: state.selectedTask?.id === id ? null : state.selectedTask,
        isLoading: false,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to delete task",
      });
      throw error;
    }
  },

  archiveTask: async (id, archived_by) => {
    set({ isLoading: true, error: null });
    try {
      await tasksApi.archive(id, archived_by);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, archived: true, archived_by } : t
        ),
        selectedTask:
          state.selectedTask?.id === id
            ? { ...state.selectedTask, archived: true, archived_by }
            : state.selectedTask,
        isLoading: false,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to archive task",
      });
      throw error;
    }
  },

  unarchiveTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await tasksApi.unarchive(id);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, archived: false, archived_by: undefined } : t
        ),
        selectedTask:
          state.selectedTask?.id === id
            ? { ...state.selectedTask, archived: false, archived_by: undefined }
            : state.selectedTask,
        isLoading: false,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to unarchive task",
      });
      throw error;
    }
  },

  setSelectedTask: (task) => set({ selectedTask: task }),
  clearError: () => set({ error: null }),
}));

export const useTasks = () => useTaskStore((state) => state.tasks);
export const useSelectedTask = () => useTaskStore((state) => state.selectedTask);
export const useTasksLoading = () => useTaskStore((state) => state.isLoading);
export const useTasksError = () => useTaskStore((state) => state.error);
