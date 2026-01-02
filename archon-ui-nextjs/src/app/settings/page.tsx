"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HiCog, HiKey, HiGlobe, HiEye, HiBell, HiCode, HiLightningBolt, HiDatabase, HiInformationCircle } from "react-icons/hi";
import { HiBugAnt } from "react-icons/hi2";
import TabView, { TabItem } from "@/components/common/TabView";
import { GeneralSettings } from "./components/GeneralSettings";
import FeaturesTab from "./components/FeaturesTab";
import RAGSettingsTab from "./components/RAGSettingsTab";
import CodeExtractionTab from "./components/CodeExtractionTab";
import BugReportTab from "./components/BugReportTab";
import { ApiKeySettings } from "./components/ApiKeySettings";
import { CrawlSettings } from "./components/CrawlSettings";
import { DisplaySettings } from "./components/DisplaySettings";
import { McpSettings } from "./components/McpSettings";
import { NotificationSettings } from "./components/NotificationSettings";
import LogFireSettingsTab from "./components/LogFireSettingsTab";
import VersionUpdatesTab from "./components/VersionUpdatesTab";
import MigrationsTab from "./components/MigrationsTab";
import IDEGlobalRulesTab from "./components/IDEGlobalRulesTab";

export default function SettingsPage() {
  const { isLoading, fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const settingsTabs: TabItem[] = [
    {
      id: "features",
      label: "Features",
      icon: HiLightningBolt,
      component: <FeaturesTab />,
      default: true,
    },
    {
      id: "rag",
      label: "RAG Settings",
      icon: HiDatabase,
      component: <RAGSettingsTab />,
    },
    {
      id: "code_extraction",
      label: "Code Extraction",
      icon: HiCode,
      component: <CodeExtractionTab />,
    },
    {
      id: "logfire",
      label: "LogFire",
      icon: HiLightningBolt,
      component: <LogFireSettingsTab />,
    },
    {
      id: "api_keys",
      label: "API Keys",
      icon: HiKey,
      component: <ApiKeySettings />,
    },
    {
      id: "version",
      label: "Version & Updates",
      icon: HiInformationCircle,
      component: <VersionUpdatesTab />,
    },
    {
      id: "migrations",
      label: "Migrations",
      icon: HiDatabase,
      component: <MigrationsTab />,
    },
    {
      id: "ide_rules",
      label: "IDE Rules",
      icon: HiCode,
      component: <IDEGlobalRulesTab />,
    },
    {
      id: "general",
      label: "General",
      icon: HiCog,
      component: <GeneralSettings />,
    },
    {
      id: "crawl",
      label: "Crawl Settings",
      icon: HiGlobe,
      component: <CrawlSettings />,
    },
    {
      id: "display",
      label: "Display",
      icon: HiEye,
      component: <DisplaySettings />,
    },
    {
      id: "mcp",
      label: "MCP Integration",
      icon: HiCode,
      component: <McpSettings />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: HiBell,
      component: <NotificationSettings />,
    },
    {
      id: "bug_report",
      label: "Bug Report",
      icon: HiBugAnt,
      component: <BugReportTab />,
    },
  ];

  return (
    <section className="p-4">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your application preferences and configuration
        </p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            <p className="ml-3 text-gray-500 dark:text-gray-400">Loading settings...</p>
          </div>
        </div>
      ) : (
        /* Horizontal Tabs Navigation + Content */
        <TabView tabsList={settingsTabs} />
      )}
    </section>
  );
}
