/**
 * WebSocket hook for real-time MCP session monitoring
 *
 * Provides real-time session updates via WebSocket with automatic reconnection
 * and polling fallback. Replaces the previous 10-second polling approach with
 * sub-second latency updates.
 *
 * Features:
 * - Automatic WebSocket connection management
 * - Health updates every 5 seconds from server
 * - Real-time event broadcasting (session created/updated/disconnected)
 * - Automatic reconnection with exponential backoff
 * - Graceful fallback to polling if WebSocket unavailable
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMcpSessionHealth } from './useMcpQueries';

interface WebSocketMessage {
  type: 'health_update' | 'session_created' | 'session_updated' | 'session_disconnected';
  data?: any;
  session_id?: string;
}

interface SessionHealthData {
  status_breakdown: {
    active: number;
    disconnected: number;
    total: number;
  };
  age_distribution: {
    healthy: number;
    aging: number;
    stale: number;
  };
  connection_health: {
    avg_duration_seconds: number | null;
    sessions_per_hour: number | null;
    disconnect_rate_percent: number | null;
    total_sessions_24h: number;
  };
  recent_activity: Array<{
    session_id: string;
    client_type: string;
    status: string;
    age_minutes: number;
    uptime_minutes: number;
  }>;
  timestamp: string;
}

interface UseMcpWebSocketOptions {
  /**
   * Enable WebSocket connection
   * Default: true
   */
  enabled?: boolean;

  /**
   * WebSocket URL
   * Default: ws://localhost:8181/api/mcp/ws/sessions
   */
  url?: string;

  /**
   * Automatic reconnection
   * Default: true
   */
  autoReconnect?: boolean;

  /**
   * Max reconnection attempts before falling back to polling
   * Default: 5
   */
  maxReconnectAttempts?: number;

  /**
   * Initial reconnect delay in ms
   * Default: 1000 (1 second)
   */
  reconnectDelay?: number;

  /**
   * Fallback to polling if WebSocket fails
   * Default: true
   */
  useFallback?: boolean;

  /**
   * Callback for connection state changes
   */
  onConnectionChange?: (connected: boolean) => void;

  /**
   * Callback for session events
   */
  onSessionEvent?: (event: WebSocketMessage) => void;
}

export function useMcpWebSocket(options: UseMcpWebSocketOptions = {}) {
  const {
    enabled = true,
    url = 'ws://localhost:8181/api/mcp/ws/sessions',
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    useFallback = true,
    onConnectionChange,
    onSessionEvent,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [data, setData] = useState<SessionHealthData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Fallback: Use polling hook if WebSocket unavailable
  const { data: pollingData, isLoading: pollingLoading } = useMcpSessionHealth();

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        if (!mountedRef.current) return;
        if (process.env.NODE_ENV === 'development') {
          console.log('[WebSocket] Connected to', url);
        }
        setIsConnected(true);
        setError(null);
        setUsingFallback(false);
        reconnectAttempts.current = 0;
        onConnectionChange?.(true);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Handle health updates
          if (message.type === 'health_update' && message.data) {
            setData(message.data);
          }

          // Notify listeners of all events
          onSessionEvent?.(message);
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        setError(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        if (process.env.NODE_ENV === 'development') {
          console.log('[WebSocket] Disconnected');
        }
        setIsConnected(false);
        onConnectionChange?.(false);

        // Attempt reconnection if enabled
        if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current);
          if (process.env.NODE_ENV === 'development') {
            console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connect();
          }, delay);
        } else if (useFallback) {
          // Max reconnect attempts reached, fall back to polling
          if (process.env.NODE_ENV === 'development') {
            console.log('[WebSocket] Max reconnect attempts reached, falling back to polling');
          }
          setUsingFallback(true);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[WebSocket] Failed to create connection:', err);
      setError(err as Error);
      if (useFallback) {
        setUsingFallback(true);
      }
    }
  }, [enabled, url, autoReconnect, maxReconnectAttempts, reconnectDelay, useFallback, onConnectionChange, onSessionEvent]);

  // Effect: Connect/disconnect WebSocket
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && !usingFallback) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, usingFallback, connect, cleanup]);

  // Effect: Update data from polling fallback
  useEffect(() => {
    if (usingFallback && pollingData) {
      setData(pollingData);
    }
  }, [usingFallback, pollingData]);

  return {
    /** Current session health data (WebSocket or polling) */
    data: data || pollingData,

    /** WebSocket connection status */
    isConnected,

    /** Whether using polling fallback */
    usingFallback,

    /** Loading state (only for fallback polling) */
    isLoading: usingFallback ? pollingLoading : false,

    /** Connection error */
    error,

    /** Manually reconnect WebSocket */
    reconnect: () => {
      reconnectAttempts.current = 0;
      setUsingFallback(false);
      cleanup();
      connect();
    },

    /** Disconnect WebSocket and use polling */
    disconnect: () => {
      cleanup();
      setUsingFallback(true);
    },
  };
}
