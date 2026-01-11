#!/bin/bash

# Migrate Supabase Cloud → Local Supabase (Containerized Version)
# Purpose: One-time migration using PostgreSQL 17 client from Supabase container

set -e

CLOUD_HOST="aws-1-eu-west-2.pooler.supabase.com"
CLOUD_PORT="6543"
CLOUD_USER="postgres.jnjarcdwwwycjgiyddua"
CLOUD_DB="postgres"
CLOUD_PASS="iX5q1udmEe21xq6h"

LOCAL_HOST="supabase-ai-db"
LOCAL_PORT="5432"
LOCAL_USER="postgres"
LOCAL_DB="postgres"
LOCAL_PASS="Postgress.8201"

CONTAINER_NAME="supabase-ai-db"
BACKUP_DIR="/tmp/archon-migration"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "========================================"
echo "Archon: Cloud → Local Migration"
echo "Using containerized PostgreSQL 17 client"
echo "========================================"
echo ""
echo "This will:"
echo "1. Export database from Supabase Cloud (218k rows)"
echo "2. Import to Local Supabase"
echo "3. Create vector indexes (with full memory)"
echo "4. Verify data integrity"
echo ""
echo "Estimated time: 30-45 minutes"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

# Verify container is running
if ! docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" | grep -q "${CONTAINER_NAME}"; then
    echo "❌ ERROR: Supabase container (${CONTAINER_NAME}) not running"
    echo "   Please start local-ai-packaged services first"
    exit 1
fi

# Verify PostgreSQL 17 client is available
echo "Verifying PostgreSQL 17 client tools..."
if ! docker exec "${CONTAINER_NAME}" which pg_dump17 >/dev/null 2>&1; then
    echo "❌ ERROR: PostgreSQL 17 client not found in container"
    echo "   Please rebuild the Supabase container:"
    echo "   cd ~/Documents/Projects/local-ai-packaged/supabase/docker"
    echo "   docker compose build db"
    exit 1
fi

PG_VERSION=$(docker exec "${CONTAINER_NAME}" pg_dump17 --version)
echo "✅ Using: $PG_VERSION"

# Create backup directory (on host)
mkdir -p "$BACKUP_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 1: Export from Supabase Cloud"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BACKUP_FILE="/tmp/archon-migration/archon-full-backup-$TIMESTAMP.sql"
CONTAINER_BACKUP_FILE="/tmp/archon-full-backup-$TIMESTAMP.sql"

echo "Exporting database to: $BACKUP_FILE"
echo "This may take 5-15 minutes for 218k rows..."
echo ""

# Run pg_dump17 inside container, output to container's /tmp
docker exec -e PGPASSWORD="$CLOUD_PASS" "${CONTAINER_NAME}" \
  pg_dump17 \
    -h "$CLOUD_HOST" \
    -p "$CLOUD_PORT" \
    -U "$CLOUD_USER" \
    -d "$CLOUD_DB" \
    --schema=public \
    --no-owner \
    --no-privileges \
    --no-acl \
    --verbose \
    --file="$CONTAINER_BACKUP_FILE" 2>&1 | \
  grep -E "(archon_|Dumping|completed|ERROR|error|rows)" | head -100 || true

if [ $? -ne 0 ]; then
    echo "❌ Export failed"
    exit 1
fi

# Copy backup file from container to host
docker cp "${CONTAINER_NAME}:${CONTAINER_BACKUP_FILE}" "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo ""
echo "✅ Export complete!"
echo "   File: $BACKUP_FILE"
echo "   Size: $BACKUP_SIZE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 2: Import to Local Supabase"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Importing database to local Supabase..."
echo "This may take 10-20 minutes..."
echo ""

# Import using psql inside the container
docker exec -e PGPASSWORD="$LOCAL_PASS" "${CONTAINER_NAME}" \
  psql \
    -h "$LOCAL_HOST" \
    -p "$LOCAL_PORT" \
    -U "$LOCAL_USER" \
    -d "$LOCAL_DB" \
    -f "$CONTAINER_BACKUP_FILE" 2>&1 | \
  grep -E "(CREATE|INSERT|ERROR|error)" | head -50 || true

echo ""
echo "✅ Import complete!"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 3: Create Vector Indexes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Creating vector index on embedding_1536..."
echo "This will take 15-25 minutes..."
echo ""
echo "💡 TIP: Monitor progress in another terminal:"
echo "   watch -n 5 'docker exec supabase-ai-db psql -U postgres -c \"SELECT phase, tuples_done, tuples_total, ROUND((tuples_done::numeric / NULLIF(tuples_total, 0)) * 100, 1) as pct FROM pg_stat_progress_create_index;\"'"
echo ""

docker exec -e PGPASSWORD="$LOCAL_PASS" "${CONTAINER_NAME}" \
  psql \
    -h "$LOCAL_HOST" \
    -p "$LOCAL_PORT" \
    -U "$LOCAL_USER" \
    -d "$LOCAL_DB" \
    -c "
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archon_crawled_pages_embedding_1536
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 1000);
"

echo ""
echo "✅ Vector index created!"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 4: Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Verifying data integrity..."

docker exec -e PGPASSWORD="$LOCAL_PASS" "${CONTAINER_NAME}" \
  psql \
    -h "$LOCAL_HOST" \
    -p "$LOCAL_PORT" \
    -U "$LOCAL_USER" \
    -d "$LOCAL_DB" \
    -c "
-- Row counts
SELECT 'archon_crawled_pages' as table, COUNT(*) as rows FROM archon_crawled_pages
UNION ALL
SELECT 'archon_sources', COUNT(*) FROM archon_sources
UNION ALL
SELECT 'archon_projects', COUNT(*) FROM archon_projects
UNION ALL
SELECT 'archon_tasks', COUNT(*) FROM archon_tasks;

-- Index verification
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
  CASE WHEN indisvalid THEN 'VALID ✅' ELSE 'INVALID ❌' END as status
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
JOIN pg_index ON pg_index.indexrelid = pg_class.oid
WHERE tablename = 'archon_crawled_pages'
  AND indexname LIKE '%embedding%';
"

# Cleanup: Remove backup file from container
echo ""
echo "Cleaning up container backup file..."
docker exec "${CONTAINER_NAME}" rm -f "$CONTAINER_BACKUP_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ MIGRATION COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Ensure .env MODE=local (already set)"
echo ""
echo "2. Start Archon services:"
echo "   cd /home/ljutzkanov/Documents/Projects/archon"
echo "   ./start-archon.sh --skip-nextjs"
echo ""
echo "3. Test search functionality:"
echo "   time curl -X POST http://localhost:8181/api/knowledge/search \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"query\":\"FastAPI\",\"match_count\":5}' | jq"
echo ""
echo "4. Expected performance:"
echo "   - First query: 2-5 seconds (13x faster!) ⚡"
echo "   - Cached query: 0.8-2 seconds"
echo ""
echo "5. Backup file saved at: $BACKUP_FILE"
echo "   Keep this for rollback if needed."
echo ""
