import fetch from 'node-fetch';
import { ClientState } from '../models/ClientState';
import { LoggerView } from '../views/LoggerView';
import { TelemetryView } from '../views/TelemetryView';
import { BeatHolder } from '../utils/BeatHolder';
import { SignalProcessor } from '../services/SignalProcessor';

export class LauncherController {
  private state: ClientState;
  private logger: LoggerView;
  private telemetry: TelemetryView;
  private signalProcessor: SignalProcessor;

  constructor(state: ClientState, logger: LoggerView, telemetry: TelemetryView) {
    this.state = state;
    this.logger = logger;
    this.telemetry = telemetry;
    this.signalProcessor = new SignalProcessor(this.state, this.logger, async () => {
      await this.stop();
    });
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

    // Start metronome
    const defaultBpm = 60000 / this.state.pollIntervalMs;
    this.state.metronome = new BeatHolder(defaultBpm, async (tick) => {
      await this.signalProcessor.pollAndProcess();
      await this.sendHeartbeat();
    });
    this.state.metronome.start();
  }

  public async stop(): Promise<void> {
    this.state.isRunning = false;
    if (this.state.metronome) {
      this.state.metronome.stop();
    }
    this.logger.log(`Stopped polling and status heartbeats loops.`);
  }

  public setPollIntervalMs(ms: number): void {
    this.state.pollIntervalMs = ms;
    this.logger.log(`Dynamic polling frequency adjusted to: ${ms}ms`);
    this.resetMetronome();
  }

  public setHeartbeatIntervalMs(ms: number): void {
    this.state.heartbeatIntervalMs = ms;
    this.logger.log(`Dynamic heartbeat frequency adjusted to: ${ms}ms`);
    this.resetMetronome();
  }

  private resetMetronome(): void {
    if (this.state.isRunning && this.state.metronome) {
      this.state.metronome.stop();
      const newBpm = 60000 / this.state.pollIntervalMs;
      this.state.metronome = new BeatHolder(newBpm, async (tick) => {
        await this.signalProcessor.pollAndProcess();
        await this.sendHeartbeat();
      });
      this.state.metronome.start();
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
}
