/**
 * MCP Store - Zustand State Management
 *
 * Manages MCP connection state, tools, and request logging
 */

import { create } from 'zustand';
import { mcpClient, McpTool } from '@/lib/mcpClient';

// Request log entry interface
export interface McpRequestLogEntry {
  id: string;
  timestamp: Date;
  method: string;
  params: any;
  response?: any;
  error?: string;
  duration: number; // milliseconds
  status: 'pending' | 'success' | 'error';
}

// MCP Store State
interface McpState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Tools
  tools: McpTool[];
  isLoadingTools: boolean;
  toolsError: string | null;

  // Request logging
  requestLog: McpRequestLogEntry[];
  maxLogEntries: number;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  listTools: () => Promise<void>;
  logRequest: (entry: Omit<McpRequestLogEntry, 'id' | 'timestamp'>) => void;
  clearLog: () => void;
  testConnection: () => Promise<boolean>;
}

/**
 * MCP Store
 */
export const useMcpStore = create<McpState>((set, get) => ({
  // Initial state
  isConnected: false,
  isConnecting: false,
  connectionError: null,

  tools: [],
  isLoadingTools: false,
  toolsError: null,

  requestLog: [],
  maxLogEntries: 100, // Keep last 100 requests

  /**
   * Connect to MCP server
   */
  connect: async () => {
    set({ isConnecting: true, connectionError: null });

    try {
      // Test connection
      const isHealthy = await mcpClient.testConnection();

      if (!isHealthy) {
        throw new Error('MCP Server health check failed');
      }

      // Load available tools
      const tools = await mcpClient.listTools();

      set({
        isConnected: true,
        isConnecting: false,
        tools,
        connectionError: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';

      set({
        isConnected: false,
        isConnecting: false,
        connectionError: errorMessage,
      });

      throw error;
    }
  },

  /**
   * Disconnect from MCP server
   */
  disconnect: () => {
    set({
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      tools: [],
    });
  },

  /**
   * List available MCP tools
   */
  listTools: async () => {
    set({ isLoadingTools: true, toolsError: null });

    try {
      const tools = await mcpClient.listTools();

      set({
        tools,
        isLoadingTools: false,
        toolsError: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load tools';

      set({
        isLoadingTools: false,
        toolsError: errorMessage,
      });

      throw error;
    }
  },

  /**
   * Log a request/response
   */
  logRequest: (entry: Omit<McpRequestLogEntry, 'id' | 'timestamp'>) => {
    const { requestLog, maxLogEntries } = get();

    const newEntry: McpRequestLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...entry,
    };

    // Keep only last N entries
    const updatedLog = [newEntry, ...requestLog].slice(0, maxLogEntries);

    set({ requestLog: updatedLog });
  },

  /**
   * Clear request log
   */
  clearLog: () => {
    set({ requestLog: [] });
  },

  /**
   * Test connection to MCP server
   */
  testConnection: async () => {
    try {
      const isHealthy = await mcpClient.testConnection();
      set({ isConnected: isHealthy });
      return isHealthy;
    } catch {
      set({ isConnected: false });
      return false;
    }
  },
}));
