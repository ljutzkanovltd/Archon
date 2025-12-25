"use client";

import React, { useState, useEffect } from "react";
import {
  HiMoon,
  HiSun,
  HiDocumentText,
  HiColorSwatch,
  HiCog,
  HiFire,
  HiDesktopComputer,
} from "react-icons/hi";
import { useSettings } from "@/contexts/SettingsContext";
import { credentialsService } from "@/lib/services/credentialsService";
import { serverHealthService } from "@/lib/services/serverHealthService";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface FeatureToggleProps {
  title: string;
  description: string;
  checked: boolean;
  onToggle: (checked: boolean) => Promise<void>;
  loading: boolean;
  icon: React.ReactNode;
  iconOnBg: string;
  iconOffBg: string;
  borderColor: string;
  disabled?: boolean;
  errorMessage?: string;
}

// ============================================================================
// Feature Toggle Component
// ============================================================================

const FeatureToggle: React.FC<FeatureToggleProps> = ({
  title,
  description,
  checked,
  onToggle,
  loading,
  icon,
  iconOnBg,
  iconOffBg,
  borderColor,
  disabled = false,
  errorMessage,
}) => {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    if (loading || isToggling || disabled) return;

    try {
      setIsToggling(true);
      await onToggle(!checked);
    } catch (error) {
      console.error(`Failed to toggle ${title}:`, error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border p-4 shadow-lg backdrop-blur-sm ${borderColor} ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white">{title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
        {errorMessage && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400">
            ⚠️ {errorMessage}
          </p>
        )}
      </div>
      <div className="flex-shrink-0">
        <button
          onClick={handleToggle}
          disabled={loading || isToggling || disabled}
          className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            checked ? iconOnBg : iconOffBg
          }`}
          role="switch"
          aria-checked={checked}
        >
          <span
            className={`${
              checked ? "translate-x-11" : "translate-x-1"
            } inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-transform flex items-center justify-center`}
          >
            {isToggling ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
            ) : (
              <span className="text-gray-600">{icon}</span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Features Tab Component
// ============================================================================

export default function FeaturesTab() {
  const {
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
    loading: contextLoading,
  } = useSettings();

  const [loading, setLoading] = useState(false);
  const [projectsSchemaValid, setProjectsSchemaValid] = useState(true);
  const [projectsSchemaError, setProjectsSchemaError] = useState<string | null>(
    null
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // ==========================================================================
  // Load Settings on Mount
  // ==========================================================================

  useEffect(() => {
    loadProjectsSchema();
  }, []);

  const loadProjectsSchema = async () => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181";
      const projectsHealthResponse = await fetch(
        `${baseUrl}/api/projects/health`
      ).catch(() => null);

      if (projectsHealthResponse && projectsHealthResponse.ok) {
        const healthData = await projectsHealthResponse.json();
        const schemaValid = healthData.schema?.valid === true;
        setProjectsSchemaValid(schemaValid);

        if (!schemaValid) {
          setProjectsSchemaError(
            "Projects table not detected. Please ensure you have installed the archon_tasks.sql structure to your database and restart the server."
          );
        } else {
          setProjectsSchemaError(null);
        }
      } else {
        setProjectsSchemaValid(false);
        setProjectsSchemaError(
          "Unable to verify projects schema. Please ensure the backend is running and database is accessible."
        );
      }
    } catch (error) {
      console.error("Failed to load projects schema:", error);
      setProjectsSchemaValid(false);
      setProjectsSchemaError("Failed to load settings");
    }
  };

  // ==========================================================================
  // Toast Helper
  // ==========================================================================

  const showToast = (
    message: string,
    type: "success" | "error" | "warning"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ==========================================================================
  // Toggle Handlers
  // ==========================================================================

  const handleDarkModeToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      await setDarkModeEnabled(checked);
      showToast(
        checked ? "Dark Mode Enabled" : "Light Mode Enabled",
        "success"
      );
    } catch (error) {
      showToast("Failed to update dark mode setting", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectsToggle = async (checked: boolean) => {
    if (!projectsSchemaValid) return;

    try {
      setLoading(true);
      await setProjectsEnabled(checked);
      showToast(
        checked ? "Projects Enabled Successfully!" : "Projects Now Disabled",
        checked ? "success" : "warning"
      );
    } catch (error) {
      showToast("Failed to update Projects setting", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleStyleGuideToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      await setStyleGuideEnabled(checked);
      showToast(
        checked ? "Style Guide Enabled" : "Style Guide Disabled",
        checked ? "success" : "warning"
      );
    } catch (error) {
      showToast("Failed to update style guide setting", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAgentWorkOrdersToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      await setAgentWorkOrdersEnabled(checked);
      showToast(
        checked
          ? "Agent Work Orders Enabled"
          : "Agent Work Orders Disabled",
        checked ? "success" : "warning"
      );
    } catch (error) {
      showToast("Failed to update agent work orders setting", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogfireToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      await setLogfireEnabled(checked);
      showToast(
        checked ? "Logfire Enabled Successfully!" : "Logfire Now Disabled",
        checked ? "success" : "warning"
      );
    } catch (error) {
      showToast("Failed to update Logfire setting", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectScreenToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      await setDisconnectScreenEnabled(checked);
      await serverHealthService.updateSettings({ enabled: checked });
      showToast(
        checked ? "Disconnect Screen Enabled" : "Disconnect Screen Disabled",
        checked ? "success" : "warning"
      );
    } catch (error) {
      showToast("Failed to update disconnect screen setting", "error");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : toast.type === "error"
              ? "bg-red-500 text-white"
              : "bg-yellow-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Features
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enable or disable platform features
        </p>
      </div>

      {/* Feature Toggles Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Dark Mode */}
        <FeatureToggle
          title="Dark Mode"
          description="Switch between light and dark themes"
          checked={darkModeEnabled}
          onToggle={handleDarkModeToggle}
          loading={loading || contextLoading}
          icon={darkModeEnabled ? <HiMoon className="h-5 w-5" /> : <HiSun className="h-5 w-5" />}
          iconOnBg="bg-purple-600"
          iconOffBg="bg-gray-200"
          borderColor="border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5"
        />

        {/* Projects */}
        <FeatureToggle
          title="Projects"
          description="Enable Projects and Tasks functionality"
          checked={projectsEnabled}
          onToggle={handleProjectsToggle}
          loading={loading || contextLoading}
          icon={<HiDocumentText className="h-5 w-5" />}
          iconOnBg="bg-blue-600"
          iconOffBg="bg-gray-200"
          borderColor="border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5"
          disabled={!projectsSchemaValid}
          errorMessage={projectsSchemaError || undefined}
        />

        {/* Style Guide */}
        <FeatureToggle
          title="Style Guide"
          description="Show UI style guide and components in navigation"
          checked={styleGuideEnabled}
          onToggle={handleStyleGuideToggle}
          loading={loading || contextLoading}
          icon={<HiColorSwatch className="h-5 w-5" />}
          iconOnBg="bg-cyan-600"
          iconOffBg="bg-gray-200"
          borderColor="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5"
        />

        {/* Agent Work Orders */}
        <FeatureToggle
          title="Agent Work Orders"
          description="Enable automated development workflows with Claude Code CLI"
          checked={agentWorkOrdersEnabled}
          onToggle={handleAgentWorkOrdersToggle}
          loading={loading || contextLoading}
          icon={<HiCog className="h-5 w-5" />}
          iconOnBg="bg-green-600"
          iconOffBg="bg-gray-200"
          borderColor="border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5"
        />

        {/* Pydantic Logfire */}
        <FeatureToggle
          title="Pydantic Logfire"
          description="Structured logging and observability platform"
          checked={logfireEnabled}
          onToggle={handleLogfireToggle}
          loading={loading || contextLoading}
          icon={<HiFire className="h-5 w-5" />}
          iconOnBg="bg-orange-600"
          iconOffBg="bg-gray-200"
          borderColor="border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-600/5"
        />

        {/* Disconnect Screen */}
        <FeatureToggle
          title="Disconnect Screen"
          description="Show disconnect screen when server disconnects"
          checked={disconnectScreenEnabled}
          onToggle={handleDisconnectScreenToggle}
          loading={loading || contextLoading}
          icon={<HiDesktopComputer className="h-5 w-5" />}
          iconOnBg="bg-green-600"
          iconOffBg="bg-gray-200"
          borderColor="border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5"
        />
      </div>
    </div>
  );
}
