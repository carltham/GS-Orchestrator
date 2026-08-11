import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
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
  private logDir: string;
  private logFilePath: string;

  constructor(config: ProcessClientConfig) {
    this.projectName = config.projectName;
    this.processServerUrl = config.processServerUrl || process.env.PROCESS_SERVER_URL || 'http://localhost:9999';
    this.pollIntervalMs = config.pollIntervalMs || 15000;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs || 15000;

    this.logDir = path.resolve(process.cwd(), 'logs');
    this.logFilePath = path.join(this.logDir, 'process-client.log');
    this.ensureLogDirectory();

    this.log(`Initialized ProcessClient for ${this.projectName} targeting ${this.processServerUrl}`);
    
    if (config.adapter) {
      this.adapter = config.adapter;
    } else {
      try {
        const AdapterClass = require(path.resolve(process.cwd(), 'ProcessAdapter.js'));
        this.adapter = new AdapterClass();
      } catch (err: any) {
        this.log(`Could not auto-load ProcessAdapter.js: ${err.message}`, 'WARN');
      }
    }
  }

  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err: any) {
      console.error(`[ProcessClient] Failed to create log directory: ${err.message}`);
    }
  }

  private log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] [ProcessClient:${this.projectName}] ${message}\n`;
    
    console.log(`[ProcessClient] ${message}`);
    
    try {
      this.ensureLogDirectory();
      fs.appendFileSync(this.logFilePath, formatted, 'utf8');
    } catch (err: any) {
      console.error(`[ProcessClient] Log write failed: ${err.message}`);
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.log(`Started process client polling against ${this.processServerUrl}`);

    // Automatically trigger local process startup via adapter on client launch
    if (this.adapter) {
      this.log(`Launching target process via ProcessAdapter...`);
      try {
        await this.adapter.start();
        this.log(`Target process launch initiated successfully.`);
      } catch (err: any) {
        this.log(`Failed to start process via adapter: ${err.message}`, 'ERROR');
      }
    }

    // Send immediate heartbeat to ProcessServer (:9999)
    await this.sendHeartbeat();

    // Start polling & heartbeat loops against ProcessServer (:9999)
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs);
    this.pollTimer = setInterval(() => this.pollSignals(), this.pollIntervalMs);
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.log(`Stopped polling loop.`);
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

      const res = await fetch(`${this.processServerUrl}/api/process/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.log(`Heartbeat sent. Status: ${statusStr}`);
      } else {
        this.log(`Heartbeat response status: ${res.status}`, 'WARN');
      }
    } catch (err: any) {
      this.log(`Heartbeat failed: ${err.message}`, 'WARN');
    }
  }

  private async pollSignals(): Promise<void> {
    try {
      const res = await fetch(`${this.processServerUrl}/api/process/signals?projectName=${encodeURIComponent(this.projectName)}`);
      if (!res.ok) return;

      const data = await res.json() as { signals?: Array<{ id: string; action: string; ports?: { [key: string]: number } }> };
      const signals = data.signals || [];

      for (const signal of signals) {
        this.log(`Received signal: ${signal.action} (ID: ${signal.id})`);
        if (this.adapter) {
          if (signal.action === 'START') {
            this.log(`Executing START signal via adapter...`);
            await this.adapter.start(signal.ports);
          } else if (signal.action === 'STOP') {
            this.log(`Executing STOP signal via adapter...`);
            await this.adapter.stop();
          } else if (signal.action === 'SHUTDOWN') {
            this.log(`Executing SHUTDOWN signal via adapter...`);
            await this.adapter.stop();
            this.log(`Exiting ProcessClient process.`);
            process.exit(0);
          }
        }
        await this.sendHeartbeat();
      }
    } catch (err: any) {
      this.log(`Signal polling failed: ${err.message}`, 'WARN');
    }
  }
}
