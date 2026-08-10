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

  let command = '';
  let args: string[] = [];

  if (fs.existsSync(tsFileRoot)) {
    command = 'npx';
    args = ['--yes', 'ts-node', tsFileRoot];
  } else if (fs.existsSync(jsFileRoot)) {
    command = 'node';
    args = [jsFileRoot];
  } else if (fs.existsSync(tsFileScripts)) {
    command = 'npx';
    args = ['--yes', 'ts-node', tsFileScripts];
  } else if (fs.existsSync(jsFileScripts)) {
    command = 'node';
    args = [jsFileScripts];
  } else {
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts && (pkg.scripts['startupHandler'] || pkg.scripts['startup-handler'])) {
          const scriptName = pkg.scripts['startupHandler'] ? 'startupHandler' : 'startup-handler';
          command = 'npm';
          args = ['run', scriptName];
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
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

    const startTime = Date.now();
    while (Date.now() - startTime < 10000) {
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
        // Fall through to exception
      }
    }

    throw new Error(
      `Fatal: GS-Orchestrator is unavailable on http://${host}:${port} ` +
        `and no valid startup handler could restore it. Aborting process.`
    );
  }
}
