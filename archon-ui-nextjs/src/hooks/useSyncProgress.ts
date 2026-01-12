/**
 * Sync Progress Hook
 * Combines WebSocket real-time updates with polling fallback
 */

import { useEffect, useState, useCallback } from 'react';
import { useSyncWebSocket } from './useSyncWebSocket';
import { useSyncStore } from '@/store/useSyncStore';

interface SyncProgressData {
  sync_id: string;
  direction: string;
  status: string;
  current_phase: string | null;
  percent_complete: number;
  total_rows: number | null;
  synced_rows: number | null;
  current_table: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

interface UseSyncProgressOptions {
  syncId: string;
  enabled?: boolean;
  pollingInterval?: number; // milliseconds
}

export const useSyncProgress = (options: UseSyncProgressOptions) => {
  const { syncId, enabled = true, pollingInterval = 2000 } = options;
  const { updateProgress, addLog, completeSync, failSync } = useSyncStore();

  const [isLoading, setIsLoading] = useState(true);
  const [pollingEnabled, setPollingEnabled] = useState(false);

  // Fetch progress from REST API
  const fetchProgress = useCallback(async () => {
    if (!syncId || !enabled) return;

    try {
      const response = await fetch(`/api/database/sync/${syncId}/status`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: SyncProgressData = await response.json();

      // Update store
      updateProgress({
        sync_id: data.sync_id,
        direction: data.direction as any,
        status: data.status as any,
        current_phase: data.current_phase,
        percent_complete: data.percent_complete,
        total_rows: data.total_rows,
        synced_rows: data.synced_rows,
        current_table: data.current_table,
        error_message: data.error_message,
      });

      // Handle completion
      if (data.status === 'completed') {
        completeSync();
        setPollingEnabled(false);
      } else if (data.status === 'failed') {
        failSync(data.error_message || 'Sync failed');
        setPollingEnabled(false);
      } else if (data.status === 'cancelled') {
        setPollingEnabled(false);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('[Progress] Failed to fetch progress:', error);
      setIsLoading(false);
    }
  }, [syncId, enabled, updateProgress, completeSync, failSync]);

  // WebSocket connection
  const { isConnected, lastMessage, error: wsError, reconnectAttempts } = useSyncWebSocket({
    syncId,
    enabled,
    onMessage: (message) => {
      if (message.type === 'progress_update') {
        updateProgress({
          current_phase: message.phase || null,
          percent_complete: message.progress || 0,
          current_table: message.current_table || null,
          status: message.status as any,
        });

        // Handle completion via WebSocket
        if (message.status === 'completed') {
          completeSync();
          setPollingEnabled(false);
        } else if (message.status === 'failed') {
          failSync(message.message || 'Sync failed');
          setPollingEnabled(false);
        }
      } else if (message.type === 'log') {
        addLog(message.message || '');
      } else if (message.type === 'connected') {
        console.log('[Progress] WebSocket connected');
        // Fetch initial progress
        fetchProgress();
      }
    },
    onDisconnected: () => {
      console.log('[Progress] WebSocket disconnected, falling back to polling');
      setPollingEnabled(true);
    },
    onError: () => {
      console.log('[Progress] WebSocket error, falling back to polling');
      setPollingEnabled(true);
    },
  });

  // Enable polling if WebSocket fails
  useEffect(() => {
    if (wsError || reconnectAttempts >= 5) {
      setPollingEnabled(true);
    }
  }, [wsError, reconnectAttempts]);

  // Polling fallback
  useEffect(() => {
    if (!pollingEnabled || !enabled) return;

    console.log('[Progress] Polling enabled, fetching every', pollingInterval, 'ms');

    // Initial fetch
    fetchProgress();

    // Set up interval
    const interval = setInterval(fetchProgress, pollingInterval);

    return () => clearInterval(interval);
  }, [pollingEnabled, enabled, pollingInterval, fetchProgress]);

  // Initial fetch on mount
  useEffect(() => {
    if (enabled && syncId) {
      fetchProgress();
    }
  }, [enabled, syncId, fetchProgress]);

  return {
    isLoading,
    isWebSocketConnected: isConnected,
    isPolling: pollingEnabled,
    lastWebSocketMessage: lastMessage,
    wsError,
    reconnectAttempts,
    refresh: fetchProgress,
  };
};
