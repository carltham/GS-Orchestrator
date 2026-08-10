# Task 004: ProcessServer Signals, Heartbeats & Shutdown

## Phase
Phase 1: Standalone ProcessServer Microservice

## Objective
Implement signal polling, process heartbeat tracking, and controlled Orchestrator shutdown handling.

## Requirements
- `GET /api/process/signals`: Returns queued control commands (start/stop) for target processes.
- `POST /api/process/heartbeat`: Registers active process health and status.
- `POST /api/orchestrator/shutdown`: Receives Orchestrator shutdown requests and queues shutdown signal.

## Definition of Done
- `ProcessServer` tracks process heartbeats in memory.
- `curl -X POST http://localhost:9999/api/orchestrator/shutdown` queues a shutdown signal for GS-Orchestrator.
