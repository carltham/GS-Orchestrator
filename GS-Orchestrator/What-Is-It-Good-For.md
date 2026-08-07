# Orchestrator: What is this good for?

## Problem

Managing 14 different projects is chaotic:
- **Port conflicts** — Multiple projects want port 3000
- **No visibility** — Which projects are running? On what ports?
- **Manual coordination** — Developers manually track which ports to use
- **Integration mess** — Services need to know where other services run
- **Testing chaos** — E2E tests need correct backend URL, but port might be taken

## Solution: The Orchestrator

A **standalone, always-running service** that acts as a central coordinator for all projects.

### How It Works

1. **Project Registration**
   - Project registers on startup: `POST /register { name: "gsshopper", path: "/path/to/gsshopper" }`
   - Orchestrator assigns ports: backend=4200, frontend=4201, etc.
   - Registry persisted to `registry.json`

2. **Port Allocation**
   - Dynamic port assignment from range 4200+
   - No manual port management
   - No conflicts: Orchestrator guarantees unique ports

3. **Service Discovery**
   - Project queries: `GET /ports/gsshopper`
   - Returns: `{ backend: 4200, frontend: 4201, database: 5433 }`
   - Services know exactly where to find each other

4. **Centralized Status**
   - `GET /status` shows all 14 projects
   - Which ones are running?
   - What ports are allocated?
   - Health status?

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

## Example: GSShopper with Orchestrator

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
# GSShopper registers on startup
POST /api/register
{
  "name": "gsshopper",
  "path": "/mnt/DATA/Projects/0.present-projects/Active/GSShopper"
}

# Orchestrator responds
{
  "backend": 4200,
  "frontend": 4201,
  "database": 5433
}

# Frontend queries Orchestrator at startup
GET /api/ports/gsshopper
// Receives: { backend: 4200, frontend: 4201, database: 5433 }

// Frontend automatically connects to:
export const API_URL = 'http://localhost:4200'; // Dynamic!
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Orchestrator (always running on :9000)         │
│  - Central registry of all 14 projects          │
│  - Port allocator (prevents conflicts)          │
│  - Service discovery endpoint                   │
└─────────────────────────────────────────────────┘
        ↑           ↑           ↑
        |           |           |
   Registers    Queries      Queries
   on startup   ports        status
        |           |           |
   ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
   │ Project │ │ Project │ │ Project │
   │   1     │ │   2     │ │   14    │
   └─────────┘ └─────────┘ └─────────┘
```

## Current Scope (GSShopper-First)

Starting with only what GSShopper needs:
1. Register GSShopper project → get port assignments
2. Query ports for service discovery
3. Status endpoint to see what's running

Will add more projects as needed.

---

**Status:** Foundation ready for Contract-Driven Development testing.
