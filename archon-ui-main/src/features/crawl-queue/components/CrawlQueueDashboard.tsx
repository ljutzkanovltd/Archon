/**
 * Crawl Queue Dashboard Component
 * Comprehensive queue management dashboard with real-time statistics and item list
 */

import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/features/ui/primitives/styles';
import { useQueueItems, useQueueStats } from '../hooks/useQueueQueries';
import type { QueueItemStatus } from '../types';
import { QueueItemsTable } from './QueueItemsTable';
import { QueueStatCard } from './QueueStatCard';

export const CrawlQueueDashboard: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<QueueItemStatus | 'all'>('all');

  // Fetch queue statistics with 5-second polling
  const { data: statsData, isLoading: statsLoading, error: statsError } = useQueueStats();

  // Fetch queue items with 5-second polling, applying status filter
  const { data: itemsData, isLoading: itemsLoading, error: itemsError } = useQueueItems(
    statusFilter !== 'all' ? { status: statusFilter, limit: 50 } : { limit: 50 }
  );

  const stats = statsData?.stats;
  const items = itemsData?.items || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Crawl Queue Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor and manage crawl queue operations in real-time
          </p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span>Live Updates</span>
        </div>
      </div>

      {/* Statistics Grid */}
      {statsError ? (
        <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-3 text-red-800 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <div>
              <div className="font-medium">Failed to load queue statistics</div>
              <div className="text-sm mt-1">
                {statsError instanceof Error ? statsError.message : 'Unknown error'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            onClick={() => setStatusFilter('pending')}
            className={cn(
              'cursor-pointer transition-all',
              statusFilter === 'pending' && 'ring-2 ring-yellow-500'
            )}
          >
            <QueueStatCard
              label="Pending"
              count={stats?.pending || 0}
              icon={<Clock className="w-6 h-6" />}
              color="yellow"
            />
          </div>

          <div
            onClick={() => setStatusFilter('running')}
            className={cn(
              'cursor-pointer transition-all',
              statusFilter === 'running' && 'ring-2 ring-blue-500'
            )}
          >
            <QueueStatCard
              label="Running"
              count={stats?.running || 0}
              icon={<Loader2 className="w-6 h-6" />}
              color="blue"
              showSpinner={stats?.running > 0}
            />
          </div>

          <div
            onClick={() => setStatusFilter('completed')}
            className={cn(
              'cursor-pointer transition-all',
              statusFilter === 'completed' && 'ring-2 ring-green-500'
            )}
          >
            <QueueStatCard
              label="Completed"
              count={stats?.completed || 0}
              icon={<CheckCircle className="w-6 h-6" />}
              color="green"
            />
          </div>

          <div
            onClick={() => setStatusFilter('failed')}
            className={cn(
              'cursor-pointer transition-all',
              statusFilter === 'failed' && 'ring-2 ring-red-500'
            )}
          >
            <QueueStatCard
              label="Failed"
              count={stats?.failed || 0}
              icon={<AlertCircle className="w-6 h-6" />}
              color="red"
            />
          </div>
        </div>
      )}

      {/* Filter indicator and reset */}
      {statusFilter !== 'all' && (
        <div className="flex items-center justify-between p-4 bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800 rounded-lg">
          <div className="text-sm text-cyan-800 dark:text-cyan-400">
            Showing <span className="font-medium">{statusFilter}</span> items only
          </div>
          <button
            onClick={() => setStatusFilter('all')}
            className="text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium underline"
          >
            Show All
          </button>
        </div>
      )}

      {/* Queue Items List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Queue Items
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {items.length} item{items.length !== 1 ? 's' : ''}
            {!statsLoading && stats && ` of ${stats.total} total`}
          </div>
        </div>

        {itemsError ? (
          <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-3 text-red-800 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <div>
                <div className="font-medium">Failed to load queue items</div>
                <div className="text-sm mt-1">
                  {itemsError instanceof Error ? itemsError.message : 'Unknown error'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <QueueItemsTable items={items} isLoading={itemsLoading} />
        )}
      </div>
    </div>
  );
};
