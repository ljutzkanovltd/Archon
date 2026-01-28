/**
 * Crawl Queue Item Card Component
 * Comprehensive card displaying all queue item information
 */

import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Globe,
  Lock,
  Package,
  RefreshCw,
  Folder,
  XCircle,
  Brain,
  Code,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/features/ui/primitives/button';
import { Card } from '@/features/ui/primitives/card';
import { cn } from '@/features/ui/primitives/styles';
import { SimpleTooltip } from '@/features/ui/primitives/tooltip';
import { useDeleteQueueItem, useRetryQueueItem, useStopQueueItem } from '../hooks/useQueueQueries';
import type { QueueItem } from '../types';
import { QueueItemProgress } from './QueueItemProgress';
import { QueueItemStatusBadge } from './QueueItemStatusBadge';

interface CrawlQueueItemProps {
  item: QueueItem;
  className?: string;
}

export const CrawlQueueItem: React.FC<CrawlQueueItemProps> = ({ item, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const retryMutation = useRetryQueueItem();
  const stopMutation = useStopQueueItem();
  const deleteMutation = useDeleteQueueItem();

  const handleRetry = () => {
    retryMutation.mutate(item.item_id);
  };

  const handleStop = () => {
    stopMutation.mutate(item.item_id);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this queue item?')) {
      deleteMutation.mutate(item.item_id);
    }
  };

  // Get scope badge configuration
  const getScopeBadge = () => {
    const scope = item.scope || 'global';
    switch (scope) {
      case 'global':
        return {
          icon: <Globe className="w-3 h-3" />,
          label: 'Global',
          className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
        };
      case 'project':
        return {
          icon: <Folder className="w-3 h-3" />,
          label: 'Project',
          className: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
        };
      case 'user':
        return {
          icon: <Lock className="w-3 h-3" />,
          label: 'Private',
          className: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
        };
    }
  };

  const scopeBadge = getScopeBadge();

  // Get error type badge
  const getErrorTypeBadge = () => {
    if (!item.error_type) return null;

    const errorType = item.error_type.toLowerCase();
    if (errorType.includes('network')) {
      return { label: 'Network Error', className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' };
    } else if (errorType.includes('timeout')) {
      return { label: 'Timeout', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400' };
    } else if (errorType.includes('parse')) {
      return { label: 'Parse Error', className: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' };
    } else {
      return { label: item.error_type, className: 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400' };
    }
  };

  const errorTypeBadge = getErrorTypeBadge();

  return (
    <Card className={cn('overflow-hidden transition-all duration-200', className)}>
      <div className="p-6 space-y-4">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <SimpleTooltip content={item.source_url || 'Unknown source'}>
              <div className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {item.source_title || item.source_id}
              </div>
            </SimpleTooltip>
            {item.source_url && (
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                {item.source_url}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <QueueItemStatusBadge status={item.status} />
            {scopeBadge && (
              <div className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium', scopeBadge.className)}>
                {scopeBadge.icon}
                <span>{scopeBadge.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-2">
          <QueueItemProgress progress={item.progress} status={item.status} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {item.progress}% - {item.status === 'completed' ? 'Complete' : item.status === 'running' ? `Crawling page ${item.statistics.pages_crawled}` : 'Waiting'}
            </span>
            {item.retry_count > 0 && (
              <span className="text-orange-600 dark:text-orange-400 text-xs font-medium">
                Retry {item.retry_count}/{item.max_retries}
              </span>
            )}
          </div>
        </div>

        {/* Source Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {item.last_crawled_at && (
            <div>
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Last Crawled</div>
              <div className="text-gray-900 dark:text-white font-medium">
                {formatDistanceToNow(new Date(item.last_crawled_at), { addSuffix: true })}
              </div>
            </div>
          )}
          {item.next_retry_at && (
            <div>
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Next Retry</div>
              <div className="text-gray-900 dark:text-white font-medium">
                {formatDistanceToNow(new Date(item.next_retry_at), { addSuffix: true })}
              </div>
            </div>
          )}
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {item.statistics.pages_crawled}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Pages</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-green-500" />
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {item.statistics.chunks_created}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Chunks</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-purple-500" />
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {item.statistics.code_examples_count}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Code</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-pink-500" />
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {item.statistics.embeddings_generated}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Embeddings</div>
            </div>
          </div>
        </div>

        {/* Error Section (if failed) */}
        {item.status === 'failed' && item.error_message && (
          <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm font-medium text-red-800 dark:text-red-400">Error Details</span>
                {errorTypeBadge && (
                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', errorTypeBadge.className)}>
                    {errorTypeBadge.label}
                  </span>
                )}
                {item.requires_human_review && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400">
                    Requires Review
                  </span>
                )}
              </div>
            </div>
            <div className={cn(
              'text-sm text-red-700 dark:text-red-300 overflow-hidden transition-all duration-200',
              isExpanded ? 'max-h-96' : 'max-h-20'
            )}>
              {item.error_message}
            </div>
            {item.error_message.length > 100 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show more
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            <span>Created {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
          </div>
          <div className="flex items-center gap-2">
            {(item.status === 'failed' || item.status === 'cancelled') && (
              <SimpleTooltip content="Retry crawl">
                <Button
                  onClick={handleRetry}
                  disabled={retryMutation.isPending}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className={cn('w-4 h-4', retryMutation.isPending && 'animate-spin')} />
                  Retry
                </Button>
              </SimpleTooltip>
            )}
            {(item.status === 'pending' || item.status === 'running') && (
              <SimpleTooltip content="Stop crawl">
                <Button
                  onClick={handleStop}
                  disabled={stopMutation.isPending}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-orange-600 hover:text-orange-700 dark:text-orange-400"
                >
                  <XCircle className="w-4 h-4" />
                  Stop
                </Button>
              </SimpleTooltip>
            )}
            <SimpleTooltip content="Delete queue item">
              <Button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                variant="outline"
                size="sm"
                className="gap-2 text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Delete
              </Button>
            </SimpleTooltip>
          </div>
        </div>
      </div>
    </Card>
  );
};
