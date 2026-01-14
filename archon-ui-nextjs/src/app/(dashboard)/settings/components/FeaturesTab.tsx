"use client";

import React, { useState, useEffect } from "react";
import {
  HiDocumentText,
  HiColorSwatch,
  HiCog,
  HiFire,
  HiDesktopComputer,
  HiClipboardList,
  HiBookOpen,
  HiServer,
} from "react-icons/hi";
import { useSettings } from "@/contexts/SettingsContext";
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
  const [justToggled, setJustToggled] = useState(false);

  const handleToggle = async () => {
    if (loading || isToggling || disabled) return;

    try {
      setIsToggling(true);
      await onToggle(!checked);
      setJustToggled(true);
      setTimeout(() => setJustToggled(false), 300);
    } catch (error) {
      console.error(`Failed to toggle ${title}:`, error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border p-4 shadow-lg backdrop-blur-sm transition-all duration-200 ${borderColor} ${
        disabled ? "opacity-50" : ""
      } ${justToggled ? "scale-[1.02]" : "scale-100"}`}
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
            } inline-flex h-8 w-8 transform items-center justify-center rounded-full bg-white shadow-lg transition-transform`}
          >
            {isToggling ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
            ) : (
              <span className="flex items-center justify-center text-gray-600">{icon}</span>
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
    tasksEnabled,
    setTasksEnabled,
    knowledgeBaseEnabled,
    setKnowledgeBaseEnabled,
    mcpServerDashboardEnabled,
    setMCPServerDashboardEnabled,
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
      // Use relative URL - Next.js proxy will forward to backend
      const projectsHealthResponse = await fetch(
        `/api/projects/health`
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

  const handleTasksToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      await setTasksEnabled(checked);
      showToast(
        checked ? "Tasks Menu Enabled" : "Tasks Menu Disabled",
        checked ? "success" : "warning"
      );
    } catch (error) {
      showToast("Failed to update tasks setting", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleKnowledgeBaseToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      await setKnowledgeBaseEnabled(checked);
      showToast(
        checked ? "Knowledge Base Enabled" : "Knowledge Base Disabled",
        checked ? "success" : "warning"
      );
    } catch (error) {
      showToast("Failed to update knowledge base setting", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMCPServerDashboardToggle = async (checked: boolean) => {
    try {
      setLoading(true);
      await setMCPServerDashboardEnabled(checked);
      showToast(
        checked ? "MCP Server Dashboard Enabled" : "MCP Server Dashboard Disabled",
        checked ? "success" : "warning"
      );
    } catch (error) {
      showToast("Failed to update MCP server dashboard setting", "error");
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

        {/* Tasks */}
        <FeatureToggle
          title="Tasks"
          description="Enable or disable the Tasks menu in the sidebar"
          checked={tasksEnabled}
          onToggle={handleTasksToggle}
          loading={loading || contextLoading}
          icon={<HiClipboardList className="h-5 w-5" />}
          iconOnBg="bg-yellow-600"
          iconOffBg="bg-gray-200"
          borderColor="border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5"
        />

        {/* Knowledge Base */}
        <FeatureToggle
          title="Knowledge Base"
          description="Enable or disable the Knowledge Base in the sidebar"
          checked={knowledgeBaseEnabled}
          onToggle={handleKnowledgeBaseToggle}
          loading={loading || contextLoading}
          icon={<HiBookOpen className="h-5 w-5" />}
          iconOnBg="bg-indigo-600"
          iconOffBg="bg-gray-200"
          borderColor="border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5"
        />

        {/* MCP Server Dashboard */}
        <FeatureToggle
          title="MCP Server Dashboard"
          description="Enable or disable the MCP Server menu in the sidebar"
          checked={mcpServerDashboardEnabled}
          onToggle={handleMCPServerDashboardToggle}
          loading={loading || contextLoading}
          icon={<HiServer className="h-5 w-5" />}
          iconOnBg="bg-teal-600"
          iconOffBg="bg-gray-200"
          borderColor="border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-teal-600/5"
        />
      </div>
    </div>
  );
}
