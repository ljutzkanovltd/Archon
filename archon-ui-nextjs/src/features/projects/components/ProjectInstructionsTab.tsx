"use client";

import { useState } from "react";
import { Tabs } from "flowbite-react";
import { HiDocumentText, HiCog, HiInformationCircle, HiClock } from "react-icons/hi";
import { RichInstructionsEditor } from "./RichInstructionsEditor";
import { PartialBlock } from "@blocknote/core";

interface ProjectInstructionsTabProps {
  projectId: string;
}

/**
 * ProjectInstructionsTab - Multi-section instructions interface for projects
 *
 * Provides tabbed sections for different types of project documentation:
 * - Overview: Auto-generated project summary
 * - Agent Instructions: Guidelines for AI agents working on the project
 * - Context: Business/technical background and architecture
 * - History: Version history with diff view and restore
 *
 * Features:
 * - Rich text editing with BlockNote (Notion-style)
 * - Auto-save on content changes
 * - Version history tracking
 * - Dark mode support
 *
 * Usage:
 * ```tsx
 * <ProjectInstructionsTab projectId="project-uuid" />
 * ```
 */
export function ProjectInstructionsTab({ projectId }: ProjectInstructionsTabProps) {
  const [activeTab, setActiveTab] = useState<number>(0);

  // TODO: Fetch instructions from API
  // For now, using placeholder content
  const [instructions, setInstructions] = useState<{
    overview: PartialBlock[];
    agent_instructions: PartialBlock[];
    context: PartialBlock[];
  }>({
    overview: [],
    agent_instructions: [],
    context: [],
  });

  const handleSave = (section: keyof typeof instructions, blocks: PartialBlock[]) => {
    // TODO: Save to API
    setInstructions(prev => ({
      ...prev,
      [section]: blocks,
    }));
    console.log(`Saving ${section} for project ${projectId}:`, blocks);
  };

  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
      <Tabs
        aria-label="Project instructions"
        onActiveTabChange={(tab) => setActiveTab(tab)}
      >
        {/* Overview Tab */}
        <Tabs.Item
          active={activeTab === 0}
          title="Overview"
          icon={HiDocumentText}
        >
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Project Overview
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Brief project summary and key information
              </p>
            </div>

            <RichInstructionsEditor
              initialContent={instructions.overview}
              onChange={(blocks) => handleSave("overview", blocks)}
              placeholder="Add project overview... (auto-generated from project description)"
              minHeight="300px"
            />
          </div>
        </Tabs.Item>

        {/* Agent Instructions Tab */}
        <Tabs.Item
          active={activeTab === 1}
          title="Agent Instructions"
          icon={HiCog}
        >
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Agent Instructions
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Guidelines, scope, and constraints for AI agents working on this project
              </p>
            </div>

            <RichInstructionsEditor
              initialContent={instructions.agent_instructions}
              onChange={(blocks) => handleSave("agent_instructions", blocks)}
              placeholder="Write instructions for AI agents..."
              minHeight="400px"
            />

            {/* Agent-specific quick tips */}
            <div className="mt-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Tip:</strong> Include coding standards, architectural patterns,
                test requirements, and any project-specific constraints agents should follow.
              </p>
            </div>
          </div>
        </Tabs.Item>

        {/* Context Tab */}
        <Tabs.Item
          active={activeTab === 2}
          title="Context"
          icon={HiInformationCircle}
        >
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Project Context
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Business context, technical background, and architecture decisions
              </p>
            </div>

            <RichInstructionsEditor
              initialContent={instructions.context}
              onChange={(blocks) => handleSave("context", blocks)}
              placeholder="Add project context and background..."
              minHeight="400px"
            />
          </div>
        </Tabs.Item>

        {/* History Tab */}
        <Tabs.Item
          active={activeTab === 3}
          title="History"
          icon={HiClock}
        >
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Version History
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track changes to project instructions over time
              </p>
            </div>

            {/* TODO: Implement version history UI */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900/50">
              <HiClock className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">
                Version history will be displayed here
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                Changes are automatically tracked when you save updates
              </p>
            </div>
          </div>
        </Tabs.Item>
      </Tabs>
    </div>
  );
}
