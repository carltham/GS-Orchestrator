# Task 13: Scaffold Process-Server MVC & Models

## Description
Set up the structural MVC directories and core Model components under `lib/process-server/src/`. Key deliverables:
1. `models/`, `controllers/`, and `routes/` folders created.
2. `ProjectRegistry.ts` model created to support storage of active client projects, handling writing configurations into a local database file `registry.json`.
3. `ProcessRegistry.ts` model updated to follow strict OOP and house signal queues / in-memory heartbeats.

## Completion Criteria
- [x] Directory structures `lib/process-server/src/models`, `lib/process-server/src/controllers`, and `lib/process-server/src/routes` are created.
- [x] `ProjectRegistry.ts` can read, register, and update project metadata.
- [x] No compilation errors when testing directory scaffolding.

---

# Verification Steps
Verified. All models scaffolded and proxy links aligned.
