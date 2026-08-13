import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { IProcessAdapter } from '../types/IProcessAdapter';

export interface ProcessClientConfig {
  projectName: string;
  processServerUrl?: string;
  orchestratorUrl?: string;
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  adapter?: IProcessAdapter;
}

export class ProcessClient {
  private projectName: string;
  private processServerUrl: string;
  private orchestratorUrl: string;
  private pollIntervalMs: number;
  private heartbeatIntervalMs: number;
  private adapter: IProcessAdapter | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isRegisteredWithOrchestrator: boolean = false;
  private logDir: string;
  private logFilePath: string;

  constructor(config: ProcessClientConfig) {
    this.projectName = config.projectName;
    this.processServerUrl = config.processServerUrl || process.env.PROCESS_SERVER_URL || 'http://localhost:9999';
    this.orchestratorUrl = config.orchestratorUrl || process.env.ORCHESTRATOR_URL || 'http://localhost:10000';
    
    // Attempt to load operator-set constants from static git-level configuration files
    let filePollIntervalMs: number | undefined;
    let fileHeartbeatIntervalMs: number | undefined;
    try {
      // Find the absolute root configuration path (relative to process.cwd() or similar)
      const sysConfigPath = path.resolve(process.cwd(), 'config', 'sys-config.json');
      if (fs.existsSync(sysConfigPath)) {
        const sysRaw = fs.readFileSync(sysConfigPath, 'utf8');
        const sysParsed = JSON.parse(sysRaw);
        if (typeof sysParsed.pollIntervalMs === 'number') {
          filePollIntervalMs = sysParsed.pollIntervalMs;
        }
        if (typeof sysParsed.heartbeatIntervalMs === 'number') {
          fileHeartbeatIntervalMs = sysParsed.heartbeatIntervalMs;
        }
      }
    } catch (err) {
      // Ignore config loading errors; fall back to defaults safely
    }

    this.pollIntervalMs = config.pollIntervalMs || filePollIntervalMs || 15000;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs || fileHeartbeatIntervalMs || 15000;

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
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.log(`Stopped polling loop.`);
  }

  /**
   * Safe programmatic setter to speed up/slow down polling during automated tests.
   * Auto-restarts active timer loops immediately for live synchronization.
   */
  public setPollIntervalMs(ms: number): void {
    this.pollIntervalMs = ms;
    this.log(`Dynamic poll interval modified to: ${ms}ms`);
    if (this.isRunning) {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
      }
      this.pollTimer = setInterval(() => this.pollSignals(), this.pollIntervalMs);
    }
  }

  /**
   * Safe programmatic setter to scale heartbeats during automated tests.
   * Auto-restarts active timer loops immediately for live synchronization.
   */
  public setHeartbeatIntervalMs(ms: number): void {
    this.heartbeatIntervalMs = ms;
    this.log(`Dynamic heartbeat interval modified to: ${ms}ms`);
    if (this.isRunning) {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }
      this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs);
    }
  }

  private async registerWithOrchestrator(): Promise<boolean> {
    try {
      const payload = {
        projectName: this.projectName,
        path: process.cwd(),
        serviceTypes: { backend: 'node-ts', frontend: 'angular' }
      };

      const res = await fetch(`${this.orchestratorUrl}/orch/project/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json() as any;
        this.log(`Registered successfully with Orchestrator (${this.orchestratorUrl}). Allocated ports: ${JSON.stringify(data.ports)}`);
        this.isRegisteredWithOrchestrator = true;
        return true;
      } else {
        this.log(`Registration with Orchestrator returned status: ${res.status}`, 'WARN');
        return false;
      }
    } catch (err: any) {
      this.log(`Registration with Orchestrator failed: ${err.message}`, 'WARN');
      return false;
    }
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

      // If components are up and healthy (RUNNING), check if we need to register with the Orchestrator
      if (statusStr === 'RUNNING' && !this.isRegisteredWithOrchestrator) {
        this.log(`Components are running and healthy. Initiating orchestrator registration...`);
        await this.registerWithOrchestrator();
      }

      const payload = {
        projectName: this.projectName,
        status: statusStr,
        pid: pidNum,
        timestamp: new Date().toISOString()
      };

      const res = await fetch(`${this.processServerUrl}/ps/process/heartbeat`, {
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
      const res = await fetch(`${this.processServerUrl}/ps/process/signals?projectName=${encodeURIComponent(this.projectName)}`);
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
          }
        }
        await this.sendHeartbeat();
      }
    } catch (err: any) {
      this.log(`Signal polling failed: ${err.message}`, 'WARN');
    }
  }
}
