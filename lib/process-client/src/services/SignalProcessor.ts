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
      const query = new URLSearchParams({
        projectName: this.state.projectName,
        clientInstanceId: this.state.clientInstanceId,
        claim: 'true'
      });
      const res = await fetch(`${this.state.processServerUrl}/ps/process/signals?${query.toString()}`);
      if (!res.ok) return;

      const data = await res.json() as { signals?: Array<{ id: string; action: string; ports?: { [key: string]: number } }> };
      const signals = data.signals || [];

      for (const val of signals) {
        const signal = val as { id: string; action: string; ports?: { [key: string]: number } };
        try {
          const stopAfterAcknowledge = await this.executeSignal(signal);
          const acknowledged = await this.settleSignal(signal.id, 'ack');
          if (!acknowledged) {
            throw new Error(`Could not acknowledge signal ${signal.id}`);
          }
          if (stopAfterAcknowledge) {
            await this.stopCallback();
          }
        } catch (err: any) {
          await this.settleSignal(signal.id, 'nack');
          this.logger.log(`Signal ${signal.id} failed: ${err.message}`, 'ERROR');
        }
      }
    } catch (err: any) {
      this.logger.log(`Poll signals failed: ${err.message}`, 'WARN');
    }
  }

  /**
   * Execute specified signal action
   */
  private async executeSignal(signal: { id: string; action: string; ports?: { [key: string]: number } }): Promise<boolean> {
    this.logger.log(`Received control plane signal: ${signal.action} (ID: ${signal.id})`);
    
    if (!this.state.adapter) throw new Error('No process adapter is configured');

    switch (signal.action) {
      case 'START':
        this.logger.log(`Executing START signal via adapter...`);
        await this.state.adapter.start(signal.ports);
        return false;

      case 'STOP':
        this.logger.log(`Executing STOP signal via adapter...`);
        await this.state.adapter.stop();
        return false;

      case 'DELETE':
        return this.prepareDelete();

      default:
        throw new Error(`Unknown control plane signal: ${signal.action}`);
    }
  }

  private async prepareDelete(): Promise<boolean> {
    if (!this.state.adapter) throw new Error('No process adapter is configured');
    this.logger.log(`Executing DELETE signal...`);
    const status = await this.state.adapter.getStatus();
    if (status.status === 'RUNNING') {
      throw new Error(`Cannot delete an active application (status: ${status.status})`);
    }
    this.logger.log(`Target project is stopped. Acknowledging deletion and shutting down client...`);
    return true;
  }

  private async settleSignal(signalId: string, result: 'ack' | 'nack'): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.state.processServerUrl}/ps/process/signals/${encodeURIComponent(signalId)}/${result}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientInstanceId: this.state.clientInstanceId })
        }
      );
      return response.ok;
    } catch (err: any) {
      this.logger.log(`Could not ${result} signal ${signalId}: ${err.message}`, 'WARN');
      return false;
    }
  }
}
