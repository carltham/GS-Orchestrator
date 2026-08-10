# Phase 4: Full E2E Playwright Verification & Integration Testing

## Overview
Execute end-to-end integration and Playwright UI tests against the complete multi-process architecture (`ProcessServer` on :9999, `GS-Orchestrator` & GUI on :10000).

## Test Matrix
1. **Express Static GUI**: Verify `http://localhost:10000` serves Angular control center dashboard.
2. **Curl Deployment**: Test `curl -sSL http://localhost:9999/install.sh | bash` in a sample project (`samples/orchestrator-client`).
3. **Signal Delivery**: Verify process control signals (start, stop, status) flow from GUI -> `ProcessServer` (:9999) -> `ProcessClient`.
4. **Heartbeat & Health**: Verify active process heartbeats populate in Control Center dashboard.
5. **Controlled Shutdown**: Test `curl -X POST http://localhost:9999/api/orchestrator/shutdown` cleanly stops `GS-Orchestrator` while `ProcessServer` remains active.

## Tasks
- [ ] Run Playwright UI test suite (`npx playwright test`).
- [ ] Verify installer download endpoints on port 9999.
- [ ] Verify dynamic `ProcessAdapter.js` compilation and file drop.
- [ ] Verify GUI process status cards and controls on port 10000.
- [ ] Verify full process shutdown lifecycle.
