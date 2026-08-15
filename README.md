# GS-Orchestrator

**GS-Orchestrator** is a zero-configuration local service discovery, dynamic port allocation, and background process scanning orchestrator designed for multi-project microservice environments.

---

## 🚀 Key Features

- **⚡ Dynamic Port Allocation**: Automatically allocates non-overlapping ports for backend, frontend, and database services upon startup (runs Express API on `:10000` and Process Server on `:9999`).
- **🖥️ Angular Control Center GUI**: Interactive web dashboard running on `:9001` providing project telemetry, server scanning, health simulation, and user management.
- **🔍 Background Process Scanner**: Proactively scans system TCP ports to detect unmanaged local development servers and background daemons.
- **📦 Client Installer Scripts**: Zero-setup client initialization scripts and background daemon support via `@gs/process-client`.
- **🔐 User Management & Auth**: JWT-based role authentication with `SUPERADMIN` access (including default `thor` superadmin for localhost).

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Starting GS-Orchestrator
To start the services:

```bash
# Start Process Server (Daemon / Port 9999)
npm run server:start

# Start GS-Orchestrator Backend (Port 10000) & GUI (Port 9001)
npm start
```

Once started:
- **Process Server API**: [http://localhost:9999](http://localhost:9999)
- **GS-Orchestrator Backend API**: [http://localhost:10000](http://localhost:10000)
- **Control Center GUI**: [http://localhost:9001](http://localhost:9001)

---

## 📦 Client Installation

You can easily integrate client projects with GS-Orchestrator using the built-in installer scripts served by ProcessServer:

### Shell Installer (Linux / macOS)
```bash
curl -sSL http://localhost:9999/install.sh | bash
```

### Node.js Installer (Cross-platform)
```bash
curl -sSL http://localhost:9999/install.js | node
```

---

## 📡 API Overview

### GS-Orchestrator Control Plane (`:10000`)
| Endpoint | Method | Description | Auth Required |
|---|---|---|---|
| `/orch/project/register` | `POST` | Register project & allocate dynamic ports | No |
| `/orch/project/registry` | `GET` | Retrieve list of registered projects | No |
| `/orch/project/unregistered` | `GET` | Retrieve detected background TCP servers | No |
| `/orch/reporting/project/health` | `POST` | Telemetry health report check-in | No |
| `/orch/reporting/health` | `GET` | Orchestrator health check | No |
| `/auth/login` | `POST` | Authenticate user (`thor` superadmin from localhost) | No |
| `/admin/users` | `GET/POST` | Manage users (List/Create) | `SUPERADMIN` |
| `/admin/users/:id` | `PUT/DELETE` | Update or delete user | `SUPERADMIN` |

### ProcessServer (`:9999`)
| Endpoint | Method | Description |
|---|---|---|
| `/ps/installer/generate` | `POST` | Generate dynamic `ProcessAdapter.js` |
| `/ps/process/signals` | `GET/POST` | Persisted leased signal queue; inspection is non-destructive |
| `/ps/process/signals/:id/ack` | `POST` | Confirm successful signal execution |
| `/ps/process/signals/:id/nack` | `POST` | Release failed signal for retry |
| `/ps/process/heartbeat` | `POST` | ProcessClient runtime telemetry heartbeat |
| `/ps/host/unregistered` | `GET` | Low-level OS socket & port scanner |

---

## 🏗️ Project Structure

```
.
├── GS-Orchestrator/        # Express API backend & static UI host (Port 10000)
│   ├── src/                # Node/Express server & reverse proxy
│   └── angular/            # Angular 17 Control Center UI source
├── lib/
│   ├── process-client/     # @gs/process-client runtime daemon & CLI
│   └── process-server/     # @gs/process-server registry & signal daemon (Port 9999)
├── testing/
│   ├── playwright/          # E2E Playwright test suite
│   └── sys/                 # System functional & integration test suites
└── package.json             # Root monorepo scripts
```
