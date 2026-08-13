import { ClientState } from '../models/ClientState';

export interface HeartbeatPayload {
  projectName: string;
  status: string;
  pid: number | null;
  timestamp: string;
  components?: Record<string, number | null>;
}

export interface RegisterPayload {
  projectName: string;
  path: string;
  serviceTypes: Record<string, string>;
}

export class TelemetryView {
  private state: ClientState;

  constructor(state: ClientState) {
    this.state = state;
  }

  public formatHeartbeat(statusStr: string, pidNum: number | null, components: Record<string, number | null> = {}): HeartbeatPayload {
    return {
      projectName: this.state.projectName,
      status: statusStr,
      pid: pidNum,
      timestamp: new Date().toISOString(),
      components
    };
  }

  public formatRegistration(serviceTypes?: Record<string, string>): RegisterPayload {
    return {
      projectName: this.state.projectName,
      path: process.cwd(),
      serviceTypes: serviceTypes || { backend: 'node-ts', frontend: 'angular' }
    };
  }
}
