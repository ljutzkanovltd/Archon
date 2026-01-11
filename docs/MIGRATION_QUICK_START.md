# Migration Quick Start - Command Reference

**Status:** Ready to execute
**Total Time:** 40-50 minutes (rebuild + migration)

---

## 🎯 Execute These Commands

### Step 1: Rebuild Supabase Container (3-5 minutes)

```bash
cd ~/Documents/Projects/local-ai-packaged/supabase/docker
docker compose build db
docker compose up -d db
```

**Verify:**
```bash
docker exec supabase-ai-db pg_dump17 --version
# Expected: pg_dump (PostgreSQL) 17.x
```

---

### Step 2: Run Migration Script (30-45 minutes)

```bash
cd ~/Documents/Projects/archon
./scripts/migrate-cloud-to-local-containerized.sh
```

**Monitor Progress (optional - in separate terminal):**
```bash
watch -n 5 'docker exec supabase-ai-db psql -U postgres -c "SELECT phase, tuples_done, tuples_total, ROUND((tuples_done::numeric / NULLIF(tuples_total, 0)) * 100, 1) as pct FROM pg_stat_progress_create_index;"'
```

---

### Step 3: Start Archon (2 minutes)

```bash
cd ~/Documents/Projects/archon
./start-archon.sh --skip-nextjs
# Choose option 1 (local) at prompt
```

---

### Step 4: Verify Success (2 minutes)

```bash
# Check row count (should be 218,318)
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_crawled_pages;"

# Check index exists
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) FROM pg_indexes WHERE tablename = 'archon_crawled_pages' AND indexname LIKE '%embedding%';"

# Test search performance (should be <5 seconds)
time curl -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "FastAPI", "match_count": 5}' | jq '.results | length'
```

---

## 📊 Expected Results

| Phase | Expected Output | Duration |
|-------|----------------|----------|
| **Build** | `Successfully tagged supabase-ai/postgres:15.8.1.085-pg17client` | 3-5 min |
| **Verify** | `pg_dump (PostgreSQL) 17.x` | 5 sec |
| **Export** | `✅ Export complete! Size: ~1.2GB` | 5-15 min |
| **Import** | `✅ Import complete!` | 10-20 min |
| **Index** | `✅ Vector index created!` | 15-25 min |
| **Verify Data** | `218318 rows` | 2 min |
| **Search Test** | `Response in 2-5 seconds` | 5 sec |

---

## 🔍 What Each File Does

| File | Purpose |
|------|---------|
| `Dockerfile.postgres` | Extends Supabase image with PG17 client tools |
| `docker-compose.yml` | Updated to build custom image |
| `migrate-cloud-to-local-containerized.sh` | Migration script using containerized tools |
| `SUPABASE_REBUILD_GUIDE.md` | Detailed rebuild instructions |
| `MIGRATION_QUICK_START.md` | This file - quick reference |

---

## ⚡ Speed Run (Copy-Paste)

```bash
# Rebuild Supabase (3-5 min)
cd ~/Documents/Projects/local-ai-packaged/supabase/docker && \
docker compose build db && \
docker compose up -d db && \
docker exec supabase-ai-db pg_dump17 --version

# Run Migration (30-45 min)
cd ~/Documents/Projects/archon && \
./scripts/migrate-cloud-to-local-containerized.sh

# Start Archon (2 min)
cd ~/Documents/Projects/archon && \
./start-archon.sh --skip-nextjs

# Verify (30 sec)
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_crawled_pages;" && \
time curl -X POST "http://localhost:8181/api/knowledge/search" -H "Content-Type: application/json" -d '{"query":"API","match_count":5}' | jq
```

---

## 🚨 If Something Goes Wrong

**Build fails:**
```bash
docker compose build --no-cache db
```

**Migration fails:**
- Check logs: `docker logs supabase-ai-db`
- Verify connectivity: `docker exec supabase-ai-db pg_isready -U postgres`
- Check backup exists: `ls -lh /tmp/archon-migration/`

**Rollback to remote:**
```bash
cd ~/Documents/Projects/archon
sed -i 's/MODE=.*/MODE=remote/' .env
./start-archon.sh --skip-nextjs
```

---

**Ready?** Start with Step 1! 🚀
