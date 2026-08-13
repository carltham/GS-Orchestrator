import fetch from 'node-fetch';
import { ClientState } from '../models/ClientState';
import { LoggerView } from '../views/LoggerView';

export class SignalProcessor {
  private state: ClientState;
  private logger: LoggerView;
  private stopCallback: () => Promise<void>;

  constructor(state: ClientState, logger: LoggerView, stopCallback: () => Promise<void>) {
    this.state = state;
    this.logger = logger;
    this.stopCallback = stopCallback;
  }

  /**
   * Poll for signal commands from ProcessServer and execute them
   */
  public async pollAndProcess(): Promise<void> {
    try {
      const res = await fetch(`${this.state.processServerUrl}/ps/process/signals?projectName=${encodeURIComponent(this.state.projectName)}`);
      if (!res.ok) return;

      const data = await res.json() as { signals?: Array<{ id: string; action: string; ports?: { [key: string]: number } }> };
      const signals = data.signals || [];

      for (const [key, val] of Object.entries(signals)) {
        const signal = val as { id: string; action: string; ports?: { [key: string]: number } };
        await this.executeSignal(signal);
      }
    } catch (err: any) {
      this.logger.log(`Poll signals failed: ${err.message}`, 'WARN');
    }
  }

  /**
   * Execute specified signal action
   */
  private async executeSignal(signal: { id: string; action: string; ports?: { [key: string]: number } }): Promise<void> {
    this.logger.log(`Received control plane signal: ${signal.action} (ID: ${signal.id})`);
    
    if (!this.state.adapter) return;

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
        await this.handleDelete();
        break;

      default:
        this.logger.log(`Unknown control plane signal received: ${signal.action}`, 'WARN');
        break;
    }
  }

  /**
   * Handle unregistration and metronome stop for DELETE action
   */
  private async handleDelete(): Promise<void> {
    if (!this.state.adapter) return;

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
      
      // Stop the metronome loop and allow Node.js event loop to cleanly empty
      await this.stopCallback();
    } else {
      this.logger.log(`Cannot execute DELETE: target application is still active (status: ${status.status})`, 'ERROR');
    }
  }
}
