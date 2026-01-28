/**
 * Crawl Queue Types
 * Type definitions for crawl queue management
 */

export interface QueueItemStatistics {
  pages_crawled: number;
  chunks_created: number;
  code_examples_count: number;
  embeddings_generated: number;
}

export type QueueItemStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface QueueItem {
  item_id: string;
  batch_id: string | null;
  source_id: string;
  status: QueueItemStatus;
  priority: number;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  error_type: string | null;
  error_details: any;
  requires_human_review: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_retry_at: string | null;
  next_retry_at: string | null;
  // Enhanced fields from B1.2
  source_url: string | null;
  source_title: string | null;
  scope: 'global' | 'project' | 'user' | null;
  last_crawled_at: string | null;
  progress: number;  // 0-100
  statistics: QueueItemStatistics;
}

export interface QueueStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  requires_review: number;
}

export interface QueueStatusResponse {
  success: boolean;
  stats: QueueStats;
  actively_crawling: Array<{
    source_id: string;
    url: string;
    progress: number;
  }>;
}

export interface QueueItemsResponse {
  success: boolean;
  items: QueueItem[];
  count: number;
}
