"use client";

import { useState } from "react";
import { HiServer, HiCode, HiViewGrid } from "react-icons/hi";

export type ViewMode = "api" | "mcp" | "unified";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className = "" }: ViewToggleProps) {
  const buttons: Array<{ mode: ViewMode; label: string; icon: React.ComponentType<any>; description: string }> = [
    {
      mode: "api",
      label: "API Only",
      icon: HiServer,
      description: "REST API requests",
    },
    {
      mode: "mcp",
      label: "MCP Only",
      icon: HiCode,
      description: "MCP tool calls",
    },
    {
      mode: "unified",
      label: "Unified",
      icon: HiViewGrid,
      description: "Both API & MCP",
    },
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          View Mode
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {buttons.find((b) => b.mode === value)?.description}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {buttons.map(({ mode, label, icon: Icon }) => {
          const isActive = value === mode;
          return (
            <button
              key={mode}
              onClick={() => onChange(mode)}
              className={`
                flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                ${
                  isActive
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300"
                }
              `}
            >
              <Icon className={`w-6 h-6 ${isActive ? "text-blue-500" : "text-gray-500 dark:text-gray-400"}`} />
              <span className="text-sm font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Mode Indicator */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <div className={`w-2 h-2 rounded-full ${value === "api" ? "bg-green-500" : value === "mcp" ? "bg-blue-500" : "bg-purple-500"} animate-pulse`}></div>
          <span>
            {value === "api" && "Showing REST API activity only"}
            {value === "mcp" && "Showing MCP tool calls only"}
            {value === "unified" && "Showing combined API & MCP activity"}
          </span>
        </div>
      </div>
    </div>
  );
}
