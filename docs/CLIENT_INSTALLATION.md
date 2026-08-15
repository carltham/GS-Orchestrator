# 📦 GS-Orchestrator Client Installation & Quickstart Guide

This target project has been configured for integration with **GS-Orchestrator** via `@gs/process-client` and a project-tailored `ProcessAdapter.js`.

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
