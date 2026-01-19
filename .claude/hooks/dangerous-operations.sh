#!/bin/bash
# Dangerous Operations Detection Hook (PreToolUse)
# This hook runs BEFORE tool execution to detect and block dangerous operations
# Created: 2026-01-12 (after remote database drop incident)
#
# Exit codes:
#   0 - Success (allow operation)
#   2 - Blocking error (deny operation, stderr used as error message)
#
# Input: JSON via stdin with tool_name and tool_input
# Output: JSON decision control to stdout

set -euo pipefail

# Ensure jq is available for JSON parsing
if ! command -v jq &> /dev/null; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"jq not available, bypassing safety check"}}' >&1
  exit 0
fi

# Read and parse JSON input from stdin
HOOK_INPUT=$(cat)

# Extract tool information
TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // "unknown"')
TOOL_INPUT_JSON=$(echo "$HOOK_INPUT" | jq -c '.tool_input // {}')

# Extract specific fields based on tool type
BASH_COMMAND=""
FILE_PATH=""
NEW_STRING=""
OLD_STRING=""
SQL_QUERY=""

case "$TOOL_NAME" in
  "Bash")
    BASH_COMMAND=$(echo "$TOOL_INPUT_JSON" | jq -r '.command // ""')
    ;;
  "Write"|"Edit")
    FILE_PATH=$(echo "$TOOL_INPUT_JSON" | jq -r '.file_path // ""')
    NEW_STRING=$(echo "$TOOL_INPUT_JSON" | jq -r '.new_string // ""')
    OLD_STRING=$(echo "$TOOL_INPUT_JSON" | jq -r '.old_string // ""')
    ;;
  mcp__supabase__*)
    SQL_QUERY=$(echo "$TOOL_INPUT_JSON" | jq -r '.query // ""')
    ;;
  mcp__archon__manage_task)
    # Validate project_id requirement for task creation
    ACTION=$(echo "$TOOL_INPUT_JSON" | jq -r '.action // ""')
    PROJECT_ID=$(echo "$TOOL_INPUT_JSON" | jq -r '.project_id // ""')

    if [[ "$ACTION" == "create" && -z "$PROJECT_ID" ]]; then
      cat >&2 <<'TASKEOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  TASK CREATION WITHOUT project_id
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRASH RECOVERY REQUIREMENT VIOLATED

A task is being created without project_id parameter.
This prevents:
  ❌ Crash recovery (tasks orphaned on session crash)
  ❌ Task discovery (cannot find tasks by project)
  ❌ Project analytics (completion stats broken)

Required: Include project_id parameter
  manage_task("create",
    project_id="<uuid>",  ← REQUIRED FOR CRASH RECOVERY
    title="Task description",
    description="...",
    ...
  )

How to get project_id:
  1. Find existing: find_projects(query="feature name")
  2. Create new: manage_project("create", title="...", description="...")
  3. Extract ID: project_id = project['project']['id']

See: .claude/CLAUDE.md → ARCHON TASK CREATION WORKFLOW → Phase 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASKEOF

      cat >&1 <<'TASKJSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"⚠️ Task creation without project_id detected. This violates crash recovery requirements. Continue anyway? (NOT RECOMMENDED)"}}
TASKJSON
      exit 0
    fi
    ;;
esac

# Combine all text to check for dangerous patterns
CHECK_TEXT="$BASH_COMMAND $NEW_STRING $SQL_QUERY"

