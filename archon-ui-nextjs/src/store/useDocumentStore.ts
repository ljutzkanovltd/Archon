import { create } from "zustand";
import { documentsApi, ApiError } from "@/lib/apiClient";
import { Document } from "@/lib/types";

interface DocumentState {
  documents: Document[];
  selectedDocument: Document | null;
  isLoading: boolean;
  error: string | null;
}

interface DocumentActions {
  fetchDocuments: (params: {
    project_id: string;
    page?: number;
    per_page?: number;
    query?: string;
    document_type?: "spec" | "design" | "note" | "prp" | "api" | "guide";
  }) => Promise<void>;
  fetchDocumentById: (projectId: string, documentId: string) => Promise<void>;
  createDocument: (data: {
    project_id: string;
    title: string;
    document_type: "spec" | "design" | "note" | "prp" | "api" | "guide";
    content?: Record<string, unknown>;
    tags?: string[];
    author?: string;
  }) => Promise<Document>;
  updateDocument: (
    projectId: string,
    documentId: string,
    data: Partial<{
      title: string;
      document_type: "spec" | "design" | "note" | "prp" | "api" | "guide";
      content: Record<string, unknown>;
      tags: string[];
    }>
  ) => Promise<void>;
  deleteDocument: (projectId: string, documentId: string) => Promise<void>;
  setSelectedDocument: (document: Document | null) => void;
  clearError: () => void;
}

type DocumentStore = DocumentState & DocumentActions;

export const useDocumentStore = create<DocumentStore>((set) => ({
  documents: [],
  selectedDocument: null,
  isLoading: false,
  error: null,

  fetchDocuments: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await documentsApi.getAll(params);
      set({ documents: response.items, isLoading: false });
    } catch (error) {
      const apiError = error as ApiError;
      set({
        documents: [],
        isLoading: false,
        error: apiError.message || "Failed to fetch documents",
      });
    }
  },

  fetchDocumentById: async (projectId, documentId) => {
    set({ isLoading: true, error: null });
    try {
      const document = await documentsApi.getById(projectId, documentId);
      set({ selectedDocument: document, isLoading: false });
    } catch (error) {
      const apiError = error as ApiError;
      set({
        selectedDocument: null,
        isLoading: false,
        error: apiError.message || "Failed to fetch document",
      });
    }
  },

  createDocument: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const newDocument = await documentsApi.create(data);
      set((state) => ({
        documents: [newDocument, ...state.documents],
        isLoading: false,
      }));
      return newDocument;
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to create document",
      });
      throw error;
    }
  },

  updateDocument: async (projectId, documentId, data) => {
    set({ isLoading: true, error: null });
    try {
      const updatedDocument = await documentsApi.update(projectId, documentId, data);
      set((state) => ({
        documents: state.documents.map((d) =>
          d.id === documentId ? updatedDocument : d
        ),
        selectedDocument:
          state.selectedDocument?.id === documentId
            ? updatedDocument
            : state.selectedDocument,
        isLoading: false,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to update document",
      });
      throw error;
    }
  },

  deleteDocument: async (projectId, documentId) => {
    set({ isLoading: true, error: null });
    try {
      await documentsApi.delete(projectId, documentId);
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== documentId),
        selectedDocument:
          state.selectedDocument?.id === documentId
            ? null
            : state.selectedDocument,
        isLoading: false,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      set({
        isLoading: false,
        error: apiError.message || "Failed to delete document",
      });
      throw error;
    }
  },

  setSelectedDocument: (document) => set({ selectedDocument: document }),
  clearError: () => set({ error: null }),
}));

export const useDocuments = () => useDocumentStore((state) => state.documents);
export const useSelectedDocument = () =>
  useDocumentStore((state) => state.selectedDocument);
export const useDocumentsLoading = () =>
  useDocumentStore((state) => state.isLoading);
export const useDocumentsError = () => useDocumentStore((state) => state.error);
