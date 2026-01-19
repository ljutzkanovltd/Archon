# COMPREHENSIVE DISK SPACE CLEANUP ANALYSIS
## MiniMax-M2 Q6_K Deployment - Space Reclamation Plan

**Generated:** 2026-01-16
**Analyst:** performance-expert
**Objective:** Free 163GB+ for MiniMax-M2 Q6_K (187.99GB total required)

---

## 🎯 EXECUTIVE SUMMARY

**Current Status:**
- Disk: 863GB used / 935GB total = **25GB free (98% full)**
- Required: **188GB** for MiniMax-M2 Q6_K
- Shortfall: **163GB**

**Good News:** Found **~380GB** of reclaimable space across 9 categories!

---

## 💎 TOP PRIORITY CLEANUPS (Quick Wins: 258GB)

### 1. **INCOMPLETE DOWNLOADS - 108GB** ⚠️ CRITICAL DISCOVERY
**Location:** `/home/ljutzkanov/Documents/Projects/archon/models/minimax-m2/.cache/`
**Files:**
- 28GB: pnmldXnikTA3lxg1AkrxSyHwRcM=....incomplete
- 27GB: zSaXsIluoFVtnsLNfhiWTC8jBTM=....incomplete  
- 27GB: PMAPhjlN1drJ7ChwzI3MrL0ns14=....incomplete
- 26GB: SCx4lkzpGS8c9t68SGi-06qEjqI=....incomplete

**Analysis:** Failed downloads from previous MiniMax-M2.1 attempt (Jan 8, 2026)
**Risk:** ZERO - These are incomplete/corrupted files
**Impact:** **108GB freed immediately**
**Command:**
```bash
rm -rf /home/ljutzkanov/Documents/Projects/archon/models/minimax-m2/.cache/
```

---

### 2. **OLD DATABASE BACKUPS - 70GB**
**Location:** `/home/ljutzkanov/Documents/Projects/local-ai-packaged/backups/`
**Analysis:**
- 34 backups total
- Oldest: Jan 8-11 (3.4GB each = 37GB)
- Recent: Jan 12-16 (1.8GB each = 18GB)
- Retention: Keep 3 most recent (5.7GB), delete 31 old (64GB)

**Risk:** LOW - Keep latest 3 backups for safety
**Impact:** **64GB freed**
**Commands:**
```bash
# Keep only 3 most recent backups
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged/backups/
ls -t unified-backup-*.gz | tail -n +4 | xargs rm -f
# Keep pre_archon_migration for historical record, or delete for +4.6GB
```

---

### 3. **DOCKER BUILD CACHE - 44GB**
**Type:** Buildkit cache from image builds
**Reclaimable:** 44GB (100% inactive)
**Risk:** ZERO - Auto-regenerates on next build
**Impact:** **44GB freed**
**Command:**
```bash
docker builder prune -af
```

---

### 4. **DOCKER DANGLING IMAGES - 41GB**
**Count:** 43 images with tag `<none>`
**Analysis:** Old archon-server builds (2.74GB each = 32GB), old MCP/frontend builds
**Risk:** ZERO - Not used by any container
**Impact:** **41GB freed**
**Command:**
```bash
docker image prune -af
```

---

## 🔧 SECONDARY CLEANUPS (Optional: 122GB)

### 5. **DOCKER ORPHANED VOLUMES - 53GB** ⚠️ CAUTION REQUIRED
**Count:** 190 volumes, 177 orphaned (21% reclaimable)
**Analysis:** Many hash-named volumes from old container runs
**Risk:** MEDIUM - Verify no production data
**Impact:** **~40-53GB freed**
**Commands:**
```bash
# List volumes
docker volume ls -qf dangling=true | head -20
# SAFE: Prune only truly dangling volumes
docker volume prune -f
```

---

### 6. **OLD AI MODELS - 47GB**
**Location:** `/home/ljutzkanov/Documents/Projects/local-ai-packaged/models/`
**Files:**
- Qwen3-32B-Q4_K_M.gguf (19GB)
- Qwen2.5-Coder-32B-Instruct-Q4_K_M.gguf (19GB)
- Qwen3-Embedding-8B.Q5_K_M.gguf (5.1GB)
- Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf (4.4GB)

**Risk:** MEDIUM - Archive before deleting if actively used
**Impact:** **47GB freed (if all removed)**
**Commands:**
```bash
# Option 1: Archive to external storage
# Option 2: Delete unused models
cd ~/Documents/Projects/local-ai-packaged/models/
# rm Qwen*.gguf  # Only if not in use!
```

---

### 7. **NODE_MODULES - 10GB**
**Count:** ~12 projects with node_modules
**Top consumers:**
- sporterp-apps/app.sporterp.co.uk: 1.8GB
- football-platform/app-frontend: 1.5GB
- sporterp.co.uk: 1.4GB

**Risk:** LOW - Can rebuild with `pnpm install`
**Impact:** **10GB freed**
**Commands:**
```bash
# Remove from inactive/unused projects
find ~/Documents/Projects -type d -name "node_modules" \
  -path "*/badmintoo-ai-lab/*" -o \
  -path "*/football-platform/*" -o \
  -path "*/badmintoo-training-lab-local/*" \
  | xargs rm -rf
```

---

### 8. **BUILD ARTIFACTS (.next, dist) - 6GB**
**Analysis:**
- sporterp-apps/app.sporterp.co.uk/.next: 3.0GB
- archon/archon-ui-nextjs/.next: 670MB
- schulzcoaching/.next: 593MB
- the5cs.co.uk/.next: 421MB

