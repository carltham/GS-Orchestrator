/**
 * ProcessRegistry Model: Encapsulates in-memory tracking of active telemetry heartbeats,
 * status logs, and signal queues.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface SubSystemInfo {
  port: number;
  status: 'start' | 'starting' | 'running' | 'partially' | 'stop' | 'stopping' | 'stopped' | string;
  pid?: number | null;
  error?: string;
}

export interface HostInfo {
  hostname: string;
  domain?: string;
  platform: string;
  ipAddresses: string[];
}

export interface ProcessHeartbeat {
  projectName: string;
  clientInstanceId?: string;
  status: string;
  pid?: number | null;
  timestamp: string;
  host?: HostInfo;
  components?: Record<string, SubSystemInfo>;
}

export interface ControlSignal {
  id: string;
  targetProject: string;
  targetClientInstanceId?: string;
  action: 'START' | 'STOP' | 'DELETE';
  ports?: { [key: string]: number };
  created: string;
  state: 'queued' | 'in-flight';
  leaseOwner?: string;
  leaseExpiresAt?: string;
  attempts: number;
  idempotencyKey?: string;
}

export class ProcessRegistry {
  private heartbeats: Map<string, ProcessHeartbeat> = new Map();
  private signalsQueue: ControlSignal[] = [];
  private signalsPath?: string;

  constructor(signalsPath?: string) {
    this.signalsPath = signalsPath;
    if (signalsPath) {
      this.loadSignals();
    }
  }

  private loadSignals(): void {
    if (!this.signalsPath || !fs.existsSync(this.signalsPath)) return;

    try {
      const parsed = JSON.parse(fs.readFileSync(this.signalsPath, 'utf8'));
      this.signalsQueue = Array.isArray(parsed.signals) ? parsed.signals : [];
    } catch (error) {
      console.error('[ProcessRegistry] Failed to load signals:', error);
      this.signalsQueue = [];
    }
  }

  private saveSignals(): void {
    if (!this.signalsPath) return;

    const directory = path.dirname(this.signalsPath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.signalsPath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify({ signals: this.signalsQueue }, null, 2));
    fs.renameSync(temporaryPath, this.signalsPath);
  }

  public updateHeartbeat(heartbeat: ProcessHeartbeat): void {
    this.heartbeats.set(heartbeat.projectName, {
      ...heartbeat,
      timestamp: new Date().toISOString()
    });
  }

  public getHeartbeats(): ProcessHeartbeat[] {
    return Array.from(this.heartbeats.values());
  }

  public getHeartbeat(projectName: string): ProcessHeartbeat | undefined {
    return this.heartbeats.get(projectName);
  }

  public removeHeartbeat(projectName: string): void {
    this.heartbeats.delete(projectName);
  }

  public queueSignal(
    signal: Pick<ControlSignal, 'targetProject' | 'targetClientInstanceId' | 'action' | 'ports' | 'idempotencyKey'>
  ): ControlSignal {
    if (signal.idempotencyKey) {
      const existing = this.signalsQueue.find(
        queued => queued.targetProject === signal.targetProject
          && queued.idempotencyKey === signal.idempotencyKey
      );
      if (existing) return existing;
    }

    const fullSignal: ControlSignal = {
      ...signal,
      id: crypto.randomUUID(),
      created: new Date().toISOString(),
      state: 'queued',
      attempts: 0
    };
    this.signalsQueue.push(fullSignal);
    this.saveSignals();
    return fullSignal;
  }

  public peekSignalsForProject(projectName: string): ControlSignal[] {
    return this.signalsQueue.filter(
      s => s.targetProject === projectName || s.targetProject === '*'
    );
  }

  public claimSignalsForProject(
    projectName: string,
    clientInstanceId: string,
    leaseMs: number = 30000
  ): ControlSignal[] {
    const now = Date.now();
    const leaseExpiresAt = new Date(now + leaseMs).toISOString();
    const claimed = this.signalsQueue.find(signal => {
      const matchesProject = signal.targetProject === projectName || signal.targetProject === '*';
      const matchesClient = !signal.targetClientInstanceId
        || signal.targetClientInstanceId === clientInstanceId;
      const leaseExpired = signal.state === 'in-flight'
        && !!signal.leaseExpiresAt
        && Date.parse(signal.leaseExpiresAt) <= now;
      return matchesProject && matchesClient && (signal.state === 'queued' || leaseExpired);
    });

    if (!claimed) return [];

    claimed.state = 'in-flight';
    claimed.leaseOwner = clientInstanceId;
    claimed.leaseExpiresAt = leaseExpiresAt;
    claimed.attempts += 1;
    this.saveSignals();
    return [claimed];
  }

  public acknowledgeSignal(signalId: string, clientInstanceId: string): ControlSignal | undefined {
    const index = this.signalsQueue.findIndex(
      signal => signal.id === signalId
        && signal.state === 'in-flight'
        && signal.leaseOwner === clientInstanceId
    );
    if (index < 0) return undefined;

    const [signal] = this.signalsQueue.splice(index, 1);
    this.saveSignals();
    return signal;
  }

  public releaseSignal(signalId: string, clientInstanceId: string): boolean {
    const signal = this.signalsQueue.find(
      queued => queued.id === signalId
        && queued.state === 'in-flight'
        && queued.leaseOwner === clientInstanceId
    );
    if (!signal) return false;

    signal.state = 'queued';
    delete signal.leaseOwner;
    delete signal.leaseExpiresAt;
    this.saveSignals();
    return true;
  }

  public consumeSignalsForProject(projectName: string): ControlSignal[] {
    const matching = this.signalsQueue.filter(
      s => s.targetProject === projectName || s.targetProject === '*'
    );
    this.signalsQueue = this.signalsQueue.filter(
      s => s.targetProject !== projectName && s.targetProject !== '*'
    );
    this.saveSignals();
    return matching;
  }

  public removeSignalsForProject(projectName: string): void {
    const originalLength = this.signalsQueue.length;
    this.signalsQueue = this.signalsQueue.filter(signal => signal.targetProject !== projectName);
    if (this.signalsQueue.length !== originalLength) this.saveSignals();
  }

  public clearAllHeartbeats(): void {
    this.heartbeats.clear();
  }

  public clearAllSignals(): void {
    this.signalsQueue = [];
    this.saveSignals();
  }
}

const defaultSignalsPath = path.resolve(process.cwd(), '..', '..', 'db', 'signals.json');
export const processRegistry = new ProcessRegistry(defaultSignalsPath);
