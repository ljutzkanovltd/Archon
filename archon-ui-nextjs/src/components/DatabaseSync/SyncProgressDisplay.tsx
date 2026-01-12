'use client';

import React, { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  SignalIcon,
  SignalSlashIcon,
} from '@heroicons/react/24/outline';
import { useSyncStore } from '@/store/useSyncStore';
import { useSyncProgress } from '@/hooks/useSyncProgress';

interface PhaseIndicatorProps {
  phase: string;
  isActive: boolean;
  isCompleted: boolean;
}

const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ phase, isActive, isCompleted }) => {
  const phaseLabels: Record<string, string> = {
    validation: 'Validation',
    export: 'Export',
    preparation: 'Preparation',
    import: 'Import',
    finalization: 'Finalization',
    verification: 'Verification',
  };

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg transition-all
        ${isActive ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500' : ''}
        ${isCompleted ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500' : ''}
        ${!isActive && !isCompleted ? 'bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700' : ''}
      `}
    >
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm
          ${isActive ? 'bg-blue-600 text-white' : ''}
          ${isCompleted ? 'bg-green-600 text-white' : ''}
          ${!isActive && !isCompleted ? 'bg-gray-400 text-white' : ''}
        `}
      >
        {isCompleted ? <CheckCircleIcon className="h-5 w-5" /> : isActive ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : ''}
      </div>
      <span
        className={`
          text-sm font-medium
          ${isActive ? 'text-blue-900 dark:text-blue-100' : ''}
          ${isCompleted ? 'text-green-900 dark:text-green-100' : ''}
          ${!isActive && !isCompleted ? 'text-gray-600 dark:text-gray-400' : ''}
        `}
      >
        {phaseLabels[phase] || phase}
      </span>
    </div>
  );
};

interface SyncProgressDisplayProps {
  onCancel?: () => void;
}

export const SyncProgressDisplay: React.FC<SyncProgressDisplayProps> = ({ onCancel }) => {
  const { progress } = useSyncStore();
  const [showLogs, setShowLogs] = useState(false);

  const { isWebSocketConnected, isPolling, isLoading } = useSyncProgress({
    syncId: progress.sync_id || '',
    enabled: !!progress.sync_id && progress.status === 'running',
  });

  const phases = ['validation', 'export', 'preparation', 'import', 'finalization', 'verification'];
  const currentPhaseIndex = progress.current_phase ? phases.indexOf(progress.current_phase) : -1;

  const handleCancel = async () => {
    if (!progress.sync_id || !onCancel) return;

    if (!confirm('Are you sure you want to cancel this sync? This will trigger a rollback if in import phase.')) {
      return;
    }

    try {
      const response = await fetch(`/api/database/sync/${progress.sync_id}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        onCancel();
      } else {
        alert('Failed to cancel sync');
      }
    } catch (error) {
      console.error('Cancel failed:', error);
      alert('Failed to cancel sync');
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-3">
          {isWebSocketConnected ? (
            <>
              <SignalIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  WebSocket Connected
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Real-time updates active</div>
              </div>
            </>
          ) : isPolling ? (
            <>
              <ClockIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Polling Mode</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Updates every 2 seconds
                </div>
              </div>
            </>
          ) : (
            <>
              <SignalSlashIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Connecting...</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Establishing connection</div>
              </div>
            </>
          )}
        </div>

        {progress.status === 'running' && (
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
          >
            Cancel Sync
          </button>
        )}
      </div>

      {/* Phase Indicators */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Sync Phases</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {phases.map((phase, index) => (
            <PhaseIndicator
              key={phase}
              phase={phase}
              isActive={index === currentPhaseIndex}
              isCompleted={index < currentPhaseIndex}
            />
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Overall Progress</h3>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {progress.percent_complete}%
          </span>
        </div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progress.percent_complete}%` }}
          />
        </div>
      </div>

      {/* Current Activity */}
      {progress.current_table && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <ArrowPathIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Current Activity</h4>
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Processing table: <span className="font-mono font-bold">{progress.current_table}</span>
          </p>
          {progress.synced_rows !== null && progress.total_rows !== null && (
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              Rows: {progress.synced_rows?.toLocaleString()} / {progress.total_rows?.toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {progress.error_message && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">Error Occurred</h4>
              <p className="text-sm text-red-800 dark:text-red-200">{progress.error_message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Logs Section */}
      {progress.logs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sync Logs</h3>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showLogs ? 'Hide' : 'Show'} Logs ({progress.logs.length})
            </button>
          </div>
          {showLogs && (
            <div className="h-64 overflow-y-auto bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg">
              {progress.logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading sync progress...</p>
        </div>
      )}
    </div>
  );
};
