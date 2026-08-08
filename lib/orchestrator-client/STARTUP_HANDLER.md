# Startup Handler Sample (`startupHandler.js`)

This document provides a sample template for `startupHandler.js`. Consuming projects using `@gs/orchestrator-client` can copy and adapt this sample at their project root (or `scripts/startupHandler.js`). When `@gs/orchestrator-client` detects that GS-Orchestrator is unreachable, it automatically executes `startupHandler.js` to restore or launch required services.

> **Note:** Consuming applications should run using standard Node (`node src/server.ts` or `node dist/server.js`) or Angular (`ng serve --port <port>`) commands rather than custom orchestrator scripts.

```javascript
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Sample Startup Handler
 * Uses standard Node / Angular / Docker commands to launch backend, frontend, and database services.
 */
function main() {
  console.log('🚀 [startupHandler] Executing project startup handler...');

  // 1. Node.js Backend Server (Standard node / ts-node execution)
  const backendPath = path.join(__dirname, 'src', 'server.ts');
  if (fs.existsSync(backendPath)) {
    console.log('⏳ Starting Backend service (node/ts-node)...');
    const backendProc = spawn('npx', ['--yes', 'ts-node', backendPath], {
      cwd: path.dirname(backendPath),
      stdio: 'inherit',
      shell: true,
      detached: true,
    });
    backendProc.unref();
    console.log('✅ Backend process spawned.');
  }

  // 2. Angular / Frontend Dev Server (Standard ng serve / vite)
  const angularConfigPath = path.join(__dirname, 'angular.json');
  if (fs.existsSync(angularConfigPath)) {
    console.log('⏳ Starting Angular frontend (ng serve)...');
    const frontendProc = spawn('npx', ['ng', 'serve', '--port', '4200'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true,
      detached: true,
    });
    frontendProc.unref();
    console.log('✅ Angular frontend process spawned.');
  }

  // 3. Database Service (Standard docker compose or local postgres)
  const dockerComposePath = path.join(__dirname, 'docker-compose.yml');
  if (fs.existsSync(dockerComposePath)) {
    console.log('⏳ Starting Database container (docker compose up)...');
    const dbProc = spawn('docker', ['compose', 'up', '-d', 'postgres'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true,
      detached: true,
    });
    dbProc.unref();
    console.log('✅ Database container start command executed.');
  }
}

main();
```
