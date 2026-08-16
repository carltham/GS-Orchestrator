# 📦 GS-Orchestrator Client Installation & Quickstart Guide

This target project has been configured for integration with **GS-Orchestrator** via `@gs/process-client` and a project-tailored `ProcessAdapter.js`.

During installation, the inspector reads the root `package.json`, resolves declared npm workspaces at any nested path within the bounded scan, and falls back to scanning package manifests up to three directory levels. Runtime packages and supported Docker Compose database services are sent to ProcessServer, which returns one aggregate adapter for the project. Build-only libraries and NativeScript mobile packages are not started automatically.

---

## 🚀 Quickstart: Running Your Project

### Foreground Mode
```bash
npm start
# OR
npx gs-client start
```

### Background Daemon Mode
To run `@gs/process-client` as a background daemon:

```bash
# Start in background
npx gs-client daemon
# (or: npx gs-client start -d)

# Check daemon status
npx gs-client status

# View background logs
npx gs-client logs

# Stop the daemon
npx gs-client stop
```

When started, `@gs/process-client` automatically:
1. Executes `ProcessAdapter.js` to start local backend, frontend, and database services.
2. Registers the project with `GS-Orchestrator` (`http://localhost:10000`).
3. Establishes heartbeat telemetry & signal polling with `ProcessServer` (`http://localhost:9999`).

## Startup Backup And Manual Restoration

Before changing the root startup script, the installer copies `package.json` to `package.json.process-client.backup`. If that path already exists, a timestamped backup is created instead. An existing `start` command is also preserved as `start:before-process-client`.

Installation failures are not rolled back automatically. To restore manually, use the backup path printed by the installer:

```bash
cp package.json.process-client.backup package.json
npm install
```

Review or remove the generated `ProcessAdapter.js` separately when restoring a project.

---

## 🌐 Remote Machine / Multi-Host Configuration

If `ProcessServer` or `GS-Orchestrator` is running on a remote host or custom domain, set the environment variables when running `npm start`:

```bash
PROCESS_SERVER_URL="http://<PROCESS_SERVER_HOST>:9999" \
ORCHESTRATOR_URL="http://<ORCHESTRATOR_HOST>:10000" \
npm start
```

---

## 📥 Re-installing or Updating Client on Other Machines

To install `@gs/process-client` on another target project or remote machine:

### Linux / macOS (Bash)
```bash
curl -sSL http://<PROCESS_SERVER_HOST>:9999/install.sh | bash
```

### Node.js (Cross-Platform)
```bash
curl -sSL http://<PROCESS_SERVER_HOST>:9999/install.js | node
```

### Download Installation Instructions File
```bash
curl -sSL http://<PROCESS_SERVER_HOST>:9999/install/instructions > CLIENT_INSTALLATION.md
```
