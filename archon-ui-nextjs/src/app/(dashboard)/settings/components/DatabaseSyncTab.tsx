"use client";

import React from "react";
import { SyncWizard } from "@/components/DatabaseSync/SyncWizard";
import { HiInformationCircle } from "react-icons/hi";
import { Alert } from "flowbite-react";

/**
 * Database Sync Tab Component
 *
 * Provides admin-only access to database synchronization tools
 * through the Settings interface. Embeds the SyncWizard component
 * for step-by-step database sync operations.
 */
export default function DatabaseSyncTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Database Synchronization
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Safely sync databases between local and remote Supabase instances with
          step-by-step guidance and safety confirmations.
        </p>
      </div>

      {/* Admin Notice */}
      <Alert color="info" icon={HiInformationCircle}>
        <span className="font-medium">Admin Access Required:</span> This feature
        is only available to administrators. Database synchronization operations
        can significantly impact your system and should be performed with caution.
      </Alert>

      {/* Warning Alert */}
      <Alert color="warning" icon={HiInformationCircle}>
        <span className="font-medium">Important:</span> Always create a backup
        before performing database synchronization. Review all changes carefully
        before confirming operations.
      </Alert>

      {/* Sync Wizard */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <SyncWizard />
      </div>
    </div>
  );
}
