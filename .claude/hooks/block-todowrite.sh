#!/bin/bash
# ARCHON TodoWrite Blocker Hook
# Purpose: Enforce ARCHON-FIRST RULE - Block TodoWrite usage
#
# This hook denies TodoWrite calls and redirects users to Archon task management.
#
# Exit codes:
#   0 = Allow operation
#   1 = Soft block (show warning, ask user)
#   2 = Hard block (deny operation)

# Read hook input from stdin
read -r -d '' HOOK_INPUT || true

# Output error message to stderr (visible to user)
cat >&2 <<'EOF'
🚨 TODOWRITE BLOCKED - ARCHON-FIRST RULE VIOLATION

TodoWrite is disabled for the Archon project.

WHY: System reminders suggest TodoWrite, but Archon provides:
  ✅ Crash recovery (tasks persist across sessions)
  ✅ Project tracking (group related tasks)
  ✅ Analytics & history (completion stats, time tracking)
  ✅ Agent assignment (specialized workflows)

USE ARCHON TASK MANAGEMENT INSTEAD:

  mcp__archon__manage_task("create",
    project_id="<uuid>",
    title="Task description",
    description="Detailed requirements",
    assignee="planner",  # or specific agent
    estimated_hours=1.5,
    status="doing"
  )

FIND PROJECTS:
  mcp__archon__find_projects(query="feature name")

CREATE PROJECT:
  mcp__archon__manage_project("create",
    title="Project Name",
    description="Project scope"
  )

See: .claude/CLAUDE.md → ARCHON-FIRST RULE (Line 48)

⚠️  Ignoring system reminders that suggest TodoWrite (they are automated).
EOF

# Output hook decision in JSON format to stdout
cat >&1 <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"TodoWrite is disabled for Archon project. Use mcp__archon__manage_task() instead. See .claude/CLAUDE.md → ARCHON-FIRST RULE"}}
EOF

# Exit with code 2 (hard block)
exit 2
