"use client";

import { useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { Block, BlockNoteEditor, PartialBlock } from "@blocknote/core";

interface RichInstructionsEditorProps {
  /**
   * Initial content as BlockNote blocks (JSONB from database)
   */
  initialContent?: PartialBlock[];

  /**
   * Callback when editor content changes
   * Returns array of BlockNote blocks
   */
  onChange?: (blocks: Block[]) => void;

  /**
   * Read-only mode for viewing instructions
   */
  readOnly?: boolean;

  /**
   * Minimum height of editor
   */
  minHeight?: string;

  /**
   * Placeholder text when empty
   */
  placeholder?: string;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * RichInstructionsEditor - Notion-style rich text editor for project instructions
 *
 * Built with BlockNote for a familiar Notion-like editing experience.
 *
 * Features:
 * - Block-based editing (paragraphs, headings, lists, code, etc.)
 * - Slash commands (type `/` to insert blocks)
 * - Markdown shortcuts (e.g., `#` for headings, `-` for bullets)
 * - Dark mode support
 * - Auto-saves via onChange callback
 *
 * Usage:
 * ```tsx
 * <RichInstructionsEditor
 *   initialContent={instructionsFromDB}
 *   onChange={(blocks) => saveInstructions(blocks)}
 *   readOnly={false}
 *   placeholder="Write project instructions..."
 * />
 * ```
 */
export function RichInstructionsEditor({
  initialContent,
  onChange,
  readOnly = false,
  minHeight = "500px",
  placeholder = "Type '/' for commands or start writing...",
  className = "",
}: RichInstructionsEditorProps) {
  // Create BlockNote editor instance
  // BlockNote requires non-empty array OR undefined (not empty array)
  const validInitialContent =
    initialContent && initialContent.length > 0
      ? (initialContent as PartialBlock[])
      : undefined;

  const editor: BlockNoteEditor = useCreateBlockNote({
    initialContent: validInitialContent,
  });

  // Handle content changes
  useEffect(() => {
    if (!onChange || readOnly) return;

    const unsubscribe = editor.onChange(() => {
      const blocks = editor.document;
      onChange(blocks);
    });

    return () => {
      unsubscribe();
    };
  }, [editor, onChange, readOnly]);

  // Apply read-only state
  useEffect(() => {
    editor.isEditable = !readOnly;
  }, [editor, readOnly]);

  return (
    <div
      className={`blocknote-container ${className}`}
      style={{ minHeight }}
    >
      <BlockNoteView
        editor={editor}
        theme="light" // We'll handle dark mode via CSS
        className="min-h-full"
      >
        {/* Custom slash menu and formatting toolbar are provided by BlockNote */}
      </BlockNoteView>

      <style jsx global>{`
        /* Dark mode support for BlockNote */
        .dark .blocknote-container {
          --bn-colors-editor-background: rgb(17 24 39); /* gray-900 */
          --bn-colors-editor-text: rgb(243 244 246); /* gray-100 */
          --bn-colors-menu-background: rgb(31 41 55); /* gray-800 */
          --bn-colors-menu-text: rgb(243 244 246);
          --bn-colors-tooltip-background: rgb(31 41 55);
          --bn-colors-tooltip-text: rgb(243 244 246);
          --bn-colors-hovered-background: rgb(55 65 81); /* gray-700 */
          --bn-colors-selected-background: rgb(79 70 229); /* brand-600 */
          --bn-colors-selected-text: white;
          --bn-colors-disabled-background: rgb(55 65 81);
          --bn-colors-disabled-text: rgb(156 163 175); /* gray-400 */
          --bn-colors-shadow: rgba(0, 0, 0, 0.5);
          --bn-colors-border: rgb(55 65 81);
          --bn-colors-side-menu: rgb(156 163 175);
          --bn-colors-highlights-gray-background: rgb(75 85 99);
          --bn-colors-highlights-gray-text: rgb(243 244 246);
          --bn-colors-highlights-brown-background: rgb(120 53 15);
          --bn-colors-highlights-brown-text: rgb(253 224 71);
          --bn-colors-highlights-red-background: rgb(153 27 27);
          --bn-colors-highlights-red-text: rgb(254 202 202);
          --bn-colors-highlights-orange-background: rgb(154 52 18);
          --bn-colors-highlights-orange-text: rgb(254 215 170);
          --bn-colors-highlights-yellow-background: rgb(133 77 14);
          --bn-colors-highlights-yellow-text: rgb(254 240 138);
          --bn-colors-highlights-green-background: rgb(20 83 45);
          --bn-colors-highlights-green-text: rgb(187 247 208);
          --bn-colors-highlights-blue-background: rgb(30 58 138);
          --bn-colors-highlights-blue-text: rgb(191 219 254);
          --bn-colors-highlights-purple-background: rgb(88 28 135);
          --bn-colors-highlights-purple-text: rgb(233 213 255);
          --bn-colors-highlights-pink-background: rgb(157 23 77);
          --bn-colors-highlights-pink-text: rgb(252 231 243);
        }

        /* Light mode refinements */
        .blocknote-container {
          --bn-colors-editor-background: white;
          --bn-colors-editor-text: rgb(17 24 39);
          --bn-colors-selected-background: rgb(99 102 241); /* brand-500 */
        }

        /* Read-only styling */
        .blocknote-container [contenteditable="false"] {
          cursor: default;
        }

        /* Focus ring for accessibility */
        .blocknote-container:focus-within {
          outline: 2px solid rgb(99 102 241);
          outline-offset: 2px;
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  );
}
