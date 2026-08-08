# Startup Handler Sample (`startupHandler.js`)

This document provides a comprehensive sample template for `startupHandler.js`. Consuming projects using `@gs/orchestrator-client` can copy and adapt this sample at their project root (or `scripts/startupHandler.js`). When `@gs/orchestrator-client` detects that GS-Orchestrator is unreachable, it automatically executes `startupHandler.js` to restore or launch required services.

> **Note:** This is a customizable sample template. Adapt the paths and commands below to match your project's backend, frontend, and database services.

```javascript
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Sample Startup Handler
 * Spawns required backend, frontend, and database services if not running.
 */
function main() {
  console.log('🚀 [startupHandler] Executing project startup handler...');

  // 1. Backend Service (Express / Node.js)
  const backendPath = path.join(__dirname, 'src', 'server.ts');
  if (fs.existsSync(backendPath)) {
    console.log('⏳ Starting Backend service...');
    const backendProc = spawn('npx', ['--yes', 'ts-node', backendPath], {
      cwd: path.dirname(backendPath),
      stdio: 'inherit',
      shell: true,
      detached: true,
    });
    backendProc.unref();
    console.log('✅ Backend process spawned.');
  }

  // 2. Frontend Dev Server (Vite / Angular / React)
  const frontendPkgPath = path.join(__dirname, 'package.json');
  if (fs.existsSync(frontendPkgPath)) {
    console.log('⏳ Starting Frontend dev server...');
    const frontendProc = spawn('npm', ['run', 'dev:frontend'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true,
      detached: true,
    });
    frontendProc.unref();
    console.log('✅ Frontend process spawned.');
  }

  // 3. Database Service (Docker Compose / Postgres / Local Service)
  const dockerComposePath = path.join(__dirname, 'docker-compose.yml');
  if (fs.existsSync(dockerComposePath)) {
    console.log('⏳ Starting Database container (docker-compose)...');
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
