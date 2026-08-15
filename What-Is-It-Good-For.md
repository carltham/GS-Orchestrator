# GS-Orchestrator: What is this good for?

## Problem

Managing multiple active development projects and microservices simultaneously is chaotic:
- **Port Conflicts** — Multiple projects and sub-services try to bind to port 3000, 5173, or 8080 simultaneously.
- **Zero Visibility** — Developers lose track of which projects are running, on which ports, and what their health states are.
- **Manual Teardown & Lifecycle Hassle** — Lingering orphaned processes lock system ports and require manual `kill`/`fuser` commands.
- **Complex Integration & E2E Testing** — End-to-end tests require dynamic service discovery instead of hardcoded localhost URLs.
- **Signal & Process Coordination** — No standardized way to start, gracefully stop, restart, or safely unregister individual microservices across different project trees.

---

## Solution: The GS-Orchestrator Platform

A **decoupled, multi-tier process management and service discovery system** that coordinates active projects, allocates non-overlapping ports, routes control-plane signals, and hosts a web control center.

### Core Capabilities

1. **Dynamic Port Allocation & Registry**
   - Projects register automatically on startup via `POST /orch/project/register`.
   - Dynamic port allocator assigns dedicated, collision-free ports for `backend`, `frontend`, `database`, and custom services.
   - Master registry is stored by `ProcessServer` (`:9999`) in `db/registry.json`.

2. **Decoupled Signal Queue & Lifecycle Management**
   - Centralized control-plane signals (`START`, `STOP`, `DELETE`) queued on `ProcessServer`.
   - Local `ProcessClient` daemons poll signals and supervise child processes via `ProcessAdapter.js`.
   - Controlled state transitions: `running` ➔ `stopping` ➔ `stopped` ➔ `unregistered`.

3. **Angular Web Control Center (Unified GUI on `:10000`)**
   - Interactive dashboard displaying all registered projects, allocated ports, status badges, and registration tickets.
   - **State Management Modal**: Easily **Stop**, **Restart**, or **Remove** projects directly from the browser.
   - Built-in Superadmin access control (Thor) for protected administrative actions.

4. **Service Health & Telemetry**
   - Continuous metronome-driven telemetry and health reporting (`POST /ps/process/heartbeat`).
   - Unregistered TCP port scanner detects unmanaged background servers running on the host machine.

---

## Benefits

### For Development
- ✅ **Zero Port Collisions** — Seamlessly run 10+ projects side-by-side without port clash errors.
- ✅ **Central Dashboard** — Instant visual insight into all active services and PIDs in one unified UI.
- ✅ **Clean Lifecycle Control** — Gracefully start, stop, and restart individual projects without killing the main host daemon.
- ✅ **Standardized Adapter Interface** — Simple `ProcessAdapter.js` integration across Node.js, Angular, React, Vite, Python, and Go services.

### For Testing & CI
- ✅ **Dynamic Service Discovery** — E2E and integration tests query Orchestrator on `:10000` to find running project URLs.
- ✅ **Isolated Test Harness** — Full test automation matrix (Jest SFT, Jest SIT, and Playwright browser UIT).
- ✅ **Protected Core Immutability** — Automated safety policies prevent accidental shutdown of the core `GS-Orchestrator` hub.

---

## How It Works in Practice

### 1. Project Registration (Automatic on Startup)
```bash
POST /orch/project/register
{
  "projectName": "MyServiceApp",
  "path": "/mnt/DATA/Projects/Active/MyServiceApp",
  "serviceTypes": {
    "backend": "node-ts",
    "frontend": "angular"
  }
}
```

**Response:**
```json
{
  "ports": {
    "backend": 3000,
    "frontend": 9005
  },
  "ticket": "ticket-1786778730-8bfb8f97",
  "status": "running"
}
```

### 2. Signal-Driven Lifecycle (Stop / Restart / Remove)
```
[ Angular GUI / API ]
        │
        ▼ POST /orch/project/:name/stop  or  /restart
[ GS-Orchestrator (:10000) ]
        │
        ▼ POST /ps/process/signals { action: 'STOP' | 'START' | 'DELETE' }
[ Process Server (:9999) ] ── (Queues signal in memory)
        │
        ▼ GET /ps/process/signals (Poll every 15s)
[ Process Client Daemon ]
        │
        ▼ Calls ProcessAdapter.js
[ Child Processes (Node / Angular / Vite) ] ── Graceful start / teardown
```

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  GS-Orchestrator Hub (Express + Static Angular GUI on :10000)    │
│  - API Gateway, Superadmin Auth, Static Assets Hosting           │
│  - Project State Modal (Stop, Restart, Remove)                   │
├──────────────────────────────────────────────────────────────────┤
│  Process Server Daemon (Express on :9999)                        │
│  - Signal Queue Engine (START, STOP, DELETE)                     │
│  - Master Registry (db/registry.json) & Port Allocator           │
│  - Heartbeat Telemetry & TCP Port Scanner                        │
└──────────────────────────────────────────────────────────────────┘
        ↑                        ↑                        ↑
  Polls signals            Polls signals            Polls signals
  & Heartbeats             & Heartbeats             & Heartbeats
        |                        |                        |
 ┌──────┴───────┐         ┌──────┴───────┐         ┌──────┴───────┐
 │ Project A    │         │ Project B    │         │ Project N    │
 │ ProcessClient│         │ ProcessClient│         │ ProcessClient│
 │   Adapter    │         │   Adapter    │         │   Adapter    │
 └──────────────┘         └──────────────┘         └──────────────┘
```

---

**Status:** Production-ready multi-project orchestration platform with full SFT, SIT, and Playwright UIT test coverage.
