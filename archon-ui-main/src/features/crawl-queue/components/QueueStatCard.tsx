/**
 * Queue Stat Card Component
 * Statistics card for crawl queue dashboard
 */

import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/features/ui/primitives/card';
import { cn } from '@/features/ui/primitives/styles';

interface QueueStatCardProps {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: 'yellow' | 'blue' | 'green' | 'red';
  showSpinner?: boolean;
}

const colorClasses = {
  yellow: {
    bg: 'bg-yellow-100 dark:bg-yellow-500/10',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-500/20',
    badge: 'bg-yellow-500',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-500/20',
    badge: 'bg-blue-500',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-500/10',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-500/20',
    badge: 'bg-green-500',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-500/20',
    badge: 'bg-red-500',
  },
};

export const QueueStatCard: React.FC<QueueStatCardProps> = ({
  label,
  count,
  icon,
  color,
  showSpinner = false,
}) => {
  const colors = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-200',
          'hover:shadow-lg hover:scale-105',
          'border-2',
          colors.border
        )}
      >
        <div className={cn('p-6', colors.bg)}>
          <div className="flex items-center justify-between mb-4">
            <div className={cn('p-3 rounded-lg', colors.bg, 'border', colors.border)}>
              <div className={colors.text}>{icon}</div>
            </div>
            {showSpinner && (
              <Loader2 className={cn('w-5 h-5 animate-spin', colors.text)} />
            )}
          </div>

          <div className="space-y-1">
            <motion.div
              key={count}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className={cn('text-4xl font-bold', colors.text)}
            >
              {count}
            </motion.div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {label}
            </div>
          </div>

          {/* Visual badge indicator */}
          <div className={cn('absolute top-0 right-0 w-24 h-24 opacity-10', colors.badge)} style={{
            clipPath: 'polygon(100% 0, 100% 100%, 0 0)'
          }} />
        </div>
      </Card>
    </motion.div>
  );
};
