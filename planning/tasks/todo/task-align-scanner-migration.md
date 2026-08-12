# Task: Host Scanner Service Migration

This task migrates the operating-system-level server scanning operations out of the central coordinator and onto the physical machine agent, ensuring the core Orchestrator remains lightweight and cloud/container ready.

---

## Technical Goal
Decouple the Orchestrator from host-bound utilities (`lsof`, `pwdx`, and `/proc` lookups) by shifting this work to the Process Server daemon, exposing it over a clean, standardized REST route.

---

## Action Items
- [ ] Relocate `ServerScannerService.ts` from the Orchestrator directory into [lib/process-server/src/services/](lib/process-server/src/services/).
- [ ] Relocate corresponding models and data typing classes (`ServerScannerTypes.ts`, `UnregisteredServer`, etc.) to the Process Server.
- [ ] Implement a safe `GET /api/host/unregistered` route inside [lib/process-server/src/server.ts](lib/process-server/src/server.ts) that handles scanner sweeps.
- [ ] Refactor [GS-Orchestrator/src/routes/scannerRoutes.ts](GS-Orchestrator/src/routes/scannerRoutes.ts) to retrieve the lists of unmanaged port listeners over HTTP from `http://localhost:9999/api/host/unregistered`.
- [ ] Remove native OS execution imports (`child_process`, `net`, and `fs` helpers for scanner operations) from Orchestrator source files.
- [ ] Run **SFT** and **SIT** test files to verify correct scanner response compilation:
  ```bash
  npm run test:sft
  npm run test:sit
  ```
