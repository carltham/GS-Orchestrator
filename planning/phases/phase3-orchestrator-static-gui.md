# Phase 3: GS-Orchestrator Core Updates & Static GUI Hosting

## Overview
Update `GS-Orchestrator` backend to fixed **port 10000** and configure Express to host compiled Angular `GS-Orchestrator-GUI` as static files.

## Architectural Changes
- **Port**: Fixed **port 10000**.
- **Static Asset Hosting**: Express uses `express.static()` pointing to `GS-Orchestrator-GUI/dist/gs-orchestrator-gui/browser`.
- **SPA Fallback**: Express routes all non-API requests (`get('*')`) to `index.html`.
- **Process Management Integration**: `GS-Orchestrator` runs `@gs/process-client` and local `ProcessAdapter.js` to register itself with `ProcessServer` (:9999).

## Tasks
- [ ] Update `GS-Orchestrator/src/server.ts` port binding to 10000.
- [ ] Configure `express.static` middleware serving compiled GUI files.
- [ ] Implement wildcard route (`*`) SPA fallback to `index.html`.
- [ ] Deploy `ProcessAdapter.js` into `GS-Orchestrator` workspace.
- [ ] Wire `GS-Orchestrator` shutdown handler to exit when shutdown signal received from `ProcessServer`.
