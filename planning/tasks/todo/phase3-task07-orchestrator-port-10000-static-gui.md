# Task 007: GS-Orchestrator Port 10000 & Express Static GUI Hosting

## Phase
Phase 3: GS-Orchestrator Core Updates & Static GUI Hosting

## Objective
Update `GS-Orchestrator` server to run on port 10000 and statically host compiled `GS-Orchestrator-GUI` assets.

## Requirements
- `GS-Orchestrator/src/server.ts` configured for port **10000**.
- Express `express.static()` middleware pointing to compiled Angular static files.
- Wildcard route (`*`) fallback to `index.html`.

## Definition of Done
- `GS-Orchestrator` on port 10000 serves backend API routes and GUI static files.
