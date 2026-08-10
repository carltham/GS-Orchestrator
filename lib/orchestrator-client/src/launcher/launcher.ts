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

    this.ports = await runPrestart();
    this.projectName = detectProjectName();

    await this.startBackend(this.ports.backend);
    await this.startFrontend(this.ports.frontend);

    // Re-register / confirm registration with Orchestrator once components are live
    try {
      console.log('🔄 Confirming live component registration with GS-Orchestrator...');
      const updatedPorts = await registerWithOrchestrator();
      if (updatedPorts) {
        this.ports = updatedPorts;
      }
      console.log('✅ Registration confirmed in Orchestrator registry!');
    } catch (err) {
      console.warn('⚠️ Could not re-confirm registration with GS-Orchestrator:', err);
    }

    this.startHeartbeatLoop(this.ports?.ticket);
    this.startSignalPollingLoop();

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
              console.log(`✅ Acknowledged stop signal and confirmed project stopped`);
              process.exit(0);
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
