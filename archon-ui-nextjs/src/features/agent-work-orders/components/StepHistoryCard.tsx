"use client";

/**
 * Step History Card Component
 *
 * Displays expandable step details with human-in-loop support, markdown rendering,
 * and edit/preview toggle. Supports collapsible cards with framer-motion animations.
 * Adapted to archon-ui-nextjs patterns using Flowbite components.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button } from "flowbite-react";
import ReactMarkdown from "react-markdown";
import {
  HiExclamationCircle,
  HiCheckCircle,
  HiChevronDown,
  HiChevronUp,
  HiPencilAlt,
  HiEye,
} from "react-icons/hi";
import { cn } from "@/lib/utils";

export interface StepHistoryCardProps {
  /** Step data with collapsible content */
  step: {
    id: string;
    stepName: string;
    timestamp: string;
    output: string;
    session: string;
    collapsible: boolean;
    isHumanInLoop?: boolean;
  };

  /** Whether the card is expanded */
  isExpanded: boolean;

  /** Toggle expansion callback */
  onToggle: () => void;

  /** Optional document for human-in-loop approval */
  document?: {
    title: string;
    content: {
      markdown: string;
    };
  };
}

export function StepHistoryCard({ step, isExpanded, onToggle, document }: StepHistoryCardProps) {
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  /**
   * Toggle between edit and preview mode
   * Initialize editedContent from document when entering edit mode
   */
  const handleToggleEdit = () => {
    if (!isEditingDocument && document && !editedContent) {
      setEditedContent(document.content.markdown);
    }
    setIsEditingDocument(!isEditingDocument);
  };

  /**
   * Handle content changes in edit mode
   */
  const handleContentChange = (value: string) => {
    setEditedContent(value);
    setHasChanges(document ? value !== document.content.markdown : false);
  };

  /**
   * Approve changes and continue to next step
   */
  const handleApproveAndContinue = () => {
    console.log("Approved and continuing to next step");
    setHasChanges(false);
    setIsEditingDocument(false);
  };

  return (
    <div
      className={cn(
        "overflow-visible rounded-lg border backdrop-blur-md",
        "bg-black/20 dark:bg-white/5",
        "border-white/10 dark:border-gray-700/30",
        // Left edge color indicator
        step.isHumanInLoop
          ? "border-l-4 border-l-orange-500 dark:border-l-orange-400"
          : "border-l-4 border-l-blue-500 dark:border-l-blue-400",
        "p-4",
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 dark:text-white">{step.stepName}</h4>
            {step.isHumanInLoop && (
              <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                <HiExclamationCircle className="h-3 w-3" aria-hidden="true" />
                Human-in-Loop
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{step.timestamp}</p>
        </div>

        {/* Collapse toggle - only show if collapsible */}
        {step.collapsible && (
          <Button
            color="gray"
            size="sm"
            onClick={onToggle}
            className={cn(
              "px-2 transition-colors",
              step.isHumanInLoop
                ? "text-orange-500 hover:text-orange-600 dark:hover:text-orange-400"
                : "text-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400",
            )}
            aria-label={isExpanded ? "Collapse step" : "Expand step"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <HiChevronUp className="h-4 w-4" /> : <HiChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Content - collapsible with animation */}
      <AnimatePresence mode="wait">
        {(isExpanded || !step.collapsible) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: {
                duration: 0.3,
                ease: [0.04, 0.62, 0.23, 0.98],
              },
              opacity: {
                duration: 0.2,
                ease: "easeInOut",
              },
            }}
            style={{ overflow: "hidden" }}
          >
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              exit={{ y: -20 }}
              transition={{
                duration: 0.2,
                ease: "easeOut",
              }}
              className="space-y-3"
            >
              {/* Output content */}
              <div
                className={cn(
                  "rounded-lg border p-4",
                  step.isHumanInLoop
                    ? "border-orange-200/50 bg-orange-50/50 dark:border-orange-800/30 dark:bg-orange-950/10"
                    : "border-cyan-200/50 bg-cyan-50/30 dark:border-cyan-800/30 dark:bg-cyan-950/10",
                )}
              >
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                  {step.output}
                </pre>
              </div>

              {/* Session info */}
              <p
                className={cn(
                  "font-mono text-xs",
                  step.isHumanInLoop ? "text-orange-600 dark:text-orange-400" : "text-cyan-600 dark:text-cyan-400",
                )}
              >
                {step.session}
              </p>

              {/* Review and Approve Plan - only for human-in-loop steps with documents */}
              {step.isHumanInLoop && document && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Review and Approve Plan</h4>

                  {/* Document Card */}
                  <div className="overflow-visible rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur-md dark:border-gray-700/30 dark:bg-white/5">
                    {/* View/Edit toggle in top right */}
                    <div className="mb-3 flex items-center justify-end">
                      <Button
                        color="gray"
                        size="sm"
                        onClick={handleToggleEdit}
                        className="text-gray-600 hover:bg-gray-500/10 dark:text-gray-400"
                        aria-label={isEditingDocument ? "Switch to preview mode" : "Switch to edit mode"}
                      >
                        {isEditingDocument ? (
                          <HiEye className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <HiPencilAlt className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>

                    {isEditingDocument ? (
                      <div className="space-y-4">
                        <textarea
                          value={editedContent}
                          onChange={(e) => handleContentChange(e.target.value)}
                          className={cn(
                            "min-h-[300px] w-full resize-y rounded-lg p-4",
                            "border border-gray-300 dark:border-gray-700",
                            "bg-white/50 dark:bg-black/30",
                            "font-mono text-sm text-gray-900 dark:text-white",
                            "focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20",
                          )}
                          placeholder="Enter markdown content..."
                        />
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          components={{
                            h1: ({ node, ...props }) => (
                              <h1 className="mb-3 mt-4 text-xl font-bold text-gray-900 dark:text-white" {...props} />
                            ),
                            h2: ({ node, ...props }) => (
                              <h2 className="mb-2 mt-3 text-lg font-semibold text-gray-900 dark:text-white" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                              <h3
                                className="mb-2 mt-3 text-base font-semibold text-gray-900 dark:text-white"
                                {...props}
                              />
                            ),
                            p: ({ node, ...props }) => (
                              <p className="mb-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300" {...props} />
                            ),
                            ul: ({ node, ...props }) => (
                              <ul
                                className="mb-2 list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-gray-300"
                                {...props}
                              />
                            ),
                            li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                            code: ({ node, ...props }) => (
                              <code
                                className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-orange-600 dark:bg-gray-800 dark:text-orange-400"
                                {...props}
                              />
                            ),
                          }}
                        >
                          {/* Prefer displaying live draft (editedContent) when non-empty/hasChanges over original document content */}
                          {editedContent && hasChanges ? editedContent : document.content.markdown}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Approve button - always visible with glass styling */}
                    <div className="mt-4 flex items-center justify-between border-t border-gray-200/50 pt-4 dark:border-gray-700/30">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {hasChanges ? "Unsaved changes" : "No changes"}
                      </p>
                      <Button
                        onClick={handleApproveAndContinue}
                        className={cn(
                          "backdrop-blur-md",
                          "bg-gradient-to-b from-green-100/80 to-white/60",
                          "dark:from-green-500/20 dark:to-green-500/10",
                          "border border-green-300/50 shadow-lg shadow-green-500/20 dark:border-green-500/50",
                          "text-green-700 dark:text-green-100",
                          "hover:from-green-200/90 hover:to-green-100/70 hover:shadow-[0_0_20px_rgba(34,197,94,0.5)]",
                          "dark:hover:from-green-400/30 dark:hover:to-green-500/20 dark:hover:shadow-[0_0_25px_rgba(34,197,94,0.7)]",
                        )}
                      >
                        <HiCheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                        Approve and Move to Next Step
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
