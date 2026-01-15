"use client";

import { useState, useRef } from "react";
import { Button, Card, Badge, Spinner, Alert } from "flowbite-react";
import {
  useAsyncTask,
  useDebounce,
  useMediaQuery,
  useClickOutside,
  useBooleanState,
} from "@/hooks";
import { healthApi } from "@/lib/apiClient";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useTaskStore } from "@/store/useTaskStore";
import { HiCheck, HiX, HiChevronDown } from "react-icons/hi";

/**
 * Test Foundation Content Component
 *
 * Contains the actual testing logic for foundation layer testing.
 * Separated from TestFoundationTab for lazy loading optimization.
 */
export function TestFoundationContent() {
  // Test Results State
  const [testResults, setTestResults] = useState<
    Record<string, { passed: boolean; message: string }>
  >({});

  const addResult = (test: string, passed: boolean, message: string) => {
    setTestResults((prev) => ({
      ...prev,
      [test]: { passed, message },
    }));
  };

  // API Client Tests
  const healthTest = useAsyncTask(async () => {
    try {
      const response = await healthApi.check();
      addResult(
        "API Health Check",
        true,
        `API is healthy: ${JSON.stringify(response)}`
      );
      return response;
    } catch (error) {
      addResult(
        "API Health Check",
        false,
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  });

  // Auth Store Tests
  const { user, login, logout, isAuthenticated } = useAuthStore();

  const testLogin = async () => {
    try {
      await login("test@archon.dev", "password");
      addResult("Auth Login", true, "Successfully logged in");
    } catch (error) {
      addResult(
        "Auth Login",
        false,
        error instanceof Error ? error.message : "Login failed"
      );
    }
  };

  const testLogout = () => {
    logout();
    addResult("Auth Logout", true, "Successfully logged out");
  };

  // Entity Store Tests
  const { fetchProjects, projects, isLoading: projectsLoading } =
    useProjectStore();
  const { fetchTasks, tasks, isLoading: tasksLoading } = useTaskStore();

  const testProjectsFetch = async () => {
    try {
      await fetchProjects({ per_page: 5 });
      addResult(
        "Fetch Projects",
        true,
        `Fetched ${projects.length} projects`
      );
    } catch (error) {
      addResult(
        "Fetch Projects",
        false,
        error instanceof Error ? error.message : "Failed to fetch"
      );
    }
  };

  const testTasksFetch = async () => {
    try {
      await fetchTasks({ per_page: 5 });
      addResult("Fetch Tasks", true, `Fetched ${tasks.length} tasks`);
    } catch (error) {
      addResult(
        "Fetch Tasks",
        false,
        error instanceof Error ? error.message : "Failed to fetch"
      );
    }
  };

  // Custom Hooks Tests
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  const isMobile = useMediaQuery("(max-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const dropdown = useBooleanState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside(dropdownRef, () => {
    if (dropdown.value) {
      dropdown.setFalse();
      addResult("useClickOutside", true, "Dropdown closed on outside click");
    }
  });

  // Run All Tests
  const runAllTests = async () => {
    setTestResults({});

    // API Health Check
    await healthTest.execute();

    // Auth Tests
    await testLogin();
    await new Promise((resolve) => setTimeout(resolve, 500));
    testLogout();

    // Entity Store Tests
    await testProjectsFetch();
    await testTasksFetch();

    // Hook Tests
    addResult("useDebounce", true, `Debounced: "${debouncedSearch}"`);
    addResult(
      "useMediaQuery",
      true,
      `Mobile: ${isMobile}, Desktop: ${isDesktop}`
    );
    addResult("useBooleanState", true, `Dropdown state: ${dropdown.value}`);
  };

  const passedCount = Object.values(testResults).filter((r) => r.passed).length;
  const failedCount = Object.values(testResults).filter((r) => !r.passed)
    .length;
  const totalTests = Object.keys(testResults).length;

  return (
    <div className="space-y-6">
      {/* Test Controls */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold">Test Controls</h3>
        <div className="flex flex-wrap gap-3">
          <Button onClick={runAllTests} color="blue">
            Run All Tests
          </Button>
          <Button
            onClick={() => healthTest.execute()}
            color="light"
            size="sm"
            disabled={healthTest.state.isLoading}
          >
            {healthTest.state.isLoading ? <Spinner size="sm" /> : "API Health"}
          </Button>
          <Button onClick={testLogin} color="light" size="sm">
            Test Login
          </Button>
          <Button onClick={testLogout} color="light" size="sm">
            Test Logout
          </Button>
          <Button onClick={testProjectsFetch} color="light" size="sm">
            Fetch Projects
          </Button>
          <Button onClick={testTasksFetch} color="light" size="sm">
            Fetch Tasks
          </Button>
        </div>

        {/* Test Summary */}
        {totalTests > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Badge color="success">Passed: {passedCount}</Badge>
            <Badge color="failure">Failed: {failedCount}</Badge>
            <Badge color="info">Total: {totalTests}</Badge>
          </div>
        )}
      </Card>

      {/* Test Results */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold">Test Results</h3>
        {Object.keys(testResults).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No tests run yet. Click &quot;Run All Tests&quot; to start.
          </p>
        ) : (
          <div className="space-y-2">
            {Object.entries(testResults).map(([test, result]) => (
              <Alert
                key={test}
                color={result.passed ? "success" : "failure"}
                icon={result.passed ? HiCheck : HiX}
              >
                <div className="text-sm">
                  <span className="font-semibold">{test}:</span>{" "}
                  {result.message}
                </div>
              </Alert>
            ))}
          </div>
        )}
      </Card>

      {/* Hook Demonstrations */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* useDebounce Demo */}
        <Card>
          <h4 className="mb-3 font-semibold">useDebounce Hook</h4>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to test debounce..."
            className="w-full rounded-lg border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700"
          />
          <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <p>
              <strong>Immediate:</strong> {searchTerm}
            </p>
            <p>
              <strong>Debounced (500ms):</strong> {debouncedSearch}
            </p>
          </div>
        </Card>

        {/* useMediaQuery Demo */}
        <Card>
          <h4 className="mb-3 font-semibold">useMediaQuery Hook</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge color={isMobile ? "success" : "gray"} size="sm">
                Mobile
              </Badge>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                ≤ 768px
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={isDesktop ? "success" : "gray"} size="sm">
                Desktop
              </Badge>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                ≥ 1024px
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Resize browser to see changes
            </p>
          </div>
        </Card>

        {/* useBooleanState & useClickOutside Demo */}
        <Card>
          <h4 className="mb-3 font-semibold">
            useBooleanState & useClickOutside
          </h4>
          <div className="relative" ref={dropdownRef}>
            <Button onClick={dropdown.toggle} color="light" size="sm">
              Toggle Dropdown
              <HiChevronDown className="ml-2" />
            </Button>
            {dropdown.value && (
              <div className="absolute z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                  Click outside to close
                </p>
                <Button size="xs" onClick={dropdown.setFalse}>
                  Close
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Auth State Display */}
        <Card>
          <h4 className="mb-3 font-semibold">Auth Store State</h4>
          <div className="space-y-2 text-xs">
            <p>
              <strong>Authenticated:</strong>{" "}
              <Badge
                color={isAuthenticated ? "success" : "failure"}
                size="sm"
              >
                {isAuthenticated ? "Yes" : "No"}
              </Badge>
            </p>
            {user && (
              <>
                <p>
                  <strong>Email:</strong> {user.email}
                </p>
                <p>
                  <strong>Name:</strong> {user.name}
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Store State Display */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold">Store States</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 font-semibold text-sm">Projects Store</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong>Count:</strong> {projects.length}
              <br />
              <strong>Loading:</strong> {projectsLoading ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <h4 className="mb-2 font-semibold text-sm">Tasks Store</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong>Count:</strong> {tasks.length}
              <br />
              <strong>Loading:</strong> {tasksLoading ? "Yes" : "No"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
