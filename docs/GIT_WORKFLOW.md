# Git Workflow - Archon (Solo Development)

**Version**: 1.0
**Last Updated**: 2025-12-17
**Strategy**: Modified GitHub Flow (simplified for solo dev)

---

## Overview

This repository uses a simplified branching strategy optimized for solo development with occasional upstream syncing. The workflow is designed to:

- Protect `main` from accidental commits
- Enable safe experimentation in `develop`
- Facilitate easy upstream synchronization
- Allow flexible feature organization
- Provide multiple rollback options

---

## Branch Structure

```
upstream/main (coleam00/Archon)
    ↓ (sync when needed)
origin/main (ljutzkanovltd/Archon)
    ↓ (merge from develop when stable)
develop (your active work)
    ↓ (optional feature branches)
feature/* (experimental features)
fix/* (bug fixes)
```

### Branch Purposes

| Branch | Purpose | When to Use |
|--------|---------|-------------|
| **main** | Stable releases, synced with upstream | Manual merges only when develop is stable |
| **develop** | ALL daily work | Default branch, all commits go here |
| **feature/\*** | Experimental features | Optional, for risky experiments |
| **fix/\*** | Bug fixes | Optional, for isolated fixes |

---

## Daily Workflow

### Starting Your Day

```bash
# Pull latest changes
git checkout develop
git pull origin develop

# Start working (commit directly to develop)
# ... make changes ...
git add .
git commit -m "feat: add new Azure model support"
git push origin develop
```

### Creating Optional Feature Branches

Use feature branches only for experimental work you might want to discard:

```bash
# Create feature branch from develop
git checkout develop
git checkout -b feature/experimental-qdrant-integration

# Work on feature
# ... make changes ...
git add .
git commit -m "feat: add Qdrant vector store"
git push -u origin feature/experimental-qdrant-integration

# When ready, merge back to develop
git checkout develop
git merge --no-ff feature/experimental-qdrant-integration
git push origin develop

# Delete feature branch
git branch -d feature/experimental-qdrant-integration
git push origin --delete feature/experimental-qdrant-integration
```

### Merging to Main (Creating a Release)

Only merge to main when develop is stable and tested:

```bash
# 1. Ensure develop is stable
git checkout develop
./stop-archon.sh
./start-archon.sh
# Test all functionality

# 2. Merge to main
git checkout main
git merge --no-ff develop -m "Release: Azure OpenAI + Backup System"

# 3. Tag the release
git tag -a v1.1.0-sporterp -m "Release: Azure OpenAI, Backup System, Database Fixes"

# 4. Push to origin
git push origin main --tags

# 5. Return to develop
git checkout develop
```

---

## Syncing with Upstream

### Weekly Upstream Check

```bash
# 1. Fetch upstream changes
git fetch upstream

# 2. Review what changed
git log --oneline main..upstream/main

# 3. If you want to sync, merge upstream into main
git checkout main
git merge upstream/main

# 4. Resolve conflicts if any (preserve your customizations)
# ... resolve conflicts ...

# 5. Push to origin
git push origin main

# 6. Merge main into develop
git checkout develop
git merge main
git push origin develop
```

### Handling Upstream Conflicts

**Priority**: Preserve your customizations (Azure OpenAI, backups, database fixes) while adopting upstream improvements.

```bash
# During merge conflict:
# 1. Review conflict
git diff

# 2. Edit files to keep:
#    - Your Azure OpenAI changes
#    - Your backup system
#    - Your documentation
#    - Adopt upstream bug fixes
#    - Adopt upstream new features

# 3. Mark as resolved
git add <resolved-file>

# 4. Complete merge
git commit

# 5. Test thoroughly
./stop-archon.sh && ./start-archon.sh
```

---

## Commit Conventions

Use conventional commits for clear history:

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style (formatting)
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

### Examples

```bash
git commit -m "feat(azure): add support for separate chat and embedding keys"
git commit -m "fix(database): resolve connection timeout on startup"
git commit -m "docs: update backup and restore procedures"
git commit -m "chore: update dependencies to latest versions"
```

---

## Safety & Backups

### Before Major Operations

Always create backups before risky operations:

```bash
# 1. Create branch backup
git branch backup-$(date +%Y%m%d)

# 2. Create database backup
./scripts/backup-archon.sh

# 3. Proceed with operation
# ... merge, rebase, etc. ...

# 4. If successful, cleanup after 7 days
git branch -d backup-YYYYMMDD
```

### Git Backups

Current backups (already created):

- **Branch**: `main-backup-20251217` (snapshot before branching strategy)
- **Tag**: `v1.0-sporterp-fork` (stable state with 12 custom commits)

---

## Rollback Procedures

### Undo Last Commit (Not Pushed)

```bash
# Undo commit, keep changes
git reset --soft HEAD~1

# Undo commit, discard changes
git reset --hard HEAD~1
```

### Undo Pushed Commit

```bash
# Revert commit (creates new commit)
git revert HEAD
git push origin develop
```

### Restore from Backup Branch

