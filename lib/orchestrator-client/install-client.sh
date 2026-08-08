#!/usr/bin/env bash

#
# Automated Installer for @gs/orchestrator-client
# Usage: ./install-client.sh /path/to/target-project
#

set -e

CLIENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-.}"

if [ ! -f "$TARGET_DIR/package.json" ]; then
  echo "❌ Error: Target directory '$TARGET_DIR' does not contain a package.json file."
  exit 1
fi

TARGET_ABS="$(cd "$TARGET_DIR" && pwd)"

echo "📦 Building @gs/orchestrator-client..."
(cd "$CLIENT_DIR" && npm run build)

echo "🔗 Installing @gs/orchestrator-client into '$TARGET_ABS'..."
(cd "$TARGET_ABS" && npm install "file:$CLIENT_DIR")

echo "🛠️ Generating tailored startupHandler.js for '$TARGET_ABS'..."
(cd "$TARGET_ABS" && node "$CLIENT_DIR/bin/init.js")

echo "✨ Installation complete! @gs/orchestrator-client and startupHandler.js are ready."
