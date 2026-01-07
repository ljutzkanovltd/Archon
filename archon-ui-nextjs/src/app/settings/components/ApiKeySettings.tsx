"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HiCheck, HiEye, HiEyeOff, HiKey } from "react-icons/hi";
import { HiSave } from "react-icons/hi";
import { settingsApi } from "@/lib/apiClient";
import { credentialsService } from "@/lib/services/credentialsService";
import type { RagSettings } from "@/lib/services/credentialsService";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface ApiKeyConfig {
  name: string;
  label: string;
  keyName: keyof RagSettings;
  placeholder: string;
  color: string;
  isEncrypted: boolean;
}

interface ApiKeyInputProps {
  provider: ApiKeyConfig;
  value: string;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

// ============================================================================
// Provider Configurations
// ============================================================================

const API_KEY_PROVIDERS: ApiKeyConfig[] = [
  {
    name: "openai",
    label: "OpenAI",
    keyName: "OPENAI_API_KEY",
    placeholder: "sk-...",
    color: "green",
    isEncrypted: true,
  },
  {
    name: "anthropic",
    label: "Anthropic",
    keyName: "ANTHROPIC_API_KEY",
    placeholder: "sk-ant-...",
    color: "orange",
    isEncrypted: true,
  },
  {
    name: "google",
    label: "Google AI",
    keyName: "GOOGLE_API_KEY",
    placeholder: "AIza...",
    color: "red",
    isEncrypted: true,
  },
  {
    name: "azure",
    label: "Azure OpenAI",
    keyName: "AZURE_OPENAI_API_KEY",
    placeholder: "azure-...",
    color: "teal",
    isEncrypted: true,
  },
  {
    name: "grok",
    label: "Grok",
    keyName: "GROK_API_KEY",
    placeholder: "grok-...",
    color: "slate",
    isEncrypted: true,
  },
  {
    name: "openrouter",
    label: "OpenRouter",
    keyName: "OPENROUTER_API_KEY",
    placeholder: "sk-or-...",
    color: "indigo",
    isEncrypted: true,
  },
];

// ============================================================================
// API Key Input Component
// ============================================================================

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  provider,
  value,
  onChange,
  onSave,
  saving,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    setHasKey(!!value && value.length > 0);
  }, [value]);

  const colorClasses = {
    green: "border-green-500/30 bg-green-500/5",
    orange: "border-orange-500/30 bg-orange-500/5",
    purple: "border-purple-500/30 bg-purple-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    cyan: "border-cyan-500/30 bg-cyan-500/5",
    red: "border-red-500/30 bg-red-500/5",
    teal: "border-teal-500/30 bg-teal-500/5",
    slate: "border-slate-500/30 bg-slate-500/5",
    indigo: "border-indigo-500/30 bg-indigo-500/5",
  };

  const colorClass = colorClasses[provider.color as keyof typeof colorClasses];

  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiKey className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            {provider.label}
          </h3>
          {hasKey && (
            <HiCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
          )}
        </div>
        <button
          onClick={() => setShowKey(!showKey)}
          className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
          title={showKey ? "Hide key" : "Show key"}
        >
          {showKey ? (
            <HiEyeOff className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <HiEye className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={provider.placeholder}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <HiSave className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// API Key Settings Component
// ============================================================================

export function ApiKeySettings() {
  const { settings, updateSettings } = useSettingsStore();
  const [formData, setFormData] = useState(settings?.api_keys || {
    openai_api_key: "",
    azure_openai_endpoint: "",
    azure_openai_key: "",
    azure_openai_api_version: "",
    azure_openai_deployment: "",
    supabase_url: "",
    supabase_service_key: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ key: string; valid: boolean } | null>(null);

  // Provider API Keys state
  const [providerApiKeys, setProviderApiKeys] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load provider API keys on mount
  useEffect(() => {
    loadProviderApiKeys();
  }, []);

  const loadProviderApiKeys = async () => {
    try {
      const ragSettings = await credentialsService.getRagSettings();
      const keys: Record<string, string> = {};

      Object.entries(ragSettings).forEach(([key, value]) => {
        if (key.endsWith("_API_KEY")) {
          keys[key] = value as string;
        }
      });

      setProviderApiKeys(keys);
    } catch (error) {
      console.error("Failed to load provider API keys:", error);
    }
  };

  const saveProviderApiKey = async (provider: ApiKeyConfig) => {
    try {
      setSavingProvider(provider.keyName);
      const value = providerApiKeys[provider.keyName] || "";

      await credentialsService.updateCredential({
        key: provider.keyName,
        value,
        is_encrypted: provider.isEncrypted,
        category: "api_keys",
        description: `${provider.label} API key`,
      });

      showToast(`${provider.label} API key saved successfully`, "success");
    } catch (error) {
      console.error(`Failed to save ${provider.label} API key:`, error);
      showToast(`Failed to save ${provider.label} API key`, "error");
    } finally {
      setSavingProvider(null);
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ section: "api_keys", data: formData });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const testApiKey = async (provider: "openai" | "azure") => {
    setTestingKey(provider);
    setTestResult(null);
    try {
      const apiKey = provider === "openai" ? formData.openai_api_key : formData.azure_openai_key;
      if (!apiKey) return;

      const response = await settingsApi.testApiKey(provider, apiKey);
      setTestResult({ key: provider, valid: response.data?.valid || false });
    } catch (error) {
      setTestResult({ key: provider, valid: false });
    } finally {
      setTestingKey(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
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

      <h2 className="text-xl font-semibold mb-6 dark:text-gray-100">API Keys</h2>

      <div className="space-y-6">
        {/* Provider API Keys Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Provider API Keys</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {API_KEY_PROVIDERS.map((provider) => (
              <ApiKeyInput
                key={provider.keyName}
                provider={provider}
                value={providerApiKeys[provider.keyName] || ""}
                onChange={(value) =>
                  setProviderApiKeys({ ...providerApiKeys, [provider.keyName]: value })
                }
                onSave={() => saveProviderApiKey(provider)}
                saving={savingProvider === provider.keyName}
              />
            ))}
          </div>
        </div>

        {/* Legacy API Keys Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Legacy API Keys</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            These are older API key configurations. Use the Provider API Keys section above for new integrations.
          </p>
        </div>

        {/* OpenAI API Key */}
        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            OpenAI API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKeys.openai ? "text" : "password"}
                value={formData.openai_api_key || ""}
                onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value })}
                className="w-full px-4 py-2 pr-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="sk-..."
              />
              <button
                type="button"
                onClick={() => toggleShowKey("openai")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showKeys.openai ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={() => testApiKey("openai")}
              disabled={!formData.openai_api_key || testingKey === "openai"}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg disabled:opacity-50 transition-colors"
            >
              {testingKey === "openai" ? "Testing..." : "Test"}
            </button>
          </div>
          {testResult?.key === "openai" && (
            <p className={`text-sm mt-1 ${testResult.valid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {testResult.valid ? "✓ API key is valid" : "✗ API key is invalid"}
            </p>
          )}
        </div>

        {/* Azure OpenAI Settings */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Azure OpenAI</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Azure OpenAI Endpoint
              </label>
              <input
                type="url"
                value={formData.azure_openai_endpoint || ""}
                onChange={(e) => setFormData({ ...formData, azure_openai_endpoint: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="https://your-resource.openai.azure.com/"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Azure OpenAI API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKeys.azure ? "text" : "password"}
                    value={formData.azure_openai_key || ""}
                    onChange={(e) => setFormData({ ...formData, azure_openai_key: e.target.value })}
                    className="w-full px-4 py-2 pr-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey("azure")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showKeys.azure ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  onClick={() => testApiKey("azure")}
                  disabled={!formData.azure_openai_key || testingKey === "azure"}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {testingKey === "azure" ? "Testing..." : "Test"}
                </button>
              </div>
              {testResult?.key === "azure" && (
                <p className={`text-sm mt-1 ${testResult.valid ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {testResult.valid ? "✓ API key is valid" : "✗ API key is invalid"}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                API Version
              </label>
              <input
                type="text"
                value={formData.azure_openai_api_version || ""}
                onChange={(e) => setFormData({ ...formData, azure_openai_api_version: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="2024-02-01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Deployment Name
              </label>
              <input
                type="text"
                value={formData.azure_openai_deployment || ""}
                onChange={(e) => setFormData({ ...formData, azure_openai_deployment: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="gpt-4"
              />
            </div>
          </div>
        </div>

        {/* Supabase Settings */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Supabase</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Supabase URL
              </label>
              <input
                type="url"
                value={formData.supabase_url || ""}
                onChange={(e) => setFormData({ ...formData, supabase_url: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="https://your-project.supabase.co"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Supabase Service Key
              </label>
              <div className="relative">
                <input
                  type={showKeys.supabase ? "text" : "password"}
                  value={formData.supabase_service_key || ""}
                  onChange={(e) => setFormData({ ...formData, supabase_service_key: e.target.value })}
                  className="w-full px-4 py-2 pr-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey("supabase")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showKeys.supabase ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-brand-700 hover:bg-brand-800 hover:text-white text-white rounded-lg disabled:opacity-50 transition-colors"
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

      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Security Note:</strong> API keys are stored securely. Never share your keys or commit them to version control.
        </p>
      </div>
    </div>
  );
}
