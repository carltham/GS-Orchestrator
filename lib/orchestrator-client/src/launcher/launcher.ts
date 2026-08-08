import { ChildProcess, spawn } from 'child_process';
import { sendHealthReport } from '../api/apiClient';
import { runPrestart } from '../startup/prestart';
import { ApplicationHealth, OrchestratorResponse } from '../types';
import { resolveBackendCommand, resolveFrontendCommand } from './commands';
import { checkHttpHealth, waitForService } from './health';

export class OrchestratedLauncher {
  private backendProcess?: ChildProcess;
  private frontendProcess?: ChildProcess;
  private heartbeatTimer?: NodeJS.Timeout;
  private startTime: number = Date.now();
  private ports?: OrchestratorResponse;

  async start(): Promise<void> {
    console.log('🚀 Orchestrated Launcher starting...');

    this.ports = await runPrestart();

    await this.startBackend(this.ports.backend);
    await this.startFrontend(this.ports.frontend);
    this.startHeartbeatLoop(this.ports.ticket);

    console.log('✨ All components started successfully!');
  }

  private async startBackend(port?: number): Promise<void> {
    if (!port) {
      console.log('⏩ Skipping backend startup (no backend port provided)');
      return;
    }
    console.log(`⏳ Starting Backend on port ${port}...`);

    const { command, args } = resolveBackendCommand();
    this.backendProcess = spawn(command, args, {
      stdio: 'ignore',
      shell: true,
      env: { ...process.env, PORT: String(port) },
    });

    const healthUrl = `http://localhost:${port}/health`;
    const ready = await waitForService(healthUrl, 15000);
    if (!ready) {
      console.warn(`⚠️ Backend health check on ${healthUrl} did not respond OK in time, proceeding...`);
    } else {
      console.log(`✅ Backend is live and healthy on port ${port}!`);
    }
  }

  private async startFrontend(port?: number): Promise<void> {
    if (!port) {
      console.log('⏩ Skipping frontend startup (no frontend port provided)');
      return;
    }
    console.log(`⏳ Starting Frontend on port ${port}...`);

    const { command, args } = resolveFrontendCommand(port);
    this.frontendProcess = spawn(command, args, {
      stdio: 'ignore',
      shell: true,
      env: { ...process.env, PORT: String(port) },
    });

    console.log(`✅ Frontend dev process spawned for port ${port} using ${command} ${args.join(' ')}`);
  }

  private startHeartbeatLoop(ticket?: string): void {
    const sendPing = async () => {
      const backendHealthy =
        this.ports && this.ports.backend
          ? await checkHttpHealth(`http://localhost:${this.ports.backend}/health`)
          : false;

      const health: ApplicationHealth = {
        status: backendHealthy ? 'ok' : 'degraded',
        backendStatus: backendHealthy,
        frontendStatus: !!this.frontendProcess && !this.frontendProcess.killed,
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        ticket,
      };

      await sendHealthReport(health);
    };

    sendPing();
    this.heartbeatTimer = setInterval(sendPing, 15000);
  }

  getPorts(): OrchestratorResponse | undefined {
    return this.ports;
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.backendProcess) this.backendProcess.kill();
    if (this.frontendProcess) this.frontendProcess.kill();
  }
}

if (require.main === module) {
  const launcher = new OrchestratedLauncher();
  launcher.start().catch((err) => {
    console.error('Fatal launcher error:', err);
    process.exit(1);
  });
}
