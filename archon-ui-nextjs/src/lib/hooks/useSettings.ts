import { useState, useEffect, useCallback } from "react";

/**
 * Settings Schema Version
 * Increment this when changing the settings structure to trigger migrations
 */
const SETTINGS_VERSION = 1;

/**
 * Settings Storage Key
 */
const SETTINGS_STORAGE_KEY = "archon-ui-settings";

/**
 * All UI Settings Types
 */
export interface UISettings {
  version: number;

  // Project settings
  project: {
    showArchived: boolean;
    defaultView: "board" | "list" | "timeline";
    sortBy: "name" | "updated" | "created";
    sortOrder: "asc" | "desc";
  };

  // Agent workflow settings
  agentWorkflow: {
    autoAssignAgents: boolean;
    showAgentSuggestions: boolean;
    enableAgentHandoff: boolean;
  };

  // Disconnect screen preferences
  disconnectScreen: {
    showReconnectPrompt: boolean;
    autoReconnectEnabled: boolean;
    reconnectDelay: number; // seconds
  };

  // Knowledge base view settings
  knowledgeBase: {
    defaultTab: "browse" | "search" | "suggestions";
    showPreview: boolean;
    itemsPerPage: number;
    sortBy: "relevance" | "date" | "title";
  };

  // MCP server dashboard preferences
  mcpDashboard: {
    showSessionDetails: boolean;
    showToolCallHistory: boolean;
    autoRefreshEnabled: boolean;
    refreshInterval: number; // seconds
  };

  // Task view settings
  taskView: {
    showCompletedTasks: boolean;
    defaultGroupBy: "status" | "assignee" | "priority" | "none";
    showSubtasks: boolean;
    compactMode: boolean;
  };

  // Pydantic log file preferences
  pydanticLogs: {
    enabled: boolean;
    logLevel: "debug" | "info" | "warning" | "error";
    maxLogSize: number; // MB
  };

  // General UI preferences
  ui: {
    theme: "light" | "dark" | "system";
    sidebarCollapsed: boolean;
    showNotifications: boolean;
    animationsEnabled: boolean;
  };
}

/**
 * Default Settings
 */
const DEFAULT_SETTINGS: UISettings = {
  version: SETTINGS_VERSION,

  project: {
    showArchived: false,
    defaultView: "board",
    sortBy: "updated",
    sortOrder: "desc",
  },

  agentWorkflow: {
    autoAssignAgents: true,
    showAgentSuggestions: true,
    enableAgentHandoff: true,
  },

  disconnectScreen: {
    showReconnectPrompt: true,
    autoReconnectEnabled: true,
    reconnectDelay: 5,
  },

  knowledgeBase: {
    defaultTab: "browse",
    showPreview: true,
    itemsPerPage: 20,
    sortBy: "relevance",
  },

  mcpDashboard: {
    showSessionDetails: true,
    showToolCallHistory: true,
    autoRefreshEnabled: true,
    refreshInterval: 30,
  },

  taskView: {
    showCompletedTasks: false,
    defaultGroupBy: "status",
    showSubtasks: true,
    compactMode: false,
  },

  pydanticLogs: {
    enabled: true,
    logLevel: "info",
    maxLogSize: 50,
  },

  ui: {
    theme: "system",
    sidebarCollapsed: false,
    showNotifications: true,
    animationsEnabled: true,
  },
};

/**
 * Settings Migration Functions
 * Add new migration functions here when changing settings structure
 */
const MIGRATIONS: Record<number, (settings: any) => UISettings> = {
  // Example: Migration from version 0 to version 1
  1: (oldSettings: any) => {
    // If upgrading from version 0 (or no version), merge with defaults
    return {
      ...DEFAULT_SETTINGS,
      ...oldSettings,
      version: 1,
    };
  },

  // Add future migrations here:
  // 2: (oldSettings: any) => { ... },
};

/**
 * Validate and migrate settings
 */
