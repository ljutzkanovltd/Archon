#!/bin/bash
# Apply Phase 1 migrations (001-008) to Supabase database
# Run this from: /home/ljutzkanov/Documents/Projects/archon/python

set -e  # Exit on error

echo "========================================="
echo "Phase 1 Migration Deployment"
echo "========================================="
echo ""

# Database connection details
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="iX5q1udmEe21xq6h"  # From Supabase local-ai setup

MIGRATION_DIR="../migration/0.5.0"

# Array of migrations to apply
declare -a MIGRATIONS=(
    "001_create_archon_project_types"
    "002_create_workflows_tables"
    "003_create_archon_sprints"
    "004_create_archon_time_logs"
    "005_enhance_archon_tasks"
    "006_enable_ltree_extension"
    "007_create_project_hierarchy"
    "008_create_teams"
)

echo "Migrations to apply: ${#MIGRATIONS[@]}"
echo ""

for migration in "${MIGRATIONS[@]}"; do
    echo "-------------------------------------------"
    echo "Applying: $migration"
    echo "-------------------------------------------"

    # Check if already applied
    ALREADY_APPLIED=$(docker exec supabase-ai-db psql -U $DB_USER -d $DB_NAME -tAc \
        "SELECT COUNT(*) FROM archon_migrations WHERE version='0.5.0' AND migration_name='$migration';")

    if [ "$ALREADY_APPLIED" -gt 0 ]; then
        echo "✅ Already applied, skipping..."
        continue
    fi

    # Apply migration
    echo "🚀 Applying migration..."
    docker exec -i supabase-ai-db psql -U $DB_USER -d $DB_NAME < "$MIGRATION_DIR/$migration.sql"

    if [ $? -eq 0 ]; then
        echo "✅ Migration applied successfully"

        # Record in archon_migrations table
        docker exec supabase-ai-db psql -U $DB_USER -d $DB_NAME -c \
            "INSERT INTO archon_migrations (version, migration_name, applied_at)
             VALUES ('0.5.0', '$migration', NOW())
             ON CONFLICT (version, migration_name) DO NOTHING;"

        echo "📝 Recorded in archon_migrations"
    else
        echo "❌ Migration failed!"
        exit 1
    fi

    echo ""
done

echo "========================================="
echo "✅ All Phase 1 migrations applied!"
echo "========================================="
echo ""

# Verify new tables
echo "Verifying new tables created:"
docker exec supabase-ai-db psql -U $DB_USER -d $DB_NAME -c \
    "SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
     AND table_name IN (
         'archon_project_types',
         'archon_workflows',
         'archon_workflow_stages',
         'archon_sprints',
         'archon_time_logs',
         'archon_project_hierarchy',
         'archon_teams',
         'archon_team_members'
     )
     ORDER BY table_name;"

echo ""
echo "✅ Phase 1 database setup complete!"
echo "You can now test the API endpoints."
