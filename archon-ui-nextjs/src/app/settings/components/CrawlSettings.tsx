"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HiCheck } from "react-icons/hi";

export function CrawlSettings() {
  const { settings, updateSettings } = useSettingsStore();
  const [formData, setFormData] = useState(settings?.crawl || {
    default_max_depth: 2,
    default_crawl_type: "technical" as "technical" | "business",
    extract_code_examples: true,
    respect_robots_txt: true,
    rate_limit_delay_ms: 1000,
    max_concurrent_crawls: 3,
    user_agent: "Archon Knowledge Base Crawler/1.0",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ section: "crawl", data: formData });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-6 dark:text-gray-100">Crawl Settings</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Default Max Depth: {formData.default_max_depth}
          </label>
          <input
            type="range"
            min="1"
            max="5"
            value={formData.default_max_depth}
            onChange={(e) => setFormData({ ...formData, default_max_depth: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span>5</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            How deep to crawl links (1 = current page only, 5 = follow links up to 5 levels deep)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Default Crawl Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="technical"
                checked={formData.default_crawl_type === "technical"}
                onChange={(e) => setFormData({ ...formData, default_crawl_type: e.target.value as "technical" | "business" })}
                className="mr-2"
              />
              <span className="dark:text-gray-300">Technical</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="business"
                checked={formData.default_crawl_type === "business"}
                onChange={(e) => setFormData({ ...formData, default_crawl_type: e.target.value as "technical" | "business" })}
                className="mr-2"
              />
              <span className="dark:text-gray-300">Business</span>
            </label>
          </div>
        </div>

        <div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.extract_code_examples}
              onChange={(e) => setFormData({ ...formData, extract_code_examples: e.target.checked })}
              className="mr-3 h-4 w-4"
            />
            <span className="text-sm font-medium dark:text-gray-300">Extract Code Examples</span>
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
            Automatically detect and extract code blocks during crawling
          </p>
        </div>

        <div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.respect_robots_txt}
              onChange={(e) => setFormData({ ...formData, respect_robots_txt: e.target.checked })}
              className="mr-3 h-4 w-4"
            />
            <span className="text-sm font-medium dark:text-gray-300">Respect robots.txt</span>
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
            Follow robots.txt directives when crawling websites
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Rate Limit Delay (ms)
          </label>
          <input
            type="number"
            min="100"
            max="10000"
            step="100"
            value={formData.rate_limit_delay_ms}
            onChange={(e) => setFormData({ ...formData, rate_limit_delay_ms: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Milliseconds to wait between requests (1000ms = 1 second)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Max Concurrent Crawls
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={formData.max_concurrent_crawls}
            onChange={(e) => setFormData({ ...formData, max_concurrent_crawls: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Maximum number of simultaneous crawl operations
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            User Agent
          </label>
          <input
            type="text"
            value={formData.user_agent}
            onChange={(e) => setFormData({ ...formData, user_agent: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 font-mono text-sm"
            placeholder="Archon Knowledge Base Crawler/1.0"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            User agent string sent with crawl requests
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
