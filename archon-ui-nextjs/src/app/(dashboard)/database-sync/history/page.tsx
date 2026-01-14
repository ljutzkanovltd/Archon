'use client';

import React from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { SyncHistoryTable } from '@/components/DatabaseSync/SyncHistoryTable';

export default function SyncHistoryPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Navigation */}
        <div className="mb-6">
          <Link
            href="/database-sync"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Database Sync
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Database Sync History
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and analyze past database synchronization operations
          </p>
        </div>

        {/* History Table */}
        <SyncHistoryTable defaultPageSize={25} />
      </div>
    </div>
  );
}
