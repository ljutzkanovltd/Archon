'use client';

import React from 'react';
import { ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { SyncWizard } from '@/components/DatabaseSync/SyncWizard';

export default function DatabaseSyncPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <ArrowPathIcon className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              Database Synchronization
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Safely sync databases between local and remote Supabase instances with step-by-step guidance
            and safety confirmations.
          </p>

          {/* Quick Actions */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <Link
              href="/database-sync/history"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
            >
              <ClockIcon className="h-5 w-5" />
              View Sync History
            </Link>
          </div>
        </div>

        {/* Sync Wizard */}
        <SyncWizard />

        {/* Info Footer */}
        <div className="mt-12 max-w-5xl mx-auto">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
              About Database Sync
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800 dark:text-blue-200">
              <div>
                <h4 className="font-semibold mb-2">Local → Remote (Backup)</h4>
                <p>
                  Backs up your local development database to Supabase Cloud. Use this to save your work
                  or share data with your team.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Remote → Local (Restore)</h4>
                <p>
                  Restores the remote Supabase Cloud database to your local instance. Use this to get
                  fresh data or recover from local issues.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Safety Features</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <li>Pre-operation backup creation and verification</li>
                <li>Two-stage approval process for destructive operations</li>
                <li>Pre-flight checks for database connectivity, disk space, and schema compatibility</li>
                <li>Real-time progress monitoring with phase-by-phase updates</li>
                <li>Automatic rollback on cancellation or failure</li>
                <li>Comprehensive verification after sync completion</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
