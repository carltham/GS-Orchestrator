# 📑 SYSTEM ENDPOINTS INVESTIGATION & DETECTED REST SMELLS

## 1. Executive Summary & Core REST Malpractice
During a deep mechanical scan of the Express applications (Orchestrator Backend and Process Server Daemon), several architectural smells and anti-patterns were detected. These include noun-verb route blending, lack of clear context categorization, and components directly initiating naked HTTP requests on arbitrary ports rather than passing through dedicated Angular service layers.

To maintain strict Separation of Concerns (SoC) and robust enterprise standards, we have completely decoupled and renamed these endpoints into distinct namespaces:
- **`/ps/` (Process Server Context - Port 9999)**: Directly interacts with physical OS process tables, sockets, and task runners.
- **`/orch/` (Virtual Orchestrator Context - Port 10000)**: Coordinates client registrations, JWT admin controls, and virtual status states.
- **`/reports/` (High-Level Telemetry Checkpoint - Port 10000)**: Serves unified environment reporting metrics.

---

## 2. API Contract Refactoring & Namespace Mapping

| Legacy Endpoint (Smelly/Fussy) | Clean Restructured Endpoint | System Responsibility | Context Area |
| :--- | :--- | :--- | :--- |
| **GET** `/health` | **GET** `/reports/health` | Central status heartbeat for Orchestrator Port 10000 | `/reports` |
| **GET** `/api/health` | **GET** `/orch/reporting/health` | Status details block of admin engine | `/orch/reporting` |
| **POST** `/api/health` | **POST** `/orch/reporting/project/health` | Project ping telemetry checkpoint | `/orch/reporting` |
| **POST** `/api/register` | **POST** `/orch/project/register` | Assign components dynamic ports and registers project | `/orch/project` |
| **DELETE** `/api/register/:name` | **DELETE** `/orch/project/:name` | Set project status to `stopping` & queue STOP task | `/orch/project` |
| **POST** `/api/register/:name/stopped` | **POST** `/orch/reporting/project/:name/is-stopped` | Callback receipt verifying client finished shutting down | `/orch/reporting` |
| **GET** `/api/registry` | **GET** `/orch/project/registry` | Fetch clean configuration state of all projects | `/orch/project` |
| **GET** `/api/count` | **GET** `/orch/project/count` | Get total count of registered projects | `/orch/project` |
| **GET** `/api/unregistered` | **GET** `/orch/project/unregistered` | Fetch active unregistered listeners from scan cache | `/orch/project` |
| **POST** `/api/installer/generate` | **POST** `/ps/installer/generate` | Compiles ProcessAdapter boilerplate payload | `/ps/installer` |
| **GET** `/api/process/signals` | **GET** `/ps/process/signals` | Retrieve target project signal items (Port 9999 queue) | `/ps/process` |
| **POST** `/api/process/signals` | **POST** `/ps/process/signals` | Push change of state transition signal to daemon queue | `/ps/process` |
| **POST** `/api/process/heartbeat` | **POST** `/ps/process/heartbeat` | Native background agent check-ins | `/ps/process` |
| **GET** `/api/process/heartbeats` | **GET** `/ps/process/heartbeats` | List all tracked machine processes | `/ps/process` |
| **GET** `/api/host/unregistered` | **GET** `/ps/host/unregistered` | Launches native OS socket checks and lsof crawling | `/ps/host` |
| **POST** `/api/host/check-ports` | **POST** `/ps/host/check-ports` | Performs bulk TCP socket scanner probes | `/ps/host` |

---

## 3. Angular Architectural Smells & Strictly Enforced Rules

### 🚨 Detected Smell: UI Components Making Naked HTTP Probes
In `GS-Orchestrator-GUI`, the `UsersPageComponent` was discovered to run raw client operations directly in its layout class:
```typescript
// ❌ INCORRECT - Naked HTTP calls directly in UI component
this.http.get<any>('/api/admin/users', { headers: ... }).subscribe(...)
```

### 🎯 Strictly Enforced Angular Rule: **Service Separation**
- **UI Components** (`.component.ts`) **must never** import `HttpClient` or make direct network requests. They must remain completely decoupled from network layers and only handle local variables, user input triggers, and visual data bindings.
- **Service Providers** (`.service.ts`) serve as the exclusive gatekeepers of all HTTP channels. All HTTP calls must go through cohesive, dedicated services (e.g. `AuthService`, `OrchestratorService`, or a new `AdminUserService`).

---

## 4. Next Step Implementation Actions

1.  **Refactor Node Client (lib/process-client)**: Adjust internal fetching routines from `/api/process/...` to `/ps/process/...`.
2.  **Refactor Test Assertions (testing/)**: Update all SFT and SIT integration calls to assert against `/ps/...`, `/orch/...`, and `/reports/...` routes.
3.  **Validate Run-All Sequence**: Execute `npm run test:all` to run functional, integration, and UI verification scripts in a unified sequence.
