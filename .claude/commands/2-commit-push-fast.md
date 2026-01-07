---
title: 'Fast Commit and Push Task'
read_only: true
type: 'command'
---

# Create new fast commit and push task

This task combines the fast commit functionality with automatic push to the remote repository (GitHub/GitLab).

## Process:
1. Generate 3 commit message suggestions following conventional commit format
2. Automatically use the first suggestion without asking for confirmation
3. Immediately run `git commit -m` with the first message
4. Automatically push to the remote repository after successful commit
5. Handle push failures gracefully (e.g., need to pull first, authentication issues)

## Requirements:
- Generate commit messages based on staged files only
- Do NOT add Claude co-authorship footer to commits
- Detect the current branch and push to the correct remote branch
- If push fails due to remote changes, notify the user but don't automatically pull/merge
- Show clear success/failure messages

## Commit Message Format:
- Use conventional commit format: `type(scope): description`
- Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Scope should be the affected package/module when clear
- Description should be concise and in present tense
- Only analyze staged files (git diff --cached)

## Push Behavior:
- Push to the current branch's upstream if configured
- If no upstream, push to origin with the same branch name
- Handle common push scenarios:
  - Success: Show pushed commit hash and branch
  - Behind remote: Notify user to pull first
  - No remote: Notify user to add remote
  - Authentication failure: Show helpful message

## Example Flow:
```bash
# 1. Check staged files
git status --short

# 2. Generate and use first commit message
git commit -m "feat(frontend): add video playback toggle and functional header menus"

# 3. Push to remote
git push

# 4. Show result
✅ Committed and pushed successfully to origin/main
```

Do NOT ask for user confirmation at any step - execute the entire flow automatically.