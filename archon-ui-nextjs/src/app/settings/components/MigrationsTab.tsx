"use client";

import React, { useState, useEffect } from "react";
import {
  HiDatabase,
  HiRefresh,
  HiCheckCircle,
  HiExclamationTriangle,
  HiX,
  HiClipboardCopy,
  HiExternalLink,
} from "react-icons/hi";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface MigrationRecord {
  version: string;
  migration_name: string;
  applied_at: string;
  checksum?: string | null;
}

interface PendingMigration {
  version: string;
  name: string;
  sql_content: string;
  file_path: string;
  checksum?: string | null;
}

interface MigrationStatusResponse {
  pending_migrations: PendingMigration[];
  applied_migrations: MigrationRecord[];
  has_pending: boolean;
  bootstrap_required: boolean;
  current_version: string;
  pending_count: number;
  applied_count: number;
}

interface MigrationHistoryResponse {
  migrations: MigrationRecord[];
  total_count: number;
  current_version: string;
}

// ============================================================================
// Migration Service
// ============================================================================

class MigrationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181";
  }

  async getMigrationStatus(): Promise<MigrationStatusResponse> {
    const response = await fetch(`${this.baseUrl}/api/migrations/status`);
    if (!response.ok) {
      throw new Error(`Failed to get migration status: ${response.statusText}`);
    }
    return response.json();
  }

  async getMigrationHistory(): Promise<MigrationHistoryResponse> {
    const response = await fetch(`${this.baseUrl}/api/migrations/history`);
    if (!response.ok) {
      throw new Error(`Failed to get migration history: ${response.statusText}`);
    }
    return response.json();
  }

  async getPendingMigrations(): Promise<PendingMigration[]> {
    const response = await fetch(`${this.baseUrl}/api/migrations/pending`);
    if (!response.ok) {
      throw new Error(`Failed to get pending migrations: ${response.statusText}`);
    }
    return response.json();
  }
}

const migrationService = new MigrationService();

// ============================================================================
// Pending Migrations Modal Component
// ============================================================================

interface PendingMigrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  migrations: PendingMigration[];
  onRefresh: () => void;
}

