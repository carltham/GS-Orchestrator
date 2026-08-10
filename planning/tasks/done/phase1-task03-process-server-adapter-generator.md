# Task 003: ProcessServer Dynamic ProcessAdapter Generator

## Phase
Phase 1: Standalone ProcessServer Microservice

## Objective
Implement environment inspection parser and dynamic `ProcessAdapter.js` compilation endpoint.

## Requirements
- Endpoint `POST /api/installer/generate` accepting workspace inspection payload (framework, package.json scripts, ports).
- Template compiler producing runnable `ProcessAdapter.js` tailored for the target workspace.

## Definition of Done
- `POST /api/installer/generate` returns compiled `ProcessAdapter.js` file content implementing `IProcessAdapter`.
