# Test Errors & Discrepancies Log

**Date:** 2026-08-15  
**Scope:** Complete multi-stage test run (`npm run test:all`) covering SFT, SIT, and UIT (Playwright).

---

## 1. Stage 1: Functional Specifications (SFT)

### 🔴 Failure: `testing/or/sft/orchestrator-scanner.sft.test.ts`
* **Error:**
  ```
  Cannot find module '../../../GS-Orchestrator/src/context' from 'or/sft/orchestrator-scanner.sft.test.ts'
  ```
* **Root Cause:**
  `ServerScannerService` was previously migrated from `GS-Orchestrator` to `lib/process-server/` during the architectural decoupling. The test file was left behind in the `or/` test folder pointing to a deleted module path.
* **Resolution / Status:**
  Obsolete test file was removed. Active scanner testing is maintained and passing in `testing/ps/sft/process-server-scanner.sft.test.ts`.

---

## 2. Stage 2: System Integration Tests (SIT)

### 🔴 Failure: `testing/sys/sit/orchestrator-api-lifecycle.sit.test.ts`
* **Error 1 (Stop Signal Response):**
  ```
  Expected: "stopping"
  Received: "queued"
  ```
* **Error 2 (Restart Signal Response):**
  ```
  Expected: "starting"
  Received: "queued"
  ```
* **Root Cause:**
  `GS-Orchestrator` acts as a transparent proxy forwarding lifecycle requests (`/orch/project/:name/stop` and `/orch/project/:name/restart`) to `ProcessServer` (`/ps/process/signals`). `ProcessServer` enqueues a control ticket for the client adapter and responds with HTTP 201 `{ status: "queued", signal: { ... } }`. The integration test was expecting immediate synchronous transition states (`stopping` / `starting`) in the API response rather than ticket queuing.
* **Resolution / Status:**
  Updated assertions to accept `queued` status and verified that the corresponding control signal (`STOP` / `START`) is queued on `ProcessServer` (`/ps/process/signals`).

---

## 3. Stage 3: Playwright Browser Specs (UIT)

### 🔴 Failure 1: `testing/playwright/or/uit/orchestrator-gui-lifecycle.uit.ts`
* **Test Case:** `should disallow stopping the GS-Orchestrator core service from GUI`
* **Error:**
  ```
  Error: expect(received).toMatch(expected)
  Expected pattern: /Cannot stop or unregister the main Orchestrator service|Failed to stop project/
  Received string: ... Manage Project State ...
  ```
* **Root Cause:**
  When clicking "Stop Project" for `GS-Orchestrator`, the GUI presents a confirmation dialog (`Are you sure you want to stop project "GS-Orchestrator"?`). Because the test did not wait for and click the confirmation dialog before reading the body text, the error dialog (`Failed to stop project: Cannot stop or unregister the main Orchestrator service...`) had not yet been rendered.
* **Status:** Open for assertion and dialog flow refinement.

### 🔴 Failure 2: `testing/playwright/or/uit/orchestrator-gui-lifecycle.uit.ts`
* **Test Case:** `should successfully view, stop, and configure a simulated project state through GUI controls`
* **Error:**
  ```
  Test timeout of 30000ms exceeded.
  Test timeout of 30000ms exceeded while running "afterEach" hook.
  ```
* **Root Cause:**
  The test initiates a stop via the GUI modal and stops the local TCP sockets, but because there is no running `@gs/process-client` daemon in this simulation to consume the signal and send a heartbeat reporting `stopped`, the registry status remains unchanged (`running`), causing the wait condition to time out.
* **Status:** Open for updating simulated client heartbeat response after UI action.

### 🔴 Failure 3: `testing/playwright/or/uit/orchestrator-gui-lifecycle.uit.ts`
* **Test Case:** `should support full GUI lifecycle: start, stop, restart, stop again, and remove project`
* **Error:**
  ```
  Test timeout of 30000ms exceeded.
  ```
* **Root Cause:**
  Similar to Failure 2, the multi-step lifecycle test relies on simulated status transitions that require simulating client heartbeat status reports (`/ps/process/heartbeat` or `/ps/project/:name/status`) following each UI state change before the modal dialogs update.
* **Status:** Open for adjusting simulated heartbeat cycles in the test steps.

---

## 4. Summary & Verification Status

| Stage | Test Suite | Tests | Result | Actions |
|---|---|---|---|---|
| **Stage 1 (SFT)** | Functional Specs (`or/sft`, `ps/sft`, `pc/sft`) | 3 suites | ✅ PASS (after cleanup) | Deleted obsolete `orchestrator-scanner.sft.test.ts`. |
| **Stage 2 (SIT)** | System Integration Tests (`sys/sit`, `ps/sit`) | 7 suites | ✅ PASS (after assertion fix) | Aligned signal queue response assertions in `orchestrator-api-lifecycle.sit.test.ts`. |
| **Stage 3 (UIT)** | Playwright Browser Tests (`playwright/or/uit`) | 8 tests | ⚠️ 3 Failures | Needs dialog confirmation and simulated heartbeat synchronization in `orchestrator-gui-lifecycle.uit.ts`. |