**Risk:** ZERO - Auto-regenerates on `npm run build`
**Impact:** **6GB freed**
**Commands:**
```bash
find ~/Documents/Projects -type d \( -name ".next" -o -name "dist" -o -name ".turbo" \) \
  -exec rm -rf {} + 2>/dev/null
```

---

### 9. **LOG FILES - 1.2GB**
**Top offenders:**
- clickhouse-server.err.log: 791MB
- clickhouse-server.log: 375MB  
- football-platform backend.log: 158MB
- monitoring-service.log: 71MB

**Risk:** LOW - Archive if needed for debugging
**Impact:** **1.2GB freed**
**Commands:**
```bash
# Truncate large logs
truncate -s 0 /home/ljutzkanov/Documents/Projects/local-ai-packaged/backups/pre_archon_migration_tracking_update/volumes/localai_langfuse_clickhouse_logs/*.log
find ~/Documents/Projects -type f -name "*.log" -size +50M -delete
```

---

## 📊 CLEANUP STRATEGY TIERS

### 🚀 TIER 1: IMMEDIATE (Safe, 197GB)
**Execute these NOW - ZERO risk:**
1. Delete incomplete downloads: **108GB**
2. Prune Docker build cache: **44GB**  
3. Delete Docker dangling images: **41GB**
4. Delete old backups (keep 3): **64GB** (or 69GB if delete pre_archon too)

**Total: 257GB freed** ✅ **EXCEEDS 163GB TARGET!**

---

### ⚡ TIER 2: QUICK WINS (Low risk, 17GB)
5. Clean build artifacts (.next): **6GB**
6. Clean node_modules (unused projects): **10GB**
7. Truncate/delete logs: **1.2GB**

**Total: +17GB** (274GB cumulative)

---

### 🔍 TIER 3: ADVANCED (Review required, 100GB)
8. Prune Docker volumes (verify first): **~50GB**
9. Archive/remove old models: **47GB**

**Total: +100GB** (374GB cumulative)

---

## 🎬 RECOMMENDED EXECUTION PLAN

### Phase 1: Critical Cleanup (10 minutes, 197GB)
```bash
# 1. Delete incomplete downloads (108GB)
rm -rf /home/ljutzkanov/Documents/Projects/archon/models/minimax-m2/.cache/

# 2. Docker cleanup (85GB)
docker builder prune -af               # 44GB
docker image prune -af                 # 41GB

# 3. Old backups (64GB)
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged/backups/
ls -t unified-backup-2026*.gz | tail -n +4 | xargs rm -f
```

**Expected result:** 197GB freed → **222GB free disk space** ✅

---

### Phase 2: Download MiniMax-M2 Q6_K
```bash
cd ~/Documents/Projects/local-ai-packaged/models
~/.local/bin/hf download bartowski/MiniMaxAI_MiniMax-M2-GGUF \
  --include "*Q6_K*.gguf" --local-dir . --max-workers 4
```

**Note:** 222GB free is enough for 188GB download + 34GB headroom

---

### Phase 3: Optional Cleanup (if needed)
```bash
# Clean build artifacts (6GB)
find ~/Documents/Projects -type d -name ".next" -exec rm -rf {} + 2>/dev/null

# Clean node_modules from unused projects (10GB)
rm -rf ~/Documents/Projects/football-platform/*/node_modules
rm -rf ~/Documents/Projects/badmintoo-ai-lab/node_modules
rm -rf ~/Documents/Projects/badmintoo-training-lab-local/node_modules

# Clean logs (1.2GB)
find ~/Documents/Projects -type f -name "*.log" -size +50M -exec truncate -s 0 {} \;
```

---

## ⚠️ SAFETY CHECKLIST

Before executing ANY cleanup:
- [ ] **Backups:** Verify latest Archon backup exists and is healthy
- [ ] **Services:** Stop relevant services before cleanup
- [ ] **Verification:** Run `df -h` before and after each phase
- [ ] **Testing:** Test critical services after cleanup

---

## 📈 EXPECTED OUTCOMES

| Phase | Actions | Space Freed | Total Free | Status |
|-------|---------|-------------|------------|--------|
| **Initial** | - | 0GB | 25GB | ❌ Insufficient |
| **Phase 1** | Incomplete downloads, Docker, Backups | 197GB | 222GB | ✅ **SUFFICIENT!** |
| **Phase 2** | Download Q6_K | -188GB | 34GB | ✅ Healthy margin |
| **Phase 3** | Optional cleanup | +17GB | 51GB | ✅ Excellent margin |

---

## 🔐 ROLLBACK PLAN

If issues occur:
1. **Incomplete downloads:** N/A - corrupted files, no rollback needed
2. **Docker images:** Rebuild with `docker compose up --build -d`
3. **Backups:** Restore from `/home/ljutzkanov/Documents/Projects/local-ai-packaged/backups/unified-backup-20260116-000001.tar.gz`
4. **Build artifacts:** Rebuild with `npm run build`
5. **node_modules:** Restore with `pnpm install`

---

## 📝 MONITORING

After cleanup, monitor:
```bash
# Disk usage
df -h /
watch -n 60 'df -h / | grep "ubuntu--vg"'

# Download progress (during Phase 2)
watch -n 10 'ls -lh ~/Documents/Projects/local-ai-packaged/models/*.gguf'

# Docker health
docker ps --filter "name=archon"
docker system df
```

---

**Analysis complete. Ready for execution approval.**
**Estimated cleanup time: 10-15 minutes for Phase 1**
**Risk level: LOW (Tier 1), MEDIUM (Tier 2-3)**
