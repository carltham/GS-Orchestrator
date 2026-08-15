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
| `GET` | `/ps/process/signals` | Inspect signals without consuming; clients claim with `claim=true&projectName=...&clientInstanceId=...` |
| `POST` | `/ps/process/signals` | Enqueue a lifecycle signal (`START`, `STOP`, `DELETE`) |
| `POST` | `/ps/process/signals/:id/ack` | Acknowledge a successfully executed leased signal |
| `POST` | `/ps/process/signals/:id/nack` | Release a failed leased signal for retry |
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
| `DELETE` | `/orch/project/:name` | Queue DELETE; unregister after client acknowledgment | No |
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

