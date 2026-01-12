'use client';

import React from 'react';
import {
  XMarkIcon,
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  CloudIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import { SyncStatusBadge } from './SyncStatusBadge';
import type { SyncHistoryRecord } from '@/hooks/useSyncHistory';

interface SyncDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SyncHistoryRecord | null;
}

export const SyncDetailsModal: React.FC<SyncDetailsModalProps> = ({ isOpen, onClose, record }) => {
  if (!isOpen || !record) return null;

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const sourceDb = record.direction === 'local-to-remote' ? 'Local' : 'Remote';
  const targetDb = record.direction === 'local-to-remote' ? 'Remote' : 'Local';

  const verificationResults = record.verification_results || {};
  const hasVerification = Object.keys(verificationResults).length > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Sync Details
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Sync ID: <span className="font-mono">{record.sync_id}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Status & Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Status</h3>
                  <SyncStatusBadge status={record.status} size="sm" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowPathIcon className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">Direction:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {sourceDb} → {targetDb}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatDuration(record.duration_seconds)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Data Transfer
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    <span className="text-gray-600 dark:text-gray-400">Synced Rows:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {record.synced_rows?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="h-4 w-4 text-blue-500" />
                    <span className="text-gray-600 dark:text-gray-400">Total Rows:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {record.total_rows?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">Timeline</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-blue-700 dark:text-blue-300 font-medium mb-1">Started</div>
                  <div className="text-blue-900 dark:text-blue-100">{formatDateTime(record.started_at)}</div>
                </div>
                <div>
                  <div className="text-blue-700 dark:text-blue-300 font-medium mb-1">Completed</div>
                  <div className="text-blue-900 dark:text-blue-100">{formatDateTime(record.completed_at)}</div>
                </div>
                <div>
                  <div className="text-blue-700 dark:text-blue-300 font-medium mb-1">Triggered By</div>
                  <div className="text-blue-900 dark:text-blue-100">{record.triggered_by}</div>
                </div>
                {record.backup_location && (
                  <div>
                    <div className="text-blue-700 dark:text-blue-300 font-medium mb-1">Backup Location</div>
                    <div className="text-blue-900 dark:text-blue-100 font-mono text-xs break-all">
                      {record.backup_location}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {record.error_message && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
                      Error Details
                    </h3>
                    <p className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">
                      {record.error_message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Results */}
            {hasVerification && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Verification Results
                </h3>
                <div className="space-y-3">
                  {Object.entries(verificationResults).map(([check, result]: [string, any]) => {
                    const isPassed = result.status === 'passed';
                    const isWarning = result.status === 'warning';

                    return (
                      <div
                        key={check}
                        className={`
                          p-4 rounded-lg border-2
                          ${isPassed ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : ''}
                          ${isWarning ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : ''}
                          ${!isPassed && !isWarning ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : ''}
                        `}
                      >
                        <div className="flex items-start gap-3">
                          {isPassed && <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />}
                          {isWarning && <XCircleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />}
                          {!isPassed && !isWarning && <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />}
                          <div>
                            <h4
                              className={`
                                text-sm font-semibold mb-1
                                ${isPassed ? 'text-green-900 dark:text-green-100' : ''}
                                ${isWarning ? 'text-yellow-900 dark:text-yellow-100' : ''}
                                ${!isPassed && !isWarning ? 'text-red-900 dark:text-red-100' : ''}
                              `}
                            >
                              {check.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </h4>
                            <p
                              className={`
                                text-sm
                                ${isPassed ? 'text-green-800 dark:text-green-200' : ''}
                                ${isWarning ? 'text-yellow-800 dark:text-yellow-200' : ''}
                                ${!isPassed && !isWarning ? 'text-red-800 dark:text-red-200' : ''}
                              `}
                            >
                              {result.message || result.details || 'No details available'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Database Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <ServerIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    Source Database
                  </h3>
                </div>
                <p className="text-lg font-bold text-purple-900 dark:text-purple-100">{sourceDb}</p>
              </div>

              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CloudIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                    Target Database
                  </h3>
                </div>
                <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">{targetDb}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
