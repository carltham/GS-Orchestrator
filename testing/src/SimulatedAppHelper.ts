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

  const projectName = path.basename(testAppDir);
  const serviceTypes: Record<string, string> = {};
  if (services.frontend) serviceTypes.frontend = 'frontend';
  if (services.backend) serviceTypes.backend = 'backend';
  if (services.database) serviceTypes.database = 'database';

  fs.copyFileSync(
    path.join(workspaceRoot, 'testing', 'templates', 'simulated-client', 'ProcessAdapter.js'),
    path.join(testAppDir, 'ProcessAdapter.js')
  );
  fs.writeFileSync(path.join(testAppDir, 'package.json'), JSON.stringify({
    name: projectName,
    private: true,
    scripts: {
      start: 'node ../../../lib/process-client/dist/index.js'
    }
  }, null, 2));

  const configDir = path.join(testAppDir, 'config');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'simulated-services.json'),
    JSON.stringify(serviceTypes, null, 2)
  );
  fs.writeFileSync(
    path.join(configDir, 'sys-config.json'),
    JSON.stringify({ pollIntervalMs: 100, heartbeatIntervalMs: 100 }, null, 2)
  );
}

/**
 * Spawns the real ProcessClient, which loads the generated project's adapter.
 */
export function spawnSimulatedClient(testAppDir: string): ChildProcess {
  const clientEntryPoint = path.resolve(testAppDir, '..', '..', '..', 'lib', 'process-client', 'dist', 'index.js');
  return spawn(process.execPath, [clientEntryPoint], {
    cwd: testAppDir,
    env: process.env,
    stdio: 'inherit'
  });
}

/**
 * Stop a ProcessClient after its adapter has handled the test's STOP signal.
 */
export function stopSimulatedClient(clientProcess: ChildProcess | undefined): void {
  if (clientProcess) {
    try {
      clientProcess.kill('SIGTERM');
    } catch (e) {
      // ignore close/stop issues
    }
  }
}
