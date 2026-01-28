/**
 * Crawl Queue Service
 * API service layer for crawl queue management
 */

import type { QueueItemsResponse, QueueStatusResponse } from '../types';

class QueueService {
  private baseUrl = '/api/crawl-queue';

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStatusResponse> {
    const response = await fetch(`${this.baseUrl}/status`);
    if (!response.ok) {
      throw new Error(`Failed to fetch queue stats: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * List queue items with optional filtering
   */
  async listItems(options?: {
    status?: string;
    requires_review?: boolean;
    limit?: number;
  }): Promise<QueueItemsResponse> {
    const params = new URLSearchParams();

    if (options?.status) {
      params.append('status', options.status);
    }
    if (options?.requires_review !== undefined) {
      params.append('requires_review', String(options.requires_review));
    }
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }

    const url = params.toString()
      ? `${this.baseUrl}/items?${params}`
      : `${this.baseUrl}/items`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch queue items: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Retry a failed queue item
   */
  async retryItem(itemId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/retry/${itemId}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to retry item: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Stop/cancel a queue item
   */
  async stopItem(itemId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/${itemId}/stop`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to stop item: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Delete a queue item
   */
  async deleteItem(itemId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/${itemId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete item: ${response.statusText}`);
    }
    return response.json();
  }
}

export const queueService = new QueueService();
