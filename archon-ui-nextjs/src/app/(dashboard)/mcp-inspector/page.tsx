"use client";

import { useEffect, useState } from "react";
import { useMcpStore } from "@/store/useMcpStore";
import { mcpClient } from "@/lib/mcpClient";
import {
  HiCheckCircle,
  HiXCircle,
  HiRefresh,
  HiTrash,
  HiClipboardCopy,
  HiPlay,
} from "react-icons/hi";
import { usePermissions } from "@/hooks/usePermissions";
import { Forbidden } from "@/components/Forbidden";

export default function McpInspectorPage() {
  // Permission check - admin only
  const { canViewMCPInspector } = usePermissions();

  // All hooks must be called before conditional returns
  const {
    isConnected,
    isConnecting,
    connectionError,
    tools,
    requestLog,
    connect,
    disconnect,
    clearLog,
    testConnection,
    logRequest,
  } = useMcpStore();

  const [selectedTool, setSelectedTool] = useState<string>("");
  const [params, setParams] = useState<string>("{}");
  const [response, setResponse] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Auto-connect on mount
  useEffect(() => {
    if (!isConnected && !isConnecting) {
      connect().catch(console.error);
    }
  }, [isConnected, isConnecting, connect]);

  // Permission check - return after all hooks are called
  if (!canViewMCPInspector) {
    return <Forbidden />;
  }

  // Handle connection toggle
  const handleConnectionToggle = async () => {
    if (isConnected) {
      disconnect();
    } else {
      try {
        await connect();
      } catch (error) {
        console.error("Connection failed:", error);
      }
    }
  };

  // Handle test connection
  const handleTestConnection = async () => {
    await testConnection();
  };

  // Handle tool execution
  const handleExecute = async () => {
    if (!selectedTool) {
      setExecutionError("Please select a tool");
      return;
    }

    setIsExecuting(true);
    setExecutionError(null);
    setResponse(null);

    const startTime = Date.now();

    try {
      // Parse params
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(params);
      } catch (e) {
        throw new Error("Invalid JSON in params");
      }

      // Execute tool
      const result = await mcpClient.callTool(selectedTool, parsedParams);

      const duration = Date.now() - startTime;

      // Log request
      logRequest({
        method: selectedTool,
        params: parsedParams,
        response: result,
        duration,
        status: "success",
      });

      setResponse(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Log error
      logRequest({
        method: selectedTool,
        params: params,
        error: errorMessage,
        duration,
        status: "error",
      });

      setExecutionError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle copy response
  const handleCopyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    }
  };

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleTimeString();
  };

  return (
    <div className="p-4">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          MCP Inspector
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Test and debug MCP server tools using JSON-RPC 2.0
        </p>
      </div>

      {/* Connection Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <HiCheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <HiXCircle className="w-6 h-6 text-red-600" />
            )}
            <div>
              <h2 className="text-lg font-semibold dark:text-gray-100">
                {isConnected ? "Connected" : "Disconnected"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                MCP Server: http://localhost:8051
              </p>
              {connectionError && (
                <p className="text-sm text-red-600 mt-1">{connectionError}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleTestConnection}
              disabled={isConnecting}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <HiRefresh className="w-4 h-4" />
              Test
            </button>
            <button
              onClick={handleConnectionToggle}
              disabled={isConnecting}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 ${
                isConnected
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-brand-700 hover:bg-brand-800 hover:text-white text-white"
              }`}
            >
              {isConnected ? "Disconnect" : "Connect"}
            </button>
          </div>
        </div>

        {/* Tools Count */}
        {isConnected && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Available tools: <span className="font-semibold">{tools.length}</span>
            </p>
          </div>
        )}
      </div>

      {/* Tool Executor */}
      {isConnected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left: Tool Selection and Params */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">
              Execute Tool
            </h2>

            {/* Tool Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Tool
              </label>
              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Select a tool --</option>
                {tools.map((tool) => (
                  <option key={tool.name} value={tool.name}>
                    {tool.name}
                  </option>
                ))}
              </select>
              {selectedTool && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {tools.find((t) => t.name === selectedTool)?.description}
                </p>
              )}
            </div>

            {/* Params Editor */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Parameters (JSON)
              </label>
              <textarea
                value={params}
                onChange={(e) => setParams(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-brand-500"
                placeholder='{"query": "authentication", "match_count": 5}'
              />
            </div>

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={!selectedTool || isExecuting}
              className="w-full px-4 py-2 bg-brand-700 hover:bg-brand-800 hover:text-white text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Executing...
                </>
              ) : (
                <>
                  <HiPlay className="w-4 h-4" />
                  Execute
                </>
              )}
            </button>

            {executionError && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {executionError}
                </p>
              </div>
            )}
          </div>

          {/* Right: Response Viewer */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold dark:text-gray-100">Response</h2>
              {response && (
                <button
                  onClick={handleCopyResponse}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg flex items-center gap-2 text-sm transition-colors"
                >
                  <HiClipboardCopy className="w-4 h-4" />
                  Copy
                </button>
              )}
            </div>

            {response ? (
              <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-auto max-h-96 text-sm">
                <code className="text-gray-900 dark:text-gray-100">
                  {JSON.stringify(response, null, 2)}
                </code>
              </pre>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No response yet. Execute a tool to see results.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Log */}
      {isConnected && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold dark:text-gray-100">
              Request Log ({requestLog.length})
            </h2>
            <button
              onClick={clearLog}
              disabled={requestLog.length === 0}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
            >
              <HiTrash className="w-4 h-4" />
              Clear Log
            </button>
          </div>

          {requestLog.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-auto">
              {requestLog.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-3 rounded-lg border ${
                    entry.status === "success"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.status === "success" ? (
                          <HiCheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <HiXCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-mono text-sm font-semibold dark:text-gray-100">
                          {entry.method}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({entry.duration}ms)
                        </span>
                      </div>
                      {entry.error && (
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          {entry.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No requests logged yet. Execute a tool to see logs.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
