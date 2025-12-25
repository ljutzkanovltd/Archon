"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { credentialsService } from "@/lib/services/credentialsService";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface SettingsContextType {
  // Feature Toggles
  darkModeEnabled: boolean;
  setDarkModeEnabled: (enabled: boolean) => Promise<void>;
  projectsEnabled: boolean;
  setProjectsEnabled: (enabled: boolean) => Promise<void>;
  styleGuideEnabled: boolean;
  setStyleGuideEnabled: (enabled: boolean) => Promise<void>;
  agentWorkOrdersEnabled: boolean;
  setAgentWorkOrdersEnabled: (enabled: boolean) => Promise<void>;
  logfireEnabled: boolean;
  setLogfireEnabled: (enabled: boolean) => Promise<void>;
  disconnectScreenEnabled: boolean;
  setDisconnectScreenEnabled: (enabled: boolean) => Promise<void>;

  // Loading state
  loading: boolean;

  // Refresh settings
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

// ============================================================================
// Hook for consuming context
// ============================================================================

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

// ============================================================================
// Settings Provider Component
// ============================================================================

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
}) => {
  // Feature toggle states
  const [darkModeEnabled, setDarkModeEnabledState] = useState(false);
  const [projectsEnabled, setProjectsEnabledState] = useState(true);
  const [styleGuideEnabled, setStyleGuideEnabledState] = useState(false);
  const [agentWorkOrdersEnabled, setAgentWorkOrdersEnabledState] =
    useState(false);
  const [logfireEnabled, setLogfireEnabledState] = useState(false);
  const [disconnectScreenEnabled, setDisconnectScreenEnabledState] =
    useState(false);

  const [loading, setLoading] = useState(true);

  // ==========================================================================
  // Load all settings from backend
  // ==========================================================================

  const loadSettings = async () => {
    try {
      setLoading(true);

      // Load all feature settings
      const [
        darkModeResponse,
        projectsResponse,
        styleGuideResponse,
        agentWorkOrdersResponse,
        logfireResponse,
        disconnectScreenResponse,
      ] = await Promise.all([
        credentialsService
          .getCredential("DARK_MODE_ENABLED")
          .catch(() => ({ value: undefined })),
        credentialsService
          .getCredential("PROJECTS_ENABLED")
          .catch(() => ({ value: undefined })),
        credentialsService
          .getCredential("STYLE_GUIDE_ENABLED")
          .catch(() => ({ value: undefined })),
        credentialsService
          .getCredential("AGENT_WORK_ORDERS_ENABLED")
          .catch(() => ({ value: undefined })),
        credentialsService
          .getCredential("LOGFIRE_ENABLED")
          .catch(() => ({ value: undefined })),
        credentialsService
          .getCredential("DISCONNECT_SCREEN_ENABLED")
          .catch(() => ({ value: undefined })),
      ]);

      // Dark Mode (default: false)
      if (darkModeResponse.value !== undefined) {
        setDarkModeEnabledState(darkModeResponse.value === "true");
      } else {
        setDarkModeEnabledState(false);
      }

      // Projects (default: true)
      if (projectsResponse.value !== undefined) {
        setProjectsEnabledState(projectsResponse.value === "true");
      } else {
        setProjectsEnabledState(true);
      }

      // Style Guide (default: false)
      if (styleGuideResponse.value !== undefined) {
        setStyleGuideEnabledState(styleGuideResponse.value === "true");
      } else {
        setStyleGuideEnabledState(false);
      }

      // Agent Work Orders (default: false)
      if (agentWorkOrdersResponse.value !== undefined) {
        setAgentWorkOrdersEnabledState(agentWorkOrdersResponse.value === "true");
      } else {
        setAgentWorkOrdersEnabledState(false);
      }

      // Logfire (default: false)
      if (logfireResponse.value !== undefined) {
        setLogfireEnabledState(logfireResponse.value === "true");
      } else {
        setLogfireEnabledState(false);
      }

      // Disconnect Screen (default: false)
      if (disconnectScreenResponse.value !== undefined) {
        setDisconnectScreenEnabledState(
          disconnectScreenResponse.value === "true"
        );
      } else {
        setDisconnectScreenEnabledState(false);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      // Set defaults on error
      setDarkModeEnabledState(false);
      setProjectsEnabledState(true);
      setStyleGuideEnabledState(false);
      setAgentWorkOrdersEnabledState(false);
      setLogfireEnabledState(false);
      setDisconnectScreenEnabledState(false);
    } finally {
      setLoading(false);
    }
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // ==========================================================================
  // Setter functions for each feature toggle
  // ==========================================================================

  const setDarkModeEnabled = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setDarkModeEnabledState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: "DARK_MODE_ENABLED",
        value: enabled.toString(),
        is_encrypted: false,
        category: "features",
        description: "Enable dark mode theme",
      });
    } catch (error) {
      console.error("Failed to update dark mode setting:", error);
      // Revert on error
      setDarkModeEnabledState(!enabled);
      throw error;
    }
  };

  const setProjectsEnabled = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setProjectsEnabledState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: "PROJECTS_ENABLED",
        value: enabled.toString(),
        is_encrypted: false,
        category: "features",
        description: "Enable or disable Projects and Tasks functionality",
      });
    } catch (error) {
      console.error("Failed to update projects setting:", error);
      // Revert on error
      setProjectsEnabledState(!enabled);
      throw error;
    }
  };

  const setStyleGuideEnabled = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setStyleGuideEnabledState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: "STYLE_GUIDE_ENABLED",
        value: enabled.toString(),
        is_encrypted: false,
        category: "features",
        description: "Show UI style guide and components in navigation",
      });
    } catch (error) {
      console.error("Failed to update style guide setting:", error);
      // Revert on error
      setStyleGuideEnabledState(!enabled);
      throw error;
    }
  };

  const setAgentWorkOrdersEnabled = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setAgentWorkOrdersEnabledState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: "AGENT_WORK_ORDERS_ENABLED",
        value: enabled.toString(),
        is_encrypted: false,
        category: "features",
        description:
          "Enable Agent Work Orders feature for automated development workflows",
      });
    } catch (error) {
      console.error("Failed to update agent work orders setting:", error);
      // Revert on error
      setAgentWorkOrdersEnabledState(!enabled);
      throw error;
    }
  };

  const setLogfireEnabled = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setLogfireEnabledState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: "LOGFIRE_ENABLED",
        value: enabled.toString(),
        is_encrypted: false,
        category: "features",
        description: "Enable Logfire observability integration",
      });
    } catch (error) {
      console.error("Failed to update logfire setting:", error);
      // Revert on error
      setLogfireEnabledState(!enabled);
      throw error;
    }
  };

  const setDisconnectScreenEnabled = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setDisconnectScreenEnabledState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: "DISCONNECT_SCREEN_ENABLED",
        value: enabled.toString(),
        is_encrypted: false,
        category: "features",
        description: "Show disconnection screen when MCP server is offline",
      });
    } catch (error) {
      console.error("Failed to update disconnect screen setting:", error);
      // Revert on error
      setDisconnectScreenEnabledState(!enabled);
      throw error;
    }
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  // ==========================================================================
  // Context value
  // ==========================================================================

  const value: SettingsContextType = {
    darkModeEnabled,
    setDarkModeEnabled,
    projectsEnabled,
    setProjectsEnabled,
    styleGuideEnabled,
    setStyleGuideEnabled,
    agentWorkOrdersEnabled,
    setAgentWorkOrdersEnabled,
    logfireEnabled,
    setLogfireEnabled,
    disconnectScreenEnabled,
    setDisconnectScreenEnabled,
    loading,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
