# Task 14: Process-Server Express Routing & Controllers Migration

## Description
Decouple request handlers from `lib/process-server/src/server.ts` into individual, clean, reusable Controllers and connect them via unified routing definitions under `src/routes/`.

## Deliverables
1. **`src/controllers/InstallerController.ts`**: Serving installer binaries/files and client tarballs.
2. **`src/controllers/ProcessController.ts`**: Managing telemetry heartbeats and signal loops logic.
3. **`src/controllers/HostController.ts`**: Managing unchecked port occupancy detectors.
4. **`src/controllers/ProjectController.ts`**: Dedicated decoupled component registration controller endpoint (`POST /ps/project/register`).
5. **`src/routes/...`**: Express router configurations bridging incoming requests directly to respective Controller methods.
6. **`server.ts`**: Cleaned server file showing minimal configuration and importing routes index configuration.

## Completion Criteria
- [x] `InstallerController`, `ProcessController`, `HostController`, and `ProjectController` are implemented.
- [x] Express routers map API patterns correctly.
- [x] `server.ts` has no redundant route listeners.

---

# Verification Steps
`npm --prefix lib/process-server run build` compiles with zero errors. Passed successfully.
