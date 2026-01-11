# Archon Database Migration Configuration Summary

**Date**: 2026-01-10
**Status**: ✅ MODE Configuration Fixed - Ready for Testing
**Last Updated**: 2026-01-10 (Fixed duplicate MODE declaration)

---

## What Was Implemented

### 1. Updated .env File

**MODE-Based Configuration**:
- User sets `MODE=local` or `MODE=remote` in .env
- Script automatically selects correct SUPABASE_URL, SERVICE_KEY, DATABASE_URI

**LOCAL Configuration** (MODE=local):
```bash
LOCAL_SUPABASE_URL=http://supabase-ai-kong:8000
LOCAL_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
LOCAL_DATABASE_URI=postgresql://postgres:Postgress.8201@supabase-ai-db:5432/postgres
```

**REMOTE Configuration** (MODE=remote):
```bash
REMOTE_SUPABASE_URL=https://jnjarcdwwwycjgiyddua.supabase.co
REMOTE_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
REMOTE_DATABASE_URI=postgresql://postgres.jnjarcdwwwycjgiyddua:iX5q1udmEe21xq6h@aws-1-eu-west-2.pooler.supabase.com:6543/postgres
```

### 2. Updated start-archon.sh

**Auto-Selection Logic**:
- Validates MODE value (local or remote only)
- Validates LOCAL_*/REMOTE_* variables exist
- Exports correct variables to environment
- Displays selected configuration

### 3. Port Architecture Verified

**NO CONFLICTS with sporterp-apps**:
- ✅ sporterp-apps FastAPI: `localhost:8000` (HOST port)
- ✅ sporterp-apps Odoo: `localhost:8069`
- ✅ sporterp-apps Next.js: `localhost:3000`

**Local Supabase Architecture**:
- Kong container internal: `supabase-ai-kong:8000`
- Kong HOST external: `localhost:18000`
- PostgreSQL: `supabase-ai-db:5432` → `localhost:54323`

**Key Insight**: Kong uses port 8000 INSIDE its Docker container, but maps to 18000 externally. FastAPI uses 8000 on the HOST. No conflict!

---

## How to Use

### Interactive Mode Selection (Recommended)

The startup script now includes an **interactive prompt** to choose between local and remote database:

```bash
# Start Archon (will prompt for database choice)
./start-archon.sh --skip-nextjs

# Interactive prompt will appear:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   Database Configuration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Current MODE from .env: local
#
# Choose database to use:
#   1) local  - Local Supabase (from local-ai-packaged)
#   2) remote - Remote Supabase Cloud (eu-west-2)
#
# Enter choice [1-2] (press Enter to keep current):
```

**Options**:
- Enter `1` → Use local database
- Enter `2` → Use remote database
- Press Enter → Keep current MODE from .env

### Manual Mode Selection (Alternative)

You can also manually edit `.env` to change the default MODE:

**Switch to Local**:
```bash
sed -i 's/MODE=.*/MODE=local/' .env
./start-archon.sh --skip-nextjs
```

**Switch to Remote**:
```bash
sed -i 's/MODE=.*/MODE=remote/' .env
./start-archon.sh --skip-nextjs
```

### Expected Startup Output

**Local Mode**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Configuration Selection (MODE=local)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[OK] Using LOCAL Supabase (from local-ai-packaged)
[INFO]   Kong API: http://supabase-ai-kong:8000
[INFO]   PostgreSQL: supabase-ai-db:5432
[INFO]   Network: sporterp-ai-unified bridge
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Remote Mode**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Configuration Selection (MODE=remote)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[OK] Using REMOTE Supabase (Supabase Cloud)
[INFO]   API URL: https://jnjarcdwwwycjgiyddua.supabase.co
[INFO]   Region: eu-west-2 (AWS London)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Verification Commands

### Test Local Mode Configuration