```bash
# If develop is broken, restore from backup
git checkout develop
git reset --hard main-backup-20251217
git push --force origin develop  # Use with caution
```

### Emergency Recovery

```bash
# If git history is corrupted, restore from tag
git checkout develop
git reset --hard v1.0-sporterp-fork
git push --force origin develop

# If database is corrupted
./scripts/restore-archon.sh --latest
```

---

## Useful Git Aliases

Add to `~/.gitconfig`:

```ini
[alias]
    # Branch management
    br = branch -vv
    co = checkout
    cob = checkout -b

    # Develop workflow
    sync-upstream = !git fetch upstream && git checkout main && git merge upstream/main && git push origin main
    sync-develop = !git checkout develop && git merge main && git push origin develop

    # Quick commands
    st = status -sb
    lg = log --graph --oneline --decorate --all -20
    recent = log --oneline -10

    # Cleanup
    cleanup = "!git branch --merged develop | grep -v '\\*\\|main\\|develop' | xargs -n 1 git branch -d"
```

Usage:

```bash
git br                 # List branches with tracking info
git co develop         # Checkout develop
git cob feature/test   # Create and checkout new branch
git sync-upstream      # Sync with upstream
git sync-develop       # Merge main into develop
git cleanup            # Delete merged branches
```

---

## Testing Checklist

Before merging develop → main, run this checklist:

```bash
# 1. Service startup
cd ~/Documents/Projects/archon
./stop-archon.sh
./start-archon.sh
# Wait 2 minutes

# 2. Health checks
curl http://localhost:8051/health   # MCP server
curl http://localhost:8181/api/health   # Backend API
curl http://localhost:3737   # Dashboard

# 3. Database connectivity
docker exec -it supabase-ai-db psql -U postgres -d postgres -c "\dt archon_*"

# 4. Backup system
./scripts/backup-archon.sh
ls -lh backups/archon_postgres-*.dump

# 5. Monitor logs for errors
docker compose logs --tail=100 | grep -i error

# 6. Check for untracked files
git status

# 7. Verify documentation is current
cat docs/CLAUDE.md | head -50
```

---

## Current Repository State

### Branches

- **main**: Protected, stable releases only (currently ahead 1 commit from upstream)
- **develop**: Active work branch (newly created, all 13 commits intact)
- **main-backup-20251217**: Safety backup before branching strategy
- **archon-ssl**: Old SSL experiment (can be deleted if unused)
- **archon_working_stefan**: Old working branch (can be deleted if unused)
- **master**: Unused (can be deleted if not needed)

### Tags

- **v1.0-sporterp-fork**: Stable state before develop branch migration

### Remotes

- **origin**: https://github.com/ljutzkanovltd/Archon.git (your fork)
- **upstream**: https://github.com/coleam00/Archon.git (original project)

### Custom Commits (13 total)

All custom work preserved in develop:

1. Documentation reorganization
2. Azure OpenAI API fixes
3. Centralized provider configuration
4. Docker persistent volumes
5. Azure OpenAI documentation
6. Separate chat/embedding configs
7. Chunk size fix (5000→1200)
8. Ollama API key validation fix
9. Merge from upstream
10. Database initialization fixes
11. Bash syntax fixes
12. Initial commit after repo move
13. Organize untracked files (today)

---

## Quick Reference

### Most Common Commands

```bash
# Daily work on develop
git checkout develop
git pull
# ... make changes ...
git add .
git commit -m "feat: description"
git push

# Create feature branch (optional)
git checkout -b feature/experimental-work
# ... work ...
git checkout develop
git merge --no-ff feature/experimental-work

# Merge to main (release)
git checkout main
git merge --no-ff develop
git tag -a v1.X.0-sporterp -m "Release notes"
git push origin main --tags

# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main
git checkout develop
git merge main
```

---

## Best Practices

### DO:

✅ Work directly on `develop` for most changes
✅ Use feature branches for risky experiments
✅ Create backups before major operations
✅ Use conventional commit messages
✅ Test before merging to main
✅ Sync with upstream regularly (weekly)
✅ Tag releases with semantic versioning
✅ Document decisions in commit messages

### DON'T:

❌ Commit directly to `main`
❌ Force push to `main` (use with extreme caution)
❌ Delete backup branches within 30 days
❌ Skip testing before releases
❌ Merge upstream without testing conflicts
❌ Use ambiguous commit messages

---

## Support

**Questions or Issues?**

- Review this document: `docs/GIT_WORKFLOW.md`
- Check CLAUDE.md: `.claude/CLAUDE.md`
- Review backup procedures: `docs/BACKUPS.md`
- Check disaster recovery: `docs/DISASTER_RECOVERY.md`

**Need to Rollback?**

- Branch backup: `main-backup-20251217`
- Tag backup: `v1.0-sporterp-fork`
- Database backup: `./scripts/restore-archon.sh --latest`

---

**Workflow Version**: 1.0 (Solo Development)
**Next Review**: After 30 days of use (2025-01-17)
**Maintained By**: ljutzkanov
