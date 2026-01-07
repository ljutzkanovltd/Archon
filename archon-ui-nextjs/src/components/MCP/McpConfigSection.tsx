"use client";

import { useState } from "react";
import { HiClipboardCopy, HiExternalLink } from "react-icons/hi";
import { McpServerConfig, McpServerStatus, SupportedIDE } from "@/lib/types";

interface McpConfigSectionProps {
  config?: McpServerConfig;
  status: McpServerStatus;
  className?: string;
}

const ideConfigurations: Record<
  SupportedIDE,
  {
    title: string;
    steps: string[];
    configGenerator: (config: McpServerConfig) => string;
    supportsOneClick?: boolean;
    platformSpecific?: boolean;
  }
> = {
  claudecode: {
    title: "Claude Code Configuration",
    steps: [
      "Open a terminal and run the following command:",
      "The connection will be established automatically"
    ],
    configGenerator: (config) =>
      `claude mcp add --transport http archon http://${config.host}:${config.port}/mcp`,
  },
  gemini: {
    title: "Gemini CLI Configuration",
    steps: [
      "Locate or create ~/.gemini/settings.json",
      "Add the configuration below",
      "Launch Gemini CLI",
      "Test with /mcp command"
    ],
    configGenerator: (config) =>
      JSON.stringify(
        {
          mcpServers: {
            archon: {
              httpUrl: `http://${config.host}:${config.port}/mcp`,
            },
          },
        },
        null,
        2
      ),
  },
  codex: {
    title: "Codex Configuration",
    steps: [
      "Install mcp-remote: npm install -g mcp-remote",
      "Add config to ~/.codex/config.toml",
      "Find mcp-remote path: npm root -g",
      "Update path in config below"
    ],
    configGenerator: (config) => {
      const isWindows = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes("win");
      if (isWindows) {
        return `[mcp_servers.archon]
command = 'node'
args = [
    'C:/Users/YOUR_USERNAME/AppData/Roaming/npm/node_modules/mcp-remote/dist/proxy.js',
    'http://${config.host}:${config.port}/mcp'
]`;
      }
      return `[mcp_servers.archon]
command = 'node'
args = [
    '/usr/local/lib/node_modules/mcp-remote/dist/proxy.js',
    'http://${config.host}:${config.port}/mcp'
]`;
    },
    platformSpecific: true,
  },
  cursor: {
    title: "Cursor Configuration",
    steps: [
      "Use one-click install (recommended), or",
      "Manually edit ~/.cursor/mcp.json",
      "Add the configuration below",
      "Restart Cursor"
    ],
    configGenerator: (config) =>
      JSON.stringify(
        {
          mcpServers: {
            archon: {
              url: `http://${config.host}:${config.port}/mcp`,
            },
          },
        },
        null,
        2
      ),
    supportsOneClick: true,
  },
  windsurf: {
    title: "Windsurf Configuration",
    steps: [
      'Click "MCP servers" button (hammer icon)',
      'Click "Configure" then "View raw config"',
      "Add configuration below",
      'Click "Refresh" to connect'
    ],
    configGenerator: (config) =>
      JSON.stringify(
        {
          mcpServers: {
            archon: {
              serverUrl: `http://${config.host}:${config.port}/mcp`,
            },
          },
        },
        null,
        2
      ),
  },
  cline: {
    title: "Cline Configuration",
    steps: [
      "Open VS Code settings (Cmd/Ctrl + ,)",
      'Search "cline.mcpServers"',
      'Click "Edit in settings.json"',
      "Add configuration and restart VS Code"
    ],
    configGenerator: (config) =>
      JSON.stringify(
        {
          mcpServers: {
            archon: {
              command: "npx",
              args: ["mcp-remote", `http://${config.host}:${config.port}/mcp`, "--allow-http"],
            },
          },
        },
        null,
        2
      ),
  },
  kiro: {
    title: "Kiro Configuration",
    steps: [
      "Open Kiro settings",
      "Navigate to MCP Servers section",
      "Add configuration below",
      "Save and restart Kiro"
    ],
    configGenerator: (config) =>
      JSON.stringify(
        {
          mcpServers: {
            archon: {
              command: "npx",
              args: ["mcp-remote", `http://${config.host}:${config.port}/mcp`, "--allow-http"],
            },
          },
        },
        null,
        2
      ),
  },
};

export function McpConfigSection({ config, status, className = "" }: McpConfigSectionProps) {
  const [selectedIDE, setSelectedIDE] = useState<SupportedIDE>("claudecode");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  if (status.status !== "running" || !config) {
    return (
      <div className={`p-6 text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">
          Start the MCP server to see configuration options
        </p>
      </div>
    );
  }

  const handleCopy = async (text: string, type: "config" | "command" = "config") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`${type === "command" ? "Command" : "Configuration"} copied!`);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      alert("Failed to copy to clipboard");
    }
  };

  const handleCursorOneClick = () => {
    const httpConfig = { url: `http://${config.host}:${config.port}/mcp` };
    const base64Config = btoa(JSON.stringify(httpConfig));
    window.location.href = `cursor://anysphere.cursor-deeplink/mcp/install?name=archon&config=${base64Config}`;
  };

  const selectedConfig = ideConfigurations[selectedIDE];
  const configText = selectedConfig.configGenerator(config);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Universal MCP Note */}
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <span className="font-semibold">Note:</span> Archon works with any MCP-compatible application.
          Instructions below cover common AI assistants.
        </p>
      </div>

      {/* Copy Feedback Toast */}
      {copyFeedback && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          {copyFeedback}
        </div>
      )}

      {/* IDE Selection Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ideConfigurations) as SupportedIDE[]).map((ide) => (
            <button
              key={ide}
              onClick={() => setSelectedIDE(ide)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                selectedIDE === ide
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {ide === "claudecode" ? "Claude Code" : ide.charAt(0).toUpperCase() + ide.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Configuration Content */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          {selectedConfig.title}
        </h4>

        {/* Steps */}
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {selectedConfig.steps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>

        {/* Special Command for Claude Code */}
        {selectedIDE === "claudecode" && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <code className="text-sm font-mono text-cyan-600 dark:text-cyan-400 break-all">
              {configText}
            </code>
            <button
              onClick={() => handleCopy(configText, "command")}
              className="ml-3 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <HiClipboardCopy className="w-3 h-3" />
              Copy
            </button>
          </div>
        )}

        {/* Platform Note for Codex */}
        {selectedIDE === "codex" && (
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              <span className="font-semibold">Platform:</span> Showing{" "}
              {typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes("win") ? "Windows" : "Linux/macOS"} format.
              Codex currently has MCP bugs - this setup is more complex than usual.
            </p>
          </div>
        )}

        {/* Configuration Display */}
        {selectedIDE !== "claudecode" && (
          <div className="relative rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Configuration
                {selectedIDE === "codex" && typeof navigator !== 'undefined' && (
                  <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                    ({navigator.platform.toLowerCase().includes("win") ? "Windows" : "Linux/macOS"})
                  </span>
                )}
              </span>
              <button
                onClick={() => handleCopy(configText)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <HiClipboardCopy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap break-words">
              <code>{configText}</code>
            </pre>
          </div>
        )}

        {/* One-Click Install for Cursor */}
        {selectedIDE === "cursor" && selectedConfig.supportsOneClick && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleCursorOneClick}
              className="flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 hover:text-white text-white rounded-lg font-medium shadow-lg transition-colors"
            >
              <HiExternalLink className="w-4 h-4" />
              One-Click Install for Cursor
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Opens Cursor with configuration
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
