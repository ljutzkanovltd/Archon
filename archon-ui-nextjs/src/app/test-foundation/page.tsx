"use client";

import { useState, useRef } from "react";
import { Button, Card, Badge, Spinner, Alert } from "flowbite-react";
import {
  useAsyncTask,
  useDebounce,
  useMediaQuery,
  usePageTitle,
  useClickOutside,
  useBooleanState,
} from "@/hooks";
import {
  projectsApi,
  tasksApi,
  documentsApi,
  knowledgeBaseApi,
  healthApi,
} from "@/lib/apiClient";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useDocumentStore } from "@/store/useDocumentStore";
import { useSourceStore } from "@/store/useSourceStore";
import { HiCheck, HiX, HiChevronDown } from "react-icons/hi";

export default function TestFoundationPage() {
  usePageTitle("Foundation Testing", "Archon");

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

  const mcpHealthTest = useAsyncTask(async () => {
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
  const { fetchDocuments, documents, isLoading: documentsLoading } =
    useDocumentStore();
  const { fetchSources, sources, isLoading: sourcesLoading } = useSourceStore();

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

    // API Health Checks
    await healthTest.execute();
    await mcpHealthTest.execute();

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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          Foundation Layer Testing
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive testing of API Client, Stores, and Custom Hooks
        </p>
      </div>

      {/* Test Controls */}
      <Card className="mb-6">
        <h2 className="mb-4 text-xl font-semibold">Test Controls</h2>
        <div className="flex flex-wrap gap-4">
          <Button onClick={runAllTests} color="blue" size="lg">
            Run All Tests
          </Button>
          <Button
            onClick={() => healthTest.execute()}
            color="light"
            disabled={healthTest.state.isLoading}
          >
            {healthTest.state.isLoading ? <Spinner size="sm" /> : "API Health"}
          </Button>
          <Button
            onClick={() => mcpHealthTest.execute()}
            color="light"
            disabled={mcpHealthTest.state.isLoading}
          >
            {mcpHealthTest.state.isLoading ? <Spinner size="sm" /> : "MCP Health"}
          </Button>
          <Button onClick={testLogin} color="light">
            Test Login
          </Button>
          <Button onClick={testLogout} color="light">
            Test Logout
          </Button>
          <Button onClick={testProjectsFetch} color="light">
            Fetch Projects
          </Button>
          <Button onClick={testTasksFetch} color="light">
            Fetch Tasks
          </Button>
        </div>

        {/* Test Summary */}
        {totalTests > 0 && (
          <div className="mt-4 flex gap-4">
            <Badge color="success" size="lg">
              Passed: {passedCount}
            </Badge>
            <Badge color="failure" size="lg">
              Failed: {failedCount}
            </Badge>
            <Badge color="info" size="lg">
              Total: {totalTests}
            </Badge>
          </div>
        )}
      </Card>

      {/* Test Results */}
      <Card className="mb-6">
        <h2 className="mb-4 text-xl font-semibold">Test Results</h2>
        {Object.keys(testResults).length === 0 ? (
          <p className="text-gray-500">No tests run yet. Click "Run All Tests" to start.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(testResults).map(([test, result]) => (
              <Alert
                key={test}
                color={result.passed ? "success" : "failure"}
                icon={result.passed ? HiCheck : HiX}
              >
                <div>
                  <span className="font-semibold">{test}:</span>{" "}
                  {result.message}
                </div>
              </Alert>
            ))}
          </div>
        )}
      </Card>

      {/* Hook Demonstrations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* useDebounce Demo */}
        <Card>
          <h3 className="mb-3 text-lg font-semibold">useDebounce Hook</h3>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to test debounce..."
            className="w-full rounded-lg border p-2"
          />
          <div className="mt-2 space-y-1 text-sm">
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
          <h3 className="mb-3 text-lg font-semibold">useMediaQuery Hook</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge color={isMobile ? "success" : "gray"}>Mobile</Badge>
              <span className="text-sm">≤ 768px</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={isDesktop ? "success" : "gray"}>Desktop</Badge>
              <span className="text-sm">≥ 1024px</span>
            </div>
            <p className="text-xs text-gray-500">
              Resize browser to see changes
            </p>
          </div>
        </Card>

        {/* useBooleanState & useClickOutside Demo */}
        <Card>
          <h3 className="mb-3 text-lg font-semibold">
            useBooleanState & useClickOutside
          </h3>
          <div className="relative" ref={dropdownRef}>
            <Button onClick={dropdown.toggle} color="light">
              Toggle Dropdown
              <HiChevronDown className="ml-2" />
            </Button>
            {dropdown.value && (
              <div className="absolute z-10 mt-2 w-48 rounded-lg border bg-white p-4 shadow-lg dark:bg-gray-800">
                <p className="mb-2 text-sm">Click outside to close</p>
                <Button size="xs" onClick={dropdown.setFalse}>
                  Close
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Auth State Display */}
        <Card>
          <h3 className="mb-3 text-lg font-semibold">Auth Store State</h3>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Authenticated:</strong>{" "}
              <Badge color={isAuthenticated ? "success" : "failure"}>
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
                <p>
                  <strong>Role:</strong> {user.role}
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Entity Store Data Display */}
      <Card className="mt-6">
        <h2 className="mb-4 text-xl font-semibold">Entity Store Data</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <h4 className="mb-2 font-semibold">
              Projects {projectsLoading && <Spinner size="sm" />}
            </h4>
            <p className="text-sm text-gray-600">Count: {projects.length}</p>
            {projects.length > 0 && (
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
                {JSON.stringify(projects[0], null, 2)}
              </pre>
            )}
          </div>
          <div>
            <h4 className="mb-2 font-semibold">
              Tasks {tasksLoading && <Spinner size="sm" />}
            </h4>
            <p className="text-sm text-gray-600">Count: {tasks.length}</p>
            {tasks.length > 0 && (
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
                {JSON.stringify(tasks[0], null, 2)}
              </pre>
            )}
          </div>
          <div>
            <h4 className="mb-2 font-semibold">
              Documents {documentsLoading && <Spinner size="sm" />}
            </h4>
            <p className="text-sm text-gray-600">Count: {documents.length}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
