import fetch from 'node-fetch';
import { ClientState } from '../models/ClientState';
import { LoggerView } from '../views/LoggerView';
import { TelemetryView } from '../views/TelemetryView';

export class LauncherController {
  private state: ClientState;
  private logger: LoggerView;
  private telemetry: TelemetryView;

  constructor(state: ClientState, logger: LoggerView, telemetry: TelemetryView) {
    this.state = state;
    this.logger = logger;
    this.telemetry = telemetry;
  }

  public async start(): Promise<void> {
    if (this.state.isRunning) return;
    this.state.isRunning = true;

    this.logger.log(`Started process client loops targeting ProcessServer: ${this.state.processServerUrl}`);

    // Automatically trigger local process startup via adapter on client launch
    if (this.state.adapter) {
      this.logger.log(`Launching target processes via local ProcessAdapter...`);
      try {
        await this.state.adapter.start();
        this.logger.log(`Target process launch initiated successfully.`);
      } catch (err: any) {
        this.logger.log(`Failed to start processes via adapter: ${err.message}`, 'ERROR');
      }
    }

    // Send immediate heartbeat to register state
    await this.sendHeartbeat();

    // Setup active background loops
    this.state.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.state.heartbeatIntervalMs);
    this.state.pollTimer = setInterval(() => this.pollSignals(), this.state.pollIntervalMs);
  }

  public async stop(): Promise<void> {
    this.state.isRunning = false;
    if (this.state.pollTimer) {
      clearInterval(this.state.pollTimer);
      this.state.pollTimer = null;
    }
    if (this.state.heartbeatTimer) {
      clearInterval(this.state.heartbeatTimer);
      this.state.heartbeatTimer = null;
    }
    this.logger.log(`Stopped polling and status heartbeats loops.`);
  }

  public setPollIntervalMs(ms: number): void {
    this.state.pollIntervalMs = ms;
    this.logger.log(`Dynamic polling frequency adjusted to: ${ms}ms`);
    if (this.state.isRunning) {
      if (this.state.pollTimer) {
        clearInterval(this.state.pollTimer);
      }
      this.state.pollTimer = setInterval(() => this.pollSignals(), this.state.pollIntervalMs);
    }
  }

  public setHeartbeatIntervalMs(ms: number): void {
    this.state.heartbeatIntervalMs = ms;
    this.logger.log(`Dynamic heartbeat frequency adjusted to: ${ms}ms`);
    if (this.state.isRunning) {
      if (this.state.heartbeatTimer) {
        clearInterval(this.state.heartbeatTimer);
      }
      this.state.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.state.heartbeatIntervalMs);
    }
  }

  private async registerWithProcessServer(): Promise<boolean> {
    try {
      const payload = this.telemetry.formatRegistration();
      this.logger.log(`Registering local project with ProcessServer registry at: ${this.state.processServerUrl}...`);

      const res = await fetch(`${this.state.processServerUrl}/ps/project/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json() as any;
        this.logger.log(`Registered successfully down on ProcessServer. Assigned ports: ${JSON.stringify(data.ports)}`);
        this.state.isRegistered = true;
        return true;
      } else {
        this.logger.log(`Registration with ProcessServer failed with code: ${res.status}`, 'WARN');
        return false;
      }
    } catch (err: any) {
      this.logger.log(`Could not connect to target ProcessServer for registration: ${err.message}`, 'WARN');
      return false;
    }
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      let statusStr = 'STOPPED';
      let pidNum: number | null = null;
      let components: Record<string, number | null> = {};

      if (this.state.adapter) {
        const status = await this.state.adapter.getStatus();
        statusStr = status.status;
        pidNum = status.pid || (status.components ? Object.values(status.components)[0] : null) || null;
        components = status.components || {};
      }

      // Decoupled registration flow: Trigger remote registration strictly targeting `:9999` once components are up & healthy!
      if (statusStr === 'RUNNING' && !this.state.isRegistered) {
        this.logger.log(`Local components verified healthy (RUNNING). Invoking dynamic registration...`);
        await this.registerWithProcessServer();
      }

      const payload = this.telemetry.formatHeartbeat(statusStr, pidNum, components);

      const res = await fetch(`${this.state.processServerUrl}/ps/process/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.logger.log(`Heartbeat report sent. Status: ${statusStr}`);
      } else {
        this.logger.log(`Heartbeat failed. Status code: ${res.status}`, 'WARN');
      }
    } catch (err: any) {
      this.logger.log(`Heartbeat failed: ${err.message}`, 'WARN');
    }
  }

  private async pollSignals(): Promise<void> {
    try {
      const res = await fetch(`${this.state.processServerUrl}/ps/process/signals?projectName=${encodeURIComponent(this.state.projectName)}`);
      if (!res.ok) return;

      const data = await res.json() as { signals?: Array<{ id: string; action: string; ports?: { [key: string]: number } }> };
      const signals = data.signals || [];

      for (const [key, val] of Object.entries(signals)) {
        const signal = val as { id: string; action: string; ports?: { [key: string]: number } };
        this.logger.log(`Received control plane signal: ${signal.action} (ID: ${signal.id})`);
        if (this.state.adapter) {
          switch (signal.action) {
            case 'START':
              this.logger.log(`Executing START signal via adapter...`);
              await this.state.adapter.start(signal.ports);
              break;
            case 'STOP':
              this.logger.log(`Executing STOP signal via adapter...`);
              await this.state.adapter.stop();
              break;
            case 'DELETE':
              this.logger.log(`Executing DELETE signal...`);
              const status = await this.state.adapter.getStatus();
              if (status.status !== 'RUNNING') {
                this.logger.log(`Target project is stopped. Unregistering and shutting down client...`);
                try {
                  await fetch(`${this.state.processServerUrl}/ps/project/${encodeURIComponent(this.state.projectName)}`, {
                    method: 'DELETE'
                  });
                  this.logger.log(`Deregistered from ProcessServer.`);
                } catch (err: any) {
                  this.logger.log(`Could not notify ProcessServer of unregistration: ${err.message}`, 'WARN');
                }
                await this.stop();
                process.exit(0);
              } else {
                this.logger.log(`Cannot execute DELETE: target application is still active (status: ${status.status})`, 'ERROR');
              }
              break;
            default:
              this.logger.log(`Unknown control plane signal received: ${signal.action}`, 'WARN');
              break;
          }
        }
        await this.sendHeartbeat();
      }
    } catch (err: any) {
      this.logger.log(`Poll signals failed: ${err.message}`, 'WARN');
    }
  }
}
