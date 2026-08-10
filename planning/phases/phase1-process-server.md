# Phase 1: Standalone ProcessServer Microservice (`lib/process-server/`)

## Overview
Implement the standalone `ProcessServer` process engine running on dedicated untouchable fixed **port 9999**.

## Architecture & Lifecycle Rules
- **Port**: Fixed untouchable port **9999**.
- **Process Termination**: `ProcessServer` can **ONLY** be stopped via a direct Node process kill (`kill`, `SIGTERM`, `SIGKILL`).
- **Orchestrator Termination**: Receives `POST /api/orchestrator/shutdown` and issues shutdown signal to `GS-Orchestrator`.

## Key Endpoints
1. `GET /install.sh` / `GET /install.js`: Serves the light 2-stage installer scripts over `curl`.
2. `POST /api/installer/generate`: Accepts target environment inspection payload and outputs dynamically compiled `ProcessAdapter.js`.
3. `GET /api/process/signals`: Returns control signals for connected `ProcessClient` runtimes.
4. `POST /api/process/heartbeat`: Receives process health heartbeats from `ProcessClient` runtimes.
5. `POST /api/orchestrator/shutdown`: Accepts shutdown requests targeting `GS-Orchestrator`.

## Tasks
- [ ] Scaffold `lib/process-server/` directory structure (`package.json`, `tsconfig.json`, `src/server.ts`).
- [ ] Implement Express app bound to port 9999.
- [ ] Implement installer static file serving handlers (`/install.sh`, `/install.js`).
- [ ] Implement environment inspection parser & `ProcessAdapter.js` template generator.
- [ ] Implement in-memory signal queue & heartbeat tracking service.
- [ ] Implement orchestrator shutdown endpoint handler.
