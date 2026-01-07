#!/bin/bash
#
# Archon Documentation Auto-Crawler
# Automatically queues and processes documentation sources
# Run with: nohup ./scripts/auto-crawl-docs.sh > crawl-log.txt 2>&1 &
#

set -e

# Configuration
API_BASE="http://localhost:8181"
MAX_CONCURRENT=3
CHECK_INTERVAL=30  # seconds between progress checks
LOG_FILE="/home/ljutzkanov/archon/crawl-progress.log"

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Documentation sources to crawl (in priority order)
# Format: "URL|Title|Tags"
SOURCES=(
    # Already started - skip these
    # "https://supabase.com/llms.txt|Supabase Documentation|supabase,database,backend,auth"
    # "https://zod.dev/llms.txt|Zod Schema Validation|zod,validation,typescript,schema"
    # "https://docs.stripe.com|Stripe API Documentation|stripe,payments,api"

    # Tier 1: llms.txt sources (fast)
    "https://ai.pydantic.dev/llms-full.txt|Pydantic AI Full Documentation|pydantic,ai,agents,llm"

    # Tier 2: Important framework docs
    "https://fastapi.tiangolo.com|FastAPI Documentation|fastapi,python,api,backend"
    "https://tailwindcss.com/docs|Tailwind CSS v4 Documentation|tailwind,css,ui,styling"
    "https://react.dev|React Documentation|react,frontend,ui,components"
    "https://tanstack.com/query/latest|TanStack Query Documentation|tanstack,query,react,data-fetching"

    # Tier 3: State management & forms
    "https://zustand-demo.pmnd.rs|Zustand State Management|zustand,state,react"
    "https://react-hook-form.com|React Hook Form|forms,validation,react"

    # Tier 4: UI Components
    "https://www.radix-ui.com/primitives|Radix UI Primitives|radix,ui,components,accessibility"
    "https://ui.shadcn.com|shadcn/ui Components|shadcn,ui,components,tailwind"
    "https://lucide.dev|Lucide Icons|icons,lucide,ui"

    # Tier 5: Testing
    "https://playwright.dev/docs|Playwright Testing|playwright,testing,e2e"
    "https://vitest.dev|Vitest Testing Framework|vitest,testing,unit"
    "https://docs.pytest.org/en/stable|pytest Documentation|pytest,python,testing"

    # Tier 6: AI/ML
    "https://docs.ultralytics.com|Ultralytics YOLO|yolo,cv,object-detection,ml"
    "https://www.sbert.net|Sentence Transformers|embeddings,nlp,transformers"

    # Tier 7: Database & Backend
    "https://www.sqlalchemy.org|SQLAlchemy ORM|sqlalchemy,orm,database,python"
    "https://docs.pydantic.dev/latest|Pydantic Core Documentation|pydantic,validation,python"
)

# Track active crawls
declare -A ACTIVE_CRAWLS  # progress_id -> url
COMPLETED=0
FAILED=0
CURRENT_SOURCE_INDEX=0

# Currently running crawls (from previous session)
# These will be monitored until complete before starting new ones
ACTIVE_CRAWLS["d4035f13-65ed-42f7-9029-c4a8b2d0c3bd"]="https://supabase.com/llms.txt"
ACTIVE_CRAWLS["147a1478-14f8-40de-be69-ca78eda0938f"]="https://zod.dev/llms.txt"
ACTIVE_CRAWLS["b6f9bf82-696a-435c-a5be-9b0d03f1795a"]="https://docs.stripe.com"

log() {
    local level=$1
    local msg=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] [$level] $msg" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$1"; }
log_success() { log "${GREEN}SUCCESS${NC}" "$1"; }
log_error() { log "${RED}ERROR${NC}" "$1"; }
log_warn() { log "${YELLOW}WARN${NC}" "$1"; }

# Check if API is available
check_api() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health" 2>/dev/null)
    if [ "$response" != "200" ]; then
        log_error "API not available at $API_BASE (status: $response)"
        return 1
    fi
    return 0
}

