"use client";

import React from "react";
import { HiCheckCircle, HiXCircle, HiClock, HiServer, HiUsers } from "react-icons/hi";
import type { McpServerConfig, McpServerStatus, McpSessionInfo } from "@/lib/types";

interface McpStatusBarProps {
  status: McpServerStatus;
  sessionInfo?: McpSessionInfo;
  config?: McpServerConfig;
  className?: string;
}

export function McpStatusBar({ status, sessionInfo, config, className = "" }: McpStatusBarProps) {
  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h ${minutes}m`;
    }
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const getStatusIcon = () => {
    if (status.status === "running") {
      return <HiCheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <HiXCircle className="w-5 h-5 text-red-500" />;
  };

  const getStatusColor = () => {
    if (status.status === "running") {
      return "text-green-600 dark:text-green-400";
    }
    return "text-red-600 dark:text-red-400";
  };

  const getStatusBadge = () => {
    if (status.status === "running") {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800";
    }
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800";
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-4 px-6 py-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-sm ${className}`}
    >
      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className={`font-semibold uppercase px-2 py-1 rounded-md ${getStatusBadge()}`}>
          {status.status}
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

      {/* Uptime */}
      {status.uptime !== null && (
        <>
          <div className="flex items-center gap-2">
            <HiClock className="w-4 h-4 text-blue-500" />
            <span className="text-gray-500 dark:text-gray-400">UP</span>
            <span className="text-gray-900 dark:text-white font-semibold">
              {formatUptime(status.uptime)}
            </span>
          </div>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
        </>
      )}

      {/* Server Info */}
      <div className="flex items-center gap-2">
        <HiServer className="w-4 h-4 text-cyan-500" />
        <span className="text-gray-500 dark:text-gray-400">PORT</span>
        <span className="text-gray-900 dark:text-white font-semibold">
          {config?.port || 8051}
        </span>
      </div>

      {/* Active Sessions */}
      {sessionInfo && (
        <>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <div className="flex items-center gap-2">
            <HiUsers className="w-4 h-4 text-pink-500" />
            <span className="text-gray-500 dark:text-gray-400">SESSIONS</span>
            <span className="text-gray-900 dark:text-white font-semibold">
              {sessionInfo.active_sessions}
            </span>
          </div>
        </>
      )}

      {/* Transport Type */}
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 ml-auto hidden md:block" />
      <div className="flex items-center gap-2">
        <span className="text-gray-500 dark:text-gray-400">TRANSPORT</span>
        <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
          {config?.transport === "streamable-http"
            ? "HTTP"
            : config?.transport === "sse"
              ? "SSE"
              : config?.transport || "HTTP"}
        </span>
      </div>
    </div>
  );
}