const PendingMigrationsModal: React.FC<PendingMigrationsModalProps> = ({
  isOpen,
  onClose,
  migrations,
  onRefresh,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopy = async (sql: string, index: number) => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopiedIndex(index);
      showToast("SQL copied to clipboard", "success");
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      showToast("Failed to copy SQL", "error");
    }
  };

  const handleCopyAll = async () => {
    try {
      const allSql = migrations.map((m) => `-- ${m.name}\n${m.sql_content}`).join("\n\n");
      await navigator.clipboard.writeText(allSql);
      showToast("All migration SQL copied to clipboard", "success");
    } catch (error) {
      showToast("Failed to copy SQL", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <HiDatabase className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Pending Database Migrations
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <HiX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Instructions */}
        <div className="p-6 bg-blue-50 dark:bg-blue-500/10 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-blue-600 dark:text-blue-400 font-medium mb-2 flex items-center gap-2">
            <HiExternalLink className="w-4 h-4" />
            How to Apply Migrations
          </h3>
          <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
            <li>Copy the SQL for each migration below</li>
            <li>Open your Supabase dashboard SQL Editor</li>
            <li>Paste and execute each migration in order</li>
            <li>Click "Refresh Status" below to verify migrations were applied</li>
          </ol>
          {migrations.length > 1 && (
            <button
              type="button"
              onClick={handleCopyAll}
              className="mt-3 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-blue-600 dark:text-blue-400 text-sm font-medium transition-colors"
            >
              Copy All Migrations
            </button>
          )}
        </div>

        {/* Migration List */}
        <div className="overflow-y-auto max-h-[calc(80vh-280px)] p-6">
          {migrations.length === 0 ? (
            <div className="text-center py-8">
              <HiCheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-gray-300">All migrations have been applied!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {migrations.map((migration, index) => (
                <div
                  key={`${migration.version}-${migration.name}`}
                  className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-gray-900 dark:text-white font-medium">{migration.name}</h4>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                          Version: {migration.version} • {migration.file_path}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(migration.sql_content, index)}
                          className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 transition-colors"
                        >
                          {copiedIndex === index ? (
                            <>
                              <HiCheckCircle className="w-4 h-4 text-green-500" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <HiClipboardCopy className="w-4 h-4" />
                              Copy SQL
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                          className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
                        >
                          {expandedIndex === index ? "Hide" : "Show"} SQL
                        </button>
                      </div>
                    </div>

                    {/* SQL Content */}
                    {expandedIndex === index && (
                      <div className="mt-3">
                        <pre className="p-3 bg-gray-900 dark:bg-black border border-gray-700 rounded text-xs text-gray-300 overflow-x-auto">
                          <code>{migration.sql_content}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-purple-600 dark:text-purple-400 font-medium transition-colors"
          >
            Refresh Status
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Migrations Tab Component
// ============================================================================

export default function MigrationsTab() {
  const [status, setStatus] = useState<MigrationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadMigrationStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await migrationService.getMigrationStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load migration status");
      console.error("Error loading migration status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadMigrationStatus();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMigrationStatus();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Database Migrations
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage database schema migrations and track migration history
        </p>
      </div>

      {/* Migration Status Card */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <HiDatabase className="w-5 h-5 text-purple-500" />
            <h3 className="text-gray-900 dark:text-white font-semibold">Migration Status</h3>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Refresh migration status"
          >
            <HiRefresh
              className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${
                loading || refreshing ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-sm">Applied Migrations</span>
            <span className="text-gray-900 dark:text-white font-mono text-sm">
              {status?.applied_count ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-sm">Pending Migrations</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-900 dark:text-white font-mono text-sm">
                {status?.pending_count ?? 0}
              </span>
              {status && status.pending_count > 0 && (
                <HiExclamationTriangle className="w-4 h-4 text-yellow-500" />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400 text-sm">Status</span>
            <div className="flex items-center gap-2">
              {loading ? (
                <>
                  <HiRefresh className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-blue-500 text-sm">Checking...</span>
                </>
              ) : error ? (
                <>
                  <HiExclamationTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-red-500 text-sm">Error loading</span>
                </>
              ) : status?.bootstrap_required ? (
                <>
                  <HiExclamationTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-yellow-500 text-sm">Setup required</span>
                </>
              ) : status?.has_pending ? (
                <>
                  <HiExclamationTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-yellow-500 text-sm">Migrations pending</span>
                </>
              ) : (
                <>
                  <HiCheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-green-500 text-sm">Up to date</span>
                </>
              )}
            </div>
          </div>

          {status?.current_version && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Database Version</span>
              <span className="text-gray-900 dark:text-white font-mono text-sm">
                {status.current_version}
              </span>
            </div>
          )}
        </div>

        {status?.has_pending && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg">
            <p className="text-yellow-700 dark:text-yellow-400 text-sm mb-2">
              {status.bootstrap_required
                ? "Initial database setup is required."
                : `${status.pending_count} migration${status.pending_count > 1 ? "s" : ""} need to be applied.`}
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded text-yellow-600 dark:text-yellow-400 text-sm font-medium transition-colors"
            >
              View Pending Migrations
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
            <p className="text-red-700 dark:text-red-400 text-sm">
              Failed to load migration status. Please check your database connection.
            </p>
          </div>
        )}
      </div>

      {/* Migration History */}
      {status && status.applied_count > 0 && (
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-gray-900 dark:text-white font-semibold mb-4">
            Recent Migrations
          </h3>
          <div className="space-y-2">
            {status.applied_migrations.slice(0, 5).map((migration) => (
              <div
                key={`${migration.version}-${migration.migration_name}`}
                className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {migration.migration_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Version {migration.version}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(migration.applied_at).toLocaleDateString()}
                  </p>
                  <HiCheckCircle className="w-4 h-4 text-green-500 ml-auto mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for viewing pending migrations */}
      {status && (
        <PendingMigrationsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          migrations={status.pending_migrations}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