# Get number of active crawls
get_active_count() {
    echo ${#ACTIVE_CRAWLS[@]}
}

# Start a new crawl
start_crawl() {
    local source_entry=$1
    IFS='|' read -r url title tags <<< "$source_entry"

    log_info "Starting crawl: $title ($url)"

    # Build tags JSON array
    local tags_json=$(echo "$tags" | tr ',' '\n' | sed 's/^/"/;s/$/"/' | tr '\n' ',' | sed 's/,$//')
    tags_json="[$tags_json]"

    local response=$(curl -s -X POST "$API_BASE/api/knowledge-items/crawl" \
        -H "Content-Type: application/json" \
        -d "{
            \"url\": \"$url\",
            \"title\": \"$title\",
            \"knowledge_type\": \"technical\",
            \"tags\": $tags_json
        }" 2>/dev/null)

    local success=$(echo "$response" | grep -o '"success":true' || true)

    if [ -n "$success" ]; then
        local progress_id=$(echo "$response" | grep -o '"progressId":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$progress_id" ]; then
            ACTIVE_CRAWLS[$progress_id]="$url"
            log_success "Crawl started: $title (ID: $progress_id)"
            return 0
        fi
    fi

    log_error "Failed to start crawl for $url: $response"
    return 1
}

# Check crawl progress
check_crawl_progress() {
    local progress_id=$1
    local url=${ACTIVE_CRAWLS[$progress_id]}

    local response=$(curl -s "$API_BASE/api/crawl-progress/$progress_id" 2>/dev/null)

    local status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    local progress=$(echo "$response" | grep -o '"progress":[0-9.]*' | cut -d':' -f2)
    local total_pages=$(echo "$response" | grep -o '"totalPages":[0-9]*' | cut -d':' -f2)
    local processed=$(echo "$response" | grep -o '"processedPages":[0-9]*' | cut -d':' -f2)

    case "$status" in
        "completed"|"complete")
            log_success "Crawl completed: $url (${processed:-?}/${total_pages:-?} pages)"
            unset ACTIVE_CRAWLS[$progress_id]
            ((COMPLETED++))
            return 0
            ;;
        "error"|"failed")
            log_error "Crawl failed: $url"
            unset ACTIVE_CRAWLS[$progress_id]
            ((FAILED++))
            return 1
            ;;
        "crawling"|"processing"|"embedding")
            log_info "Progress: $url - ${progress:-0}% (${processed:-0}/${total_pages:-?} pages) [$status]"
            return 2  # Still running
            ;;
        *)
            log_warn "Unknown status for $url: $status"
            return 2
            ;;
    esac
}

# Main orchestration loop
orchestrate() {
    log_info "=========================================="
    log_info "Archon Auto-Crawler Started"
    log_info "Total sources to crawl: ${#SOURCES[@]}"
    log_info "Max concurrent crawls: $MAX_CONCURRENT"
    log_info "Check interval: ${CHECK_INTERVAL}s"
    log_info "=========================================="

    while true; do
        # Check API availability
        if ! check_api; then
            log_warn "API unavailable, waiting 60s..."
            sleep 60
            continue
        fi

        # Check progress of active crawls
        for progress_id in "${!ACTIVE_CRAWLS[@]}"; do
            check_crawl_progress "$progress_id"
        done

        # Start new crawls if we have capacity
        local active_count=$(get_active_count)
        while [ $active_count -lt $MAX_CONCURRENT ] && [ $CURRENT_SOURCE_INDEX -lt ${#SOURCES[@]} ]; do
            local source="${SOURCES[$CURRENT_SOURCE_INDEX]}"
            ((CURRENT_SOURCE_INDEX++))

            if start_crawl "$source"; then
                ((active_count++))
            fi

            # Small delay between starting crawls
            sleep 2
        done

        # Check if we're done
        if [ $CURRENT_SOURCE_INDEX -ge ${#SOURCES[@]} ] && [ $(get_active_count) -eq 0 ]; then
            log_info "=========================================="
            log_success "All crawls completed!"
            log_info "Completed: $COMPLETED"
            log_info "Failed: $FAILED"
            log_info "=========================================="
            break
        fi

        # Status summary
        log_info "Status: Active=${active_count}, Queued=$((${#SOURCES[@]} - CURRENT_SOURCE_INDEX)), Completed=$COMPLETED, Failed=$FAILED"

        # Wait before next check
        sleep $CHECK_INTERVAL
    done
}

# Cleanup on exit
cleanup() {
    log_info "Crawler stopped. Active crawls will continue on server."
    log_info "Check progress at: $API_BASE or http://localhost:3737"
}
trap cleanup EXIT

# Check for already running instance
PIDFILE="/tmp/archon-auto-crawl.pid"
if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "Auto-crawler already running (PID: $OLD_PID)"
        echo "To stop: kill $OLD_PID"
        exit 1
    fi
fi
echo $$ > "$PIDFILE"

# Start orchestration
orchestrate
