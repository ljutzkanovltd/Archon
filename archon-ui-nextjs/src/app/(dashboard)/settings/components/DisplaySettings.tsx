"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HiCheck, HiMoon, HiSun } from "react-icons/hi";

export function DisplaySettings() {
  const { settings, updateSettings, setTheme } = useSettingsStore();
  const [formData, setFormData] = useState(settings?.display || {
    default_theme: "system" as "light" | "dark" | "system",
    default_view_mode: "grid" as "grid" | "table",
    items_per_page: 20,
    show_sidebar_by_default: true,
    sidebar_collapsed_by_default: false,
    enable_animations: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ section: "display", data: formData });
      setTheme(formData.default_theme);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    setFormData({ ...formData, default_theme: theme });
    setTheme(theme);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-6 dark:text-gray-100">Display Settings</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-3 dark:text-gray-300">
            Theme
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleThemeChange("light")}
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                formData.default_theme === "light"
                  ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <HiSun className="w-8 h-8" />
              <span className="text-sm font-medium dark:text-gray-300">Light</span>
            </button>
            <button
              onClick={() => handleThemeChange("dark")}
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                formData.default_theme === "dark"
                  ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <HiMoon className="w-8 h-8" />
              <span className="text-sm font-medium dark:text-gray-300">Dark</span>
            </button>
            <button
              onClick={() => handleThemeChange("system")}
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                formData.default_theme === "system"
                  ? "border-brand-600 bg-brand-50 dark:bg-brand-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex">
                <HiSun className="w-4 h-8" />
                <HiMoon className="w-4 h-8" />
              </div>
              <span className="text-sm font-medium dark:text-gray-300">System</span>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Theme changes apply immediately
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Default View Mode
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="grid"
                checked={formData.default_view_mode === "grid"}
                onChange={(e) => setFormData({ ...formData, default_view_mode: e.target.value as "grid" | "table" })}
                className="mr-2"
              />
              <span className="dark:text-gray-300">Grid View</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="table"
                checked={formData.default_view_mode === "table"}
                onChange={(e) => setFormData({ ...formData, default_view_mode: e.target.value as "grid" | "table" })}
                className="mr-2"
              />
              <span className="dark:text-gray-300">Table View</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Items Per Page
          </label>
          <select
            value={formData.items_per_page}
            onChange={(e) => setFormData({ ...formData, items_per_page: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.show_sidebar_by_default}
              onChange={(e) => setFormData({ ...formData, show_sidebar_by_default: e.target.checked })}
              className="mr-3 h-4 w-4"
            />
            <span className="text-sm font-medium dark:text-gray-300">Show Sidebar by Default</span>
          </label>
        </div>

        <div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.sidebar_collapsed_by_default}
              onChange={(e) => setFormData({ ...formData, sidebar_collapsed_by_default: e.target.checked })}
              className="mr-3 h-4 w-4"
            />
            <span className="text-sm font-medium dark:text-gray-300">Collapse Sidebar by Default</span>
          </label>
        </div>

        <div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enable_animations}
              onChange={(e) => setFormData({ ...formData, enable_animations: e.target.checked })}
              className="mr-3 h-4 w-4"
            />
            <span className="text-sm font-medium dark:text-gray-300">Enable Animations</span>
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
            Smooth transitions and animations throughout the UI
          </p>
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
    </div>
  );
}
