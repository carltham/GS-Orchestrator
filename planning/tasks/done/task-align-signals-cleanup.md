# Task: Signal Queue Consolidation (Drop signals.json)

Consolidate the split message brokers of both projects onto the sole process signal manager of the Process Server daemon, removing redundant disk state storage configurations.

---

## Technical Goal
Standardize client coordination APIs onto a single message bus, dropping `signals.json` file states from the Orchestrator service.

---

## Action Items
- [ ] Delete `SignalService.ts` from of [GS-Orchestrator/src/services/](GS-Orchestrator/src/services/).
- [ ] Delete [GS-Orchestrator/src/routes/signalRoutes.ts](GS-Orchestrator/src/routes/signalRoutes.ts) from the routing list.
- [ ] Delete the unused static file state database `GS-Orchestrator/signals.json` from the root tree.
- [ ] Refactor button controller actions within the Angular GUI landing widgets:
  - Route manual STOP/START triggers as automated HTTP POST payloads directly hitting Process Server's signaling broker:
    ```http
    POST http://localhost:9999/api/process/signals
    ```
- [ ] Clear references in SFT registration tests to mock signal state registers.
- [ ] Run test sweeps:
  ```bash
  npm run test:sft
  ```
