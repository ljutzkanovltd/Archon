"use client";

import { HiCheckCircle, HiXCircle, HiClock, HiCode, HiChevronDown, HiChevronUp } from "react-icons/hi";
import { useState } from "react";

export interface ToolExecution {
  request_id: string;
  session_id: string;
  tool_name: string;
  timestamp: string;
  duration_ms: number | null;
  status: "success" | "error" | "timeout";
  request_params?: any;
  response_data?: any;
  error_message?: string;
  token_count?: number;
}

interface ToolExecutionDetailsProps {
  execution: ToolExecution;
  onClose?: () => void;
  className?: string;
}

export function ToolExecutionDetails({
  execution,
  onClose,
  className = "",
}: ToolExecutionDetailsProps) {
  const [showRequestParams, setShowRequestParams] = useState(true);
  const [showResponseData, setShowResponseData] = useState(true);

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const isSlow = execution.duration_ms !== null && execution.duration_ms > 2000;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {execution.tool_name}
              </h2>
              {execution.status === "success" ? (
                <HiCheckCircle className="w-6 h-6 text-green-500" />
              ) : execution.status === "error" ? (
                <HiXCircle className="w-6 h-6 text-red-500" />
              ) : (
                <HiClock className="w-6 h-6 text-yellow-500" />
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Request ID: <span className="font-mono text-gray-900 dark:text-white">{execution.request_id}</span>
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Duration</p>
            <p className={`text-lg font-bold ${isSlow ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
              {formatDuration(execution.duration_ms)}
            </p>
            {isSlow && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">⚠️ Slow execution</p>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Status</p>
            <p className={`text-lg font-bold ${
              execution.status === "success"
                ? "text-green-600 dark:text-green-400"
                : execution.status === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-yellow-600 dark:text-yellow-400"
            }`}>
              {execution.status}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Timestamp</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {formatTimestamp(execution.timestamp)}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Tokens</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {execution.token_count || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Request Parameters */}
      {execution.request_params && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowRequestParams(!showRequestParams)}
            className="flex items-center justify-between w-full mb-3"
          >
            <div className="flex items-center gap-2">
              <HiCode className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Request Parameters
              </h3>
            </div>
            {showRequestParams ? (
              <HiChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <HiChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showRequestParams && (
            <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-x-auto text-sm font-mono text-gray-900 dark:text-white">
              {JSON.stringify(execution.request_params, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Response Data */}
      {execution.response_data && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowResponseData(!showResponseData)}
            className="flex items-center justify-between w-full mb-3"
          >
            <div className="flex items-center gap-2">
              <HiCode className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Response Data
              </h3>
            </div>
            {showResponseData ? (
              <HiChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <HiChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showResponseData && (
            <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-x-auto text-sm font-mono text-gray-900 dark:text-white">
              {JSON.stringify(execution.response_data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Error Message */}
      {execution.error_message && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <HiXCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-1">
                Error Message
              </h3>
              <p className="text-sm text-red-700 dark:text-red-400 font-mono">
                {execution.error_message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Session Info */}
      <div className="p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Session Information
        </h3>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Session ID: <span className="font-mono text-gray-900 dark:text-white">{execution.session_id}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
