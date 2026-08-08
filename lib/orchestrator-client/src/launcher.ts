import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import { runPrestart, sendHealthReport, OrchestratorResponse, ApplicationHealth } from './index';

export class OrchestratedLauncher {
  private backendProcess?: ChildProcess;
  private frontendProcess?: ChildProcess;
  private heartbeatTimer?: NodeJS.Timeout;
  private startTime: number = Date.now();
  private ports?: OrchestratorResponse;

  async start(): Promise<void> {
    console.log('🚀 Orchestrated Launcher starting...');

    // 1. Query orchestrator for configuration
    this.ports = await runPrestart();

    // 2. Start backend server sequentially
    await this.startBackend(this.ports.backend);

    // 3. Start frontend dev server sequentially
    await this.startFrontend(this.ports.frontend);

    // 4. Start heartbeat loop to orchestrator
    this.startHeartbeatLoop(this.ports.ticket);

    console.log('✨ All components started successfully!');
  }

  private async checkHttpHealth(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(url, (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 304);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private async waitForService(url: string, timeoutMs: number = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const healthy = await this.checkHttpHealth(url);
      if (healthy) return true;
      await new Promise((res) => setTimeout(res, 1000));
    }
    return false;
  }

  private async startBackend(port?: number): Promise<void> {
    if (!port) {
      console.log('⏩ Skipping backend startup (no backend port provided)');
      return;
    }
    console.log(`⏳ Starting Backend on port ${port}...`);
    this.backendProcess = spawn('npm', ['run', 'dev:backend'], {
      stdio: 'ignore',
      shell: true,
      env: { ...process.env, PORT: String(port) },
    });

    const healthUrl = `http://localhost:${port}/health`;
    const ready = await this.waitForService(healthUrl, 15000);
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
    this.frontendProcess = spawn('npm', ['run', 'dev:frontend'], {
      stdio: 'ignore',
      shell: true,
      env: { ...process.env, PORT: String(port) },
    });

    console.log(`✅ Frontend dev process spawned for port ${port}`);
  }

  private startHeartbeatLoop(ticket?: string): void {
    const sendPing = async () => {
      const backendHealthy = this.ports && this.ports.backend
        ? await this.checkHttpHealth(`http://localhost:${this.ports.backend}/health`)
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

    // Initial ping and 15s interval
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
