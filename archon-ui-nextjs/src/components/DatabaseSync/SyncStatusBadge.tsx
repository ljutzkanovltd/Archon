import React from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';

interface SyncStatusBadgeProps {
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  showLabel = true,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          textColor: 'text-green-800 dark:text-green-200',
          borderColor: 'border-green-300 dark:border-green-700',
          icon: CheckCircleIcon,
          label: 'Completed',
        };
      case 'failed':
        return {
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          textColor: 'text-red-800 dark:text-red-200',
          borderColor: 'border-red-300 dark:border-red-700',
          icon: XCircleIcon,
          label: 'Failed',
        };
      case 'cancelled':
        return {
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          borderColor: 'border-yellow-300 dark:border-yellow-700',
          icon: XCircleIcon,
          label: 'Cancelled',
        };
      case 'running':
        return {
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          textColor: 'text-blue-800 dark:text-blue-200',
          borderColor: 'border-blue-300 dark:border-blue-700',
          icon: ArrowPathIcon,
          label: 'Running',
        };
      default:
        return {
          bgColor: 'bg-gray-100 dark:bg-gray-900/30',
          textColor: 'text-gray-800 dark:text-gray-200',
          borderColor: 'border-gray-300 dark:border-gray-700',
          icon: ClockIcon,
          label: 'Unknown',
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          badge: 'px-2 py-1 text-xs',
          icon: 'h-3 w-3',
          gap: 'gap-1',
        };
      case 'lg':
        return {
          badge: 'px-4 py-2 text-base',
          icon: 'h-6 w-6',
          gap: 'gap-2',
        };
      case 'md':
      default:
        return {
          badge: 'px-3 py-1.5 text-sm',
          icon: 'h-4 w-4',
          gap: 'gap-1.5',
        };
    }
  };

  const config = getStatusConfig();
  const sizeClasses = getSizeClasses();
  const Icon = config.icon;

  return (
    <div
      className={`
        inline-flex items-center font-semibold rounded-full border
        ${config.bgColor}
        ${config.textColor}
        ${config.borderColor}
        ${sizeClasses.badge}
        ${sizeClasses.gap}
      `}
    >
      {showIcon && (
        <Icon
          className={`
            ${sizeClasses.icon}
            ${status === 'running' ? 'animate-spin' : ''}
          `}
        />
      )}
      {showLabel && <span>{config.label}</span>}
    </div>
  );
};
