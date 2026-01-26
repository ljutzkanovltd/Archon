# Archon Fast Startup Guide

## 🚀 Quick Reference

### Fast & Safe Startup (45-65 seconds, includes backup)
```bash
./start-archon.sh --fast
```

**First time?** Run once without flags to generate config cache:
```bash
./start-archon.sh  # Choose database, saves config
./start-archon.sh --fast  # Now takes 45-65s (safe, includes backup)
```

### Fastest (Testing Only - NO backup, NOT recommended)
```bash
./start-archon.sh --fast --no-backup  # 30-50s, NO backup
```

---

## New Flags

| Flag | What It Does | Time Saved |
|------|-------------|------------|
| `--fast` | **Fast & safe**: cached config + force-restart + timeout=30 (backup ALWAYS runs) | ~30-50s |
| `--yes` | Use cached config, skip prompts | ~15-30s |
| `--no-backup` | Skip backup (NOT recommended, testing only) | ~15s |
| `--timeout N` | Custom health check timeout (default: 60s) | Variable |

---

## Common Workflows

### Backend Development
```bash
# Start backend in Docker, run Next.js locally (hot reload)
./start-archon.sh --fast --skip-nextjs
cd archon-ui-nextjs && npm run dev
```

### Full Stack Development
```bash
# All services in Docker
./start-archon.sh --fast
```

### Conservative (Keep Backups)
```bash
# First run
./start-archon.sh

# Subsequent runs (uses cache but still backs up if BACKUP_ON_START=true)
./start-archon.sh --yes
```

---

## What Changed?

✅ **Config caching** - Saves database selection to `~/.archon-startup-config`
✅ **Backup ALWAYS enabled** - `BACKUP_ON_START=true` (critical for data safety)
✅ **Fast optional checks** - LLM and Qdrant checks timeout in 2s (not 2+ minutes)
✅ **Smart defaults** - `--fast` combines speed optimizations (keeps backup)
✅ **100% backward compatible** - All existing flags work unchanged

**Performance:**
- Before: 2-3 minutes (with hanging checks)
- After (--fast): 45-65 seconds (safe, includes backup)
- After (--fast --no-backup): 30-50 seconds (testing only, NOT recommended)
- **~2x faster and much more reliable!**

---

## Detailed Documentation

See `docs/STARTUP_OPTIMIZATION_2026-01-23.md` for complete details, benchmarks, and troubleshooting.
