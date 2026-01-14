"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * AuthProvider - Initializes and maintains authentication state
 *
 * Features:
 * - Restores auth state from localStorage on mount
 * - Validates session with backend
 * - Handles automatic logout on session expiry
 * - Syncs auth state across tabs/windows
 * - Auto-login demo user in development mode
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Initialize auth state on mount
    const initAuth = async () => {
      await checkAuth();

      // DISABLED: Auto-login for development
      // User should use the login page with proper credentials
      // const isDevelopment = process.env.NODE_ENV === "development";
      // if (isDevelopment && !isAuthenticated) {
      //   console.log("[AuthProvider] Auto-logging in demo user for development");
      //   await login("demo@archon.dev", "demo");
      // }
    };

    // Defer auth initialization until after hydration completes
    // This prevents hydration mismatches
    const timer = setTimeout(() => {
      initAuth();
    }, 100);

    // Listen for storage events (sync across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "archon-auth-storage" || e.key === "archon_token") {
        // Auth state changed in another tab - re-check
        checkAuth();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [checkAuth, login, isAuthenticated]);

  return <>{children}</>;
}