```bash
# 1. Start Archon in local mode
MODE=local ./start-archon.sh --skip-nextjs

# 2. Verify Archon services are healthy
curl http://localhost:8051/health
# Expected: {"success":true,"status":"ready"}

curl http://localhost:8181/api/health
# Expected: "healthy"

# 3. Test database connectivity (inside container)
docker exec archon-server psql -U postgres -h supabase-ai-db -d postgres -c "SELECT 1"
# Expected: 1 row returned

# 4. Test Kong API Gateway (from host)
curl http://localhost:18000/rest/v1/
# Expected: API root response

# 5. Verify sporterp-apps ports are intact
curl http://localhost:8000/health  # FastAPI (if running)
curl http://localhost:8069/         # Odoo (if running)
curl http://localhost:3000/         # Next.js (if running)
```

### Test Remote Mode Configuration

```bash
# 1. Switch to remote mode
sed -i 's/MODE=.*/MODE=remote/' .env
./start-archon.sh --skip-nextjs

# 2. Verify remote connectivity
curl http://localhost:8181/api/health
# Expected: "healthy"

# 3. Test remote database
curl -X POST http://localhost:8181/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test","match_count":1}'
# Expected: Search results (may timeout if no index)
```

---

## Next Steps (Phase 5: Database Migration)

**Once local mode is verified**:

1. **Clear Local Database** (212k old rows):
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres -c "
   DROP TABLE IF EXISTS archon_crawled_pages CASCADE;
   DROP TABLE IF EXISTS archon_code_examples CASCADE;
   DROP TABLE IF EXISTS archon_sources CASCADE;
   -- ... (continue for all archon_* tables)"
   ```

2. **Run Migration Script**:
   ```bash
   cd /home/ljutzkanov/Documents/Projects/archon
   ./scripts/migrate-cloud-to-local.sh
   ```

3. **Verify Migration**:
   - Row count matches: 218,318 expected
   - Vector index created: `idx_archon_crawled_pages_embedding_1536`
   - Search works: Response time <200ms

---

## Rollback Procedure

**If issues occur**:

```bash
# 1. Stop Archon
./stop-archon.sh

# 2. Restore original .env
cp .env.remote-backup .env

# 3. Switch back to remote
sed -i 's/MODE=.*/MODE=remote/' .env

# 4. Restart
./start-archon.sh --skip-nextjs
```

---

## Files Modified

1. ✅ `.env` - Added LOCAL_*/REMOTE_* structure, MODE-based selection, fixed duplicate MODE declaration
2. ✅ `start-archon.sh` - Added interactive database selection (lines 316-345) and auto-selection logic (lines 347-398)
3. ✅ `.env.remote-backup` - Backup of original configuration

## Changes & Fixes (2026-01-10)

### Issue 1: Duplicate MODE Declaration (FIXED)
**Problem**: Duplicate MODE declaration in .env file
- Line 15: `MODE=local` (correct, in DEPLOYMENT MODE section)
- Line 85: `MODE=local-supabase` (duplicate, in INFRASTRUCTURE section)
- Startup script read line 85 last, causing "Invalid mode: local-supabase" error

**Solution**: Removed duplicate MODE declaration from line 85
- Only one MODE declaration remains at line 15
- Startup validation now passes with MODE=local

### Enhancement 1: Interactive Database Selection (ADDED)
**Feature**: Added interactive prompt to choose database at startup

**Implementation**: Start-archon.sh now prompts user before service startup:
```bash
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Database Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current MODE from .env: local

Choose database to use:
  1) local  - Local Supabase (from local-ai-packaged)
  2) remote - Remote Supabase Cloud (eu-west-2)

Enter choice [1-2] (press Enter to keep current):
```

**Benefits**:
- No need to manually edit .env file
- Quick switching between local/remote during testing
- Shows current MODE from .env as default
- User has full control at startup time

---

## Status: Ready for Testing

**Current Configuration**: MODE=local (targeting local Supabase)
**Action Required**: Start Archon and verify connectivity before migration

**Commands to Run**:
```bash
cd /home/ljutzkanov/Documents/Projects/archon
./start-archon.sh --skip-nextjs
```
