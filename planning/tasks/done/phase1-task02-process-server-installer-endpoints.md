# Task 002: ProcessServer Installer Endpoints

## Phase
Phase 1: Standalone ProcessServer Microservice

## Objective
Implement static installer serving endpoints on `ProcessServer` (:9999).

## Requirements
- Serve `GET /install.sh`: Light shell script for workspace inspection over `curl`.
- Serve `GET /install.js`: Node.js inspector script fallback over `curl`.

## Definition of Done
- `curl -sSL http://localhost:9999/install.sh` returns valid shell inspector script.
- `curl -sSL http://localhost:9999/install.js` returns valid Node.js inspector script.
