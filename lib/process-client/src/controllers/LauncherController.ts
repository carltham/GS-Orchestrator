import fetch from 'node-fetch';
import { ClientState } from '../models/ClientState';
import { LoggerView } from '../views/LoggerView';
import { TelemetryView } from '../views/TelemetryView';
import { BeatHolder } from '../utils/BeatHolder';
import { SignalProcessor } from '../services/SignalProcessor';
import { TelemetryProcessor } from '../services/TelemetryProcessor';
import { isLocalPortOccupied } from '../utils/PortDetector';

export class LauncherController {
  private state: ClientState;
  private logger: LoggerView;
  private telemetry: TelemetryView;
  private signalProcessor: SignalProcessor;
  private telemetryProcessor: TelemetryProcessor;

  constructor(state: ClientState, logger: LoggerView, telemetry: TelemetryView) {
    this.state = state;
    this.logger = logger;
    this.telemetry = telemetry;
    this.signalProcessor = new SignalProcessor(this.state, this.logger, async () => {
      await this.stop();
    });
    this.telemetryProcessor = new TelemetryProcessor(this.state, this.logger, this.telemetry);
  }

  public async start(): Promise<void> {
    if (this.state.isRunning) return;
    this.state.isRunning = true;

    this.logger.log(`Started process client loops targeting ProcessServer: ${this.state.processServerUrl}`);

    // Automatically trigger local process startup via adapter on client launch
    if (this.state.adapter) {
      this.logger.log(`Launching target processes via local ProcessAdapter...`);
      try {
        let registration = await this.telemetryProcessor.registerWithProcessServer(
          this.state.adapter.getServiceTypes?.()
        );

        let finalPorts = registration?.ports;

        // Perform local client-side pre-flight check on target machine (detects local Docker postgres/services)
        if (finalPorts) {
          const conflictingPorts: number[] = [];
          for (const [service, port] of Object.entries(finalPorts)) {
            const occupied = await isLocalPortOccupied(port);
            if (occupied) {
              this.logger.log(`⚠️ Local port collision detected on ${service}:${port} (e.g. host daemon / docker). Reporting to ProcessServer for reassignment...`, 'WARN');
              conflictingPorts.push(port);
            }
          }

          if (conflictingPorts.length > 0) {
            registration = await this.telemetryProcessor.registerWithProcessServer(
              this.state.adapter.getServiceTypes?.(),
              conflictingPorts
            );
            finalPorts = registration?.ports;
          }
        }

        await this.state.adapter.start(finalPorts);
        this.logger.log(`Target process launch initiated successfully.`);
      } catch (err: any) {
        this.logger.log(`Failed to start processes via adapter: ${err.message}`, 'ERROR');
      }
    }

    // Send immediate heartbeat to register state
    await this.telemetryProcessor.sendHeartbeat();

    // Start metronome
    const defaultBpm = 60000 / this.state.pollIntervalMs;
    this.state.metronome = new BeatHolder(defaultBpm, async (tick) => {
      await this.signalProcessor.pollAndProcess();
      await this.telemetryProcessor.sendHeartbeat();
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
        await this.telemetryProcessor.sendHeartbeat();
      });
      this.state.metronome.start();
    }
  }
}
