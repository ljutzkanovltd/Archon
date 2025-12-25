# Phase 5: Settings & MCP Integration - Implementation Plan

**Document Version**: 1.0.0
**Date**: 2025-12-23
**Estimated Duration**: 15-20 hours
**Priority**: HIGH (Critical for production)
**Dependencies**: Phases 0-4 Complete ✅

---

## Executive Summary

Phase 5 integrates critical production features: **Settings Management** and **Model Context Protocol (MCP) Integration**. This phase transforms the Archon UI from a knowledge base viewer into a full-featured MCP server management interface, enabling AI assistants (Claude, Cursor, etc.) to access Archon's knowledge base programmatically.

### Key Deliverables

1. **Settings Page** - System configuration, API keys, crawl preferences, display options
2. **MCP Server Integration** - Connect to Archon's MCP endpoint (port 8051)
3. **MCP Tools UI** - Visual interface for MCP tools (search, create tasks, manage projects)
4. **MCP Inspector** - Debug MCP requests/responses in real-time
5. **API Key Management** - Secure storage for OpenAI, Azure, etc.
6. **Crawl Configuration** - Default crawl depth, rate limiting, robots.txt respect
7. **User Preferences** - Theme, sidebar state, default views, notifications

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Archon UI Next.js (Port 3738)            │
│                                                              │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Settings Page  │  │  MCP Client  │  │  MCP Inspector  │ │
│  │                │  │              │  │                 │ │
│  │ - API Keys     │  │ - WebSocket  │  │ - Request Log   │ │
│  │ - Crawl Config │  │ - JSON-RPC   │  │ - Response View │ │
│  │ - Preferences  │  │ - Tool Calls │  │ - Error Display │ │
│  └────────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
│           │                 │                    │          │
│           └─────────────────┼────────────────────┘          │
│                             ▼                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Archon MCP Server (Port 8051)                   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MCP Protocol (JSON-RPC 2.0 over HTTP/WebSocket)     │  │
│  │                                                       │  │
│  │ Tools:                                               │  │
│  │ - archon:rag_search_knowledge_base                   │  │
│  │ - archon:rag_search_code_examples                    │  │
│  │ - archon:rag_get_available_sources                   │  │
│  │ - archon:rag_read_full_page                          │  │
│  │ - archon:find_projects                               │  │
│  │ - archon:manage_project                              │  │
│  │ - archon:find_tasks                                  │  │
│  │ - archon:manage_task                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ PostgreSQL/Supabase
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Database (pgvector + archon_* tables)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase Breakdown

### Sub-Phase 5.1: Settings Foundation (3-4 hours)

**Objective**: Create settings infrastructure and basic settings page

#### Tasks:

##### Task 5.1.1: Create Settings Types and Schema
**File**: `src/lib/types.ts`
**Duration**: 30 minutes

```typescript
// ==================== SETTINGS TYPES ====================

export interface AppSettings {
  general: GeneralSettings;
  api_keys: ApiKeySettings;
  crawl: CrawlSettings;
  display: DisplaySettings;
  mcp: McpSettings;
  notifications: NotificationSettings;
}

export interface GeneralSettings {
  site_name: string;
  site_url: string;
  admin_email: string;
  timezone: string;
  language: string;
}

export interface ApiKeySettings {
  openai_api_key?: string;
  azure_openai_endpoint?: string;
  azure_openai_key?: string;
  azure_openai_api_version?: string;
  azure_openai_deployment?: string;
  supabase_url?: string;
  supabase_service_key?: string;
}

export interface CrawlSettings {
  default_max_depth: number;  // 1-5
  default_crawl_type: "technical" | "business";
  extract_code_examples: boolean;
  respect_robots_txt: boolean;
  rate_limit_delay_ms: number;  // Milliseconds between requests
  max_concurrent_crawls: number;
  user_agent: string;
}

export interface DisplaySettings {
  default_theme: "light" | "dark" | "system";
  default_view_mode: "grid" | "table";
  items_per_page: number;
  show_sidebar_by_default: boolean;
  sidebar_collapsed_by_default: boolean;
  enable_animations: boolean;
}

export interface McpSettings {
  mcp_server_url: string;  // default: http://localhost:8051
  mcp_enabled: boolean;
  mcp_timeout_ms: number;
  enable_mcp_inspector: boolean;  // Debug mode
  log_mcp_requests: boolean;
}

export interface NotificationSettings {
  enable_notifications: boolean;
  crawl_complete_notification: boolean;
  error_notifications: boolean;
  notification_sound: boolean;
}

export interface SettingsUpdateRequest {
  section: keyof AppSettings;
  data: Partial<AppSettings[keyof AppSettings]>;
}
```

