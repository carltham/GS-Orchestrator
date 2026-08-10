import { ChildProcess, spawn } from 'child_process';
import { registerWithOrchestrator, sendHealthReport, getSignalsForProject, acknowledgeSignals, confirmProjectStopped } from '../api/apiClient';
import { detectProjectName } from '../config';
import { runPrestart } from '../startup/prestart';
import { ApplicationHealth, OrchestratorResponse } from '../types';
import { resolveBackendCommand, resolveFrontendCommand } from './commands';
import { checkHttpHealth, waitForService } from './health';

export class OrchestratedLauncher {
  private backendProcess?: ChildProcess;
  private frontendProcess?: ChildProcess;
  private heartbeatTimer?: NodeJS.Timeout;
  private signalCheckTimer?: NodeJS.Timeout;
  private startTime: number = Date.now();
  private ports?: OrchestratorResponse;
  private projectName?: string;

  async start(): Promise<void> {
    console.log('🚀 Orchestrated Launcher starting...');

    // 1. First contact Orchestrator & submit/confirm configuration from config/app-config.json
    this.ports = await runPrestart();
    this.projectName = detectProjectName();

    // 2. Check if ports changed from existing running processes
    if (this.backendProcess || this.frontendProcess) {
      console.log('🔄 Ports updated by Orchestrator. Stopping local processes to apply new port configuration...');
      this.killProcesses();
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 3. Start services in order: Database (if applicable) -> Backend -> Frontend
    await this.startBackend(this.ports.backend);
    await this.startFrontend(this.ports.frontend);

    // 4. Re-register and confirm live component status AFTER components are launched
    try {
      console.log('🔄 Confirming live component registration with GS-Orchestrator...');
      const updatedPorts = await registerWithOrchestrator();
      if (updatedPorts) {
        if (updatedPorts.backend !== this.ports.backend || updatedPorts.frontend !== this.ports.frontend) {
          console.log('🔄 Re-allocated ports received from Orchestrator. Restarting child processes on new ports...');
          this.killProcesses();
          this.ports = updatedPorts;
          await this.startBackend(this.ports.backend);
          await this.startFrontend(this.ports.frontend);
        } else {
          this.ports = updatedPorts;
        }
      }
      console.log('✅ Registration confirmed in Orchestrator registry!');
    } catch (err) {
      console.warn('⚠️ Could not re-confirm registration with GS-Orchestrator:', err);
    }

    this.startHeartbeatLoop(this.ports?.ticket);
    this.startSignalPollingLoop();

    console.log('✨ All components processed successfully!');
  }

  private async startBackend(port?: number): Promise<void> {
    if (!port) {
      console.log('⏩ Skipping backend startup (no backend port provided)');
      return;
    }

    const healthUrl = `http://localhost:${port}/health`;
    const alreadyRunning = await checkHttpHealth(healthUrl);
    if (alreadyRunning) {
      console.log(`✅ Backend is ALREADY running and healthy on port ${port}, skipping spawn.`);
      return;
    }

    console.log(`⏳ Starting Backend on port ${port}...`);

    const { command, args } = resolveBackendCommand();
    this.backendProcess = spawn(command, args, {
      stdio: 'ignore',
      shell: true,
      env: { ...process.env, PORT: String(port) },
    });

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

    const frontendUrl = `http://localhost:${port}/`;
    const alreadyRunning = await checkHttpHealth(frontendUrl);
    if (alreadyRunning) {
      console.log(`✅ Frontend is ALREADY running on port ${port}, skipping spawn.`);
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

  private startSignalPollingLoop(): void {
    const checkSignals = async () => {
      if (!this.projectName) return;

      try {
        const signals = await getSignalsForProject(this.projectName);
        if (signals && signals.length > 0) {
          for (const signal of signals) {
            if (signal.type === 'stop') {
              console.log(`🛑 Stop signal received from Orchestrator for project: ${signal.projectName}`);
              this.killProcesses();
              await acknowledgeSignals(this.projectName);
              await confirmProjectStopped(this.projectName);
              console.log(`✅ Acknowledged stop signal and confirmed project stopped. Client continuing monitoring...`);
            } else if (signal.type === 'restart') {
              console.log(`🔄 Restart signal received from Orchestrator`);
              await acknowledgeSignals(this.projectName);
            } else if (signal.type === 'update') {
              console.log(`📦 Update signal received from Orchestrator`);
              await acknowledgeSignals(this.projectName);
            }
          }
        }
      } catch (err) {
        // Silently fail on signal polling errors (orchestrator might be down)
      }
    };

    checkSignals();
    this.signalCheckTimer = setInterval(checkSignals, 5000);
  }

  private killProcesses(): void {
    console.log('🗑️ Killing child processes...');

    if (this.backendProcess && !this.backendProcess.killed) {
      try {
        console.log('  - Killing backend process');
        this.backendProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!this.backendProcess?.killed) {
            this.backendProcess?.kill('SIGKILL');
          }
        }, 3000);
      } catch (err) {
        console.error('Error killing backend process:', err);
      }
    }

    if (this.frontendProcess && !this.frontendProcess.killed) {
      try {
        console.log('  - Killing frontend process');
        this.frontendProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!this.frontendProcess?.killed) {
            this.frontendProcess?.kill('SIGKILL');
          }
        }, 3000);
      } catch (err) {
        console.error('Error killing frontend process:', err);
      }
    }

    console.log('✅ All processes terminated');
  }

  getPorts(): OrchestratorResponse | undefined {
    return this.ports;
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.signalCheckTimer) clearInterval(this.signalCheckTimer);
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
