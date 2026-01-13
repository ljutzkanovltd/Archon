"use client";

import { useState } from "react";
import { HiRefresh, HiTrash, HiX, HiCheckCircle } from "react-icons/hi";

interface BulkActionsBarProps {
  selectedCount: number;
  onRecrawl: () => Promise<void>;
  onDelete: () => Promise<void>;
  onClear: () => void;
  isProcessing?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onRecrawl,
  onDelete,
  onClear,
  isProcessing = false,
}: BulkActionsBarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [processingAction, setProcessingAction] = useState<
    "recrawl" | "delete" | null
  >(null);

  const handleRecrawl = async () => {
    setProcessingAction("recrawl");
    try {
      await onRecrawl();
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDelete = async () => {
    setProcessingAction("delete");
    try {
      await onDelete();
      setShowDeleteConfirm(false);
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-brand-50 dark:bg-brand-900/20 border-b-2 border-brand-200 dark:border-brand-800">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Selection info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <HiCheckCircle className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              <span className="text-base font-semibold text-gray-900 dark:text-white">
                {selectedCount} {selectedCount === 1 ? "source" : "sources"}{" "}
                selected
              </span>
            </div>

            {/* Processing indicator */}
            {processingAction && (
              <div className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-300">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-700 dark:border-brand-300" />
                <span>
                  {processingAction === "recrawl"
                    ? "Adding to queue..."
                    : "Deleting..."}
                </span>
              </div>
            )}
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-3">
            {!showDeleteConfirm ? (
              <>
                {/* Re-crawl button */}
                <button
                  onClick={handleRecrawl}
                  disabled={isProcessing || processingAction !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors dark:bg-brand-500 dark:hover:bg-brand-600"
                  title="Add selected sources to crawl queue"
                >
                  <HiRefresh
                    className={`w-5 h-5 ${
                      processingAction === "recrawl" ? "animate-spin" : ""
                    }`}
                  />
                  Re-crawl Selected ({selectedCount})
                </button>

                {/* Delete button */}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isProcessing || processingAction !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                  title="Delete selected sources and their data"
                >
                  <HiTrash className="w-5 h-5" />
                  Delete Selected ({selectedCount})
                </button>

                {/* Clear selection button */}
                <button
                  onClick={onClear}
                  disabled={isProcessing || processingAction !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 disabled:bg-gray-200 disabled:cursor-not-allowed rounded-lg transition-colors"
                  title="Clear selection"
                >
                  <HiX className="w-5 h-5" />
                  Clear
                </button>
              </>
            ) : (
              <>
                {/* Delete confirmation */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">
                    Delete {selectedCount}{" "}
                    {selectedCount === 1 ? "source" : "sources"}? This cannot
                    be undone.
                  </span>

                  {/* Confirm delete */}
                  <button
                    onClick={handleDelete}
                    disabled={processingAction !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <HiTrash
                      className={`w-5 h-5 ${
                        processingAction === "delete" ? "animate-pulse" : ""
                      }`}
                    />
                    Confirm Delete
                  </button>

                  {/* Cancel delete */}
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={processingAction !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 disabled:bg-gray-200 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
