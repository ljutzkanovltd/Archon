"use client";

import { Card, Toggle, Button, Alert, Spinner, Badge } from "flowbite-react";
import {
  HiCheck,
  HiX,
  HiRefresh,
  HiInformationCircle,
  HiCheckCircle,
} from "react-icons/hi";
import { useSettings } from "@/contexts/SettingsContext";
import { toast } from "react-hot-toast";
import { useState } from "react";

/**
 * SettingsManagementPanel - Comprehensive settings management UI
 *
 * Features:
 * - View all feature toggles
 * - Enable/disable individual features
 * - Verify settings persistence
 * - Refresh settings from backend
 * - Visual confirmation of saved state
 * - Category-based organization
 *
 * All settings are saved to backend database via credentials service,
 * ensuring they persist across updates and deployments.
 *
 * Usage:
 * ```tsx
 * <SettingsManagementPanel />
 * ```
 */
export function SettingsManagementPanel() {
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
    tasksEnabled,
    setTasksEnabled,
    knowledgeBaseEnabled,
    setKnowledgeBaseEnabled,
    mcpServerDashboardEnabled,
    setMCPServerDashboardEnabled,
    loading,
    refreshSettings,
  } = useSettings();

  const [isSaving, setIsSaving] = useState<string | null>(null);

  const handleToggleChange = async (
    settingName: string,
    currentValue: boolean,
    setter: (value: boolean) => Promise<void>
  ) => {
    setIsSaving(settingName);

    try {
      await setter(!currentValue);
      toast.success(`${settingName} updated successfully`);
    } catch (error) {
      toast.error(`Failed to update ${settingName}`);
      console.error(`Error updating ${settingName}:`, error);
    } finally {
      setIsSaving(null);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshSettings();
      toast.success("Settings refreshed from database");
    } catch (error) {
      toast.error("Failed to refresh settings");
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <Spinner size="xl" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading settings...
          </span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings Management
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Configure feature toggles and preferences
          </p>
        </div>
        <Button color="gray" size="sm" onClick={handleRefresh}>
          <HiRefresh className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Persistence Info Alert */}
      <Alert color="success" icon={HiCheckCircle}>
        <span className="text-sm">
          <strong>Persistence Guaranteed:</strong> All settings are stored in
          the backend database via the credentials service. Your preferences
          will persist across updates, deployments, and browser sessions.
        </span>
      </Alert>

      {/* Core Features */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Core Features
        </h3>
        <div className="space-y-4">
          <SettingToggle
            label="Projects & Tasks"
            description="Enable project management and task tracking functionality"
            enabled={projectsEnabled}
            onChange={() =>
              handleToggleChange(
                "Projects",
                projectsEnabled,
                setProjectsEnabled
              )
            }
            isSaving={isSaving === "Projects"}
            recommended
          />

          <SettingToggle
            label="Tasks Menu"
            description="Show Tasks menu item in sidebar navigation"
            enabled={tasksEnabled}
            onChange={() =>
              handleToggleChange("Tasks Menu", tasksEnabled, setTasksEnabled)
            }
            isSaving={isSaving === "Tasks Menu"}
            recommended
          />

          <SettingToggle
            label="Knowledge Base"
            description="Enable knowledge base and documentation features"
            enabled={knowledgeBaseEnabled}
            onChange={() =>
              handleToggleChange(
                "Knowledge Base",
                knowledgeBaseEnabled,
                setKnowledgeBaseEnabled
              )
            }
            isSaving={isSaving === "Knowledge Base"}
            recommended
          />

          <SettingToggle
            label="MCP Server Dashboard"
            description="Show MCP server monitoring and analytics dashboard"
            enabled={mcpServerDashboardEnabled}
            onChange={() =>
              handleToggleChange(
                "MCP Dashboard",
                mcpServerDashboardEnabled,
                setMCPServerDashboardEnabled
              )
            }
            isSaving={isSaving === "MCP Dashboard"}
            recommended
          />
        </div>
      </Card>

      {/* Agent & Workflow Features */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Agent & Workflow
        </h3>
        <div className="space-y-4">
          <SettingToggle
            label="Agent Work Orders"
            description="Enable automated development workflows with AI agents"
            enabled={agentWorkOrdersEnabled}
            onChange={() =>
              handleToggleChange(
                "Agent Work Orders",
                agentWorkOrdersEnabled,
                setAgentWorkOrdersEnabled
              )
            }
            isSaving={isSaving === "Agent Work Orders"}
            recommended
          />
        </div>
      </Card>

      {/* UI & Display Features */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          UI & Display
        </h3>
        <div className="space-y-4">
          <SettingToggle
            label="Dark Mode"
            description="Enable dark theme for the entire application"
            enabled={darkModeEnabled}
            onChange={() =>
              handleToggleChange(
                "Dark Mode",
                darkModeEnabled,
                setDarkModeEnabled
              )
            }
            isSaving={isSaving === "Dark Mode"}
          />

          <SettingToggle
            label="Disconnect Screen"
            description="Show disconnection screen when MCP server is offline"
            enabled={disconnectScreenEnabled}
            onChange={() =>
              handleToggleChange(
                "Disconnect Screen",
                disconnectScreenEnabled,
                setDisconnectScreenEnabled
              )
            }
            isSaving={isSaving === "Disconnect Screen"}
          />

          <SettingToggle
            label="Style Guide"
            description="Show UI component style guide in navigation"
            enabled={styleGuideEnabled}
            onChange={() =>
              handleToggleChange(
                "Style Guide",
                styleGuideEnabled,
                setStyleGuideEnabled
              )
            }
            isSaving={isSaving === "Style Guide"}
          />
        </div>
      </Card>

      {/* Development & Debugging */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Development & Debugging
        </h3>
        <div className="space-y-4">
          <SettingToggle
            label="Logfire Integration"
            description="Enable Logfire observability and logging"
            enabled={logfireEnabled}
            onChange={() =>
              handleToggleChange("Logfire", logfireEnabled, setLogfireEnabled)
            }
            isSaving={isSaving === "Logfire"}
          />
        </div>
      </Card>

      {/* Settings Summary */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Settings Summary
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <div className="flex items-center gap-2">
              <HiCheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Enabled Features
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {[
                    projectsEnabled,
                    tasksEnabled,
                    knowledgeBaseEnabled,
                    mcpServerDashboardEnabled,
                    agentWorkOrdersEnabled,
                    darkModeEnabled,
                    disconnectScreenEnabled,
                    styleGuideEnabled,
                    logfireEnabled,
                  ].filter(Boolean).length}{" "}
                  / 9
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <div className="flex items-center gap-2">
              <HiInformationCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Storage Method
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Backend Database (Permanent)
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * SettingToggle - Individual setting toggle component
 */
interface SettingToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
  isSaving?: boolean;
  recommended?: boolean;
}

function SettingToggle({
  label,
  description,
  enabled,
  onChange,
  isSaving = false,
  recommended = false,
}: SettingToggleProps) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          {recommended && (
            <Badge color="info" size="sm">
              Recommended
            </Badge>
          )}
          {isSaving && <Spinner size="xs" />}
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>

      <div className="ml-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          {enabled ? (
            <HiCheck className="h-5 w-5 text-green-500" />
          ) : (
            <HiX className="h-5 w-5 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {enabled ? "ON" : "OFF"}
          </span>
        </div>

        <Toggle
          checked={enabled}
          onChange={onChange}
          disabled={isSaving}
        />
      </div>
    </div>
  );
}
