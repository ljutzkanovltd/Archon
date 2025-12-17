#!/usr/bin/env bash
#
# monitor-db-size.sh - Archon Database Size Monitoring
#
# This script monitors the Archon database size and individual table sizes,
# logging trends and alerting on threshold breaches.
#
# Schedule: Daily at 6 AM
# Cron: 0 6 * * * /path/to/monitor-db-size.sh
#

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly LOG_FILE="${LOG_FILE:-/var/log/archon-monitoring.log}"
readonly METRICS_DIR="${PROJECT_ROOT}/logs/metrics"
readonly METRICS_FILE="${METRICS_DIR}/db-size-$(date +%Y%m).csv"

# Database config
readonly DB_CONTAINER="${DB_CONTAINER:-supabase-ai-db}"
readonly DB_USER="${DB_USER:-postgres}"
readonly DB_NAME="${DB_NAME:-postgres}"

# Alert thresholds (in MB)
readonly ALERT_THRESHOLD_MB="${ALERT_THRESHOLD_MB:-100}"
readonly WARNING_THRESHOLD_MB="${WARNING_THRESHOLD_MB:-80}"

# Growth rate alert (MB per day)
readonly GROWTH_ALERT_MB_PER_DAY="${GROWTH_ALERT_MB_PER_DAY:-5}"

# Archon tables to monitor
readonly ARCHON_TABLES=(
    "archon_code_examples"
    "archon_crawled_pages"
    "archon_document_versions"
    "archon_migrations"
    "archon_page_metadata"
    "archon_project_sources"
    "archon_projects"
    "archon_prompts"
    "archon_settings"
    "archon_sources"
    "archon_tasks"
)

#
# Logging functions
#
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}ERROR${NC}: $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}WARNING${NC}: $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}INFO${NC}: $1" | tee -a "$LOG_FILE"
}

#
# Initialize metrics directory and log file
#
init_monitoring() {
    # Create metrics directory
    mkdir -p "$METRICS_DIR"

    # Create CSV file if it doesn't exist
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo "timestamp,db_size_mb,db_size_bytes,table_count,total_rows" > "$METRICS_FILE"
    fi

    log "Archon Database Size Monitoring Started"
}

#
# Check if database container is running
#
check_container() {
    if ! docker ps --filter "name=${DB_CONTAINER}" --filter "status=running" --quiet | grep -q .; then
        log_error "Database container '${DB_CONTAINER}' is not running"
        return 1
    fi
    return 0
}

#
# Get overall database size
#
get_database_size() {
    local size_bytes
    size_bytes=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
        "SELECT pg_database_size('${DB_NAME}');" 2>/dev/null || echo "0")

    local size_mb=$((size_bytes / 1024 / 1024))
    local size_pretty
    size_pretty=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
        "SELECT pg_size_pretty(pg_database_size('${DB_NAME}'));" 2>/dev/null || echo "0 bytes")

    echo "${size_mb}|${size_bytes}|${size_pretty}"
}

#
# Get Archon table sizes
#
get_table_sizes() {
    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Archon Table Sizes"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local total_rows=0
    local total_size_mb=0

    for table in "${ARCHON_TABLES[@]}"; do
        # Get row count
        local row_count
        row_count=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
            "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "0")

        total_rows=$((total_rows + row_count))

        # Get table size
        local table_size
        table_size=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
            "SELECT pg_size_pretty(pg_total_relation_size('${table}'));" 2>/dev/null || echo "0 bytes")

        local table_size_mb
        table_size_mb=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
            "SELECT pg_total_relation_size('${table}') / 1024 / 1024;" 2>/dev/null || echo "0")

        total_size_mb=$((total_size_mb + table_size_mb))

        printf "%-30s %10s rows  %12s\n" "$table" "$row_count" "$table_size" | tee -a "$LOG_FILE"
    done

    log ""
    log "Total Archon Tables: ${#ARCHON_TABLES[@]}"
    log "Total Rows: $total_rows"
    log "Total Size: ${total_size_mb}MB"

    echo "$total_rows"
}

#
# Check thresholds and generate alerts
#
check_thresholds() {
    local size_mb="$1"
    local size_pretty="$2"

    if [[ $size_mb -ge $ALERT_THRESHOLD_MB ]]; then
        log_error "Database size ($size_pretty) exceeds alert threshold (${ALERT_THRESHOLD_MB}MB)!"
        send_alert "CRITICAL" "Database size: $size_pretty (threshold: ${ALERT_THRESHOLD_MB}MB)"
        return 1
    elif [[ $size_mb -ge $WARNING_THRESHOLD_MB ]]; then
        log_warning "Database size ($size_pretty) exceeds warning threshold (${WARNING_THRESHOLD_MB}MB)"
        send_alert "WARNING" "Database size: $size_pretty (threshold: ${WARNING_THRESHOLD_MB}MB)"
        return 2
    else
        log_success "Database size ($size_pretty) is within normal limits"
        return 0
    fi
}

