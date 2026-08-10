# Task 001: Scaffold ProcessServer (`lib/process-server/`)

## Phase
Phase 1: Standalone ProcessServer Microservice

## Objective
Create initial directory structure and config files for `lib/process-server/`.

## Requirements
- `package.json` with Express and TypeScript dependencies.
- `tsconfig.json` for compilation to Node.js / ES2022.
- `src/server.ts` entry point setting up Express app listening on fixed untouchable port **9999**.

## Definition of Done
- Express server boots on port 9999.
- `GET /health` returns `{ status: 'ok', server: 'ProcessServer', port: 9999 }`.
