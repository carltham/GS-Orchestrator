# Task 006: ProcessClient Launcher & Polling Engine

## Phase
Phase 2: Runtime ProcessClient Library & Installer

## Objective
Implement background polling engine and process lifecycle executor in `@gs/process-client`.

## Requirements
- 15-second signal polling loop against `http://localhost:9999/api/process/signals`.
- Heartbeat dispatch loop against `http://localhost:9999/api/process/heartbeat`.
- Invocation of local `ProcessAdapter.js` upon receiving control signals.

## Definition of Done
- `ProcessClient` polls `ProcessServer` on port 9999 and triggers `ProcessAdapter` methods.
