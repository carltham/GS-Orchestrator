# Phase 2: Runtime ProcessClient Library & Installer (`lib/process-client/`)

## Overview
Implement the runtime `ProcessClient` package (`@gs/process-client`) deployed into target project workspaces over `curl`.

## Deployment Workflow
1. **Stage 1 (Inspect)**: `curl -sSL http://localhost:9999/install.sh | bash` runs local workspace inspection (`package.json`, scripts, framework detection).
2. **Stage 2 (Generate)**: Inspector posts metadata to `http://localhost:9999/api/installer/generate` and writes generated `ProcessAdapter.js` into workspace root.
3. **Stage 3 (Runtime)**: Installs `@gs/process-client` library and starts background polling loop.

## Component Contract (`IProcessAdapter`)
Every generated `ProcessAdapter.js` must implement `IProcessAdapter`:
```typescript
export interface IProcessAdapter {
  start(ports: { [key: string]: number }): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<{ status: string; pid?: number }>;
}
```

## Tasks
- [ ] Scaffold `lib/process-client/` (`package.json`, `tsconfig.json`, `src/index.ts`).
- [ ] Create `install.sh` and `install.js` inspector scripts.
- [ ] Implement `ProcessClient` launcher engine (15s signal polling loop, health heartbeat loop).
- [ ] Implement local configuration caching (`config/app-config.json`).
- [ ] Export `IProcessAdapter` contract interface.