function validateAndMigrateSettings(
  loadedSettings: any
): UISettings {
  if (!loadedSettings || typeof loadedSettings !== "object") {
    return DEFAULT_SETTINGS;
  }

  const loadedVersion = loadedSettings.version || 0;

  // If already at current version, return as-is (with validation)
  if (loadedVersion === SETTINGS_VERSION) {
    return { ...DEFAULT_SETTINGS, ...loadedSettings };
  }

  // Apply migrations sequentially
  let migratedSettings = loadedSettings;

  for (let version = loadedVersion + 1; version <= SETTINGS_VERSION; version++) {
    const migration = MIGRATIONS[version];
    if (migration) {
      migratedSettings = migration(migratedSettings);
    }
  }

  return migratedSettings;
}

/**
 * useSettings Hook
 *
 * Provides persistent settings storage with TypeScript types,
 * version migrations, and localStorage sync.
 *
 * Features:
 * - Automatic localStorage persistence
 * - Version-based migrations
 * - Type-safe settings access
 * - Partial updates support
 * - Reset to defaults
 * - Cross-tab sync via storage events
 *
 * Usage:
 * ```tsx
 * const { settings, updateSettings, resetSettings } = useSettings();
 *
 * // Update specific settings
 * updateSettings({
 *   project: { ...settings.project, showArchived: true }
 * });
 *
 * // Reset all settings
 * resetSettings();
 * ```
 */
export function useSettings() {
  const [settings, setSettings] = useState<UISettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        const validated = validateAndMigrateSettings(parsed);
        setSettings(validated);

        // Save migrated settings back to localStorage
        if (validated.version !== parsed.version) {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(validated));
        }
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
      // Fall back to defaults
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return;

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  }, [settings, isLoaded]);

  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const validated = validateAndMigrateSettings(parsed);
          setSettings(validated);
        } catch (error) {
          console.error("Failed to sync settings from storage event:", error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  /**
   * Update settings (partial update supported)
   */
  const updateSettings = useCallback((updates: Partial<UISettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...updates,
      version: SETTINGS_VERSION, // Always ensure version is current
    }));
  }, []);

  /**
   * Reset all settings to defaults
   */
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(DEFAULT_SETTINGS)
      );
    } catch (error) {
      console.error("Failed to reset settings in localStorage:", error);
    }
  }, []);

  /**
   * Export settings as JSON (for backup/debugging)
   */
  const exportSettings = useCallback(() => {
    return JSON.stringify(settings, null, 2);
  }, [settings]);

  /**
   * Import settings from JSON (for restore)
   */
  const importSettings = useCallback((jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      const validated = validateAndMigrateSettings(parsed);
      setSettings(validated);
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(validated));
      return { success: true };
    } catch (error) {
      console.error("Failed to import settings:", error);
      return { success: false, error: String(error) };
    }
  }, []);

  return {
    settings,
    isLoaded,
    updateSettings,
    resetSettings,
    exportSettings,
    importSettings,
  };
}

/**
 * Utility function to get a specific setting
 */
export function getSetting<K extends keyof UISettings>(
  key: K
): UISettings[K] {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      return parsed[key] || DEFAULT_SETTINGS[key];
    }
  } catch (error) {
    console.error(`Failed to get setting ${String(key)}:`, error);
  }

  return DEFAULT_SETTINGS[key];
}

/**
 * Utility function to set a specific setting
 */
export function setSetting<K extends keyof UISettings>(
  key: K,
  value: UISettings[K]
): void {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const current = storedSettings
      ? JSON.parse(storedSettings)
      : DEFAULT_SETTINGS;

    const updated = {
      ...current,
      [key]: value,
      version: SETTINGS_VERSION,
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));

    // Trigger storage event for cross-tab sync
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SETTINGS_STORAGE_KEY,
        newValue: JSON.stringify(updated),
        url: window.location.href,
      })
    );
  } catch (error) {
    console.error(`Failed to set setting ${String(key)}:`, error);
  }
}
