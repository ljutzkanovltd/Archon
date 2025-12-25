import { create } from "zustand";
import { knowledgeBaseApi, ApiError } from "@/lib/apiClient";

interface Source {
  id: string;
  title: string;
  url: string;
  description?: string;
  page_count?: number;
}

interface SourceState {
  sources: Source[];
  selectedSource: Source | null;
  isLoading: boolean;
  error: string | null;
}

interface SourceActions {
  fetchSources: () => Promise<void>;
  setSelectedSource: (source: Source | null) => void;
  clearError: () => void;
}

type SourceStore = SourceState & SourceActions;

export const useSourceStore = create<SourceStore>((set) => ({
  sources: [],
  selectedSource: null,
  isLoading: false,
  error: null,

  fetchSources: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await knowledgeBaseApi.getSources();
      set({
        sources: response.sources || [],
        isLoading: false,
      });
    } catch (error) {
      const apiError = error as ApiError;
      set({
        sources: [],
        isLoading: false,
        error: apiError.message || "Failed to fetch sources",
      });
    }
  },

  setSelectedSource: (source) => set({ selectedSource: source }),
  clearError: () => set({ error: null }),
}));

export const useSources = () => useSourceStore((state) => state.sources);
export const useSelectedSource = () =>
  useSourceStore((state) => state.selectedSource);
export const useSourcesLoading = () =>
  useSourceStore((state) => state.isLoading);
export const useSourcesError = () => useSourceStore((state) => state.error);
