# Phase 5: System Architectural Alignment

This phase outlines the high-level roadmap to cleanly segregate concerns and decouple **GS-Orchestrator** and **Process Server** according to the rules in [architecture/ARCHITECTURE_CLEANUP.md](architecture/ARCHITECTURE_CLEANUP.md).

---

## 1. Description & Goals
The objective of this phase is to eliminate dual-system concern leaks, making both services modular, robust, and container-compatible:
* **The Process Server** becomes a generic machine agent, entirely agnostic of orchestrated project names.
* **The GS-Orchestrator** becomes a container-safe coordinator, completely decoupled from local, native OS commands (`lsof`, `pwdx`).

---

## 2. Refactoring Timeline

```mermaid
gantt
    title Refactoring Execution Timeline
    dateFormat  YYYY-MM-DD
    section Tasks
    Task 1: PS Decoupling                       :active, t1, 2026-08-12, 1d
    Task 2: Host Scanner Migration              :        t2, after t1, 2d
    Task 3: Signal Queue Consolidation          :        t3, after t2, 2d
    Task 4: Installer Assets                    :        t4, after t3, 1d
    Task 5: Symmetrical Verification Sweep      :        t5, after t4, 1d
```

---

## 3. Exit Criteria
This phase is complete when the following benchmarks are satisfied:
1. **Zero Project References in PS:** The Process Server holds no hardcoded strings referring to `"GS-Orchestrator"`.
2. **Zero OS-level binaries executed in Orchestrator:** The Orchestrator manages registrations and server views entirely via network calls to the host Process Server machine daemon.
3. **Unified Codebase:** Both services communicate over a single standard signaling event bus.
4. **Passing Test Suites:** Standard unified SFT, SIT, and UIT suites pass consistently.
