'use client';

import React, { useEffect, useState } from 'react';
import { ArrowRightIcon, ArrowLeftIcon, ServerIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useSyncStore, type SyncDirection } from '@/store/useSyncStore';

interface DatabaseStatsCardProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  stats: {
    projects: number;
    tasks: number;
    documents: number;
    total_rows: number;
  };
  isSource?: boolean;
  isTarget?: boolean;
}

const DatabaseStatsCard: React.FC<DatabaseStatsCardProps> = ({
  label,
  icon: Icon,
  stats,
  isSource,
  isTarget,
}) => {
  return (
    <div
      className={`
        relative rounded-lg border-2 p-6 transition-all
        ${isSource ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}
        ${isTarget ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
        ${!isSource && !isTarget ? 'border-gray-300 dark:border-gray-700' : ''}
      `}
    >
      {isSource && (
        <div className="absolute top-2 right-2 px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800 rounded">
          SOURCE
        </div>
      )}
      {isTarget && (
        <div className="absolute top-2 right-2 px-2 py-1 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800 rounded">
          TARGET
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <Icon className="h-8 w-8 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{label}</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Projects</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.projects}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Tasks</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.tasks}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Documents</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.documents}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Rows</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.total_rows.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

interface DirectionOptionProps {
  direction: SyncDirection;
  title: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

const DirectionOption: React.FC<DirectionOptionProps> = ({
  direction,
  title,
  description,
  icon,
  selected,
  onSelect,
}) => {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full p-6 rounded-lg border-2 transition-all text-left
        ${
          selected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
            : 'border-gray-300 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
        }
      `}
    >
      <div className="flex items-start gap-4">
        <div className={`${selected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        </div>
        {selected && (
          <div className="flex-shrink-0">
            <div className="h-6 w-6 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        )}
      </div>
    </button>
  );
};

export const SyncDirectionSelector: React.FC = () => {
  const { direction, setDirection, databaseStats, setDatabaseStats } = useSyncStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch database stats
    const fetchStats = async () => {
      try {
        // TODO: Implement actual API calls to get database stats
        // For now, using mock data
        setDatabaseStats({
          local: {
            projects: 13,
            tasks: 351,
            documents: 0,
            total_rows: 6674,
          },
          remote: {
            projects: 13,
            tasks: 281,
            documents: 0,
            total_rows: 6355,
          },
        });
      } catch (error) {
        console.error('Failed to fetch database stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [setDatabaseStats]);

  if (loading || !databaseStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getSourceTarget = () => {
    if (direction === 'local-to-remote') {
      return { source: 'local', target: 'remote' };
    } else if (direction === 'remote-to-local') {
      return { source: 'remote', target: 'local' };
    }
    return { source: null, target: null };
  };

  const { source, target } = getSourceTarget();

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Select Sync Direction
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Choose whether to backup local database to remote or restore remote database to local
        </p>
      </div>

      {/* Direction Options */}
      <div className="space-y-4">
        <DirectionOption
          direction="local-to-remote"
          title="Local → Remote (Backup)"
          description="Backup local database to remote Supabase Cloud. This will overwrite the remote database with your local data."
          icon={<ArrowRightIcon className="h-8 w-8" />}
          selected={direction === 'local-to-remote'}
          onSelect={() => setDirection('local-to-remote')}
        />

        <DirectionOption
          direction="remote-to-local"
          title="Remote → Local (Restore)"
          description="Restore remote Supabase Cloud database to local. This will overwrite your local database with remote data."
          icon={<ArrowLeftIcon className="h-8 w-8" />}
          selected={direction === 'remote-to-local'}
          onSelect={() => setDirection('remote-to-local')}
        />
      </div>

      {/* Database Stats Visualization */}
      {direction && (
        <div className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Local Database */}
            <DatabaseStatsCard
              label="Local Database"
              icon={ComputerDesktopIcon}
              stats={databaseStats.local}
              isSource={source === 'local'}
              isTarget={target === 'local'}
            />

            {/* Arrow */}
            <div className="flex justify-center">
              {direction === 'local-to-remote' ? (
                <ArrowRightIcon className="h-12 w-12 text-blue-600 dark:text-blue-400 animate-pulse" />
              ) : (
                <ArrowLeftIcon className="h-12 w-12 text-blue-600 dark:text-blue-400 animate-pulse" />
              )}
            </div>

            {/* Remote Database */}
            <DatabaseStatsCard
              label="Remote Database"
              icon={ServerIcon}
              stats={databaseStats.remote}
              isSource={source === 'remote'}
              isTarget={target === 'remote'}
            />
          </div>

          {/* Warning Message */}
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-3">
              <svg
                className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  Destructive Operation
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {direction === 'local-to-remote'
                    ? `The remote database will be completely replaced with local data. ${databaseStats.remote.total_rows.toLocaleString()} rows will be deleted and replaced with ${databaseStats.local.total_rows.toLocaleString()} rows.`
                    : `Your local database will be completely replaced with remote data. ${databaseStats.local.total_rows.toLocaleString()} rows will be deleted and replaced with ${databaseStats.remote.total_rows.toLocaleString()} rows.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
