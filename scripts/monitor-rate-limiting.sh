#!/bin/bash
#
# Rate Limiting Monitor
# Displays real-time rate limiting statistics during crawling
#

echo "=== Archon Rate Limiting Monitor ==="
echo "Watching for rate limiting events..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_event() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date +%H:%M:%S)]${NC} $message"
}

# Monitor docker logs in real-time
docker logs -f archon-server 2>&1 | while read line; do
    # Initialization
    if echo "$line" | grep -q "Initialized crawling strategy"; then
        print_event "$GREEN" "✓ Rate limiting initialized: $line"
    fi

    # Rate limit detected
    if echo "$line" | grep -q "Rate limit detected"; then
        print_event "$RED" "🚨 RATE LIMITED: $line"
    fi

    # Retry-After header
    if echo "$line" | grep -q "Retry-After"; then
        print_event "$YELLOW" "⏰ Retry-After: $line"
    fi

    # Backoff applied
    if echo "$line" | grep -q -i "backoff\|backing off"; then
        print_event "$YELLOW" "⏳ Backoff: $line"
    fi

    # robots.txt
    if echo "$line" | grep -q "robots.txt\|Crawl-Delay"; then
        print_event "$BLUE" "🤖 robots.txt: $line"
    fi

    # Rate limiter delayed
    if echo "$line" | grep -q "Rate limiter delayed"; then
        print_event "$YELLOW" "⏱ Delayed: $line"
    fi

    # Adaptive throttling
    if echo "$line" | grep -q "Adaptive\|adaptive"; then
        print_event "$BLUE" "📊 Adaptive: $line"
    fi

    # Errors
    if echo "$line" | grep -q -i "error.*rate\|rate.*error"; then
        print_event "$RED" "❌ Error: $line"
    fi
done
