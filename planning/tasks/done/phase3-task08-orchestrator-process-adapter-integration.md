# Task 008: GS-Orchestrator ProcessAdapter Integration

## Phase
Phase 3: GS-Orchestrator Core Updates & Static GUI Hosting

## Objective
Integrate `@gs/process-client` and `ProcessAdapter.js` into `GS-Orchestrator` workspace so it registers with `ProcessServer` (:9999).

## Requirements
- Deploy tailored `ProcessAdapter.js` to `GS-Orchestrator` root.
- Wire shutdown handler to cleanly exit `GS-Orchestrator` on receiving shutdown signal from `ProcessServer`.

## Definition of Done
- `GS-Orchestrator` registers with `ProcessServer` (:9999) and cleanly terminates upon receiving `POST /api/orchestrator/shutdown`.
