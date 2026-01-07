"use client";

import React, { useState, useRef } from "react";
import { HiExclamationCircle, HiCamera, HiX, HiClipboard, HiExternalLink } from "react-icons/hi";
import { HiBugAnt } from "react-icons/hi2";
import { Toast } from "flowbite-react";
import { healthApi } from "@/lib/apiClient";

interface BugReport {
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  additionalContext: string;
  severity: "low" | "medium" | "high" | "critical";
  component: string;
}

interface SystemContext {
  browser: string;
  browserVersion: string;
  os: string;
  screenResolution: string;
  archonVersion: string;
  timestamp: string;
  memory: string;
  services: {
    server: boolean;
    mcp: boolean;
  };
}

interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

export default function BugReportTab() {
  const [report, setReport] = useState<BugReport>({
    title: "",
    description: "",
    stepsToReproduce: "",
    expectedBehavior: "",
    actualBehavior: "",
    additionalContext: "",
    severity: "medium",
    component: "not-sure",
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [systemContext, setSystemContext] = useState<SystemContext | null>(null);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "info" });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collect system context on mount
  React.useEffect(() => {
    collectSystemContext();
  }, []);

  const collectSystemContext = async () => {
    try {
      // Parse browser info
      const ua = navigator.userAgent;
      let browser = "Unknown";
      let browserVersion = "";

      if (ua.includes("Chrome/") && !ua.includes("Edg/")) {
        browser = "Chrome";
        browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || "";
      } else if (ua.includes("Firefox/")) {
        browser = "Firefox";
        browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || "";
      } else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
        browser = "Safari";
        browserVersion = ua.match(/Version\/(\d+)/)?.[1] || "";
      } else if (ua.includes("Edg/")) {
        browser = "Edge";
        browserVersion = ua.match(/Edg\/(\d+)/)?.[1] || "";
      }

      // Detect OS
      let os = "Unknown";
      if (ua.includes("Win")) os = "Windows";
      else if (ua.includes("Mac")) os = "macOS";
      else if (ua.includes("Linux")) os = "Linux";
      else if (ua.includes("Android")) os = "Android";
      else if (ua.includes("iOS")) os = "iOS";

      // Get memory info if available
      const memory = (performance as any).memory
        ? `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB used`
        : "unknown";

      // Check service health
      let serverHealthy = false;
      let mcpHealthy = false;

      try {
        const healthCheck = await healthApi.check();
        serverHealthy = healthCheck.status === "healthy" || healthCheck.status === "ok";
      } catch {
        serverHealthy = false;
      }

      try {
        const response = await fetch("http://localhost:8051/health");
        mcpHealthy = response.ok;
      } catch {
        mcpHealthy = false;
      }

      setSystemContext({
        browser,
        browserVersion,
        os,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        archonVersion: "v0.1.0", // TODO: Get from API
        timestamp: new Date().toISOString(),
        memory,
        services: {
          server: serverHealthy,
          mcp: mcpHealthy,
        },
      });
    } catch (error) {
      console.error("Failed to collect system context:", error);
      // Set minimal context
      setSystemContext({
        browser: "Unknown",
        browserVersion: "",
        os: navigator.platform,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        archonVersion: "v0.1.0",
        timestamp: new Date().toISOString(),
        memory: "unknown",
        services: {
          server: false,
          mcp: false,
        },
      });
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/image\/(png|jpg|jpeg|gif)/)) {
      showToast("Please upload a PNG, JPG, JPEG, or GIF file", "error");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast("Screenshot must be less than 5MB", "error");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setScreenshotPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Compress image if needed
    const compressedFile = await compressImage(file);
    setScreenshot(compressedFile);
  };

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          // Max dimensions
          const maxWidth = 1920;
          const maxHeight = 1080;

          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;

          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: "image/jpeg" }));
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            0.85
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!report.title.trim()) {
      errors.title = "Title is required";
    } else if (report.title.length > 100) {
      errors.title = "Title must be less than 100 characters";
    }

    if (!report.description.trim()) {
      errors.description = "Description is required";
    } else if (report.description.length > 1000) {
      errors.description = "Description must be less than 1000 characters";
    }

    if (!report.stepsToReproduce.trim()) {
      errors.stepsToReproduce = "Steps to reproduce are required";
    } else if (report.stepsToReproduce.length > 1000) {
      errors.stepsToReproduce = "Steps must be less than 1000 characters";
    }

    if (!report.expectedBehavior.trim()) {
      errors.expectedBehavior = "Expected behavior is required";
    } else if (report.expectedBehavior.length > 1000) {
      errors.expectedBehavior = "Expected behavior must be less than 1000 characters";
    }

    if (!report.actualBehavior.trim()) {
      errors.actualBehavior = "Actual behavior is required";
    } else if (report.actualBehavior.length > 1000) {
      errors.actualBehavior = "Actual behavior must be less than 1000 characters";
    }

    if (report.additionalContext.length > 1000) {
      errors.additionalContext = "Additional context must be less than 1000 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const showToast = (message: string, type: ToastState["type"]) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "info" }), 5000);
  };

  const formatGitHubIssueBody = (): string => {
    return `## Description
${report.description}

## Steps to Reproduce
${report.stepsToReproduce}

## Expected Behavior
${report.expectedBehavior}

## Actual Behavior
${report.actualBehavior}

${report.additionalContext ? `## Additional Context\n${report.additionalContext}\n\n` : ""}## System Information
- **Version:** ${systemContext?.archonVersion}
- **Browser:** ${systemContext?.browser} ${systemContext?.browserVersion}
- **OS:** ${systemContext?.os}
- **Screen Resolution:** ${systemContext?.screenResolution}
- **Memory:** ${systemContext?.memory}
- **Timestamp:** ${systemContext?.timestamp}

## Service Status
- **Server:** ${systemContext?.services.server ? "✅" : "❌"}
- **MCP:** ${systemContext?.services.mcp ? "✅" : "❌"}

## Bug Details
- **Severity:** ${report.severity}
- **Component:** ${report.component}

${screenshot ? "📷 Screenshot attached" : ""}

---
*Generated by Archon Bug Reporter*`;
  };

  const copyToClipboard = async () => {
    const issueBody = formatGitHubIssueBody();
    try {
      await navigator.clipboard.writeText(issueBody);
      showToast("Bug report template copied to clipboard", "success");
    } catch (error) {
      showToast("Failed to copy to clipboard", "error");
    }
  };

  const openGitHubIssue = () => {
    if (!validateForm()) {
      showToast("Please fix validation errors before submitting", "error");
      return;
    }

    const title = encodeURIComponent(`🐛 ${report.title}`);
    const body = encodeURIComponent(formatGitHubIssueBody());
    const labels = encodeURIComponent(`bug,${report.severity},${report.component}`);

    // TODO: Update with actual GitHub repo URL
    const githubUrl = `https://github.com/your-org/archon/issues/new?title=${title}&body=${body}&labels=${labels}`;

    window.open(githubUrl, "_blank");
    showToast("Opening GitHub issue form...", "success");

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      resetForm();
    }, 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast("Please fix validation errors", "error");
      return;
    }

    setSubmitting(true);

    try {
      // TODO: Implement backend bug report submission
      // For now, just open GitHub issue
      await new Promise((resolve) => setTimeout(resolve, 500));
      openGitHubIssue();
    } catch (error) {
      showToast("Failed to submit bug report", "error");
      console.error("Bug report submission error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setReport({
      title: "",
      description: "",
      stepsToReproduce: "",
      expectedBehavior: "",
      actualBehavior: "",
      additionalContext: "",
      severity: "medium",
      component: "not-sure",
    });
    removeScreenshot();
    setValidationErrors({});
  };

  const isFormValid =
    report.title.trim() !== "" &&
    report.description.trim() !== "" &&
    report.stepsToReproduce.trim() !== "" &&
    report.expectedBehavior.trim() !== "" &&
    report.actualBehavior.trim() !== "" &&
    Object.keys(validationErrors).length === 0;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50">
          <Toast>
            <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              toast.type === "success" ? "bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200" :
              toast.type === "error" ? "bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200" :
              toast.type === "warning" ? "bg-orange-100 text-orange-500 dark:bg-orange-800 dark:text-orange-200" :
              "bg-blue-100 text-blue-500 dark:bg-blue-800 dark:text-blue-200"
            }`}>
              {toast.type === "success" && "✓"}
              {toast.type === "error" && "✕"}
              {toast.type === "warning" && "⚠"}
              {toast.type === "info" && "ℹ"}
            </div>
            <div className="ml-3 text-sm font-normal">{toast.message}</div>
            <Toast.Toggle onClick={() => setToast({ ...toast, show: false })} />
          </Toast>
        </div>
      )}

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
            <p className="font-medium">Privacy & Data Collection</p>
            <p className="mt-1">
              The following information will be automatically collected and included in your bug report:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Browser name and version</li>
              <li>Operating system</li>
              <li>Screen resolution</li>
              <li>Archon version</li>
              <li>Memory usage (if available)</li>
              <li>Service health status</li>
            </ul>
            <p className="mt-2 font-medium">
              ⚠️ Do not include sensitive information like API keys, passwords, or personal data.
            </p>
          </div>
        </div>
      </div>

      {/* Bug Report Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Severity & Component */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="severity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Severity
            </label>
            <select
              id="severity"
              value={report.severity}
              onChange={(e) => setReport({ ...report, severity: e.target.value as BugReport["severity"] })}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="low">🟢 Low - Minor inconvenience</option>
              <option value="medium">🟡 Medium - Affects functionality</option>
              <option value="high">🟠 High - Blocks important features</option>
              <option value="critical">🔴 Critical - App unusable</option>
            </select>
          </div>

          <div>
            <label htmlFor="component" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Component
            </label>
            <select
              id="component"
              value={report.component}
              onChange={(e) => setReport({ ...report, component: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="knowledge-base">🔍 Knowledge Base / RAG</option>
              <option value="mcp-integration">🔗 MCP Integration</option>
              <option value="projects-tasks">📋 Projects & Tasks</option>
              <option value="settings">⚙️ Settings & Configuration</option>
              <option value="ui">🖥️ User Interface</option>
              <option value="infrastructure">🐳 Docker / Infrastructure</option>
              <option value="not-sure">❓ Not Sure</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bug Title *
            <span className="ml-2 text-xs text-gray-500">({report.title.length}/100)</span>
          </label>
          <input
            type="text"
            id="title"
            value={report.title}
            onChange={(e) => setReport({ ...report, title: e.target.value })}
            placeholder="Brief description of the issue"
            maxLength={100}
            className={`mt-1 w-full rounded-lg border ${
              validationErrors.title ? "border-red-500" : "border-gray-300"
            } bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white`}
            required
          />
          {validationErrors.title && (
            <p className="mt-1 text-xs text-red-500">{validationErrors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            What were you trying to do? *
            <span className="ml-2 text-xs text-gray-500">({report.description.length}/1000)</span>
          </label>
          <textarea
            id="description"
            value={report.description}
            onChange={(e) => setReport({ ...report, description: e.target.value })}
            placeholder="I was trying to crawl a documentation site when..."
            rows={4}
            maxLength={1000}
            className={`mt-1 w-full rounded-lg border ${
              validationErrors.description ? "border-red-500" : "border-gray-300"
            } bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white`}
            required
          />
          {validationErrors.description && (
            <p className="mt-1 text-xs text-red-500">{validationErrors.description}</p>
          )}
        </div>

        {/* Steps to Reproduce */}
        <div>
          <label htmlFor="stepsToReproduce" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Steps to Reproduce *
            <span className="ml-2 text-xs text-gray-500">({report.stepsToReproduce.length}/1000)</span>
          </label>
          <textarea
            id="stepsToReproduce"
            value={report.stepsToReproduce}
            onChange={(e) => setReport({ ...report, stepsToReproduce: e.target.value })}
            placeholder="1. Go to Knowledge Base page&#10;2. Click Add Knowledge&#10;3. Enter URL...&#10;4. Error occurs"
            rows={4}
            maxLength={1000}
            className={`mt-1 w-full rounded-lg border ${
              validationErrors.stepsToReproduce ? "border-red-500" : "border-gray-300"
            } bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white`}
            required
          />
          {validationErrors.stepsToReproduce && (
            <p className="mt-1 text-xs text-red-500">{validationErrors.stepsToReproduce}</p>
          )}
        </div>

        {/* Expected vs Actual */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="expectedBehavior" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Expected Behavior *
              <span className="ml-2 text-xs text-gray-500">({report.expectedBehavior.length}/1000)</span>
            </label>
            <textarea
              id="expectedBehavior"
              value={report.expectedBehavior}
              onChange={(e) => setReport({ ...report, expectedBehavior: e.target.value })}
              placeholder="What should have happened?"
              rows={3}
              maxLength={1000}
              className={`mt-1 w-full rounded-lg border ${
                validationErrors.expectedBehavior ? "border-red-500" : "border-gray-300"
              } bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white`}
              required
            />
            {validationErrors.expectedBehavior && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.expectedBehavior}</p>
            )}
          </div>

          <div>
            <label htmlFor="actualBehavior" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Actual Behavior *
              <span className="ml-2 text-xs text-gray-500">({report.actualBehavior.length}/1000)</span>
            </label>
            <textarea
              id="actualBehavior"
              value={report.actualBehavior}
              onChange={(e) => setReport({ ...report, actualBehavior: e.target.value })}
              placeholder="What actually happened?"
              rows={3}
              maxLength={1000}
              className={`mt-1 w-full rounded-lg border ${
                validationErrors.actualBehavior ? "border-red-500" : "border-gray-300"
              } bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white`}
              required
            />
            {validationErrors.actualBehavior && (
              <p className="mt-1 text-xs text-red-500">{validationErrors.actualBehavior}</p>
            )}
          </div>
        </div>

        {/* Additional Context */}
        <div>
          <label htmlFor="additionalContext" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Additional Context (Optional)
            <span className="ml-2 text-xs text-gray-500">({report.additionalContext.length}/1000)</span>
          </label>
          <textarea
            id="additionalContext"
            value={report.additionalContext}
            onChange={(e) => setReport({ ...report, additionalContext: e.target.value })}
            placeholder="Any other details that might be relevant..."
            rows={3}
            maxLength={1000}
            className={`mt-1 w-full rounded-lg border ${
              validationErrors.additionalContext ? "border-red-500" : "border-gray-300"
            } bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white`}
          />
          {validationErrors.additionalContext && (
            <p className="mt-1 text-xs text-red-500">{validationErrors.additionalContext}</p>
          )}
        </div>

        {/* Screenshot Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Screenshot (Optional)
          </label>

          {!screenshotPreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-brand-500 transition-colors"
            >
              <HiCamera className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click to upload a screenshot
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                PNG, JPG, JPEG, or GIF (max 5MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.gif"
                onChange={handleScreenshotUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div className="relative">
              <img
                src={screenshotPreview}
                alt="Screenshot preview"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600"
              />
              <button
                type="button"
                onClick={removeScreenshot}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <HiX className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={copyToClipboard}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isFormValid}
          >
            <HiClipboard className="h-5 w-5" />
            Copy to Clipboard
          </button>

          <button
            type="submit"
            disabled={!isFormValid || submitting || submitted}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating Issue...
              </>
            ) : submitted ? (
              <>
                <HiExclamationCircle className="h-5 w-5" />
                Submitted!
              </>
            ) : (
              <>
                <HiExternalLink className="h-5 w-5" />
                Open GitHub Issue
              </>
            )}
          </button>
        </div>
      </form>

      {/* Success Message */}
      {submitted && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <HiBugAnt className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-green-800 dark:text-green-300">
                Bug Report Submitted!
              </p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Thank you for helping improve Archon. Maintainers will review your report.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* System Info Preview */}
      {systemContext && (
        <details className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400">
            System Information (Auto-collected)
          </summary>
          <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-medium">Version:</span> {systemContext.archonVersion}
              </div>
              <div>
                <span className="font-medium">Browser:</span> {systemContext.browser} {systemContext.browserVersion}
              </div>
              <div>
                <span className="font-medium">OS:</span> {systemContext.os}
              </div>
              <div>
                <span className="font-medium">Screen:</span> {systemContext.screenResolution}
              </div>
              <div>
                <span className="font-medium">Memory:</span> {systemContext.memory}
              </div>
              <div>
                <span className="font-medium">Timestamp:</span> {new Date(systemContext.timestamp).toLocaleString()}
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="font-medium">Service Status:</span>
              <div className="flex gap-4 mt-1">
                <span>Server: {systemContext.services.server ? "✅" : "❌"}</span>
                <span>MCP: {systemContext.services.mcp ? "✅" : "❌"}</span>
              </div>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