##### Task 5.1.2: Create Settings Store (Zustand)
**File**: `src/store/useSettingsStore.ts`
**Duration**: 1 hour

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, SettingsUpdateRequest } from '@/lib/types';
import { settingsApi } from '@/lib/apiClient';

interface SettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (request: SettingsUpdateRequest) => Promise<void>;
  resetSettings: () => Promise<void>;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

const defaultSettings: AppSettings = {
  general: {
    site_name: "Archon Dashboard",
    site_url: "http://localhost:3738",
    admin_email: "admin@example.com",
    timezone: "UTC",
    language: "en",
  },
  api_keys: {},
  crawl: {
    default_max_depth: 2,
    default_crawl_type: "technical",
    extract_code_examples: true,
    respect_robots_txt: true,
    rate_limit_delay_ms: 1000,
    max_concurrent_crawls: 3,
    user_agent: "Archon Knowledge Base Crawler/1.0",
  },
  display: {
    default_theme: "system",
    default_view_mode: "grid",
    items_per_page: 20,
    show_sidebar_by_default: true,
    sidebar_collapsed_by_default: false,
    enable_animations: true,
  },
  mcp: {
    mcp_server_url: "http://localhost:8051",
    mcp_enabled: true,
    mcp_timeout_ms: 30000,
    enable_mcp_inspector: false,
    log_mcp_requests: false,
  },
  notifications: {
    enable_notifications: true,
    crawl_complete_notification: true,
    error_notifications: true,
    notification_sound: false,
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      isLoading: false,
      error: null,

      fetchSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await settingsApi.getSettings();
          set({ settings: response.data || defaultSettings, isLoading: false });
        } catch (error) {
          console.error('Failed to fetch settings:', error);
          set({ error: 'Failed to fetch settings', isLoading: false });
        }
      },

      updateSettings: async (request: SettingsUpdateRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await settingsApi.updateSettings(request);
          set(state => ({
            settings: {
              ...state.settings!,
              [request.section]: {
                ...state.settings![request.section],
                ...request.data,
              },
            },
            isLoading: false,
          }));
        } catch (error) {
          console.error('Failed to update settings:', error);
          set({ error: 'Failed to update settings', isLoading: false });
        }
      },

      resetSettings: async () => {
        set({ settings: defaultSettings });
      },

      setTheme: (theme: "light" | "dark" | "system") => {
        set(state => ({
          settings: {
            ...state.settings!,
            display: {
              ...state.settings!.display,
              default_theme: theme,
            },
          },
        }));
      },
    }),
    {
      name: 'archon-settings-storage',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
```

##### Task 5.1.3: Create Settings API Endpoints
**File**: `src/lib/apiClient.ts`
**Duration**: 30 minutes

```typescript
export const settingsApi = {
  /**
   * Get all settings
   */
  getSettings: async (): Promise<ApiResponse<AppSettings>> => {
    const response = await apiClient.get("/api/settings");
    return response.data;
  },

  /**
   * Update settings section
   */
  updateSettings: async (request: SettingsUpdateRequest): Promise<ApiResponse<AppSettings>> => {
    const response = await apiClient.patch("/api/settings", request);
    return response.data;
  },

  /**
   * Reset settings to defaults
   */
  resetSettings: async (): Promise<ApiResponse<AppSettings>> => {
    const response = await apiClient.post("/api/settings/reset");
    return response.data;
  },

  /**
   * Test API key validity
   */
  testApiKey: async (provider: "openai" | "azure", apiKey: string): Promise<ApiResponse<{ valid: boolean }>> => {
    const response = await apiClient.post("/api/settings/test-api-key", {
      provider,
      api_key: apiKey,
    });
    return response.data;
  },
};
```

##### Task 5.1.4: Create Settings Page Layout
**File**: `src/app/settings/page.tsx`
**Duration**: 1 hour

```typescript
"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HiCog, HiKey, HiGlobe, HiEye, HiBell, HiCode } from "react-icons/hi";

export default function SettingsPage() {
  const { settings, isLoading, fetchSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<"general" | "api_keys" | "crawl" | "display" | "mcp" | "notifications">("general");

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const tabs = [
    { id: "general", label: "General", icon: HiCog },
    { id: "api_keys", label: "API Keys", icon: HiKey },
    { id: "crawl", label: "Crawl Settings", icon: HiGlobe },
    { id: "display", label: "Display", icon: HiEye },
    { id: "mcp", label: "MCP Integration", icon: HiCode },
    { id: "notifications", label: "Notifications", icon: HiBell },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 dark:text-gray-100">Settings</h1>

      <div className="flex gap-8">
        {/* Sidebar Tabs */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? "bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          {isLoading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
              <p className="text-gray-500 dark:text-gray-400">Loading settings...</p>
            </div>
          ) : (
            <>
              {activeTab === "general" && <GeneralSettings />}
              {activeTab === "api_keys" && <ApiKeySettings />}
              {activeTab === "crawl" && <CrawlSettings />}
              {activeTab === "display" && <DisplaySettings />}
              {activeTab === "mcp" && <McpSettings />}
              {activeTab === "notifications" && <NotificationSettings />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

##### Task 5.1.5: Create Settings Sections Components
**Files**: `src/app/settings/components/` (6 components)
**Duration**: 1.5 hours

Each settings section component will follow this pattern:

```typescript
// Example: GeneralSettings.tsx
"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HiCheck, HiX } from "react-icons/hi";

export function GeneralSettings() {
  const { settings, updateSettings } = useSettingsStore();
  const [formData, setFormData] = useState(settings?.general || {});
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ section: "general", data: formData });
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
      <h2 className="text-xl font-semibold mb-6 dark:text-gray-100">General Settings</h2>

      {/* Form fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Site Name
          </label>
          <input
            type="text"
            value={formData.site_name}
            onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
        </div>

        {/* More fields... */}
      </div>

      {/* Save Button */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50"
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
```

---

### Sub-Phase 5.2: MCP Client Integration (4-5 hours)

**Objective**: Implement MCP protocol client to communicate with Archon MCP server

#### Tasks:

##### Task 5.2.1: Create MCP Client Library
**File**: `src/lib/mcpClient.ts`
**Duration**: 2 hours

```typescript
/**
 * MCP (Model Context Protocol) Client
 * Implements JSON-RPC 2.0 over HTTP/WebSocket
 */

export interface McpRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, any>;
  id: string | number;
}

export interface McpResponse<T = any> {
  jsonrpc: "2.0";
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

class McpClient {
  private baseUrl: string;
  private timeout: number;
  private requestId: number = 0;

  constructor(baseUrl: string = "http://localhost:8051", timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Make MCP tool call
   */
  async callTool(toolName: string, params: Record<string, any>): Promise<any> {
    const request: McpRequest = {
      jsonrpc: "2.0",
      method: `tools/${toolName}`,
      params,
      id: ++this.requestId,
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.statusText}`);
    }

    const mcpResponse: McpResponse = await response.json();

    if (mcpResponse.error) {
      throw new Error(`MCP error: ${mcpResponse.error.message}`);
    }

    return mcpResponse.result;
  }

  /**
   * List available tools
   */
  async listTools(): Promise<McpTool[]> {
    const request: McpRequest = {
      jsonrpc: "2.0",
      method: "tools/list",
      id: ++this.requestId,
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    const mcpResponse: McpResponse<{ tools: McpTool[] }> = await response.json();
    return mcpResponse.result?.tools || [];
  }

  /**
   * Search knowledge base via MCP
   */
  async searchKnowledgeBase(query: string, source_id?: string, match_count: number = 5) {
    return this.callTool("archon:rag_search_knowledge_base", {
      query,
      source_id,
      match_count,
    });
  }

  /**
   * Search code examples via MCP
   */
  async searchCodeExamples(query: string, source_id?: string, match_count: number = 5) {
    return this.callTool("archon:rag_search_code_examples", {
      query,
      source_id,
      match_count,
    });
  }

  /**
   * Get available knowledge sources via MCP
   */
  async getAvailableSources() {
    return this.callTool("archon:rag_get_available_sources", {});
  }

  /**
   * Read full page via MCP
   */
  async readFullPage(page_id?: string, url?: string) {
    return this.callTool("archon:rag_read_full_page", {
      page_id,
      url,
    });
  }

  /**
   * Find projects via MCP
   */
  async findProjects(project_id?: string, query?: string) {
    return this.callTool("archon:find_projects", {
      project_id,
      query,
    });
  }

  /**
   * Manage project via MCP
   */
  async manageProject(action: string, project_id?: string, title?: string, description?: string) {
    return this.callTool("archon:manage_project", {
      action,
      project_id,
      title,
      description,
    });
  }

  /**
   * Find tasks via MCP
   */
  async findTasks(task_id?: string, query?: string, filter_by?: string, filter_value?: string) {
    return this.callTool("archon:find_tasks", {
      task_id,
      query,
      filter_by,
      filter_value,
    });
  }

  /**
   * Manage task via MCP
   */
  async manageTask(action: string, task_id?: string, project_id?: string, title?: string, description?: string, status?: string) {
    return this.callTool("archon:manage_task", {
      action,
      task_id,
      project_id,
      title,
      description,
      status,
    });
  }
}

// Export singleton instance
export const mcpClient = new McpClient();
```

##### Task 5.2.2: Create MCP Store (Zustand)
**File**: `src/store/useMcpStore.ts`
**Duration**: 1 hour

```typescript
import { create } from 'zustand';
import { mcpClient, McpTool } from '@/lib/mcpClient';

interface McpState {
  tools: McpTool[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  requestLog: McpRequestLogEntry[];

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  listTools: () => Promise<void>;
  logRequest: (entry: McpRequestLogEntry) => void;
  clearLog: () => void;
}

interface McpRequestLogEntry {
  id: string;
  timestamp: string;
  method: string;
  params: Record<string, any>;
  response?: any;
  error?: string;
  duration_ms: number;
}

export const useMcpStore = create<McpState>((set, get) => ({
  tools: [],
  isConnected: false,
  isLoading: false,
  error: null,
  requestLog: [],

  connect: async () => {
    set({ isLoading: true, error: null });
    try {
      const tools = await mcpClient.listTools();
      set({ tools, isConnected: true, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnected: false,
        isLoading: false,
      });
    }
  },

  disconnect: () => {
    set({ isConnected: false, tools: [] });
  },

  listTools: async () => {
    set({ isLoading: true, error: null });
    try {
      const tools = await mcpClient.listTools();
      set({ tools, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to list tools',
        isLoading: false,
      });
    }
  },

  logRequest: (entry: McpRequestLogEntry) => {
    set(state => ({
      requestLog: [entry, ...state.requestLog].slice(0, 100), // Keep last 100 requests
    }));
  },

  clearLog: () => {
    set({ requestLog: [] });
  },
}));
```

##### Task 5.2.3: Create MCP Inspector UI
**File**: `src/app/mcp-inspector/page.tsx`
**Duration**: 1.5 hours

```typescript
"use client";

import { useState, useEffect } from "react";
import { useMcpStore } from "@/store/useMcpStore";
import { mcpClient } from "@/lib/mcpClient";
import { HiPlay, HiTrash, HiClipboard, HiCode } from "react-icons/hi";

export default function McpInspectorPage() {
  const { tools, isConnected, requestLog, connect, listTools, logRequest, clearLog } = useMcpStore();
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [params, setParams] = useState<string>("{}");
  const [response, setResponse] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  const handleExecute = async () => {
    if (!selectedTool) return;

    setIsExecuting(true);
    const startTime = performance.now();

    try {
      const parsedParams = JSON.parse(params);
      const result = await mcpClient.callTool(selectedTool, parsedParams);
      const duration = performance.now() - startTime;

      setResponse(result);

      logRequest({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        method: selectedTool,
        params: parsedParams,
        response: result,
        duration_ms: Math.round(duration),
      });
    } catch (error) {
      const duration = performance.now() - startTime;

      setResponse(null);

      logRequest({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        method: selectedTool,
        params: {},
        error: error instanceof Error ? error.message : "Unknown error",
        duration_ms: Math.round(duration),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold dark:text-gray-100">MCP Inspector</h1>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded-full text-sm ${isConnected ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"}`}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
          <button
            onClick={listTools}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
          >
            Refresh Tools
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel: Tool Execution */}
        <div className="space-y-6">
          {/* Tool Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-gray-100">Execute Tool</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                  Select Tool
                </label>
                <select
                  value={selectedTool || ""}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">Choose a tool...</option>
                  {tools.map((tool) => (
                    <option key={tool.name} value={tool.name}>
                      {tool.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                  Parameters (JSON)
                </label>
                <textarea
                  value={params}
                  onChange={(e) => setParams(e.target.value)}
                  placeholder='{"query": "react hooks"}'
                  rows={6}
                  className="w-full px-4 py-2 border rounded-lg font-mono text-sm dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              <button
                onClick={handleExecute}
                disabled={!selectedTool || isExecuting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50"
              >
                <HiPlay className="w-5 h-5" />
                {isExecuting ? "Executing..." : "Execute"}
              </button>
            </div>
          </div>

          {/* Response */}
          {response && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold dark:text-gray-100">Response</h2>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(response, null, 2))}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center gap-2"
                >
                  <HiClipboard className="w-4 h-4" />
                  Copy
                </button>
              </div>
              <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-96 text-xs font-mono">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Right Panel: Request Log */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold dark:text-gray-100">Request Log</h2>
            <button
              onClick={clearLog}
              className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded-lg flex items-center gap-2"
            >
              <HiTrash className="w-4 h-4" />
              Clear
            </button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-auto">
            {requestLog.map((entry) => (
              <div
                key={entry.id}
                className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HiCode className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <span className="font-mono text-sm font-semibold dark:text-gray-100">
                      {entry.method}
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${entry.error ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400" : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"}`}>
                    {entry.duration_ms}ms
                  </span>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {new Date(entry.timestamp).toLocaleString()}
                </div>

                {entry.error && (
                  <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded">
                    {entry.error}
                  </div>
                )}
              </div>
            ))}

            {requestLog.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No requests logged yet. Execute a tool to see requests here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Sub-Phase 5.3: MCP Tools UI (4-5 hours)

**Objective**: Create visual interfaces for using MCP tools directly from the UI

#### Tasks:

##### Task 5.3.1: Create MCP Tools Page
**File**: `src/app/mcp-tools/page.tsx`
**Duration**: 1 hour

```typescript
"use client";

import { useState } from "react";
import {
  McpSearchTool,
  McpProjectTool,
  McpTaskTool,
  McpSourcesTool
} from "@/components/McpTools";

export default function McpToolsPage() {
  const [activeCategory, setActiveCategory] = useState<"search" | "projects" | "tasks" | "sources">("search");

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 dark:text-gray-100">MCP Tools</h1>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: "search", label: "Knowledge Search" },
          { id: "projects", label: "Projects" },
          { id: "tasks", label: "Tasks" },
          { id: "sources", label: "Sources" },
        ].map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id as any)}
            className={`px-6 py-3 border-b-2 transition-colors ${
              activeCategory === category.id
                ? "border-brand-600 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Tool Components */}
      <div>
        {activeCategory === "search" && <McpSearchTool />}
        {activeCategory === "projects" && <McpProjectTool />}
        {activeCategory === "tasks" && <McpTaskTool />}
        {activeCategory === "sources" && <McpSourcesTool />}
      </div>
    </div>
  );
}
```

##### Task 5.3.2: Create MCP Search Tool Component
**File**: `src/components/McpTools/McpSearchTool.tsx`
**Duration**: 1.5 hours

```typescript
"use client";

import { useState } from "react";
import { mcpClient } from "@/lib/mcpClient";
import { HiSearch, HiDocument, HiCode } from "react-icons/hi";

export function McpSearchTool() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"knowledge" | "code">("knowledge");
  const [results, setResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      if (searchType === "knowledge") {
        const response = await mcpClient.searchKnowledgeBase(query, undefined, 10);
        setResults(response);
      } else {
        const response = await mcpClient.searchCodeExamples(query, undefined, 10);
        setResults(response);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-4">
          <div className="flex gap-4">
            <button
              onClick={() => setSearchType("knowledge")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border ${
                searchType === "knowledge"
                  ? "bg-brand-100 dark:bg-brand-900/20 border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                  : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              }`}
            >
              <HiDocument className="w-5 h-5" />
              Knowledge Base
            </button>
            <button
              onClick={() => setSearchType("code")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border ${
                searchType === "code"
                  ? "bg-brand-100 dark:bg-brand-900/20 border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                  : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              }`}
            >
              <HiCode className="w-5 h-5" />
              Code Examples
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={
                searchType === "knowledge"
                  ? "Search documentation..."
                  : "Search code examples..."
              }
              className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              <HiSearch className="w-5 h-5" />
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-gray-100">
            Results ({results.results?.length || 0})
          </h2>

          <div className="space-y-4">
            {results.results?.map((result: any, index: number) => (
              <div
                key={index}
                className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                {searchType === "knowledge" ? (
                  <>
                    <h3 className="font-semibold dark:text-gray-100">{result.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{result.url}</p>
                    <p className="text-sm mt-2 dark:text-gray-300">{result.preview}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded text-xs font-mono">
                        {result.language || "unknown"}
                      </span>
                    </div>
                    <pre className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto">
                      <code>{result.content}</code>
                    </pre>
                    {result.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {result.description}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

##### Task 5.3.3-5: Create remaining MCP Tool Components
**Files**:
- `src/components/McpTools/McpProjectTool.tsx` (1 hour)
- `src/components/McpTools/McpTaskTool.tsx` (1 hour)
- `src/components/McpTools/McpSourcesTool.tsx` (30 minutes)

---

### Sub-Phase 5.4: Settings UI Polish (2-3 hours)

**Objective**: Complete all settings sections with validation and testing

#### Tasks:

##### Task 5.4.1: API Key Settings with Testing
**File**: `src/app/settings/components/ApiKeySettings.tsx`
**Duration**: 1 hour

Features:
- Masked input fields for API keys
- "Test Connection" buttons
- Visual feedback for valid/invalid keys
- Secure storage warnings

##### Task 5.4.2: Crawl Settings with Validation
**File**: `src/app/settings/components/CrawlSettings.tsx`
**Duration**: 30 minutes

Features:
- Slider for max depth (1-5)
- Checkbox for code extraction
- Rate limit input with validation
- User agent customization

##### Task 5.4.3: Display Settings with Live Preview
**File**: `src/app/settings/components/DisplaySettings.tsx`
**Duration**: 45 minutes

Features:
- Theme switcher with immediate effect
- View mode toggle
- Pagination controls
- Animation enable/disable

##### Task 5.4.4: MCP Settings with Connection Status
**File**: `src/app/settings/components/McpSettings.tsx`
**Duration**: 45 minutes

Features:
- MCP server URL input
- "Test Connection" button
- Enable/disable MCP features
- Inspector toggle
- Request logging toggle

---

### Sub-Phase 5.5: Testing & Documentation (2-3 hours)

**Objective**: Comprehensive testing and user documentation

#### Tasks:

##### Task 5.5.1: Unit Tests for MCP Client
**File**: `src/lib/__tests__/mcpClient.test.ts`
**Duration**: 1 hour

Test coverage:
- MCP request/response formatting
- Tool calling with various parameters
- Error handling
- Timeout behavior

##### Task 5.5.2: Integration Tests for Settings
**File**: `src/app/settings/__tests__/settings.test.tsx`
**Duration**: 1 hour

Test coverage:
- Settings save/load
- Form validation
- API key testing
- Theme switching

##### Task 5.5.3: E2E Tests for MCP Tools
**File**: `e2e/mcp-tools.spec.ts`
**Duration**: 1 hour

Test scenarios:
- Search via MCP
- Create project via MCP
- Create task via MCP
- View MCP inspector

##### Task 5.5.4: User Documentation
**File**: `docs/MCP_INTEGRATION_GUIDE.md`
**Duration**: 1 hour

Content:
- What is MCP and why use it
- Setting up MCP with Claude/Cursor
- Using MCP Inspector
- Troubleshooting guide

---

## Success Criteria

### Functional Requirements ✅

- [ ] Settings page accessible and functional
- [ ] All 6 settings sections working (General, API Keys, Crawl, Display, MCP, Notifications)
- [ ] Settings persist across sessions
- [ ] MCP client connects to Archon MCP server (port 8051)
- [ ] All MCP tools callable from UI
- [ ] MCP Inspector logs requests/responses
- [ ] API keys can be tested before saving
- [ ] Theme changes apply immediately
- [ ] Settings export/import functionality

### Non-Functional Requirements ✅

- [ ] Settings page loads in < 500ms
- [ ] MCP requests complete in < 3s
- [ ] No password/API key leaks in logs
- [ ] Responsive design (mobile + desktop)
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Error boundaries catch all errors
- [ ] Unit test coverage > 70%
- [ ] E2E test coverage for critical paths

---

## Risk Mitigation

### Technical Risks

**Risk 1: MCP Server Connection Failures**
**Likelihood**: Medium | **Impact**: High
**Mitigation**:
- Implement automatic retry logic (3 attempts)
- Show clear connection status indicators
- Provide fallback to REST API endpoints
- Add MCP health check on settings page

**Risk 2: API Key Security**
**Likelihood**: Medium | **Impact**: Critical
**Mitigation**:
- Never store API keys in plain text
- Use encrypted storage (Web Crypto API)
- Mask displayed keys (show last 4 chars only)
- Implement key rotation reminders

**Risk 3: Settings Corruption**
**Likelihood**: Low | **Impact**: Medium
**Mitigation**:
- Settings validation on save
- Automatic backup before updates
- "Reset to defaults" button
- Export/import for manual backups

---

## Timeline & Milestones

### Week 1 (40 hours)

**Days 1-2** (Sub-Phase 5.1): Settings Foundation
- Settings types, store, API endpoints
- Settings page layout
- All 6 settings sections UI

**Days 3-4** (Sub-Phase 5.2): MCP Client Integration
- MCP client library
- MCP store
- MCP Inspector

**Day 5** (Sub-Phase 5.3 Part 1): MCP Tools UI
- MCP Tools page
- Search tool component
- Projects tool component

### Week 2 (20 hours)

**Days 1-2** (Sub-Phase 5.3 Part 2 + 5.4): Polish
- Tasks & Sources tool components
- API key testing
- Live preview features
- MCP connection testing

**Days 3-4** (Sub-Phase 5.5): Testing & Docs
- Write unit tests (15+)
- Write E2E tests (5+)
- MCP integration guide
- User documentation

**Day 5**: Buffer for bug fixes and refinement

---

## Dependencies & Prerequisites

### External Dependencies

- ✅ **Archon MCP Server** running on port 8051
- ✅ **Archon Backend API** running on port 8181
- ✅ **Supabase** instance for settings storage
- ⚠️ **Web Crypto API** (requires HTTPS in production)

### Internal Dependencies

- ✅ Phases 0-4 complete (foundation, filters, table, grid)
- ✅ Error boundaries implemented
- ✅ Testing infrastructure (Vitest + Playwright)
- ⚠️ Backend settings endpoint (may need to implement)

---

## Post-Phase 5 Enhancements

### Phase 5.1 (Future): Advanced MCP Features
- WebSocket support for real-time updates
- MCP tool chaining (compose multiple tools)
- Custom MCP tool creation UI
- MCP usage analytics dashboard

### Phase 5.2 (Future): Settings Advanced
- Multi-user settings profiles
- Organization-wide settings
- Settings version control
- Settings comparison tool

---

## Appendices

### Appendix A: MCP Protocol Reference

**JSON-RPC 2.0 Request Format**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/archon:rag_search_knowledge_base",
  "params": {
    "query": "react hooks",
    "match_count": 5
  },
  "id": 1
}
```

**JSON-RPC 2.0 Response Format**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "results": [...],
    "return_mode": "pages"
  },
  "id": 1
}
```

### Appendix B: Settings Schema

See `src/lib/types.ts` for complete TypeScript interfaces.

### Appendix C: Testing Strategy

**Unit Tests** (50 tests):
- MCP client (15 tests)
- Settings store (10 tests)
- Settings components (15 tests)
- MCP tools (10 tests)

**Integration Tests** (20 tests):
- Settings save/load flows (10 tests)
- MCP tool execution (10 tests)

**E2E Tests** (10 tests):
- Settings page workflows (5 tests)
- MCP tools workflows (5 tests)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-23
**Next Review**: After Phase 5 completion
**Approved By**: Development Team

---

**Total Estimated Effort**: 15-20 hours
**Recommended Team**: 1-2 developers
**Target Completion**: 1-2 weeks
