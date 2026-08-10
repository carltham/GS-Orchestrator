# Phase 0: Playwright Configuration & Top-Down UI TDD Foundation

## Overview
Establish the top-down Playwright E2E test foundation targeting the GS-Orchestrator Control Center running on port 10000.

## Key Deliverables & Specifications
- **Base URL**: `http://localhost:10000`
- **Web Server Config**: Configured to expect Express server running on port 10000 serving static Angular GUI.
- **E2E Test Specifications**: `testing/playwright/e2e/orchestrator-gui.spec.ts` updated for port 10000 navigation, health monitoring, and server process control assertions.

## Tasks
- [x] Update `testing/playwright/playwright.config.ts` `baseURL` to `http://localhost:10000`.
- [x] Update `webServer` target in `testing/playwright/playwright.config.ts` to port 10000.
- [x] Update `testing/playwright/e2e/orchestrator-gui.spec.ts` assertions to target port 10000.
- [ ] Define mock UI states for project registration, process status tracking, and control signal sending.
