/**
 * Agent Work Orders Feature
 *
 * Main entry point for the Agent Work Orders feature, providing
 * automated workflow orchestration for Claude Code CLI execution.
 *
 * This feature enables:
 * - Repository configuration and management
 * - Work order creation and monitoring
 * - Real-time log streaming via Server-Sent Events (SSE)
 * - Workflow execution (create-branch, planning, execute, commit, create-pr, prp-review)
 * - Git worktree-based sandbox isolation
 *
 * Backend API: http://localhost:8053
 */

// Re-export all feature modules
export * from './types';
export * from './hooks';
export * from './services';
export * from './components';
export * from './state';
export * from './views';
