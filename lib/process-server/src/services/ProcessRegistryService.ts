export interface ProcessHeartbeat {
  projectName: string;
  status: string;
  pid?: number | null;
  timestamp: string;
}

export interface ControlSignal {
  id: string;
  targetProject: string;
  action: 'START' | 'STOP';
  ports?: { [key: string]: number };
  created: string;
}

export class ProcessRegistryService {
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

  public queueSignal(signal: Omit<ControlSignal, 'id' | 'created'>): ControlSignal {
    const fullSignal: ControlSignal = {
      ...signal,
      id: Math.random().toString(36).substring(2, 9),
      created: new Date().toISOString()
    };
    this.signalsQueue.push(fullSignal);
    return fullSignal;
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
}

export const processRegistry = new ProcessRegistryService();
