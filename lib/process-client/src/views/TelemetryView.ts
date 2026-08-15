import { ClientState } from '../models/ClientState';
import { detectHostInfo, HostInfo } from '../utils/HostDetector';

export interface SubSystemInfo {
  port: number;
  status: 'start' | 'starting' | 'running' | 'partially' | 'stop' | 'stopping' | 'stopped' | string;
  pid?: number | null;
  error?: string;
}

export interface HeartbeatPayload {
  projectName: string;
  status: string;
  pid: number | null;
  timestamp: string;
  host?: HostInfo;
  components?: Record<string, SubSystemInfo>;
}

export interface RegisterPayload {
  projectName: string;
  path: string;
  host?: HostInfo;
  serviceTypes: Record<string, string>;
  occupiedPorts?: number[];
}

export class TelemetryView {
  private state: ClientState;

  constructor(state: ClientState) {
    this.state = state;
  }

  public formatHeartbeat(statusStr: string, pidNum: number | null, components: Record<string, SubSystemInfo> = {}): HeartbeatPayload {
    return {
      projectName: this.state.projectName,
      status: statusStr,
      pid: pidNum,
      timestamp: new Date().toISOString(),
      host: detectHostInfo(),
      components
    };
  }

  public formatRegistration(serviceTypes?: Record<string, string>, occupiedPorts?: number[]): RegisterPayload {
    return {
      projectName: this.state.projectName,
      path: process.cwd(),
      host: detectHostInfo(),
      serviceTypes: serviceTypes || this.state.adapter?.getServiceTypes?.() || { backend: 'node-ts', frontend: 'angular' },
      occupiedPorts
    };
  }
}
