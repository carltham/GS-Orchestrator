#!/usr/bin/env bash
set -e

PROCESS_SERVER_URL="${PROCESS_SERVER_URL:-http://localhost:9999}"

echo "[ProcessInstaller] Recursively scanning workspace for projects (up to 3 levels deep)..."

WORKSPACE_DIR="$(pwd)"

install_project() {
  local TARGET_DIR="$1"
  local PKG_PATH="$TARGET_DIR/package.json"
  
  if [ ! -f "$PKG_PATH" ]; then
    return
  fi

  local PROJECT_NAME
  PROJECT_NAME=$(node -e "try { console.log(require('$PKG_PATH').name || ''); } catch(e) { console.log(''); }" 2>/dev/null || echo "")

  if [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME=$(basename "$TARGET_DIR")
  fi

  echo "--------------------------------------------------"
  echo "[ProcessInstaller] Found project: '$PROJECT_NAME' in $TARGET_DIR"

  local PAYLOAD
  PAYLOAD=$(cat <<EOF
{
  "workspaceDir": "$TARGET_DIR",
  "projectName": "$PROJECT_NAME",
  "hasPackageJson": true,
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
}
EOF
  )

  local RESPONSE
  RESPONSE=$(curl -s -X POST "$PROCESS_SERVER_URL/api/installer/generate" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  if [ -n "$RESPONSE" ]; then
    echo "$RESPONSE" > "$TARGET_DIR/ProcessAdapter.js"
    echo "[ProcessInstaller] ProcessAdapter.js installed -> $TARGET_DIR/ProcessAdapter.js"
  else
    echo "[ProcessInstaller] Warning: Failed to generate ProcessAdapter.js for $PROJECT_NAME" >&2
  fi
}

# Find all directories containing package.json (excluding node_modules and .git) up to 3 levels deep
while IFS= read -r PKG_FILE; do
  DIR=$(dirname "$PKG_FILE")
  install_project "$DIR"
done < <(find "$WORKSPACE_DIR" -maxdepth 3 \( -name node_modules -o -name .git -o -name dist \) -prune -o -name "package.json" -print)

echo "--------------------------------------------------"
echo "[ProcessInstaller] Recursive project discovery & installation complete."
