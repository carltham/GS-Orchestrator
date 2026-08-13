import fetch from 'node-fetch';
import { ClientState } from '../models/ClientState';
import { LoggerView } from '../views/LoggerView';
import { TelemetryView, SubSystemInfo } from '../views/TelemetryView';

export class TelemetryProcessor {
  private state: ClientState;
  private logger: LoggerView;
  private telemetry: TelemetryView;

  constructor(state: ClientState, logger: LoggerView, telemetry: TelemetryView) {
    this.state = state;
    this.logger = logger;
    this.telemetry = telemetry;
  }

  /**
   * Main entrypoint to assemble metrics, check registration, and push the telemetry heartbeat.
   */
  public async sendHeartbeat(): Promise<void> {
    try {
      let statusStr = 'STOPPED';
      let pidNum: number | null = null;
      let rawComponents: Record<string, SubSystemInfo> = {};

      if (this.state.adapter) {
        const status = await this.state.adapter.getStatus();
        statusStr = status.status;
        pidNum = status.pid || (status.components ? Object.values(status.components)[0]?.pid : null) || null;
        rawComponents = status.components || {};
      }

      // Decoupled registration flow: Trigger remote registration strictly targeting `:9999` once components are up & healthy!
      if (statusStr === 'RUNNING' && !this.state.isRegistered) {
        this.logger.log(`Local components verified healthy (RUNNING). Invoking dynamic registration...`);
        await this.registerWithProcessServer();
      }

      const payload = this.telemetry.formatHeartbeat(statusStr, pidNum, rawComponents);

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

  /**
   * Issue startup registration to Process Server on port 9999.
   */
  public async registerWithProcessServer(): Promise<boolean> {
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
}
