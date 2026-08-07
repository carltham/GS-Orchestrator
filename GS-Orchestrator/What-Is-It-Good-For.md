# Orchestrator: What is this good for?

## Problem

Managing multiple different projects is chaotic:
- **Port conflicts** — Multiple projects want port 3000
- **No visibility** — Which projects are running? On what ports?
- **Manual coordination** — Developers manually track which ports to use
- **Integration mess** — Services need to know where other services run
- **Testing chaos** — E2E tests need correct backend URL, but port might be taken

## Solution: The Orchestrator

A **standalone, always-running service** that acts as a central coordinator for all projects.

### How It Works

1. **Project Registration**
   - Project registers on startup: `POST /api/register { projectName: "ProjectName", path: "/path/to/project" }`
   - Orchestrator assigns ports: backend=4200, frontend=4201, etc.
   - Registry persisted to `registry.json`

2. **Port Allocation**
   - Dynamic port assignment from range 4200+
   - No manual port management
   - No conflicts: Orchestrator guarantees unique ports

3. **Service Discovery & Health**
   - Health telemetry check-ins via `POST /api/health`
   - Returns allocated ports and tickets

## Benefits

### For Development
- ✅ No port conflicts between projects
- ✅ Automatic service discovery (backend knows frontend's port)
- ✅ E2E tests query Orchestrator for correct URLs
- ✅ Local development mirrors production architecture

### For Testing
- ✅ E2E tests know backend URL from Orchestrator
- ✅ Contract-Driven Development stack can verify full path
- ✅ CI/CD can query Orchestrator to find services
- ✅ Integration tests use real port assignments

### For Deployment
- ✅ Same interface works locally, staging, production
- ✅ Projects don't hardcode ports
- ✅ Central registry of all services
- ✅ Easy to monitor what's running

## Example Usage with Orchestrator

### Before (Manual)
```bash
# Developer manually picks ports
npm run backend:dev  # Hopes :3000 is free
npm run web:dev     # Hopes :5173 is free

# Frontend hardcodes backend URL
// src/services/api.ts
export const API_URL = 'http://localhost:3000'; // What if port changed?
```

### After (Orchestrator)
```bash
# Project registers on startup
POST /api/register
{
  "projectName": "MyProject",
  "path": "/mnt/DATA/Projects/Active/MyProject"
}

# Orchestrator responds
{
  "ports": {
    "backend": 4200,
    "frontend": 4201,
    "database": 5433
  },
  "ticket": "ticket-12345678"
}
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Orchestrator (always running on :9000)         │
│  - Central registry of all projects             │
│  - Port allocator (prevents conflicts)          │
│  - Health monitoring & service discovery        │
└─────────────────────────────────────────────────┘
        ↑           ↑           ↑
        |           |           |
   Registers    Sends        Checks
   on startup   health       availability
        |           |           |
   ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
   │ Project │ │ Project │ │ Project │
   │   1     │ │   2     │ │   N     │
   └─────────┘ └─────────┘ └─────────┘
```

---

**Status:** Foundation ready for multi-project service coordination.
