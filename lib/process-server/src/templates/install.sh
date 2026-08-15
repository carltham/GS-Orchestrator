#!/usr/bin/env bash
set -e

PROCESS_SERVER_URL="${PROCESS_SERVER_URL:-http://localhost:9999}"

echo "[ProcessInstaller] Installing into current project..."

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

  # Skip infrastructure packages: process-client and process-server
  if [ "$PROJECT_NAME" = "@gs/process-client" ] || [ "$PROJECT_NAME" = "@gs/process-server" ] || [ "$PROJECT_NAME" = "process-client" ] || [ "$PROJECT_NAME" = "process-server" ]; then
    echo "[ProcessInstaller] Skipping infrastructure directory: '$PROJECT_NAME'"
    return
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

  local ADAPTER_TMP
  ADAPTER_TMP=$(mktemp)
  if ! curl -fsS -X POST "$PROCESS_SERVER_URL/ps/installer/generate" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    -o "$ADAPTER_TMP"; then
    rm -f "$ADAPTER_TMP"
    echo "[ProcessInstaller] Failed to generate ProcessAdapter.js for $PROJECT_NAME" >&2
    return 1
  fi

  if ! grep -q "class ProcessAdapter" "$ADAPTER_TMP" || ! grep -q "module.exports = ProcessAdapter" "$ADAPTER_TMP"; then
    rm -f "$ADAPTER_TMP"
    echo "[ProcessInstaller] Server returned an invalid ProcessAdapter.js" >&2
    return 1
  fi

  mv "$ADAPTER_TMP" "$TARGET_DIR/ProcessAdapter.js"
  echo "[ProcessInstaller] ProcessAdapter.js installed -> $TARGET_DIR/ProcessAdapter.js"

  echo "[ProcessInstaller] Installing @gs/process-client via remote HTTP tarball package..."
  (cd "$TARGET_DIR" && npm install --no-audit --no-fund "$PROCESS_SERVER_URL/packages/process-client.tgz")

  echo "[ProcessInstaller] Downloading CLIENT_INSTALLATION.md to $TARGET_DIR..."
  curl -sSL "$PROCESS_SERVER_URL/install/instructions" > "$TARGET_DIR/CLIENT_INSTALLATION.md" || true
  echo "[ProcessInstaller] Installation complete. Run 'npm start' to start the client and local services."
}

install_project "$WORKSPACE_DIR"

echo "--------------------------------------------------"
echo "[ProcessInstaller] Current project installation complete."
