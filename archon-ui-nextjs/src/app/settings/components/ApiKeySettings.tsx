"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HiCheck, HiEye, HiEyeOff } from "react-icons/hi";
import { settingsApi } from "@/lib/apiClient";

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
      <h2 className="text-xl font-semibold mb-6 dark:text-gray-100">API Keys</h2>

      <div className="space-y-6">
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

      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Security Note:</strong> API keys are stored securely. Never share your keys or commit them to version control.
        </p>
      </div>
    </div>
  );
}
