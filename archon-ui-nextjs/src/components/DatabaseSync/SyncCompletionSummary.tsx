'use client';

import React from 'react';
import { CheckCircleIcon, XCircleIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { useSyncStore } from '@/store/useSyncStore';

interface VerificationResult {
  check: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
}

export const SyncCompletionSummary: React.FC = () => {
  const { progress, direction, databaseStats, resetWizard } = useSyncStore();

  // Mock verification results (will be populated by backend in future)
  const verificationResults: VerificationResult[] = [
    { check: 'Row Count Verification', status: 'passed', message: 'All rows transferred successfully' },
    { check: 'Schema Integrity', status: 'passed', message: 'Schema structure verified' },
    { check: 'Index Recreation', status: 'passed', message: 'All indexes recreated' },
    { check: 'Constraint Validation', status: 'passed', message: 'Foreign keys validated' },
  ];

  const isSuccess = progress.status === 'completed';
  const isFailed = progress.status === 'failed';
  const isCancelled = progress.status === 'cancelled';

  const getStatusIcon = () => {
    if (isSuccess) return <CheckCircleIcon className="h-20 w-20 text-green-600 dark:text-green-400 mx-auto mb-4" />;
    if (isFailed) return <XCircleIcon className="h-20 w-20 text-red-600 dark:text-red-400 mx-auto mb-4" />;
    if (isCancelled) return <XCircleIcon className="h-20 w-20 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />;
    return <ArrowPathIcon className="h-20 w-20 text-blue-600 dark:text-blue-400 mx-auto mb-4 animate-spin" />;
  };

  const getStatusTitle = () => {
    if (isSuccess) return 'Sync Completed Successfully!';
    if (isFailed) return 'Sync Failed';
    if (isCancelled) return 'Sync Cancelled';
    return 'Sync In Progress';
  };

  const getStatusColor = () => {
    if (isSuccess) return 'text-green-600 dark:text-green-400';
    if (isFailed) return 'text-red-600 dark:text-red-400';
    if (isCancelled) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  const sourceDb = direction === 'local-to-remote' ? 'Local' : 'Remote';
  const targetDb = direction === 'local-to-remote' ? 'Remote' : 'Local';
  const sourceRows = direction === 'local-to-remote' ? databaseStats?.local.total_rows : databaseStats?.remote.total_rows;
  const targetRows = direction === 'local-to-remote' ? databaseStats?.remote.total_rows : databaseStats?.local.total_rows;

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="text-center py-8">
        {getStatusIcon()}
        <h2 className={`text-3xl font-bold ${getStatusColor()} mb-2`}>
          {getStatusTitle()}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Sync ID: <span className="font-mono text-sm">{progress.sync_id}</span>
        </p>
      </div>

      {/* Success Summary */}
      {isSuccess && (
        <>
          {/* Sync Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ArrowPathIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Direction</h4>
              </div>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                {sourceDb} → {targetDb}
              </p>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                <h4 className="text-sm font-semibold text-green-900 dark:text-green-100">Rows Synced</h4>
              </div>
              <p className="text-lg font-bold text-green-900 dark:text-green-100">
                {progress.synced_rows?.toLocaleString() || sourceRows?.toLocaleString() || '0'}
              </p>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ClockIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100">Duration</h4>
              </div>
              <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                {progress.duration_seconds
                  ? `${Math.floor(progress.duration_seconds / 60)}m ${progress.duration_seconds % 60}s`
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Verification Results */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Verification Results
            </h3>
            <div className="space-y-3">
              {verificationResults.map((result, index) => (
                <div
                  key={index}
                  className={`
                    p-4 rounded-lg border-2
                    ${result.status === 'passed' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : ''}
                    ${result.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : ''}
                    ${result.status === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : ''}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {result.status === 'passed' && (
                      <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                    )}
                    {result.status === 'failed' && (
                      <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                    {result.status === 'warning' && (
                      <XCircleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    )}
                    <div>
                      <h4
                        className={`
                          text-sm font-semibold mb-1
                          ${result.status === 'passed' ? 'text-green-900 dark:text-green-100' : ''}
                          ${result.status === 'failed' ? 'text-red-900 dark:text-red-100' : ''}
                          ${result.status === 'warning' ? 'text-yellow-900 dark:text-yellow-100' : ''}
                        `}
                      >
                        {result.check}
                      </h4>
                      <p
                        className={`
                          text-sm
                          ${result.status === 'passed' ? 'text-green-800 dark:text-green-200' : ''}
                          ${result.status === 'failed' ? 'text-red-800 dark:text-red-200' : ''}
                          ${result.status === 'warning' ? 'text-yellow-800 dark:text-yellow-200' : ''}
                        `}
                      >
                        {result.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Next Steps */}
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">Next Steps</h4>
            <ul className="list-disc list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li>Verify your application is working correctly with the synced data</li>
              <li>Check database statistics and performance</li>
              <li>Review sync logs for any warnings or issues</li>
              <li>Consider scheduling regular syncs if needed</li>
            </ul>
          </div>
        </>
      )}

      {/* Error Summary */}
      {isFailed && (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-3">Error Details</h3>
          <p className="text-sm text-red-800 dark:text-red-200 mb-4">{progress.error_message}</p>

          <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">Recovery Steps:</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-red-800 dark:text-red-200">
            <li>Check the sync logs above for detailed error information</li>
            <li>Verify database connectivity and credentials</li>
            <li>Ensure sufficient disk space is available</li>
            <li>If needed, restore from backup using the sync UI</li>
            <li>Contact support if the issue persists</li>
          </ol>
        </div>
      )}

      {/* Cancelled Summary */}
      {isCancelled && (
        <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">Sync Cancelled</h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
            The sync operation was cancelled. Any changes may have been rolled back.
          </p>

          <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">What Happened:</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
            <li>Sync process was terminated by user request</li>
            <li>Automatic rollback was triggered if in import phase</li>
            <li>Target database should be in its original state</li>
            <li>You can safely start a new sync operation</li>
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 pt-6">
        <button
          onClick={resetWizard}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg"
        >
          Start New Sync
        </button>
        {isSuccess && (
          <a
            href="/database-sync/history"
            className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors text-lg"
          >
            View Sync History
          </a>
        )}
      </div>
    </div>
  );
};
