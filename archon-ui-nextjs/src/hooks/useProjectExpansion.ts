"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "archon:project-expansion";

interface UseProjectExpansionReturn {
  expanded: Set<string>;
  toggle: (projectId: string) => void;
  expandAll: (projectIds: string[]) => void;
  collapseAll: () => void;
  isExpanded: (projectId: string) => boolean;
}

/**
 * Hook to manage project tree expansion state with localStorage persistence
 *
 * @param defaultExpanded - Optional initial set of expanded project IDs
 * @returns Object with expansion state and control methods
 *
 * @example
 * const { expanded, toggle, isExpanded } = useProjectExpansion();
 *
 * // Toggle expansion
 * <button onClick={() => toggle(projectId)}>Expand</button>
 *
 * // Check if expanded
 * {isExpanded(projectId) && <div>Children...</div>}
 */
export function useProjectExpansion(
  defaultExpanded?: Set<string>
): UseProjectExpansionReturn {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // SSR check - return empty set during server render
    if (typeof window === "undefined") {
      return defaultExpanded || new Set<string>();
    }

    // Try to load from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const expandedArray = JSON.parse(stored) as string[];
        return new Set(expandedArray);
      }
    } catch (error) {
      console.warn("Failed to load project expansion state from localStorage:", error);
    }

    // Default: all collapsed (empty set)
    return defaultExpanded || new Set<string>();
  });

  // Persist to localStorage whenever expansion state changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const expandedArray = Array.from(expanded);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedArray));
    } catch (error) {
      console.warn("Failed to save project expansion state to localStorage:", error);
    }
  }, [expanded]);

  /**
   * Toggle expansion state for a project
   */
  const toggle = useCallback((projectId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  /**
   * Expand all specified projects
   */
  const expandAll = useCallback((projectIds: string[]) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      projectIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  /**
   * Collapse all projects
   */
  const collapseAll = useCallback(() => {
    setExpanded(new Set<string>());
  }, []);

  /**
   * Check if a project is expanded
   */
  const isExpanded = useCallback(
    (projectId: string) => {
      return expanded.has(projectId);
    },
    [expanded]
  );

  return {
    expanded,
    toggle,
    expandAll,
    collapseAll,
    isExpanded,
  };
}
