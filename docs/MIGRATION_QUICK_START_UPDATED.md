# Migration Quick Start - Updated for Supabase 15.14.1.071

**Status:** Ready to execute
**Total Time:** 40-50 minutes (rebuild + migration)
**Changes:** Combined Phase 1 (upgrade) + Phase 2 (PG17 client) into single Dockerfile

---

## 🎯 What Was Updated

### Dockerfile.postgres
- ✅ Base image: `supabase/postgres:15.8.1.085` → `supabase/postgres:15.14.1.071`
- ✅ OS: Ubuntu 20.04 Focal → Ubuntu 24.04 Noble (has OpenSSL 3.x)
- ✅ Added PostgreSQL 17 client tools via APT (noble-pgdg repository)
- ✅ Created symlinks: `pg_dump17`, `psql17`, `pg_restore17`
- ✅ Backup saved: `Dockerfile.postgres.backup-*`

### docker-compose.yml
- ✅ Image tag: `15.8.1.085-pg17client` → `15.14.1.071-pg17client`

---

## 🚀 Execute These Commands

### Step 1: Rebuild Supabase Container (8-12 minutes)

```bash
cd ~/Documents/Projects/local-ai-packaged/supabase/docker

# Stop all Supabase services
docker compose down

# Build the new image (includes upgrade + PG17 client)
docker compose build db

# Start all services
docker compose up -d

# Wait for services to be healthy (30-60 seconds)
watch -n 2 'docker compose ps'
# Press Ctrl+C when all services show "healthy"
```

---

### Step 2: Verify Upgrade and PG17 Client (2 minutes)

```bash
# Verify PostgreSQL server version (should be 15.14)
docker exec supabase-ai-db psql -U postgres -c "SELECT version();"

# Verify PostgreSQL 17 client installed (should be 17.x)
docker exec supabase-ai-db pg_dump17 --version
docker exec supabase-ai-db psql17 --version

# Verify data integrity (should show existing row counts)
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_crawled_pages;"
# Expected: 212186 (current local data)

# Test cloud connection with PG17 client
docker exec -e PGPASSWORD="iX5q1udmEe21xq6h" supabase-ai-db \
  pg_dump17 \
    -h "aws-1-eu-west-2.pooler.supabase.com" \
    -p 6543 \
    -U "postgres.jnjarcdwwwycjgiyddua" \
    -d "postgres" \
    -t archon_settings \
    --schema-only
# Expected: Schema output with NO version mismatch errors
```

**Expected Verification Results:**

| Check | Expected Output |
|-------|----------------|
| **Server Version** | PostgreSQL 15.14 on x86_64-pc-linux-gnu |
| **pg_dump17 Version** | pg_dump (PostgreSQL) 17.7 |
| **psql17 Version** | psql (PostgreSQL) 17.7 |
| **Data Integrity** | 212186 rows in archon_crawled_pages |
| **Cloud Connection** | Schema output, no errors |

---

### Step 3: Run Migration Script (30-45 minutes)

```bash
cd ~/Documents/Projects/archon
./scripts/migrate-cloud-to-local-containerized.sh
```

**What happens:**
1. **Export** from Supabase Cloud (218,318 rows) - 5-15 min
2. **Import** to local Supabase - 10-20 min
3. **Create vector index** (IVFFlat, 1536-dimensional) - 15-25 min
4. **Verify** data integrity - 2 min

**Monitor Progress (optional - in separate terminal):**
```bash
watch -n 5 'docker exec supabase-ai-db psql -U postgres -c "SELECT phase, tuples_done, tuples_total, ROUND((tuples_done::numeric / NULLIF(tuples_total, 0)) * 100, 1) as pct FROM pg_stat_progress_create_index;"'
```

---

### Step 4: Start Archon and Verify (2 minutes)

```bash
cd ~/Documents/Projects/archon
./start-archon.sh --skip-nextjs
# Choose option 1 (local) at prompt

# Test search performance (should be <5 seconds)
time curl -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "FastAPI", "match_count": 5}' | jq '.results | length'

# Verify row count matches (should be 218,318)
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_crawled_pages;"
```

---

## 📊 Expected Timeline

| Phase | Expected Output | Duration |
|-------|----------------|----------|
| **Build** | `Successfully tagged supabase-ai/postgres:15.14.1.071-pg17client` | 8-12 min |
| **Verify Server** | `PostgreSQL 15.14` | 30 sec |
| **Verify PG17** | `pg_dump (PostgreSQL) 17.7` | 10 sec |
| **Verify Data** | `212186 rows` (existing data) | 10 sec |
| **Cloud Test** | Schema output, no errors | 20 sec |
| **Export** | `✅ Export complete! Size: ~1.2GB` | 5-15 min |
| **Import** | `✅ Import complete!` | 10-20 min |
| **Index** | `✅ Vector index created!` | 15-25 min |
| **Final Verify** | `218318 rows` | 2 min |
| **Search Test** | `Response in 2-5 seconds` | 5 sec |
| **TOTAL** | | **39-55 min** |

