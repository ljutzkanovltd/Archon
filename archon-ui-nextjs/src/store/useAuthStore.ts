import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  isTokenExpired,
  getTimeUntilExpiry,
  isTokenExpiringSoon,
} from "@/lib/jwt-utils";
import toast from "react-hot-toast";

// User interface
export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  avatar?: string;
  permissions?: string[]; // RBAC Phase 4: User-specific permissions from archon_user_permissions
}

// Auth state interface
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionCheckInterval: ReturnType<typeof setInterval> | null;
}

// Auth actions interface
interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: (message?: string) => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  startSessionMonitoring: () => void;
  stopSessionMonitoring: () => void;
  handleSessionExpiry: () => void;
}

// Combined store type
type AuthStore = AuthState & AuthActions;

// Encrypted storage wrapper (basic implementation)
// Note: For production, consider using a more robust encryption library
const encryptedStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const item = localStorage.getItem(name);
      // In production, decrypt the item here
      return item;
    } catch (error) {
      console.error("Error reading from encrypted storage:", error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      // In production, encrypt the value here
      localStorage.setItem(name, value);
    } catch (error) {
      console.error("Error writing to encrypted storage:", error);
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.error("Error removing from encrypted storage:", error);
    }
  },
};

// Create the auth store
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      sessionCheckInterval: null,

      // Login action
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          // Call real backend API
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              username: email,
              password: password,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Login failed");
          }

          const data = await response.json();

          // Transform backend response to User interface
          const user: User = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.full_name || email.split("@")[0],
            role: data.user.role || "member",
            avatar: data.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.full_name || email.split("@")[0])}&background=random`,
            permissions: data.user.permissions || [], // RBAC Phase 4: Load permissions from backend
          };

          const token = data.access_token;

          // Store token in localStorage for API client
          if (typeof window !== "undefined") {
            localStorage.setItem("archon_token", token);
          }

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Start session monitoring after successful login
          get().startSessionMonitoring();
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : "Login failed",
          });
          throw error;
        }
      },

      // Logout action - enhanced with message support
      logout: (message?: string) => {
        // Stop session monitoring
        get().stopSessionMonitoring();

        // Clear ALL persisted state
        if (typeof window !== "undefined") {
          localStorage.removeItem("archon_token");
          localStorage.removeItem("archon-auth-storage"); // Zustand persist key
        }

        // Show logout message if provided
        if (message) {
          toast.error(message, {
            duration: 4000,
            position: "top-center",
          });
        }

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          sessionCheckInterval: null,
        });
      },

      // Set user
      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },

      // Set token
      setToken: (token: string | null) => {
        set({ token });

        // Update localStorage
        if (typeof window !== "undefined") {
          if (token) {
            localStorage.setItem("archon_token", token);
          } else {
            localStorage.removeItem("archon_token");
          }
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Check authentication status (e.g., on app load)
      checkAuth: async () => {
        const { token } = get();

        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        // Check if token is expired
        const expired = isTokenExpired(token);
        if (expired) {
          get().handleSessionExpiry();
          return;
        }

        set({ isLoading: true });

        try {
          // If we have a persisted user, we're authenticated
          const { user } = get();
          if (user) {
            set({ isAuthenticated: true, isLoading: false });
            // Start session monitoring
            get().startSessionMonitoring();
          } else {
            // Token exists but no user - clear everything
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
          // Token validation failed
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: "Session expired. Please log in again.",
          });

          if (typeof window !== "undefined") {
            localStorage.removeItem("archon_token");
          }
        }
      },

      // Start monitoring session expiry
      startSessionMonitoring: () => {
        // Clear any existing interval
        get().stopSessionMonitoring();

        // Only run in browser environment
        if (typeof window === "undefined") return;

        // Check token expiry every 30 seconds
        const interval = setInterval(() => {
          const { token, isAuthenticated } = get();

          if (!token || !isAuthenticated) {
            get().stopSessionMonitoring();
            return;
          }

          const expired = isTokenExpired(token);
          if (expired) {
            get().handleSessionExpiry();
          }
        }, 30000); // Check every 30 seconds

        set({ sessionCheckInterval: interval });
      },

      // Stop session monitoring
      stopSessionMonitoring: () => {
        const { sessionCheckInterval } = get();
        if (sessionCheckInterval) {
          clearInterval(sessionCheckInterval);
          set({ sessionCheckInterval: null });
        }
      },

      // Handle session expiry
      handleSessionExpiry: () => {
        // Stop monitoring
        get().stopSessionMonitoring();

        // Clear all state
        if (typeof window !== "undefined") {
          localStorage.removeItem("archon_token");
          localStorage.removeItem("archon-auth-storage");

          // Show session expired message
          toast.error("Your session has expired. Please log in again.", {
            duration: 5000,
            position: "top-center",
          });

          // Redirect to login after a short delay
          setTimeout(() => {
            window.location.href = "/login";
          }, 1500);
        }

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: "Session expired",
          sessionCheckInterval: null,
        });
      },
    }),
    {
      name: "archon-auth-storage",
      storage: createJSONStorage(() => encryptedStorage),
      partialize: (state) => ({
        // Only persist user and token
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selector hooks for better performance
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
