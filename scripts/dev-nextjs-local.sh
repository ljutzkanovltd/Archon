#!/usr/bin/env bash
#
# dev-nextjs-local.sh - Start Next.js frontend locally for development
#
# PURPOSE:
#   Start Next.js frontend on host machine for fast hot-reload development
#   Backend must be running in Docker (use: ./start-archon.sh --skip-nextjs)
#
# USAGE:
#   ./scripts/dev-nextjs-local.sh
#
# PREREQUISITES:
#   - Backend running in Docker on port 8181
#   - Node.js and npm installed
#
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NEXTJS_DIR="$PROJECT_ROOT/archon-ui-nextjs"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Archon Next.js - Local Development Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if backend is running
echo "[1/4] Checking backend availability..."
if ! curl -s http://localhost:8181/health > /dev/null 2>&1; then
  echo "❌ ERROR: Backend not running on port 8181"
  echo ""
  echo "Start backend first with:"
  echo "  ./start-archon.sh --skip-nextjs"
  echo ""
  exit 1
fi

echo "✅ Backend detected on port 8181"
echo ""

# Navigate to Next.js directory
cd "$NEXTJS_DIR"

# Check/create .env.local with correct settings
echo "[2/4] Configuring environment..."
if [ ! -f .env.local ]; then
  cat > .env.local << 'EOF'
# Local development configuration (hybrid mode)
# Both browser and Next.js server run on host, so both use localhost

# Browser context (client-side JavaScript)
NEXT_PUBLIC_API_URL=http://localhost:8181
NEXT_PUBLIC_MCP_URL=http://localhost:8051

# Server context (SSR + proxy rewrites)
# In hybrid mode, Next.js server also runs on host, so use localhost
API_SERVER_URL=http://localhost:8181
EOF
  echo "✅ Created .env.local with local backend URLs"
else
  # Verify existing .env.local has correct URL
  if grep -q "archon-server" .env.local; then
    echo "⚠️  WARNING: .env.local contains 'archon-server' (Docker hostname)"
    echo "   Updating to 'localhost' for local development..."
    sed -i.backup 's/archon-server/localhost/g' .env.local
    echo "✅ Updated .env.local (backup saved as .env.local.backup)"
  else
    echo "✅ .env.local already configured correctly"
  fi
fi
echo ""

# Install dependencies if needed
echo "[3/4] Checking dependencies..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  echo "📦 Installing dependencies (this may take a few minutes)..."
  npm install
  echo "✅ Dependencies installed"
else
  echo "✅ Dependencies already installed"
fi
echo ""

# Start dev server
echo "[4/4] Starting Next.js dev server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎨 Next.js UI:  http://localhost:3738"
echo "  🔧 Backend API: http://localhost:8181"
echo "  📡 MCP Server:  http://localhost:8051"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop the dev server"
echo ""

# Start Next.js dev server
npm run dev
