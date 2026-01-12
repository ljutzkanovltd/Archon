'use client';

import React, { useState } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useSyncStore } from '@/store/useSyncStore';

interface SafetyConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const SafetyConfirmationModal: React.FC<SafetyConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const {
    direction,
    databaseStats,
    preflightChecks,
    preflightWarnings,
    preflightErrors,
    firstApprovalGiven,
    secondApprovalGiven,
    setFirstApproval,
    setSecondApproval,
  } = useSyncStore();

  const [stage, setStage] = useState<'first' | 'second'>('first');
  const [confirmationText, setConfirmationText] = useState('');

  if (!isOpen) return null;

  const handleFirstApproval = () => {
    setFirstApproval(true);
    setStage('second');
  };

  const handleSecondApproval = () => {
    if (confirmationText === 'I UNDERSTAND THE RISK') {
      setSecondApproval(true);
      onConfirm();
    }
  };

  const handleClose = () => {
    setStage('first');
    setConfirmationText('');
    setFirstApproval(false);
    setSecondApproval(false);
    onClose();
  };

  const sourceDb = direction === 'local-to-remote' ? 'Local' : 'Remote';
  const targetDb = direction === 'local-to-remote' ? 'Remote' : 'Local';
  const sourceRows = direction === 'local-to-remote' ? databaseStats?.local.total_rows : databaseStats?.remote.total_rows;
  const targetRows = direction === 'local-to-remote' ? databaseStats?.remote.total_rows : databaseStats?.local.total_rows;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stage === 'first' ? 'Safety Confirmation Required' : 'Final Confirmation'}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {stage === 'first' && (
              <>
                {/* Danger Warning */}
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                    ⚠️ DESTRUCTIVE OPERATION
                  </h3>
                  <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                    This operation will <strong>PERMANENTLY DELETE</strong> all data in the {targetDb} database
                    and replace it with data from the {sourceDb} database.
                  </p>
                  <div className="space-y-2 text-sm text-red-800 dark:text-red-200">
                    <div className="flex justify-between">
                      <span>Rows to be deleted ({targetDb}):</span>
                      <span className="font-bold">{targetRows?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rows to be imported ({sourceDb}):</span>
                      <span className="font-bold">{sourceRows?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Backup Status */}
                {preflightChecks?.backup_exists && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                          Backup Available
                        </h4>
                        <p className="text-sm text-green-800 dark:text-green-200">
                          Latest backup: <strong>{preflightChecks.backup_exists.latest_backup}</strong>
                          <br />
                          Age: {preflightChecks.backup_exists.age_hours.toFixed(1)} hours
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {preflightWarnings.length > 0 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                      Warnings:
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                      {preflightWarnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* What Will Happen */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    What will happen:
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>Pre-operation backup will be created (if not recent)</li>
                    <li>All tables in {targetDb} database will be truncated</li>
                    <li>Data from {sourceDb} will be imported in batches</li>
                    <li>Vector indexes will be recreated (if applicable)</li>
                    <li>Verification checks will be performed</li>
                  </ol>
                </div>

                {/* Recovery Instructions */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Recovery Procedure (if needed):
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                    <li>Stop Archon services</li>
                    <li>Restore from latest backup</li>
                    <li>Restart services</li>
                    <li>Verify data integrity</li>
                  </ol>
                </div>
              </>
            )}

            {stage === 'second' && (
              <>
                {/* Final Confirmation */}
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 rounded-lg space-y-4">
                  <h3 className="text-xl font-bold text-red-900 dark:text-red-100 text-center">
                    FINAL CONFIRMATION REQUIRED
                  </h3>
                  <p className="text-center text-red-800 dark:text-red-200">
                    This is your last chance to cancel before the operation begins.
                  </p>
                  <div className="space-y-2 text-center text-sm text-red-800 dark:text-red-200">
                    <p>
                      <strong>Direction:</strong> {direction}
                    </p>
                    <p>
                      <strong>Target Database ({targetDb}):</strong> {targetRows?.toLocaleString()} rows will be
                      deleted
                    </p>
                    <p>
                      <strong>Source Database ({sourceDb}):</strong> {sourceRows?.toLocaleString()} rows will be
                      imported
                    </p>
                  </div>
                </div>

                {/* Type Confirmation */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Type the following phrase to confirm:
                  </label>
                  <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded font-mono text-center text-lg">
                    I UNDERSTAND THE RISK
                  </div>
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                             focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800
                             font-mono text-center"
                    placeholder="Type here..."
                    autoFocus
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {stage === 'first' ? (
              <button
                onClick={handleFirstApproval}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors"
              >
                I Understand, Continue →
              </button>
            ) : (
              <button
                onClick={handleSecondApproval}
                disabled={confirmationText !== 'I UNDERSTAND THE RISK'}
                className={`
                  px-6 py-2 font-semibold rounded-lg transition-colors
                  ${
                    confirmationText === 'I UNDERSTAND THE RISK'
                      ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                Proceed with Sync
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
