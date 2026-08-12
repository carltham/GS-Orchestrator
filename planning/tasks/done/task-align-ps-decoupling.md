# Task: Process Server Decoupling (PS Cleanup)

This task focuses on eliminating project-specific leaks within the Process Server host daemon, bringing it into alignment with the guidelines in [architecture/ARCHITECTURE_CLEANUP.md](architecture/ARCHITECTURE_CLEANUP.md).

---

## Technical Goal
Ensure the Process Server remains a generic, host-level background resource manager with **zero knowledge** of specific upstream orchestrators or projects.

---

## Action Items
- [x] Remove `app.post('/api/orchestrator/shutdown')` route from [lib/process-server/src/server.ts](lib/process-server/src/server.ts).
- [x] Edit [testing/ps/sit/process-server-api.sit.test.ts](testing/ps/sit/process-server-api.sit.test.ts):
  - Replace the custom orchestrator shutdown endpoint logic.
  - Modify the test to POST a standardized `"STOP"` action for target `"GS-Orchestrator"` to the generic `/api/process/signals` messaging endpoint.
- [x] Verify test suite passes sequentially with no regressions:
  ```bash
  npm run test:sit
  ```
- [x] Integrate temporary transition signaling route fallback in `DELETE /api/register/:projectName` within the Orchestrator backend (and log a todo item to fully remove this bridge in Task 3 once `signals.json` is deleted).
