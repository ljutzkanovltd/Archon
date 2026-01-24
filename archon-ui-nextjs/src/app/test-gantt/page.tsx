"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import "@svar-ui/react-gantt/style.css";

// Disable SSR for Gantt
const GanttChart = dynamic(
  () => import("@/features/projects/components/GanttChart").then((mod) => mod.GanttChart),
  { ssr: false }
);

/**
 * Minimal Test Page for SVAR Gantt
 *
 * Tests two scenarios:
 * 1. Flat structure with parent references (current implementation)
 * 2. Nested hierarchical structure (proposed fix)
 */
export default function TestGanttPage() {
  const [testType, setTestType] = useState<"flat" | "nested">("flat");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Test 1: Flat structure with parent references (CURRENT)
  const flatData = [
    {
      id: "sprint-1",
      text: "Sprint 1",
      start: new Date(2026, 0, 20),
      end: new Date(2026, 1, 3),
      duration: 14,
      data: [], // Empty - children reference via parent
      type: "summary" as const,
      open: true,
    },
    {
      id: "task-1",
      text: "Task 1",
      start: new Date(2026, 0, 20),
      end: new Date(2026, 0, 22),
      duration: 2,
      data: [],
      type: "task" as const,
      parent: "sprint-1", // References parent
      progress: 50,
    },
    {
      id: "task-2",
      text: "Task 2",
      start: new Date(2026, 0, 23),
      end: new Date(2026, 0, 25),
      duration: 2,
      data: [],
      type: "task" as const,
      parent: "sprint-1",
      progress: 80,
    },
  ];

  // Test 2: Nested hierarchical structure (PROPOSED FIX)
  const nestedData = [
    {
      id: "sprint-1",
      text: "Sprint 1",
      start: new Date(2026, 0, 20),
      end: new Date(2026, 1, 3),
      duration: 14,
      data: [ // Children nested inside
        {
          id: "task-1",
          text: "Task 1",
          start: new Date(2026, 0, 20),
          end: new Date(2026, 0, 22),
          duration: 2,
          data: [],
          type: "task" as const,
          progress: 50,
        },
        {
          id: "task-2",
          text: "Task 2",
          start: new Date(2026, 0, 23),
          end: new Date(2026, 0, 25),
          duration: 2,
          data: [],
          type: "task" as const,
          progress: 80,
        },
      ],
      type: "summary" as const,
      open: true,
    },
  ];

  const scales = [
    { unit: "month", step: 1, format: "MMMM yyyy" },
    { unit: "day", step: 1, format: "d" },
  ];

  const columns = [
    { name: "text", label: "Task Name", width: 250, resize: true },
    { name: "start", label: "Start", align: "center" as const, width: 100 },
    { name: "duration", label: "Duration", align: "center" as const, width: 80 },
  ];

  const currentData = testType === "flat" ? flatData : nestedData;

  console.log(`[TestGantt] Testing ${testType} structure:`, JSON.stringify(currentData, null, 2));

  if (!isClient) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            SVAR Gantt Test Page
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Testing flat vs nested data structures
          </p>
        </div>

        {/* Test Type Selector */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setTestType("flat")}
            className={`rounded-lg px-4 py-2 font-medium transition ${
              testType === "flat"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            Flat Structure (Current)
          </button>
          <button
            onClick={() => setTestType("nested")}
            className={`rounded-lg px-4 py-2 font-medium transition ${
              testType === "nested"
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            Nested Structure (Proposed Fix)
          </button>
        </div>

        {/* Instructions */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-100">
            Test Instructions:
          </h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-blue-800 dark:text-blue-200">
            <li>Open browser DevTools console (F12)</li>
            <li>Switch between Flat and Nested structure buttons</li>
            <li>Check console for errors (especially "forEach null")</li>
            <li>Verify which structure renders correctly</li>
            <li>Check if tasks appear nested under Sprint 1</li>
          </ol>
        </div>

        {/* Gantt Chart */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Testing: {testType === "flat" ? "Flat Structure (parent refs)" : "Nested Structure (children in data)"}
          </h2>
          <div className="h-[500px] w-full">
            <GanttChart
              tasks={currentData}
              links={[]}
              scales={scales}
              columns={columns}
              cellWidth={50}
              cellHeight={40}
              readonly={false}
            />
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
            Debug Information:
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Structure Type:</span>{" "}
              <span className="text-gray-600 dark:text-gray-400">{testType}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Top-level items:</span>{" "}
              <span className="text-gray-600 dark:text-gray-400">{currentData.length}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Sprint 1 children:</span>{" "}
              <span className="text-gray-600 dark:text-gray-400">
                {testType === "nested" ? currentData[0].data.length : "N/A (flat structure)"}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Check console:</span>{" "}
              <span className="text-gray-600 dark:text-gray-400">
                Data structure logged as JSON
              </span>
            </div>
          </div>
        </div>

        {/* Expected Results */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
            Expected Results:
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-medium text-gray-700 dark:text-gray-300">
                Flat Structure:
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
                <li>❌ May cause "forEach null" error</li>
                <li>❌ Tasks might not nest correctly</li>
                <li>⚠️ Current implementation (broken)</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-medium text-gray-700 dark:text-gray-300">
                Nested Structure:
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
                <li>✅ Should render without errors</li>
                <li>✅ Tasks properly nested under sprint</li>
                <li>✅ Proposed fix solution</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
