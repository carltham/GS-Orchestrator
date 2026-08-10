import fetch from 'node-fetch';
import { IProcessAdapter } from '../types/IProcessAdapter';

export interface ProcessClientConfig {
  projectName: string;
  processServerUrl?: string;
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  adapter?: IProcessAdapter;
}

export class ProcessClient {
  private projectName: string;
  private processServerUrl: string;
  private pollIntervalMs: number;
  private heartbeatIntervalMs: number;
  private adapter: IProcessAdapter | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: ProcessClientConfig) {
    this.projectName = config.projectName;
    this.processServerUrl = config.processServerUrl || process.env.PROCESS_SERVER_URL || 'http://localhost:9999';
    this.pollIntervalMs = config.pollIntervalMs || 15000;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs || 15000;
    
    if (config.adapter) {
      this.adapter = config.adapter;
    } else {
      try {
        const path = require('path');
        const AdapterClass = require(path.resolve(process.cwd(), 'ProcessAdapter.js'));
        this.adapter = new AdapterClass();
      } catch (err: any) {
        console.warn(`[ProcessClient] Could not auto-load ProcessAdapter.js: ${err.message}`);
      }
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[ProcessClient] Started polling for ${this.projectName} against ${this.processServerUrl}`);

    // Send immediate heartbeat
    await this.sendHeartbeat();

    // Start loops
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs);
    this.pollTimer = setInterval(() => this.pollSignals(), this.pollIntervalMs);
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    console.log(`[ProcessClient] Stopped polling loop for ${this.projectName}`);
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      let statusStr = 'STOPPED';
      let pidNum: number | null = null;

      if (this.adapter) {
        const status = await this.adapter.getStatus();
        statusStr = status.status;
        pidNum = status.pid || null;
      }

      const payload = {
        projectName: this.projectName,
        status: statusStr,
        pid: pidNum,
        timestamp: new Date().toISOString()
      };

      await fetch(`${this.processServerUrl}/api/process/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err: any) {
      console.warn(`[ProcessClient] Heartbeat failed: ${err.message}`);
    }
  }

  private async pollSignals(): Promise<void> {
    try {
      const res = await fetch(`${this.processServerUrl}/api/process/signals?projectName=${encodeURIComponent(this.projectName)}`);
      if (!res.ok) return;

      const data = await res.json() as { signals?: Array<{ id: string; action: string; ports?: { [key: string]: number } }> };
      const signals = data.signals || [];

      for (const signal of signals) {
        console.log(`[ProcessClient] Received signal ${signal.action} for ${this.projectName}`);
        if (this.adapter) {
          if (signal.action === 'START') {
            await this.adapter.start(signal.ports);
          } else if (signal.action === 'STOP') {
            await this.adapter.stop();
          } else if (signal.action === 'SHUTDOWN') {
            await this.adapter.stop();
            process.exit(0);
          }
        }
        await this.sendHeartbeat();
      }
    } catch (err: any) {
      console.warn(`[ProcessClient] Signal polling failed: ${err.message}`);
    }
  }
}
