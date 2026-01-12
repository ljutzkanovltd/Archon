/**
 * WebSocket Hook for Database Sync Real-Time Updates
 * Manages WebSocket connection with automatic reconnection and fallback
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: 'connected' | 'progress_update' | 'log' | 'pong';
  sync_id?: string;
  message?: string;
  phase?: string;
  progress?: number;
  current_table?: string;
  status?: string;
  timestamp: string;
}

interface UseSyncWebSocketOptions {
  syncId: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

interface UseSyncWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  error: string | null;
  reconnectAttempts: number;
  sendMessage: (message: string) => void;
  disconnect: () => void;
}

export const useSyncWebSocket = (options: UseSyncWebSocketOptions): UseSyncWebSocketReturn => {
  const {
    syncId,
    onMessage,
    onConnected,
    onDisconnected,
    onError,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !syncId || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Construct WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/sync/${syncId}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebSocket] Connected to sync progress stream');
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);
        onConnected?.();

        // Start heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);

          // Log received message
          if (message.type !== 'pong') {
            console.log('[WebSocket] Message received:', message.type);
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        setError('WebSocket connection error');
        onError?.(event);
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        onDisconnected?.();

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnection with exponential backoff
        if (enabled && reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/5)...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, delay);
        } else if (reconnectAttempts >= 5) {
          setError('Max reconnection attempts reached. Falling back to polling.');
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err);
      setError('Failed to establish WebSocket connection');
    }
  }, [enabled, syncId, reconnectAttempts, onMessage, onConnected, onDisconnected, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  }, []);

  // Connect on mount if enabled
  useEffect(() => {
    if (enabled && syncId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, syncId, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    error,
    reconnectAttempts,
    sendMessage,
    disconnect,
  };
};