---

## 🔍 What Each Command Does

**docker compose down:**
- Stops all Supabase services gracefully
- Preserves data in Docker volumes

**docker compose build db:**
- Pulls supabase/postgres:15.14.1.071 base image (Ubuntu 24.04 Noble)
- Installs PostgreSQL 17 client tools via PGDG APT repository
- Creates symlinks for easy access
- Verifies installation

**docker compose up -d:**
- Starts all services in detached mode
- PostgreSQL server runs 15.14, client tools include 17.x
- Data from volumes automatically mounted

**pg_dump17:**
- PostgreSQL 17 client can dump from PG 17.6 server (no version mismatch)
- Runs inside container, connects to Supabase Cloud
- Outputs SQL dump file in container's /tmp directory

**migrate-cloud-to-local-containerized.sh:**
- Uses docker exec to run pg_dump17 inside container
- Exports data from cloud, imports to local
- Creates vector index with full memory allocation
- Verifies data integrity

---

## ⚡ Speed Run (Copy-Paste)

```bash
# Stop, rebuild, start (8-12 min)
cd ~/Documents/Projects/local-ai-packaged/supabase/docker && \
docker compose down && \
docker compose build db && \
docker compose up -d && \
sleep 60

# Verify (2 min)
docker exec supabase-ai-db psql -U postgres -c "SELECT version();" && \
docker exec supabase-ai-db pg_dump17 --version && \
docker exec supabase-ai-db psql17 --version && \
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_crawled_pages;"

# Run Migration (30-45 min)
cd ~/Documents/Projects/archon && \
./scripts/migrate-cloud-to-local-containerized.sh

# Start Archon (2 min)
cd ~/Documents/Projects/archon && \
./start-archon.sh --skip-nextjs

# Final Verify (30 sec)
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_crawled_pages;" && \
time curl -X POST "http://localhost:8181/api/knowledge/search" -H "Content-Type: application/json" -d '{"query":"API","match_count":5}' | jq
```

---

## 🚨 If Something Goes Wrong

**Build fails:**
```bash
docker compose build --no-cache db
```

**APT repository errors:**
```bash
docker compose logs db | grep -E "(GPG|PGDG|noble)"
# Check logs for specific error
```

**Services won't start:**
```bash
docker logs supabase-ai-db
docker exec supabase-ai-db pg_isready -U postgres
```

**Migration fails:**
- Check logs: `docker logs supabase-ai-db`
- Verify connectivity: `docker exec supabase-ai-db pg_isready -U postgres`
- Check backup exists: `ls -lh /tmp/archon-migration/`

**Rollback to old version:**
```bash
cd ~/Documents/Projects/local-ai-packaged/supabase/docker

# Restore backup
cp Dockerfile.postgres.backup-* Dockerfile.postgres

# Restore docker-compose.yml
sed -i 's/15.14.1.071-pg17client/15.8.1.085-pg17client/' docker-compose.yml

# Rebuild
docker compose down
docker compose build db
docker compose up -d
```

**Rollback to remote database:**
```bash
cd ~/Documents/Projects/archon
sed -i 's/MODE=.*/MODE=remote/' .env
./start-archon.sh --skip-nextjs
```

---

## 📝 Technical Details

### Why Ubuntu 24.04 Noble?

- **Ubuntu 20.04 Focal**: Has OpenSSL 1.1.1 (libssl1.1)
- **Ubuntu 24.04 Noble**: Has OpenSSL 3.x (libssl3, libcrypto3)
- **PostgreSQL 17**: Requires OpenSSL 3.x
- **Result**: APT installation of postgresql-client-17 works on Noble

### Why Single Dockerfile?

- **Before**: Separate upgrade (Phase 1) + client install (Phase 2)
- **Now**: Combined into single Dockerfile (faster, atomic)
- **Benefit**: One build step, guaranteed compatibility

### Data Safety

- ✅ Docker volumes preserve data across rebuilds
- ✅ PostgreSQL 15.8 → 15.14 is binary compatible (no pg_upgrade needed)
- ✅ Backup script available: `~/Documents/Projects/local-ai-packaged/backup-unified.sh`
- ✅ Dockerfile backup saved: `Dockerfile.postgres.backup-*`

---

**Ready?** Start with Step 1! 🚀

**Next Steps After Migration:**
1. Monitor search performance (<5 seconds expected)
2. Update Archon MODE to 'local' permanently (already done)
3. Verify all Archon features working
4. Archive this migration project as complete

---

**Last Updated:** 2026-01-10
**Supabase Version:** 15.8.1.085 → 15.14.1.071
**PostgreSQL Client:** Added 17.7
**Total Migration Time:** ~39-55 minutes
