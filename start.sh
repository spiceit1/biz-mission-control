#!/bin/bash
# Mission Control — Start Script
# Runs the Next.js dev server on localhost:3000

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  🚀  Mission Control"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Douglas & Mr. Shmack 🤙 — Command Center"
echo "  http://localhost:3000"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$SCRIPT_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "  📦  Installing dependencies..."
  npm install
  echo ""
fi

# Start dev server
exec npm run dev
