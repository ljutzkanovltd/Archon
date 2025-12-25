import { useState, useEffect, useCallback } from "react";
import { Project } from "@/lib/types";

const RECENT_PROJECTS_KEY = "archon_recent_projects";
const MAX_RECENT_PROJECTS = 5;

interface RecentProject {
  id: string;
  title: string;
  lastAccessedAt: string;
}

export function useRecentProjects() {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Load recent projects from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_PROJECTS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentProjects(parsed);
      }
    } catch (error) {
      console.error("Error loading recent projects:", error);
    }
  }, []);

  // Add a project to recent projects
  const addRecentProject = useCallback((project: Project | { id: string; title: string }) => {
    setRecentProjects((prev) => {
      // Remove if already exists
      const filtered = prev.filter((p) => p.id !== project.id);

      // Add to front
      const updated = [
        {
          id: project.id,
          title: project.title,
          lastAccessedAt: new Date().toISOString(),
        },
        ...filtered,
      ].slice(0, MAX_RECENT_PROJECTS);

      // Persist to localStorage
      try {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Error saving recent projects:", error);
      }

      return updated;
    });
  }, []);

  // Clear all recent projects
  const clearRecentProjects = useCallback(() => {
    setRecentProjects([]);
    try {
      localStorage.removeItem(RECENT_PROJECTS_KEY);
    } catch (error) {
      console.error("Error clearing recent projects:", error);
    }
  }, []);

  // Remove a specific project
  const removeRecentProject = useCallback((projectId: string) => {
    setRecentProjects((prev) => {
      const updated = prev.filter((p) => p.id !== projectId);
      try {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Error removing recent project:", error);
      }
      return updated;
    });
  }, []);

  return {
    recentProjects,
    addRecentProject,
    clearRecentProjects,
    removeRecentProject,
  };
}
