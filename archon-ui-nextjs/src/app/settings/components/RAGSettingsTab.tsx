"use client";

import React, { useState, useEffect } from "react";
import {
  HiKey,
  HiEye,
  HiCheck,
  HiCheckCircle,
  HiXCircle,
  HiArrowPath,
} from "react-icons/hi2";
import {
  HiEyeOff,
  HiSave,
  HiRefresh,
} from "react-icons/hi";
import { credentialsService } from "@/lib/services/credentialsService";
import type {
  RagSettings,
  AzureChatConfig,
  AzureEmbeddingConfig,
} from "@/lib/services/credentialsService";

// ============================================================================
// Types and Interfaces
// ============================================================================

type SelectionMode = "chat" | "embedding";
type ProviderKey =
  | "openai"
  | "azure-openai"
  | "google"
  | "anthropic"
  | "ollama"
  | "openrouter"
  | "grok";

interface ProviderConfig {
  key: ProviderKey;
  name: string;
  color: string;
  icon: string;
  supportedModes: SelectionMode[];
  description: string;
}

// ============================================================================
// Provider Configurations
// ============================================================================

const PROVIDERS: ProviderConfig[] = [
  {
    key: "openai",
    name: "OpenAI",
    color: "green",
    icon: "🤖",
    supportedModes: ["chat", "embedding"],
    description: "GPT-4, GPT-3.5, text-embedding-3",
  },
  {
    key: "azure-openai",
    name: "Azure OpenAI",
    color: "blue",
    icon: "☁️",
    supportedModes: ["chat", "embedding"],
    description: "Azure-hosted OpenAI models",
  },
  {
    key: "google",
    name: "Google AI",
    color: "red",
    icon: "🔍",
    supportedModes: ["chat", "embedding"],
    description: "Gemini, PaLM 2",
  },
  {
    key: "anthropic",
    name: "Anthropic",
    color: "orange",
    icon: "🧠",
    supportedModes: ["chat"],
    description: "Claude 3.5, Claude 3",
  },
  {
    key: "ollama",
    name: "Ollama",
    color: "gray",
    icon: "🦙",
    supportedModes: ["chat", "embedding"],
    description: "Local LLM server",
  },
  {
    key: "openrouter",
    name: "OpenRouter",
    color: "indigo",
    icon: "🌐",
    supportedModes: ["chat", "embedding"],
    description: "Unified API for multiple LLM providers",
  },
  {
    key: "grok",
    name: "Grok",
    color: "slate",
    icon: "⚡",
    supportedModes: ["chat"],
    description: "xAI's Grok models",
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize Azure OpenAI endpoint URL to base URL only.
 * Removes deployment paths that users often copy from Azure Portal.
 *
 * @param endpoint - The Azure OpenAI endpoint URL (may include deployment path)
 * @returns Base URL only (protocol + host)
 *
 * @example
 * // Full deployment URL → Base URL
 * normalizeAzureEndpoint("https://my-resource.openai.azure.com/openai/deployments/gpt-4")
 * // Returns: "https://my-resource.openai.azure.com"
 *
 * @example
 * // URL with trailing slash → Clean base URL
 * normalizeAzureEndpoint("https://my-resource.openai.azure.com/")
 * // Returns: "https://my-resource.openai.azure.com"
 */
const normalizeAzureEndpoint = (endpoint: string): string => {
  if (!endpoint) return '';

  let normalized = endpoint.trim();

  try {
    // Use URL parsing to extract base URL (protocol + host only)
    // Azure OpenAI base URL format: https://{resource}.{region}.cognitiveservices.azure.com
    // or: https://{resource}.openai.azure.com
    const url = new URL(normalized);
    return `${url.protocol}//${url.host}`;
  } catch {
    // Fallback to regex if URL parsing fails
    // Remove everything after the domain (deployment paths, query params, etc.)
    normalized = normalized.replace(/\/openai.*$/i, '');
    normalized = normalized.replace(/\?.*$/, '');
    normalized = normalized.replace(/\/+$/, '');
    return normalized;
  }
};

// ============================================================================
// Settings Configuration
// ============================================================================

const STRATEGY_SETTINGS = [
  {
    key: "USE_CONTEXTUAL_EMBEDDINGS",
    label: "Contextual Embeddings",
    description: "Use contextual embeddings for better semantic search",
    type: "boolean" as const,
  },
  {
    key: "CONTEXTUAL_EMBEDDINGS_MAX_WORKERS",
    label: "Max Workers",
    description: "Maximum concurrent workers for contextual embeddings",
    type: "number" as const,
    min: 1,
    max: 10,
  },
  {
    key: "USE_HYBRID_SEARCH",
    label: "Hybrid Search",
    description: "Combine vector and keyword search",
    type: "boolean" as const,
  },
  {
    key: "USE_AGENTIC_RAG",
    label: "Agentic RAG",
    description: "Enable agentic retrieval-augmented generation",
    type: "boolean" as const,
  },
  {
    key: "USE_RERANKING",
    label: "Reranking",
    description: "Rerank search results for better relevance",
    type: "boolean" as const,
  },
  {
    key: "MODEL_CHOICE",
    label: "Model Choice",
    description: "Default model for RAG operations",
    type: "text" as const,
  },
];

const CRAWLING_SETTINGS = [
  {
    key: "CRAWL_BATCH_SIZE",
    label: "Batch Size",
    description: "Number of documents to crawl in each batch (10-100)",
    type: "number" as const,
    min: 10,
    max: 100,
  },
  {
    key: "CRAWL_MAX_CONCURRENT",
    label: "Max Concurrent",
    description: "Maximum number of concurrent crawl operations (1-20)",
    type: "number" as const,
    min: 1,
    max: 20,
  },
  {
    key: "CRAWL_WAIT_STRATEGY",
    label: "Wait Strategy",
    description: "Page load wait strategy for crawling",
    type: "select" as const,
    options: [
      { value: "domcontentloaded", label: "DOM Content Loaded" },
      { value: "load", label: "Full Load" },
      { value: "networkidle", label: "Network Idle" },
    ],
  },
  {
    key: "CRAWL_PAGE_TIMEOUT",
    label: "Page Timeout (seconds)",
    description: "Maximum time to wait for page load (5-120 seconds)",
    type: "number" as const,
    min: 5,
    max: 120,
  },
  {
    key: "CRAWL_DELAY_BEFORE_HTML",
    label: "Delay Before HTML (ms)",
    description: "Delay in milliseconds before extracting HTML (0-10000)",
    type: "number" as const,
    min: 0,
    max: 10000,
  },
];

const STORAGE_SETTINGS = [
  {
    key: "DOCUMENT_STORAGE_BATCH_SIZE",
    label: "Document Batch Size",
    description: "Number of documents to store in each batch (10-100)",
    type: "number" as const,
    min: 10,
    max: 100,
  },
  {
    key: "EMBEDDING_BATCH_SIZE",
    label: "Embedding Batch Size",
    description: "Number of embeddings to process in each batch (20-200)",
    type: "number" as const,
    min: 20,
    max: 200,
  },
  {
    key: "DELETE_BATCH_SIZE",
    label: "Delete Batch Size",
    description: "Number of items to delete in each batch (10-100)",
    type: "number" as const,
    min: 10,
    max: 100,
  },
  {
    key: "ENABLE_PARALLEL_BATCHES",
    label: "Enable Parallel Batches",
    description: "Process multiple batches in parallel for better performance",
    type: "boolean" as const,
  },
];

const ADVANCED_SETTINGS = [
  {
    key: "MEMORY_THRESHOLD_PERCENT",
    label: "Memory Threshold (%)",
    description: "Memory usage threshold percentage before throttling (0-100)",
    type: "number" as const,
    min: 0,
    max: 100,
  },
  {
    key: "DISPATCHER_CHECK_INTERVAL",
    label: "Dispatcher Interval (ms)",
    description: "Task dispatcher check interval in milliseconds (1000-60000)",
    type: "number" as const,
    min: 1000,
    max: 60000,
  },
  {
    key: "CODE_EXTRACTION_BATCH_SIZE",
    label: "Code Extraction Batch",
    description: "Number of code blocks to extract in each batch (10-100)",
    type: "number" as const,
    min: 10,
    max: 100,
  },
  {
    key: "CODE_SUMMARY_MAX_WORKERS",
    label: "Code Summary Workers",
    description: "Maximum workers for code summarization (1-10)",
    type: "number" as const,
    min: 1,
    max: 10,
  },
];

// ============================================================================
// Local Storage Keys for Provider Persistence
// ============================================================================

const STORAGE_KEYS = {
  CHAT_PROVIDER: "archon_chat_provider",
  EMBEDDING_PROVIDER: "archon_embedding_provider",
  CHAT_MODELS: "archon_chat_models",
  EMBEDDING_MODELS: "archon_embedding_models",
};

// ============================================================================
// Selection Toggle Component
// ============================================================================

interface SelectionToggleProps {
  activeSelection: SelectionMode;
  onChange: (mode: SelectionMode) => void;
}

const SelectionToggle: React.FC<SelectionToggleProps> = ({
  activeSelection,
  onChange,
}) => {
  return (
    <div className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-1 dark:border-gray-600 dark:bg-gray-800">
      <button
        onClick={() => onChange("chat")}
        className={`rounded-md px-6 py-2 text-sm font-medium transition-colors ${
          activeSelection === "chat"
            ? "bg-white text-brand-600 shadow-sm dark:bg-gray-700 dark:text-brand-400"
            : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
      >
        💬 Chat
      </button>
      <button
        onClick={() => onChange("embedding")}
        className={`rounded-md px-6 py-2 text-sm font-medium transition-colors ${
          activeSelection === "embedding"
            ? "bg-white text-brand-600 shadow-sm dark:bg-gray-700 dark:text-brand-400"
            : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
      >
        🔢 Embedding
      </button>
    </div>
  );
};

// ============================================================================
// Provider Card Component
// ============================================================================

interface ProviderCardProps {
  provider: ProviderConfig;
  isSelected: boolean;
  onClick: () => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  isSelected,
  onClick,
}) => {
  const colorClasses = {
    green: "border-green-500/30 bg-green-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    red: "border-red-500/30 bg-red-500/5",
    orange: "border-orange-500/30 bg-orange-500/5",
    purple: "border-purple-500/30 bg-purple-500/5",
    cyan: "border-cyan-500/30 bg-cyan-500/5",
    pink: "border-pink-500/30 bg-pink-500/5",
    gray: "border-gray-500/30 bg-gray-500/5",
  };

  const colorClass =
    colorClasses[provider.color as keyof typeof colorClasses] ||
    colorClasses.gray;

  return (
    <button
      onClick={onClick}
      className={`group relative rounded-lg border p-4 text-left transition-all ${
        isSelected
          ? `${colorClass} ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-gray-900`
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
      }`}
    >
      {isSelected && (
        <div className="absolute -right-2 -top-2">
          <div className="rounded-full bg-brand-500 p-1">
            <HiCheck className="h-4 w-4 text-white" />
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-2 shadow-sm dark:bg-gray-700">
          <img
            src={`/logos/${provider.key}.svg`}
            alt={`${provider.name} logo`}
            className="h-full w-full object-contain"
            onError={(e) => {
              // Fallback to emoji icon if logo not found
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "block";
            }}
          />
          <div className="hidden text-2xl">{provider.icon}</div>
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-white">
            {provider.name}
          </h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {provider.description}
          </p>
        </div>
      </div>
    </button>
  );
};

// ============================================================================
// Azure Configuration Panel Component
// ============================================================================

interface AzureConfigPanelProps {
  mode: SelectionMode;
  chatConfig: AzureChatConfig;
  embeddingConfig: AzureEmbeddingConfig;
  onChatConfigChange: (config: AzureChatConfig) => void;
  onEmbeddingConfigChange: (config: AzureEmbeddingConfig) => void;
  onSave: () => Promise<void>;
  onTest: () => Promise<void>;
  saving: boolean;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
}

const AzureConfigPanel: React.FC<AzureConfigPanelProps> = ({
  mode,
  chatConfig,
  embeddingConfig,
  onChatConfigChange,
  onEmbeddingConfigChange,
  onSave,
  onTest,
  saving,
  testing,
  testResult,
}) => {
  const config = mode === "chat" ? chatConfig : embeddingConfig;
  const setConfig =
    mode === "chat" ? onChatConfigChange : onEmbeddingConfigChange;

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-2xl">☁️</span>
        <h4 className="font-medium text-gray-900 dark:text-white">
          Azure OpenAI Configuration ({mode === "chat" ? "Chat" : "Embedding"})
        </h4>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Endpoint URL
          </label>
          <input
            type="text"
            value={
              mode === "chat"
                ? chatConfig.AZURE_OPENAI_CHAT_ENDPOINT
                : embeddingConfig.AZURE_OPENAI_EMBEDDING_ENDPOINT
            }
            onChange={(e) =>
              setConfig({
                ...config,
                [mode === "chat"
                  ? "AZURE_OPENAI_CHAT_ENDPOINT"
                  : "AZURE_OPENAI_EMBEDDING_ENDPOINT"]: e.target.value,
              } as any)
            }
            onBlur={(e) => {
              // Normalize endpoint URL when user finishes editing
              const normalized = normalizeAzureEndpoint(e.target.value);
              if (normalized !== e.target.value) {
                setConfig({
                  ...config,
                  [mode === "chat"
                    ? "AZURE_OPENAI_CHAT_ENDPOINT"
                    : "AZURE_OPENAI_EMBEDDING_ENDPOINT"]: normalized,
                } as any);
              }
            }}
            placeholder="https://your-resource.openai.azure.com"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Base URL only (deployment paths will be automatically removed)
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            API Version
          </label>
          <input
            type="text"
            value={
              mode === "chat"
                ? chatConfig.AZURE_OPENAI_CHAT_API_VERSION
                : embeddingConfig.AZURE_OPENAI_EMBEDDING_API_VERSION
            }
            onChange={(e) =>
              setConfig({
                ...config,
                [mode === "chat"
                  ? "AZURE_OPENAI_CHAT_API_VERSION"
                  : "AZURE_OPENAI_EMBEDDING_API_VERSION"]: e.target.value,
              } as any)
            }
            placeholder="2024-02-01"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Deployment Name
          </label>
          <input
            type="text"
            value={
              mode === "chat"
                ? chatConfig.AZURE_OPENAI_CHAT_DEPLOYMENT
                : embeddingConfig.AZURE_OPENAI_EMBEDDING_DEPLOYMENT
            }
            onChange={(e) =>
              setConfig({
                ...config,
                [mode === "chat"
                  ? "AZURE_OPENAI_CHAT_DEPLOYMENT"
                  : "AZURE_OPENAI_EMBEDDING_DEPLOYMENT"]: e.target.value,
              } as any)
            }
            placeholder={mode === "chat" ? "gpt-4o-mini" : "text-embedding-3-small"}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            API Key {config.AZURE_OPENAI_API_KEY_SET && (
              <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ Configured</span>
            )}
          </label>
          <div className="relative">
            <input
              type="password"
              value={config.AZURE_OPENAI_API_KEY}
              onChange={(e) =>
                setConfig({
                  ...config,
                  AZURE_OPENAI_API_KEY: e.target.value,
                } as any)
              }
              placeholder={config.AZURE_OPENAI_API_KEY_SET ? "Enter new key to update" : "Enter your Azure OpenAI API key"}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <HiKey className="h-4 w-4 text-gray-400" />
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            API key is shared between Chat and Embedding. Updating in either mode will update both.
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
            onClick={onTest}
            disabled={testing || saving}
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
            onClick={onSave}
            disabled={saving || testing}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <HiSave className="h-4 w-4" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// RAG Settings Tab Component
// ============================================================================

export default function RAGSettingsTab() {
  // ==========================================================================
  // State Management
  // ==========================================================================

  const [activeSelection, setActiveSelection] = useState<SelectionMode>("chat");
  const [chatProvider, setChatProvider] = useState<ProviderKey>("openai");
  const [embeddingProvider, setEmbeddingProvider] =
    useState<ProviderKey>("openai");

  const [settings, setSettings] = useState<RagSettings>({
    USE_CONTEXTUAL_EMBEDDINGS: false,
    CONTEXTUAL_EMBEDDINGS_MAX_WORKERS: 3,
    USE_HYBRID_SEARCH: true,
    USE_AGENTIC_RAG: true,
    USE_RERANKING: true,
    MODEL_CHOICE: "gpt-4.1-nano",
  });

  const [azureChatConfig, setAzureChatConfig] = useState<AzureChatConfig>({
    AZURE_OPENAI_CHAT_ENDPOINT: "",
    AZURE_OPENAI_CHAT_API_VERSION: "2024-02-01",
    AZURE_OPENAI_CHAT_DEPLOYMENT: "",
    AZURE_OPENAI_API_KEY: "",
    AZURE_OPENAI_API_KEY_SET: false,
  });

  const [azureEmbeddingConfig, setAzureEmbeddingConfig] =
    useState<AzureEmbeddingConfig>({
      AZURE_OPENAI_EMBEDDING_ENDPOINT: "",
      AZURE_OPENAI_EMBEDDING_API_VERSION: "2024-02-01",
      AZURE_OPENAI_EMBEDDING_DEPLOYMENT: "",
      AZURE_OPENAI_API_KEY: "",
      AZURE_OPENAI_API_KEY_SET: false,
    });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // ==========================================================================
  // Load Settings on Mount
  // ==========================================================================

  useEffect(() => {
    loadSettings();
    loadProviderPreferences();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const ragSettings = await credentialsService.getRagSettings();
      const azureChat = await credentialsService.getAzureChatConfig();
      const azureEmbed = await credentialsService.getAzureEmbeddingConfig();

      setSettings(ragSettings);
      setAzureChatConfig(azureChat);
      setAzureEmbeddingConfig(azureEmbed);

      // Set providers from settings
      if (ragSettings.LLM_PROVIDER) {
        setChatProvider(ragSettings.LLM_PROVIDER as ProviderKey);
      }
      if (ragSettings.EMBEDDING_PROVIDER) {
        setEmbeddingProvider(ragSettings.EMBEDDING_PROVIDER as ProviderKey);
      }
    } catch (error) {
      console.error("Failed to load RAG settings:", error);
      showToast("Failed to load RAG settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadProviderPreferences = () => {
    try {
      const savedChatProvider = localStorage.getItem(
        STORAGE_KEYS.CHAT_PROVIDER
      );
      const savedEmbeddingProvider = localStorage.getItem(
        STORAGE_KEYS.EMBEDDING_PROVIDER
      );

      if (savedChatProvider) {
        setChatProvider(savedChatProvider as ProviderKey);
      }
      if (savedEmbeddingProvider) {
        setEmbeddingProvider(savedEmbeddingProvider as ProviderKey);
      }
    } catch (error) {
      console.error("Failed to load provider preferences:", error);
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
  // Provider Selection Handlers
  // ==========================================================================

  const handleProviderSelect = (providerKey: ProviderKey) => {
    if (activeSelection === "chat") {
      setChatProvider(providerKey);
      localStorage.setItem(STORAGE_KEYS.CHAT_PROVIDER, providerKey);
    } else {
      setEmbeddingProvider(providerKey);
      localStorage.setItem(STORAGE_KEYS.EMBEDDING_PROVIDER, providerKey);
    }
    // Clear test result when switching providers
    setTestResult(null);
  };

  // ==========================================================================
  // Save Handlers
  // ==========================================================================

  const saveStrategySettings = async () => {
    try {
      setSaving("strategy");

      // Include provider selections
      const updatedSettings = {
        ...settings,
        LLM_PROVIDER: chatProvider,
        EMBEDDING_PROVIDER: embeddingProvider,
      };

      await credentialsService.updateRagSettings(updatedSettings);
      showToast("RAG strategy settings saved successfully", "success");
    } catch (error) {
      console.error("Failed to save RAG strategy settings:", error);
      showToast("Failed to save RAG strategy settings", "error");
    } finally {
      setSaving(null);
    }
  };

  const saveCrawlingSettings = async () => {
    try {
      setSaving("crawling");

      // Pass complete settings object - the service handles extracting relevant fields
      await credentialsService.updateRagSettings(settings);
      showToast("Crawling performance settings saved successfully", "success");
    } catch (error) {
      console.error("Failed to save crawling settings:", error);
      showToast("Failed to save crawling settings", "error");
    } finally {
      setSaving(null);
    }
  };

  const saveStorageSettings = async () => {
    try {
      setSaving("storage");

      // Pass complete settings object - the service handles extracting relevant fields
      await credentialsService.updateRagSettings(settings);
      showToast("Storage performance settings saved successfully", "success");
    } catch (error) {
      console.error("Failed to save storage settings:", error);
      showToast("Failed to save storage settings", "error");
    } finally {
      setSaving(null);
    }
  };

  const saveAdvancedSettings = async () => {
    try {
      setSaving("advanced");

      // Pass complete settings object - the service handles extracting relevant fields
      await credentialsService.updateRagSettings(settings);
      showToast("Advanced settings saved successfully", "success");
    } catch (error) {
      console.error("Failed to save advanced settings:", error);
      showToast("Failed to save advanced settings", "error");
    } finally {
      setSaving(null);
    }
  };

  const saveAzureConfig = async () => {
    try {
      setSaving("azure");

      // Normalize Azure endpoints before saving to prevent deployment path pollution
      if (activeSelection === "chat") {
        const normalizedConfig = {
          ...azureChatConfig,
          AZURE_OPENAI_CHAT_ENDPOINT: normalizeAzureEndpoint(
            azureChatConfig.AZURE_OPENAI_CHAT_ENDPOINT
          ),
        };
        await credentialsService.updateAzureChatConfig(normalizedConfig);
      } else {
        const normalizedConfig = {
          ...azureEmbeddingConfig,
          AZURE_OPENAI_EMBEDDING_ENDPOINT: normalizeAzureEndpoint(
            azureEmbeddingConfig.AZURE_OPENAI_EMBEDDING_ENDPOINT
          ),
        };
        await credentialsService.updateAzureEmbeddingConfig(normalizedConfig);
      }

      showToast(
        `Azure ${activeSelection} configuration saved successfully`,
        "success"
      );
    } catch (error) {
      console.error("Failed to save Azure configuration:", error);
      showToast("Failed to save Azure configuration", "error");
    } finally {
      setSaving(null);
    }
  };

  // ==========================================================================
  // Test Connection Handler
  // ==========================================================================

  const testAzureConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const config =
        activeSelection === "chat" ? azureChatConfig : azureEmbeddingConfig;

      const endpoint =
        activeSelection === "chat"
          ? (config as AzureChatConfig).AZURE_OPENAI_CHAT_ENDPOINT
          : (config as AzureEmbeddingConfig).AZURE_OPENAI_EMBEDDING_ENDPOINT;

      const deployment =
        activeSelection === "chat"
          ? (config as AzureChatConfig).AZURE_OPENAI_CHAT_DEPLOYMENT
          : (config as AzureEmbeddingConfig).AZURE_OPENAI_EMBEDDING_DEPLOYMENT;

      const apiVersion =
        activeSelection === "chat"
          ? (config as AzureChatConfig).AZURE_OPENAI_CHAT_API_VERSION
          : (config as AzureEmbeddingConfig).AZURE_OPENAI_EMBEDDING_API_VERSION;

      // Get Azure API key from config (user input or masked from backend)
      // If user entered a new key (non-masked), use it; otherwise use the existing key from settings
      let apiKey = config.AZURE_OPENAI_API_KEY || "";

      // If the key is masked (starts with dots), and we have an existing key in settings, we need to inform user
      if (apiKey.startsWith("••••") || !apiKey) {
        // Fall back to settings API key for backward compatibility
        apiKey = settings.AZURE_OPENAI_API_KEY || "";
        if (!apiKey) {
          setTestResult({
            ok: false,
            message: "Please enter an API key in the Azure configuration panel above.",
          });
          setTesting(false);
          return;
        }
      }

      const result = await credentialsService.testProviderConnection(
        "azure-openai",
        activeSelection,
        {
          endpoint,
          api_key: apiKey,
          deployment,
          api_version: apiVersion,
        }
      );

      setTestResult(result);
    } catch (error) {
      console.error("Failed to test Azure connection:", error);
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  // ==========================================================================
  // Filtered Providers
  // ==========================================================================

  const filteredProviders = PROVIDERS.filter((provider) =>
    provider.supportedModes.includes(activeSelection)
  );

  const currentProvider =
    activeSelection === "chat" ? chatProvider : embeddingProvider;

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <p className="ml-3 text-gray-500 dark:text-gray-400">
          Loading RAG settings...
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
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          RAG Settings
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure retrieval-augmented generation settings and provider
          selection
        </p>
      </div>

      {/* Selection Toggle */}
      <div className="flex items-center justify-between">
        <SelectionToggle
          activeSelection={activeSelection}
          onChange={setActiveSelection}
        />
        <button
          onClick={loadSettings}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <HiRefresh className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Provider Selection Grid */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Select {activeSelection === "chat" ? "Chat" : "Embedding"} Provider
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.key}
              provider={provider}
              isSelected={currentProvider === provider.key}
              onClick={() => handleProviderSelect(provider.key)}
            />
          ))}
        </div>
      </div>

      {/* Azure Configuration Panel */}
      {currentProvider === "azure-openai" && (
        <AzureConfigPanel
          mode={activeSelection}
          chatConfig={azureChatConfig}
          embeddingConfig={azureEmbeddingConfig}
          onChatConfigChange={setAzureChatConfig}
          onEmbeddingConfigChange={setAzureEmbeddingConfig}
          onSave={saveAzureConfig}
          onTest={testAzureConnection}
          saving={saving === "azure"}
          testing={testing}
          testResult={testResult}
        />
      )}

      {/* Strategy Settings Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Strategy Settings
        </h3>
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {STRATEGY_SETTINGS.map((setting) => (
            <div key={setting.key} className="flex items-center justify-between">
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
                      setSettings({
                        ...settings,
                        [setting.key]: !(settings as any)[setting.key],
                      })
                    }
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      (settings as any)[setting.key]
                        ? "bg-brand-600"
                        : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  >
                    <span
                      className={`${
                        (settings as any)[setting.key]
                          ? "translate-x-7"
                          : "translate-x-1"
                      } inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform`}
                    />
                  </button>
                ) : setting.type === "number" ? (
                  <input
                    type="number"
                    value={(settings as any)[setting.key]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [setting.key]: parseInt(e.target.value, 10),
                      })
                    }
                    min={setting.min}
                    max={setting.max}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                ) : (
                  <input
                    type="text"
                    value={(settings as any)[setting.key]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [setting.key]: e.target.value,
                      })
                    }
                    className="w-48 rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                )}
              </div>
            </div>
          ))}
          <div className="mt-4 flex justify-end">
            <button
              onClick={saveStrategySettings}
              disabled={saving === "strategy"}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving === "strategy" ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <HiSave className="h-4 w-4" />
                  Save Strategy Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Crawling Performance Settings Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Crawling Performance Settings
        </h3>
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {CRAWLING_SETTINGS.map((setting) => (
            <div
              key={setting.key}
              className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-gray-700"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {setting.label}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {setting.description}
                </div>
              </div>
              <div>
                {setting.type === "select" ? (
                  <select
                    value={(settings as any)[setting.key] || "domcontentloaded"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [setting.key]: e.target.value,
                      })
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    {setting.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : setting.type === "number" ? (
                  <input
                    type="number"
                    value={(settings as any)[setting.key] || 0}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [setting.key]: parseInt(e.target.value, 10),
                      })
                    }
                    min={setting.min}
                    max={setting.max}
                    className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                ) : (
                  <input
                    type="text"
                    value={(settings as any)[(setting as any).key] || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [(setting as any).key]: e.target.value,
                      })
                    }
                    className="w-48 rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                )}
              </div>
            </div>
          ))}
          <div className="mt-4 flex justify-end">
            <button
              onClick={saveCrawlingSettings}
              disabled={saving === "crawling"}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving === "crawling" ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <HiSave className="h-4 w-4" />
                  Save Crawling Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Storage Performance Settings Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Storage Performance Settings
        </h3>
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {STORAGE_SETTINGS.map((setting) => (
            <div
              key={setting.key}
              className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-gray-700"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {setting.label}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {setting.description}
                </div>
              </div>
              <div>
                {setting.type === "boolean" ? (
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        [setting.key]: !(settings as any)[setting.key],
                      })
                    }
                    className={`${
                      (settings as any)[setting.key]
                        ? "bg-brand-600"
                        : "bg-gray-200 dark:bg-gray-700"
                    } relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800`}
                  >
                    <span
                      className={`${
                        (settings as any)[setting.key]
                          ? "translate-x-7"
                          : "translate-x-1"
                      } inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform`}
                    />
                  </button>
                ) : setting.type === "number" ? (
                  <input
                    type="number"
                    value={(settings as any)[setting.key] || 0}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [setting.key]: parseInt(e.target.value, 10),
                      })
                    }
                    min={setting.min}
                    max={setting.max}
                    className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                ) : (
                  <input
                    type="text"
                    value={(settings as any)[(setting as any).key] || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [(setting as any).key]: e.target.value,
                      })
                    }
                    className="w-48 rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                )}
              </div>
            </div>
          ))}
          <div className="mt-4 flex justify-end">
            <button
              onClick={saveStorageSettings}
              disabled={saving === "storage"}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving === "storage" ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <HiSave className="h-4 w-4" />
                  Save Storage Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Settings Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Advanced Settings
        </h3>
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {ADVANCED_SETTINGS.map((setting) => (
            <div
              key={setting.key}
              className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-gray-700"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {setting.label}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {setting.description}
                </div>
              </div>
              <div>
                <input
                  type="number"
                  value={(settings as any)[setting.key] || 0}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      [setting.key]: parseInt(e.target.value, 10),
                    })
                  }
                  min={setting.min}
                  max={setting.max}
                  className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          ))}
          <div className="mt-4 flex justify-end">
            <button
              onClick={saveAdvancedSettings}
              disabled={saving === "advanced"}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving === "advanced" ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <HiSave className="h-4 w-4" />
                  Save Advanced Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
