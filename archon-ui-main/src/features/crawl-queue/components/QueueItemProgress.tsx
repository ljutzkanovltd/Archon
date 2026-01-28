/**
 * Queue Item Progress Bar Component
 * Progress bar for individual queue items
 */

import { motion } from 'framer-motion';
import { cn } from '@/features/ui/primitives/styles';
import type { QueueItemStatus } from '../types';

interface QueueItemProgressProps {
  progress: number; // 0-100
  status: QueueItemStatus;
  className?: string;
}

export const QueueItemProgress: React.FC<QueueItemProgressProps> = ({
  progress,
  status,
  className,
}) => {
  const getProgressColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'running':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getBackgroundColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-500/10';
      case 'running':
        return 'bg-blue-100 dark:bg-blue-500/10';
      case 'failed':
        return 'bg-red-100 dark:bg-red-500/10';
      case 'cancelled':
        return 'bg-gray-100 dark:bg-gray-500/10';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-500/10';
      default:
        return 'bg-gray-100 dark:bg-gray-500/10';
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-600 dark:text-gray-400">Progress</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{progress}%</span>
      </div>
      <div className={cn('h-2 rounded-full overflow-hidden', getBackgroundColor())}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full rounded-full', getProgressColor())}
        />
      </div>
    </div>
  );
};
