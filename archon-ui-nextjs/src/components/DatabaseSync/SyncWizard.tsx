'use client';

import React, { useState } from 'react';
import { CheckIcon } from '@heroicons/react/24/solid';
import { useSyncStore, type WizardStep } from '@/store/useSyncStore';
import { SyncDirectionSelector } from './SyncDirectionSelector';
import { SafetyConfirmationModal } from './SafetyConfirmationModal';
import { SyncProgressDisplay } from './SyncProgressDisplay';
import { SyncCompletionSummary } from './SyncCompletionSummary';

interface StepIndicatorProps {
  steps: { key: WizardStep; label: string }[];
  currentStep: WizardStep;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep }) => {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={step.key}>
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                  transition-all
                  ${isComplete ? 'bg-green-600 text-white' : ''}
                  ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-200 dark:ring-blue-800' : ''}
                  ${!isComplete && !isCurrent ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : ''}
                `}
              >
                {isComplete ? <CheckIcon className="h-6 w-6" /> : index + 1}
              </div>
              <div
                className={`
                  mt-2 text-xs font-medium
                  ${isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}
                `}
              >
                {step.label}
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`
                  flex-1 h-1 mx-4 transition-all
                  ${isComplete ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'}
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface PreflightChecksStepProps {
  onNext: () => void;
  onBack: () => void;
}

const PreflightChecksStep: React.FC<PreflightChecksStepProps> = ({ onNext, onBack }) => {
  const { direction, setPreflightResults, preflightChecks } = useSyncStore();
  const [loading, setLoading] = useState(false);

  const runPreflightChecks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/database/sync/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });

      const data = await response.json();
      setPreflightResults(data.checks, data.warnings, data.errors);

      if (data.success) {
        setTimeout(() => onNext(), 1500);
      }
    } catch (error) {
      console.error('Preflight checks failed:', error);
      setPreflightResults({}, [], ['Failed to connect to backend API']);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    runPreflightChecks();
  }, []);

  if (loading || !preflightChecks) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-600 dark:text-gray-400">Running pre-flight checks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-6">
        Pre-Flight Checks
      </h2>

      {/* Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Database Connectivity */}
        {preflightChecks.database_connectivity && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-green-900 dark:text-green-100">Database Connectivity</h3>
              <CheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <div>Local: {preflightChecks.database_connectivity.local.latency_ms}ms</div>
              <div>Remote: {preflightChecks.database_connectivity.remote.latency_ms}ms</div>
            </div>
          </div>
        )}

        {/* Disk Space */}
        {preflightChecks.disk_space && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-green-900 dark:text-green-100">Disk Space</h3>
              <CheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <div>Available: {preflightChecks.disk_space.available_gb.toFixed(1)} GB</div>
              <div>Required: {preflightChecks.disk_space.required_gb.toFixed(1)} GB</div>
            </div>
          </div>
        )}

        {/* Schema Version */}
        {preflightChecks.schema_version && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-green-900 dark:text-green-100">Schema Version</h3>
              <CheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <div>Local: v{preflightChecks.schema_version.local.version} (PG {preflightChecks.schema_version.local.postgres})</div>
              <div>Remote: v{preflightChecks.schema_version.remote.version} (PG {preflightChecks.schema_version.remote.postgres})</div>
            </div>
          </div>
        )}

        {/* Backup Status */}
        {preflightChecks.backup_exists && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-green-900 dark:text-green-100">Backup Status</h3>
              <CheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <div>Latest: {preflightChecks.backup_exists.latest_backup}</div>
              <div>Age: {preflightChecks.backup_exists.age_hours.toFixed(1)} hours</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          Continue to Safety Approval →
        </button>
      </div>
    </div>
  );
};

export const SyncWizard: React.FC = () => {
  const { currentStep, direction, nextStep, previousStep, resetWizard } = useSyncStore();
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  const steps = [
    { key: 'direction' as WizardStep, label: 'Direction' },
    { key: 'preflight' as WizardStep, label: 'Pre-flight' },
    { key: 'approval' as WizardStep, label: 'Approval' },
    { key: 'progress' as WizardStep, label: 'Progress' },
    { key: 'complete' as WizardStep, label: 'Complete' },
  ];

  const handleDirectionNext = () => {
    if (!direction) {
      alert('Please select a sync direction');
      return;
    }
    nextStep();
  };

  const handleApprovalNext = () => {
    setShowSafetyModal(true);
  };

  const handleSafetyConfirmed = async () => {
    setShowSafetyModal(false);

    // Start sync
    try {
      const response = await fetch('/api/database/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          skip_confirmation: true,
          triggered_by: 'UI User',
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Move to progress step
        nextStep();

        // TODO: Connect to WebSocket for real-time updates
        // This will be implemented in Phase 7d
      }
    } catch (error) {
      console.error('Failed to start sync:', error);
      alert('Failed to start sync. Please try again.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Step Indicator */}
      <StepIndicator steps={steps} currentStep={currentStep} />

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {currentStep === 'direction' && (
          <>
            <SyncDirectionSelector />
            <div className="flex justify-end mt-8">
              <button
                onClick={handleDirectionNext}
                disabled={!direction}
                className={`
                  px-6 py-2 font-semibold rounded-lg transition-colors
                  ${
                    direction
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                Continue to Pre-flight Checks →
              </button>
            </div>
          </>
        )}

        {currentStep === 'preflight' && (
          <PreflightChecksStep onNext={nextStep} onBack={previousStep} />
        )}

        {currentStep === 'approval' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Safety Approval Required
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                This is a destructive operation that requires your confirmation.
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={previousStep}
                  className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleApprovalNext}
                  className="px-8 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors text-lg"
                >
                  Review Safety Confirmations →
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'progress' && (
          <SyncProgressDisplay onCancel={() => {
            // Handle cancel - move to complete step to show cancellation summary
            nextStep();
          }} />
        )}

        {currentStep === 'complete' && (
          <SyncCompletionSummary />
        )}
      </div>

      {/* Safety Confirmation Modal */}
      <SafetyConfirmationModal
        isOpen={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        onConfirm={handleSafetyConfirmed}
      />
    </div>
  );
};
