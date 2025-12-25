"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HiCheck, HiStatusOnline, HiStatusOffline } from "react-icons/hi";

export function McpSettings() {
  const { settings, updateSettings } = useSettingsStore();
  const [formData, setFormData] = useState(settings?.mcp || {
    mcp_server_url: "http://localhost:8051",
    mcp_enabled: true,
    mcp_timeout_ms: 30000,
    enable_mcp_inspector: false,
    log_mcp_requests: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; message: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ section: "mcp", data: formData });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const response = await fetch(`${formData.mcp_server_url}/health`);
      if (response.ok) {
        setConnectionStatus({ connected: true, message: "MCP server is reachable" });
      } else {
        setConnectionStatus({ connected: false, message: `Server returned status ${response.status}` });
      }
    } catch (error) {
      setConnectionStatus({ connected: false, message: "Cannot reach MCP server" });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-6 dark:text-gray-100">MCP Integration</h2>

      <div className="space-y-6">
        <div>
          <label className="flex items-center cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={formData.mcp_enabled}
              onChange={(e) => setFormData({ ...formData, mcp_enabled: e.target.checked })}
              className="mr-3 h-4 w-4"
            />
            <span className="text-sm font-medium dark:text-gray-300">Enable MCP Integration</span>
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enable Model Context Protocol integration for AI assistants (Claude, Cursor, etc.)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            MCP Server URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={formData.mcp_server_url}
              onChange={(e) => setFormData({ ...formData, mcp_server_url: e.target.value })}
              className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              placeholder="http://localhost:8051"
              disabled={!formData.mcp_enabled}
            />
            <button
              onClick={testConnection}
              disabled={!formData.mcp_enabled || testingConnection}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg disabled:opacity-50 transition-colors"
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </button>
          </div>
          {connectionStatus && (
            <div className={`flex items-center gap-2 mt-2 text-sm ${
              connectionStatus.connected
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {connectionStatus.connected ? (
                <HiStatusOnline className="w-5 h-5" />
              ) : (
                <HiStatusOffline className="w-5 h-5" />
              )}
              <span>{connectionStatus.message}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Request Timeout (ms)
          </label>
          <input
            type="number"
            min="5000"
            max="120000"
            step="1000"
            value={formData.mcp_timeout_ms}
            onChange={(e) => setFormData({ ...formData, mcp_timeout_ms: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            disabled={!formData.mcp_enabled}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Maximum time to wait for MCP requests (30000ms = 30 seconds)
          </p>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Debug Options</h3>

          <div className="space-y-4">
            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_mcp_inspector}
                  onChange={(e) => setFormData({ ...formData, enable_mcp_inspector: e.target.checked })}
                  className="mr-3 h-4 w-4"
                  disabled={!formData.mcp_enabled}
                />
                <span className="text-sm font-medium dark:text-gray-300">Enable MCP Inspector</span>
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
                Show MCP Inspector in sidebar for debugging requests/responses
              </p>
            </div>

            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.log_mcp_requests}
                  onChange={(e) => setFormData({ ...formData, log_mcp_requests: e.target.checked })}
                  className="mr-3 h-4 w-4"
                  disabled={!formData.mcp_enabled}
                />
                <span className="text-sm font-medium dark:text-gray-300">Log MCP Requests</span>
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
                Log all MCP requests and responses to browser console
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">About MCP</h4>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Model Context Protocol (MCP) allows AI assistants like Claude and Cursor to access Archon's knowledge base directly.
            When enabled, these tools can search documentation, manage projects and tasks, and interact with your knowledge sources.
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>

        {showSuccess && (
          <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <HiCheck className="w-5 h-5" />
            Settings saved successfully!
          </span>
        )}
      </div>
    </div>
  );
}
