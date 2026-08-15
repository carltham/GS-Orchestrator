# 📡 GS-Orchestrator API Endpoints

This document lists all active HTTP API endpoints across **ProcessServer** (`:9999`) and **GS-Orchestrator** (`:10000`).

---

## 🛠️ ProcessServer Endpoints (Port `9999`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/ps/health` | Basic ProcessServer health check |
| `GET` | `/ps/client/sh` | Download Linux/macOS shell client installer script |
| `GET` | `/ps/client/js` | Download cross-platform Node.js client installer script |
| `GET` | `/ps/client/instructions` | Download client installation & quickstart markdown guide |
| `GET` | `/ps/client/tgz` | Download compiled `@gs/process-client` tarball package |
| `POST` | `/ps/client/adapter` | Compile and return tailored `ProcessAdapter.js` |
| `GET` | `/ps/project/list` | Retrieve all registered projects and allocated ports |
| `POST` | `/ps/project/register` | Register a project and allocate dynamic ports |
| `GET` | `/ps/project/:name` | Retrieve details for a specific registered project |
| `DELETE` | `/ps/project/:name` | Unregister a project and release allocated ports |
| `PATCH` | `/ps/project/:name/status` | Update the runtime status of a registered project |
| `GET` | `/ps/process/signals` | Retrieve queued lifecycle signals for a project (`?projectName=...`) |
| `POST` | `/ps/process/signals` | Enqueue a lifecycle signal (`START`, `STOP`, `DELETE`) |
| `POST` | `/ps/process/signals/ack` | Acknowledge processed lifecycle signals |
| `POST` | `/ps/process/heartbeat` | Receive runtime telemetry heartbeat from ProcessClient |
| `GET` | `/ps/process/heartbeats` | Retrieve all tracked active process heartbeats |
| `GET` | `/ps/host/unregistered` | Scan OS network sockets (`ss`/`lsof`) for unmanaged TCP listeners |
| `POST` | `/ps/host/check-ports` | Batch-probe host TCP ports for socket occupancy |

---

## 🎯 GS-Orchestrator Endpoints (Port `10000`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/orch/health` | Basic Orchestrator health check | No |
| `GET` | `/orch/health/detailed` | Detailed Orchestrator health status | No |
| `POST` | `/orch/reporting/project/health` | Receive telemetry health report from project | No |
| `POST` | `/orch/reporting/project/:name/is-stopped` | Callback receipt verifying client completed shutdown | No |
| `POST` | `/orch/project/register` | Register a project and allocate dynamic ports | No |
| `GET` | `/orch/project/registry` | Retrieve list of all registered projects | No |
| `GET` | `/orch/project/count` | Retrieve total count of registered projects | No |
| `DELETE` | `/orch/project/:name` | Unregister project and initiate stop sequence | No |
| `POST` | `/orch/project/:name/start` | Queue START signal for a project | No |
| `POST` | `/orch/project/:name/stop` | Queue STOP signal for a project | No |
| `POST` | `/orch/project/:name/restart` | Queue RESTART signal for a project | No |
| `GET` | `/orch/project/unregistered` | Retrieve cached list of unmanaged background servers | No |
| `POST` | `/auth/login` | User login (returns JWT session) | No |
| `POST` | `/auth/logout` | User logout | No |
| `GET` | `/auth/current-user` | Get currently authenticated user profile | No |
| `GET` | `/auth/check` | Validate current session token | No |
| `GET` | `/admin/users` | List all registered users | `SUPERADMIN` |
| `POST` | `/admin/users` | Create a new user account | `SUPERADMIN` |
| `PUT` | `/admin/users/:id` | Update user details or role | `SUPERADMIN` |
| `DELETE` | `/admin/users/:id` | Delete user account | `SUPERADMIN` |
| `POST` | `/admin/users/:id/disable` | Disable user account | `SUPERADMIN` |
| `POST` | `/admin/users/:id/enable` | Enable user account | `SUPERADMIN` |
| `POST` | `/admin/users/:id/change-password` | Change user password | `SUPERADMIN` |

---

## 🔄 Relayed API Calls (GS-Orchestrator `:10000` ➔ ProcessServer `:9999`)

The following calls are received by `GS-Orchestrator` and internally relayed or delegated to `ProcessServer`:

| Inbound Orchestrator Call (`:10000`) | Trigger / Origin | Relayed ProcessServer Call (`:9999`) | Purpose |
|---|---|---|---|
| `GET /orch/project/registry` | Frontend / GUI | `GET /ps/project/list` | Sync and retrieve active project allocations & port bindings |
| `GET /orch/project/count` | Frontend / GUI | `GET /ps/project/list` | Calculate registered project count from master registry |
| `POST /orch/project/register` | Client / GUI | `POST /ps/project/register` | Forward project registration & dynamic port allocation to ProcessServer |
| `POST /orch/project/:name/start` | Frontend / GUI | `POST /ps/process/signals`<br>`PATCH /ps/project/:name/status` | Queue `START` lifecycle signal and mark project status `running` |
| `POST /orch/project/:name/stop` | Frontend / GUI | `POST /ps/process/signals`<br>`PATCH /ps/project/:name/status` | Queue `STOP` lifecycle signal and mark project status `stopping` |
| `POST /orch/project/:name/restart` | Frontend / GUI | `POST /ps/process/signals`<br>`PATCH /ps/project/:name/status` | Queue `STOP` + `START` lifecycle signals |
| `DELETE /orch/project/:name` | Frontend / GUI | `POST /ps/process/signals`<br>`DELETE /ps/project/:name` | Queue `DELETE` signal and unregister project from master registry |
| Background Periodic Scan | Orchestrator Scanner (30s) | `POST /ps/host/check-ports` | Batch socket occupancy check for registered component ports |
| `GET /orch/project/unregistered` | Orchestrator Scanner / GUI | `GET /ps/host/unregistered` | Query low-level host OS socket scanner (`ss`/`lsof`) excluding known ports |

