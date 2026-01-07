#!/bin/bash
#
# Check status of all crawling operations
#

API_BASE="http://localhost:8181"

echo "=========================================="
echo "Archon Crawl Status Check"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# Check if auto-crawler is running
if [ -f /tmp/archon-auto-crawl.pid ]; then
    PID=$(cat /tmp/archon-auto-crawl.pid)
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Auto-crawler: RUNNING (PID: $PID)"
    else
        echo "Auto-crawler: STOPPED"
    fi
else
    echo "Auto-crawler: NOT STARTED"
fi
echo ""

# Get existing sources
echo "Indexed Sources:"
echo "----------------"
curl -s "$API_BASE/api/rag/sources" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    sources = data.get('sources', [])
    for s in sources:
        words = s.get('total_words', 0)
        title = s.get('title', 'Unknown')[:40]
        url = s.get('metadata', {}).get('original_url', '')[:50]
        print(f'  - {title}: {words:,} words')
        print(f'    {url}')
except:
    print('  (Unable to fetch sources)')
" 2>/dev/null

echo ""
echo "Recent Log Entries:"
echo "-------------------"
if [ -f /home/ljutzkanov/archon/crawl-progress.log ]; then
    tail -20 /home/ljutzkanov/archon/crawl-progress.log
else
    echo "  (No log file yet)"
fi
