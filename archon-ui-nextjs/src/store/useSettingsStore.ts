import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppSettings,
  SettingsUpdateRequest,
  GeneralSettings,
  ApiKeySettings,
  CrawlSettings,
  DisplaySettings,
  McpSettings,
  NotificationSettings,
} from '@/lib/types';
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
