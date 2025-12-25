"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React, { FC, useMemo } from "react";

export interface TabItem {
  id: string;
  label: string;
  component: React.ReactNode;
  default?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

interface TabViewProps {
  tabsList: TabItem[];
  className?: string;
}

const TabView: FC<TabViewProps> = ({ tabsList, className = "" }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("t");

  const activeTab = useMemo(() => {
    if (!tab) return tabsList.find((tab) => tab.default) || tabsList[0];
    return (
      tabsList.find((_tab) => _tab.id === tab) ||
      tabsList.find((tab) => tab.default) ||
      tabsList[0]
    );
  }, [tab, tabsList]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Horizontal Tabs Navigation */}
      {tabsList.length > 1 && (
        <div className="w-full overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 flex gap-2">
          {tabsList.map((tabItem) => {
            const Icon = tabItem.icon;
            const isActive = activeTab?.id === tabItem.id;

            return (
              <Link
                key={tabItem.id}
                href={`${pathname}?t=${tabItem.id}`}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap
                  ${
                    isActive
                      ? "bg-brand-600 text-white font-semibold hover:bg-brand-700"
                      : "text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }
                `}
              >
                {Icon && <Icon className="w-5 h-5" />}
                {tabItem.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Active Tab Content */}
      <React.Fragment key={activeTab?.id}>
        {activeTab?.component}
      </React.Fragment>
    </div>
  );
};

export default TabView;
