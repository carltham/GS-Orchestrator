import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';

export interface ServerInitiator {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  readySentinel: string;
  port: number;
  timeoutMs?: number;
}

export const ProcessServerInitiator: ServerInitiator = {
  name: 'process-server',
  command: 'npm',
  args: ['--prefix', 'lib/process-server', 'run', 'dev'],
  cwd: '.',
  readySentinel: 'Process Server running on port',
  port: 9999,
  timeoutMs: 3000
};

export const GSOrchestratorInitiator: ServerInitiator = {
  name: 'orchestrator',
  command: 'npm',
  args: ['run', 'dev'],
  cwd: 'GS-Orchestrator',
  readySentinel: 'GS-Orchestrator running on port',
  port: 10000,
  timeoutMs: 3000
};

export class TestManager {
  private processes: { [name: string]: ChildProcess } = {};
  private workspaceRoot: string;

  constructor() {
    this.workspaceRoot = path.resolve(__dirname, '..');
    // Ensure we are referencing the correct workspace root if running inside testing/src or testing/dist
    if (this.workspaceRoot.endsWith('testing')) {
      this.workspaceRoot = path.resolve(this.workspaceRoot, '..');
    }
  }

  /**
   * Reset database databases and state files before running tests
   */
  public async resetDatabaseState(): Promise<void> {
    console.log('[TestManager] Resetting database file systems inside db/ root...');
    const dbDir = path.join(this.workspaceRoot, 'db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const registryPath = path.join(dbDir, 'registry.json');
    const unregisteredPath = path.join(dbDir, 'unregistered-servers.json');

    fs.writeFileSync(
      registryPath,
      JSON.stringify({ projects: {}, nextPortBase: 4200, lastUpdated: new Date().toISOString() }, null, 2)
    );

    fs.writeFileSync(
      unregisteredPath,
      JSON.stringify({ lastScanned: new Date().toISOString(), servers: [] }, null, 2)
    );
    console.log('[TestManager] Database reset complete.');
  }

  /**
   * Safe socket helper to verify if a TCP port is occupied
   */
  private async isPortOccupied(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(400);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true); // Connected, so active!
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false); // Refused, so free!
      });

      socket.connect(port, '127.0.0.1');
    });
  }

  /**
   * Assures that the given servers are active on their respective ports, booting them if necessary
   */
  public async assureRunning(initiators: ServerInitiator[]): Promise<void> {
    for (const initiator of initiators) {
      const isActive = await this.isPortOccupied(initiator.port);
      if (isActive) {
        console.log(`[TestManager] Server "${initiator.name}" is already alive on port ${initiator.port}. Skipping boot.`);
        continue;
      }
      console.log(`[TestManager] Server "${initiator.name}" is offline on port ${initiator.port}. Booting...`);
      await this.startServer(initiator);
    }
  }

  private async startServer(initiator: ServerInitiator): Promise<void> {
    return new Promise((resolve) => {
      const runCwd = path.isAbsolute(initiator.cwd)
        ? initiator.cwd
        : path.join(this.workspaceRoot, initiator.cwd);

      const proc = spawn(initiator.command, initiator.args, {
        cwd: runCwd,
        stdio: 'pipe',
        shell: true
      });

      this.processes[initiator.name] = proc;

      // Pipe output safely so we can check startup sentence patterns
      proc.stdout?.on('data', (data) => {
        const output = data.toString();
        // Mirror logs to console so we can trace startup issues
        process.stdout.write(`[Initiator][${initiator.name}] ${output}`);
        if (output.includes(initiator.readySentinel) || output.toLowerCase().includes('listening on port')) {
          console.log(`[TestManager] Server "${initiator.name}" ready sentinel detected.`);
          resolve();
        }
      });

      proc.stderr?.on('data', (data) => {
        process.stderr.write(`[Initiator][${initiator.name}] ERROR: ${data.toString()}`);
      });

      // Timeout fallback safeguard
      setTimeout(() => {
        console.log(`[TestManager] Warning: Server "${initiator.name}" startup ready sentinel check timed out. Proceeding.`);
        resolve();
      }, initiator.timeoutMs ?? 3000);
    });
  }

  /**
   * Run targeted test command synchronously
   */
  public async runTestCommand(command: string, args: string[], cwd: string): Promise<number> {
    console.log(`[TestManager] Running test command: ${command} ${args.join(' ')}`);
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        cwd,
        stdio: 'inherit',
        shell: true
      });

      proc.on('exit', (code) => {
        resolve(code ?? 0);
      });
    });
  }

  /**
   * Shutdown all spawned background services cleanly
   */
  public async teardown(): Promise<void> {
    console.log('[TestManager] Tearing down running background services...');
    for (const [name, proc] of Object.entries(this.processes)) {
      if (proc) {
        console.log(`[TestManager] Stopping service process: ${name}`);
        // On Linux/Unix, use kill process signals safely
        proc.kill('SIGTERM');
      }
    }
    this.processes = {};
    console.log('[TestManager] Teardown complete. All services stopped.');
  }
}
