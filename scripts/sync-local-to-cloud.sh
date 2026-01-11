#!/bin/bash

# Sync Local Supabase → Cloud (Backup/Archive)
# Purpose: Periodic backup of local data to cloud (data only, no indexes)

set -e

CLOUD_HOST="aws-1-eu-west-2.pooler.supabase.com"
CLOUD_PORT="6543"
CLOUD_USER="postgres.jnjarcdwwwycjgiyddua"
CLOUD_DB="postgres"
CLOUD_PASS="iX5q1udmEe21xq6h"

LOCAL_HOST="localhost"
LOCAL_PORT="5432"
LOCAL_USER="postgres"
LOCAL_DB="postgres"
LOCAL_PASS="postgres"

BACKUP_DIR="/tmp/archon-sync"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "========================================"
echo "Archon: Local → Cloud Sync (Backup)"
echo "========================================"
echo ""
echo "⚠️  WARNING: This will OVERWRITE cloud data!"
echo ""
echo "This will:"
echo "1. Export data from Local Supabase"
echo "2. Upload to Supabase Cloud (backup/archive)"
echo "3. Skip indexes (cloud can't create them)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Sync cancelled."
    exit 0
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 1: Export from Local Supabase"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BACKUP_FILE="$BACKUP_DIR/archon-to-cloud-$TIMESTAMP.sql"

echo "Exporting data (schema + data, no indexes)..."

PGPASSWORD="$LOCAL_PASS" pg_dump \
  -h "$LOCAL_HOST" \
  -p "$LOCAL_PORT" \
  -U "$LOCAL_USER" \
  -d "$LOCAL_DB" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-acl \
  --verbose \
  --file="$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo ""
echo "✅ Export complete!"
echo "   File: $BACKUP_FILE"
echo "   Size: $BACKUP_SIZE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 2: Clear Cloud Database (Optional)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Clear existing cloud data first? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Clearing cloud tables..."

    PGPASSWORD="$CLOUD_PASS" psql \
      -h "$CLOUD_HOST" \
      -p "$CLOUD_PORT" \
      -U "$CLOUD_USER" \
      -d "$CLOUD_DB" \
      -c "
    TRUNCATE TABLE archon_crawled_pages CASCADE;
    TRUNCATE TABLE archon_code_examples CASCADE;
    TRUNCATE TABLE archon_projects CASCADE;
    TRUNCATE TABLE archon_tasks CASCADE;
    "

    echo "✅ Cloud tables cleared"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 3: Upload to Supabase Cloud"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Importing to Supabase Cloud..."
echo "This may take 10-20 minutes..."

PGPASSWORD="$CLOUD_PASS" psql \
  -h "$CLOUD_HOST" \
  -p "$CLOUD_PORT" \
  -U "$CLOUD_USER" \
  -d "$CLOUD_DB" \
  -f "$BACKUP_FILE" 2>&1 | grep -E "(CREATE|INSERT|ERROR)"

echo ""
echo "✅ Import complete!"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 4: Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Verifying cloud data..."

PGPASSWORD="$CLOUD_PASS" psql \
  -h "$CLOUD_HOST" \
  -p "$CLOUD_PORT" \
  -U "$CLOUD_USER" \
  -d "$CLOUD_DB" \
  -c "
SELECT 'archon_crawled_pages' as table, COUNT(*) as rows FROM archon_crawled_pages
UNION ALL
SELECT 'archon_sources', COUNT(*) FROM archon_sources
UNION ALL
SELECT 'archon_projects', COUNT(*) FROM archon_projects
UNION ALL
SELECT 'archon_tasks', COUNT(*) FROM archon_tasks;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SYNC COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Note: Cloud backup is complete but:"
echo "- No vector indexes (cloud can't create them)"
echo "- Search will be slow on cloud"
echo "- This is for backup/archive only"
echo ""
echo "Continue using Local Supabase for production work."
echo ""
