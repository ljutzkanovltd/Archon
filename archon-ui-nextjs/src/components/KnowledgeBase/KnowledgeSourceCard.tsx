"use client";

import { KnowledgeSource } from "@/lib/types";
import {
  Eye, Edit, Trash2, RefreshCw, Tag, FileText, Code,
  Clock, ExternalLink, Plus, X, MoreHorizontal, Globe, Terminal
} from "lucide-react";
import { Tooltip } from "flowbite-react";
import { useState, useRef, useEffect } from "react";

interface KnowledgeSourceCardProps {
  source: KnowledgeSource;
  onView?: (source: KnowledgeSource) => void;
  onEdit?: (source: KnowledgeSource) => void;
  onDelete?: (source: KnowledgeSource) => void;
  onRecrawl?: (source: KnowledgeSource) => void;
}

const getLevelColor = (level?: string) => {
  switch (level) {
    case "basic":
      return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    case "intermediate":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
    case "advanced":
      return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
  }
};

const getKnowledgeTypeColor = (type: string) => {
  switch (type) {
    case "technical":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
    case "business":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
  }
};

const getTopEdgeColor = (type: string) => {
  switch (type) {
    case "technical":
      return "border-t-4 border-t-blue-500 dark:border-t-blue-400";
    case "business":
      return "border-t-4 border-t-purple-500 dark:border-t-purple-400";
    default:
      return "border-t-4 border-t-gray-400 dark:border-t-gray-500";
  }
};

export function KnowledgeSourceCard({
  source,
  onView,
  onEdit,
  onDelete,
  onRecrawl,
}: KnowledgeSourceCardProps) {
  const [showTagInput, setShowTagInput] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tags = source.tags?.length > 0 ? source.tags : (source.metadata?.tags || []);
    setLocalTags(tags);
  }, [source.tags, source.metadata?.tags]);

  useEffect(() => {
    if (editingTags && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [editingTags]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Extract fields from metadata
  const knowledgeType = source.knowledge_type || source.metadata?.knowledge_type || "technical";
  const url = source.url || source.metadata?.original_url || "";
  const tags = source.tags?.length > 0 ? source.tags : (source.metadata?.tags || []);
  const level = source.level;

  // Get type icon
  const TypeIcon = knowledgeType === "technical" ? Terminal : Globe;

  // Handle tag operations
  const handleRemoveTag = (tagToRemove: string) => {
    setLocalTags(prev => prev.filter(tag => tag !== tagToRemove));
    // TODO: Call API to update tags
  };

  const handleAddTag = () => {
    if (newTag.trim() && !localTags.includes(newTag.trim())) {
      setLocalTags(prev => [...prev, newTag.trim()]);
      setNewTag("");
      // TODO: Call API to update tags
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddTag();
    } else if (e.key === "Escape") {
      setEditingTags(false);
      setNewTag("");
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 transition-all duration-300 min-h-[240px] hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg bg-white dark:bg-gray-800">
      {/* Content container - padding p-4 (16px) for SportERP consistency */}
      <div className="flex flex-col min-h-[240px] p-4">
        {/* Header with type badge and actions */}
        <div className="flex items-center gap-1.5 mb-2">
          {/* Knowledge type & level badges */}
          <div className="flex flex-wrap gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getKnowledgeTypeColor(knowledgeType)}`}>
              {knowledgeType}
            </span>
            {level && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getLevelColor(level)}`}>
                {level}
              </span>
            )}
          </div>

          {/* Action buttons (ml-auto pushes to right) */}
          <div className="flex items-center gap-1 ml-auto">
            {/* View Button */}
            {onView && (
              <Tooltip content="View source" style="light">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(source);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-800/40"
                  aria-label="View source"
                >
                  <Eye className="w-3 h-3" />
                </button>
              </Tooltip>
            )}

            {/* Edit Button */}
            {onEdit && (
              <Tooltip content="Edit source" style="light">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(source);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  aria-label="Edit source"
                >
                  <Edit className="w-3 h-3" />
                </button>
              </Tooltip>
            )}

            {/* Recrawl Button */}
            {onRecrawl && (
              <Tooltip content="Recrawl source" style="light">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRecrawl(source);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/40"
                  aria-label="Recrawl source"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </Tooltip>
            )}

            {/* Delete Button */}
            {onDelete && (
              <Tooltip content="Delete source" style="light">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(source);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40"
                  aria-label="Delete source"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Title - improved sizing for better readability */}
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 overflow-hidden leading-tight" title={source.title}>
          {source.title}
        </h4>

        {/* URL - single line with truncate */}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline dark:text-brand-400 truncate block mb-2 text-xs"
            title={url}
          >
            {url}
          </a>
        )}

        {/* Summary - improved line height and opacity */}
        {source.summary && (
          <div className="mb-2 flex-1">
            <p className="text-gray-600 dark:text-gray-400 line-clamp-3 break-words opacity-80 text-xs leading-relaxed">
              {source.summary}
            </p>
          </div>
        )}

        {/* Tags - editable with hover effects */}
        {localTags && localTags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {localTags.slice(0, editingTags ? undefined : 2).map((tag, index) => (
              <span
                key={index}
                className="group/tag inline-flex items-center gap-0.5 rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 transition-all duration-200 hover:opacity-80"
                style={{ fontSize: "10px" }}
              >
                <Tag className="h-2.5 w-2.5 text-gray-600 dark:text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300">{tag}</span>
                {editingTags && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 opacity-0 group-hover/tag:opacity-100 transition-opacity duration-150 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
            {!editingTags && localTags.length > 2 && (
              <button
                type="button"
                onClick={() => setEditingTags(true)}
                className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors duration-150"
                style={{ fontSize: "10px" }}
              >
                +{localTags.length - 2} more
              </button>
            )}
            {editingTags && (
              <div className="inline-flex items-center gap-1">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Add tag..."
                  className="w-20 px-1.5 py-0.5 text-[10px] rounded-full border border-cyan-500/30 bg-white/50 dark:bg-gray-800/50 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="w-4 h-4 rounded-full flex items-center justify-center bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                  aria-label="Add tag"
                >
                  <Plus className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTags(false);
                    setNewTag("");
                  }}
                  className="w-4 h-4 rounded-full flex items-center justify-center bg-gray-500/20 text-gray-600 dark:text-gray-400 hover:bg-gray-500/30 transition-colors"
                  aria-label="Done editing"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            )}
          </div>
        )}
        {!editingTags && (!localTags || localTags.length === 0) && (
          <button
            type="button"
            onClick={() => setEditingTags(true)}
            className="mb-2 inline-flex items-center gap-1 text-[10px] text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
          >
            <Plus className="h-2.5 w-2.5" />
            <span>Add tags</span>
          </button>
        )}

        {/* Spacer when no summary or tags */}
        {!source.summary && (!tags || tags.length === 0) && <div className="flex-1"></div>}

        {/* Footer with stats and timestamps - improved spacing */}
        <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-gray-200 dark:border-gray-700">
          {/* Stats */}
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400" style={{ fontSize: "10px" }}>
            <div className="flex items-center gap-0.5">
              <FileText className="w-3 h-3" />
              <span>{source.documents_count || 0}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Code className="w-3 h-3" />
              <span>{source.code_examples_count || 0}</span>
            </div>
          </div>

          {/* Last updated */}
          <div className="flex items-center gap-0.5 text-gray-500 dark:text-gray-500" style={{ fontSize: "9px" }}>
            <Clock className="w-3 h-3" />
            <span>{formatDate(source.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
