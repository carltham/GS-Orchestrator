#!/usr/bin/env bash

#
# Automated Installer for @gs/orchestrator-client
# Usage: ./install-client.sh /path/to/target-project
#

set -e

# Resolve absolute directory of this script file or fallback to known location
SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]:-$0}" 2>/dev/null || echo "$0")"
CLIENT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" 2>/dev/null && pwd)"

# If downloaded via curl pipe ($0 is bash/stdin or directory does not contain client package.json), resolve client path relative to script or environment
if [ ! -f "$CLIENT_DIR/package.json" ] || [ ! -f "$CLIENT_DIR/bin/init.js" ]; then
  CLIENT_DIR="/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator/lib/orchestrator-client"
fi

TARGET_DIR="${1:-.}"
TARGET_ABS="$(cd "$TARGET_DIR" && pwd)"

# If target directory lacks package.json, automatically initialize a minimal package.json
if [ ! -f "$TARGET_ABS/package.json" ]; then
  PROJECT_NAME="$(basename "$TARGET_ABS")"
  echo "📄 Creating package.json for '$PROJECT_NAME'..."
  (cd "$TARGET_ABS" && npm init -y >/dev/null 2>&1)
fi

echo "📦 Building @gs/orchestrator-client..."
(cd "$CLIENT_DIR" && npm run build)

echo "🔗 Installing @gs/orchestrator-client into '$TARGET_ABS'..."
(cd "$TARGET_ABS" && npm install "file:$CLIENT_DIR")

echo "🛠️ Generating tailored startupHandler.js for '$TARGET_ABS'..."
(cd "$TARGET_ABS" && npx orchestrator-init)

echo "✨ Installation complete! @gs/orchestrator-client and startupHandler.js are ready."
echo "🚀 To run the application, execute: npm start (or node startupHandler.js)"
