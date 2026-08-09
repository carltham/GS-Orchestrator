# GS-Orchestrator

**GS-Orchestrator** is a zero-configuration local service discovery, dynamic port allocation, and background process scanning orchestrator designed for multi-project microservice environments.

---

## 🚀 Key Features

- **⚡ Dynamic Port Allocation**: Automatically allocates non-overlapping ports for backend, frontend, and database services upon startup (runs Express API on `:9000`).
- **🖥️ Angular Control Center GUI**: Interactive web dashboard running on `:9001` providing project telemetry, server scanning, health simulation, and user management.
- **🔍 Background Process Scanner**: Proactively scans system TCP ports to detect unmanaged local development servers and background daemons.
- **📦 Client Installer Scripts**: Zero-setup client initialization scripts and prestart hooks via `@gs/orchestrator-client`.
- **🔐 User Management & Auth**: JWT-based role authentication with `SUPERADMIN` access (including default `thor` superadmin for localhost).

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Starting GS-Orchestrator
To start both the Express backend (`:9000`) and Angular Control Center GUI (`:9001`):

```bash
npm start
```

Once started:
- **Express Orchestrator API**: [http://localhost:9000](http://localhost:9000)
- **Control Center GUI**: [http://localhost:9001](http://localhost:9001)

---

## 📦 Client Installation

You can easily integrate client projects with GS-Orchestrator using the built-in installer scripts:

### Shell Installer (Linux / macOS)
```bash
curl -sSL http://localhost:9000/install.sh | bash
```

### Node.js Installer (Cross-platform)
```bash
curl -sSL http://localhost:9000/install.js | node
```

---

## 📡 API Overview

| Endpoint | Method | Description | Auth Required |
|---|---|---|---|
| `/api/register` | `POST` | Register project & allocate dynamic ports | No |
| `/api/registry` | `GET` | Retrieve list of registered projects | No |
| `/api/unregistered` | `GET` | Retrieve detected background TCP servers | No |
| `/api/health` | `POST` | Telemetry health report check-in | No |
| `/api/auth/login` | `POST` | Authenticate user (`thor` superadmin from localhost) | No |
| `/api/admin/users` | `GET/POST` | Manage users (List/Create) | `SUPERADMIN` |
| `/api/admin/users/:id` | `PUT/DELETE` | Update or delete user | `SUPERADMIN` |

---

## 🏗️ Project Structure

```
.
├── GS-Orchestrator/        # Express API backend server (Port 9000)
├── GS-Orchestrator-GUI/    # Angular 17 Control Center UI (Port 9001)
├── lib/
│   └── orchestrator-client/ # @gs/orchestrator-client library & installer scripts
├── testing/
│   └── playwright/          # E2E integration test suite
└── package.json             # Root monorepo scripts
```
