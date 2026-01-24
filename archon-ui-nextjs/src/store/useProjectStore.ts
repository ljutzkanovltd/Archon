import { create } from "zustand";
import { projectsApi, ApiError } from "@/lib/apiClient";
import { Project } from "@/lib/types";

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}

interface ProjectActions {
  fetchProjects: (params?: {
    page?: number;
    per_page?: number;
    query?: string;
    include_archived?: boolean;
  }) => Promise<void>;
  fetchProjectById: (id: string) => Promise<void>;
  createProject: (data: {
    title: string;
    description?: string;
    github_repo?: string;
  }) => Promise<Project>;
  updateProject: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      github_repo: string;
    }>
  ) => Promise<void>;
  archiveProject: (id: string, archived_by: string) => Promise<void>;
  unarchiveProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setSelectedProject: (project: Project | null) => void;
  clearError: () => void;
}

type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initial state
  projects: [],
  selectedProject: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    per_page: 10,
    total: 0,
  },

  // Fetch all projects
  fetchProjects: async (params) => {
    // Prevent duplicate simultaneous fetches (race condition protection)
    const state = get();
    if (state.isLoading) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Project Store] Skipping duplicate fetch - already loading');
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Project Store] Fetching projects with params:', params);
    }
    set({ isLoading: true, error: null });

    try {
      const response = await projectsApi.getAll(params);
      if (process.env.NODE_ENV === 'development') {
        console.log('[Project Store] API Response:', response);
      }

      set({
        projects: response.items,
        pagination: {
          page: response.page,
          per_page: response.per_page,
          total: response.total,
        },
        isLoading: false,
        error: null,
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('[Project Store] Projects loaded:', response.items.length);
      }
    } catch (error) {
      const apiError = error as ApiError;
      console.error('[Project Store] Error:', apiError);
      set({
        projects: [],
        isLoading: false,
        error: apiError.message || "Failed to fetch projects",
      });
    }
  },

  // Fetch project by ID
  fetchProjectById: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const project = await projectsApi.getById(id);

      set({
        selectedProject: project,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const apiError = error as ApiError;
      set({
        selectedProject: null,
        isLoading: false,
        error: apiError.message || "Failed to fetch project",
      });
    }
  },

  // Create new project
  createProject: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const newProject = await projectsApi.create(data);

      // Optimistic update - add to list
      set((state) => ({
        projects: [newProject, ...state.projects],
        pagination: {
          ...state.pagination,
          total: state.pagination.total + 1,
        },
        isLoading: false,
        error: null,
      }));

      return newProject;
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to create project",
      });
      throw error;
    }
  },

  // Update project
  updateProject: async (id, data) => {
    set({ isLoading: true, error: null });

    try {
      const updatedProject = await projectsApi.update(id, data);

      // Optimistic update - update in list
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? updatedProject : p
        ),
        selectedProject:
          state.selectedProject?.id === id
            ? updatedProject
            : state.selectedProject,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to update project",
      });
      throw error;
    }
  },

  // Archive project
  archiveProject: async (id, archived_by) => {
    set({ isLoading: true, error: null });

    try {
      await projectsApi.archive(id, archived_by);

      // Optimistic update - mark as archived
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, archived: true } : p
        ),
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to archive project",
      });
      throw error;
    }
  },

  // Unarchive project
  unarchiveProject: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await projectsApi.unarchive(id);

      // Optimistic update - mark as not archived
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, archived: false } : p
        ),
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to unarchive project",
      });
      throw error;
    }
  },

  // Delete project
  deleteProject: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await projectsApi.delete(id);

      // Optimistic update - remove from list
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1),
        },
        selectedProject:
          state.selectedProject?.id === id ? null : state.selectedProject,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to delete project",
      });
      throw error;
    }
  },

  // Set selected project
  setSelectedProject: (project) => {
    set({ selectedProject: project });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));

// Selector hooks for better performance
export const useProjects = () => useProjectStore((state) => state.projects);
export const useSelectedProject = () =>
  useProjectStore((state) => state.selectedProject);
export const useProjectsLoading = () =>
  useProjectStore((state) => state.isLoading);
export const useProjectsError = () => useProjectStore((state) => state.error);
export const useProjectsPagination = () =>
  useProjectStore((state) => state.pagination);
