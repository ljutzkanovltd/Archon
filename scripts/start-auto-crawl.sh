#!/bin/bash
#
# Start the auto-crawler in background
# Usage: ./scripts/start-auto-crawl.sh
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/home/ljutzkanov/archon/crawl-progress.log"

echo "Starting Archon Auto-Crawler..."
echo ""

# Clear previous log
> "$LOG_FILE"

# Start in background with nohup
nohup "$SCRIPT_DIR/auto-crawl-docs.sh" >> "$LOG_FILE" 2>&1 &
PID=$!

echo "Auto-crawler started with PID: $PID"
echo ""
echo "Commands:"
echo "  View live progress:  tail -f $LOG_FILE"
echo "  Check status:        cat /tmp/archon-auto-crawl.pid && ps aux | grep auto-crawl"
echo "  Stop crawler:        kill $PID"
echo "  Dashboard:           http://localhost:3737"
echo ""
echo "The crawler will:"
echo "  - Process 18 documentation sources"
echo "  - Run max 3 crawls in parallel"
echo "  - Continue even if you close this terminal"
echo "  - Log all progress to: $LOG_FILE"
echo ""
echo "Safe to leave now!"
