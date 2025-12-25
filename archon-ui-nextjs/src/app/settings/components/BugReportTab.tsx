"use client";

import React, { useState } from "react";
import { HiExclamationCircle, HiBug } from "react-icons/hi";

interface BugReport {
  title: string;
  description: string;
  steps: string;
  expected: string;
  actual: string;
}

export default function BugReportTab() {
  const [report, setReport] = useState<BugReport>({
    title: "",
    description: "",
    steps: "",
    expected: "",
    actual: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Collect system context
    const systemInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timestamp: new Date().toISOString(),
    };

    const fullReport = {
      ...report,
      systemInfo,
    };

    console.log("Bug Report:", fullReport);

    // TODO: Send to backend endpoint for GitHub Issues integration
    // For now, just simulate submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setSubmitting(false);
    setSubmitted(true);

    // Reset form after 3 seconds
    setTimeout(() => {
      setReport({
        title: "",
        description: "",
        steps: "",
        expected: "",
        actual: "",
      });
      setSubmitted(false);
    }, 3000);
  };

  const isFormValid =
    report.title.trim() !== "" && report.description.trim() !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bug Report
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Report bugs or issues with Archon. Your feedback helps improve the platform.
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex gap-3">
          <HiExclamationCircle className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium">Privacy Protection</p>
            <p className="mt-1">
              System information (browser, OS, screen resolution) will be included
              automatically. Do not include sensitive information like API keys,
              passwords, or personal data.
            </p>
          </div>
        </div>
      </div>

      {/* Bug Report Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Bug Title *
          </label>
          <input
            type="text"
            id="title"
            value={report.title}
            onChange={(e) => setReport({ ...report, title: e.target.value })}
            placeholder="Brief description of the issue"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Description *
          </label>
          <textarea
            id="description"
            value={report.description}
            onChange={(e) =>
              setReport({ ...report, description: e.target.value })
            }
            placeholder="Detailed description of the bug"
            rows={4}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            required
          />
        </div>

        {/* Steps to Reproduce */}
        <div>
          <label
            htmlFor="steps"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Steps to Reproduce
          </label>
          <textarea
            id="steps"
            value={report.steps}
            onChange={(e) => setReport({ ...report, steps: e.target.value })}
            placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
            rows={4}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Expected vs Actual */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="expected"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Expected Behavior
            </label>
            <textarea
              id="expected"
              value={report.expected}
              onChange={(e) =>
                setReport({ ...report, expected: e.target.value })
              }
              placeholder="What should happen"
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="actual"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Actual Behavior
            </label>
            <textarea
              id="actual"
              value={report.actual}
              onChange={(e) => setReport({ ...report, actual: e.target.value })}
              placeholder="What actually happens"
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isFormValid || submitting || submitted}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Submitting...
              </>
            ) : submitted ? (
              <>
                <HiExclamationCircle className="h-5 w-5" />
                Submitted!
              </>
            ) : (
              <>
                <HiBug className="h-5 w-5" />
                Submit Bug Report
              </>
            )}
          </button>
        </div>
      </form>

      {/* Success Message */}
      {submitted && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <p className="text-sm text-green-800 dark:text-green-300">
            Thank you for your bug report! It has been logged and will be reviewed.
          </p>
        </div>
      )}

      {/* System Info Preview */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <h4 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
          System Information (Auto-collected)
        </h4>
        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <p>
            <span className="font-medium">Browser:</span> {navigator.userAgent.split(" ").slice(0, 3).join(" ")}...
          </p>
          <p>
            <span className="font-medium">Platform:</span> {navigator.platform}
          </p>
          <p>
            <span className="font-medium">Screen:</span> {window.screen.width}x{window.screen.height}
          </p>
        </div>
      </div>
    </div>
  );
}
