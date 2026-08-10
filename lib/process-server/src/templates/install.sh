#!/usr/bin/env bash
set -e

PROCESS_SERVER_URL="${PROCESS_SERVER_URL:-http://localhost:9999}"

echo "[ProcessInstaller] Inspecting local workspace..."

WORKSPACE_DIR="$(pwd)"
HAS_PACKAGE_JSON=false
PROJECT_NAME="unknown-project"
FRAMEWORK="unknown"

if [ -f "$WORKSPACE_DIR/package.json" ]; then
  HAS_PACKAGE_JSON=true
  PROJECT_NAME=$(node -e "try { console.log(require('./package.json').name || 'unknown-project'); } catch(e) { console.log('unknown-project'); }" 2>/dev/null || echo "unknown-project")
fi

echo "[ProcessInstaller] Target project: $PROJECT_NAME"

PAYLOAD=$(cat <<EOF
{
  "workspaceDir": "$WORKSPACE_DIR",
  "projectName": "$PROJECT_NAME",
  "hasPackageJson": $HAS_PACKAGE_JSON,
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
}
EOF
)

echo "[ProcessInstaller] Requesting ProcessAdapter generation from $PROCESS_SERVER_URL/api/installer/generate ..."

RESPONSE=$(curl -s -X POST "$PROCESS_SERVER_URL/api/installer/generate" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if [ -n "$RESPONSE" ]; then
  echo "$RESPONSE" > "$WORKSPACE_DIR/ProcessAdapter.js"
  echo "[ProcessInstaller] ProcessAdapter.js successfully installed at $WORKSPACE_DIR/ProcessAdapter.js"
else
  echo "[ProcessInstaller] Error: Failed to generate ProcessAdapter.js" >&2
  exit 1
fi
