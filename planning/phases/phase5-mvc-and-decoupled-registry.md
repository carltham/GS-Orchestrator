# Phase 5: MVC Refactor & Decoupled Architecture

This document defines the structured implementation and architectural alignment plan that transitioned `lib/process-server/` and `lib/process-client/` to the MVC design pattern, and completely migrated the project registry (`db/registry.json`), port allocations, and host process scanning to the standalone `ProcessServer` (:9999).

---

## 📋 Phase 5 Breakdown

```mermaid
gantt
    title Phase 5: MVC & Decoupled Registry Realization Flow
    dateFormat  YYYY-MM-DD
    section Phase 5.1: Scaffold Server MVC
    Directories & Core Models        :done, p1, 2026-08-13, 1d
    section Phase 5.2: Server Controllers
    Port endpoints & routes to MVC   :done, p2, after p1, 1d
    section Phase 5.3: Client MVC
    Refactor client to MVC + Register:done, p3, after p2, 1d
    section Phase 5.4: Orchestrator Alignment
    Delegate registry queries to :9999:done, p4, after p3, 2d
    section Phase 5.5: Verification
    Typecheck, build & run tests     :done, p5, after p4, 1d
```

---

## 🎯 Architectural Goals & Exit Criteria

1. **Decoupled Machine Agent (`ProcessServer` :9999)**:
   - Houses persistent registry (`db/registry.json`), dynamic port allocations, TCP scanner (`/ps/host/*`), and signal queues (`/ps/process/signals`).
   - Generic machine agent enforcing core rules and protected services dynamically via `config/sys-config.json`.
2. **Container-Safe Coordinator (`GS-Orchestrator` :10000)**:
   - Hosts static Angular 17 Control Center UI and provides unified REST API gateway.
   - Zero direct local OS binary executions (`lsof`, `pwdx`); delegates registry operations and host scanning over HTTP to `ProcessServer`.
3. **MVC Architecture across Packages**:
   - `lib/process-server/src/`: Clean separation into `models/`, `controllers/`, and `routes/`.
   - `lib/process-client/src/`: Structured into `models/`, `controllers/`, and `views/`.
4. **100% Automated Test Verification**:
   - Unified SFT (Unit), SIT (Integration), and UIT (Playwright) test suites pass completely.

---

### 🔨 Phase 5.1: Process-Server Scaffold & Core Models
**Goal**: Build the directory skeleton and model domain operations under `lib/process-server/`.

- [x] Create folder structure under `lib/process-server/src/`:
  - `models/`
  - `controllers/`
  - `routes/`
- [x] **Model: ProjectRegistry (`src/models/ProjectRegistry.ts`)**:
  - Implement full JSON persistence layer matching incoming target registration parameters.
  - Implement dynamic port assignments matching scanning availability.
  - Auto-create and maintain `db/registry.json`.
- [x] **Model: ProcessRegistry (`src/models/ProcessRegistry.ts`)**:
  - Encapsulate in-memory tracking of telemetry logs, heartbeats, and signal queues.

---

### 🔨 Phase 5.2: Process-Server Express Routing & Controller Migration
**Goal**: Decouple request handlers from `server.ts` into dedicated controller classes and map them via Express routing tables.

- [x] **`InstallerController` & `installerRoutes.ts`**:
  - Expose `/install.sh`, `/install.js`, `/install/instructions`, `/packages/process-client.tgz`, and generator triggers `/ps/installer/generate`.
- [x] **`ProcessController` & `processRoutes.ts`**:
  - Expose heartbeat and signal queuing listeners (`/ps/process/heartbeat`, `/ps/process/signals`).
- [x] **`HostController` & `hostRoutes.ts`**:
  - Expose unregistered listening port scanners (`/ps/host/unregistered`, `/ps/host/check-ports`).
- [x] **`ProjectController` & `projectRoutes.ts`** (Unified Decoupled Registry controller):
  - Expose endpoint **`POST /ps/project/register`** allowing standalone clients to register services parameters, directory paths, and initial statuses.
- [x] **Clean Up `server.ts`**:
  - Strip all raw router statements, setup CORS and JSON parameters, import `/routes` index middleware, and boot listener cleanly.

---

### 🔨 Phase 5.3: Process-Client MVC Refactoring
**Goal**: Separate client-side network parameters and loops into Model-Controller contexts, removing any trace of direct Orchestrator `:10000` couplings.

- [x] Create folder structure under `lib/process-client/src/`:
  - `models/`
  - `controllers/`
  - `views/`
- [x] **Models (`ClientState.ts`, `ClientConfig.ts`)**:
  - Hold execution states, loop trackers, directory context parameters, and active configuration constants.
- [x] **Views (`TelemetryView.ts`, `LoggerView.ts`)**:
  - Decouple terminal logs printing and logging append scripts from daemon processes.
  - Map status models neatly into REST-compliant payloads.
- [x] **Controllers (`LauncherController.ts`, `PollerController.ts`, `HeartbeatController.ts`)**:
  - `LauncherController`: Starts the execution loop, spawns targets via Local `ProcessAdapter.js`, and manages target shutdown requests.
  - `HeartbeatController`: Performs periodic telemetry heartbeats (`POST /ps/process/heartbeat`). Once components are healthy, **performs client-driven registration directly to `ProcessServer` via `POST /ps/project/register`**.
  - `PollerController`: Checks signal streams (`GET /ps/process/signals`) and delegates startup/shutdown orders to adapter threads.

---

### 🔨 Phase 5.4: Orchestrator Service Realignment & Data Binding
**Goal**: Transition `GS-Orchestrator` (`:10000`) and the Angular GUI to pull registries recursively from `ProcessServer` (:9999).

- [ ] **Refactor `ServerScannerService` inside `:10000`**:
  - Clean up scanning loop to poll active projects directly from `ProcessServer`'s list of registered heartbeats (`GET http://localhost:9999/ps/process/heartbeats`).
  - Auto-map heartbeats back into the local cache.
- [ ] **Refactor `RegistryService` inside `:10000`**:
  - Since the source of truth is now `ProcessServer`'s registration registry, update endpoints to either act as a read-through proxy to `ProcessServer`'s routes or fetch directly from the remote domain registry.

---

### 🔨 Phase 5.5: Unified Compilation & Test Pass
**Goal**: Run verification sweeps to verify everything is compilation-green and all integration suites pass.

- [ ] Core type-check and TS build pass across all workspaces:
  - `npm run build` at workspace root.
- [ ] Integration validation test passage:
  - Run Playwright E2E verification specs (`npm run test:uit`).
  - Run Unit/Integration regression sweeps (`npm run test:sft`, `npm run test:sit`).
