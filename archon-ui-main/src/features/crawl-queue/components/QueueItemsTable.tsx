/**
 * Queue Items Table Component
 * Table displaying crawl queue items with actions
 */

import { format } from 'date-fns';
import { MoreVertical, RefreshCw, StopCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/features/ui/primitives/button';
import { Card } from '@/features/ui/primitives/card';
import { cn } from '@/features/ui/primitives/styles';
import { SimpleTooltip } from '@/features/ui/primitives/tooltip';
import { useDeleteQueueItem, useRetryQueueItem, useStopQueueItem } from '../hooks/useQueueQueries';
import type { QueueItem } from '../types';
import { QueueItemProgress } from './QueueItemProgress';
import { QueueItemStatusBadge } from './QueueItemStatusBadge';

interface QueueItemsTableProps {
  items: QueueItem[];
  isLoading?: boolean;
}

export const QueueItemsTable: React.FC<QueueItemsTableProps> = ({ items, isLoading }) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const retryMutation = useRetryQueueItem();
  const stopMutation = useStopQueueItem();
  const deleteMutation = useDeleteQueueItem();

  const toggleRowExpansion = (itemId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleRetry = (itemId: string) => {
    retryMutation.mutate(itemId);
  };

  const handleStop = (itemId: string) => {
    stopMutation.mutate(itemId);
  };

  const handleDelete = (itemId: string) => {
    if (confirm('Are you sure you want to delete this queue item?')) {
      deleteMutation.mutate(itemId);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
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
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Statistics
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {items.map((item) => {
              const isExpanded = expandedRows.has(item.item_id);
              return (
                <tr
                  key={item.item_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                        {item.source_title || item.source_id}
                      </div>
                      {item.source_url && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {item.source_url}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <QueueItemStatusBadge status={item.status} />
                    {item.error_message && (
                      <SimpleTooltip content={item.error_message}>
                        <div className="mt-1 text-xs text-red-600 dark:text-red-400 truncate max-w-xs cursor-help">
                          {item.error_message}
                        </div>
                      </SimpleTooltip>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <QueueItemProgress progress={item.progress} status={item.status} className="min-w-[120px]" />
                  </td>

                  <td className="px-4 py-4">
                    <div className="space-y-1 text-xs">
                      <div className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{item.statistics.pages_crawled}</span> pages
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{item.statistics.code_examples_count}</span> code
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {format(new Date(item.created_at), 'MMM d, yyyy')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      {format(new Date(item.created_at), 'h:mm a')}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {(item.status === 'failed' || item.status === 'cancelled') && (
                        <SimpleTooltip content="Retry">
                          <Button
                            onClick={() => handleRetry(item.item_id)}
                            disabled={retryMutation.isPending}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </SimpleTooltip>
                      )}

                      {(item.status === 'pending' || item.status === 'running') && (
                        <SimpleTooltip content="Stop">
                          <Button
                            onClick={() => handleStop(item.item_id)}
                            disabled={stopMutation.isPending}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <StopCircle className="w-4 h-4" />
                          </Button>
                        </SimpleTooltip>
                      )}

                      <SimpleTooltip content="Delete">
                        <Button
                          onClick={() => handleDelete(item.item_id)}
                          disabled={deleteMutation.isPending}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-600 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </SimpleTooltip>

                      <Button
                        onClick={() => toggleRowExpansion(item.item_id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500">Retry Count:</span>
                            <span className="ml-2 font-medium">{item.retry_count}/{item.max_retries}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Priority:</span>
                            <span className="ml-2 font-medium">{item.priority}</span>
                          </div>
                          {item.started_at && (
                            <div>
                              <span className="text-gray-500">Started:</span>
                              <span className="ml-2">{format(new Date(item.started_at), 'MMM d, h:mm a')}</span>
                            </div>
                          )}
                          {item.completed_at && (
                            <div>
                              <span className="text-gray-500">Completed:</span>
                              <span className="ml-2">{format(new Date(item.completed_at), 'MMM d, h:mm a')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
