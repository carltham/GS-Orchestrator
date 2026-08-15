import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

/**
 * Creates folders recursively.
 */
export function copyFolderRecursiveSync(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolderRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function resetSimulatedAppWorkspace(testAppDir: string): void {
  if (fs.existsSync(testAppDir)) {
    fs.rmSync(testAppDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testAppDir, { recursive: true });
}

/**
 * Copies only the chosen service folders into the test directory.
 */
export function prepareSelectedProject(
  workspaceRoot: string,
  tempAppsDir: string,
  testAppDir: string,
  services: { frontend?: boolean; backend?: boolean; database?: boolean }
): void {
  if (!fs.existsSync(tempAppsDir)) {
    fs.mkdirSync(tempAppsDir, { recursive: true });
  }

  const srcTemplatesDir = path.join(workspaceRoot, 'testing', 'apps');

  if (services.frontend) {
    copyFolderRecursiveSync(path.join(srcTemplatesDir, 'simulated-frontend-template'), path.join(testAppDir, 'frontend'));
  }
  if (services.backend) {
    copyFolderRecursiveSync(path.join(srcTemplatesDir, 'simulated-backend-template'), path.join(testAppDir, 'backend'));
  }
  if (services.database) {
    copyFolderRecursiveSync(path.join(srcTemplatesDir, 'simulated-filedb-template'), path.join(testAppDir, 'filedb'));
  }
}

/**
 * Spawns any selected subset of processes based on configuration.
 */
export function spawnSimulatedMicroservices(
  testAppDir: string,
  ports: { frontend?: number; backend?: number; database?: number }
): ChildProcess[] {
  const spawned: ChildProcess[] = [];

  // Spawn FileDB Template microservice if database port is configured
  if (ports.database && fs.existsSync(path.join(testAppDir, 'filedb'))) {
    const fileDbProc = spawn('node', ['server.js'], {
      cwd: path.join(testAppDir, 'filedb'),
      env: {
        ...process.env,
        PORT: String(ports.database),
        DB_FILE: path.join(testAppDir, 'filedb', 'data', 'store.json')
      }
    });
    spawned.push(fileDbProc);
  }

  // Spawn Backend Template microservice if backend port is configured
  if (ports.backend && fs.existsSync(path.join(testAppDir, 'backend'))) {
    const backendProc = spawn('node', ['server.js'], {
      cwd: path.join(testAppDir, 'backend'),
      env: {
        ...process.env,
        PORT: String(ports.backend),
        database: ports.database ? String(ports.database) : ''
      }
    });
    spawned.push(backendProc);
  }

  // Spawn Frontend Template microservice if frontend port is configured
  if (ports.frontend && fs.existsSync(path.join(testAppDir, 'frontend'))) {
    const frontendProc = spawn('node', ['server.js'], {
      cwd: path.join(testAppDir, 'frontend'),
      env: {
        ...process.env,
        PORT: String(ports.frontend),
        backend: ports.backend ? String(ports.backend) : ''
      }
    });
    spawned.push(frontendProc);
  }

  return spawned;
}

/**
 * Stop spawned processes while preserving generated test app workspaces.
 */
export function stopSimulatedMicroservices(spawnedProcesses: ChildProcess[]): void {
  while (spawnedProcesses.length > 0) {
    const proc = spawnedProcesses.pop();
    if (proc) {
      try {
        proc.kill('SIGTERM');
      } catch (e) {
        // ignore close/stop issues
      }
    }
  }
}
