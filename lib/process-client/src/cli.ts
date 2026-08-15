#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ProcessClient } from './launcher/ProcessClient';

const PID_FILE = path.resolve(process.cwd(), '.process-client.pid');
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'process-client.log');

function getProjectName(): string {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  try {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) return pkg.name;
    }
  } catch {}
  return path.basename(process.cwd());
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startForeground() {
  const projectName = getProjectName();
  const client = new ProcessClient({ projectName });
  client.start().catch((err: any) => {
    console.error(`[ProcessClient] Startup error: ${err.message}`);
    process.exit(1);
  });
}

function startDaemon() {
  if (fs.existsSync(PID_FILE)) {
    const existingPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    if (!isNaN(existingPid) && isPidAlive(existingPid)) {
      console.log(`[ProcessClient] Daemon is already running with PID ${existingPid}`);
      return;
    }
    fs.unlinkSync(PID_FILE);
  }

  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  const logFd = fs.openSync(LOG_FILE, 'a');
  const entryScript = path.resolve(__dirname, 'index.js');

  const child = spawn(process.execPath, [entryScript], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    cwd: process.cwd(),
    env: process.env
  });

  if (child.pid) {
    fs.writeFileSync(PID_FILE, child.pid.toString(), 'utf8');
    child.unref();
    console.log(`[ProcessClient] Started daemon in background (PID: ${child.pid})`);
    console.log(`[ProcessClient] Logs streaming to: ${LOG_FILE}`);
  } else {
    console.error('[ProcessClient] Failed to start background daemon process');
    process.exit(1);
  }
}

function stopDaemon() {
  if (!fs.existsSync(PID_FILE)) {
    console.log('[ProcessClient] No PID file found. Client daemon does not appear to be running.');
    return;
  }

  const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
  const pid = parseInt(pidStr, 10);

  if (isNaN(pid)) {
    console.log('[ProcessClient] Invalid PID file found, removing.');
    fs.unlinkSync(PID_FILE);
    return;
  }

  if (!isPidAlive(pid)) {
    console.log(`[ProcessClient] Process with PID ${pid} is not running. Cleaning up PID file.`);
    fs.unlinkSync(PID_FILE);
    return;
  }

  console.log(`[ProcessClient] Stopping client daemon (PID: ${pid})...`);
  try {
    process.kill(pid, 'SIGTERM');
  } catch (err: any) {
    console.error(`[ProcessClient] Failed to send SIGTERM to ${pid}: ${err.message}`);
  }

  let checks = 0;
  const interval = setInterval(() => {
    checks++;
    if (!isPidAlive(pid)) {
      clearInterval(interval);
      if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
      console.log(`[ProcessClient] Daemon (PID: ${pid}) stopped successfully.`);
    } else if (checks >= 20) {
      clearInterval(interval);
      console.warn(`[ProcessClient] Daemon PID ${pid} did not stop gracefully, sending SIGKILL...`);
      try { process.kill(pid, 'SIGKILL'); } catch {}
      if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    }
  }, 100);
}

function showStatus() {
  if (!fs.existsSync(PID_FILE)) {
    console.log('[ProcessClient] Status: STOPPED (no PID file)');
    return;
  }

  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
  if (!isNaN(pid) && isPidAlive(pid)) {
    console.log(`[ProcessClient] Status: RUNNING (PID: ${pid})`);
  } else {
    console.log(`[ProcessClient] Status: STOPPED (stale PID ${pid})`);
  }
}

function showLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log(`[ProcessClient] No log file found at ${LOG_FILE}`);
    return;
  }
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  console.log(content);
}

function printHelp() {
  console.log(`
Usage: gs-client <command> [options]

Commands:
  start          Start ProcessClient in foreground
  start -d       Start ProcessClient in background (daemon)
  daemon         Alias for 'start -d'
  stop           Stop the running background daemon
  status         Show running status and PID
  logs           Print current client logs
  help           Show this help message
`);
}

const args = process.argv.slice(2);
const command = args[0] || 'start';

switch (command) {
  case 'start':
    if (args.includes('-d') || args.includes('--daemon')) {
      startDaemon();
    } else {
      startForeground();
    }
    break;
  case 'daemon':
    startDaemon();
    break;
  case 'stop':
    stopDaemon();
    break;
  case 'status':
    showStatus();
    break;
  case 'logs':
    showLogs();
    break;
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
