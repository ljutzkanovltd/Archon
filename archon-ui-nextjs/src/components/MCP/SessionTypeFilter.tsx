"use client";

import { useState } from "react";
import { HiFilter, HiX } from "react-icons/hi";

export type SessionType = "all" | "claude-code" | "cursor" | "api" | "other";

interface SessionTypeFilterProps {
  value: SessionType;
  onChange: (type: SessionType) => void;
  counts?: Record<SessionType, number>;
  className?: string;
}

export function SessionTypeFilter({ value, onChange, counts, className = "" }: SessionTypeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const options: Array<{ type: SessionType; label: string; color: string }> = [
    { type: "all", label: "All Sessions", color: "gray" },
    { type: "claude-code", label: "Claude Code", color: "pink" },
    { type: "cursor", label: "Cursor", color: "blue" },
    { type: "api", label: "API Requests", color: "green" },
    { type: "other", label: "Other Clients", color: "yellow" },
  ];

  const activeOption = options.find((o) => o.type === value);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <HiFilter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {activeOption?.label}
        </span>
        {counts && value !== "all" && (
          <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
            {counts[value] || 0}
          </span>
        )}
        {value !== "all" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange("all");
            }}
            className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <HiX className="w-3 h-3 text-gray-500" />
          </button>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
            <div className="p-2">
              <div className="mb-2 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Filter by Session Type
              </div>
              {options.map(({ type, label, color }) => {
                const isActive = value === type;
                const count = counts?.[type];

                return (
                  <button
                    key={type}
                    onClick={() => {
                      onChange(type);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                      ${
                        isActive
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full bg-${color}-500`}></div>
                      <span>{label}</span>
                    </div>
                    {counts && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                        {count || 0}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
