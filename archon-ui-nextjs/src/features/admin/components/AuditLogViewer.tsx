"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Badge,
  Spinner,
  Alert,
  Button,
  Select,
  TextInput,
  Table,
} from "flowbite-react";
import {
  HiClipboardList,
  HiRefresh,
  HiSearch,
  HiFilter,
  HiCalendar,
  HiUser,
} from "react-icons/hi";
import { apiClient } from "@/lib/apiClient";
import { ExportButton } from "@/components/ExportButton";

/**
 * Task/Project Change History Record
 */
interface HistoryChange {
  id?: string;
  task_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
}

/**
 * AuditLogViewer - View task/project change history with filters
 *
 * Features:
 * - View all task changes chronologically
 * - Filter by field name (status, assignee, priority, etc.)
 * - Filter by user who made the change
 * - Filter by date range
 * - Search by task ID
 * - Export audit log data
 * - Real-time refresh
 *
 * API Endpoints:
 * - GET /api/tasks/{task_id}/history - Get task change history
 *
 * Usage:
 * ```tsx
 * <AuditLogViewer />
 * ```
 */
export function AuditLogViewer() {
  const [taskId, setTaskId] = useState<string>("");
  const [fieldFilter, setFieldFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);

  // Fetch task history
  const {
    data: historyData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["task-history", taskId, fieldFilter, limit],
    queryFn: async () => {
      if (!taskId) {
        return null;
      }

      const params = new URLSearchParams();
      if (fieldFilter) params.append("field_name", fieldFilter);
      params.append("limit", limit.toString());

      const response = await apiClient.get(
        `/api/tasks/${taskId}/history?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!taskId,
    staleTime: 1000 * 30, // 30 seconds
  });

  const handleSearch = () => {
    if (taskId) {
      refetch();
    }
  };

  const handleClearFilters = () => {
    setTaskId("");
    setFieldFilter("");
    setUserFilter("");
    setLimit(50);
  };

  // Filter changes by user if filter is set
  const filteredChanges = historyData?.changes?.filter((change: HistoryChange) => {
    if (!userFilter) return true;
    return change.changed_by?.toLowerCase().includes(userFilter.toLowerCase());
  }) || [];

  // Prepare export data
  const exportData = filteredChanges.map((change: HistoryChange) => ({
    task_id: change.task_id,
    field_name: change.field_name,
    old_value: change.old_value || "",
    new_value: change.new_value || "",
    changed_by: change.changed_by,
    changed_at: new Date(change.changed_at).toLocaleString(),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HiClipboardList className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Audit Log Viewer
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View task and project change history
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={exportData}
            filename="audit-log"
            headers={{
              task_id: "Task ID",
              field_name: "Field",
              old_value: "Old Value",
              new_value: "New Value",
              changed_by: "Changed By",
              changed_at: "Changed At",
            }}
            size="sm"
            disabled={!historyData || filteredChanges.length === 0}
          />
          <Button
            color="gray"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || !taskId}
          >
            <HiRefresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <HiFilter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Filters
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Task ID Search */}
            <div>
              <label
                htmlFor="task-id"
                className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
              >
                Task ID
              </label>
              <TextInput
                id="task-id"
                placeholder="Enter task UUID"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                icon={HiSearch}
              />
            </div>

            {/* Field Name Filter */}
            <div>
              <label
                htmlFor="field-filter"
                className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
              >
                Field Name
              </label>
              <Select
                id="field-filter"
                value={fieldFilter}
                onChange={(e) => setFieldFilter(e.target.value)}
              >
                <option value="">All Fields</option>
                <option value="workflow_stage">Workflow Stage</option>
                <option value="assignee">Assignee</option>
                <option value="priority">Priority</option>
                <option value="title">Title</option>
                <option value="description">Description</option>
                <option value="task_order">Task Order</option>
                <option value="feature">Feature</option>
              </Select>
            </div>

            {/* User Filter */}
            <div>
              <label
                htmlFor="user-filter"
                className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
              >
                Changed By (User)
              </label>
              <TextInput
                id="user-filter"
                placeholder="Filter by user"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                icon={HiUser}
              />
            </div>

            {/* Limit */}
            <div>
              <label
                htmlFor="limit"
                className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
              >
                Limit
              </label>
              <Select
                id="limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value="25">25 records</option>
                <option value="50">50 records</option>
                <option value="100">100 records</option>
                <option value="200">200 records</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button color="blue" size="sm" onClick={handleSearch} disabled={!taskId}>
              <HiSearch className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button color="gray" size="sm" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      {isLoading && (
        <Card>
          <div className="flex items-center justify-center py-12">
            <Spinner size="xl" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Loading audit log...
            </span>
          </div>
        </Card>
      )}

      {error && (
        <Alert color="failure">
          <span className="font-medium">Failed to load audit log:</span> {String(error)}
        </Alert>
      )}

      {!isLoading && !error && !taskId && (
        <Card>
          <div className="py-12 text-center">
            <HiSearch className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Enter a task ID to view change history
            </p>
          </div>
        </Card>
      )}

      {!isLoading && !error && taskId && historyData && (
        <>
          {/* Summary */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Task ID
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {historyData.task_id}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Changes
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {historyData.count || 0}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Filtered Results
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {filteredChanges.length}
                </p>
              </div>
            </div>
          </Card>

          {/* Change History Table */}
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Change History
            </h3>

            {filteredChanges.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  No changes found matching the current filters
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table hoverable>
                  <Table.Head>
                    <Table.HeadCell>Date & Time</Table.HeadCell>
                    <Table.HeadCell>Field</Table.HeadCell>
                    <Table.HeadCell>Old Value</Table.HeadCell>
                    <Table.HeadCell>New Value</Table.HeadCell>
                    <Table.HeadCell>Changed By</Table.HeadCell>
                  </Table.Head>
                  <Table.Body className="divide-y">
                    {filteredChanges.map((change: HistoryChange, index: number) => (
                      <Table.Row
                        key={index}
                        className="bg-white dark:border-gray-700 dark:bg-gray-800"
                      >
                        <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <HiCalendar className="h-4 w-4 text-gray-500" />
                            {new Date(change.changed_at).toLocaleString()}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge color="info" size="sm">
                            {change.field_name}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <code className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            {change.old_value || "(empty)"}
                          </code>
                        </Table.Cell>
                        <Table.Cell>
                          <code className="rounded bg-green-100 px-2 py-1 text-sm text-green-800 dark:bg-green-900 dark:text-green-200">
                            {change.new_value || "(empty)"}
                          </code>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <HiUser className="h-4 w-4 text-gray-500" />
                            {change.changed_by}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
