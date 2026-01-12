import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';

export interface SyncHistoryRecord {
  id: string;
  sync_id: string;
  direction: 'local-to-remote' | 'remote-to-local';
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
  total_rows: number | null;
  synced_rows: number | null;
  duration_seconds: number | null;
  error_message: string | null;
  triggered_by: string;
  verification_results: Record<string, any> | null;
  backup_location: string | null;
}

export interface SyncHistoryFilters {
  direction?: 'local-to-remote' | 'remote-to-local';
  status?: 'running' | 'completed' | 'failed' | 'cancelled';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface UseSyncHistoryOptions {
  page?: number;
  perPage?: number;
  filters?: SyncHistoryFilters;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  enabled?: boolean;
}

export interface UseSyncHistoryReturn {
  records: SyncHistoryRecord[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  exportToCsv: () => Promise<void>;
}

export const useSyncHistory = (options: UseSyncHistoryOptions = {}): UseSyncHistoryReturn => {
  const {
    page = 1,
    perPage = 10,
    filters = {},
    sortBy = 'started_at',
    sortOrder = 'desc',
    enabled = true,
  } = options;

  const [records, setRecords] = useState<SyncHistoryRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      // Add filters
      if (filters.direction) {
        params.append('direction', filters.direction);
      }
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.dateFrom) {
        params.append('date_from', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('date_to', filters.dateTo);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }

      const response = await apiClient.get(`/api/database/sync/history?${params.toString()}`);

      if (response.data.success) {
        setRecords(response.data.records || []);
        setTotalRecords(response.data.total || 0);
        setTotalPages(response.data.pages || 0);
      } else {
        throw new Error(response.data.error || 'Failed to fetch sync history');
      }
    } catch (err) {
      console.error('Failed to fetch sync history:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sync history');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, currentPage, perPage, filters, sortBy, sortOrder]);

  const exportToCsv = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
      });

      // Add filters to export
      if (filters.direction) {
        params.append('direction', filters.direction);
      }
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.dateFrom) {
        params.append('date_from', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('date_to', filters.dateTo);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }

      const response = await apiClient.get(`/api/database/sync/history/export?${params.toString()}`, {
        responseType: 'blob',
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sync-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export sync history:', err);
      throw err;
    }
  }, [filters]);

  const refetch = useCallback(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    setCurrentPage(page);
  }, [page]);

  return {
    records,
    totalRecords,
    totalPages,
    currentPage,
    isLoading,
    error,
    refetch,
    exportToCsv,
  };
};
