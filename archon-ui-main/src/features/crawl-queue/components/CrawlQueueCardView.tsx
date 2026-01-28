/**
 * Crawl Queue Card View Component
 * Grid layout displaying queue items as cards
 */

import { AlertCircle } from 'lucide-react';
import { Card } from '@/features/ui/primitives/card';
import { useQueueItems } from '../hooks/useQueueQueries';
import type { QueueItemStatus } from '../types';
import { CrawlQueueItem } from './CrawlQueueItem';

interface CrawlQueueCardViewProps {
  statusFilter?: QueueItemStatus | 'all';
  limit?: number;
}

export const CrawlQueueCardView: React.FC<CrawlQueueCardViewProps> = ({
  statusFilter = 'all',
  limit = 50,
}) => {
  const { data: itemsData, isLoading, error } = useQueueItems(
    statusFilter !== 'all' ? { status: statusFilter, limit } : { limit }
  );

  const items = itemsData?.items || [];

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
        <div className="flex items-center gap-3 text-red-800 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <div>
            <div className="font-medium">Failed to load queue items</div>
            <div className="text-sm mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          No queue items found
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {items.map((item) => (
        <CrawlQueueItem key={item.item_id} item={item} />
      ))}
    </div>
  );
};
