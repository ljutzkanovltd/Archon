"use client";

import { HiViewGrid, HiTerminal, HiBriefcase } from "react-icons/hi";

export type KnowledgeType = "all" | "technical" | "business";

interface KnowledgeTypeFilterProps {
  selectedType: KnowledgeType;
  onTypeChange: (type: KnowledgeType) => void;
  counts?: {
    all: number;
    technical: number;
    business: number;
  };
}

export default function KnowledgeTypeFilter({
  selectedType,
  onTypeChange,
  counts,
}: KnowledgeTypeFilterProps) {
  const options: Array<{
    value: KnowledgeType;
    label: string;
    icon: typeof HiViewGrid;
  }> = [
    { value: "all", label: "All", icon: HiViewGrid },
    { value: "technical", label: "Technical", icon: HiTerminal },
    { value: "business", label: "Business", icon: HiBriefcase },
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-600 px-4 pb-3">
      <div className="flex flex-wrap items-center">
        <div className="hidden md:flex items-center text-sm font-medium text-gray-900 dark:text-white mr-4">
          Type:
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedType === option.value;
            const count = counts?.[option.value];

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onTypeChange(option.value)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                  isSelected
                    ? "bg-cyan-500 text-white border-cyan-500 shadow-sm"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{option.label}</span>
                {count !== undefined && (
                  <span
                    className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                      isSelected
                        ? "bg-cyan-600 text-white"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
