# Task 15: Refactor Process-Client to MVC Style

## Description
Refactor the `@gs/process-client` daemon library to strictly follow MVC principles. Organize configuration metadata, timers and loops, and HTTP formatting/logging helpers.

## Deliverables
1. **Directories**: `models/`, `controllers/`, `views/`, and `types/` under `lib/process-client/src/`.
2. **`ClientState.ts` Model**: Holds current intervals, running booleans, operational target configuration, and PID directories.
3. **`TelemetryView.ts` & `LoggerView.ts`**: High-performance representations. `LoggerView` formats/appends outputs to standard out and `process-client.log`. `TelemetryView` translates operational parameters into JSON.
4. **Controllers**:
   - `LauncherController.ts` for coordinating target lifecycle boots.
   - `PollerController.ts` for ongoing signal queries against `:9999`.
   - `HeartbeatController.ts` for registering the local project profile and firing off heartbeats strictly to `:9999` once up & healthy.

## Completion Criteria
- [ ] No more direct network references or communication loops directed to port `:10000` (`GS-Orchestrator`) inside `@gs/process-client`.
- [ ] Client registration flows strictly to `:9999` `POST /ps/project/register` on healthy component detection.
- [ ] `@gs/process-client` is build-green.

---

# Verification Steps
`npm --prefix lib/process-client run build` completes successfully.
