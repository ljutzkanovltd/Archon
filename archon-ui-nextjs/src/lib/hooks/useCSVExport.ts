import { useCallback } from "react";

/**
 * useCSVExport - Hook for exporting data to CSV files
 *
 * Features:
 * - Convert arrays of objects to CSV format
 * - Custom column headers
 * - Automatic file download
 * - Date formatting
 * - Number formatting
 * - Null/undefined handling
 *
 * Usage:
 * ```tsx
 * const { exportToCSV } = useCSVExport();
 *
 * const handleExport = () => {
 *   exportToCSV(data, 'report.csv', {
 *     headers: { id: 'ID', name: 'Name', value: 'Value' }
 *   });
 * };
 * ```
 */

interface CSVExportOptions {
  /**
   * Custom column headers mapping
   * @example { id: 'Task ID', title: 'Task Name' }
   */
  headers?: Record<string, string>;

  /**
   * Columns to include (if not specified, all columns are included)
   */
  columns?: string[];

  /**
   * Date format function
   */
  formatDate?: (date: Date | string) => string;

  /**
   * Number format function
   */
  formatNumber?: (num: number) => string;

  /**
   * Add BOM for Excel compatibility
   */
  addBOM?: boolean;
}

export function useCSVExport() {
  /**
   * Convert value to CSV-safe string
   */
  const escapeCSVValue = useCallback((value: any): string => {
    if (value === null || value === undefined) {
      return "";
    }

    // Convert to string
    let stringValue = String(value);

    // Escape quotes by doubling them
    stringValue = stringValue.replace(/"/g, '""');

    // Wrap in quotes if contains comma, newline, or quote
    if (
      stringValue.includes(",") ||
      stringValue.includes("\n") ||
      stringValue.includes('"')
    ) {
      stringValue = `"${stringValue}"`;
    }

    return stringValue;
  }, []);

  /**
   * Convert array of objects to CSV string
   */
  const convertToCSV = useCallback(
    (
      data: Record<string, any>[],
      options: CSVExportOptions = {}
    ): string => {
      if (!data || data.length === 0) {
        return "";
      }

      const {
        headers = {},
        columns,
        formatDate,
        formatNumber,
      } = options;

      // Determine columns to export
      const columnsToExport =
        columns || Object.keys(data[0]);

      // Create header row
      const headerRow = columnsToExport
        .map((col) => escapeCSVValue(headers[col] || col))
        .join(",");

      // Create data rows
      const dataRows = data.map((row) => {
        return columnsToExport
          .map((col) => {
            let value = row[col];

            // Format dates
            if (
              formatDate &&
              (value instanceof Date ||
                (typeof value === "string" &&
                  !isNaN(Date.parse(value))))
            ) {
              value = formatDate(
                value instanceof Date ? value : new Date(value)
              );
            }

            // Format numbers
            if (formatNumber && typeof value === "number") {
              value = formatNumber(value);
            }

            return escapeCSVValue(value);
          })
          .join(",");
      });

      return [headerRow, ...dataRows].join("\n");
    },
    [escapeCSVValue]
  );

  /**
   * Download CSV file
   */
  const downloadCSV = useCallback(
    (csvContent: string, filename: string, addBOM: boolean = true) => {
      // Add BOM for Excel UTF-8 compatibility
      const BOM = "\uFEFF";
      const content = addBOM ? BOM + csvContent : csvContent;

      // Create blob
      const blob = new Blob([content], {
        type: "text/csv;charset=utf-8;",
      });

      // Create download link
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);
    },
    []
  );

  /**
   * Export data to CSV file
   */
  const exportToCSV = useCallback(
    (
      data: Record<string, any>[],
      filename: string = "export.csv",
      options: CSVExportOptions = {}
    ) => {
      try {
        const csvContent = convertToCSV(data, options);

        if (!csvContent) {
          console.warn("No data to export");
          return;
        }

        downloadCSV(csvContent, filename, options.addBOM ?? true);
      } catch (error) {
        console.error("Error exporting CSV:", error);
        throw error;
      }
    },
    [convertToCSV, downloadCSV]
  );

  return {
    exportToCSV,
    convertToCSV,
    downloadCSV,
  };
}

/**
 * Default date formatter (ISO format)
 */
export const defaultDateFormatter = (date: Date | string): string => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
};

/**
 * Default number formatter (2 decimal places)
 */
export const defaultNumberFormatter = (num: number): string => {
  return num.toFixed(2);
};
