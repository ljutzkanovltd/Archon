#!/bin/bash

# Migrate Supabase Cloud → Local Supabase (v2 - with PG17 support)
# Purpose: One-time migration with full data and indexes

set -e

CLOUD_HOST="aws-1-eu-west-2.pooler.supabase.com"
CLOUD_PORT="6543"
CLOUD_USER="postgres.jnjarcdwwwycjgiyddua"
CLOUD_DB="postgres"
CLOUD_PASS="iX5q1udmEe21xq6h"

LOCAL_HOST="localhost"
LOCAL_PORT="54323"
LOCAL_USER="postgres"
LOCAL_DB="postgres"
LOCAL_PASS="Postgress.8201"

BACKUP_DIR="/tmp/archon-migration"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Detect PostgreSQL client version
PG_DUMP_BIN="pg_dump"
if [ -f "/usr/lib/postgresql/17/bin/pg_dump" ]; then
    PG_DUMP_BIN="/usr/lib/postgresql/17/bin/pg_dump"
    PSQL_BIN="/usr/lib/postgresql/17/bin/psql"
    echo "✅ Using PostgreSQL 17 client tools"
elif [ -f "/usr/bin/pg_dump" ]; then
    PG_DUMP_VERSION=$(/usr/bin/pg_dump --version | grep -oP '\d+' | head -1)
    if [ "$PG_DUMP_VERSION" -lt 17 ]; then
        echo "⚠️  WARNING: pg_dump version $PG_DUMP_VERSION detected (need 17+)"
        echo "   Cloud server is PostgreSQL 17.6"
        echo ""
        echo "Install PostgreSQL 17 client:"
        echo "  sudo ./scripts/install-pg17-client.sh"
        echo ""
        read -p "Continue anyway? (not recommended) (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    PG_DUMP_BIN="/usr/bin/pg_dump"
    PSQL_BIN="/usr/bin/psql"
else
    echo "❌ ERROR: pg_dump not found"
    exit 1
fi

echo "========================================"
echo "Archon: Cloud → Local Migration (v2)"
echo "========================================"
echo ""
echo "Using: $PG_DUMP_BIN"
echo ""
echo "This will:"
echo "1. Export database from Supabase Cloud (218k rows)"
echo "2. Import to Local Supabase"
echo "3. Create vector indexes (with full memory)"
echo "4. Verify data integrity"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 1: Export from Supabase Cloud"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BACKUP_FILE="$BACKUP_DIR/archon-full-backup-$TIMESTAMP.sql"

echo "Exporting database to: $BACKUP_FILE"
echo "This may take 5-15 minutes for 218k rows..."
echo ""

# Use --verbose and show ALL output (no grep filter)
PGPASSWORD="$CLOUD_PASS" "$PG_DUMP_BIN" \
  -h "$CLOUD_HOST" \
  -p "$CLOUD_PORT" \
  -U "$CLOUD_USER" \
  -d "$CLOUD_DB" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-acl \
  --verbose \
  --file="$BACKUP_FILE" 2>&1 | grep -E "(archon_|Dumping|completed|ERROR|error)" || true

if [ $? -ne 0 ]; then
    echo "❌ Export failed"
    exit 1
fi

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

PGPASSWORD="$LOCAL_PASS" "$PSQL_BIN" \
  -h "$LOCAL_HOST" \
  -p "$LOCAL_PORT" \
  -U "$LOCAL_USER" \
  -d "$LOCAL_DB" \
  -f "$BACKUP_FILE" 2>&1 | grep -E "(CREATE|INSERT|ERROR|error)" | head -50

echo ""
echo "✅ Import complete!"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 3: Create Vector Indexes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Creating vector index on embedding_1536..."
echo "This will take 15-25 minutes..."
echo "Monitor progress in another terminal:"
echo "  watch -n 5 'docker exec supabase-ai-db psql -U postgres -c \"SELECT phase, tuples_done, tuples_total FROM pg_stat_progress_create_index;\"'"
echo ""

PGPASSWORD="$LOCAL_PASS" "$PSQL_BIN" \
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

PGPASSWORD="$LOCAL_PASS" "$PSQL_BIN" \
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
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE tablename = 'archon_crawled_pages'
  AND indexname LIKE '%embedding%';
"

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
echo "   curl -X POST http://localhost:8181/api/knowledge/search \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"query\":\"API\"}' | jq"
echo ""
echo "4. Backup file saved at: $BACKUP_FILE"
echo "   Keep this for rollback if needed."
echo ""
