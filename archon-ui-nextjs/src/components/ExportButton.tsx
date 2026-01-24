"use client";

import { useState } from "react";
import { Button, Dropdown } from "flowbite-react";
import { HiDownload, HiDocumentText, HiTable } from "react-icons/hi";
import { useCSVExport, defaultDateFormatter, defaultNumberFormatter } from "@/lib/hooks/useCSVExport";
import { toast } from "react-hot-toast";

interface ExportButtonProps {
  /**
   * Data to export
   */
  data: Record<string, any>[];

  /**
   * Filename for the export (without extension)
   */
  filename: string;

  /**
   * Custom column headers mapping
   */
  headers?: Record<string, string>;

  /**
   * Columns to include (if not specified, all columns are included)
   */
  columns?: string[];

  /**
   * Button size
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";

  /**
   * Button color
   */
  color?: "blue" | "gray" | "green" | "red" | "yellow" | "purple";

  /**
   * Show dropdown menu with format options
   */
  showDropdown?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ExportButton - Reusable button for exporting data to CSV
 *
 * Features:
 * - One-click CSV export
 * - Custom column headers
 * - Column selection
 * - Success/error notifications
 * - Optional dropdown menu
 * - Multiple export formats (currently CSV, extensible)
 *
 * Usage:
 * ```tsx
 * <ExportButton
 *   data={tasks}
 *   filename="tasks-export"
 *   headers={{ id: 'Task ID', title: 'Title', status: 'Status' }}
 *   columns={['id', 'title', 'status']}
 * />
 * ```
 */
export function ExportButton({
  data,
  filename,
  headers,
  columns,
  size = "sm",
  color = "gray",
  showDropdown = false,
  disabled = false,
  className = "",
}: ExportButtonProps) {
  const { exportToCSV } = useCSVExport();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    if (!data || data.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsExporting(true);

    try {
      exportToCSV(data, `${filename}.csv`, {
        headers,
        columns,
        formatDate: defaultDateFormatter,
        formatNumber: defaultNumberFormatter,
        addBOM: true,
      });

      toast.success(`Exported ${data.length} rows to ${filename}.csv`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    if (!data || data.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsExporting(true);

    try {
      // Filter columns if specified
      const exportData = columns
        ? data.map((row) => {
            const filteredRow: Record<string, any> = {};
            columns.forEach((col) => {
              filteredRow[col] = row[col];
            });
            return filteredRow;
          })
        : data;

      // Create JSON blob
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Download
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.json`;
      link.click();

      URL.revokeObjectURL(url);

      toast.success(`Exported ${data.length} rows to ${filename}.json`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  if (showDropdown) {
    return (
      <Dropdown
        label=""
        dismissOnClick={true}
        renderTrigger={() => (
          <Button
            color={color}
            size={size}
            disabled={disabled || isExporting}
            className={className}
          >
            <HiDownload className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        )}
      >
        <Dropdown.Header>
          <span className="block text-sm font-medium">Export Format</span>
        </Dropdown.Header>
        <Dropdown.Item icon={HiTable} onClick={handleExportCSV}>
          Export as CSV
        </Dropdown.Item>
        <Dropdown.Item icon={HiDocumentText} onClick={handleExportJSON}>
          Export as JSON
        </Dropdown.Item>
      </Dropdown>
    );
  }

  return (
    <Button
      color={color}
      size={size}
      onClick={handleExportCSV}
      disabled={disabled || isExporting || !data || data.length === 0}
      className={className}
    >
      <HiDownload className="mr-2 h-4 w-4" />
      {isExporting ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
