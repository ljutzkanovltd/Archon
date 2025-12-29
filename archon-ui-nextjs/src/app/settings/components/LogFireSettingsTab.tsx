"use client";

import React, { useState, useEffect } from "react";
import {
  HiKey,
  HiEye,
  HiEyeOff,
  HiSave,
  HiRefresh,
  HiCheckCircle,
  HiXCircle,
  HiArrowPath,
  HiExternalLink,
} from "react-icons/hi2";
import { credentialsService } from "@/lib/services/credentialsService";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface LogFireSettings {
  apiKey: string;
  enabled: boolean;
}

interface TestConnectionResult {
  ok: boolean;
  message: string;
}

// ============================================================================
// LogFire Settings Tab Component
// ============================================================================

export default function LogFireSettingsTab() {
  // ==========================================================================
  // State Management
  // ==========================================================================

  const [settings, setSettings] = useState<LogFireSettings>({
    apiKey: "",
    enabled: false,
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(
    null
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // ==========================================================================
  // Load Settings on Mount
  // ==========================================================================

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      // Load API key
      const apiKeyCredential = await credentialsService.getCredential(
        "LOGFIRE_API_KEY"
      );

      // Load enabled state
      const enabledCredential = await credentialsService.getCredential(
        "LOGFIRE_ENABLED"
      );

      setSettings({
        apiKey: apiKeyCredential.value || "",
        enabled: enabledCredential.value === "true",
      });
    } catch (error) {
      console.error("Failed to load LogFire settings:", error);
      showToast("Failed to load LogFire settings", "error");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // Toast Helper
  // ==========================================================================

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ==========================================================================
  // Save Handler
  // ==========================================================================

  const saveSettings = async () => {
    try {
      setSaving(true);

      // Save API key (encrypted)
      await credentialsService.updateCredential({
        key: "LOGFIRE_API_KEY",
        value: settings.apiKey,
        is_encrypted: true,
        category: "logfire",
        description: "Pydantic LogFire API Key",
      });

      // Save enabled state
      await credentialsService.updateCredential({
        key: "LOGFIRE_ENABLED",
        value: settings.enabled.toString(),
        is_encrypted: false,
        category: "features",
        description: "Enable LogFire integration",
      });

      showToast("LogFire settings saved successfully", "success");
    } catch (error) {
      console.error("Failed to save LogFire settings:", error);
      showToast("Failed to save LogFire settings", "error");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // Test Connection Handler
  // ==========================================================================

  const testConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      if (!settings.apiKey) {
        setTestResult({
          ok: false,
          message: "API key is required to test connection",
        });
        return;
      }

      // Make a test request to LogFire API
      // Note: You'll need to implement this endpoint in the backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181"}/api/test-logfire-connection`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_key: settings.apiKey,
          }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setTestResult({
          ok: true,
          message: result.message || "Connection successful!",
        });
      } else {
        setTestResult({
          ok: false,
          message: result.message || "Connection failed",
        });
      }
    } catch (error) {
      console.error("Failed to test LogFire connection:", error);
      setTestResult({
        ok: false,
        message:
          error instanceof Error ? error.message : "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <p className="ml-3 text-gray-500 dark:text-gray-400">
          Loading LogFire settings...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Pydantic LogFire Settings
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure Pydantic LogFire integration for observability and
            monitoring
          </p>
        </div>
        <button
          onClick={loadSettings}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <HiRefresh className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Enable/Disable Toggle Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Enable LogFire Integration
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Send observability data to Pydantic LogFire for monitoring and
              debugging
            </p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              settings.enabled
                ? "bg-brand-600"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            <span
              className={`${
                settings.enabled ? "translate-x-7" : "translate-x-1"
              } inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform`}
            />
          </button>
        </div>
      </div>

      {/* API Key Configuration Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-2">
          <HiKey className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            LogFire API Key
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="logfire-api-key"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="logfire-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, apiKey: e.target.value })
                  }
                  placeholder="Enter LogFire API Key"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  disabled={saving || testing}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-600"
                  title={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? (
                    <HiEyeOff className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <HiEye className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Your API key will be encrypted and stored securely. Get your API
              key from the LogFire dashboard.
            </p>
          </div>

          {/* Test Result Display */}
          {testResult && (
            <div
              className={`rounded-lg border p-3 ${
                testResult.ok
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-red-500/30 bg-red-500/10"
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.ok ? (
                  <HiCheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <HiXCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <p
                  className={`text-sm ${
                    testResult.ok
                      ? "text-green-800 dark:text-green-300"
                      : "text-red-800 dark:text-red-300"
                  }`}
                >
                  {testResult.message}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={testConnection}
              disabled={testing || saving || !settings.apiKey}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand-500 bg-white px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              {testing ? (
                <>
                  <HiArrowPath className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <HiCheckCircle className="h-4 w-4" />
                  Test Connection
                </>
              )}
            </button>
            <button
              onClick={saveSettings}
              disabled={saving || testing}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <HiSave className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Documentation Links Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 font-medium text-gray-900 dark:text-white">
          Documentation & Resources
        </h3>
        <div className="space-y-3">
          <a
            href="https://logfire.pydantic.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            <HiExternalLink className="h-4 w-4" />
            Pydantic LogFire Documentation
          </a>
          <a
            href="https://logfire.pydantic.dev/docs/guides/onboarding/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            <HiExternalLink className="h-4 w-4" />
            Getting Started Guide
          </a>
          <a
            href="https://logfire.pydantic.dev/docs/guides/first_steps/api_key/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            <HiExternalLink className="h-4 w-4" />
            API Key Setup Guide
          </a>
        </div>
      </div>

      {/* Information Section */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <h4 className="mb-2 font-medium text-blue-900 dark:text-blue-300">
          About Pydantic LogFire
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-400">
          LogFire is Pydantic's observability platform that provides insights
          into your application's performance, errors, and usage patterns. It
          integrates seamlessly with PydanticAI and other Pydantic tools to
          give you comprehensive monitoring and debugging capabilities.
        </p>
      </div>
    </div>
  );
}
