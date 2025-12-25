"use client";

import React, { useState, useEffect } from "react";
import { HiSave, HiRefresh } from "react-icons/hi";
import { credentialsService } from "@/lib/services/credentialsService";
import type { CodeExtractionSettings } from "@/lib/services/credentialsService";

// ============================================================================
// Settings Configuration
// ============================================================================

interface SettingConfig {
  key: keyof CodeExtractionSettings;
  label: string;
  description: string;
  type: "number" | "boolean" | "decimal";
  min?: number;
  max?: number;
  step?: number;
  section: "length" | "detection" | "filtering" | "advanced";
}

const SETTINGS_CONFIG: SettingConfig[] = [
  // Length Settings
  {
    key: "MIN_CODE_BLOCK_LENGTH",
    label: "Minimum Code Block Length",
    description: "Minimum number of characters for a valid code block",
    type: "number",
    min: 50,
    max: 1000,
    section: "length",
  },
  {
    key: "MAX_CODE_BLOCK_LENGTH",
    label: "Maximum Code Block Length",
    description: "Maximum number of characters for a code block",
    type: "number",
    min: 1000,
    max: 10000,
    section: "length",
  },

  // Detection Features
  {
    key: "ENABLE_COMPLETE_BLOCK_DETECTION",
    label: "Complete Block Detection",
    description: "Detect complete code blocks with proper boundaries",
    type: "boolean",
    section: "detection",
  },
  {
    key: "ENABLE_LANGUAGE_SPECIFIC_PATTERNS",
    label: "Language-Specific Patterns",
    description: "Use language-specific patterns for code detection",
    type: "boolean",
    section: "detection",
  },

  // Content Filtering
  {
    key: "ENABLE_PROSE_FILTERING",
    label: "Prose Filtering",
    description: "Filter out prose (non-code text) from code blocks",
    type: "boolean",
    section: "filtering",
  },
  {
    key: "MAX_PROSE_RATIO",
    label: "Maximum Prose Ratio",
    description: "Maximum ratio of prose to code (0.0 - 1.0)",
    type: "decimal",
    min: 0,
    max: 1,
    step: 0.05,
    section: "filtering",
  },
  {
    key: "MIN_CODE_INDICATORS",
    label: "Minimum Code Indicators",
    description: "Minimum number of code indicators required",
    type: "number",
    min: 1,
    max: 10,
    section: "filtering",
  },
  {
    key: "ENABLE_DIAGRAM_FILTERING",
    label: "Diagram Filtering",
    description: "Filter out ASCII diagrams and charts",
    type: "boolean",
    section: "filtering",
  },

  // Advanced Settings
  {
    key: "ENABLE_CONTEXTUAL_LENGTH",
    label: "Contextual Length Adjustment",
    description: "Adjust code block length based on context",
    type: "boolean",
    section: "advanced",
  },
  {
    key: "CODE_EXTRACTION_MAX_WORKERS",
    label: "Maximum Workers",
    description: "Maximum concurrent workers for code extraction",
    type: "number",
    min: 1,
    max: 10,
    section: "advanced",
  },
  {
    key: "CONTEXT_WINDOW_SIZE",
    label: "Context Window Size",
    description: "Size of context window for code extraction",
    type: "number",
    min: 100,
    max: 5000,
    section: "advanced",
  },
  {
    key: "ENABLE_CODE_SUMMARIES",
    label: "Code Summaries",
    description: "Generate summaries for extracted code blocks",
    type: "boolean",
    section: "advanced",
  },
];

const SECTIONS = [
  {
    id: "length",
    title: "Length Settings",
    description: "Configure minimum and maximum code block lengths",
  },
  {
    id: "detection",
    title: "Detection Features",
    description: "Enable advanced code detection capabilities",
  },
  {
    id: "filtering",
    title: "Content Filtering",
    description: "Filter and validate code block content",
  },
  {
    id: "advanced",
    title: "Advanced Settings",
    description: "Advanced code extraction configuration",
  },
];

// ============================================================================
// Code Extraction Tab Component
// ============================================================================

export default function CodeExtractionTab() {
  const [settings, setSettings] = useState<CodeExtractionSettings>({
    MIN_CODE_BLOCK_LENGTH: 250,
    MAX_CODE_BLOCK_LENGTH: 5000,
    ENABLE_COMPLETE_BLOCK_DETECTION: true,
    ENABLE_LANGUAGE_SPECIFIC_PATTERNS: true,
    ENABLE_PROSE_FILTERING: true,
    MAX_PROSE_RATIO: 0.15,
    MIN_CODE_INDICATORS: 3,
    ENABLE_DIAGRAM_FILTERING: true,
    ENABLE_CONTEXTUAL_LENGTH: true,
    CODE_EXTRACTION_MAX_WORKERS: 3,
    CONTEXT_WINDOW_SIZE: 1000,
    ENABLE_CODE_SUMMARIES: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const codeSettings =
        await credentialsService.getCodeExtractionSettings();
      setSettings(codeSettings);
    } catch (error) {
      console.error("Failed to load code extraction settings:", error);
      showToast("Failed to load code extraction settings", "error");
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
      await credentialsService.updateCodeExtractionSettings(settings);
      showToast("Code extraction settings saved successfully", "success");
    } catch (error) {
      console.error("Failed to save code extraction settings:", error);
      showToast("Failed to save code extraction settings", "error");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // Setting Update Handler
  // ==========================================================================

  const updateSetting = (key: keyof CodeExtractionSettings, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <p className="ml-3 text-gray-500 dark:text-gray-400">
          Loading code extraction settings...
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
            Code Extraction Settings
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure how code blocks are extracted and processed
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

      {/* Settings Sections */}
      <div className="space-y-6">
        {SECTIONS.map((section) => {
          const sectionSettings = SETTINGS_CONFIG.filter(
            (s) => s.section === section.id
          );

          return (
            <div
              key={section.id}
              className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
            >
              <h3 className="mb-1 font-medium text-gray-900 dark:text-white">
                {section.title}
              </h3>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                {section.description}
              </p>
              <div className="space-y-4">
                {sectionSettings.map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <label className="font-medium text-gray-900 dark:text-white">
                        {setting.label}
                      </label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {setting.description}
                      </p>
                    </div>
                    <div className="ml-4">
                      {setting.type === "boolean" ? (
                        <button
                          onClick={() =>
                            updateSetting(setting.key, !settings[setting.key])
                          }
                          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                            settings[setting.key]
                              ? "bg-brand-600"
                              : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        >
                          <span
                            className={`${
                              settings[setting.key]
                                ? "translate-x-7"
                                : "translate-x-1"
                            } inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform`}
                          />
                        </button>
                      ) : setting.type === "decimal" ? (
                        <input
                          type="number"
                          value={settings[setting.key]}
                          onChange={(e) =>
                            updateSetting(
                              setting.key,
                              parseFloat(e.target.value)
                            )
                          }
                          min={setting.min}
                          max={setting.max}
                          step={setting.step || 0.01}
                          className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      ) : (
                        <input
                          type="number"
                          value={settings[setting.key]}
                          onChange={(e) =>
                            updateSetting(
                              setting.key,
                              parseInt(e.target.value, 10)
                            )
                          }
                          min={setting.min}
                          max={setting.max}
                          className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <HiSave className="h-4 w-4" />
              Save All Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
