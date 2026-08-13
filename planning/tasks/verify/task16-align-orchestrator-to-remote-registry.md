# Task 16: Align GS-Orchestrator to Remote Process-Server Registry

## Description
Remove local `registry.json` writing and port allocation logic from `GS-Orchestrator` (`:10000`). Refactor it to act as a unified dashboard / control client pulling dynamic registrations directly from `ProcessServer` (`:9999`) over local or remote network connections.

## Deliverables
1. **`ServerScannerService` inside `:10000`**: Refactor scanning loops to read registered heartbeats and active projects via `GET http://localhost:9999/ps/process/heartbeats`. Map results cleanly into local structures for the Angular view interface.
2. **`RegistryService` inside `:10000`**: Convert registry database operations to delegate writes or proxy reads straight to Process Server's registries.

## Completion Criteria
- [ ] No split registry tables. `ProcessServer` (:9999) holds master authority over project registrations.
- [ ] Central Control GUI renders live elements dynamically based on polled remote registers.

---

# Verification Steps
`npm --prefix GS-Orchestrator run build` runs with zero compilation errors.