#
# Calculate growth rate
#
calculate_growth_rate() {
    local current_size_mb="$1"

    # Get size from 7 days ago
    local last_week_entry
    last_week_entry=$(grep "$(date -d '7 days ago' +%Y-%m-%d 2>/dev/null || date -v-7d +%Y-%m-%d 2>/dev/null)" "$METRICS_FILE" | tail -1 || echo "")

    if [[ -z "$last_week_entry" ]]; then
        log "Insufficient historical data for growth rate calculation"
        return 0
    fi

    local last_week_size_mb
    last_week_size_mb=$(echo "$last_week_entry" | cut -d',' -f2)

    local growth_mb=$((current_size_mb - last_week_size_mb))
    local growth_per_day=$((growth_mb / 7))

    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Growth Analysis"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "7-day growth: ${growth_mb}MB"
    log "Average daily growth: ${growth_per_day}MB/day"

    if [[ $growth_per_day -ge $GROWTH_ALERT_MB_PER_DAY ]]; then
        log_warning "Growth rate (${growth_per_day}MB/day) exceeds alert threshold (${GROWTH_ALERT_MB_PER_DAY}MB/day)"
        send_alert "WARNING" "High growth rate: ${growth_per_day}MB/day"
    else
        log_success "Growth rate is normal"
    fi
}

#
# Record metrics to CSV
#
record_metrics() {
    local timestamp="$1"
    local size_mb="$2"
    local size_bytes="$3"
    local total_rows="$4"
    local table_count="${#ARCHON_TABLES[@]}"

    echo "${timestamp},${size_mb},${size_bytes},${table_count},${total_rows}" >> "$METRICS_FILE"
    log "Metrics recorded to: $METRICS_FILE"
}

#
# Generate summary report
#
generate_summary() {
    local size_mb="$1"
    local size_pretty="$2"

    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Database Size Summary"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Database: $DB_NAME"
    log "Current Size: $size_pretty (${size_mb}MB)"
    log "Warning Threshold: ${WARNING_THRESHOLD_MB}MB"
    log "Alert Threshold: ${ALERT_THRESHOLD_MB}MB"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

#
# Send alert notification
#
send_alert() {
    local severity="$1"
    local message="$2"

    # Email notification (uncomment and configure)
    # echo "$message" | mail -s "Archon DB Alert [$severity]" admin@example.com

    # Slack notification (uncomment and configure)
    # curl -X POST "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
    #   -H "Content-Type: application/json" \
    #   -d "{\"text\": \"[$severity] $message\"}"

    # For now, just log
    log "Alert: [$severity] $message"
}

#
# Generate metrics visualization helper
#
generate_visualization_hint() {
    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Visualization"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Metrics file: $METRICS_FILE"
    log ""
    log "Quick visualization with gnuplot:"
    log "  gnuplot -e \"set datafile separator ','; set xdata time; set timefmt '%Y-%m-%d %H:%M:%S'; plot '${METRICS_FILE}' using 1:2 with lines title 'DB Size (MB)'\""
    log ""
    log "Or import CSV into spreadsheet/Grafana for analysis"
}

#
# Cleanup old metrics files
#
cleanup_old_metrics() {
    # Keep last 12 months of metrics
    find "$METRICS_DIR" -name "db-size-*.csv" -type f -mtime +365 -delete 2>/dev/null || true
    log "Cleaned up metrics older than 12 months"
}

#
# Main execution
#
main() {
    init_monitoring

    # Check container
    if ! check_container; then
        exit 1
    fi

    # Get database size
    local size_info
    size_info=$(get_database_size)
    local size_mb=$(echo "$size_info" | cut -d'|' -f1)
    local size_bytes=$(echo "$size_info" | cut -d'|' -f2)
    local size_pretty=$(echo "$size_info" | cut -d'|' -f3)

    # Generate summary
    generate_summary "$size_mb" "$size_pretty"

    # Get table sizes
    local total_rows
    total_rows=$(get_table_sizes)

    # Check thresholds
    check_thresholds "$size_mb" "$size_pretty"

    # Calculate growth rate
    calculate_growth_rate "$size_mb"

    # Record metrics
    record_metrics "$(date '+%Y-%m-%d %H:%M:%S')" "$size_mb" "$size_bytes" "$total_rows"

    # Cleanup old metrics
    cleanup_old_metrics

    # Visualization hint
    generate_visualization_hint

    log ""
    log "Database monitoring completed successfully"
}

main "$@"
