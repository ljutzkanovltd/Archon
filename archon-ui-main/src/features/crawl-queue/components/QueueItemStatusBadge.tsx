/**
 * Queue Item Status Badge Component
 * Status badge with appropriate colors and icons
 */

import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/features/ui/primitives/styles';
import type { QueueItemStatus } from '../types';

interface QueueItemStatusBadgeProps {
  status: QueueItemStatus;
  className?: string;
}

export const QueueItemStatusBadge: React.FC<QueueItemStatusBadgeProps> = ({
  status,
  className,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pending',
          icon: <Clock className="w-3 h-3" />,
          className: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20',
        };
      case 'running':
        return {
          label: 'Running',
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
        };
      case 'completed':
        return {
          label: 'Completed',
          icon: <CheckCircle2 className="w-3 h-3" />,
          className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20',
        };
      case 'failed':
        return {
          label: 'Failed',
          icon: <AlertCircle className="w-3 h-3" />,
          className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          icon: <XCircle className="w-3 h-3" />,
          className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20',
        };
      default:
        return {
          label: status,
          icon: null,
          className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border',
        'transition-all duration-200',
        config.className,
        className
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
};