# Dangerous pattern registry (from CLAUDE.md RULE 3)
# Returns 0 if pattern found, 1 if not found
check_dangerous_pattern() {
  local text="$1"

  # Database operations (HIGHEST RISK) - case insensitive
  if echo "$text" | grep -iE 'DROP[[:space:]]+SCHEMA.*CASCADE' > /dev/null 2>&1; then
    echo "DROP SCHEMA ... CASCADE"
    return 0
  fi
  if echo "$text" | grep -iE 'DROP[[:space:]]+DATABASE' > /dev/null 2>&1; then
    echo "DROP DATABASE"
    return 0
  fi
  if echo "$text" | grep -iE 'DROP[[:space:]]+TABLE.*CASCADE' > /dev/null 2>&1; then
    echo "DROP TABLE ... CASCADE"
    return 0
  fi
  if echo "$text" | grep -iE 'TRUNCATE.*CASCADE' > /dev/null 2>&1; then
    echo "TRUNCATE ... CASCADE"
    return 0
  fi

  # File system operations
  if echo "$text" | grep -E 'rm[[:space:]]+-[^[:space:]]*rf[^[:space:]]*[[:space:]]+(/\*?|~|~/Documents)' > /dev/null 2>&1; then
    echo "rm -rf (dangerous path)"
    return 0
  fi

  # Git operations
  if echo "$text" | grep -E 'git[[:space:]]+push[[:space:]]+--force.*(main|master|production)' > /dev/null 2>&1; then
    echo "git push --force (protected branch)"
    return 0
  fi
  if echo "$text" | grep -E 'git[[:space:]]+reset[[:space:]]+--hard' > /dev/null 2>&1; then
    echo "git reset --hard"
    return 0
  fi
  if echo "$text" | grep -E 'git[[:space:]]+clean[[:space:]]+-[^[:space:]]*f[^[:space:]]*d[^[:space:]]*x' > /dev/null 2>&1; then
    echo "git clean -fdx"
    return 0
  fi

  # Docker operations
  if echo "$text" | grep -E 'docker(-compose)?[[:space:]]+.*down[[:space:]]+-v' > /dev/null 2>&1; then
    echo "docker-compose down -v (deletes volumes)"
    return 0
  fi
  if echo "$text" | grep -E 'docker[[:space:]]+system[[:space:]]+prune.*--volumes' > /dev/null 2>&1; then
    echo "docker system prune --volumes"
    return 0
  fi

  # System operations
  if echo "$text" | grep -E 'chmod[[:space:]]+-R[[:space:]]+777' > /dev/null 2>&1; then
    echo "chmod -R 777 (security risk)"
    return 0
  fi

  return 1
}

# Warning pattern check
check_warning_pattern() {
  local text="$1"

  # Database operations that require approval
  if echo "$text" | grep -iE 'DELETE[[:space:]]+FROM.*WHERE' > /dev/null 2>&1; then
    echo "DELETE FROM ... WHERE"
    return 0
  fi
  if echo "$text" | grep -iE 'UPDATE.*SET' > /dev/null 2>&1; then
    echo "UPDATE ... SET"
    return 0
  fi
  if echo "$text" | grep -iE 'ALTER[[:space:]]+TABLE' > /dev/null 2>&1; then
    echo "ALTER TABLE"
    return 0
  fi

  return 1
}

# Check for dangerous patterns
if MATCHED_PATTERN=$(check_dangerous_pattern "$CHECK_TEXT"); then
  # BLOCK operation - output error to stderr and return exit 2
  cat >&2 <<EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 DANGEROUS OPERATION BLOCKED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tool: $TOOL_NAME
Pattern: $MATCHED_PATTERN

This operation was blocked by the Dangerous Operations Protocol.

Required actions before proceeding:
  1. Create a timestamped backup (RULE 1)
  2. Request user approval twice (RULE 2)
  3. Document backup location and recovery procedure

See: .claude/CLAUDE.md → DANGEROUS OPERATIONS PROTOCOL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

  # Output deny decision to stdout as JSON
  cat >&1 <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Dangerous pattern detected: $MATCHED_PATTERN. See .claude/CLAUDE.md for protocol."
  }
}
EOF

  exit 2
fi

# Check for warning patterns
if MATCHED_PATTERN=$(check_warning_pattern "$CHECK_TEXT"); then
  # ASK for approval - let user decide
  cat >&1 <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "⚠️ Warning: $MATCHED_PATTERN detected. This operation requires approval. Consider creating a backup first. See .claude/CLAUDE.md → DANGEROUS OPERATIONS PROTOCOL"
  }
}
EOF

  exit 0
fi

# No dangerous patterns detected - ALLOW
cat >&1 <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "No dangerous patterns detected"
  }
}
EOF

exit 0
