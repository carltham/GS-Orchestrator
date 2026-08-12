# GS-Orchestrator System Architecture Cleanup Plan

This document outlines the architectural boundaries and decoupled responsibilities between the **GS-Orchestrator** (the central domain coordinator) and the **Process Server** (the host-level resource daemon / agent). It analyzes identified concern leakage across both systems and specifies concrete refactoring targets to establish high-integrity Separation of Concerns (SoC).

---

## 1. Domain Roles & Symmetrical Architecture

To keep the platform robust, extensible, and container-friendly, we enforce a strict divide between **Business Domain Orchestrated Logic** and **Operating System/Telemetry Collection**:

```mermaid
graph TD
    subgraph Parent Coordinator (Cloud / Container Ready)
        Orchestrator["GS-Orchestrator (:10000)"]
        RegistryService["RegistryService (Projects metadata)"]
        PortAllocator["PortAllocator (Math-based logic)"]
    end

    subgraph Generic Host Agent (Machine Resource Bound)
        ProcessServer["Process Server (:9999)"]
        PortScanner["PortScanner (lsof, TCP, pwdx, proc)"]
        InstallerServer["Installer Server (Generates adapters)"]
        SignalQueue["SignalQueue (System FIFO messages)"]
    end

    subgraph Client Application Instance
        ClientApp["Project App Client (:Ports)"]
        ProcessAdapter["ProcessAdapter.js (Local telemetry wrapper)"]
    end

    Orchestrator -->|Read Telemetry & Post Controls| ProcessServer
    ClientApp -->|Heartbeats & Pull Control Signals| ProcessServer
    ProcessAdapter -.->|Local wrapping| ClientApp
```

### The Symmetrical Separation Rules
1. **The Orchestrator Backend (`:10000`)** must remain a purely administrative, virtual orchestrator. It manages authorized roles (Thor), maintains projects registries metadata, registers ports calculations, hosting the control interfaces, and acts as the brains. **It must be completely decoupled from raw OS-level commands (like `lsof` or directory lookups).**
2. **The Process Server (`:9999`)** acts as the physical host agent. It lives directly on the metal operating system and is responsible for low-level process monitoring, serving script configurations, running custom adapter generations, and tracking server PIDs. **It must be completely blind to named app concepts like `"GS-Orchestrator"`.**

---

## 2. Identified Concern Leakage

An audit of both codebases indicates dual leakage where parent and child subsystems are duplicating each others' responsibilities:

### Leak A: Process Server Coupling with Orchestrator (Inward Leak)
- **Problem Route:** `POST /api/orchestrator/shutdown` is hardcoded inside Process Server ([lib/process-server/src/server.ts](lib/process-server/src/server.ts)).
- **The Violation:** The background service should have zero awareness of the specific coordinator name `"GS-Orchestrator"`.
- **Simplification:** Remove this custom endpoint. Any request to shut down the orchestrator should simply post a generic payload to the standard signal router queue (`/api/process/signals`).

### Leak B: Orchestrator Port Probing via `ServerScannerService` (Outward Leak)
- **Problem Module:** `ServerScannerService.ts` ([GS-Orchestrator/src/services/ServerScannerService.ts](GS-Orchestrator/src/services/ServerScannerService.ts)) performs raw TCP sockets binds, executes shell-escaped `lsof` calls, pwdx crawls, and traverses `/proc/<pid>/cwd` files.
- **The Violation:** The central Express server is executing low-level native host commands directly. This makes the central service non-portable and tightly coupled to the host environment (which breaks in standard container environments like Docker).
- **Simplification:** Relocate `ServerScannerService` directly into the **Process Server (`:9999`)**. The Orchestrator can retrieve active unmanaged server lists by making one simple network fetch to the Process Server.

### Leak C: Duplicated Signal Dispatch Databases (`signals.json` vs `service-registry`)
- **Problem Modules:** Both Orchestrator (`SignalService.ts` and `/api/signals`) and Process Server (`ProcessRegistryService.ts` and `/api/process/signals`) contain their own individual pending control message systems.
- **The Violation:** Clients are forced to pull signals from multiple distinct API endpoints.
- **Simplification:** Restructure the signaling so that all active control flows rely on the Process Server's simplified message bus. The Orchestrator simply posts STOP/START signaling directives, and clients retrieve them consistently from one location.

### Leak D: Installer Script Delivery
- **Problem Routes:** Both Orchestrator (`server.ts` GET `/install.sh`, `/install.js`) and Process Server (`server.ts` GET `/install.sh`, `/install.js`) are serving identical static installer files.
- **The Violation:** Drift risk between the local scripts versions.
- **Simplification:** Remove installer routes from the Orchestrator. Process Server holds single source-of-truth templates.

---

## 3. Future-State Refactoring Roadmap

To achieve high-quality separation, both systems must be refactored along the following tracks:

```
[Orchestrator (:10000)]                    [Process Server (:9999)]
  |                                        |
  |-- (1) Posts Stop/Start Signal -------->| (Receives generic Signal Queue)
  |-- (2) GET /api/unregistered ---------->| (Scans local ports via lsof)
  |                                        |
```

### Action Item 1: Relocate Server Scanner
* **Extract:** Move `ServerScannerService.ts` from Orchestrator src folder into `lib/process-server/src/services/`.
* **Expose:** Publish an endpoint `/api/host/unregistered` from Process Server.
* **Refactor:** Change `GS-Orchestrator`'s internal routes to retrieve this information via modern `fetch` requests.

### Action Item 2: Delete Duplicated SFT Signallers
* Delete `SignalService.ts` and `signalRoutes.ts` from Orchestrator.
* Route any manual GUI toggle inputs (such as clicking status badges) directly into a standardized HTTP request to the Process Server event queue.

### Action Item 3: Delete Duplicate Installers
* Serve `/install.sh` and `/install.js` from Process Server (`:9999`) **only**.
* Revise documentation, references, and GUI scripts download buttons to navigate users to Process Server's template directory.
