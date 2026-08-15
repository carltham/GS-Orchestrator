/**
 * ProcessRegistry Model: Encapsulates in-memory tracking of active telemetry heartbeats,
 * status logs, and signal queues.
 */

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
  status: string;
  pid?: number | null;
  timestamp: string;
  host?: HostInfo;
  components?: Record<string, SubSystemInfo>;
}

export interface ControlSignal {
  id: string;
  targetProject: string;
  action: 'START' | 'STOP' | 'DELETE';
  ports?: { [key: string]: number };
  created: string;
}

export class ProcessRegistry {
  private heartbeats: Map<string, ProcessHeartbeat> = new Map();
  private signalsQueue: ControlSignal[] = [];

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

  public queueSignal(signal: Omit<ControlSignal, 'id' | 'created'>): ControlSignal {
    const fullSignal: ControlSignal = {
      ...signal,
      id: Math.random().toString(36).substring(2, 9),
      created: new Date().toISOString()
    };
    this.signalsQueue.push(fullSignal);
    return fullSignal;
  }

  public peekSignalsForProject(projectName: string): ControlSignal[] {
    return this.signalsQueue.filter(
      s => s.targetProject === projectName || s.targetProject === '*'
    );
  }

  public consumeSignalsForProject(projectName: string): ControlSignal[] {
    const matching = this.signalsQueue.filter(
      s => s.targetProject === projectName || s.targetProject === '*'
    );
    this.signalsQueue = this.signalsQueue.filter(
      s => s.targetProject !== projectName && s.targetProject !== '*'
    );
    return matching;
  }

  public clearAllHeartbeats(): void {
    this.heartbeats.clear();
  }

  public clearAllSignals(): void {
    this.signalsQueue = [];
  }
}

export const processRegistry = new ProcessRegistry();
