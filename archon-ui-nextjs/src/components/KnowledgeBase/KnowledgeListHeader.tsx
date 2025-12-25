"use client";

import { useState, useEffect, useRef } from "react";
import { HiViewGrid, HiViewList } from "react-icons/hi";
import ButtonComponent from "@/components/ButtonComponent";
import ReactIcons from "@/components/ReactIcons";
import { ButtonVariant } from "@/lib/types";

interface KnowledgeListHeaderProps {
  title: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "table";
  onViewModeChange: (mode: "grid" | "table") => void;
  onAddSource: () => void;
  showSuggestions?: boolean;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}

export default function KnowledgeListHeader({
  title,
  searchPlaceholder = "Search sources...",
  searchValue,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onAddSource,
  showSuggestions = false,
  suggestions = [],
  onSuggestionClick,
}: KnowledgeListHeaderProps) {
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Sync with external search value
  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  // Debounced search (500ms delay)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onSearchChange(localSearchValue);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localSearchValue, onSearchChange]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setLocalSearchValue("");
      }
    };

    if (localSearchValue && suggestions.length > 0) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [localSearchValue, suggestions.length]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchValue(e.target.value);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (onSuggestionClick && suggestions[activeIndex]) {
        onSuggestionClick(suggestions[activeIndex]);
        setLocalSearchValue("");
      }
    }
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      {/* Title Row */}
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex-1 flex items-center space-x-3">
          <h5 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h5>
        </div>
      </div>

      {/* Search & Actions Row */}
      <div className="flex flex-col-reverse md:flex-row items-center justify-between md:space-x-4 px-4 py-3">
        {/* Left: Search */}
        <div className="w-full lg:w-2/3 flex flex-col space-y-3 md:space-y-0 md:flex-row md:items-center">
          <div className="w-full md:max-w-sm flex-1 md:mr-4">
            <label
              htmlFor="knowledge-search"
              className="text-sm font-medium text-gray-900 sr-only dark:text-white"
            >
              Search
            </label>
            <div className="relative">
              {/* Search Icon */}
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-gray-500 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {/* Search Input */}
              <input
                type="search"
                id="knowledge-search"
                placeholder={searchPlaceholder}
                value={localSearchValue}
                onChange={handleSearchInputChange}
                onKeyDown={handleKeyDown}
                className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-brand-500 dark:focus:border-brand-500"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && localSearchValue && suggestions.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <ul className="absolute z-10 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 w-full overflow-y-auto dark:bg-gray-700 dark:border-gray-600">
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        className={`py-2 px-3 cursor-pointer border-b border-gray-200 relative text-sm flex items-center dark:border-gray-600 ${
                          activeIndex === index
                            ? "bg-gray-100 dark:bg-gray-600"
                            : "hover:bg-gray-50 dark:hover:bg-gray-600/50"
                        }`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          onSuggestionClick?.(suggestion);
                          setLocalSearchValue("");
                        }}
                      >
                        <ReactIcons
                          icon="SEARCH"
                          size={16}
                          className="mr-2 text-green-500"
                        />
                        <span className="text-brand-700 dark:text-brand-400 font-medium">
                          {suggestion}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: View Toggle & Add Button */}
        <div className="w-full md:w-auto flex flex-col md:flex-row mb-3 md:mb-0 items-stretch md:items-center justify-end md:space-x-3 shrink-0">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg shadow-sm mb-3 md:mb-0" role="group">
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                viewMode === "grid"
                  ? "bg-brand-700 text-white border-brand-700"
                  : "bg-white text-gray-900 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-600"
              }`}
            >
              <HiViewGrid className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("table")}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${
                viewMode === "table"
                  ? "bg-brand-700 text-white border-brand-700"
                  : "bg-white text-gray-900 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-600"
              }`}
            >
              <HiViewList className="w-5 h-5" />
            </button>
          </div>

          {/* Add Source Button */}
          <ButtonComponent
            name="Add Source"
            icon="PLUS"
            variant={ButtonVariant.PRIMARY}
            onClick={onAddSource}
            fullWidth={false}
            iconClassName="h-3.5 w-3.5"
          />
        </div>
      </div>
    </div>
  );
}
