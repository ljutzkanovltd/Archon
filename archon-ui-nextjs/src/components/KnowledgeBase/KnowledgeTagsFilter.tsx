"use client";

import { useState } from "react";
import { HiX, HiPlus } from "react-icons/hi";

interface KnowledgeTagsFilterProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags?: string[];
  placeholder?: string;
}

export default function KnowledgeTagsFilter({
  selectedTags,
  onTagsChange,
  availableTags = [],
  placeholder = "Add tag...",
}: KnowledgeTagsFilterProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState("");

  const handleAddTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      onTagsChange([...selectedTags, newTag.trim()]);
      setNewTag("");
      setIsAdding(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Escape") {
      setNewTag("");
      setIsAdding(false);
    }
  };

  // Filter available tags to exclude already selected ones
  const suggestedTags = availableTags.filter(
    (tag) => !selectedTags.includes(tag)
  );

  return (
    <div className="border-b border-gray-200 dark:border-gray-600 px-4 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden md:flex items-center text-sm font-medium text-gray-900 dark:text-white mr-2">
          Tags:
        </div>

        {/* Selected Tags */}
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg border border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="hover:text-red-600 dark:hover:text-red-400"
            >
              <HiX className="w-4 h-4" />
            </button>
          </span>
        ))}

        {/* Add Tag Input */}
        {isAdding ? (
          <div className="inline-flex items-center gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleAddTag}
              placeholder={placeholder}
              autoFocus
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-brand-500 dark:focus:border-brand-500"
              style={{ width: "150px" }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-700 bg-brand-50 rounded-lg border border-brand-300 hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-700 dark:hover:bg-brand-900/30"
          >
            <HiPlus className="w-4 h-4" />
            Add Tag
          </button>
        )}

        {/* Suggested Tags (from available tags) */}
        {!isAdding && suggestedTags.length > 0 && selectedTags.length === 0 && (
          <div className="flex flex-wrap items-center gap-2 ml-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Suggested:
            </span>
            {suggestedTags.slice(0, 5).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagsChange([...selectedTags, tag])}
                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Clear All Button */}
        {selectedTags.length > 0 && (
          <button
            type="button"
            onClick={() => onTagsChange([])}
            className="ml-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
