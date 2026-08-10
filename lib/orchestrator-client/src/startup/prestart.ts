import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  getOrchestratorHost,
  getOrchestratorPort,
  isOrchestratorAvailable,
  registerWithOrchestrator,
} from '../api/apiClient';
import { findProjectRoot, writeConfig } from '../config';
import { OrchestratorResponse } from '../types';

export async function attemptStartupHandler(): Promise<boolean> {
  const rootDir = findProjectRoot(process.cwd());

  const tsFileRoot = path.join(rootDir, 'startupHandler.ts');
  const jsFileRoot = path.join(rootDir, 'startupHandler.js');
  const tsFileScripts = path.join(rootDir, 'scripts', 'startupHandler.ts');
  const jsFileScripts = path.join(rootDir, 'scripts', 'startupHandler.js');

  const targetModulePath = [jsFileRoot, tsFileRoot, jsFileScripts, tsFileScripts].find((p) => fs.existsSync(p));

  if (targetModulePath) {
    try {
      if (targetModulePath.endsWith('.ts')) {
        require('ts-node/register');
      }
      const imported = require(targetModulePath);
      const handlerInstance = imported.default || imported.startupHandler || imported;

      if (handlerInstance && typeof handlerInstance.start === 'function') {
        console.log(`🚀 Invoking StartupHandler.start() from ${path.relative(rootDir, targetModulePath)}...`);
        await handlerInstance.start();

        const startTime = Date.now();
        while (Date.now() - startTime < 15000) {
          await new Promise((r) => setTimeout(r, 500));
          const available = await isOrchestratorAvailable();
          if (available) {
            console.log('✅ GS-Orchestrator successfully started by StartupHandler!');
            return true;
          }
        }
        return false;
      }
    } catch (err) {
      // Fallback to spawning process if require/import fails
    }
  }

  let command = '';
  let args: string[] = [];

  if (fs.existsSync(tsFileRoot)) {
    command = 'node';
    args = ['-r', 'ts-node/register', tsFileRoot];
  } else if (fs.existsSync(jsFileRoot)) {
    command = 'node';
    args = [jsFileRoot];
  } else if (fs.existsSync(tsFileScripts)) {
    command = 'node';
    args = ['-r', 'ts-node/register', tsFileScripts];
  } else if (fs.existsSync(jsFileScripts)) {
    command = 'node';
    args = [jsFileScripts];
  }

  if (!command) {
    console.warn('⚠️  No local startup handler found in project root or scripts');
    return false;
  }

  console.log(`🚀 Executing local startup handler: ${command} ${args.join(' ')}...`);
  try {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
      detached: true,
    });
    child.unref();

    // Poll the orchestrator server for up to 15 seconds to give server time to compile/bind
    const startTime = Date.now();
    while (Date.now() - startTime < 15000) {
      await new Promise((r) => setTimeout(r, 500));
      const available = await isOrchestratorAvailable();
      if (available) {
        console.log('✅ GS-Orchestrator successfully started by startup handler!');
        return true;
      }
    }
  } catch (err) {
    console.error('❌ Failed to execute startup handler:', err);
  }

  return false;
}

export async function runPrestart(): Promise<OrchestratorResponse> {
  const componentArg = process.argv[2];

  if (!componentArg || !['backend', 'frontend', 'mobile'].includes(componentArg)) {
    console.warn('⚠️  No component specified (backend|frontend|mobile), proceeding anyway');
  }

  const host = getOrchestratorHost();
  const port = getOrchestratorPort();

  try {
    console.log(`🔍 Prestart agent: Querying GS-Orchestrator on ${host}:${port}...`);
    const ports = await registerWithOrchestrator();

    const expectedDbPort = process.env.BASE_DATABASE_PORT
      ? parseInt(process.env.BASE_DATABASE_PORT, 10)
      : undefined;
    const expectedBackendPort = process.env.BASE_BACKEND_PORT
      ? parseInt(process.env.BASE_BACKEND_PORT, 10)
      : undefined;
    const expectedFrontendPort = process.env.BASE_FRONTEND_PORT
      ? parseInt(process.env.BASE_FRONTEND_PORT, 10)
      : undefined;

    const strictEnforcement = process.env.STRICT_PORT_ENFORCEMENT === 'true';

    let mismatch = false;
    if (expectedDbPort && ports.database !== expectedDbPort) {
      console.error(
        `🚨 CRITICAL PORT ALARM: Requested DB port ${expectedDbPort} was hijacked/bypassed! Allocated port: ${ports.database}`
      );
      mismatch = true;
    }
    if (expectedBackendPort && ports.backend !== expectedBackendPort) {
      console.error(
        `🚨 CRITICAL PORT ALARM: Requested Backend port ${expectedBackendPort} was hijacked/bypassed! Allocated port: ${ports.backend}`
      );
      mismatch = true;
    }
    if (expectedFrontendPort && ports.frontend !== expectedFrontendPort) {
      console.error(
        `🚨 CRITICAL PORT ALARM: Requested Frontend port ${expectedFrontendPort} was hijacked/bypassed! Allocated port: ${ports.frontend}`
      );
      mismatch = true;
    }

    if (mismatch && strictEnforcement) {
      console.error(`🛑 STRICT PORT ENFORCEMENT: Shutting down client processes due to port conflict.`);
      process.exit(1);
    }

    writeConfig(ports);
    console.log(`✅ Prestart agent complete`);
    return ports;
  } catch (error) {
    console.warn(`⚠️  GS-Orchestrator unavailable on http://${host}:${port}. Attempting startup handler...`);
    const recovered = await attemptStartupHandler();
    if (recovered) {
      try {
        const ports = await registerWithOrchestrator();
        writeConfig(ports);
        console.log(`✅ Prestart agent complete after startup handler recovery`);
        return ports;
      } catch (retryErr) {
        // Fall through
      }
    }

    throw new Error(
      `Fatal: GS-Orchestrator is unavailable on http://${host}:${port} ` +
        `and executing local startupHandler.js did not restore service connectivity. Aborting process.`
    );
  }
}
