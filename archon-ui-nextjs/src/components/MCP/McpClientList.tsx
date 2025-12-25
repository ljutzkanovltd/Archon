"use client";

import React from "react";
import { HiClock, HiLightningBolt, HiDesktopComputer } from "react-icons/hi";
import type { McpClient } from "@/lib/types";

interface McpClientListProps {
  clients: McpClient[];
  className?: string;
}

const clientIcons: Record<string, string> = {
  Claude: "🤖",
  Cursor: "💻",
  Windsurf: "🏄",
  Cline: "🔧",
  KiRo: "🚀",
  Augment: "⚡",
  Gemini: "🌐",
  Unknown: "❓",
};

export function McpClientList({ clients, className = "" }: McpClientListProps) {
  const formatDuration = (connectedAt: string): string => {
    const now = new Date();
    const connected = new Date(connectedAt);
    const seconds = Math.floor((now.getTime() - connected.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatLastActivity = (lastActivity: string): string => {
    const now = new Date();
    const activity = new Date(lastActivity);
    const seconds = Math.floor((now.getTime() - activity.getTime()) / 1000);

    if (seconds < 5) return "Active";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return "Idle";
  };

  if (clients.length === 0) {
    return (
      <div
        className={`p-8 text-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <HiDesktopComputer className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">No clients connected</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Connect Claude Code, Cursor, or Windsurf to see clients here
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
          Clients will appear automatically when they connect to the MCP server
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {clients.map((client, index) => (
        <div
          key={client.session_id}
          className={`flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 border ${
            client.status === "active"
              ? "border-green-500 shadow-lg shadow-green-500/20"
              : "border-gray-200 dark:border-gray-700"
          } transition-all duration-200`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{clientIcons[client.client_type] || "❓"}</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{client.client_type}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                Session: {client.session_id.slice(0, 8)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <HiClock className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600 dark:text-gray-400">
                {formatDuration(client.connected_at)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <HiLightningBolt className="w-4 h-4 text-green-500" />
              <span
                className={`${
                  client.status === "active"
                    ? "text-green-600 dark:text-green-400 font-semibold"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {formatLastActivity(client.last_activity)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
